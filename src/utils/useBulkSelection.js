import { useCallback, useMemo, useState } from 'react';

/**
 * Table ke tick-box sambhalta hai — pagination ke saath.
 *
 * Do alag list leta hai, aur yahi is file ka poora point hai:
 *
 *   pageIds — abhi screen par jo rows dikh rahi hain (jaise 50)
 *   allIds  — filter se jitni bhi rows match ho rahi hain (jaise 300)
 *
 * Header ka tick-box SIRF is page ko chunta hai. Poori 300 chunni ho to upar
 * aane wale bar me "Select all 300" alag se dabana padta hai.
 *
 * Aisa kyun? Kyunki "select all" dabakar mail bhejna ya delete karna aisa kaam
 * hai jo wapas nahi hota. User ko saaf pata hona chahiye ki 50 chune hain ya
 * 300 — andaza nahi lagana chahiye.
 */
export function useBulkSelection(pageIds, allIds) {
  const [selected, setSelected] = useState(() => new Set());

  // allIds na diya ho to purana vyavhar: sirf page hi sab kuch hai.
  const everything = allIds ?? pageIds;

  /**
   * Sirf wahi chune hue id jo ab bhi filter me hain.
   *
   * Zaroori hai: aapne 300 chune, phir filter badal diya jisme sirf 20 bache.
   * Ab "Send" dabao to sirf wahi 20 jaane chahiye — wo 280 nahi jinhe aap ab
   * dekh bhi nahi rahe.
   */
  const selectedIds = useMemo(
    () => everything.filter((id) => selected.has(id)),
    [everything, selected]
  );

  const pageSelected = useMemo(
    () => pageIds.filter((id) => selected.has(id)),
    [pageIds, selected]
  );

  const allPageSelected = pageIds.length > 0 && pageSelected.length === pageIds.length;
  const somePageSelected = pageSelected.length > 0 && !allPageSelected;

  /** Poori matching list chuni hui hai? */
  const allSelected = everything.length > 0 && selectedIds.length === everything.length;

  const toggleOne = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Header ka tick-box — sirf is page ko chunta/hatata hai. */
  const toggleAllVisible = useCallback(() => {
    setSelected((current) => {
      const next = new Set(current);
      const everyOnPage = pageIds.every((id) => next.has(id));
      pageIds.forEach((id) => {
        if (everyOnPage) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }, [pageIds]);

  /** "Select all 300" — filter se match hone wali SAARI rows. */
  const selectAll = useCallback(() => {
    setSelected(new Set(everything));
  }, [everything]);

  /**
   * Jo id di gayi hain, bilkul wahi chuno.
   *
   * Yeh tab kaam aata hai jab id server se aate hain — jaise "Select all
   * 12,480" par, jahan screen ke paas sirf 50 id hote hain aur baaki server se
   * mangwane padte hain.
   */
  const selectExactly = useCallback((ids) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id) => selected.has(id), [selected]);

  return {
    selectedIds,
    /** Kitne chune hain — poori list me, sirf is page me nahi. */
    count: selectedIds.length,
    /** Filter se kitni rows match ho rahi hain. */
    total: everything.length,

    allPageSelected,
    somePageSelected,
    allSelected,

    toggleOne,
    toggleAllVisible,
    selectAll,
    selectExactly,
    clear,
    isSelected,

    // Purane naam, taki jo code pehle se inhe use kar raha hai wo na tootey.
    allVisibleSelected: allPageSelected,
    someVisibleSelected: somePageSelected,
    selectAllVisible: selectAll,
  };
}

export default useBulkSelection;
