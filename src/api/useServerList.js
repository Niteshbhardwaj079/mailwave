import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, api, qs } from './client';

/**
 * Server se ek page jitni rows laata hai.
 *
 * Kyun zaroori hai
 * ----------------
 * Pehle poori list ek saath aati thi aur chhantai browser me hoti thi. 200
 * contacts par theek tha; 50,000 par server ki memory bharti hai aur browser
 * hang ho jata hai.
 *
 * Ab server sirf utni hi rows bhejta hai jitni screen par dikhni hain, aur
 * saath me ginti bhi ("kul 12,480 me se yeh 50"). Isliye 50,000 contacts par
 * bhi utni hi tezi rehti hai jitni 50 par.
 *
 * Iska jawab bilkul `usePagination` jaisa hi hai — page, pages, total, limit,
 * visible. Isliye jo screen pehle client-side pagination use kar rahi thi, use
 * badalne ke liye sirf yeh line badalni padti hai.
 *
 * @param {string} path    jaise '/api/contacts'
 * @param {object} options
 *        key          jawab me list kis naam se aati hai ('contacts')
 *        params       filter — { search, status, groupId }
 *        limit        ek page me kitni rows
 *        enabled      false ho to request jati hi nahi
 */
export function useServerList(path, { key, params = {}, limit: startLimit = 50, enabled = true } = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(startLimit);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  // Server ka poora jawab. Kuch screens ko list ke alawa bhi kuch chahiye
  // hota hai — jaise Campaigns page ko har status ki ginti.
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  // Filter ko ek text me badal lete hain. Object har render par naya banta hai,
  // isliye seedha use dependency banate to request bar-bar chal padti.
  const filterKey = JSON.stringify(params);

  // Kabhi-kabhi purani request nayi ke BAAD aati hai (dheema internet). Har
  // request ko ek number dete hain aur sirf sabse nayi ka jawab manate hain —
  // warna screen par purana data chipak jata hai.
  const latest = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Filter badla = shuru se dikhao. Page 8 par khade rehkar naya filter lagane
  // se khali screen dikhti hai.
  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const ticket = ++latest.current;
    setLoading(true);

    try {
      const data = await api.get(`${path}${qs({ ...JSON.parse(filterKey), page, limit })}`);

      if (!alive.current || ticket !== latest.current) return;

      setRows(data[key] ?? data.items ?? []);
      setTotal(data.total ?? 0);
      setRaw(data);
      setError(null);
    } catch (err) {
      if (!alive.current || ticket !== latest.current) return;

      // Permission nahi hai (403) — yeh galti nahi hai, us user ko yeh hissa
      // dikhna hi nahi chahiye. Khali list rakh dete hain.
      if (err instanceof ApiError && err.status === 403) {
        setRows([]);
        setTotal(0);
        setRaw(null);
        setError(null);
      } else {
        setError(err);
      }
    } finally {
      if (alive.current && ticket === latest.current) setLoading(false);
    }
  }, [path, key, filterKey, page, limit, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / limit));

  const changeLimit = useCallback((next) => {
    setLimit(next);
    setPage(1); // naya size = shuru se dikhao
  }, []);

  return useMemo(
    () => ({
      // usePagination jaise hi naam — screen ka code badalna na pade.
      visible: rows,
      /** Server ka poora jawab — list ke alawa jo bhi aaya ho. */
      raw,
      page,
      pages,
      total,
      limit,
      setPage,
      setLimit: changeLimit,
      reset: () => setPage(1),

      loading,
      error,
      reload: load,

      /** Screen par nayi row turant dikhane ke liye (server ka intezaar kiye bina). */
      setRows,
    }),
    [rows, raw, page, pages, total, limit, changeLimit, loading, error, load]
  );
}

export default useServerList;
