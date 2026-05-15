import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  normalizeTranslationLanguage,
  SUPPORTED_TRANSLATION_LANGUAGES,
} from "@/lib/api";
import {
  CALL_EVENT_TYPES,
  buildVideoSignal,
  createPeerConnection,
  createRemoteStream,
  describeMediaAccessError,
  getMediaDevicesSupportMessage,
  getVideoCallSupportMessage,
  hasTurnRelayConfigured,
  isVideoCallEvent,
  resolveVideoSignalPayload,
  stopMediaStream,
  supportsMediaDevices,
  supportsWebRtc,
} from "@/services/videoCallService";
import {
  createGestureDetector,
  createMotionState,
  detectGesture,
} from "@/services/gestureService";

const INITIAL_CALL_STATE = {
  incomingCall: null,
  activeCall: null,
  error: "",
};
const CONNECTION_TIMEOUT_MS = 15000;
const CONNECTION_RECOVERY_GRACE_MS = 8000;
const CAPTION_SIGNAL_THROTTLE_MS = 300;
const CAPTION_TRANSCRIBE_INTERVAL_MS = 2600;
const CAPTION_TRANSCRIBE_DEDUPE_MS = 1800;
const GESTURE_DETECT_INTERVAL_MS = 140;
const GESTURE_COOLDOWN_MS = 2600;
const GESTURE_REQUIRED_STABLE_FRAMES = 3;
const GESTURE_MIN_CONFIDENCE = 0.78;
const ICE_RESTART_COOLDOWN_MS = 5000;
const REMOTE_GESTURE_VISIBLE_MS = 4200;
const IN_CALL_GESTURE_HINT =
  "Supported signs: thumbs up, open palm, fist, OK sign, point up, peace, call me, I love you, wave";
const SPEECH_LANGUAGE_MAP = Object.freeze({
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  hi: "hi-IN",
  ja: "ja-JP",
  pt: "pt-BR",
  it: "it-IT",
  kn: "kn-IN",
  ml: "ml-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  bn: "bn-IN",
  pa: "pa-IN",
});

function createCallId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function requestVideoStream() {
  if (!supportsMediaDevices()) {
    throw new Error(
      getMediaDevicesSupportMessage("camera and microphone")
    );
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function toSpeechRecognitionLanguage(languageCode) {
  const normalized = normalizeTranslationLanguage(languageCode, "en");
  return SPEECH_LANGUAGE_MAP[normalized] || normalized || "en-US";
}

function trimCaptionText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function buildCaptionState(overrides = {}) {
  return {
    text: "",
    translatedText: "",
    sourceLanguage: "",
    targetLanguage: "",
    isFinal: false,
    updatedAt: 0,
    translationPending: false,
    error: "",
    ...overrides,
  };
}

function getSupportedCaptionRecorderMimeType() {
  if (
    typeof window === "undefined" ||
    typeof window.MediaRecorder === "undefined" ||
    typeof window.MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return (
    candidates.find((mimeType) =>
      window.MediaRecorder.isTypeSupported(mimeType)
    ) || ""
  );
}

export function useVideoCall({
  userId,
  sendSignal,
  resolveRoomName,
  resolvePeerName,
  onNotify,
  preferredCaptionLanguage = "en",
}) {
  const [callState, setCallState] = useState(INITIAL_CALL_STATE);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const queuedCandidatesRef = useRef([]);
  const queuedOutboundCandidatesRef = useRef([]);
  const signalReadyRef = useRef(false);
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const connectionTimeoutRef = useRef(0);
  const connectionRecoveryTimeoutRef = useRef(0);
  const remoteGestureTimerRef = useRef(0);
  const speechRecognitionRef = useRef(null);
  const captionRecorderRef = useRef(null);
  const captionTranscribeInFlightRef = useRef(false);
  const captionLastTranscriptRef = useRef({ text: "", at: 0 });
  const captionRecorderErrorRef = useRef("");
  const remoteCaptionRecorderRef = useRef(null);
  const remoteCaptionTranscribeInFlightRef = useRef(false);
  const remoteCaptionLastTranscriptRef = useRef({ text: "", at: 0 });
  const remoteCaptionRecorderErrorRef = useRef("");
  const remoteCaptionLocalCaptureRef = useRef(false);
  const speechRestartTimerRef = useRef(0);
  const lastCaptionSignalRef = useRef({ text: "", at: 0 });
  const remoteCaptionRef = useRef(buildCaptionState());
  const remoteCaptionTranslationTimerRef = useRef(0);
  const remoteCaptionTranslationSeqRef = useRef(0);
  const gestureDetectorRef = useRef(null);
  const gestureVideoRef = useRef(null);
  const gestureFrameRef = useRef(0);
  const gestureLastProcessedAtRef = useRef(0);
  const gestureMotionStateRef = useRef(createMotionState());
  const gestureStableRef = useRef({ gesture: null, frames: 0 });
  const gestureLastSentAtRef = useRef(0);
  const lastIceRestartRef = useRef({ callId: "", at: 0 });
  const sendSignalRef = useRef(sendSignal);
  const notifyRef = useRef(onNotify);
  const cleanupActiveCallRef = useRef(() => {});
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [gestureModeEnabled, setGestureModeEnabled] = useState(false);
  const [captionTargetLanguage, setCaptionTargetLanguage] = useState(() =>
    normalizeTranslationLanguage(preferredCaptionLanguage, "en")
  );
  const [speechInputLanguage, setSpeechInputLanguage] = useState(() =>
    normalizeTranslationLanguage(preferredCaptionLanguage, "en")
  );
  const [localCaption, setLocalCaption] = useState(
    buildCaptionState({
      sourceLanguage: normalizeTranslationLanguage(preferredCaptionLanguage, "en"),
    })
  );
  const [remoteCaption, setRemoteCaption] = useState(buildCaptionState());
  const [remoteGesture, setRemoteGesture] = useState(null);
  const [gestureState, setGestureState] = useState({
    enabled: false,
    supported: true,
    status: "idle",
    message: "Gesture mode is off",
    hint: "",
    confidence: 0,
    emoji: "",
  });
  const speechRecognitionSupported = Boolean(getSpeechRecognitionConstructor());
  const captionRecorderSupported =
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined";
  const captionsSupported =
    speechRecognitionSupported || captionRecorderSupported;
  const captionCaptureMode = speechRecognitionSupported
    ? "speech-recognition"
    : captionRecorderSupported
      ? "transcription"
      : "unsupported";

  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  useEffect(() => {
    notifyRef.current = onNotify;
  }, [onNotify]);

  useEffect(() => {
    remoteCaptionRef.current = remoteCaption;
  }, [remoteCaption]);

  useEffect(() => {
    const normalizedPreferredLanguage = normalizeTranslationLanguage(
      preferredCaptionLanguage,
      "en"
    );
    setCaptionTargetLanguage((previousLanguage) =>
      previousLanguage ? previousLanguage : normalizedPreferredLanguage
    );
    setSpeechInputLanguage((previousLanguage) =>
      previousLanguage ? previousLanguage : normalizedPreferredLanguage
    );
  }, [preferredCaptionLanguage]);

  const patchCallState = useCallback((patch) => {
    setCallState((previousState) => ({ ...previousState, ...patch }));
  }, []);

  const updateIncomingCall = useCallback((incomingCall) => {
    incomingCallRef.current = incomingCall;
    setCallState((previousState) => ({ ...previousState, incomingCall }));
  }, []);

  const updateActiveCall = useCallback((updater) => {
    setCallState((previousState) => {
      const nextActiveCall =
        typeof updater === "function"
          ? updater(previousState.activeCall)
          : updater;

      activeCallRef.current = nextActiveCall;
      return { ...previousState, activeCall: nextActiveCall };
    });
  }, []);

  const report = useCallback((payload) => {
    notifyRef.current?.(payload);
  }, []);

  const clearRemoteGestureTimer = useCallback(() => {
    if (remoteGestureTimerRef.current) {
      window.clearTimeout(remoteGestureTimerRef.current);
      remoteGestureTimerRef.current = 0;
    }
  }, []);

  const clearSpeechRestartTimer = useCallback(() => {
    if (speechRestartTimerRef.current) {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = 0;
    }
  }, []);

  const clearRemoteCaptionTranslationTimer = useCallback(() => {
    if (remoteCaptionTranslationTimerRef.current) {
      window.clearTimeout(remoteCaptionTranslationTimerRef.current);
      remoteCaptionTranslationTimerRef.current = 0;
    }
  }, []);

  const stopCaptionRecorder = useCallback(() => {
    const recorder = captionRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      captionRecorderRef.current = null;

      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        // Ignore browsers that throw during recorder teardown.
      }
    }

    captionTranscribeInFlightRef.current = false;
    captionRecorderErrorRef.current = "";
  }, []);

  const stopRemoteCaptionRecorder = useCallback(() => {
    const recorder = remoteCaptionRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      remoteCaptionRecorderRef.current = null;

      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        // Ignore browsers that throw during recorder teardown.
      }
    }

    remoteCaptionTranscribeInFlightRef.current = false;
    remoteCaptionRecorderErrorRef.current = "";
    remoteCaptionLocalCaptureRef.current = false;
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    clearSpeechRestartTimer();
    const recognition = speechRecognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      speechRecognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        // Ignore browsers that throw while stopping an idle recognizer.
      }
    }
  }, [clearSpeechRestartTimer]);

  const resetCaptionState = useCallback(() => {
    clearRemoteCaptionTranslationTimer();
    remoteCaptionTranslationSeqRef.current += 1;
    captionLastTranscriptRef.current = { text: "", at: 0 };
    remoteCaptionLastTranscriptRef.current = { text: "", at: 0 };
    remoteCaptionLocalCaptureRef.current = false;
    setLocalCaption(
      buildCaptionState({
        sourceLanguage: normalizeTranslationLanguage(speechInputLanguage, "en"),
      })
    );
    setRemoteCaption(buildCaptionState());
    lastCaptionSignalRef.current = { text: "", at: 0 };
  }, [clearRemoteCaptionTranslationTimer, speechInputLanguage]);

  const scheduleRemoteGestureClear = useCallback(() => {
    clearRemoteGestureTimer();
    remoteGestureTimerRef.current = window.setTimeout(() => {
      setRemoteGesture(null);
    }, REMOTE_GESTURE_VISIBLE_MS);
  }, [clearRemoteGestureTimer]);

  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = 0;
    }
  }, []);

  const clearConnectionRecoveryTimeout = useCallback(() => {
    if (connectionRecoveryTimeoutRef.current) {
      window.clearTimeout(connectionRecoveryTimeoutRef.current);
      connectionRecoveryTimeoutRef.current = 0;
    }
  }, []);

  const armConnectionTimeout = useCallback(
    (callId, peerName) => {
      clearConnectionTimeout();
      connectionTimeoutRef.current = window.setTimeout(() => {
        const activeCall = activeCallRef.current;
        if (!activeCall || activeCall.callId !== callId) {
          return;
        }

        if (activeCall.phase === "connected") {
          return;
        }

        report({
          title: hasTurnRelayConfigured()
            ? "Media connection is still pending"
            : "TURN relay required",
          description: hasTurnRelayConfigured()
            ? `Still trying to establish audio/video with ${peerName}.`
            : "Signaling is working, but audio/video relay is not configured. Add TURN credentials so calls work across real networks.",
          variant: "destructive",
        });
      }, CONNECTION_TIMEOUT_MS);
    },
    [clearConnectionTimeout, report]
  );

  const resetPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const clearRemoteStream = useCallback(() => {
    remoteStreamRef.current = null;
  }, []);

  const stopGestureDetection = useCallback(() => {
    if (gestureFrameRef.current) {
      cancelAnimationFrame(gestureFrameRef.current);
      gestureFrameRef.current = 0;
    }
    gestureLastProcessedAtRef.current = 0;
    gestureStableRef.current = { gesture: null, frames: 0 };
    gestureMotionStateRef.current = createMotionState();
    if (gestureVideoRef.current) {
      gestureVideoRef.current.pause?.();
      gestureVideoRef.current.srcObject = null;
      gestureVideoRef.current = null;
    }
  }, []);

  const cleanupActiveCall = useCallback(
    ({ preserveIncoming = false } = {}) => {
      resetPeerConnection();
      queuedCandidatesRef.current = [];
      queuedOutboundCandidatesRef.current = [];
      signalReadyRef.current = false;
      clearConnectionTimeout();
      clearConnectionRecoveryTimeout();
      clearRemoteGestureTimer();
      stopSpeechRecognition();
      stopCaptionRecorder();
      stopRemoteCaptionRecorder();
      stopGestureDetection();
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      clearRemoteStream();
      activeCallRef.current = null;
      setRemoteGesture(null);
      lastIceRestartRef.current = { callId: "", at: 0 };
      setGestureState({
        enabled: gestureModeEnabled,
        supported: true,
        status: gestureModeEnabled ? "idle" : "disabled",
        message: gestureModeEnabled
          ? "Waiting for a mapped gesture"
          : "Gesture mode is off",
        hint: "",
        confidence: 0,
        emoji: "",
      });
      resetCaptionState();

      setCallState((previousState) => ({
        incomingCall: preserveIncoming ? previousState.incomingCall : null,
        activeCall: null,
        error: previousState.error,
      }));

      if (!preserveIncoming) {
        incomingCallRef.current = null;
      }
    },
    [
      clearConnectionTimeout,
      clearConnectionRecoveryTimeout,
      clearRemoteStream,
      clearRemoteGestureTimer,
      gestureModeEnabled,
      resetCaptionState,
      resetPeerConnection,
      stopCaptionRecorder,
      stopRemoteCaptionRecorder,
      stopGestureDetection,
      stopSpeechRecognition,
    ]
  );

  const sendCallSignal = useCallback(
    async ({
      eventType,
      roomId,
      recipientId,
      callId,
      sdp,
      candidate,
      candidateMid,
      candidateMLineIndex,
      callStatus,
      payload: signalPayload,
    }) => {
      const nextPayload = buildVideoSignal({
        eventType,
        sender: userId,
        roomId,
        recipientId,
        callId,
        callMediaType: "VIDEO",
        sdp,
        candidate,
        candidateMid,
        candidateMLineIndex,
        callStatus,
        payload: signalPayload,
      });

      await sendSignalRef.current?.(nextPayload);
    },
    [userId]
  );

  const applyRemoteCaptionTranslation = useCallback(
    async ({ text, sourceLanguage, isFinal }) => {
      const trimmedText = trimCaptionText(text);
      if (!trimmedText) {
        setRemoteCaption(
          buildCaptionState({
            sourceLanguage: sourceLanguage || "",
            targetLanguage: normalizeTranslationLanguage(
              captionTargetLanguage,
              "none"
            ),
            isFinal: Boolean(isFinal),
            updatedAt: Date.now(),
          })
        );
        return;
      }

      const normalizedTargetLanguage = normalizeTranslationLanguage(
        captionTargetLanguage,
        "none"
      );
      const normalizedSourceLanguage = normalizeTranslationLanguage(
        sourceLanguage,
        "auto"
      );
      const translationRequestId = remoteCaptionTranslationSeqRef.current + 1;
      remoteCaptionTranslationSeqRef.current = translationRequestId;

      setRemoteCaption((previousCaption) => ({
        ...previousCaption,
        text: trimmedText,
        translatedText:
          normalizedTargetLanguage === "none" ||
          normalizedTargetLanguage === normalizedSourceLanguage
            ? trimmedText
            : "",
        sourceLanguage: normalizedSourceLanguage,
        targetLanguage: normalizedTargetLanguage,
        isFinal: Boolean(isFinal),
        translationPending:
          normalizedTargetLanguage !== "none" &&
          normalizedTargetLanguage !== normalizedSourceLanguage,
        error: "",
        updatedAt: Date.now(),
      }));

      if (
        normalizedTargetLanguage === "none" ||
        normalizedTargetLanguage === normalizedSourceLanguage
      ) {
        setRemoteCaption((previousCaption) => ({
          ...previousCaption,
          translatedText: trimmedText,
          sourceLanguage: normalizedSourceLanguage,
          targetLanguage: normalizedTargetLanguage,
          isFinal: Boolean(isFinal),
          translationPending: false,
          error: "",
          updatedAt: Date.now(),
        }));
        return;
      }

      try {
        const translation = await api.translation.translateText(
          trimmedText,
          normalizedSourceLanguage,
          normalizedTargetLanguage
        );

        if (remoteCaptionTranslationSeqRef.current !== translationRequestId) {
          return;
        }

        const correctedText =
          trimCaptionText(translation?.correctedText) || trimmedText;
        const translatedText = trimCaptionText(translation?.translatedText);
        const resolvedSourceLanguage = normalizeTranslationLanguage(
          translation?.sourceLanguage || normalizedSourceLanguage,
          normalizedSourceLanguage
        );
        const translationSucceeded =
          Boolean(translation?.success) && Boolean(translatedText);

        setRemoteCaption((previousCaption) => ({
          ...previousCaption,
          text: correctedText,
          translatedText: translationSucceeded ? translatedText : correctedText,
          sourceLanguage: resolvedSourceLanguage,
          targetLanguage: normalizedTargetLanguage,
          isFinal: Boolean(isFinal),
          translationPending: false,
          error: translationSucceeded ? "" : translation?.error || "",
          updatedAt: Date.now(),
        }));
      } catch {
        if (remoteCaptionTranslationSeqRef.current !== translationRequestId) {
          return;
        }

        setRemoteCaption((previousCaption) => ({
          ...previousCaption,
          text: trimmedText,
          translatedText: trimmedText,
          sourceLanguage: normalizedSourceLanguage,
          targetLanguage: normalizedTargetLanguage,
          isFinal: Boolean(isFinal),
          translationPending: false,
          error: "",
          updatedAt: Date.now(),
        }));
      }
    },
    [captionTargetLanguage]
  );

  const handleRemoteCaptionPayload = useCallback(
    (payload = {}, { source = "signal" } = {}) => {
      if (source === "signal" && remoteCaptionLocalCaptureRef.current) {
        return;
      }

      const nextText = trimCaptionText(payload.text);
      const nextSourceLanguage = normalizeTranslationLanguage(
        payload.sourceLanguage,
        "auto"
      );
      const nextTargetLanguage = normalizeTranslationLanguage(
        captionTargetLanguage,
        "none"
      );
      const isFinal = Boolean(payload.isFinal);

      clearRemoteCaptionTranslationTimer();

      if (!nextText) {
        setRemoteCaption(
          buildCaptionState({
            sourceLanguage: nextSourceLanguage,
            targetLanguage: nextTargetLanguage,
            isFinal,
            updatedAt: Date.now(),
          })
        );
        return;
      }

      setRemoteCaption((previousCaption) => ({
        ...previousCaption,
        text: nextText,
        translatedText:
          nextTargetLanguage === "none" ||
          nextTargetLanguage === nextSourceLanguage
            ? nextText
            : "",
        sourceLanguage: nextSourceLanguage,
        targetLanguage: nextTargetLanguage,
        isFinal,
        translationPending:
          nextTargetLanguage !== "none" &&
          nextTargetLanguage !== nextSourceLanguage,
        error: "",
        updatedAt: Date.now(),
      }));

      if (isFinal) {
        void applyRemoteCaptionTranslation({
          text: nextText,
          sourceLanguage: nextSourceLanguage,
          isFinal: true,
        });
        return;
      }

      remoteCaptionTranslationTimerRef.current = window.setTimeout(() => {
        void applyRemoteCaptionTranslation({
          text: nextText,
          sourceLanguage: nextSourceLanguage,
          isFinal: false,
        });
      }, CAPTION_SIGNAL_THROTTLE_MS);
    },
    [
      applyRemoteCaptionTranslation,
      captionTargetLanguage,
      clearRemoteCaptionTranslationTimer,
    ]
  );

  const sendCaptionSignal = useCallback(
    async (text, { isFinal = false, sourceLanguage = "auto" } = {}) => {
      const activeCall = activeCallRef.current;
      const trimmedText = trimCaptionText(text);
      if (!activeCall || !trimmedText) {
        return;
      }

      const now = Date.now();
      if (
        !isFinal &&
        trimmedText === lastCaptionSignalRef.current.text &&
        now - lastCaptionSignalRef.current.at < CAPTION_SIGNAL_THROTTLE_MS
      ) {
        return;
      }

      lastCaptionSignalRef.current = { text: trimmedText, at: now };
      const fallbackInputLanguage = normalizeTranslationLanguage(
        speechInputLanguage,
        "en"
      );
      const resolvedSourceLanguage = normalizeTranslationLanguage(
        sourceLanguage,
        "auto"
      );
      const displaySourceLanguage =
        resolvedSourceLanguage === "auto"
          ? fallbackInputLanguage
          : resolvedSourceLanguage;

      setLocalCaption(
        buildCaptionState({
          text: trimmedText,
          translatedText: trimmedText,
          sourceLanguage: displaySourceLanguage,
          targetLanguage: normalizeTranslationLanguage(
            captionTargetLanguage,
            "none"
          ),
          isFinal,
          updatedAt: now,
        })
      );

      await sendCallSignal({
        eventType: CALL_EVENT_TYPES.CAPTION,
        roomId: activeCall.roomId,
        recipientId: activeCall.peerUserId,
        callId: activeCall.callId,
        payload: {
          text: trimmedText,
          sourceLanguage: resolvedSourceLanguage,
          isFinal,
        },
      });
    },
    [captionTargetLanguage, sendCallSignal, speechInputLanguage]
  );

  const sendGestureSignal = useCallback(
    async (prediction) => {
      const activeCall = activeCallRef.current;
      if (!activeCall || !prediction?.gesture) {
        return;
      }

      const now = Date.now();
      gestureLastSentAtRef.current = now;

      setGestureState({
        enabled: true,
        supported: true,
        status: "sent",
        message: prediction.messageText || prediction.message,
        hint: prediction.hint || "",
        confidence: prediction.confidence || 0,
        emoji: prediction.emoji || "",
      });

      await sendCallSignal({
        eventType: CALL_EVENT_TYPES.GESTURE,
        roomId: activeCall.roomId,
        recipientId: activeCall.peerUserId,
        callId: activeCall.callId,
        payload: {
          gesture: prediction.gesture,
          messageText: prediction.messageText || prediction.message,
          emoji: prediction.emoji || "",
          confidence: prediction.confidence || 0,
          hint: prediction.hint || "",
        },
      });
    },
    [sendCallSignal]
  );

  useEffect(() => {
    const currentRemoteCaption = remoteCaptionRef.current;
    if (!currentRemoteCaption.text) {
      return;
    }

    void applyRemoteCaptionTranslation({
      text: currentRemoteCaption.text,
      sourceLanguage: currentRemoteCaption.sourceLanguage || "auto",
      isFinal: currentRemoteCaption.isFinal,
    });
  }, [applyRemoteCaptionTranslation, captionTargetLanguage]);

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((previousEnabled) => {
      const nextEnabled = !previousEnabled;

      if (!nextEnabled) {
        stopSpeechRecognition();
        stopCaptionRecorder();
        resetCaptionState();
      }

      return nextEnabled;
    });
  }, [resetCaptionState, stopCaptionRecorder, stopSpeechRecognition]);

  const toggleGestureMode = useCallback(() => {
    setGestureModeEnabled((previousEnabled) => {
      const nextEnabled = !previousEnabled;

      if (!nextEnabled) {
        stopGestureDetection();
        setGestureState({
          enabled: false,
          supported: true,
          status: "disabled",
          message: "Gesture mode is off",
          hint: "",
          confidence: 0,
          emoji: "",
        });
      } else {
        setGestureState({
          enabled: true,
          supported: true,
          status: "idle",
          message: "Waiting for a mapped gesture",
          hint: IN_CALL_GESTURE_HINT,
          confidence: 0,
          emoji: "",
        });
      }

      return nextEnabled;
    });
  }, [stopGestureDetection]);

  const handleCaptionTargetLanguageChange = useCallback((languageCode) => {
    setCaptionTargetLanguage(normalizeTranslationLanguage(languageCode, "en"));
  }, []);

  const handleSpeechInputLanguageChange = useCallback((languageCode) => {
    setSpeechInputLanguage(normalizeTranslationLanguage(languageCode, "en"));
  }, []);

  useEffect(() => {
    if (!captionsEnabled || !callState.activeCall || !speechRecognitionSupported) {
      stopSpeechRecognition();
      return undefined;
    }

    stopCaptionRecorder();

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      return undefined;
    }

    let cancelled = false;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = toSpeechRecognitionLanguage(speechInputLanguage);
    speechRecognitionRef.current = recognition;

    recognition.onresult = (event) => {
      if (cancelled) {
        return;
      }

      let nextInterimText = "";
      let nextFinalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = trimCaptionText(event.results[index]?.[0]?.transcript);
        if (!transcript) {
          continue;
        }

        if (event.results[index].isFinal) {
          nextFinalText = nextFinalText
            ? `${nextFinalText} ${transcript}`
            : transcript;
        } else {
          nextInterimText = nextInterimText
            ? `${nextInterimText} ${transcript}`
            : transcript;
        }
      }

      if (nextInterimText) {
        void sendCaptionSignal(nextInterimText, {
          isFinal: false,
          sourceLanguage: "auto",
        });
      }

      if (nextFinalText) {
        void sendCaptionSignal(nextFinalText, {
          isFinal: true,
          sourceLanguage: "auto",
        });
      }
    };

    recognition.onerror = (event) => {
      if (cancelled) {
        return;
      }

      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setCaptionsEnabled(false);
        report({
          title: "Caption microphone access blocked",
          description:
            "Allow microphone speech recognition in your browser to use live captions.",
          variant: "destructive",
        });
        return;
      }

      if (event?.error === "audio-capture") {
        report({
          title: "Caption microphone unavailable",
          description: "No microphone was available for live speech captions.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      if (
        cancelled ||
        !captionsEnabled ||
        !activeCallRef.current ||
        speechRecognitionRef.current !== recognition
      ) {
        return;
      }

      clearSpeechRestartTimer();
      speechRestartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // Ignore restart races while the browser is still resetting recognition.
        }
      }, 220);
    };

    try {
      recognition.start();
    } catch {
      // Some browsers throw if start races with a previous session.
    }

    return () => {
      cancelled = true;
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null;
      }
      try {
        recognition.stop();
      } catch {
        // Ignore teardown races.
      }
    };
  }, [
    callState.activeCall,
    captionsEnabled,
    clearSpeechRestartTimer,
    report,
    sendCaptionSignal,
    speechInputLanguage,
    speechRecognitionSupported,
    stopCaptionRecorder,
    stopSpeechRecognition,
  ]);

  useEffect(() => {
    if (!captionsEnabled || !callState.activeCall || speechRecognitionSupported) {
      stopCaptionRecorder();
      return undefined;
    }

    if (!captionRecorderSupported || typeof window === "undefined") {
      return undefined;
    }

    const localStream = callState.activeCall.localStream;
    const audioTracks = localStream?.getAudioTracks?.() || [];
    if (!audioTracks.length || typeof window.MediaRecorder === "undefined") {
      return undefined;
    }

    const recorderMimeType = getSupportedCaptionRecorderMimeType();
    const recorderStream = new MediaStream(audioTracks);
    let cancelled = false;

    try {
      captionRecorderRef.current = recorderMimeType
        ? new window.MediaRecorder(recorderStream, { mimeType: recorderMimeType })
        : new window.MediaRecorder(recorderStream);
    } catch (error) {
      report({
        title: "Live captions unavailable",
        description:
          error instanceof Error
            ? error.message
            : "This browser could not start in-call audio transcription.",
        variant: "destructive",
      });
      return undefined;
    }

    captionRecorderErrorRef.current = "";
    const recorder = captionRecorderRef.current;

    recorder.ondataavailable = async (event) => {
      if (
        cancelled ||
        !event.data ||
        event.data.size < 1024 ||
        captionTranscribeInFlightRef.current
      ) {
        return;
      }

      captionTranscribeInFlightRef.current = true;

      try {
        const recorderType = event.data.type || recorderMimeType || "audio/webm";
        const extension = recorderType.includes("mp4")
          ? "mp4"
          : recorderType.includes("ogg")
            ? "ogg"
            : "webm";
        const audioFile = new File(
          [event.data],
          `connecthub-call-caption-${Date.now()}.${extension}`,
          { type: recorderType }
        );
        const transcription = await api.translation.transcribeAudio(
          audioFile,
          normalizeTranslationLanguage(speechInputLanguage, "auto")
        );
        const transcript = trimCaptionText(transcription?.transcript);

        if (!transcript) {
          return;
        }

        const now = Date.now();
        if (
          transcript === captionLastTranscriptRef.current.text &&
          now - captionLastTranscriptRef.current.at < CAPTION_TRANSCRIBE_DEDUPE_MS
        ) {
          return;
        }

        captionLastTranscriptRef.current = { text: transcript, at: now };
        await sendCaptionSignal(transcript, {
          isFinal: true,
          sourceLanguage: transcription?.sourceLanguage || "auto",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Audio transcription is temporarily unavailable.";

        if (captionRecorderErrorRef.current !== message) {
          captionRecorderErrorRef.current = message;
          report({
            title: "Caption transcription paused",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        captionTranscribeInFlightRef.current = false;
      }
    };

    recorder.onerror = (event) => {
      if (cancelled) {
        return;
      }

      const message =
        event?.error?.message || "The browser could not keep audio caption recording active.";

      if (captionRecorderErrorRef.current !== message) {
        captionRecorderErrorRef.current = message;
        report({
          title: "Caption recording stopped",
          description: message,
          variant: "destructive",
        });
      }
    };

    try {
      recorder.start(CAPTION_TRANSCRIBE_INTERVAL_MS);
    } catch (error) {
      captionRecorderRef.current = null;
      report({
        title: "Live captions unavailable",
        description:
          error instanceof Error
            ? error.message
            : "This browser could not start in-call caption recording.",
        variant: "destructive",
      });
      return undefined;
    }

    return () => {
      cancelled = true;
      stopCaptionRecorder();
    };
  }, [
    callState.activeCall,
    captionRecorderSupported,
    captionsEnabled,
    report,
    sendCaptionSignal,
    speechInputLanguage,
    speechRecognitionSupported,
    stopCaptionRecorder,
  ]);

  useEffect(() => {
    if (!captionsEnabled || !callState.activeCall) {
      stopRemoteCaptionRecorder();
      return undefined;
    }

    if (!captionRecorderSupported || typeof window === "undefined") {
      return undefined;
    }

    const remoteStream = callState.activeCall.remoteStream;
    const audioTracks =
      remoteStream?.getAudioTracks?.().filter(
        (track) => track.readyState === "live" && track.enabled !== false
      ) || [];

    if (!audioTracks.length || typeof window.MediaRecorder === "undefined") {
      stopRemoteCaptionRecorder();
      return undefined;
    }

    const recorderMimeType = getSupportedCaptionRecorderMimeType();
    const recorderStream = new MediaStream(audioTracks);
    let cancelled = false;

    try {
      remoteCaptionRecorderRef.current = recorderMimeType
        ? new window.MediaRecorder(recorderStream, { mimeType: recorderMimeType })
        : new window.MediaRecorder(recorderStream);
    } catch {
      return undefined;
    }

    remoteCaptionRecorderErrorRef.current = "";
    remoteCaptionLocalCaptureRef.current = true;
    const recorder = remoteCaptionRecorderRef.current;

    recorder.ondataavailable = async (event) => {
      if (
        cancelled ||
        !event.data ||
        event.data.size < 1024 ||
        remoteCaptionTranscribeInFlightRef.current
      ) {
        return;
      }

      remoteCaptionTranscribeInFlightRef.current = true;

      try {
        const recorderType = event.data.type || recorderMimeType || "audio/webm";
        const extension = recorderType.includes("mp4")
          ? "mp4"
          : recorderType.includes("ogg")
            ? "ogg"
            : "webm";
        const audioFile = new File(
          [event.data],
          `connecthub-remote-call-caption-${Date.now()}.${extension}`,
          { type: recorderType }
        );
        const transcription = await api.translation.transcribeAudio(
          audioFile,
          "auto"
        );
        const transcript = trimCaptionText(transcription?.transcript);

        if (!transcript) {
          return;
        }

        const now = Date.now();
        if (
          transcript === remoteCaptionLastTranscriptRef.current.text &&
          now - remoteCaptionLastTranscriptRef.current.at <
            CAPTION_TRANSCRIBE_DEDUPE_MS
        ) {
          return;
        }

        remoteCaptionLastTranscriptRef.current = { text: transcript, at: now };
        handleRemoteCaptionPayload(
          {
            text: transcript,
            sourceLanguage: transcription?.sourceLanguage || "auto",
            isFinal: true,
          },
          { source: "receiver" }
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Incoming audio transcription is temporarily unavailable.";

        if (remoteCaptionRecorderErrorRef.current !== message) {
          remoteCaptionRecorderErrorRef.current = message;
          report({
            title: "Incoming caption transcription paused",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        remoteCaptionTranscribeInFlightRef.current = false;
      }
    };

    recorder.onerror = (event) => {
      if (cancelled) {
        return;
      }

      const message =
        event?.error?.message ||
        "The browser could not keep incoming audio caption recording active.";

      if (remoteCaptionRecorderErrorRef.current !== message) {
        remoteCaptionRecorderErrorRef.current = message;
        report({
          title: "Incoming captions stopped",
          description: message,
          variant: "destructive",
        });
      }
    };

    try {
      recorder.start(CAPTION_TRANSCRIBE_INTERVAL_MS);
    } catch {
      remoteCaptionRecorderRef.current = null;
      remoteCaptionLocalCaptureRef.current = false;
      return undefined;
    }

    return () => {
      cancelled = true;
      stopRemoteCaptionRecorder();
    };
  }, [
    callState.activeCall,
    captionRecorderSupported,
    captionsEnabled,
    handleRemoteCaptionPayload,
    report,
    stopRemoteCaptionRecorder,
  ]);

  useEffect(() => {
    if (!gestureModeEnabled) {
      setGestureState({
        enabled: false,
        supported: true,
        status: "disabled",
        message: "Gesture mode is off",
        hint: "",
        confidence: 0,
        emoji: "",
      });
      stopGestureDetection();
      return undefined;
    }

    const localStream = callState.activeCall?.localStream;
    const videoTrack = localStream?.getVideoTracks?.()[0];
    if (!localStream || !videoTrack) {
      setGestureState({
        enabled: true,
        supported: true,
        status: "waiting",
        message: "Gesture mode will start when your camera is live",
        hint: "Turn your camera on to send gestures in-call",
        confidence: 0,
        emoji: "",
      });
      stopGestureDetection();
      return undefined;
    }

    if (videoTrack.enabled === false) {
      setGestureState({
        enabled: true,
        supported: true,
        status: "camera-off",
        message: "Enable your camera to send gestures",
        hint: "Gesture mode uses your live self-view stream",
        confidence: 0,
        emoji: "",
      });
      stopGestureDetection();
      return undefined;
    }

    let cancelled = false;

    const loop = async () => {
      if (cancelled) {
        return;
      }

      try {
        if (!gestureDetectorRef.current) {
          setGestureState({
            enabled: true,
            supported: true,
            status: "loading",
            message: "Loading gesture detection",
            hint: "Starting hand tracking for in-call signs",
            confidence: 0,
            emoji: "",
          });
          gestureDetectorRef.current = await createGestureDetector();
        }

        if (cancelled) {
          return;
        }

        if (!gestureVideoRef.current) {
          const previewVideo = document.createElement("video");
          previewVideo.muted = true;
          previewVideo.autoplay = true;
          previewVideo.playsInline = true;
          previewVideo.srcObject = localStream;
          gestureVideoRef.current = previewVideo;
          try {
            await previewVideo.play();
          } catch {
            // Playback can still begin after metadata loads.
          }
        }
      } catch (error) {
        setGestureState({
          enabled: true,
          supported: false,
          status: "error",
          message: "Gesture mode is unavailable on this device",
          hint:
            error instanceof Error
              ? error.message
              : "Could not start hand tracking in the browser",
          confidence: 0,
          emoji: "",
        });
        stopGestureDetection();
        return;
      }

      const detector = gestureDetectorRef.current;
      const previewVideo = gestureVideoRef.current;
      if (!detector || !previewVideo) {
        return;
      }

      const now = performance.now();
      if (
        previewVideo.readyState < 2 ||
        !previewVideo.videoWidth ||
        now - gestureLastProcessedAtRef.current < GESTURE_DETECT_INTERVAL_MS
      ) {
        gestureFrameRef.current = requestAnimationFrame(() => {
          void loop();
        });
        return;
      }

      gestureLastProcessedAtRef.current = now;

      const result = detector.detectForVideo(previewVideo, now);
      const prediction = detectGesture(result, gestureMotionStateRef.current, now);

      if (
        prediction.status === "DETECTED" &&
        prediction.gesture &&
        prediction.confidence >= GESTURE_MIN_CONFIDENCE
      ) {
        if (gestureStableRef.current.gesture === prediction.gesture) {
          gestureStableRef.current.frames += 1;
        } else {
          gestureStableRef.current = {
            gesture: prediction.gesture,
            frames: 1,
          };
        }

        const stableFrames = gestureStableRef.current.frames;
        setGestureState({
          enabled: true,
          supported: true,
          status: stableFrames >= GESTURE_REQUIRED_STABLE_FRAMES ? "ready" : "stabilizing",
          message:
            stableFrames >= GESTURE_REQUIRED_STABLE_FRAMES
              ? prediction.messageText || prediction.message
              : "Hold the gesture steady",
          hint:
            stableFrames >= GESTURE_REQUIRED_STABLE_FRAMES
              ? prediction.hint || "Gesture ready to send"
              : prediction.hint || "Keep your hand in frame for one more moment",
          confidence: prediction.confidence || 0,
          emoji: prediction.emoji || "",
        });

        const nowMs = Date.now();
        if (
          stableFrames >= GESTURE_REQUIRED_STABLE_FRAMES &&
          nowMs - gestureLastSentAtRef.current >= GESTURE_COOLDOWN_MS
        ) {
          void sendGestureSignal(prediction);
        }
      } else {
        gestureStableRef.current = { gesture: null, frames: 0 };
        setGestureState({
          enabled: true,
          supported: true,
          status: prediction.status.toLowerCase(),
          message: prediction.message || "Waiting for a mapped gesture",
          hint: prediction.hint || IN_CALL_GESTURE_HINT,
          confidence: prediction.confidence || 0,
          emoji: prediction.emoji || "",
        });
      }

      gestureFrameRef.current = requestAnimationFrame(() => {
        void loop();
      });
    };

    gestureFrameRef.current = requestAnimationFrame(() => {
      void loop();
    });

    return () => {
      cancelled = true;
      stopGestureDetection();
    };
  }, [
    callState.activeCall,
    gestureModeEnabled,
    sendGestureSignal,
    stopGestureDetection,
  ]);

  const flushQueuedOutboundCandidates = useCallback(async () => {
    const currentCall = activeCallRef.current;
    if (!signalReadyRef.current || !currentCall) {
      return;
    }

    while (queuedOutboundCandidatesRef.current.length > 0) {
      const nextCandidate = queuedOutboundCandidatesRef.current.shift();
      try {
        await sendCallSignal({
          eventType: CALL_EVENT_TYPES.ICE_CANDIDATE,
          roomId: currentCall.roomId,
          recipientId: currentCall.peerUserId,
          callId: currentCall.callId,
          candidate: nextCandidate.candidate,
          candidateMid: nextCandidate.candidateMid,
          candidateMLineIndex: nextCandidate.candidateMLineIndex,
          callStatus: currentCall.phase,
        });
      } catch {
        queuedOutboundCandidatesRef.current.unshift(nextCandidate);
        break;
      }
    }
  }, [sendCallSignal]);

  const flushQueuedCandidates = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection?.remoteDescription) {
      return;
    }

    while (queuedCandidatesRef.current.length > 0) {
      const nextCandidate = queuedCandidatesRef.current.shift();
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(nextCandidate));
      } catch {
        // Ignore malformed or redundant ICE candidates.
      }
    }
  }, []);

  const scheduleConnectionRecoveryTimeout = useCallback(
    (callId, peerName) => {
      clearConnectionRecoveryTimeout();
      connectionRecoveryTimeoutRef.current = window.setTimeout(() => {
        const activeCall = activeCallRef.current;
        if (!activeCall || activeCall.callId !== callId) {
          return;
        }

        if (activeCall.phase === "connected") {
          return;
        }

        report({
          title: hasTurnRelayConfigured()
            ? "Call connection failed"
            : "TURN relay required",
          description: hasTurnRelayConfigured()
            ? `The video call with ${peerName} could not reconnect. Please try again.`
            : "The video call could not reconnect because TURN relay is not configured. Add TURN credentials so calls stay connected across real networks.",
          variant: "destructive",
        });
        cleanupActiveCall();
      }, CONNECTION_RECOVERY_GRACE_MS);
    },
    [clearConnectionRecoveryTimeout, cleanupActiveCall, report]
  );

  const attemptIceRestart = useCallback(
    async (activeCall) => {
      if (!activeCall) {
        return false;
      }

      const peerConnection = peerConnectionRef.current;
      if (
        !peerConnection ||
        peerConnection.connectionState === "closed" ||
        peerConnection.signalingState !== "stable"
      ) {
        return false;
      }

      const now = Date.now();
      if (
        lastIceRestartRef.current.callId === activeCall.callId &&
        now - lastIceRestartRef.current.at < ICE_RESTART_COOLDOWN_MS
      ) {
        return false;
      }

      lastIceRestartRef.current = {
        callId: activeCall.callId,
        at: now,
      };

      try {
        if (typeof peerConnection.restartIce === "function") {
          peerConnection.restartIce();
        }

        const offer = await peerConnection.createOffer({
          iceRestart: true,
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peerConnection.setLocalDescription(offer);
        await sendCallSignal({
          eventType: CALL_EVENT_TYPES.OFFER,
          roomId: activeCall.roomId,
          recipientId: activeCall.peerUserId,
          callId: activeCall.callId,
          sdp: offer.sdp,
          callStatus: "reconnecting",
        });
        signalReadyRef.current = true;
        await flushQueuedOutboundCandidates();
        return true;
      } catch {
        return false;
      }
    },
    [flushQueuedOutboundCandidates, sendCallSignal]
  );

  const handlePeerConnectionStateChange = useCallback(
    (nextState) => {
      const activeCall = activeCallRef.current;
      if (!activeCall) {
        return;
      }

      if (nextState === "connected" || nextState === "completed") {
        clearConnectionTimeout();
        clearConnectionRecoveryTimeout();
        lastIceRestartRef.current = { callId: "", at: 0 };
        updateActiveCall((previousCall) =>
          previousCall
            ? {
                ...previousCall,
                phase: "connected",
                startedAt: previousCall.startedAt || Date.now(),
              }
            : previousCall
        );
        return;
      }

      const hasBeenConnected =
        Boolean(activeCall.startedAt) ||
        activeCall.phase === "connected" ||
        activeCall.phase === "reconnecting";

      if (nextState === "disconnected") {
        updateActiveCall((previousCall) =>
          previousCall
            ? {
                ...previousCall,
                phase: hasBeenConnected ? "reconnecting" : "connecting",
              }
            : previousCall
        );
        if (hasBeenConnected) {
          scheduleConnectionRecoveryTimeout(activeCall.callId, activeCall.peerName);
        }
        return;
      }

      if (nextState === "failed") {
        updateActiveCall((previousCall) =>
          previousCall
            ? {
                ...previousCall,
                phase: hasBeenConnected ? "reconnecting" : "connecting",
              }
            : previousCall
        );
        if (!hasBeenConnected) {
          return;
        }
        scheduleConnectionRecoveryTimeout(activeCall.callId, activeCall.peerName);
        void attemptIceRestart(activeCall);
        return;
      }

      if (nextState === "closed") {
        clearConnectionRecoveryTimeout();
      }
    },
    [
      attemptIceRestart,
      clearConnectionRecoveryTimeout,
      clearConnectionTimeout,
      scheduleConnectionRecoveryTimeout,
      updateActiveCall,
    ]
  );

  const ensurePeerConnection = useCallback(
    async (activeCall) => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const remoteStream = createRemoteStream();
      remoteStreamRef.current = remoteStream;

      const peerConnection = await createPeerConnection({
        onIceCandidate: async (iceCandidate) => {
          const currentCall = activeCallRef.current || activeCall;
          const candidatePayload = {
            candidate: iceCandidate.candidate,
            candidateMid: iceCandidate.sdpMid,
            candidateMLineIndex: iceCandidate.sdpMLineIndex,
          };

          if (!signalReadyRef.current) {
            queuedOutboundCandidatesRef.current.push(candidatePayload);
            return;
          }

          try {
            await sendCallSignal({
              eventType: CALL_EVENT_TYPES.ICE_CANDIDATE,
              roomId: currentCall.roomId,
              recipientId: currentCall.peerUserId,
              callId: currentCall.callId,
              candidate: candidatePayload.candidate,
              candidateMid: candidatePayload.candidateMid,
              candidateMLineIndex: candidatePayload.candidateMLineIndex,
              callStatus: currentCall.phase,
            });
          } catch {
            queuedOutboundCandidatesRef.current.push(candidatePayload);
          }
        },
        onTrack: (event) => {
          const primaryRemoteStream = event.streams?.[0] || null;

          if (primaryRemoteStream) {
            remoteStreamRef.current = primaryRemoteStream;
          } else if (event.track) {
            const alreadyExists = remoteStream
              .getTracks()
              .some((existingTrack) => existingTrack.id === event.track.id);
            if (!alreadyExists) {
              remoteStream.addTrack(event.track);
            }
            remoteStreamRef.current = remoteStream;
          }

          updateActiveCall((previousCall) =>
            previousCall
              ? {
                  ...previousCall,
                  remoteStream: remoteStreamRef.current,
                }
              : previousCall
          );
        },
        onConnectionStateChange: handlePeerConnectionStateChange,
        onIceConnectionStateChange: (iceConnectionState) => {
          if (
            iceConnectionState === "connected" ||
            iceConnectionState === "completed"
          ) {
            handlePeerConnectionStateChange("connected");
            return;
          }

          if (
            iceConnectionState === "disconnected" ||
            iceConnectionState === "failed" ||
            iceConnectionState === "closed"
          ) {
            handlePeerConnectionStateChange(iceConnectionState);
          }
        },
      });

      localStreamRef.current?.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      peerConnectionRef.current = peerConnection;

      updateActiveCall((previousCall) =>
        previousCall
          ? {
              ...previousCall,
              remoteStream,
            }
          : previousCall
      );

      return peerConnection;
    },
    [handlePeerConnectionStateChange, sendCallSignal, updateActiveCall]
  );

  const addOrQueueIceCandidate = useCallback(async (payload) => {
    const candidateInit = {
      candidate: payload.candidate,
      sdpMid: payload.candidateMid,
      sdpMLineIndex: payload.candidateMLineIndex,
    };

    const peerConnection = peerConnectionRef.current;
    if (!peerConnection?.remoteDescription) {
      queuedCandidatesRef.current.push(candidateInit);
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch {
      queuedCandidatesRef.current.push(candidateInit);
    }
  }, []);

  const startVideoCall = useCallback(
    async ({ roomId, recipientId, peerName, roomName }) => {
      if (!userId) {
        report({
          title: "Call unavailable",
          description: "Please sign in again and retry the call.",
          variant: "destructive",
        });
        return false;
      }

      if (!supportsWebRtc() || !supportsMediaDevices()) {
        report({
          title: "Video calls unavailable",
          description: getVideoCallSupportMessage(),
          variant: "destructive",
        });
        return false;
      }

      if (activeCallRef.current || incomingCallRef.current) {
        report({
          title: "Already in a call",
          description: "Finish the current call before starting a new one.",
          variant: "destructive",
        });
        return false;
      }

      try {
        patchCallState({ error: "" });
        const localStream = await requestVideoStream();
        localStreamRef.current = localStream;
        signalReadyRef.current = false;
        queuedOutboundCandidatesRef.current = [];

        const activeCall = {
          callId: createCallId(),
          roomId: String(roomId),
          peerUserId: String(recipientId),
          peerName: peerName || resolvePeerName?.(recipientId, roomId) || "Contact",
          roomName: roomName || resolveRoomName?.(roomId) || "ConnectHub",
          phase: "outgoing",
          isIncoming: false,
          localStream,
          remoteStream: null,
          isMuted: false,
          isCameraEnabled: true,
          startedAt: null,
          offerSdp: null,
        };

        activeCallRef.current = activeCall;
        setCallState({
          incomingCall: null,
          activeCall,
          error: "",
        });

        const peerConnection = await ensurePeerConnection(activeCall);
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peerConnection.setLocalDescription(offer);

        updateActiveCall((previousCall) =>
          previousCall
            ? {
                ...previousCall,
                offerSdp: offer.sdp,
              }
            : previousCall
        );

        await sendCallSignal({
          eventType: CALL_EVENT_TYPES.INVITE,
          roomId,
          recipientId,
          callId: activeCall.callId,
          sdp: offer.sdp,
          callStatus: "ringing",
        });
        signalReadyRef.current = true;
        await flushQueuedOutboundCandidates();
        armConnectionTimeout(activeCall.callId, activeCall.peerName);

        report({
          title: "Calling...",
          description: `Started a video call with ${activeCall.peerName}.`,
        });
        return true;
      } catch (error) {
        cleanupActiveCall();
        report({
          title: "Could not start video call",
          description: describeMediaAccessError(
            error,
            "camera and microphone"
          ),
          variant: "destructive",
        });
        return false;
      }
    },
    [
      armConnectionTimeout,
      cleanupActiveCall,
      ensurePeerConnection,
      flushQueuedOutboundCandidates,
      patchCallState,
      report,
      resolvePeerName,
      resolveRoomName,
      sendCallSignal,
      userId,
    ]
  );

  const acceptIncomingCall = useCallback(async () => {
    const incomingCall = incomingCallRef.current;
    if (!incomingCall) {
      return false;
    }

    if (!supportsWebRtc() || !supportsMediaDevices()) {
      report({
        title: "Video calls unavailable",
        description: getVideoCallSupportMessage(),
        variant: "destructive",
      });
      return false;
    }

    try {
      const localStream = await requestVideoStream();
      localStreamRef.current = localStream;
      signalReadyRef.current = false;
      queuedOutboundCandidatesRef.current = [];

      const activeCall = {
        ...incomingCall,
        phase: "connecting",
        isIncoming: true,
        localStream,
        remoteStream: null,
        isMuted: false,
        isCameraEnabled: true,
        startedAt: null,
      };

      incomingCallRef.current = null;
      activeCallRef.current = activeCall;
      setCallState({
        incomingCall: null,
        activeCall,
        error: "",
      });

      const expectsOffer = !incomingCall.offerSdp;

      await sendCallSignal({
        eventType: CALL_EVENT_TYPES.ACCEPT,
        roomId: activeCall.roomId,
        recipientId: activeCall.peerUserId,
        callId: activeCall.callId,
        callStatus: "accepted",
        payload: {
          expectsOffer,
        },
      });

      if (incomingCall.offerSdp) {
        const peerConnection = await ensurePeerConnection(activeCall);
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            type: "offer",
            sdp: incomingCall.offerSdp,
          })
        );
        await flushQueuedCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await sendCallSignal({
          eventType: CALL_EVENT_TYPES.ANSWER,
          roomId: activeCall.roomId,
          recipientId: activeCall.peerUserId,
          callId: activeCall.callId,
          sdp: answer.sdp,
          callStatus: "connecting",
        });
        signalReadyRef.current = true;
        await flushQueuedOutboundCandidates();
      }

      armConnectionTimeout(activeCall.callId, activeCall.peerName);

      return true;
    } catch (error) {
      cleanupActiveCall();
      report({
        title: "Could not join call",
        description: describeMediaAccessError(
          error,
          "camera and microphone"
        ),
        variant: "destructive",
      });
      return false;
    }
  }, [armConnectionTimeout, cleanupActiveCall, ensurePeerConnection, flushQueuedCandidates, flushQueuedOutboundCandidates, report, sendCallSignal]);

  const declineIncomingCall = useCallback(async () => {
    const incomingCall = incomingCallRef.current;
    if (!incomingCall) {
      return;
    }

    try {
      await sendCallSignal({
        eventType: CALL_EVENT_TYPES.DECLINE,
        roomId: incomingCall.roomId,
        recipientId: incomingCall.peerUserId,
        callId: incomingCall.callId,
        callStatus: "declined",
      });
    } catch {
      // Ignore signaling failures when declining a call.
    } finally {
      incomingCallRef.current = null;
      patchCallState({ incomingCall: null, error: "" });
    }
  }, [patchCallState, sendCallSignal]);

  const endCall = useCallback(async () => {
    const activeCall = activeCallRef.current;
    const incomingCall = incomingCallRef.current;
    const targetCall = activeCall || incomingCall;

    if (!targetCall) {
      cleanupActiveCall();
      return;
    }

    try {
      await sendCallSignal({
        eventType: CALL_EVENT_TYPES.END,
        roomId: targetCall.roomId,
        recipientId: targetCall.peerUserId,
        callId: targetCall.callId,
        callStatus: "ended",
      });
    } catch {
      // Ignore signaling failures during hangup.
    } finally {
      incomingCallRef.current = null;
      cleanupActiveCall();
    }
  }, [cleanupActiveCall, sendCallSignal]);

  const toggleMicrophone = useCallback(() => {
    const localStream = localStreamRef.current;
    if (!localStream) {
      return;
    }

    const nextMuted =
      localStream.getAudioTracks().every((track) => track.enabled === false) ===
      false;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    updateActiveCall((previousCall) =>
      previousCall
        ? {
            ...previousCall,
            isMuted: nextMuted,
          }
        : previousCall
    );
  }, [updateActiveCall]);

  const toggleCamera = useCallback(() => {
    const localStream = localStreamRef.current;
    if (!localStream) {
      return;
    }

    const nextCameraDisabled =
      localStream.getVideoTracks().every((track) => track.enabled === false) ===
      false;

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraDisabled;
    });

    updateActiveCall((previousCall) =>
      previousCall
        ? {
            ...previousCall,
            isCameraEnabled: !nextCameraDisabled,
          }
        : previousCall
    );
  }, [updateActiveCall]);

  const handleSignal = useCallback(
    async (payload) => {
      if (!isVideoCallEvent(payload?.eventType)) {
        return false;
      }

      const signal = resolveVideoSignalPayload(payload);

      if (signal.sender === userId) {
        return true;
      }

      if (signal.recipientId && String(signal.recipientId) !== String(userId)) {
        return true;
      }

      const eventType = String(signal.eventType || "").toUpperCase();
      const activeCall = activeCallRef.current;
      const incomingCall = incomingCallRef.current;

      try {
        switch (eventType) {
          case CALL_EVENT_TYPES.INVITE: {
            if (
              (activeCall &&
                activeCall.callId === signal.callId &&
                String(activeCall.peerUserId) === String(signal.sender)) ||
              (incomingCall &&
                incomingCall.callId === signal.callId &&
                String(incomingCall.peerUserId) === String(signal.sender))
            ) {
              return true;
            }

            if (activeCall || incomingCall) {
              try {
                await sendCallSignal({
                  eventType: CALL_EVENT_TYPES.BUSY,
                  roomId: signal.roomId,
                  recipientId: signal.sender,
                  callId: signal.callId,
                  callStatus: "busy",
                });
              } catch {
                // Ignore busy signaling failures.
              }
              return true;
            }

            const nextIncomingCall = {
              callId: signal.callId,
              roomId: String(signal.roomId),
              peerUserId: String(signal.sender),
              peerName:
                resolvePeerName?.(signal.sender, signal.roomId) || "Contact",
              roomName: resolveRoomName?.(signal.roomId) || "ConnectHub",
              callMediaType: signal.callMediaType || "VIDEO",
              phase: "incoming",
              offerSdp: signal.sdp || null,
            };

            updateIncomingCall(nextIncomingCall);
            report({
              title: "Incoming video call",
              description: `${nextIncomingCall.peerName} is calling you.`,
            });
            return true;
          }

          case CALL_EVENT_TYPES.ACCEPT: {
            if (!activeCall || activeCall.callId !== signal.callId) {
              return true;
            }

            updateActiveCall((previousCall) =>
              previousCall
                ? {
                    ...previousCall,
                    phase: "connecting",
                  }
                : previousCall
            );
            signalReadyRef.current = true;
            await flushQueuedOutboundCandidates();

            const peerConnection = peerConnectionRef.current;
            const expectsOffer = Boolean(signal.payload?.expectsOffer);
            if (peerConnection?.localDescription?.sdp && !expectsOffer) {
              return true;
            }

            const ensuredPeerConnection = await ensurePeerConnection({
              ...activeCall,
              peerUserId: signal.sender,
            });

            const existingOfferSdp =
              expectsOffer &&
              ensuredPeerConnection.localDescription?.type === "offer"
                ? ensuredPeerConnection.localDescription.sdp
                : "";

            let offerSdp = existingOfferSdp;
            if (!offerSdp) {
              const offer = await ensuredPeerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
              await ensuredPeerConnection.setLocalDescription(offer);
              offerSdp = offer.sdp || "";
            }

            updateActiveCall((previousCall) =>
              previousCall
                ? {
                    ...previousCall,
                    offerSdp,
                  }
                : previousCall
            );

            await sendCallSignal({
              eventType: CALL_EVENT_TYPES.OFFER,
              roomId: activeCall.roomId,
              recipientId: signal.sender,
              callId: activeCall.callId,
              sdp: offerSdp,
              callStatus: "connecting",
            });
            signalReadyRef.current = true;
            await flushQueuedOutboundCandidates();

            return true;
          }

          case CALL_EVENT_TYPES.OFFER: {
            if (!activeCall || activeCall.callId !== signal.callId) {
              return true;
            }

            const peerConnection = await ensurePeerConnection({
              ...activeCall,
              peerUserId: signal.sender,
            });

            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({
                type: "offer",
                sdp: signal.sdp,
              })
            );
            await flushQueuedCandidates();

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            updateActiveCall((previousCall) =>
              previousCall
                ? {
                    ...previousCall,
                    phase: "connecting",
                  }
                : previousCall
            );

            await sendCallSignal({
              eventType: CALL_EVENT_TYPES.ANSWER,
              roomId: activeCall.roomId,
              recipientId: signal.sender,
              callId: activeCall.callId,
              sdp: answer.sdp,
              callStatus: "connecting",
            });
            signalReadyRef.current = true;
            await flushQueuedOutboundCandidates();

            return true;
          }

          case CALL_EVENT_TYPES.ANSWER: {
            if (!activeCall || activeCall.callId !== signal.callId) {
              return true;
            }

            const peerConnection = peerConnectionRef.current;
            if (!peerConnection) {
              return true;
            }

            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({
                type: "answer",
                sdp: signal.sdp,
              })
            );
            await flushQueuedCandidates();

            updateActiveCall((previousCall) =>
              previousCall
                ? {
                    ...previousCall,
                    phase: "connecting",
                  }
                : previousCall
            );

            return true;
          }

          case CALL_EVENT_TYPES.ICE_CANDIDATE: {
            if (
              (activeCall && activeCall.callId === signal.callId) ||
              (incomingCall && incomingCall.callId === signal.callId)
            ) {
              await addOrQueueIceCandidate(signal);
            }
            return true;
          }

          case CALL_EVENT_TYPES.CAPTION: {
            if (!activeCall || activeCall.callId !== signal.callId) {
              return true;
            }

            handleRemoteCaptionPayload(signal.payload || {});
            return true;
          }

          case CALL_EVENT_TYPES.GESTURE: {
            if (!activeCall || activeCall.callId !== signal.callId) {
              return true;
            }

            const nextGesturePayload = signal.payload || {};
            setRemoteGesture({
              gesture: nextGesturePayload.gesture || "",
              messageText: nextGesturePayload.messageText || "",
              emoji: nextGesturePayload.emoji || "",
              confidence: Number(nextGesturePayload.confidence || 0),
              hint: nextGesturePayload.hint || "",
              updatedAt: Date.now(),
            });
            scheduleRemoteGestureClear();
            return true;
          }

          case CALL_EVENT_TYPES.DECLINE:
          case CALL_EVENT_TYPES.BUSY: {
            if (!activeCall || activeCall.callId !== signal.callId) {
              return true;
            }

            report({
              title:
                eventType === CALL_EVENT_TYPES.BUSY
                  ? "Contact is busy"
                  : "Call declined",
              description:
                eventType === CALL_EVENT_TYPES.BUSY
                  ? `${activeCall.peerName} is already in another call.`
                  : `${activeCall.peerName} declined the video call.`,
              variant: "destructive",
            });
            cleanupActiveCall();
            return true;
          }

          case CALL_EVENT_TYPES.END: {
            if (activeCall && activeCall.callId === signal.callId) {
              report({
                title: "Call ended",
                description: `${activeCall.peerName} ended the video call.`,
              });
              cleanupActiveCall();
              return true;
            }

            if (incomingCall && incomingCall.callId === signal.callId) {
              updateIncomingCall(null);
              report({
                title: "Missed call",
                description: `${incomingCall.peerName} canceled the incoming call.`,
              });
            }
            return true;
          }

          default:
            return true;
        }
      } catch (error) {
        report({
          title: "Video call signaling failed",
          description:
            error instanceof Error
              ? error.message
              : "The call could not be completed. Please try again.",
          variant: "destructive",
        });
        cleanupActiveCall();
        return true;
      }
    },
    [
      addOrQueueIceCandidate,
      cleanupActiveCall,
      ensurePeerConnection,
      flushQueuedCandidates,
      handleRemoteCaptionPayload,
      report,
      resolvePeerName,
      resolveRoomName,
      scheduleRemoteGestureClear,
      sendCallSignal,
      updateActiveCall,
      updateIncomingCall,
      userId,
    ]
  );

  useEffect(
    () => {
      cleanupActiveCallRef.current = cleanupActiveCall;
    },
    [cleanupActiveCall]
  );

  useEffect(
    () => () => {
      cleanupActiveCallRef.current?.();
      if (gestureDetectorRef.current?.close) {
        gestureDetectorRef.current.close();
      }
      gestureDetectorRef.current = null;
    },
    []
  );

  return {
    ...callState,
    hasOngoingCall: Boolean(callState.activeCall || callState.incomingCall),
    captionsEnabled,
    gestureModeEnabled,
    captionTargetLanguage,
    speechInputLanguage,
    captionLanguages: SUPPORTED_TRANSLATION_LANGUAGES,
    captionsSupported,
    captionCaptureMode,
    speechRecognitionSupported,
    localCaption,
    remoteCaption,
    remoteGesture,
    gestureState,
    isVideoCallEvent,
    startVideoCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    handleSignal,
    toggleMicrophone,
    toggleCamera,
    toggleCaptions,
    toggleGestureMode,
    setCaptionTargetLanguage: handleCaptionTargetLanguageChange,
    setSpeechInputLanguage: handleSpeechInputLanguageChange,
  };
}
