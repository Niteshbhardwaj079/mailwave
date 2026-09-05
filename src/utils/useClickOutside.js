import { useEffect } from 'react';

/**
 * Kisi bhi dropdown/panel ko bahar click karte hi band kar deta hai.
 *
 * `active` false ho to kuch nahi karta — panel band hone par listener lagane
 * ki zarurat nahi.
 */
export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onOutside();
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [active, ref, onOutside]);
}

export default useClickOutside;
