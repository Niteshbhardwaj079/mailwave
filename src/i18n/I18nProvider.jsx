import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  cachedDictionary,
  englishDictionary,
  findLanguage,
  loadDictionary,
} from './languages';
import { setActiveLocale } from '../utils/format';

const STORAGE_KEY = 'mailwave.language';

const I18nContext = createContext(null);

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((language) => language.code === stored)) return stored;
  } catch (error) {
    // Private mode or blocked storage — fall back to the default.
  }
  return DEFAULT_LANGUAGE;
}

// Start fetching the stored language while this module is still being
// evaluated — before React mounts — so the chunk is usually already there by
// the time the first screen renders.
const INITIAL_CODE = readStoredLanguage();
loadDictionary(INITIAL_CODE);

export function I18nProvider({ children }) {
  const [code, setCode] = useState(INITIAL_CODE);

  // Dictionaries live in the module cache, not in state. This only exists to
  // re-render once a chunk lands; the dictionary itself is read below.
  const [, dictionaryArrived] = useReducer((count) => count + 1, 0);

  const language = useMemo(() => findLanguage(code), [code]);

  // Read during render, so a language that is already cached shows up straight
  // away instead of flashing English for one frame.
  const dict = cachedDictionary(code) || englishDictionary;

  // Set during render, not in an effect: formatNumber()/formatDate() are called
  // by children while they render, which happens before any effect runs.
  setActiveLocale(language.locale);

  useEffect(() => {
    let cancelled = false;

    // Always subscribe, even when the dictionary looks cached: the chunk can
    // land between this render and this effect, which would leave the English
    // fallback on screen with nothing left to trigger a re-render.
    loadDictionary(code).then((loaded) => {
      if (!cancelled && loaded !== dict) dictionaryArrived();
    });

    return () => {
      cancelled = true;
    };
  }, [code, dict, dictionaryArrived]);

  useEffect(() => {
    document.documentElement.lang = language.code;
    document.documentElement.dir = language.dir;
    try {
      window.localStorage.setItem(STORAGE_KEY, language.code);
    } catch (error) {
      // Ignore — the choice simply will not survive a refresh.
    }
  }, [language]);

  const t = useCallback(
    (key, vars) => {
      let text = dict[key];
      if (text === undefined) text = englishDictionary[key];
      if (text === undefined) return key;

      if (!vars) return text;
      return Object.keys(vars).reduce(
        (result, name) => result.split(`{${name}}`).join(String(vars[name])),
        text
      );
    },
    [dict]
  );

  const value = useMemo(
    () => ({
      t,
      language,
      code: language.code,
      dir: language.dir,
      locale: language.locale,
      setLanguage: setCode,
      languages: LANGUAGES,
    }),
    [t, language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}

export function useT() {
  return useI18n().t;
}
