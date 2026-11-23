import React, { useState } from 'react';

interface Props {
  name: string;
  currentlySponsored: boolean;
  busy: boolean;
  onConfirm: (sponsored: boolean, sponsoredUntil?: string) => void;
  onCancel: () => void;
}

// Sponsorship is a paid placement boost that is switched on here after the
// payment has been received outside the app, so it always has an end date.
export function SponsorModal({ name, currentlySponsored, busy, onConfirm, onCancel }: Props) {
  const [until, setUntil] = useState('');
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">{currentlySponsored ? `Sponsorship for ${name}` : `Sponsor ${name}`}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {currentlySponsored ? 'Switch the boost off now, or give it a new end date.' : 'Gives this listing a boosted position until the date you choose. Do this after payment has been received.'}
        </p>
        <div className="field">
          <label>Boosted until</label>
          <input type="date" min={tomorrow} value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy || !until} onClick={() => onConfirm(true, new Date(`${until}T23:59:59Z`).toISOString())}>{currentlySponsored ? 'Update end date' : 'Turn on'}</button>
          {currentlySponsored ? <button className="btn btn-danger" disabled={busy} onClick={() => onConfirm(false)}>Turn off now</button> : null}
          <button className="btn btn-outline" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
