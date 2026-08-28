const TONE_BY_STATUS = {
  Sent: 'success',
  Delivered: 'success',
  Opened: 'info',
  Clicked: 'success',
  Sending: 'primary',
  Scheduled: 'info',
  Draft: 'muted',
  Paused: 'warning',
  Failed: 'danger',
  Bounced: 'warning',
  Unsubscribed: 'muted',
  Subscribed: 'success',
  Connected: 'success',
  'Needs attention': 'warning',
  Pending: 'warning',
};

export default function StatusPill({ status, tone, withDot = true }) {
  const resolved = tone || TONE_BY_STATUS[status] || 'muted';
  return (
    <span className={`mw-status mw-status--${resolved}`}>
      {withDot ? <span className="mw-status__dot" aria-hidden="true" /> : null}
      {status}
    </span>
  );
}
