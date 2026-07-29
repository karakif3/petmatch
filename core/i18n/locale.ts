export const DEFAULT_APP_LOCALE = "tr" as const;

/**
 * Catalogs can be prepared before they are exposed to users. A locale must
 * only move into this list after every user-facing string and native metadata
 * entry has been translated and reviewed.
 */
export const RELEASED_APP_LOCALES = ["tr"] as const;

export type AppLocale = "tr" | "en";
export type ReleasedAppLocale = (typeof RELEASED_APP_LOCALES)[number];

export function resolveAppLocale(languageCode: string | null | undefined): ReleasedAppLocale {
  const normalized = languageCode?.trim().toLowerCase().split(/[-_]/)[0];
  return RELEASED_APP_LOCALES.includes(normalized as ReleasedAppLocale)
    ? (normalized as ReleasedAppLocale)
    : DEFAULT_APP_LOCALE;
}

export function intlLocale(locale: AppLocale): string {
  return locale === "en" ? "en-US" : "tr-TR";
}
