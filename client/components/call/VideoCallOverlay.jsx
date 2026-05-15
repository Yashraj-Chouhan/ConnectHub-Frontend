import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Captions,
  Hand,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Settings2,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { GESTURE_DEFINITIONS } from "@/services/gestureService";

function attachStream(mediaElement, stream) {
  if (!mediaElement) {
    return;
  }

  if (mediaElement.srcObject !== stream) {
    mediaElement.srcObject = stream || null;
  }

  if (!stream) {
    mediaElement.onloadedmetadata = null;
    return;
  }

  const tryPlay = () => {
    mediaElement.play?.().catch(() => {
      // Some mobile browsers defer autoplay until enough media data arrives.
    });
  };

  if (mediaElement.readyState >= 1) {
    tryPlay();
  } else {
    mediaElement.onloadedmetadata = () => {
      tryPlay();
    };
  }
}

function formatDuration(startedAt) {
  if (!startedAt) {
    return "00:00";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - startedAt) / 1000)
  );
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useCallDuration(startedAt) {
  const [duration, setDuration] = useState(() => formatDuration(startedAt));

  useEffect(() => {
    setDuration(formatDuration(startedAt));

    if (!startedAt) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setDuration(formatDuration(startedAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  return duration;
}

function getPhaseLabel(activeCall) {
  if (!activeCall) {
    return "";
  }

  switch (activeCall.phase) {
    case "outgoing":
      return "Calling...";
    case "connecting":
      return "Connecting...";
    case "reconnecting":
      return "Reconnecting...";
    case "connected":
      return "Live";
    default:
      return "Preparing call";
  }
}

function resolveLanguageName(languages, code) {
  if (!code || code === "none") {
    return "Original";
  }

  return (
    languages?.find((language) => language.code === code)?.name ||
    String(code).toUpperCase()
  );
}

function captionPrimaryText(caption) {
  return caption?.translatedText || caption?.text || "";
}

function captionSecondaryText(caption) {
  if (!caption?.translatedText || !caption?.text) {
    return "";
  }

  return caption.translatedText !== caption.text ? caption.text : "";
}

function AssistToggle({
  active,
  disabled = false,
  icon,
  label,
  description,
  onClick,
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-3 py-2 text-left transition ${
        active
          ? "border-primary/40 bg-primary/15 text-white"
          : "border-white/10 bg-white/5 text-white/80"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-white/10"}`}
    >
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-1 text-[11px] text-white/60">{description}</p>
    </button>
  );
}

const IN_CALL_GESTURES = Object.values(GESTURE_DEFINITIONS);

function resolveCaptionLanguageDetail(captionLanguages, caption, fallbackLabel = "") {
  if (!caption?.text && !fallbackLabel) {
    return "";
  }

  if (fallbackLabel) {
    return fallbackLabel;
  }

  const sourceLanguage = resolveLanguageName(
    captionLanguages,
    caption?.sourceLanguage || "auto"
  );
  const targetLanguage = resolveLanguageName(
    captionLanguages,
    caption?.targetLanguage || "none"
  );
  const isTranslated =
    caption?.targetLanguage &&
    caption.targetLanguage !== "none" &&
    caption?.translatedText &&
    caption.translatedText !== caption.text;

  return isTranslated ? `${sourceLanguage} to ${targetLanguage}` : sourceLanguage;
}

function CaptionCard({ title, status, detail, primary, secondary }) {
  if (!primary) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          {title}
        </p>
        {status ? (
          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
            {status}
          </span>
        ) : null}
      </div>
      {detail ? (
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">
          {detail}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-medium leading-6 text-white">{primary}</p>
      {secondary ? (
        <p className="mt-2 text-xs leading-5 text-white/55">{secondary}</p>
      ) : null}
    </div>
  );
}

function QuickActionPill({
  active,
  disabled = false,
  icon,
  label,
  onClick,
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-primary/40 bg-primary/15 text-white"
          : "border-white/10 bg-black/35 text-white/85"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-white/10"}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </button>
  );
}

function AssistPanelContent({
  isDesktop,
  activeCall,
  captionsEnabled,
  gestureModeEnabled,
  localCaption,
  remoteCaption,
  gestureState,
  captionLanguages,
  captionTargetLanguage,
  speechInputLanguage,
  captionsSupported,
  captionCaptureMode,
  remotePrimaryCaption,
  remoteSecondaryCaption,
  localPrimaryCaption,
  remoteCaptionStatus,
  localCaptionStatus,
  translationLabel,
  speechInputLabel,
  liveCaptionDescription,
  onToggleCaptions,
  onToggleGestures,
  onCaptionTargetLanguageChange,
  onSpeechInputLanguageChange,
}) {
  const toolGridClass = isDesktop ? "grid-cols-1" : "md:grid-cols-2";

  return (
    <div className="flex flex-col gap-2.5">
      <div className={`grid gap-2 ${toolGridClass}`}>
        <AssistToggle
          active={captionsEnabled}
          disabled={!captionsSupported}
          icon={Captions}
          label={
            captionsSupported
              ? captionsEnabled
                ? "Live captions on"
                : "Live captions off"
              : "Live captions unavailable"
          }
          description={liveCaptionDescription}
          onClick={onToggleCaptions}
        />
        <AssistToggle
          active={gestureModeEnabled}
          icon={Hand}
          label={gestureModeEnabled ? "Gesture mode on" : "Gesture mode off"}
          description={
            gestureModeEnabled
              ? gestureState?.message || "Watching your self-view for mapped signs"
              : "Share quick signs like Yes, Hello, Stop, One moment, Peace, Call me, I love you, and Bye"
          }
          onClick={onToggleGestures}
        />
      </div>

      <div className={`grid gap-2 ${toolGridClass}`}>
        <label className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
          <span className="block text-[11px] uppercase tracking-[0.2em] text-white/55">
            Translate remote captions to
          </span>
          <select
            value={captionTargetLanguage}
            onChange={(event) =>
              onCaptionTargetLanguageChange?.(event.target.value)
            }
            className="mt-2 w-full bg-transparent text-sm font-medium text-white outline-none"
          >
            <option value="none" className="text-black">
              Original text
            </option>
            {(captionLanguages || []).map((language) => (
              <option
                key={language.code}
                value={language.code}
                className="text-black"
              >
                {language.name}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
          <span className="block text-[11px] uppercase tracking-[0.2em] text-white/55">
            Speech input language
          </span>
          <select
            value={speechInputLanguage}
            onChange={(event) =>
              onSpeechInputLanguageChange?.(event.target.value)
            }
            disabled={!captionsSupported}
            className="mt-2 w-full bg-transparent text-sm font-medium text-white outline-none disabled:opacity-60"
          >
            {(captionLanguages || []).map((language) => (
              <option
                key={language.code}
                value={language.code}
                className="text-black"
              >
                {language.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(remotePrimaryCaption || localPrimaryCaption) ? (
        <div className={`grid gap-2 ${toolGridClass}`}>
          <CaptionCard
            title={`${activeCall.peerName} says`}
            status={remoteCaptionStatus}
            detail={resolveCaptionLanguageDetail(captionLanguages, remoteCaption)}
            primary={remotePrimaryCaption}
            secondary={remoteSecondaryCaption}
          />
          <CaptionCard
            title="You say"
            status={localCaptionStatus}
            detail={`Speech input: ${speechInputLabel}`}
            primary={localPrimaryCaption}
            secondary=""
          />
        </div>
      ) : null}

      <div className={`grid gap-2 ${toolGridClass}`}>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">
            Caption translation
          </p>
          <p className="mt-2">
            {captionsEnabled
              ? `Remote speech is shown as ${translationLabel} captions while your speech input is set to ${speechInputLabel}.`
              : "Turn on live captions to show translated subtitles during the call."}
          </p>
        </div>
      </div>

      {remoteCaption?.error ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          Showing the latest original caption because translation is temporarily unavailable.
        </div>
      ) : null}

      {captionCaptureMode === "transcription" && captionsSupported ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
          Mobile browsers may use short audio chunks for captions, so translated text can land in quick bursts instead of word by word.
        </div>
      ) : null}

      {gestureModeEnabled ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Gesture status
              </p>
              <p className="mt-2 text-sm font-medium">
                {gestureState?.message || "Waiting for a mapped gesture"}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-white/75">
              {Math.round((gestureState?.confidence || 0) * 100)}%
            </span>
          </div>
          {gestureState?.hint ? (
            <p className="mt-2 text-xs text-white/60">{gestureState.hint}</p>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {IN_CALL_GESTURES.map((gesture) => (
              <div
                key={gesture.id}
                className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white/75"
              >
                <p className="font-medium text-white">
                  {gesture.emoji} {gesture.label}
                </p>
                <p className="mt-1 text-white/55">{gesture.messageText}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactCaptionStrip({
  peerName,
  remotePrimaryCaption,
  remoteSecondaryCaption,
  localPrimaryCaption,
  remoteCaptionStatus,
  localCaptionStatus,
}) {
  const text = remotePrimaryCaption || localPrimaryCaption;
  if (!text) {
    return null;
  }

  const title = remotePrimaryCaption ? `${peerName} says` : "You say";
  const status = remotePrimaryCaption ? remoteCaptionStatus : localCaptionStatus;
  const secondaryText = remotePrimaryCaption ? remoteSecondaryCaption : "";

  return (
    <div className="absolute inset-x-3 bottom-24 z-20 lg:bottom-6 lg:right-6 lg:left-6">
      <div className="rounded-2xl border border-white/10 bg-black/58 px-3 py-2 text-white shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
            <Captions className="h-3.5 w-3.5" />
            <span>{title}</span>
          </div>
          {status ? (
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
              {status}
            </span>
          ) : null}
        </div>
        <p className="mt-1 max-h-12 overflow-hidden text-sm leading-5">{text}</p>
        {secondaryText ? (
          <p className="mt-1 max-h-8 overflow-hidden text-xs leading-4 text-white/60">
            {secondaryText}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const VideoCallOverlay = ({
  activeCall,
  incomingCall,
  captionsEnabled,
  gestureModeEnabled,
  localCaption,
  remoteCaption,
  remoteGesture,
  gestureState,
  captionLanguages,
  captionTargetLanguage,
  speechInputLanguage,
  captionsSupported,
  captionCaptureMode,
  onAccept,
  onDecline,
  onEnd,
  onToggleMicrophone,
  onToggleCamera,
  onToggleCaptions,
  onToggleGestures,
  onCaptionTargetLanguageChange,
  onSpeechInputLanguageChange,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteBackdropVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [remoteVideoFitMode, setRemoteVideoFitMode] = useState("cover");
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024
  );
  const [isAssistPanelOpen, setIsAssistPanelOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024
  );
  const duration = useCallDuration(activeCall?.startedAt);

  useEffect(() => {
    attachStream(localVideoRef.current, activeCall?.localStream || null);
  }, [activeCall?.localStream]);

  useEffect(() => {
    attachStream(remoteVideoRef.current, activeCall?.remoteStream || null);
  }, [activeCall?.remoteStream]);

  useEffect(() => {
    attachStream(
      remoteBackdropVideoRef.current,
      activeCall?.remoteStream || null
    );
  }, [activeCall?.remoteStream]);

  useEffect(() => {
    attachStream(remoteAudioRef.current, activeCall?.remoteStream || null);
  }, [activeCall?.remoteStream]);

  useEffect(() => {
    const syncViewportMode = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktopViewport(desktop);
      setIsAssistPanelOpen(desktop);
    };

    if (typeof window === "undefined") {
      return undefined;
    }

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    const remoteVideoElement = remoteVideoRef.current;
    if (!remoteVideoElement) {
      setRemoteVideoFitMode("cover");
      return undefined;
    }

    const updatePresentation = () => {
      if (!remoteVideoElement.videoWidth || !remoteVideoElement.videoHeight) {
        return;
      }

      const aspectRatio =
        remoteVideoElement.videoWidth / remoteVideoElement.videoHeight;
      setRemoteVideoFitMode(aspectRatio < 0.9 ? "contain" : "cover");
    };

    updatePresentation();
    remoteVideoElement.addEventListener("loadedmetadata", updatePresentation);
    remoteVideoElement.addEventListener("resize", updatePresentation);

    return () => {
      remoteVideoElement.removeEventListener(
        "loadedmetadata",
        updatePresentation
      );
      remoteVideoElement.removeEventListener("resize", updatePresentation);
    };
  }, [activeCall?.remoteStream]);

  const phaseLabel = useMemo(() => getPhaseLabel(activeCall), [activeCall]);
  const translationLabel = useMemo(
    () => resolveLanguageName(captionLanguages, captionTargetLanguage),
    [captionLanguages, captionTargetLanguage]
  );
  const speechInputLabel = useMemo(
    () => resolveLanguageName(captionLanguages, speechInputLanguage),
    [captionLanguages, speechInputLanguage]
  );
  const remotePrimaryCaption = captionPrimaryText(remoteCaption);
  const remoteSecondaryCaption = captionSecondaryText(remoteCaption);
  const localPrimaryCaption = captionPrimaryText(localCaption);
  const remoteVideoTracks =
    activeCall?.remoteStream?.getVideoTracks?.().filter(
      (track) => track.readyState === "live" && track.enabled !== false
    ) || [];
  const remoteAudioTracks =
    activeCall?.remoteStream?.getAudioTracks?.().filter(
      (track) => track.readyState === "live" && track.enabled !== false
    ) || [];
  const hasRemoteVideo = remoteVideoTracks.length > 0;
  const hasRemoteAudioOnly = !hasRemoteVideo && remoteAudioTracks.length > 0;
  const liveCaptionDescription = !captionsSupported
    ? "This browser does not support live speech or audio transcription for captions."
    : captionsEnabled
      ? captionCaptureMode === "transcription"
        ? `Capturing short audio snippets in ${speechInputLabel} and translating to ${translationLabel}`
        : `Listening in ${speechInputLabel} and translating to ${translationLabel}`
      : captionCaptureMode === "transcription"
        ? "Turn on chunked audio transcription and translation for this call"
        : "Start real-time speech recognition and translation in this call";
  const remoteCaptionStatus =
    captionTargetLanguage === "none"
      ? remoteCaption?.isFinal
        ? "original"
        : "live"
      : remoteCaption?.error
        ? "original"
        : remoteCaption?.translationPending
          ? "translating"
          : remoteCaption?.isFinal
            ? "translated"
            : "live";
  const localCaptionStatus =
    captionCaptureMode === "transcription"
      ? "chunked live"
      : localCaption?.isFinal
        ? "final"
        : "listening";
  const hasVisibleCaption = Boolean(remotePrimaryCaption || localPrimaryCaption);

  return (
    <AnimatePresence>
      {(activeCall || incomingCall) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md"
        >
          {incomingCall && !activeCall ? (
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ y: 24, scale: 0.96 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 24, scale: 0.96 }}
                className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0f1629]/95 p-5 text-white shadow-2xl"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-primary/80">
                  Incoming video call
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  {incomingCall.peerName}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  {incomingCall.roomName}
                </p>

                <div className="mt-6 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={onDecline}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={onAccept}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                  >
                    <Video className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            </div>
          ) : null}

          {activeCall ? (
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="flex h-full flex-col p-0 lg:p-4"
            >
              <div className="relative flex h-full min-h-0 flex-col overflow-hidden border-white/10 bg-[#070c16] lg:flex-row lg:rounded-[2rem] lg:border">
                <audio
                  ref={remoteAudioRef}
                  autoPlay
                  playsInline
                  className="hidden"
                />

                <div className="relative min-h-0 flex-1 bg-black">
                  <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent p-4 text-white">
                    <div>
                      <p className="text-lg font-semibold">{activeCall.peerName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/75">
                        <span>{phaseLabel}</span>
                        {activeCall.phase === "connected" ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/15 px-2 py-0.5 text-emerald-100">
                            {duration}
                          </span>
                        ) : null}
                        {captionsEnabled ? (
                          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-white/70">
                            Translate to {translationLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!isDesktopViewport ? (
                        <button
                          type="button"
                          onClick={() => setIsAssistPanelOpen((previous) => !previous)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          {isAssistPanelOpen ? "Hide tools" : "Tools"}
                        </button>
                      ) : null}
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {activeCall.roomName}
                      </span>
                    </div>
                  </div>

                  <div className="absolute left-3 top-24 z-20 flex max-w-[calc(100%-7rem)] flex-wrap items-center gap-2 lg:left-5 lg:top-24 lg:max-w-[50%]">
                    <QuickActionPill
                      active={captionsEnabled}
                      disabled={!captionsSupported}
                      icon={Captions}
                      label={captionsEnabled ? "Captions on" : "Captions off"}
                      onClick={onToggleCaptions}
                    />
                    <QuickActionPill
                      active={gestureModeEnabled}
                      icon={Hand}
                      label={gestureModeEnabled ? "Gestures on" : "Gestures off"}
                      onClick={onToggleGestures}
                    />
                  </div>

                  {remoteGesture ? (
                    <div className="pointer-events-none absolute left-1/2 top-20 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 lg:top-24">
                      <div className="rounded-2xl border border-primary/30 bg-[#0f1629]/90 px-4 py-3 text-center text-white shadow-2xl backdrop-blur-xl">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-primary/80">
                          Remote gesture
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {remoteGesture.messageText || "Gesture received"}
                        </p>
                        {remoteGesture.hint ? (
                          <p className="mt-1 text-xs text-white/60">
                            {remoteGesture.hint}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="relative h-full w-full bg-[#02060d]">
                    {hasRemoteVideo ? (
                      <div className="relative h-full w-full overflow-hidden">
                        {remoteVideoFitMode === "contain" ? (
                          <video
                            ref={remoteBackdropVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-3xl"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%),linear-gradient(180deg,rgba(6,10,18,0.18),rgba(6,10,18,0.45))]" />
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`relative z-10 h-full w-full ${
                            remoteVideoFitMode === "contain"
                              ? "object-contain"
                              : "object-cover"
                          }`}
                        />
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
                        {activeCall.phase === "connected" ? (
                          <Video className="mb-4 h-12 w-12 text-primary/80" />
                        ) : (
                          <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary/80" />
                        )}
                        <p className="text-xl font-semibold">{activeCall.peerName}</p>
                        <p className="mt-2 max-w-sm text-sm text-white/70">
                          {hasRemoteAudioOnly
                            ? "Audio is connected, but remote video is not available yet."
                            : activeCall.phase === "outgoing"
                              ? "Waiting for the other person to answer the video call."
                              : activeCall.phase === "connecting"
                                ? "Negotiating a secure peer connection."
                                : "Trying to restore the video connection."}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="absolute right-3 top-20 z-20 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/60 shadow-xl lg:right-5 lg:top-24">
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75">
                      <span>You</span>
                      {activeCall.isCameraEnabled ? null : (
                        <VideoOff className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-28 w-20 object-cover sm:h-40 sm:w-28"
                    />
                    {!activeCall.isCameraEnabled ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                        <VideoOff className="h-5 w-5" />
                      </div>
                    ) : null}
                  </div>

                  {hasVisibleCaption ? (
                    <CompactCaptionStrip
                      peerName={activeCall.peerName}
                      remotePrimaryCaption={remotePrimaryCaption}
                      remoteSecondaryCaption={remoteSecondaryCaption}
                      localPrimaryCaption={localPrimaryCaption}
                      remoteCaptionStatus={remoteCaptionStatus}
                      localCaptionStatus={localCaptionStatus}
                      translationLabel={translationLabel}
                      speechInputLabel={speechInputLabel}
                    />
                  ) : null}

                  {!isDesktopViewport && isAssistPanelOpen ? (
                    <div className="absolute inset-x-0 bottom-24 z-20 px-3">
                      <div className="rounded-[1.5rem] border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-white/10 px-3 py-3 text-white">
                          <div>
                            <p className="text-sm font-semibold">Call tools</p>
                            <p className="text-xs text-white/60">
                              Captions, translation, and gesture controls
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAssistPanelOpen(false)}
                            className="rounded-full border border-white/10 bg-white/10 p-2 text-white/80"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="max-h-[38vh] overflow-y-auto p-3">
                          <AssistPanelContent
                            isDesktop={false}
                            activeCall={activeCall}
                            captionsEnabled={captionsEnabled}
                            gestureModeEnabled={gestureModeEnabled}
                            localCaption={localCaption}
                            remoteCaption={remoteCaption}
                            gestureState={gestureState}
                            captionLanguages={captionLanguages}
                            captionTargetLanguage={captionTargetLanguage}
                            speechInputLanguage={speechInputLanguage}
                            captionsSupported={captionsSupported}
                            captionCaptureMode={captionCaptureMode}
                            remotePrimaryCaption={remotePrimaryCaption}
                            remoteSecondaryCaption={remoteSecondaryCaption}
                            localPrimaryCaption={localPrimaryCaption}
                            remoteCaptionStatus={remoteCaptionStatus}
                            localCaptionStatus={localCaptionStatus}
                            translationLabel={translationLabel}
                            speechInputLabel={speechInputLabel}
                            liveCaptionDescription={liveCaptionDescription}
                            onToggleCaptions={onToggleCaptions}
                            onToggleGestures={onToggleGestures}
                            onCaptionTargetLanguageChange={
                              onCaptionTargetLanguageChange
                            }
                            onSpeechInputLanguageChange={
                              onSpeechInputLanguageChange
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-10">
                    <button
                      type="button"
                      onClick={onToggleMicrophone}
                      className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
                        activeCall.isMuted
                          ? "border-amber-400/30 bg-amber-400/15 text-amber-100"
                          : "border-white/10 bg-white/10 text-white"
                      }`}
                    >
                      {activeCall.isMuted ? (
                        <MicOff className="h-5 w-5" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={onToggleCamera}
                      className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
                        activeCall.isCameraEnabled
                          ? "border-white/10 bg-white/10 text-white"
                          : "border-amber-400/30 bg-amber-400/15 text-amber-100"
                      }`}
                    >
                      {activeCall.isCameraEnabled ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <VideoOff className="h-5 w-5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={onEnd}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                    >
                      <PhoneOff className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <aside className="hidden w-[24rem] flex-col border-l border-white/10 bg-[#0b101b]/92 text-white backdrop-blur-xl lg:flex">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold">Call tools</p>
                      <p className="text-xs text-white/60">
                        Captions, translation, and gesture controls
                      </p>
                    </div>
                    <Settings2 className="h-4 w-4 text-white/70" />
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <AssistPanelContent
                      isDesktop
                      activeCall={activeCall}
                      captionsEnabled={captionsEnabled}
                      gestureModeEnabled={gestureModeEnabled}
                      localCaption={localCaption}
                      remoteCaption={remoteCaption}
                      gestureState={gestureState}
                      captionLanguages={captionLanguages}
                      captionTargetLanguage={captionTargetLanguage}
                      speechInputLanguage={speechInputLanguage}
                      captionsSupported={captionsSupported}
                      captionCaptureMode={captionCaptureMode}
                      remotePrimaryCaption={remotePrimaryCaption}
                      remoteSecondaryCaption={remoteSecondaryCaption}
                      localPrimaryCaption={localPrimaryCaption}
                      remoteCaptionStatus={remoteCaptionStatus}
                      localCaptionStatus={localCaptionStatus}
                      translationLabel={translationLabel}
                      speechInputLabel={speechInputLabel}
                      liveCaptionDescription={liveCaptionDescription}
                      onToggleCaptions={onToggleCaptions}
                      onToggleGestures={onToggleGestures}
                      onCaptionTargetLanguageChange={
                        onCaptionTargetLanguageChange
                      }
                      onSpeechInputLanguageChange={
                        onSpeechInputLanguageChange
                      }
                    />
                  </div>
                </aside>
              </div>
            </motion.div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
