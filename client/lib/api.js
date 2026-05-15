/*
 * Frontend API client.
 *
 * This module centralizes URL building, token handling, error normalization,
 * and convenience wrappers for each backend capability used by the UI.
 */
const DEV_API_PROXY_PREFIX = "/api";
const DEFAULT_GATEWAY_PORT = String(import.meta.env.VITE_GATEWAY_PORT || "8080").trim();

function trimTrailingSlash(value) {
  return value ? value.replace(/\/+$/, "") : "";
}

const configuredApiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL);
const runtimeApiBaseUrl = (() => {
  if (typeof window === "undefined") {
    return "";
  }

  if (import.meta.env.DEV) {
    const host = window.location.hostname;
    if (!host) {
      return "";
    }
    return trimTrailingSlash(`${window.location.protocol}//${host}:${DEFAULT_GATEWAY_PORT}`);
  }

  return trimTrailingSlash(window.location.origin);
})();

const useDevProxy =
  import.meta.env.DEV &&
  !configuredApiBaseUrl &&
  String(import.meta.env.VITE_USE_DEV_PROXY || "true").trim().toLowerCase() !== "false";

export const API_BASE_URL = configuredApiBaseUrl || runtimeApiBaseUrl;

// For direct-link URLs (attachment downloads etc.) we need the explicit prefix.
// In proxy mode, that stays on /api so Vite can forward the request.
export const apiUrlPrefix = useDevProxy ? DEV_API_PROXY_PREFIX : API_BASE_URL;

export function resolveAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith("/")) {
    if (url.startsWith(apiUrlPrefix)) return url;
    return `${apiUrlPrefix}${url}`;
  }
  return url;
}

// WebSocket requests use the dev proxy in development and the gateway directly elsewhere.
export const WS_BASE_URL = useDevProxy ? "" : API_BASE_URL;

export const SUPPORTED_TRANSLATION_LANGUAGES = Object.freeze([
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "hi", name: "Hindi" },
  { code: "ja", name: "Japanese" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "bn", name: "Bengali" },
  { code: "pa", name: "Punjabi" },
]);

const TRANSLATION_LANGUAGE_ALIASES = new Map([
  ["english", "en"],
  ["spanish", "es"],
  ["french", "fr"],
  ["german", "de"],
  ["hindi", "hi"],
  ["\u0939\u093f\u0902\u0926\u0940", "hi"],
  ["japanese", "ja"],
  ["portuguese", "pt"],
  ["italian", "it"],
  ["kannada", "kn"],
  ["malayalam", "ml"],
  ["tamil", "ta"],
  ["telugu", "te"],
  ["marathi", "mr"],
  ["gujarati", "gu"],
  ["bengali", "bn"],
  ["punjabi", "pa"],
]);

export function normalizeTranslationLanguage(code, fallback = "en") {
  if (code === undefined || code === null) {
    return fallback;
  }

  const normalized = String(code).trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  if (!normalized || normalized === "none") {
    return "none";
  }

  const alias = TRANSLATION_LANGUAGE_ALIASES.get(normalized);
  if (alias) {
    return alias;
  }

  const baseCode = normalized.split(/[-_]/, 1)[0];
  const baseAlias = TRANSLATION_LANGUAGE_ALIASES.get(baseCode);
  if (baseAlias) {
    return baseAlias;
  }

  return SUPPORTED_TRANSLATION_LANGUAGES.some((language) => language.code === normalized)
    ? normalized
    : fallback;
}

function buildUrl(path, query) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (useDevProxy) {
    let urlString = `${DEV_API_PROXY_PREFIX}${normalizedPath}`;
    if (query && typeof query === "object") {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      });
      const qs = params.toString();
      if (qs) urlString += `?${qs}`;
    }
    return urlString;
  }

  const url = new URL(normalizedPath, `${API_BASE_URL}/`);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

function buildDirectUrl(path, query) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${API_BASE_URL}/`);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

function getToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

function isFormData(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function getHeaders(body, auth = true, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (!isFormData(body) && body !== undefined && body !== null && !("Content-Type" in headers) && !("content-type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function serializeBody(body) {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (isFormData(body) || typeof body === "string" || body instanceof Blob) {
    return body;
  }
  return JSON.stringify(body);
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function extractMessage(status, body) {
  let message = "";

  if (typeof body === "string") {
    message = body;
  } else if (body && typeof body === "object") {
    message = String(body.message || body.error || body.detail || "");
  }

  const normalizedMessage = message.toLowerCase();

  if (!message) {
    if (status === 401) return "Your session expired. Please sign in again.";
    if (status === 403) return "You do not have permission to do that.";
    if (status === 404) return "We couldn't find that page or service. Please check the details and try again.";
    if (status === 409) return "That item already exists.";
    if (status === 400) return "Please check your input and try again.";
    if (status >= 500) return "Server error. Please try again in a moment.";
    return "Something went wrong. Please try again.";
  }

  if (normalizedMessage.includes("email already registered")) {
    return "This email is already registered. Try signing in instead.";
  }
  if (normalizedMessage.includes("phone number already registered")) {
    return "This phone number is already registered. Try signing in instead.";
  }
  if (normalizedMessage.includes("username already registered")) {
    return "That username is already taken.";
  }
  if (normalizedMessage.includes("invalid email or password") || normalizedMessage.includes("bad credentials")) {
    return "Incorrect email/phone or password. Please try again.";
  }
  if (normalizedMessage.includes("email, phone number, username and password are required")) {
    return "Please fill in email, phone number, username, and password.";
  }
  if (normalizedMessage.includes("email/phone number and password are required")) {
    return "Please enter your email/phone and password.";
  }
  if (normalizedMessage.includes("account not found") || normalizedMessage.includes("user not found")) {
    return "We couldn't find an account with that information. Please check it and try again.";
  }
  if (normalizedMessage.includes("token") && normalizedMessage.includes("invalid")) {
    return "That reset token is invalid or expired. Please request a new one.";
  }
  if (normalizedMessage.includes("token") && normalizedMessage.includes("expired")) {
    return "That reset token has expired. Please request a new one.";
  }
  if (normalizedMessage.includes("translation limit reached") || status === 402 || status === 429) {
    return "Your translation credits are exhausted. Top up to continue translating messages.";
  }
  if (normalizedMessage.includes("not found")) {
    return "We couldn't find that account or service. Please check the details and try again.";
  }

  return message;
}

// Shared low-level request helper that all API wrappers build on.
async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers: extraHeaders,
    query,
    maxRetries = 0,
    retryDelayMs = 0,
    retryStatuses = [],
  } = options;

  const requestBody = serializeBody(body);
  const requestHeaders = getHeaders(body, auth, extraHeaders);
  const retryStatusSet = new Set(
    Array.isArray(retryStatuses)
      ? retryStatuses
          .map((status) => Number(status))
          .filter((status) => Number.isInteger(status) && status > 0)
      : []
  );
  const makeRequest = (url) =>
    fetch(url, {
      method,
      credentials: "include",
      headers: requestHeaders,
      body: requestBody,
    });

  let response;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      response = await makeRequest(buildUrl(path, query));
    } catch {
      if (useDevProxy) {
        try {
          response = await makeRequest(buildDirectUrl(path, query));
        } catch {
          throw new Error("Could not connect to the backend. Make sure the services are running.");
        }
      } else {
        throw new Error("Could not connect to the backend. Make sure the services are running.");
      }
    }

    if (useDevProxy && [502, 503, 504].includes(response.status)) {
      try {
        const directResponse = await makeRequest(buildDirectUrl(path, query));
        if (directResponse.ok || ![502, 503, 504].includes(directResponse.status)) {
          response = directResponse;
        }
      } catch {
        // Keep the proxy response so the user still sees the backend error details.
      }
    }

    const shouldRetry =
      !response.ok &&
      attempt < maxRetries &&
      retryStatusSet.has(response.status);

    if (!shouldRetry) {
      break;
    }

    await wait(retryDelayMs > 0 ? retryDelayMs * (attempt + 1) : 0);
  }

  const text = await response.text();
  let parsedBody = text;

  if (text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  if (!response.ok) {
    throw new Error(extractMessage(response.status, parsedBody));
  }

  return parsedBody;
}

function putJson(path, body, options = {}) {
  return request(path, { ...options, method: "PUT", body });
}

function postJson(path, body, options = {}) {
  return request(path, { ...options, method: "POST", body });
}

function deleteRequest(path, options = {}) {
  return request(path, { ...options, method: "DELETE" });
}

function patchJson(path, body, options = {}) {
  return request(path, { ...options, method: "PATCH", body });
}

export const api = {
  request,
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: postJson,
  put: putJson,
  patch: patchJson,
  delete: deleteRequest,
  auth: {
    login: (identifier, password) => postJson("/auth/login", { identifier, password }, { auth: false }),
    loginWithGoogle: (idToken) => postJson("/auth/login/google", { idToken }, { auth: false }),
    register: (payload) => postJson("/auth/register", payload, { auth: false }),
    initiateSignup: (payload) => postJson("/auth/register/initiate", payload, { auth: false }),
    completeSignup: (email, otp) => postJson("/auth/register/complete", { email, otp }, { auth: false }),
    forgotPassword: (identifier) => postJson("/auth/forgot-password", { identifier }, { auth: false }),
    resetPassword: (token, newPassword) => postJson("/auth/reset-password", { token, newPassword }, { auth: false }),
    changePassword: (userId, currentPassword, newPassword) =>
      putJson(`/auth/users/${userId}/password`, { currentPassword, newPassword }),
    getUser: (userId) => request(`/auth/users/${userId}`),
    findUserByEmail: (email) => request("/auth/users/by-email", { query: { email } }),
    searchUsers: (query) => request("/auth/users/search", { query: { query } }),
    updateProfile: (userId, payload) => putJson(`/auth/users/${userId}/profile`, payload),
    uploadAvatar: (userId, file) => {
      const formData = new FormData();
      formData.append("file", file);
      return request(`/auth/users/${userId}/avatar`, { method: "POST", body: formData });
    },
    updateStatus: (userId, status) => request(`/auth/users/${userId}/status`, {
      method: "PUT",
      query: { status },
    }),
    consumeTranslationCredits: (userId) => postJson(`/auth/users/${userId}/translation-credits/consume`, {}, { auth: true }),
    topUpTranslationCredits: (userId, credits) =>
      postJson(`/auth/users/${userId}/translation-credits/top-up`, {}, { query: { credits } }),
  },
  contacts: {
    list: (userId) => request(`/auth/users/${userId}/contacts`),
    search: (userId, query) => request(`/auth/users/${userId}/contacts/search`, { query: { query } }),
    save: (userId, payload) => postJson(`/auth/users/${userId}/contacts`, payload),
    delete: (userId, contactId) => deleteRequest(`/auth/users/${userId}/contacts/${contactId}`),
  },
  rooms: {
    listForUser: (userId) => request(`/rooms/users/${userId}`),
    create: (payload) => postJson("/rooms", payload),
    createDirect: (payload) => postJson("/rooms/direct", payload),
    update: (roomId, requestedBy, payload) => putJson(`/rooms/${roomId}`, payload, { query: { requestedBy } }),
    delete: (roomId, requestedBy) => deleteRequest(`/rooms/${roomId}`, { query: { requestedBy } }),
    members: (roomId) => request(`/rooms/${roomId}/members`),
    addMembers: (roomId, requestedBy, userIds) =>
      postJson(`/rooms/${roomId}/members`, userIds, { query: { requestedBy } }),
    promoteAdmin: (roomId, requestedBy, userId) =>
      request(`/rooms/${roomId}/admins/${userId}`, { method: "PUT", query: { requestedBy } }),
    demoteAdmin: (roomId, requestedBy, userId) =>
      request(`/rooms/${roomId}/admins/${userId}`, { method: "DELETE", query: { requestedBy } }),
    removeMember: (roomId, requestedBy, userId) =>
      deleteRequest(`/rooms/${roomId}/members/${userId}`, { query: { requestedBy } }),
    leave: (roomId, userId) => postJson(`/rooms/${roomId}/leave/${userId}`, {}),
    updateLastMessageAt: (roomId, timestamp) =>
      request(`/rooms/${roomId}/last-message`, { method: "PUT", query: timestamp ? { timestamp } : undefined }),
  },
  messages: {
    list: (roomId) => request(`/messages/${roomId}`),
    history: (roomId, page = 0, size = 20) =>
      request(`/messages/${roomId}/history`, { query: { page, size } }),
    search: (roomId, query, page = 0, size = 20) =>
      request(`/messages/${roomId}/search`, { query: { query, page, size } }),
    save: (payload) => postJson("/messages", payload),
    uploadAttachment: (sender, roomId, file, content = "", options = {}) => {
      const { messageType, transcript, transcriptSourceLanguage } = options;
      const formData = new FormData();
      formData.append("sender", sender);
      formData.append("roomId", String(roomId));
      if (content) {
        formData.append("content", content);
      }
      if (messageType) {
        formData.append("messageType", messageType);
      }
      if (transcript) {
        formData.append("transcript", transcript);
      }
      if (transcriptSourceLanguage) {
        formData.append("transcriptSourceLanguage", transcriptSourceLanguage);
      }
      formData.append("file", file);
      return request("/messages/attachments", { method: "POST", body: formData });
    },
    edit: (roomId, messageId, content) => putJson(`/messages/${roomId}/${messageId}`, { content }),
    delete: (roomId, messageId) => deleteRequest(`/messages/${roomId}/${messageId}`),
    react: (roomId, messageId, userId, emoji) =>
      postJson(`/messages/${roomId}/${messageId}/reactions`, { userId, emoji }),
    translate: (roomId, messageId, targetLang) =>
      request(`/messages/${roomId}/${messageId}/translate`, {
        query: { targetLang },
        auth: true,
        maxRetries: 2,
        retryDelayMs: 700,
        retryStatuses: [502, 503, 504],
      }),
    translateWithUser: (roomId, messageId, targetLang, userId) =>
      request(`/messages/${roomId}/${messageId}/translate`, {
        query: { targetLang, userId },
        auth: true,
        maxRetries: 2,
        retryDelayMs: 700,
        retryStatuses: [502, 503, 504],
      }),
    attachmentUrl: (roomId, messageId) => `${apiUrlPrefix}/messages/${roomId}/attachments/${messageId}`,
  },
  notifications: {
    listUnread: (userId) => request(`/notifications/${userId}`),
    countUnread: (userId) => request(`/notifications/${userId}/count`),
    markRead: (id) => request(`/notifications/${id}/read`, { method: "PUT" }),
    markAllRead: (userId) => request(`/notifications/${userId}/read-all`, { method: "PUT" }),
  },
  translation: {
    translateText: (text, sourceLang = "auto", targetLang) =>
      postJson("/translate", { text, sourceLang, targetLang }, {
        auth: false,
        maxRetries: 2,
        retryDelayMs: 700,
        retryStatuses: [502, 503, 504],
      }),
    transcribeAudio: (file, sourceLang = "auto") => {
      const formData = new FormData();
      formData.append("file", file);
      if (sourceLang) {
        formData.append("sourceLang", sourceLang);
      }
      return request("/transcribe", {
        method: "POST",
        body: formData,
        auth: false,
        maxRetries: 2,
        retryDelayMs: 700,
        retryStatuses: [502, 503, 504],
      });
    },
    languages: () => Promise.resolve(SUPPORTED_TRANSLATION_LANGUAGES),
  },
  payments: {
    config: () => request("/payments/config"),
    createOrder: (userId, planCode, customerName, customerEmail) =>
      postJson("/payments/create-order", { userId, planCode, customerName, customerEmail }),
    verify: (payload) => postJson("/payments/verify", payload),
    history: (userId) => request(`/payments/history/${userId}`),
  }
};

export { buildUrl };

// Admin-only API wrappers
// Admin calls use a separate localStorage key ("adminToken") so they never
// conflict with the regular user session token.
// The AdminController validates role server-side as well.
function getAdminToken() {
  try {
    // "adminToken" is set by AdminLogin; fall back to "token" for compatibility.
    return localStorage.getItem("adminToken") || localStorage.getItem("token");
  } catch {
    return null;
  }
}

function adminRequest(path, { query, body, method = "GET", headers: extraHeaders = {} } = {}) {
  const token = getAdminToken();
  return request(path, {
    method,
    body,
    query,
    auth: false,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
  });
}

export const adminApi = {
  getAllUsers: () => adminRequest("/auth/admin/users"),

  toggleBlock: (userId) => adminRequest(`/auth/admin/users/${userId}/block`, { method: "PUT" }),

  deleteUser: (userId) => adminRequest(`/auth/admin/users/${userId}`, { method: "DELETE" }),

  changeRole: (userId, role) =>
    adminRequest(`/auth/admin/users/${userId}/role`, { method: "PUT", query: { role } }),

  setCredits: (userId, credits) =>
    adminRequest(`/auth/admin/users/${userId}/credits`, { method: "PUT", query: { credits } }),
};
