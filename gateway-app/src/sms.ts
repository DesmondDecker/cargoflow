// The SMS library hands over each message as one string, "[sender, body]".
// The body can itself contain commas and brackets, so only the FIRST comma
// separates the sender.
export interface ParsedSms {
  address: string;
  message: string;
}

export function parseSmsEvent(raw: string): ParsedSms | null {
  const text = raw.trim();
  const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  const comma = inner.indexOf(',');
  if (comma < 1) return null;
  const address = inner.slice(0, comma).trim();
  const message = inner.slice(comma + 1).trim();
  return address && message ? { address, message } : null;
}

// Privacy rule: this phone also receives personal messages, so NOTHING is sent
// unless its sender matches a name or number listed in Settings. With no
// senders listed, nothing is forwarded.
export function shouldForward(address: string, senders: string[]): boolean {
  const wanted = senders.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return false;
  const a = address.trim().toLowerCase();
  return wanted.some((s) => a.includes(s));
}

// A short fingerprint, used to avoid sending the same message twice (the SMS
// library can deliver one message more than once).
export function fingerprint(address: string, message: string): string {
  let h = 5381;
  const s = `${address}|${message}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(16)}-${s.length}`;
}
