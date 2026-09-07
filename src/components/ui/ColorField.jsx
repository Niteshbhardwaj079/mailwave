/**
 * Ek color picker + uska hex text, dono ek saath — kisi bhi form me color
 * chunne ka istemal-me-aasan tareeka. Koi maujooda component isse nahi karta
 * tha, isliye yeh chhota reusable piece.
 */
export default function ColorField({ id, label, value, onChange, help }) {
  function handlePicker(event) {
    onChange(event.target.value);
  }

  function handleText(event) {
    const next = event.target.value;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(next)) onChange(next);
    else onChange(next); // let them keep typing; invalid hex just won't repaint the swatch
  }

  return (
    <div>
      {label ? (
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="mw-row" style={{ gap: 8 }}>
        <input
          type="color"
          id={id}
          className="form-control form-control-color"
          value={/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : '#000000'}
          onChange={handlePicker}
          style={{ width: 44, height: 38, padding: 2 }}
        />
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={handleText}
          maxLength={7}
          style={{ maxWidth: 120 }}
        />
      </div>
      {help ? <p className="form-text mb-0">{help}</p> : null}
    </div>
  );
}
