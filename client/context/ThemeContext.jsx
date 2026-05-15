/*
 * Theme state for the frontend.
 *
 * The app derives a default theme from the user's preferred language but still
 * lets the user override it and persist that choice locally.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, getThemeForLanguage, normalizeAppTheme } from "@/lib/theme";

const ThemeContext = createContext();

function safeReadStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredPreferredLanguage() {
  try {
    const storedUser = safeReadStorage("user") || safeReadStorage("chatUser");
    if (!storedUser) {
      return null;
    }

    const parsed = JSON.parse(storedUser);
    return parsed?.preferredLanguage || null;
  } catch {
    return null;
  }
}

function resolveInitialTheme() {
  const storedTheme = normalizeAppTheme(safeReadStorage("app-theme"), DEFAULT_THEME);
  const storedLanguage = readStoredPreferredLanguage();
  if (storedLanguage) {
    return getThemeForLanguage(storedLanguage, storedTheme);
  }

  return storedTheme;
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return resolveInitialTheme();
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("app-theme", theme);
    } catch {
      // Ignore storage failures so theming still works in private mode or tests.
    }
    
    // Fallback if someone looks for .dark specifically for other integrations
    if (theme === "midnight") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const changeTheme = useCallback((newTheme) => {
    setTheme((currentTheme) => normalizeAppTheme(newTheme, currentTheme));
  }, []);

  const syncThemeFromLanguage = useCallback((language) => {
    setTheme((currentTheme) => getThemeForLanguage(language, currentTheme));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, changeTheme, syncThemeFromLanguage }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
