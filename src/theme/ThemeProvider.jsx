import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { appConfig } from '../config/appConfig';
import { ACCENTS, findAccent } from '../config/themeColors';

const MODE_KEY = 'mailwave.theme';
const ACCENT_KEY = 'mailwave.accent';

const ThemeContext = createContext(null);

function read(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch (error) {
    return fallback;
  }
}

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => read(MODE_KEY, appConfig.defaultTheme));
  const [accent, setAccent] = useState(() => read(ACCENT_KEY, appConfig.defaultAccent));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Follow the computer's own setting while the user is on "system"
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    function handleChange(event) {
      setSystemDark(event.matches);
    }

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.dataset.accent = accent;
    // Bootstrap 5.3 reads this one for its own components
    root.dataset.bsTheme = isDark ? 'dark' : 'light';

    try {
      window.localStorage.setItem(MODE_KEY, mode);
      window.localStorage.setItem(ACCENT_KEY, accent);
    } catch (error) {
      // Storage blocked — the choice just will not survive a refresh.
    }
  }, [isDark, accent, mode]);

  // Browser tab title comes from the same config as the sidebar name
  useEffect(() => {
    document.title = `${appConfig.name} — ${appConfig.titleSuffix}`;
  }, []);

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      isDark,
      toggle,
      accent,
      setAccent,
      accentHex: findAccent(accent).hex,
      accents: ACCENTS,
    }),
    [mode, isDark, toggle, accent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
