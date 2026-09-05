export function SearchInput({ value, onChange, placeholder = 'Search…', id }) {
  function handleChange(event) {
    onChange(event.target.value);
  }

  return (
    <div className="mw-search">
      <i className="bi bi-search mw-search__icon" aria-hidden="true" />
      <input
        id={id}
        type="search"
        className="mw-search__input"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function ChipGroup({ items, value, onChange, ariaLabel = 'Filters' }) {
  function handleClick(event) {
    onChange(event.currentTarget.dataset.value);
  }

  return (
    <div className="mw-chips" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          data-value={item.value}
          onClick={handleClick}
          className={`mw-chip ${item.value === value ? 'is-active' : ''}`.trim()}
        >
          {item.label}
          {item.count !== undefined ? <span className="mw-chip__count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ items, value, onChange, ariaLabel = 'View' }) {
  function handleClick(event) {
    onChange(event.currentTarget.dataset.value);
  }

  return (
    <div className="mw-segment" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          data-value={item.value}
          onClick={handleClick}
          className={`mw-segment__btn ${item.value === value ? 'is-active' : ''}`.trim()}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Zaroori field ke label ke aage laal * — sirf yahi bata deta hai ki bharna zaroori hai. */
export function Required() {
  return (
    <span className="mw-required" aria-hidden="true">
      *
    </span>
  );
}

export function Note({ tone = 'info', icon = 'bi-info-circle', children }) {
  return (
    <div className={`mw-note mw-note--${tone}`}>
      <i className={`bi ${icon} mw-note__icon`} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function KeyValue({ label, children }) {
  return (
    <div className="mw-kv">
      <span className="mw-kv__key">{label}</span>
      <span className="mw-kv__value">{children}</span>
    </div>
  );
}
