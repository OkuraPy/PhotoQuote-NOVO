// PhotoQuote v2 — lightweight i18n. EN is the source of truth and fallback; ES/PT fall back to EN
// per-key. Screens register their strings co-located (registerStrings) and read via useT()/t().
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { pickLocale } from './locale';

export type Locale = 'en' | 'es' | 'pt';
export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
];

const dict: Record<Locale, Record<string, string>> = { en: {}, es: {}, pt: {} };

// Co-locate each screen's strings near where they're used. `en` is required; `es`/`pt` are optional
// and fall back to `en` for any missing key — so translations can land incrementally.
export function registerStrings(strings: Record<string, { en: string; es?: string; pt?: string }>) {
  for (const [key, val] of Object.entries(strings)) {
    dict.en[key] = val.en;
    if (val.es != null) dict.es[key] = val.es;
    if (val.pt != null) dict.pt[key] = val.pt;
  }
}

const STORAGE_KEY = '@photoquote_locale_v2';
// Default to the device language, synchronously — so the very first frame (incl. Login) is
// already localized. A manual choice persisted via setLocale() overrides it once the provider
// reads AsyncStorage below; with no saved choice we keep following the device each cold start.
let current: Locale = (() => {
  try {
    return pickLocale(getLocales().map((l) => l.languageCode));
  } catch {
    // covers getLocales() failing at CALL time only — the expo-localization import above already
    // requires the native module (bundled in Expo Go SDK 54; compiled into EAS builds), so a
    // binary without it throws at import, before this line (the index.ts boot visor would show it).
    return 'en';
  }
})();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}
export async function setLocale(l: Locale) {
  current = l;
  listeners.forEach((fn) => fn());
  try {
    await AsyncStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
}
// translate a key with optional {var} interpolation; falls back to en, then to the key itself.
export function translate(key: string, vars?: Record<string, string | number>): string {
  let s = dict[current][key] ?? dict.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

const Ctx = createContext(0);
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0); // bumped on locale change → re-renders all consumers
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (mounted && (v === 'en' || v === 'es' || v === 'pt')) {
          current = v;
          setTick((t) => t + 1);
        }
      })
      .catch(() => {});
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      mounted = false;
      listeners.delete(fn);
    };
  }, []);
  return <Ctx.Provider value={tick}>{children}</Ctx.Provider>;
}
// hook form — subscribes the component to locale changes
export function useT() {
  useContext(Ctx);
  return translate;
}
export function useLocale(): [Locale, (l: Locale) => void] {
  useContext(Ctx);
  return [current, setLocale];
}
