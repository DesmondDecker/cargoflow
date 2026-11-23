import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));
vi.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

import { fingerprint, parseSmsEvent, shouldForward } from './sms';
import { enqueue, flush, getLog, getQueue } from './queue';

const config = { baseUrl: 'https://api.test/api/v1', apiKey: 'KEY', senders: ['OrangeMoney'] };
const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

beforeEach(() => store.clear());

describe('parseSmsEvent', () => {
  it('splits the sender from the body at the first comma only', () => {
    expect(parseSmsEvent('[OrangeMoney, You received SLE 1,500.00 from X. Txn: AB12CD34]')).toEqual({ address: 'OrangeMoney', message: 'You received SLE 1,500.00 from X. Txn: AB12CD34' });
  });
  it('handles a phone number sender and rejects junk', () => {
    expect(parseSmsEvent('[+23276123456, hello]')?.address).toBe('+23276123456');
    expect(parseSmsEvent('nonsense')).toBeNull();
    expect(parseSmsEvent('[, body]')).toBeNull();
  });
});

describe('shouldForward', () => {
  it('forwards only listed senders, case-insensitively', () => {
    expect(shouldForward('OrangeMoney', ['orangemoney'])).toBe(true);
    expect(shouldForward('Mum', ['OrangeMoney'])).toBe(false);
  });
  it('forwards nothing when no sender is listed', () => {
    expect(shouldForward('OrangeMoney', [])).toBe(false);
    expect(shouldForward('OrangeMoney', ['  '])).toBe(false);
  });
});

describe('queue and flush', () => {
  it('ignores a duplicate message', async () => {
    expect(await enqueue('OrangeMoney', 'SLE 100 Txn: AAAA1111')).toBe(true);
    expect(await enqueue('OrangeMoney', 'SLE 100 Txn: AAAA1111')).toBe(false);
    expect(await getQueue()).toHaveLength(1);
  });

  it('sends with the API key header and removes the message once the server has it', async () => {
    await enqueue('OrangeMoney', 'SLE 100 Txn: AAAA1111');
    const f = vi.fn().mockResolvedValue(res(201, { data: { matched: true } }));
    const r = await flush(config, f as unknown as typeof fetch);
    expect(r).toMatchObject({ sent: 1, kept: 0 });
    expect(f.mock.calls[0][0]).toBe('https://api.test/api/v1/gateway/sms-notifications');
    expect(f.mock.calls[0][1].headers['X-API-Key']).toBe('KEY');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ message: 'SLE 100 Txn: AAAA1111' });
    expect(await getQueue()).toHaveLength(0);
    expect((await getLog())[0]).toMatchObject({ status: 'sent', detail: 'matched a pending payment' });
  });

  it('keeps everything queued when offline, when the server is down, or when the key is wrong', async () => {
    await enqueue('OrangeMoney', 'one');
    await enqueue('OrangeMoney', 'two');
    expect((await flush(config, (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).problem).toBe('network');
    expect((await flush(config, (async () => res(503)) as unknown as typeof fetch)).problem).toBe('server');
    expect((await flush(config, (async () => res(401)) as unknown as typeof fetch)).problem).toBe('auth');
    expect(await getQueue()).toHaveLength(2);
  });

  it('drops a message the server refuses as invalid, and carries on with the rest', async () => {
    await enqueue('OrangeMoney', 'bad');
    await enqueue('OrangeMoney', 'good');
    const f = vi.fn().mockResolvedValueOnce(res(400)).mockResolvedValueOnce(res(201, { data: {} }));
    expect(await flush(config, f as unknown as typeof fetch)).toMatchObject({ sent: 1, refused: 1, kept: 0 });
  });

  it('does nothing until it is configured', async () => {
    await enqueue('OrangeMoney', 'one');
    expect((await flush({ ...config, apiKey: '' })).problem).toBe('not_configured');
    expect(await getQueue()).toHaveLength(1);
  });
});

describe('fingerprint', () => {
  it('differs for different messages and matches for identical ones', () => {
    expect(fingerprint('a', 'x')).toBe(fingerprint('a', 'x'));
    expect(fingerprint('a', 'x')).not.toBe(fingerprint('a', 'y'));
  });
});
