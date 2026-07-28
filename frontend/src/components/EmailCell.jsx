import StatusDot from './StatusDot';

export default function EmailCell({ email, reason }) {
  return (
    <span className="email-cell mono">
      <StatusDot reason={reason} />
      <span className="email-cell-text">{email}</span>
    </span>
  );
}
