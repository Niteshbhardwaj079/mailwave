export default function EmptyState({ icon = 'bi-inbox', title, text, action }) {
  return (
    <div className="mw-empty">
      <span className="mw-empty__icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <h3 className="mw-empty__title">{title}</h3>
      {text ? <p className="mw-empty__text">{text}</p> : null}
      {action}
    </div>
  );
}
