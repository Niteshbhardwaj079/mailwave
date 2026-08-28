import { useMemo, useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import { formatNumber } from '../../utils/format';

/**
 * Table ke niche wala page-by-page control.
 *
 * Kyun zaroori hai: 10,000 rows ek saath dikhane se browser hang ho jata hai.
 * Aur agar hum chup-chap sirf pehle 500 dikha dein, to baaki 9,500 gayab —
 * kisi ko pata bhi nahi chalega. Isliye har table par ginti + page dikhte hain.
 */

/**
 * Kaun se page numbers dikhane hain.
 *
 * 200 page hon to 200 button nahi dikha sakte. Isliye: pehla, aakhri, aur
 * abhi wale ke aas-paas ke — beech me "…".
 *
 *   1 … 7 [8] 9 … 200
 */
function pageWindow(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const items = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);

  if (from > 2) items.push('gap-start');
  for (let i = from; i <= to; i += 1) items.push(i);
  if (to < pages - 1) items.push('gap-end');

  items.push(pages);
  return items;
}

export default function Pagination({
  page,
  pages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  perPageOptions = [25, 50, 100],
}) {
  const t = useT();

  const numbers = useMemo(() => pageWindow(page, pages), [page, pages]);

  // Ek hi page hai aur kuch bhi nahi dikhana — to control chhupa do.
  if (pages <= 1 && total <= (perPageOptions[0] ?? 25)) return null;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  function go(next) {
    const target = Math.min(pages, Math.max(1, next));
    if (target !== page) onPageChange(target);
  }

  return (
    <nav className="mw-pager" aria-label={t('page.label')}>
      <p className="mw-pager__count">
        {t('page.showing', {
          from: formatNumber(from),
          to: formatNumber(to),
          total: formatNumber(total),
        })}
      </p>

      <div className="mw-pager__controls">
        {onLimitChange ? (
          <label className="mw-pager__perpage">
            <span className="mw-pager__perpage-label">{t('page.perPage')}</span>
            <select
              className="form-select form-select-sm"
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            >
              {perPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mw-pager__pages">
          <button
            type="button"
            className="mw-pager__btn"
            onClick={() => go(page - 1)}
            disabled={page <= 1}
            aria-label={t('page.prev')}
          >
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </button>

          {numbers.map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                className={`mw-pager__btn ${item === page ? 'is-active' : ''}`.trim()}
                onClick={() => go(item)}
                // Screen reader ko batata hai ki abhi kaun sa page khula hai.
                aria-current={item === page ? 'page' : undefined}
              >
                {formatNumber(item)}
              </button>
            ) : (
              <span key={item} className="mw-pager__gap" aria-hidden="true">
                …
              </span>
            )
          )}

          <button
            type="button"
            className="mw-pager__btn"
            onClick={() => go(page + 1)}
            disabled={page >= pages}
            aria-label={t('page.next')}
          >
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}

/**
 * Jab tak data browser me hi hai (API se nahi aa raha), yeh hook usi array ko
 * page-by-page kaat deta hai.
 *
 * Baad me API se aane lagega to sirf itna karna hoga: `items` ki jagah server
 * se aayi rows, aur `total` server se — baaki sab waisa hi.
 */
export function usePagination(items, defaultLimit = 25) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));

  // Filter lagane par list chhoti ho sakti hai. Agar hum page 8 par the aur ab
  // sirf 2 page bache hain, to khali screen dikhegi — isliye wapas le aate hain.
  const safePage = Math.min(page, pages);

  const visible = useMemo(
    () => items.slice((safePage - 1) * limit, safePage * limit),
    [items, safePage, limit]
  );

  function changeLimit(next) {
    setLimit(next);
    setPage(1); // naya size = shuru se dikhao
  }

  return {
    page: safePage,
    pages,
    total,
    limit,
    visible,
    setPage,
    setLimit: changeLimit,
    /** Search ya filter badalne par shuru se dikhao. */
    reset: () => setPage(1),
  };
}
