/*
 * Auth/session state for the frontend.
 *
 * This context is the single source of truth for the logged-in user, token
 * persistence, profile refreshes, and auth-related helper actions.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, resolveAvatarUrl, normalizeTranslationLanguage } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";

const AuthContext = createContext(undefined);

function safeReadStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors so the app can still render.
  }
}

function fallbackAvatar(seed) {
  const value = seed || "connecthub";
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(value)}`;
}

// Converts whatever the backend returned into one stable user shape that the
// rest of the UI can consume consistently.
function normalizeUser(profile, loginResponse, token) {
  const userId =
    profile?.userId || loginResponse?.userId || loginResponse?.id || null;
  const username = profile?.username || loginResponse?.username || "";
  const fullName = profile?.fullName || username || "";
  const avatarUrl = profile?.avatarUrl || loginResponse?.avatarUrl || "";
  const preferredLanguage = normalizeTranslationLanguage(
    profile?.preferredLanguage ?? loginResponse?.preferredLanguage ?? "en",
    "en"
  );

  return {
    id: userId,
    userId,
    username,
    fullName,
    name: fullName || username,
    email: profile?.email || loginResponse?.email || "",
    phoneNumber: profile?.phoneNumber || loginResponse?.phoneNumber || "",
    avatarUrl: resolveAvatarUrl(avatarUrl),
    avatar:
      resolveAvatarUrl(avatarUrl) ||
      fallbackAvatar(fullName || username || userId || "connecthub"),
    bio: profile?.bio || "",
    preferredLanguage,
    translationCreditsRemaining:
      profile?.translationCreditsRemaining ??
      loginResponse?.translationCreditsRemaining ??
      50,
    onlineStatus: profile?.onlineStatus || "OFFLINE",
    lastSeenAt: profile?.lastSeenAt || null,
    role: profile?.role || loginResponse?.role || "USER",
    token: token || loginResponse?.token || null,
  };
}

function loadStoredUser() {
  try {
    const storedUser =
      safeReadStorage("user") || safeReadStorage("chatUser");
    if (!storedUser) {
      return null;
    }
    const parsed = JSON.parse(storedUser);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return normalizeUser(parsed, null, safeReadStorage("token"));
  } catch {
    // Any corrupt or unexpected localStorage data — clear and start fresh.
    try { localStorage.removeItem("user"); } catch { /* ignore */ }
    try { localStorage.removeItem("chatUser"); } catch { /* ignore */ }
    try { localStorage.removeItem("token"); } catch { /* ignore */ }
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => loadStoredUser());
  const [token, setToken] = useState(() => safeReadStorage("token"));
  const { syncThemeFromLanguage } = useTheme();

  const persistAuth = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken || null);
    if (nextUser) {
      safeWriteStorage("user", JSON.stringify(nextUser));
      safeWriteStorage("chatUser", JSON.stringify(nextUser));
    } else {
      safeWriteStorage("user", null);
      safeWriteStorage("chatUser", null);
    }

    if (nextToken) {
      safeWriteStorage("token", nextToken);
    } else {
      safeWriteStorage("token", null);
    }

    if (nextUser?.preferredLanguage) {
      syncThemeFromLanguage(nextUser.preferredLanguage);
    }
  };

  const refreshUser = async (userId = user?.userId) => {
    if (!userId) {
      return null;
    }

    const profile = await api.auth.getUser(userId);
    const nextUser = normalizeUser(profile, user, token);
    persistAuth(nextUser, token);
    return nextUser;
  };

  const finalizeLogin = async (authResponse) => {
    const bootstrapUser = normalizeUser(null, authResponse, authResponse.token);
    persistAuth(bootstrapUser, authResponse.token);
    try {
      const profile = await api.auth.getUser(authResponse.userId);
      const nextUser = normalizeUser(profile, authResponse, authResponse.token);
      persistAuth(nextUser, authResponse.token);
    } catch {
      // If the profile lookup is unavailable, keep the authenticated bootstrap user
      // so a fresh signup/login can still continue into the app.
      persistAuth(bootstrapUser, authResponse.token);
    }
    await api.auth.updateStatus(authResponse.userId, "ONLINE").catch(() => {});
    return loadStoredUser() || bootstrapUser;
  };

  const login = async (identifier, password) => {
    const authResponse = await api.auth.login(identifier, password);
    return finalizeLogin(authResponse);
  };

  const loginWithGoogle = async (idToken) => {
    const authResponse = await api.auth.loginWithGoogle(idToken);
    return finalizeLogin(authResponse);
  };

  const signup = async ({ username, email, phoneNumber, password }) => {
    await api.auth.register({ username, email, phoneNumber, password });
    return {
      message: "Account created successfully. Please sign in.",
    };
  };

  const initiateSignup = async ({ username, email, phoneNumber, password }) => {
    const res = await api.auth.initiateSignup({ username, email, phoneNumber, password });
    return res; // contains { message }
  };

  const completeSignup = async (email, otp) => {
    const res = await api.auth.completeSignup(email, otp);
    return res; // contains { message }
  };

  const updateProfile = async (updates) => {
    if (!user?.userId) {
      throw new Error("You need to sign in again.");
    }

    const profile = await api.auth.updateProfile(user.userId, updates);
    const nextUser = normalizeUser(profile, user, token);
    persistAuth(nextUser, token);
    return nextUser;
  };

  const forgotPassword = (identifier) => api.auth.forgotPassword(identifier);
  const resetPassword = (tokenValue, newPassword) =>
    api.auth.resetPassword(tokenValue, newPassword);
  const changePassword = (currentPassword, newPassword) => {
    if (!user?.userId) {
      throw new Error("You need to sign in again.");
    }
    return api.auth.changePassword(
      user.userId,
      currentPassword,
      newPassword
    );
  };

  const logout = async () => {
    if (user?.userId) {
      await api.auth.updateStatus(user.userId, "OFFLINE").catch(() => {});
    }
    persistAuth(null, null);
  };

  useEffect(() => {
    let cancelled = false;

    if (!token || !user?.userId) {
      return undefined;
    }

    (async () => {
      try {
        const profile = await api.auth.getUser(user.userId);
        if (cancelled) {
          return;
        }
        const nextUser = normalizeUser(profile, user, token);
        persistAuth(nextUser, token);
        await api.auth.updateStatus(user.userId, "ONLINE").catch(() => {});
      } catch {
        // Keep the stored session if the profile fetch temporarily fails.
      }
    })();

    return () => {
      cancelled = true;
    };
    // We intentionally only rehydrate when the stored token/user pair changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      login,
      loginWithGoogle,
      signup,
      initiateSignup,
      completeSignup,
      logout,
      updateProfile,
      forgotPassword,
      resetPassword,
      changePassword,
      refreshUser,
    }),
    [user, token]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be within AuthProvider");
  }
  return context;
};
