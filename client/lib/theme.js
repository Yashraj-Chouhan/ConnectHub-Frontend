import { normalizeTranslationLanguage } from "./api";

const THEME_DEFINITIONS = Object.freeze([
  { value: "coffee", label: "Coffee", description: "Beige and brown" },
  { value: "midnight", label: "Midnight", description: "Classic dark" },
  { value: "ocean", label: "Ocean", description: "Cyan and blue" },
  { value: "sakura", label: "Sakura", description: "Rose and blossom" },
  { value: "paris", label: "Paris", description: "Ink blue and gold" },
  { value: "sunset", label: "Sunset", description: "Coral and amber" },
  { value: "monsoon", label: "Monsoon", description: "Indigo and teal" },
  { value: "lagoon", label: "Lagoon", description: "Tropical teal" },
  { value: "graphite", label: "Graphite", description: "Slate and silver" },
  { value: "olive", label: "Olive", description: "Forest and terracotta" },
]);

export const DEFAULT_THEME = "coffee";
export const THEME_OPTIONS = THEME_DEFINITIONS;
export const THEME_VALUES = THEME_DEFINITIONS.map((theme) => theme.value);

const THEME_LOOKUP = new Map(
  THEME_DEFINITIONS.map((theme) => [theme.value, theme])
);

const LANGUAGE_THEME_MAP = new Map([
  ["en", "coffee"],
  ["hi", "monsoon"],
  ["ja", "sakura"],
  ["es", "sunset"],
  ["fr", "paris"],
  ["de", "graphite"],
  ["pt", "lagoon"],
  ["it", "olive"],
]);

function hashThemeKey(value) {
  const input = String(value || "").trim().toLowerCase();
  if (!input) {
    return 0;
  }

  return Array.from(input).reduce((hash, char) => {
    return ((hash * 31) + char.codePointAt(0)) >>> 0;
  }, 0);
}

export function normalizeAppTheme(theme, fallback = DEFAULT_THEME) {
  const normalizedTheme = String(theme || "").trim().toLowerCase();
  if (THEME_LOOKUP.has(normalizedTheme)) {
    return normalizedTheme;
  }

  const normalizedFallback = String(fallback || "").trim().toLowerCase();
  if (THEME_LOOKUP.has(normalizedFallback)) {
    return normalizedFallback;
  }

  return DEFAULT_THEME;
}

export function getThemeLabel(theme) {
  return THEME_LOOKUP.get(normalizeAppTheme(theme))?.label || "Coffee";
}

export function getThemeDescription(theme) {
  return THEME_LOOKUP.get(normalizeAppTheme(theme))?.description || "";
}

export function getThemeForLanguage(language, fallback = DEFAULT_THEME) {
  const normalizedLanguage = normalizeTranslationLanguage(language, "");
  if (!normalizedLanguage || normalizedLanguage === "none") {
    return normalizeAppTheme(fallback);
  }

  const directTheme = LANGUAGE_THEME_MAP.get(normalizedLanguage);
  if (directTheme) {
    return directTheme;
  }

  const rawLanguage = String(language || "").trim().toLowerCase();
  if (!rawLanguage) {
    return normalizeAppTheme(fallback);
  }

  const fallbackTheme = normalizeAppTheme(fallback);
  const hash = hashThemeKey(rawLanguage);
  return THEME_VALUES[hash % THEME_VALUES.length] || fallbackTheme;
}
