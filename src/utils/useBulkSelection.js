import { useCallback, useMemo, useState } from 'react';

/**
 * Tick-boxes for a table. Keeps the selection as a Set of ids and gives back
 * everything a bulk action bar needs.
 */
export function useBulkSelection(visibleIds) {
  const [selected, setSelected] = useState(() => new Set());

  const visibleSelected = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected]
  );

  const allVisibleSelected = visibleIds.length > 0 && visibleSelected.length === visibleIds.length;
  const someVisibleSelected = visibleSelected.length > 0 && !allVisibleSelected;

  const toggleOne = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelected((current) => {
      const next = new Set(current);
      const everySelected = visibleIds.every((id) => next.has(id));
      visibleIds.forEach((id) => {
        if (everySelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }, [visibleIds]);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visibleIds));
  }, [visibleIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  return {
    selected,
    selectedIds: Array.from(selected),
    count: visibleSelected.length,
    allVisibleSelected,
    someVisibleSelected,
    toggleOne,
    toggleAllVisible,
    selectAllVisible,
    clear,
    isSelected,
  };
}

export default useBulkSelection;
