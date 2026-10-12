import cron from 'node-cron';
import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { generateDigestsForAllActiveAgencies } from './services/digestService';
import { runDailyTrackingAndNotify } from './services/dailyTrackingNotifyJob';

async function main() {
  await connectDb();

  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] CargoFlow API listening on port ${env.port} (${env.nodeEnv})`);
  });

  // Daily digest, once a day at 05:30 server time (before a typical agency's
  // working day starts). Real cron, real DB writes — not a stub — but the
  // server's local timezone is whatever it's deployed with; pin TZ explicitly
  // in your deployment env if that matters.
  cron.schedule('30 5 * * *', async () => {
    try {
      const count = await generateDigestsForAllActiveAgencies();
      // eslint-disable-next-line no-console
      console.log(`[cron] generated daily digests for ${count} agencies`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cron] daily digest generation failed', err);
    }
  });

  // 08:30 — live carrier tracking refresh + push notifications. Kept
  // separate from the 05:30 digest job because this one calls out to real
  // external APIs (Maersk/CMA CGM, once configured) and can be slower/flakier
  // than the pure-DB digest computation. '30 8 * * *' with no explicit
  // timezone is correct for Sierra Leone specifically because Africa/Freetown
  // is UTC+0 year-round (no DST) — if this server is ever deployed somewhere
  // else, or serves agencies outside Sierra Leone, pin TZ explicitly.
  cron.schedule('30 8 * * *', async () => {
    try {
      const result = await runDailyTrackingAndNotify();
      // eslint-disable-next-line no-console
      console.log(`[cron] daily tracking refresh: ${result.agencies} agencies, ${result.changes} tracking changes`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cron] daily tracking refresh failed', err);
    }
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
