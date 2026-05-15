import { useCallback, useRef, useState } from "react";
import { api, normalizeTranslationLanguage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/**
 * Click-to-translate per message with credit-aware caching.
 * Successful translations are cached; quota errors are not cached so the
 * user can retry after topping up.
 */
export const useTranslation = () => {
  const { user, refreshUser } = useAuth();
  const [translationState, setTranslationState] = useState({});
  const cache = useRef({});

  const readStoredPreferredLanguage = () => {
    try {
      const storedUser = localStorage.getItem("user") || localStorage.getItem("chatUser");
      if (!storedUser) {
        return null;
      }

      const parsed = JSON.parse(storedUser);
      return parsed?.preferredLanguage ?? null;
    } catch {
      return null;
    }
  };

  const getPreferredLanguage = () => {
    const preferredLanguage = user?.preferredLanguage ?? readStoredPreferredLanguage();
    const normalized = normalizeTranslationLanguage(preferredLanguage, "en");
    return normalized === "none" ? null : normalized;
  };

  const getRemainingCredits = () => {
    const value = Number(user?.translationCreditsRemaining);
    return Number.isFinite(value) ? value : null;
  };

  const translateMessage = useCallback(
    async (messageId, roomId, originalText) => {
      const targetLang = getPreferredLanguage();
      const remainingCredits = getRemainingCredits();
      const currentState = translationState[messageId];

      if (currentState?.visible && !currentState.error && !currentState.limitReached && !currentState.upgradeRequired) {
        setTranslationState((prev) => ({
          ...prev,
          [messageId]: { ...prev[messageId], visible: false },
        }));
        return;
      }

      if (remainingCredits !== null && remainingCredits <= 0) {
        setTranslationState((prev) => ({
          ...prev,
          [messageId]: {
            loading: false,
            visible: true,
            translatedText: null,
            detectedLang: null,
            targetLang,
            upgradeRequired: true,
            limitReached: true,
            remainingCredits: 0,
            error: "Translation credits exhausted. Top up to continue.",
          },
        }));
        return;
      }

      const cacheKey = `${roomId || "global"}-${messageId}-${targetLang}`;
      if (cache.current[cacheKey]) {
        setTranslationState((prev) => ({
          ...prev,
          [messageId]: { ...cache.current[cacheKey], visible: true, loading: false },
        }));
        return;
      }

      setTranslationState((prev) => ({
        ...prev,
        [messageId]: {
          loading: true,
          visible: true,
          translatedText: null,
          error: null,
          detectedLang: null,
          targetLang,
          remainingCredits,
        },
      }));

      try {
        if (!roomId) {
          throw new Error("Missing room information for translation.");
        }

        const data = await api.messages.translateWithUser(roomId, messageId, targetLang, user?.userId);
        const success = Boolean(data?.success) && Boolean(data?.translatedContent || data?.translatedText);
        const translatedText = data?.translatedContent || data?.translatedText || originalText || "";
        const detectedLang = data?.detectedSourceLanguage || data?.sourceLanguage || null;
        const nextCredits = Number.isFinite(Number(data?.translationCreditsRemaining))
          ? Number(data.translationCreditsRemaining)
          : null;

        if (!success) {
          const error = data?.upgradeRequired
            ? "Translation credits exhausted. Top up to continue."
            : data?.error || "Translation failed";

          setTranslationState((prev) => ({
            ...prev,
            [messageId]: {
              loading: false,
              visible: true,
              translatedText: null,
              error,
              detectedLang,
              targetLang,
              remainingCredits: nextCredits,
              upgradeRequired: Boolean(data?.upgradeRequired),
              limitReached: Boolean(data?.upgradeRequired),
            },
          }));

          await refreshUser?.(user?.userId).catch(() => {});
          return;
        }

        const result = {
          translatedText,
          detectedLang,
          targetLang,
          loading: false,
          error: null,
          visible: true,
          remainingCredits: nextCredits,
          upgradeRequired: false,
          limitReached: false,
        };

        cache.current[cacheKey] = result;

        setTranslationState((prev) => ({
          ...prev,
          [messageId]: result,
        }));

        await refreshUser?.(user?.userId).catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "Translation unavailable. Check backend.";
        const limitReached = message.toLowerCase().includes("translation credits exhausted") || message.toLowerCase().includes("limit reached");

        setTranslationState((prev) => ({
          ...prev,
          [messageId]: {
            loading: false,
            visible: true,
            translatedText: null,
            error: limitReached ? "Translation credits exhausted. Top up to continue." : message,
            detectedLang: null,
            targetLang,
            remainingCredits: limitReached ? 0 : remainingCredits,
            upgradeRequired: limitReached,
            limitReached,
          },
        }));

        if (!limitReached) {
          await refreshUser?.(user?.userId).catch(() => {});
        }
      }
    },
    [getPreferredLanguage, refreshUser, translationState, user?.userId, user?.translationCreditsRemaining]
  );

  const getMessageTranslation = (messageId) => translationState[messageId] || null;

  const isPreferredLanguageSet = () => {
    return Boolean(getPreferredLanguage());
  };

  return {
    translateMessage,
    getMessageTranslation,
    isPreferredLanguageSet,
    getPreferredLanguage,
    remainingCredits: getRemainingCredits(),
    canTranslate: getRemainingCredits() === null || getRemainingCredits() > 0,
  };
};
