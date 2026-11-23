# Cargo Flow: Customs verification portal

Web portal for the two institutions in the customs-verification handoff:

- **Customs officers** see the review queue (oldest first), open a record, check it against Customs' own records, and **approve** it or **return** it for correction with a reason. They can also enter a record for an agent who cannot submit one (it joins the same queue), and see approved records and reports.
- **AGL users** see **approved** records (read-only), search them, download them as CSV, and see reports. AGL is also emailed automatically on each approval.

**Warehouse owners** use the same app at `/warehouse`: they sign up, keep their listing, price and space up to date, answer storage requests from clearing agents (accept or decline), and record the state of goods at check-in and check-out with notes and photos. A Cargo Flow admin verifies new warehouses (admin dashboard > Warehouses); agencies only see verified ones.

Clearing agents submit from the Cargo Flow agency app (More > Customs Verification, or Submit to Customs on a container).

## What is recorded

Exactly six fields: CVC number, bill of lading number, shipping agency, container number, document name, ITS number. Every record keeps a history of who did what and when (submitted, approved, returned, corrected, email sent or failed). Approval gives a reference like `CV-2026-000042`. Approval is final and single-level: a decided record is never decided again, and a returned record is corrected by the agent and resubmitted.

Cargo Flow does not verify duty payments, does not decide anything for the officer, and does not touch AGL's systems.

## Accounts

There is no self-registration. A Cargo Flow platform admin creates named Customs and AGL users in the admin dashboard (Customs & AGL users). Sessions end when the browser tab closes.

## Run

```
cd portal
npm install
VITE_API_BASE_URL=https://<your-api>/api/v1 npm run dev     # http://localhost:5174
npm run build                                                  # static files in dist/
```

The API must list this portal's address in `CORS_ORIGIN`, and for the approval email it needs the SMTP settings in `backend/.env.example`.

## Needs before a real pilot (not done by this software)

Role and access agreement with Customs and AGL, designated focal persons, HTTPS in production, database encryption at rest and backups on the hosting side, the institutions' security and data-protection review, and retention and deletion rules.
