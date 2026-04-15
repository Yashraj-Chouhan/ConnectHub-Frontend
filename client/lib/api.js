const DEFAULT_API_BASE_URL = "http://localhost:9001";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

export const SUPPORTED_TRANSLATION_LANGUAGES = Object.freeze([
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "hi", name: "Hindi" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
]);

export function normalizeTranslationLanguage(code, fallback = "en") {
  if (code === undefined || code === null) {
    return fallback;
  }

  const normalized = String(code).trim().toLowerCase();
  if (!normalized || normalized === "none") {
    return "none";
  }

  return SUPPORTED_TRANSLATION_LANGUAGES.some((language) => language.code === normalized)
    ? normalized
    : fallback;
}

function buildUrl(path, query) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, API_BASE_URL);

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

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers: extraHeaders,
    query,
  } = options;

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: getHeaders(body, auth, extraHeaders),
      body: serializeBody(body),
    });
  } catch {
    throw new Error("Could not connect to the backend. Make sure the services are running.");
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
    register: (payload) => postJson("/auth/register", payload, { auth: false }),
    forgotPassword: (identifier) => postJson("/auth/forgot-password", { identifier }, { auth: false }),
    resetPassword: (token, newPassword) => postJson("/auth/reset-password", { token, newPassword }, { auth: false }),
    changePassword: (userId, currentPassword, newPassword) =>
      putJson(`/auth/users/${userId}/password`, { currentPassword, newPassword }),
    getUser: (userId) => request(`/auth/users/${userId}`),
    findUserByEmail: (email) => request("/auth/users/by-email", { query: { email } }),
    searchUsers: (query) => request("/auth/users/search", { query: { query } }),
    updateProfile: (userId, payload) => putJson(`/auth/users/${userId}/profile`, payload),
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
    uploadAttachment: (sender, roomId, file, content = "") => {
      const formData = new FormData();
      formData.append("sender", sender);
      formData.append("roomId", String(roomId));
      if (content) {
        formData.append("content", content);
      }
      formData.append("file", file);
      return request("/messages/attachments", { method: "POST", body: formData });
    },
    edit: (roomId, messageId, content) => putJson(`/messages/${roomId}/${messageId}`, { content }),
    delete: (roomId, messageId) => deleteRequest(`/messages/${roomId}/${messageId}`),
    react: (roomId, messageId, userId, emoji) =>
      postJson(`/messages/${roomId}/${messageId}/reactions`, { userId, emoji }),
    translate: (roomId, messageId, targetLang) =>
      request(`/messages/${roomId}/${messageId}/translate`, { query: { targetLang }, auth: true }),
    translateWithUser: (roomId, messageId, targetLang, userId) =>
      request(`/messages/${roomId}/${messageId}/translate`, { query: { targetLang, userId }, auth: true }),
    attachmentUrl: (roomId, messageId) => `${API_BASE_URL}/messages/${roomId}/attachments/${messageId}`,
  },
  translation: {
    translateText: (text, sourceLang = "auto", targetLang) =>
      postJson("/translate", { text, sourceLang, targetLang }, { auth: false }),
    languages: () => Promise.resolve(SUPPORTED_TRANSLATION_LANGUAGES),
  },
};

export { buildUrl };
