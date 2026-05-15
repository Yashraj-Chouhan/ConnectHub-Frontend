import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import {
  CameraOff,
  Hand,
  Loader2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useGestureRecognition } from "@/hooks/useGestureRecognition";
import { GESTURE_DEFINITIONS, stopGestureSpeech } from "@/services/gestureService";
import {
  describeMediaAccessError,
  getMediaDevicesSupportMessage,
  supportsMediaDevices,
} from "@/services/videoCallService";

const VIDEO_CONSTRAINTS = {
  facingMode: "user",
  width: { ideal: 640 },
  height: { ideal: 480 },
};

function stopWebcamStream(webcamRef) {
  const stream =
    webcamRef.current?.stream ?? webcamRef.current?.video?.srcObject ?? null;

  if (stream?.getTracks) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export const GestureRecognition = ({ onSendMessage, disabled = false, onClose }) => {
  const webcamRef = useRef(null);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const speechSupported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  const handleGesture = useCallback(
    async (prediction) => onSendMessage?.(prediction.messageText, [], "none"),
    [onSendMessage]
  );

  const detection = useGestureRecognition({
    enabled: !cameraError,
    webcamRef,
    onGesture: handleGesture,
    sendLocked: disabled,
    speakEnabled: speechEnabled && speechSupported,
    cooldownMs: 2500,
    minConfidence: 0.78,
    detectIntervalMs: 120,
    requiredStableFrames: 3,
  });

  const activeGestureLabel = useMemo(() => {
    if (!detection.gesture) {
      return "Waiting for gesture";
    }

    const definition = GESTURE_DEFINITIONS[detection.gesture];
    return definition
      ? `${definition.emoji} ${definition.messageText}`
      : detection.gesture;
  }, [detection.gesture]);

  const needsSecureOrigin = cameraError.includes("HTTPS or localhost");

  useEffect(
    () => () => {
      stopWebcamStream(webcamRef);
      stopGestureSpeech();
    },
    []
  );

  return (
    <div className="flex flex-col w-full h-[420px]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 bg-white/5">
        <div className="flex items-center gap-2 text-white">
          <Hand className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Gesture Mode</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (speechSupported) setSpeechEnabled((prev) => !prev);
            }}
            disabled={!speechSupported}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              speechSupported
                ? "text-gray-400 hover:bg-white/10 hover:text-white"
                : "cursor-not-allowed text-gray-600"
            }`}
            title={speechSupported ? (speechEnabled ? "Disable speech" : "Enable speech") : "Speech not supported"}
          >
            {speechEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 bg-black/60 overflow-hidden">
        {!cameraError ? (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              mirrored
              screenshotFormat="image/jpeg"
              videoConstraints={VIDEO_CONSTRAINTS}
              onUserMedia={() => setCameraError("")}
              onUserMediaError={(error) => {
                stopWebcamStream(webcamRef);
                setCameraError(
                  !supportsMediaDevices()
                    ? getMediaDevicesSupportMessage("camera")
                    : describeMediaAccessError(error, "camera")
                );
              }}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-2">
              <div className="flex justify-between items-start">
                <span className="rounded bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white/90 border border-white/10">
                  {detection.status === "loading" ? (
                    <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin"/> Loading AI</span>
                  ) : detection.status === "detected" ? (
                    <span className="text-emerald-400">Detected</span>
                  ) : (
                    "Ready"
                  )}
                </span>
                {disabled && (
                  <span className="rounded bg-rose-500/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white">
                    Paused
                  </span>
                )}
              </div>
              <div className="bg-black/60 backdrop-blur-md rounded-lg p-2 border border-white/10 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">
                  Output
                </p>
                <p className="text-sm font-semibold text-white truncate">
                  {activeGestureLabel}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center text-rose-200">
            <CameraOff className="mb-2 h-8 w-8 opacity-80" />
            <p className="text-xs font-medium">{cameraError}</p>
            <p className="mt-1 text-[10px] opacity-70">
              {needsSecureOrigin
                ? "Reopen this page over HTTPS or on localhost."
                : "Please allow camera access"}
            </p>
          </div>
        )}
      </div>


    </div>
  );
};
