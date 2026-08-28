import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const SESSION_KEY = 'mailwave.session';

/**
 * Demo sign-in.
 *
 * There is no backend yet, so the check happens here and the "session" is just
 * a name in localStorage. The point of this provider is not security — it is
 * that every screen already asks the same question ("is anyone signed in?")
 * through the same hook. When the real API arrives, only signIn() and the
 * stored shape change; no page has to be touched.
 */
export const DEMO_EMAIL = 'rohit@gowebkart.com';
export const DEMO_PASSWORD = 'mailwave';

const DEMO_USER = {
  id: 'u1',
  name: 'Rohit Sharma',
  email: DEMO_EMAIL,
  initials: 'RS',
};

const AuthContext = createContext(null);

function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.email ? parsed : null;
  } catch (error) {
    return null;
  }
}

function writeSession(user) {
  try {
    if (user) window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    // Storage blocked — the session simply will not survive a refresh.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  /** Returns true on success, false on a wrong email or password. */
  const signIn = useCallback((email, password) => {
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) return false;
    writeSession(DEMO_USER);
    setUser(DEMO_USER);
    return true;
  }, []);

  const signOut = useCallback(() => {
    writeSession(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isSignedIn: Boolean(user), signIn, signOut }),
    [user, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
