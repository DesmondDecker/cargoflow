import React, { useEffect, useState } from 'react';
import { fetchGatewayDevices, createGatewayDevice, deactivateGatewayDevice } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { GatewayDevice } from '../types';

function formatDate(value?: string): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function GatewayDevicesPage() {
  const [devices, setDevices] = useState<GatewayDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchGatewayDevices()
      .then(setDevices)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createGatewayDevice(newName.trim());
      setNewKey(result.apiKey);
      setNewName('');
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const onDeactivate = async (id: string) => {
    try {
      await deactivateGatewayDevice(id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <h1 className="page-title">Gateway Devices</h1>
      <p className="page-subtitle">
        The office phone(s) authorized to forward incoming Orange Money / AfriMoney SMS to CargoFlow. Register a device here,
        then configure the SMS-forwarding app on that phone with the key shown.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Register a New Device</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Device Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Front desk Android — Orange line" />
          </div>
          <button className="btn btn-primary" onClick={onCreate} disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'Create Device'}
          </button>
        </div>

        {newKey && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Copy this key now — it won't be shown again. Configure it as <code>X-Gateway-Key</code> on the forwarding device.
            </p>
            <div className="key-display">{newKey}</div>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : devices.length === 0 ? (
          <div className="empty-state">No gateway devices registered yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d._id}>
                  <td>{d.name}</td>
                  <td>
                    <span className={`badge status-${d.isActive ? 'active' : 'canceled'}`}>{d.isActive ? 'Active' : 'Deactivated'}</span>
                  </td>
                  <td>{formatDate(d.lastSeenAt)}</td>
                  <td>{formatDate(d.createdAt)}</td>
                  <td>
                    {d.isActive && (
                      <button className="btn btn-danger btn-sm" onClick={() => onDeactivate(d._id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
