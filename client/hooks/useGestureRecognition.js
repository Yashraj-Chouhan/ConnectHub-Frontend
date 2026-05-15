import { useEffect, useRef, useState } from "react";
import {
  createGestureDetector,
  createMotionState,
  detectGesture,
  speakGestureMessage,
  stopGestureSpeech,
} from "@/services/gestureService";

const INITIAL_STATE = {
  ready: false,
  status: "disabled",
  gesture: null,
  confidence: 0,
  message: "Gesture mode is disabled",
  messageText: "",
  emoji: "",
  gestureType: "",
  hint: "",
  error: "",
  lastSentAt: 0,
  lastSentMessage: "",
};

function mergeState(previousState, patch) {
  let changed = false;
  const nextState = { ...previousState };

  Object.entries(patch).forEach(([key, value]) => {
    if (previousState[key] !== value) {
      changed = true;
      nextState[key] = value;
    }
  });

  return changed ? nextState : previousState;
}

export function useGestureRecognition({
  enabled,
  webcamRef,
  onGesture,
  sendLocked = false,
  speakEnabled = false,
  detectIntervalMs = 120,
  cooldownMs = 2500,
  minConfidence = 0.78,
  requiredStableFrames = 3,
}) {
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(0);
  const lastProcessedAtRef = useRef(0);
  const stableGestureRef = useRef({ gesture: null, frames: 0 });
  const lockedGestureRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const motionStateRef = useRef(createMotionState());
  const sendingRef = useRef(false);
  const onGestureRef = useRef(onGesture);
  const speakEnabledRef = useRef(speakEnabled);
  const sendLockedRef = useRef(sendLocked);
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  useEffect(() => {
    speakEnabledRef.current = speakEnabled;
  }, [speakEnabled]);

  useEffect(() => {
    sendLockedRef.current = sendLocked;
  }, [sendLocked]);

  useEffect(() => {
    let cancelled = false;

    const stopLoop = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    };

    const patchState = (patch) => {
      if (cancelled) {
        return;
      }

      setState((previousState) => mergeState(previousState, patch));
    };

    if (!enabled) {
      stopLoop();
      stableGestureRef.current = { gesture: null, frames: 0 };
      lockedGestureRef.current = null;
      motionStateRef.current = createMotionState();
      stopGestureSpeech();
      patchState(INITIAL_STATE);
      return () => {
        cancelled = true;
      };
    }

    const runDetection = () => {
      if (cancelled) {
        return;
      }

      const videoElement = webcamRef.current?.video;

      if (!videoElement || videoElement.readyState < 2 || !videoElement.videoWidth) {
        patchState({
          ready: true,
          status: "camera",
          gesture: null,
          confidence: 0,
          message: "Waiting for webcam stream",
          messageText: "",
          emoji: "",
          gestureType: "",
          hint: "",
          error: "",
        });
        animationFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const now = performance.now();
      if (now - lastProcessedAtRef.current < detectIntervalMs) {
        animationFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      lastProcessedAtRef.current = now;

      const result = detectorRef.current.detectForVideo(videoElement, now);
      const prediction = detectGesture(result, motionStateRef.current, now);

      patchState({
        ready: true,
        status: prediction.status.toLowerCase(),
        gesture: prediction.gesture,
        confidence: prediction.confidence,
        message: prediction.message,
        messageText: prediction.messageText,
        emoji: prediction.emoji,
        gestureType: prediction.gestureType,
        hint: prediction.hint,
        error: "",
      });

      if (prediction.status !== "DETECTED" || !prediction.gesture) {
        stableGestureRef.current = { gesture: null, frames: 0 };
        if (prediction.status === "NO_HAND" || prediction.status === "UNRECOGNIZED") {
          lockedGestureRef.current = null;
        }
        animationFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      if (stableGestureRef.current.gesture === prediction.gesture) {
        stableGestureRef.current.frames += 1;
      } else {
        stableGestureRef.current = { gesture: prediction.gesture, frames: 1 };
      }

      const isStable = stableGestureRef.current.frames >= requiredStableFrames;
      const cooldownElapsed = now - lastSentAtRef.current >= cooldownMs;
      const isLockedGesture = lockedGestureRef.current === prediction.gesture;

      if (
        prediction.confidence >= minConfidence &&
        isStable &&
        cooldownElapsed &&
        !isLockedGesture &&
        !sendLockedRef.current &&
        !sendingRef.current
      ) {
        sendingRef.current = true;

        Promise.resolve(onGestureRef.current?.(prediction))
          .then((resultValue) => {
            if (resultValue === false) {
              patchState({
                error: "Gesture message could not be sent",
              });
              return;
            }

            lockedGestureRef.current = prediction.gesture;
            lastSentAtRef.current = performance.now();

            if (speakEnabledRef.current) {
              speakGestureMessage(prediction.messageText);
            }

            patchState({
              lastSentAt: Date.now(),
              lastSentMessage: prediction.messageText,
            });
          })
          .catch((error) => {
            patchState({
              error:
                error instanceof Error
                  ? error.message
                  : "Gesture message could not be sent",
            });
          })
          .finally(() => {
            sendingRef.current = false;
          });
      }

      animationFrameRef.current = requestAnimationFrame(runDetection);
    };

    (async () => {
      try {
        patchState({
          ready: false,
          status: "loading",
          message: "Loading gesture model",
          error: "",
        });

        if (!detectorRef.current) {
          detectorRef.current = await createGestureDetector();
        }

        if (!cancelled) {
          animationFrameRef.current = requestAnimationFrame(runDetection);
        }
      } catch (error) {
        patchState({
          ready: false,
          status: "error",
          message: "Gesture mode could not start",
          error:
            error instanceof Error ? error.message : "Gesture detector failed to load",
        });
      }
    })();

    return () => {
      cancelled = true;
      stopLoop();
      stableGestureRef.current = { gesture: null, frames: 0 };
      motionStateRef.current = createMotionState();
    };
  }, [
    cooldownMs,
    detectIntervalMs,
    enabled,
    minConfidence,
    requiredStableFrames,
    webcamRef,
  ]);

  useEffect(
    () => () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      detectorRef.current?.close?.();
      stopGestureSpeech();
    },
    []
  );

  return state;
}
