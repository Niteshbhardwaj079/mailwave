/**
 * Shows the template's raw HTML the way an email app would.
 *
 * It renders inside a sandboxed <iframe> instead of injecting the markup into
 * the page. That gives two things for free:
 *   1. the app's own CSS cannot change how the email looks, so the preview is honest
 *   2. any script inside pasted HTML cannot run
 */
export default function HtmlPreview({ html, device = 'desktop', full = false, title = 'Email preview' }) {
  // Deliberately not called `document` — that would shadow the global one for
  // the whole component.
  const srcDocument = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #ffffff; }
      img { max-width: 100%; }
    </style>
  </head>
  <body>${html || ''}</body>
</html>`;

  const wrapClass = [
    'mw-framewrap',
    device === 'mobile' ? 'mw-framewrap--mobile' : '',
    full ? 'mw-framewrap--full' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <div className="mw-framewrap__inner">
        <iframe className="mw-frame" title={title} srcDoc={srcDocument} sandbox="" />
      </div>
    </div>
  );
}
