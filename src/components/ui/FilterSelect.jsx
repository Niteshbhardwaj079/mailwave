/**
 * One labelled dropdown. Every filter in the app uses this, so filters look
 * and behave the same everywhere and stay usable on a small phone screen.
 */
export default function FilterSelect({ id, label, value, onChange, options, icon }) {
  function handleChange(event) {
    onChange(event.target.value);
  }

  return (
    <div className="mw-filter">
      <label className="mw-filter__label" htmlFor={id}>
        {icon ? <i className={`bi ${icon}`} aria-hidden="true" /> : null}
        {label}
      </label>
      <select id={id} className="form-select mw-filter__select" value={value} onChange={handleChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.count !== undefined ? ` (${option.count})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterBar({ children, onClear, clearLabel }) {
  return (
    <div className="mw-filterbar">
      {children}
      {onClear ? (
        <button type="button" className="btn btn-outline-secondary btn-sm mw-filterbar__clear" onClick={onClear}>
          <i className="bi bi-x-circle me-2" />
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}
