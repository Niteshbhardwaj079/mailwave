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
import { api } from '../api/client';
import brand from '../../brand.config.js';

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

  // null = not fetched yet, or no admin choice ever made — show every
  // language, same as before this feature existed. Read from the PUBLIC
  // /api/auth/roles endpoint (not /api/settings) because this provider
  // mounts before anyone is signed in — the login screen's own picker needs
  // this list too.
  const [enabledCodes, setEnabledCodes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/auth/roles')
      .then((data) => {
        if (!cancelled && Array.isArray(data?.enabledLanguages)) setEnabledCodes(data.enabledLanguages);
      })
      .catch(() => {
        // Offline or the request failed — fall back to showing every language.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const language = useMemo(() => findLanguage(code), [code]);

  // Whatever the admin has enabled, plus whichever language is actually
  // active right now — so a language that gets disabled later doesn't
  // vanish out from under someone already using it.
  const languages = useMemo(() => {
    if (!enabledCodes) return LANGUAGES;
    const list = LANGUAGES.filter((item) => enabledCodes.includes(item.code));
    if (!list.some((item) => item.code === language.code)) list.push(language);
    return list;
  }, [enabledCodes, language]);

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

      // Jis text me koi {placeholder} hai hi nahi, use chhed-chhad ki zarurat
      // nahi. 900+ me se zyadatar aise hi hain, isliye yeh check pehle.
      if (!vars && !text.includes('{')) return text;

      // {app} aur {company} hamesha apne aap bhar jate hain — har call par
      // bhejna nahi padta, aur kabhi bhoolne ka sawaal hi nahi.
      const values = { app: brand.name, company: brand.company, ...vars };

      return Object.keys(values).reduce(
        (result, name) => result.split(`{${name}}`).join(String(values[name])),
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
      languages,
    }),
    [t, language, languages]
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
