import { useSyncExternalStore } from "react";
import { getLocales } from "expo-localization";
import { I18n, type TranslateOptions } from "i18n-js";

import { en } from "./catalogs/en";
import { tr } from "./catalogs/tr";
import {
  DEFAULT_APP_LOCALE,
  intlLocale,
  resolveAppLocale,
  type AppLocale,
} from "./locale";

const i18n = new I18n({ tr, en });
i18n.defaultLocale = DEFAULT_APP_LOCALE;
i18n.enableFallback = true;

const listeners = new Set<() => void>();

function deviceLanguageCode(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}

function applyLocale(nextLocale: AppLocale): boolean {
  if (i18n.locale === nextLocale) return false;
  i18n.locale = nextLocale;
  listeners.forEach((listener) => listener());
  return true;
}

applyLocale(resolveAppLocale(deviceLanguageCode()));

/** Android can change its app language without restarting the process. */
export function syncAppLocale(): boolean {
  return applyLocale(resolveAppLocale(deviceLanguageCode()));
}

export function getAppLocale(): AppLocale {
  return i18n.locale as AppLocale;
}

export function getIntlLocale(): string {
  return intlLocale(getAppLocale());
}

export function translate(scope: string, options?: TranslateOptions): string {
  return i18n.t(scope, options);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return i18n.locale;
}

/** Re-renders the caller when the active app locale changes. */
export function useTranslation(): typeof translate {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return translate;
}

export {
  DEFAULT_APP_LOCALE,
  RELEASED_APP_LOCALES,
  resolveAppLocale,
  type AppLocale,
} from "./locale";
