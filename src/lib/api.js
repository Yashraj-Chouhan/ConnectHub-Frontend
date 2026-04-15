import { jsxs as _jsxs } from "react/jsx-runtime";
// Central API client for ConnectHub
// All requests go through /api which Vite proxies to http://localhost:9001 (gateway)
const BASE_URL = "/api";
function getToken() {
    return localStorage.getItem("token");
}
function getHeaders() {
    const headers = {
        "Content-Type": "application/json",
    };
    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}
function toUserFriendlyError(status, body) {
    // Extract message string from backend response
    let msg = "";
    if (typeof body === "string") {
        msg = body;
    }
    else if (body && typeof body === "object") {
        const anyBody = body;
        msg = String(anyBody.message || anyBody.error || anyBody.detail || "");
    }
    // Map known backend messages to friendly text
    if (msg.includes("Email already registered")) {
        return "This email is already registered. Try signing in instead.";
    }
    if (msg.includes("Invalid email or password")) {
        return "Incorrect email or password. Please try again.";
    }
    if (msg.includes("Email and password are required")) {
        return "Please enter your email and password.";
    }
    if (msg.includes("Email, username and password are required") || msg.includes("All fields")) {
        return "Please fill in all required fields.";
    }
    if (msg.includes("Account created")) {
        return msg;
    }
    if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("invalid username")) {
        return "Account not found. Please double-check your email or sign up.";
    }
    if (msg)
        return msg;
    // Fallback by status code
    if (status === 401)
        return "Incorrect email or password. Please try again.";
    if (status === 409)
        return "This email is already registered. Try signing in instead.";
    if (status === 400)
        return "Please fill in all required fields correctly.";
    if (status === 403)
        return "You don't have permission to do that.";
    if (status === 404)
        return "The requested resource was not found.";
    if (status >= 500)
        return "Server error. Please try again in a moment.";
    return "Something went wrong. Please try again.";
}
async function request(url, options) {
    let response;
    try {
        response = await fetch(BASE_URL + url, {
            ...options,
            headers: {
                ...getHeaders(),
                ...(options?.headers ?? {}),
            },
        });
    }
    catch {
        throw new Error("Could not connect to the server. Make sure the backend is running and try again.");
    }
    const text = await response.text();
    let body;
    try {
        body = JSON.parse(text);
    }
    catch {
        body = text;
    }
    if (!response.ok) {
        throw new Error(toUserFriendlyError(response.status, body));
    }
    return body;
}
export const api = {
    post: _jsxs(T, { children: ["(url: string, data: unknown) => request", _jsxs(T, { children: ["(url, ", method, ": \"POST\", body: JSON.stringify(data), }), get: ", _jsxs(T, { children: ["(url: string) => request", _jsxs(T, { children: ["(url), put: ", _jsxs(T, { children: ["(url: string, data: unknown) => request", _jsxs(T, { children: ["(url, ", method, ": \"PUT\", body: JSON.stringify(data), }), delete: ", _jsxs(T, { children: ["(url: string) => request", _jsxs(T, { children: ["(url, ", method, ": \"DELETE\", }), };"] })] })] })] })] })] })] })] })
};
