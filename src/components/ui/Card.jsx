export function Card({ children, className = '', flush = false }) {
  const classes = ['mw-card', flush ? 'mw-card--flush' : '', className].filter(Boolean).join(' ');
  return <section className={classes}>{children}</section>;
}

export function CardHead({ title, subtitle, tools }) {
  return (
    <div className="mw-card__head">
      <div>
        <h2 className="mw-card__title">{title}</h2>
        {subtitle ? <p className="mw-card__sub">{subtitle}</p> : null}
      </div>
      {tools ? <div className="mw-card__tools">{tools}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={`mw-card__body ${className}`.trim()}>{children}</div>;
}

export function CardFoot({ children, className = '' }) {
  return <div className={`mw-card__foot ${className}`.trim()}>{children}</div>;
}
