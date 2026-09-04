import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, api, lastRefreshWasExpired, refreshSession, setAccessToken } from '../api/client';

/**
 * Kaun sign in hai — asli server se.
 *
 * Token kahan rehta hai:
 *   - Access token sirf MEMORY me (localStorage me nahi). localStorage me pada
 *     token koi bhi script padh sakti hai.
 *   - Refresh token httpOnly cookie me hai — usse JavaScript chhu bhi nahi
 *     sakti. Page refresh hone par isi se naya access token mil jata hai.
 *
 * Isi wajah se app khulte hi ek "session check" chalta hai. Jab tak wo poora
 * na ho, `checking` true rehta hai — aur tab tak login screen NAHI dikhate,
 * warna har refresh par ek jhalak login ki dikhegi.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);

  /** Server ke jawab ko ek hi jagah se state me daalte hain. */
  const applySession = useCallback((payload) => {
    if (payload?.accessToken) setAccessToken(payload.accessToken);
    setUser(payload?.user ?? null);
    setRole(payload?.role ?? null);
  }, []);

  // App khulte hi: cookie hai to session wapas le aao.
  useEffect(() => {
    let alive = true;

    (async () => {
      // refreshSession() istemal karte hain, seedhi api call nahi. Wo poore app
      // me ek hi refresh promise baanta hai — warna do call ek saath jaakar
      // ek doosre ka token bekar kar deti hain aur session hi kat jata hai.
      // (React dev mode me yeh effect jaan-boojh kar do baar chalta hai.)
      let payload = await refreshSession();

      // Server vyast tha ya internet ne dhokha diya — session khatam nahi hua.
      // Ek baar aur koshish karte hain. Bina iske ek chhoti si dikkat par user
      // ka kaam beech me chhoot jata tha.
      if (!payload && !lastRefreshWasExpired()) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!alive) return;
        payload = await refreshSession();
      }

      if (!alive) return;

      // payload null hai = cookie nahi hai ya purani ho gayi, matlab sign in
      // nahi hai. Yeh galti nahi hai, bilkul normal haal hai.
      applySession(payload);
      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, [applySession]);

  /**
   * Sign in.
   * Lautata hai { ok } ya { ok: false, message } — screen par dikhane ke liye.
   */
  const signIn = useCallback(
    async (email, password) => {
      try {
        const payload = await api.post('/api/auth/login', { email, password }, { retry: false });
        applySession(payload);
        return { ok: true };
      } catch (error) {
        // Do alag halat hain: server ne mana kiya (ApiError - uska apna message
        // dikhate hain), ya server tak baat hi nahi pahunchi (network). Doosre
        // wale ke liye `network: true` bhejte hain taki screen apni bhasha me
        // sandesh dikha sake.
        if (error instanceof ApiError) return { ok: false, message: error.message };
        return { ok: false, network: true };
      }
    },
    [applySession]
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', undefined, { retry: false });
    } catch (error) {
      // Server tak na pahunche to bhi is browser se to nikalna hi hai.
    }
    applySession(null);
  }, [applySession]);

  /** Role ya permissions badalne par dobara le aao. */
  const reloadSession = useCallback(async () => {
    try {
      const payload = await api.get('/api/auth/me');
      setUser(payload?.user ?? null);
      setRole(payload?.role ?? null);
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      isSignedIn: Boolean(user),
      /** true jab tak pata na chale ki sign in hai ya nahi. */
      checking,
      signIn,
      signOut,
      reloadSession,
    }),
    [user, role, checking, signIn, signOut, reloadSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
