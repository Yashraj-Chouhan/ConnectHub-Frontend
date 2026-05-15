import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const TASKS_VISION_VERSION = "0.10.35";
const WASM_BASE_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const FINGERS = [
  { mcp: 5, pip: 6, tip: 8 },
  { mcp: 9, pip: 10, tip: 12 },
  { mcp: 13, pip: 14, tip: 16 },
  { mcp: 17, pip: 18, tip: 20 },
];

export const GESTURE_DEFINITIONS = Object.freeze({
  THUMBS_UP: {
    id: "THUMBS_UP",
    emoji: "👍",
    label: "Thumbs Up",
    messageText: "Yes",
    gestureType: "static",
  },
  OPEN_PALM: {
    id: "OPEN_PALM",
    emoji: "✋",
    label: "Open Palm",
    messageText: "Hello",
    gestureType: "static",
  },
  FIST: {
    id: "FIST",
    emoji: "✊",
    label: "Fist",
    messageText: "Stop",
    gestureType: "static",
  },
  OK: {
    id: "OK",
    emoji: "👌",
    label: "OK Sign",
    messageText: "OK",
    gestureType: "static",
  },
  POINT_UP: {
    id: "POINT_UP",
    emoji: "\u261D\uFE0F",
    label: "Point Up",
    messageText: "One moment",
    gestureType: "static",
  },
  PEACE: {
    id: "PEACE",
    emoji: "\u270C\uFE0F",
    label: "Peace Sign",
    messageText: "Peace",
    gestureType: "static",
  },
  CALL_ME: {
    id: "CALL_ME",
    emoji: "\u{1F919}",
    label: "Call Me",
    messageText: "Call me",
    gestureType: "static",
  },
  I_LOVE_YOU: {
    id: "I_LOVE_YOU",
    emoji: "\u{1F91F}",
    label: "I Love You",
    messageText: "I love you",
    gestureType: "static",
  },
  WAVE: {
    id: "WAVE",
    emoji: "👋",
    label: "Wave",
    messageText: "Bye",
    gestureType: "dynamic",
  },
});

export async function createGestureDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
}

export function getGestureDefinition(gestureId) {
  return gestureId ? GESTURE_DEFINITIONS[gestureId] ?? null : null;
}

export function speakGestureMessage(messageText) {
  if (
    typeof window === "undefined" ||
    typeof window.speechSynthesis === "undefined" ||
    !messageText
  ) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(messageText);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

export function stopGestureSpeech() {
  if (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined"
  ) {
    window.speechSynthesis.cancel();
  }
}

export function createMotionState() {
  return {
    samples: [],
    openPalmHoldStartedAt: 0,
  };
}

export function resetMotionState(motionState) {
  motionState.samples = [];
  motionState.openPalmHoldStartedAt = 0;
}

function resetOpenPalmTracking(motionState) {
  motionState.samples = [];
  motionState.openPalmHoldStartedAt = 0;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function distance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function getPalmCenter(landmarks) {
  return {
    x: (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[17].x) / 4,
    y: (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[17].y) / 4,
  };
}

function getPalmScale(landmarks) {
  return Math.max(
    distance(landmarks[0], landmarks[9]),
    distance(landmarks[5], landmarks[17]),
    0.001
  );
}

function isFingerExtended(landmarks, finger) {
  return (
    landmarks[finger.tip].y < landmarks[finger.pip].y &&
    landmarks[finger.pip].y < landmarks[finger.mcp].y
  );
}

function isFingerCurled(landmarks, finger) {
  return landmarks[finger.tip].y > landmarks[finger.pip].y - 0.01;
}

function updateMotionSignal(motionState, landmarks, now) {
  const palmCenter = getPalmCenter(landmarks);
  const nextSamples = [
    ...motionState.samples,
    { x: palmCenter.x, y: palmCenter.y, at: now },
  ].filter(
    (sample) => now - sample.at < 950
  );

  motionState.samples = nextSamples;

  if (nextSamples.length < 3) {
    return {
      amplitudeX: 0,
      amplitudeY: 0,
      directionFlipsX: 0,
      totalTravel: 0,
    };
  }

  const xs = nextSamples.map((sample) => sample.x);
  const ys = nextSamples.map((sample) => sample.y);
  const amplitudeX = Math.max(...xs) - Math.min(...xs);
  const amplitudeY = Math.max(...ys) - Math.min(...ys);

  let directionFlipsX = 0;
  let previousDirection = 0;
  let totalTravel = 0;

  for (let index = 1; index < xs.length; index += 1) {
    const delta = xs[index] - xs[index - 1];
    const direction = Math.abs(delta) < 0.01 ? 0 : delta > 0 ? 1 : -1;
    totalTravel += Math.hypot(
      xs[index] - xs[index - 1],
      ys[index] - ys[index - 1]
    );

    if (direction && previousDirection && direction !== previousDirection) {
      directionFlipsX += 1;
    }

    if (direction) {
      previousDirection = direction;
    }
  }

  return {
    amplitudeX,
    amplitudeY,
    directionFlipsX,
    totalTravel,
  };
}

function buildPrediction(gestureId, confidence, message, hint) {
  const definition = getGestureDefinition(gestureId);

  return {
    status: "DETECTED",
    gesture: gestureId,
    confidence: clamp(confidence),
    message: message ?? definition?.label ?? "Gesture detected",
    messageText: definition?.messageText ?? "",
    emoji: definition?.emoji ?? "",
    gestureType: definition?.gestureType ?? "static",
    hint: hint ?? "",
  };
}

function buildTrackingState(message, hint = "") {
  return {
    status: "TRACKING",
    gesture: null,
    confidence: 0.45,
    message,
    messageText: "",
    emoji: "",
    gestureType: "dynamic",
    hint,
  };
}

export function detectGesture(result, motionState, now = performance.now()) {
  const landmarks = result?.landmarks?.[0];

  if (!landmarks) {
    resetMotionState(motionState);
    return {
      status: "NO_HAND",
      gesture: null,
      confidence: 0,
      message: "No hand detected",
      messageText: "",
      emoji: "",
      gestureType: "",
      hint: "",
    };
  }

  const palmCenter = getPalmCenter(landmarks);
  const palmScale = getPalmScale(landmarks);
  const fingerExtended = FINGERS.map((finger) => isFingerExtended(landmarks, finger));
  const fingerCurled = FINGERS.map((finger) => isFingerCurled(landmarks, finger));
  const extendedCount = fingerExtended.filter(Boolean).length;
  const curledCount = fingerCurled.filter(Boolean).length;
  const thumbTip = landmarks[4];
  const thumbJoint = landmarks[3];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const thumbDistanceFromPalm = distance(thumbTip, palmCenter) / palmScale;
  const averageFingerSpread =
    [8, 12, 16, 20].reduce(
      (total, landmarkIndex) => total + distance(landmarks[landmarkIndex], palmCenter),
      0
    ) /
    4 /
    palmScale;
  const pinchDistance = distance(thumbTip, indexTip) / palmScale;
  const indexMiddleSpread = distance(indexTip, middleTip) / palmScale;
  const thumbIsRaised =
    thumbTip.y < thumbJoint.y &&
    thumbTip.y < palmCenter.y &&
    thumbDistanceFromPalm > 0.8;
  const thumbIsExtended = thumbDistanceFromPalm > 0.82;
  const openPalm = extendedCount === 4 && thumbDistanceFromPalm > 0.8;

  if (
    pinchDistance < 0.35 &&
    fingerExtended[1] &&
    fingerExtended[2] &&
    fingerExtended[3]
  ) {
    const confidence =
      0.7 +
      clamp((0.35 - pinchDistance) / 0.2, 0, 1) * 0.15 +
      (fingerExtended.filter(Boolean).length / 4) * 0.1;

    resetOpenPalmTracking(motionState);
    return buildPrediction("OK", confidence, "OK sign detected");
  }

  if (thumbIsRaised && curledCount >= 3) {
    const confidence =
      0.68 +
      clamp(thumbDistanceFromPalm / 1.2, 0, 1) * 0.14 +
      clamp(curledCount / 4, 0, 1) * 0.12;

    resetOpenPalmTracking(motionState);
    return buildPrediction("THUMBS_UP", confidence, "Thumbs up detected");
  }

  if (
    fingerExtended[0] &&
    fingerCurled[1] &&
    fingerCurled[2] &&
    fingerCurled[3] &&
    !thumbIsRaised &&
    thumbDistanceFromPalm < 1.08
  ) {
    const confidence =
      0.68 +
      clamp((1.08 - thumbDistanceFromPalm) / 0.35, 0, 1) * 0.1 +
      clamp(curledCount / 4, 0, 1) * 0.12;

    resetOpenPalmTracking(motionState);
    return buildPrediction(
      "POINT_UP",
      confidence,
      "Point up gesture detected",
      "Keep only your index finger raised"
    );
  }

  if (
    fingerExtended[0] &&
    fingerExtended[1] &&
    fingerCurled[2] &&
    fingerCurled[3] &&
    pinchDistance > 0.38
  ) {
    const confidence =
      0.69 +
      clamp((indexMiddleSpread - 0.22) / 0.3, 0, 1) * 0.11 +
      clamp(curledCount / 4, 0, 1) * 0.08;

    resetOpenPalmTracking(motionState);
    return buildPrediction(
      "PEACE",
      confidence,
      "Peace sign detected",
      "Spread your index and middle fingers"
    );
  }

  if (
    thumbIsExtended &&
    fingerExtended[0] &&
    fingerCurled[1] &&
    fingerCurled[2] &&
    fingerExtended[3]
  ) {
    const confidence =
      0.71 +
      clamp(thumbDistanceFromPalm / 1.25, 0, 1) * 0.1 +
      clamp(extendedCount / 4, 0, 1) * 0.08;

    resetOpenPalmTracking(motionState);
    return buildPrediction(
      "I_LOVE_YOU",
      confidence,
      "I love you gesture detected",
      "Raise your thumb, index finger, and pinky"
    );
  }

  if (
    thumbIsExtended &&
    !fingerExtended[0] &&
    fingerCurled[1] &&
    fingerCurled[2] &&
    fingerExtended[3]
  ) {
    const confidence =
      0.7 +
      clamp(thumbDistanceFromPalm / 1.2, 0, 1) * 0.1 +
      clamp((curledCount + Number(fingerExtended[3])) / 4, 0, 1) * 0.08;

    resetOpenPalmTracking(motionState);
    return buildPrediction(
      "CALL_ME",
      confidence,
      "Call me gesture detected",
      "Extend your thumb and pinky like a phone"
    );
  }

  if (curledCount >= 4 && averageFingerSpread < 0.95) {
    const confidence =
      0.7 + clamp((1 - averageFingerSpread) / 0.35, 0, 1) * 0.18;

    resetOpenPalmTracking(motionState);
    return buildPrediction("FIST", confidence, "Stop gesture detected");
  }

  if (openPalm) {
    const motionSignal = updateMotionSignal(motionState, landmarks, now);
    const isWaveMotion =
      motionSignal.amplitudeX > 0.065 &&
      motionSignal.directionFlipsX >= 1 &&
      motionSignal.totalTravel > 0.12 &&
      motionSignal.amplitudeX > motionSignal.amplitudeY * 1.15;
    const isSteadyPalm =
      motionSignal.amplitudeX < 0.035 &&
      motionSignal.amplitudeY < 0.05 &&
      motionSignal.totalTravel < 0.12;

    if (isWaveMotion) {
      resetOpenPalmTracking(motionState);
      const confidence =
        0.73 +
        clamp((motionSignal.amplitudeX - 0.065) / 0.14, 0, 1) * 0.14 +
        clamp(motionSignal.directionFlipsX / 3, 0, 1) * 0.08;

      return buildPrediction(
        "WAVE",
        confidence,
        "Bye gesture detected",
        "Move your open palm side to side"
      );
    }

    if (!motionState.openPalmHoldStartedAt) {
      motionState.openPalmHoldStartedAt = now;
    }

    const steadyPalmDuration = now - motionState.openPalmHoldStartedAt;
    if (isSteadyPalm && steadyPalmDuration >= 320) {
      const confidence =
        0.7 +
        clamp(thumbDistanceFromPalm / 1.2, 0, 1) * 0.08 +
        clamp(averageFingerSpread / 1.6, 0, 1) * 0.08;

      return buildPrediction(
        "OPEN_PALM",
        confidence,
        "Hello gesture detected",
        "Hold your palm steady"
      );
    }

    return buildTrackingState(
      "Tracking open palm movement",
      "Hold still for Hello or wave side to side for Bye"
    );
  }

  motionState.openPalmHoldStartedAt = 0;
  motionState.samples = [];

  return {
    status: "UNRECOGNIZED",
    gesture: null,
    confidence: 0.35,
    message: "Hand detected, but no mapped gesture yet",
    messageText: "",
    emoji: "",
    gestureType: "",
    hint: "",
  };
}
