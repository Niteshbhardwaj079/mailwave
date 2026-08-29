import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from './client';

/**
 * Server se data laata hai, aur teeno halat sambhalta hai:
 *
 *   loading — abhi aa raha hai   (screen par loader dikhao)
 *   error   — nahi aaya          (message + "dobara koshish karo")
 *   data    — aa gaya            (list dikhao)
 *
 * Do zaroori cheezein jo galat ho jati hain aur yahan sambhal li gayi hain:
 *
 * 1. Page band ho jaye aur jawab baad me aaye — us par setState karna React
 *    me galti hai. Isliye `alive` se check karte hain.
 *
 * 2. Tezi se filter badlo to purani request ka jawab BAAD me aa sakta hai aur
 *    nayi ka jawab mita sakta hai. Isliye har request ko ek number dete hain
 *    aur sirf sabse nayi ka jawab lete hain.
 *
 * Istemal:
 *   const { data, loading, error, reload } = useApi(`/api/contacts${qs({ page })}`);
 */
export function useApi(path, { enabled = true, deps = [] } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });

  const alive = useRef(true);
  const latest = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!path || !enabled) {
        setState({ data: null, loading: false, error: null });
        return null;
      }

      const ticket = latest.current + 1;
      latest.current = ticket;

      // quiet = dobara laate waqt purana data screen par rehne do, loader mat
      // dikhao. Isse list jhilmilati nahi.
      if (!quiet) setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const data = await api.get(path);
        // Beech me nayi request chali gayi — is purane jawab ko phenk do.
        if (!alive.current || ticket !== latest.current) return null;

        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        if (!alive.current || ticket !== latest.current) return null;

        setState({ data: null, loading: false, error });
        return null;
      }
    },
    [path, enabled]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return {
    ...state,
    /** Dobara laao — loader dikhate hue. */
    reload: load,
    /** Dobara laao — chupchap, purana data screen par rakhte hue. */
    refresh: () => load({ quiet: true }),
    /** Server ke jawab ka intezaar kiye bina screen par turant badlaav dikhana. */
    setData: (updater) =>
      setState((current) => ({
        ...current,
        data: typeof updater === 'function' ? updater(current.data) : updater,
      })),
  };
}

/**
 * Kuch bhejne ke liye (save, delete waghairah).
 *
 * Button ko `busy` mil jata hai, isliye do baar dabane par do baar nahi jata —
 * yeh duplicate record banne se bachata hai.
 *
 *   const save = useApiAction((body) => api.post('/api/contacts', body));
 *   <button disabled={save.busy} onClick={() => save.run(form)}>Save</button>
 */
export function useApiAction(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args) => {
      setBusy(true);
      setError(null);

      try {
        const result = await fn(...args);
        return { ok: true, data: result };
      } catch (caught) {
        if (alive.current) setError(caught);
        return { ok: false, error: caught };
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [fn]
  );

  return { run, busy, error, clearError: () => setError(null) };
}

export default useApi;
