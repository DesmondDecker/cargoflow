import React, { useCallback, useEffect, useState } from 'react';
import { Booking, BookingStatus, checkIn, checkOut, fetchBookings, respond, uploadPhoto } from './wapi';
import { apiErrorMessage } from '../api/client';
import { fmt } from '../utils';

const FILTERS: { key: 'all' | BookingStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'requested', label: 'Requests' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_storage', label: 'In storage' },
  { key: 'collected', label: 'Collected' },
  { key: 'declined', label: 'Declined' },
  { key: 'cancelled', label: 'Cancelled' },
];
const LABEL: Record<BookingStatus, string> = { requested: 'Needs your answer', confirmed: 'Confirmed', in_storage: 'In storage', collected: 'Collected', declined: 'Declined', cancelled: 'Cancelled by the agency' };
const day = (v: string) => new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function ConditionForm({ title, onSubmit, onCancel, busy }: { title: string; onSubmit: (notes: string, files: File[]) => void; onCancel: () => void; busy: boolean }) {
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div className="card" style={{ marginTop: 8, background: 'rgba(0,0,0,0.02)' }}>
      <div className="card-title" style={{ fontSize: 14 }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Record the state of the goods now. Photos and notes are kept with the booking, so both sides have the same record.</p>
      <div className="field"><label>Notes (condition, seals, damage, anything unusual)</label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%' }} /></div>
      <div className="field"><label>Photos (optional)</label><input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></div>
      <div className="actions" style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onSubmit(notes, files)}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="btn btn-outline btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function WarehouseBookingsPage() {
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [items, setItems] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string; kind: 'in' | 'out' } | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchBookings(filter === 'all' ? undefined : filter));
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, [filter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      setForm(null);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const record = (b: Booking, kind: 'in' | 'out') => (notes: string, files: File[]) =>
    run(b._id, async () => {
      const photoUrls = await Promise.all(files.map((f) => uploadPhoto('storage_condition_photo', f)));
      const input = { notes: notes.trim() || undefined, photoUrls: photoUrls.length ? photoUrls : undefined };
      if (kind === 'in') await checkIn(b._id, input);
      else await checkOut(b._id, input);
    });

  const waiting = items.filter((b) => b.status === 'requested').length;

  return (
    <>
      <h1 className="page-title">Bookings</h1>
      <p className="page-subtitle">{waiting > 0 ? `${waiting} request${waiting === 1 ? '' : 's'} waiting for your answer.` : 'Requests from clearing agents appear here and refresh by themselves.'}</p>
      <div className="tabs">
        {FILTERS.map((f) => <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {items.length === 0 ? <div className="card"><div className="empty-state">No bookings here.</div></div> : null}
      {items.map((b) => (
        <div className="card" key={b._id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong>{b.containerId?.containerNumber ?? 'Container'}</strong> · {b.agencyId?.name ?? 'Agency'}
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{b.unitsBooked} units · {day(b.startDate)} to {day(b.endDate)} · estimated SLE {b.estimatedTotalPrice.toLocaleString()}</div>
              {b.contactName || b.contactPhone ? <div style={{ fontSize: 13 }}>Contact: {b.contactName} {b.contactPhone}</div> : null}
              {b.notes ? <div style={{ fontSize: 13 }}>Note: {b.notes}</div> : null}
            </div>
            <span className={`badge status-${b.status === 'requested' ? 'pending' : b.status === 'declined' || b.status === 'cancelled' ? 'returned' : 'approved'}`}>{LABEL[b.status]}</span>
          </div>
          {b.checkIn?.completedAt ? <div style={{ fontSize: 13, marginTop: 6 }}>Checked in {fmt(b.checkIn.completedAt)}{b.checkIn.notes ? `: ${b.checkIn.notes}` : ''} {b.checkIn.photoUrls?.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer">[photo {i + 1}] </a>)}</div> : null}
          {b.checkOut?.completedAt ? <div style={{ fontSize: 13 }}>Checked out {fmt(b.checkOut.completedAt)}{b.checkOut.notes ? `: ${b.checkOut.notes}` : ''} {b.checkOut.photoUrls?.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer">[photo {i + 1}] </a>)}</div> : null}

          {b.status === 'requested' ? (
            <div className="actions">
              <button className="btn btn-primary btn-sm" disabled={busyId === b._id} onClick={() => run(b._id, () => respond(b._id, 'accept'))}>Accept</button>
              <button className="btn btn-outline btn-sm" disabled={busyId === b._id} onClick={() => { if (window.confirm('Decline this request?')) run(b._id, () => respond(b._id, 'decline')); }}>Decline</button>
            </div>
          ) : null}
          {b.status === 'confirmed' && form?.id !== b._id ? <div className="actions"><button className="btn btn-primary btn-sm" onClick={() => setForm({ id: b._id, kind: 'in' })}>Check the goods in</button></div> : null}
          {b.status === 'in_storage' && form?.id !== b._id ? <div className="actions"><button className="btn btn-primary btn-sm" onClick={() => setForm({ id: b._id, kind: 'out' })}>Check the goods out</button></div> : null}
          {form?.id === b._id ? <ConditionForm title={form.kind === 'in' ? 'Check in' : 'Check out'} busy={busyId === b._id} onCancel={() => setForm(null)} onSubmit={record(b, form.kind)} /> : null}
        </div>
      ))}
    </>
  );
}
