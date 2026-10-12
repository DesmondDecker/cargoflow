import PDFDocument from 'pdfkit';

export interface ReceiptPdfData {
  agencyName: string;
  agencyContactEmail?: string;
  agencyContactPhone?: string;
  agencyAddress?: string;
  receiptNumber: string;
  issuedAt: Date;
  importerName: string;
  importerPhone?: string;
  containerNumber?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentNotes?: string;
  issuedByName: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cheque: 'Cheque',
  other: 'Other',
};

export function formatAmount(amount: number, currency: string): string {
  // Intl.NumberFormat doesn't know 'SLE' (Sierra Leone's own currency code
  // isn't in every ICU locale data build), so this formats the number by
  // hand and prefixes the currency code rather than risk a thrown
  // RangeError on an unsupported code for a feature this central.
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

// Deliberately does NOT include an "Outstanding Balance" line, even though
// the original feature request asked for one. There's no invoice or
// expected-amount concept in this system yet (see ShipmentPayment's
// comment) — without one, "outstanding balance" has no real number to show,
// and a receipt is exactly the wrong place to put a fabricated 0 or a
// placeholder. That line can be added once invoicing/accounts-receivable
// exists to actually answer it.
export async function buildReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text(data.agencyName, { align: 'left' });
    doc.fontSize(9).font('Helvetica').fillColor('#555');
    if (data.agencyAddress) doc.text(data.agencyAddress);
    const contactLine = [data.agencyContactPhone, data.agencyContactEmail].filter(Boolean).join('  ·  ');
    if (contactLine) doc.text(contactLine);
    doc.fillColor('#000');

    doc.moveDown(1.5);
    doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Receipt No: ${data.receiptNumber}`, { continued: false });
    doc.text(`Date: ${data.issuedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`);

    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Received From');
    doc.font('Helvetica').text(data.importerName);
    if (data.importerPhone) doc.text(data.importerPhone);

    if (data.containerNumber) {
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').text('Shipment');
      doc.font('Helvetica').text(data.containerNumber);
    }

    doc.moveDown(1.2);
    doc.rect(50, doc.y, 495, 70).stroke();
    const boxTop = doc.y + 12;
    doc.font('Helvetica-Bold').fontSize(11).text('Amount Received', 65, boxTop);
    doc.fontSize(18).text(formatAmount(data.amount, data.currency), 65, boxTop + 16);
    doc.fontSize(10).font('Helvetica').text(
      `Payment Method: ${PAYMENT_METHOD_LABELS[data.paymentMethod] || data.paymentMethod}`,
      300,
      boxTop + 4
    );
    if (data.paymentNotes) doc.text(data.paymentNotes, 300, boxTop + 20, { width: 230 });
    doc.y = boxTop + 70;

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#555').text(`Issued by ${data.issuedByName}`, { align: 'left' });
    doc.text('This receipt documents a payment already recorded in CargoFlow.', { align: 'left' });

    doc.end();
  });
}
