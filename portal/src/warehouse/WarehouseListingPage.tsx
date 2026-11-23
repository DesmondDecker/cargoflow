import React, { useEffect, useState } from 'react';
import { AMENITIES, addPhotos, updateCapacity, updateListing, uploadPhoto } from './wapi';
import { useWarehouseStore } from './wstore';
import { apiErrorMessage } from '../api/client';

const STATUS_TEXT = {
  unverified: 'Not verified yet. Agencies cannot see this warehouse until a Cargo Flow admin verifies it.',
  pending: 'Waiting for a Cargo Flow admin to verify it.',
  verified: 'Verified. Agencies can find and book this warehouse while it is switched on and has space.',
  rejected: 'Not approved. Contact Cargo Flow to find out why.',
};

export function WarehouseListingPage() {
  const warehouse = useWarehouseStore((s) => s.warehouse);
  const setWarehouse = useWarehouseStore((s) => s.setWarehouse);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [total, setTotal] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!warehouse) return;
    setName(warehouse.businessName);
    setLocation(warehouse.location);
    setPrice(String(warehouse.pricePerUnitPerDay));
    setAmenities(warehouse.amenities);
    setTotal(String(warehouse.totalCapacity));
  }, [warehouse]);

  if (!warehouse) return null;
  const unit = warehouse.capacityUnit === 'sqm' ? 'sqm' : 'container slots';

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-title">My listing</h1>
      <div className={`notice`} style={warehouse.verificationStatus === 'verified' ? { background: '#E6F6EC', color: '#1B5E30' } : undefined}>{STATUS_TEXT[warehouse.verificationStatus]}</div>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p style={{ color: '#1B7F3B' }}>{message}</p> : null}

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <div className="card-title">Details</div>
        <div className="field"><label>Business name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <div className="field"><label>Price per {warehouse.capacityUnit === 'sqm' ? 'sqm' : 'container slot'} per day (SLE)</label><input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field">
          <label>What you offer</label>
          {AMENITIES.map((a) => (
            <label key={a.key} style={{ display: 'block', fontSize: 14, fontWeight: 400 }}>
              <input type="checkbox" checked={amenities.includes(a.key)} onChange={() => setAmenities((cur) => (cur.includes(a.key) ? cur.filter((k) => k !== a.key) : [...cur, a.key]))} /> {a.label}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => setWarehouse(await updateListing({ businessName: name.trim(), location: location.trim(), pricePerUnitPerDay: Number(price), amenities })), 'Listing saved.')}>Save details</button>
      </div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <div className="card-title">Space</div>
        <p style={{ fontSize: 14 }}>{warehouse.availableCapacity} of {warehouse.totalCapacity} {unit} free right now. Accepting a booking uses space; checking goods out gives it back.</p>
        <div className="field"><label>Total space ({unit})</label><input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
        <button className="btn btn-outline" disabled={busy} onClick={() => run(async () => setWarehouse(await updateCapacity(Number(total))), 'Space updated.')}>Update total space</button>
      </div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <div className="card-title">Availability</div>
        <p style={{ fontSize: 14 }}>{warehouse.isActive ? 'Your listing is switched on.' : 'Your listing is switched off, so agencies cannot find it.'}</p>
        <button className="btn btn-outline" disabled={busy} onClick={() => run(async () => setWarehouse(await updateListing({ isActive: !warehouse.isActive })), warehouse.isActive ? 'Listing switched off.' : 'Listing switched on.')}>{warehouse.isActive ? 'Switch listing off' : 'Switch listing on'}</button>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <div className="card-title">Photos</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {warehouse.photos.length === 0 ? <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No photos yet.</span> : null}
          {warehouse.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 6 }} /></a>)}
        </div>
        <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) run(async () => setWarehouse(await addPhotos(await Promise.all(files.map((f) => uploadPhoto('warehouse_photo', f))))), 'Photos added.');
          e.target.value = '';
        }} />
      </div>
    </>
  );
}
