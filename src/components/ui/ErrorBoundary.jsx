import { Component } from 'react';

/**
 * Agar kisi page me koi gadbad ho jaye, to poori app safed na ho jaye.
 *
 * React ka niyam hai: jo component render karte waqt error de, React use poore
 * app samet hata deta hai — screen bilkul khali (safed) reh jati hai, aur user
 * ko kuch samajh nahi aata ki hua kya.
 *
 * Yeh boundary us error ko yahin rok leti hai aur ek saaf screen dikhati hai
 * jisme "dobara koshish karo" ka button hota hai. Sidebar aur topbar apni jagah
 * bane rehte hain, isliye user kisi aur page par ja sakta hai.
 *
 * Yeh class component isliye hai kyunki React me error pakadne ka koi hook
 * abhi tak nahi hai — sirf class hi kar sakti hai.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Console me poora error, taki developer ko pata chale kya toota.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Yahan t() nahi use kar sakte: ho sakta hai error i18n me hi aaya ho.
    // Isliye seedha English — kam se kam kuch to dikhega.
    return (
      <div className="mw-crash" role="alert">
        <span className="mw-crash__icon" aria-hidden="true">
          <i className="bi bi-exclamation-triangle" />
        </span>

        <h2 className="mw-crash__title">Something on this page stopped working</h2>
        <p className="mw-crash__text">
          Your data is safe. Try again, or open another page from the menu.
        </p>

        <div className="mw-crash__actions">
          <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
            Try again
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => window.location.reload()}>
            Reload the app
          </button>
        </div>

        {/* Developer ke liye — dhoondhne me time na lage. */}
        <details className="mw-crash__details">
          <summary>Technical details</summary>
          <pre>{String(error?.stack || error?.message || error)}</pre>
        </details>
      </div>
    );
  }
}
