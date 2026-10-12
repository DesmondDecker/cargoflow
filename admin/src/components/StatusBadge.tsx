export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" style={{ background: 'currentColor' }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
