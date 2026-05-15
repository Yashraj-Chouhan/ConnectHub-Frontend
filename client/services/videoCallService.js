const CALL_EVENT_TYPES = Object.freeze({
  INVITE: "CALL_INVITE",
  ACCEPT: "CALL_ACCEPT",
  DECLINE: "CALL_DECLINE",
  BUSY: "CALL_BUSY",
  OFFER: "CALL_OFFER",
  ANSWER: "CALL_ANSWER",
  ICE_CANDIDATE: "CALL_ICE_CANDIDATE",
  CAPTION: "CALL_CAPTION",
  GESTURE: "CALL_GESTURE",
  END: "CALL_END",
});

const CALL_EVENT_SET = new Set(Object.values(CALL_EVENT_TYPES));
const SIGNAL_PAYLOAD_PREFIX = "__connecthub_call__:";
const DEFAULT_STUN_URLS = Object.freeze([
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
]);
const TURN_CREDENTIALS_URL = String(
  import.meta.env.VITE_TURN_CREDENTIALS_URL || ""
).trim();
const TURN_API_KEY = String(import.meta.env.VITE_TURN_API_KEY || "").trim();
const TURN_REGION = String(import.meta.env.VITE_TURN_REGION || "").trim();
const STATIC_TURN_URLS = String(import.meta.env.VITE_TURN_URLS || "").trim();
const STATIC_TURN_USERNAME = String(
  import.meta.env.VITE_TURN_USERNAME || ""
).trim();
const STATIC_TURN_CREDENTIAL = String(
  import.meta.env.VITE_TURN_CREDENTIAL || ""
).trim();
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
let cachedIceServerPromise = null;

function createSignalId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

export { CALL_EVENT_TYPES };

export function isVideoCallEvent(eventType) {
  return CALL_EVENT_SET.has(String(eventType || "").toUpperCase());
}

export function buildVideoSignal({
  eventType,
  sender,
  roomId,
  recipientId,
  callId,
  callMediaType = "VIDEO",
  signalType,
  sdp,
  candidate,
  candidateMid,
  candidateMLineIndex,
  callStatus,
  payload,
}) {
  const normalizedEventType = String(eventType || "").toUpperCase();
  const signalPayload = {
    callId,
    callMediaType,
    signalType: signalType || normalizedEventType,
    sdp: sdp || null,
    candidate: candidate || null,
    candidateMid: candidateMid || null,
    candidateMLineIndex:
      Number.isInteger(candidateMLineIndex) ? candidateMLineIndex : null,
    callStatus: callStatus || null,
    payload: payload ?? null,
  };
  const serializedSignalPayload = `${SIGNAL_PAYLOAD_PREFIX}${JSON.stringify(
    signalPayload
  )}`;

  return {
    messageId: createSignalId(),
    sender,
    roomId: String(roomId || ""),
    recipientId: recipientId ? String(recipientId) : null,
    eventType: normalizedEventType,
    messageType: "CALL_SIGNAL",
    content: serializedSignalPayload,
    originalContent: serializedSignalPayload,
    callId,
    callMediaType,
    signalType: signalPayload.signalType,
    sdp: signalPayload.sdp,
    candidate: signalPayload.candidate,
    candidateMid: signalPayload.candidateMid,
    candidateMLineIndex: signalPayload.candidateMLineIndex,
    callStatus: signalPayload.callStatus,
    payload: signalPayload.payload,
  };
}

function parseSignalPayloadString(value) {
  if (typeof value !== "string" || !value.startsWith(SIGNAL_PAYLOAD_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(value.slice(SIGNAL_PAYLOAD_PREFIX.length));
  } catch {
    return null;
  }
}

export function resolveVideoSignalPayload(payload) {
  const fallback =
    parseSignalPayloadString(payload?.content) ||
    parseSignalPayloadString(payload?.originalContent) ||
    {};

  return {
    ...payload,
    callId: payload?.callId || fallback.callId || null,
    callMediaType: payload?.callMediaType || fallback.callMediaType || "VIDEO",
    signalType: payload?.signalType || fallback.signalType || payload?.eventType,
    sdp: payload?.sdp || fallback.sdp || null,
    candidate: payload?.candidate || fallback.candidate || null,
    candidateMid: payload?.candidateMid || fallback.candidateMid || null,
    candidateMLineIndex:
      payload?.candidateMLineIndex ??
      fallback.candidateMLineIndex ??
      null,
    callStatus: payload?.callStatus || fallback.callStatus || null,
    payload: payload?.payload || fallback.payload || null,
  };
}

export function supportsWebRtc() {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection !== "undefined"
  );
}

export function supportsMediaDevices() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function isSecureMediaContext() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.isSecureContext) {
    return true;
  }

  const protocol = String(window.location?.protocol || "").toLowerCase();
  const hostname = String(window.location?.hostname || "").toLowerCase();
  return protocol === "https:" || LOCALHOST_HOSTS.has(hostname);
}

function resolveMediaExampleOrigin() {
  if (typeof window === "undefined") {
    return "http://192.168.x.x";
  }

  return window.location?.origin || "http://192.168.x.x";
}

export function getMediaDevicesSupportMessage(deviceLabel = "camera and microphone") {
  if (!isSecureMediaContext()) {
    return `Open ConnectHub over HTTPS or localhost to use your ${deviceLabel}. Browsers block ${deviceLabel} access on insecure network URLs like ${resolveMediaExampleOrigin()}.`;
  }

  return `This browser does not expose the ${deviceLabel} APIs required by ConnectHub. Try the latest Chrome, Edge, Firefox, or Safari in a regular browser tab.`;
}

export function getVideoCallSupportMessage() {
  if (!supportsWebRtc()) {
    return "This browser does not expose the WebRTC APIs required for ConnectHub video calls. Try the latest Chrome, Edge, Firefox, or Safari in a regular browser tab.";
  }

  return getMediaDevicesSupportMessage("camera and microphone");
}

export function describeMediaAccessError(
  error,
  deviceLabel = "camera and microphone"
) {
  if (!supportsMediaDevices()) {
    return getMediaDevicesSupportMessage(deviceLabel);
  }

  const errorName = String(error?.name || "").toLowerCase();
  const fallbackMessage =
    String(error?.message || "").trim() ||
    `Allow access to your ${deviceLabel} and try again.`;

  if (
    errorName === "notallowederror" ||
    errorName === "permissiondeniederror"
  ) {
    return `Allow access to your ${deviceLabel} in the browser and try again.`;
  }

  if (
    errorName === "notfounderror" ||
    errorName === "devicesnotfounderror"
  ) {
    return `No ${deviceLabel} was found on this device.`;
  }

  if (
    errorName === "notreadableerror" ||
    errorName === "trackstarterror" ||
    errorName === "aborterror"
  ) {
    return `Your ${deviceLabel} is busy in another app. Close other camera, recorder, or meeting apps and try again.`;
  }

  if (
    errorName === "overconstrainederror" ||
    errorName === "constraintnotsatisfiederror"
  ) {
    return `This device could not satisfy the requested ${deviceLabel} settings.`;
  }

  if (errorName === "securityerror") {
    return getMediaDevicesSupportMessage(deviceLabel);
  }

  return fallbackMessage;
}

export function getDirectCallRecipientId(members, currentUserId) {
  return (
    members?.find(
      (member) => String(member.userId || member.id) !== String(currentUserId)
    )?.userId ||
    members?.find(
      (member) => String(member.userId || member.id) !== String(currentUserId)
    )?.id ||
    null
  );
}

function parseIceUrlList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeIceServers(servers) {
  return (Array.isArray(servers) ? servers : [])
    .map((server) => {
      const urls = Array.isArray(server?.urls)
        ? server.urls.map((value) => String(value || "").trim()).filter(Boolean)
        : String(server?.urls || "").trim();

      if (!urls || (Array.isArray(urls) && urls.length === 0)) {
        return null;
      }

      const normalized = { urls };
      if (server?.username) {
        normalized.username = String(server.username);
      }
      if (server?.credential) {
        normalized.credential = String(server.credential);
      }
      return normalized;
    })
    .filter(Boolean);
}

function dedupeIceServers(servers) {
  const seen = new Set();
  return servers.filter((server) => {
    const key = JSON.stringify(server);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildStaticIceServers() {
  const configuredStunUrls = parseIceUrlList(import.meta.env.VITE_STUN_URLS);
  const stunUrls = configuredStunUrls.length
    ? configuredStunUrls
    : DEFAULT_STUN_URLS;
  const iceServers = stunUrls.map((url) => ({ urls: url }));
  const turnUrls = parseIceUrlList(STATIC_TURN_URLS);

  if (
    turnUrls.length > 0 &&
    STATIC_TURN_USERNAME &&
    STATIC_TURN_CREDENTIAL
  ) {
    iceServers.push({
      urls: turnUrls,
      username: STATIC_TURN_USERNAME,
      credential: STATIC_TURN_CREDENTIAL,
    });
  }

  return dedupeIceServers(normalizeIceServers(iceServers));
}

async function loadIceServers() {
  if (!cachedIceServerPromise) {
    cachedIceServerPromise = (async () => {
      const fallbackIceServers = buildStaticIceServers();

      if (!TURN_CREDENTIALS_URL) {
        return fallbackIceServers;
      }

      try {
        const url = new URL(
          TURN_CREDENTIALS_URL,
          typeof window !== "undefined" ? window.location.origin : undefined
        );

        if (TURN_API_KEY) {
          url.searchParams.set("apiKey", TURN_API_KEY);
        }
        if (TURN_REGION) {
          url.searchParams.set("region", TURN_REGION);
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`TURN credentials request failed with ${response.status}`);
        }

        const payload = await response.json();
        const remoteIceServers = normalizeIceServers(
          Array.isArray(payload) ? payload : payload?.iceServers
        );

        return remoteIceServers.length > 0
          ? dedupeIceServers([...fallbackIceServers, ...remoteIceServers])
          : fallbackIceServers;
      } catch {
        return fallbackIceServers;
      }
    })();
  }

  return cachedIceServerPromise;
}

export function hasTurnRelayConfigured() {
  return Boolean(
    TURN_CREDENTIALS_URL ||
      (STATIC_TURN_URLS && STATIC_TURN_USERNAME && STATIC_TURN_CREDENTIAL)
  );
}

export async function createPeerConnection({
  onIceCandidate,
  onTrack,
  onConnectionStateChange,
  onIceConnectionStateChange,
}) {
  const iceServers = await loadIceServers();
  const peerConnection = new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 4,
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    onTrack?.(event);
  };

  peerConnection.onconnectionstatechange = () => {
    onConnectionStateChange?.(peerConnection.connectionState);
  };

  peerConnection.oniceconnectionstatechange = () => {
    onIceConnectionStateChange?.(peerConnection.iceConnectionState);
  };

  return peerConnection;
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

export function createRemoteStream() {
  return new MediaStream();
}
