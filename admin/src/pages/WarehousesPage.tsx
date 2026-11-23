import React, { useCallback, useEffect, useState } from 'react';
import { fetchWarehouses, setWarehouseSponsorship, setWarehouseVerification } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { Warehouse } from '../types';
import { SponsorModal } from '../components/SponsorModal';

const day = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Warehouses that have signed up to list storage space. Agencies only find
// verified ones, so verification happens here.
export function WarehousesPage() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sponsorTarget, setSponsorTarget] = useState<Warehouse | null>(null);

  const load = useCallback(async (q?: string) => {
    try {
      setItems(await fetchWarehouses(q || undefined));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const run = async (id: string, action: () => Promise<void>, done: string) => {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      await load(search);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Warehouses</h1>
      <p className="page-subtitle">Verify warehouses before agencies can find them, and manage paid boosts.</p>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p style={{ color: 'var(--success, #1B7F3B)' }}>{message}</p> : null}
      <div className="toolbar"><input className="field" style={{ maxWidth: 320, padding: 8 }} placeholder="Search name, owner or phone…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="card">
        {items.length === 0 ? <div className="empty-state">No warehouses.</div> : (
          <table className="data">
            <thead><tr><th>Warehouse</th><th>Owner</th><th>Capacity</th><th>Verification</th><th>Boost</th><th /></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w._id}>
                  <td><strong>{w.businessName}</strong><br /><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{w.location}</span></td>
                  <td>{w.ownerName}<br /><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{w.phone}</span></td>
                  <td>{w.availableCapacity ?? '—'} / {w.totalCapacity ?? '—'} {w.capacityUnit ?? ''}</td>
                  <td style={{ textTransform: 'capitalize' }}>{w.verificationStatus}</td>
                  <td>{w.sponsored ? `Until ${day(w.sponsoredUntil)}` : 'None'}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {w.verificationStatus !== 'verified' ? <button className="btn btn-outline btn-sm" disabled={busyId === w._id} onClick={() => run(w._id, () => setWarehouseVerification(w._id, 'verified'), `${w.businessName} is verified.`)}>Verify</button> : null}
                    {w.verificationStatus !== 'rejected' ? <button className="btn btn-outline btn-sm" disabled={busyId === w._id} onClick={() => run(w._id, () => setWarehouseVerification(w._id, 'rejected'), `${w.businessName} was rejected.`)}>Reject</button> : null}
                    <button className="btn btn-outline btn-sm" disabled={busyId === w._id} onClick={() => setSponsorTarget(w)}>{w.sponsored ? 'Boost' : 'Sponsor'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {sponsorTarget ? (
        <SponsorModal
          name={sponsorTarget.businessName}
          currentlySponsored={!!sponsorTarget.sponsored}
          busy={busyId === sponsorTarget._id}
          onCancel={() => setSponsorTarget(null)}
          onConfirm={async (on, until) => {
            const t = sponsorTarget;
            await run(t._id, () => setWarehouseSponsorship(t._id, on, until), on ? `${t.businessName} is boosted until ${day(until)}.` : `${t.businessName} is no longer boosted.`);
            setSponsorTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
