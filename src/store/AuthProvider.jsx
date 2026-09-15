import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
 *
 * Session check ka jawaab teen tarah ka ho sakta hai:
 *   - safal          -> signed in.
 *   - 401             -> session sach me khatam/invalid. PAKKA jawaab, turant
 *                        login dikhao (kabhi retry nahi karte).
 *   - kuch aur (429/network/5xx) -> pata nahi. Yeh session ke bare me kuch
 *     nahi kehta — sirf itna ki abhi jawaab nahi mila. Isko 401 jaisa treat
 *     karke logout karna galat hai (session shayad abhi bhi valid ho). Bounded
 *     backoff ke saath thodi der dobara koshish karte hain; agar kabhi bhi
 *     pakka jawaab (401 ya safal) na mile, "signed out" bhi NAHI maante —
 *     bas ruk jaate hain, user khud "Try again" dabaa sake (RequireAuth.jsx).
 */
const AuthContext = createContext(null);

// Pehli koshish ke baad, sirf non-401 failure par — bounded backoff, taaki
// kabhi hamesha ke liye khud-ba-khud retry karte na rahen (rate limiter ko
// aur zyada bhaari banana khud hi galat hoga). 4 retries, ~15s total.
const REFRESH_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);
  // Pehli koshish 401 nahi thi (429/network) — bounded backoff ke saath
  // dobara koshish chal rahi hai. Sirf UI ke liye (RequireAuth "reconnecting"
  // dikhata hai, seedha login par nahi bhejta).
  const [reconnecting, setReconnecting] = useState(false);
  // Saari bounded retries khatam ho gayin aur kabhi koi pakka jawaab (401 ya
  // safal) nahi mila. Signed-in bhi nahi maante, signed-out bhi nahi —
  // RequireAuth ek "dobara koshish karein" screen dikhata hai.
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);

  /** Server ke jawab ko ek hi jagah se state me daalte hain. */
  const applySession = useCallback((payload) => {
    if (payload?.accessToken) setAccessToken(payload.accessToken);
    setUser(payload?.user ?? null);
    setRole(payload?.role ?? null);
  }, []);

  // Kis "run" ka result abhi bhi maayne rakhta hai — mount effect ka cleanup
  // isko badha deta hai, taaki us purani run ki koi bhi backoff-wait ke baad
  // ki state update chup-chap ignore ho jaaye (StrictMode dev me effect
  // jaan-boojh kar do baar chalta hai; manual "Try again" bhi ek nayi run
  // shuru karta hai jabki purani abhi khatam nahi hui thi).
  const runIdRef = useRef(0);

  /**
   * Session check ka poora, bounded process — pehla try + (zaroorat pade to)
   * bounded backoff retries. `useEffect` se (mount par) aur user ke "Try
   * again" click se (retrySessionCheck) dono se bulaya jata hai.
   */
  const runSessionCheck = useCallback(async () => {
    const myRunId = (runIdRef.current += 1);
    const stillCurrent = () => runIdRef.current === myRunId;

    setSessionCheckFailed(false);
    setReconnecting(false);

    let payload = await refreshSession();
    if (payload || lastRefreshWasExpired()) {
      // Pakka jawaab mil gaya (safal ya 401) — bina wajah retry nahi karte.
      if (!stillCurrent()) return;
      applySession(payload);
      setChecking(false);
      return;
    }

    // Pakka nahi pata (429/network/5xx). Ab tak ke liye "checking" hi rakhte
    // hain (isliye <LoginPage> abhi login form nahi dikhata — agar session
    // asal me valid nikli to user ko login ki ek jhalak bhi nahi dikhni
    // chahiye), lekin UI ko batate hain ki hum dobara koshish kar rahe hain.
    if (!stillCurrent()) return;
    setReconnecting(true);

    for (const delay of REFRESH_RETRY_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (!stillCurrent()) return;

      payload = await refreshSession();
      if (payload || lastRefreshWasExpired()) {
        if (!stillCurrent()) return;
        applySession(payload);
        setChecking(false);
        setReconnecting(false);
        return;
      }
      // Ab bhi pakka jawaab nahi — agle, bade backoff step par jaate hain.
    }

    // Bounded retries khatam — kabhi pakka jawaab nahi mila. "Signed out"
    // MAT maano (session shayad ab bhi valid ho) — bas ruk jao.
    if (!stillCurrent()) return;
    setChecking(false);
    setReconnecting(false);
    setSessionCheckFailed(true);
  }, [applySession]);

  // App khulte hi: cookie hai to session wapas le aao.
  useEffect(() => {
    runSessionCheck();
    return () => {
      // Isi run ke aage koi state update ab maayne nahi rakhta.
      runIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** User khud "Try again" dabaye (session check poori tarah fail hone ke baad). */
  const retrySessionCheck = useCallback(() => {
    setChecking(true);
    runSessionCheck();
  }, [runSessionCheck]);

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
      /** true jab pehli koshish 429/network se fail hui thi aur bounded backoff retries chal rahi hain. */
      reconnecting,
      /** true jab saari retries khatam ho gayin aur kabhi pakka jawaab (401 ya safal) nahi mila. */
      sessionCheckFailed,
      retrySessionCheck,
      signIn,
      signOut,
      reloadSession,
    }),
    [user, role, checking, reconnecting, sessionCheckFailed, retrySessionCheck, signIn, signOut, reloadSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
