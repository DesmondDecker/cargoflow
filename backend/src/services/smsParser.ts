export interface ParsedMobileMoneyMessage {
  provider?: 'orange_money' | 'afrimoney';
  amount?: number;
  transactionId?: string;
  counterpartyPhone?: string;
}

// Real regex-based parsing, but tuned only against publicly documented
// Orange Money / Afrimoney SMS formats — NOT verified against actual
// captured messages from a live gateway device, since none were available
// here. Treat this as a first pass: once real SMS samples come in via
// MobileMoneyNotification.rawMessage, tighten these patterns against them.
export function parseMobileMoneyMessage(raw: string): ParsedMobileMoneyMessage {
  const text = raw.trim();
  const result: ParsedMobileMoneyMessage = {};

  if (/orange\s*money/i.test(text)) result.provider = 'orange_money';
  else if (/afrimoney/i.test(text)) result.provider = 'afrimoney';

  const amountMatch = /(?:SLE|Le|NLe)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(text);
  if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

  const txnMatch = /(?:txn|transaction|ref(?:erence)?)[\s:#-]*([A-Z0-9]{6,})/i.exec(text);
  if (txnMatch) result.transactionId = txnMatch[1];

  const phoneMatch = /(?:from|by)\s*(\+?\d{8,12})/i.exec(text);
  if (phoneMatch) result.counterpartyPhone = phoneMatch[1];

  return result;
}
