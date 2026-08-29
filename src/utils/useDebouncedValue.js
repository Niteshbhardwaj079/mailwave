import { useEffect, useState } from 'react';

/**
 * Value ko thoda ruk kar deta hai — type karte waqt screen atakti nahi.
 *
 * Dikkat kya thi: search box me har akshar par poori list chhanti thi. 10,000
 * contacts par ek akshar = 10,000 comparisons, aur wo bhi har keystroke par.
 * Isse type karna ruk-ruk kar lagta tha.
 *
 * Ab jo aap type karte ho wo turant box me dikhta hai (wo hamesha turant hona
 * chahiye), par CHHANTNA 200ms ruk kar hota hai. Aap "person" type karo to
 * chhantai 6 baar nahi, ek baar hoti hai.
 *
 * Istemal:
 *   const [query, setQuery] = useState('');
 *   const search = useDebouncedValue(query, 200);
 *   // box me `query` dikhao, chhantne me `search` use karo
 */
export function useDebouncedValue(value, delay = 200) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    // Chhoti list par rukne ka koi fayda nahi — turant kar do.
    if (delay <= 0) {
      setSettled(value);
      return undefined;
    }

    const timer = setTimeout(() => setSettled(value), delay);

    // Agla akshar aane par purana timer hata dete hain, isliye sirf aakhri
    // wala chalta hai.
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export default useDebouncedValue;
