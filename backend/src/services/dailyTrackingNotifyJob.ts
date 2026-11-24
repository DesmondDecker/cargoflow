import { AgencyModel } from '../models/Agency';
import { ContainerModel } from '../models/Container';
import { UserModel } from '../models/User';
import { DailyDigestModel } from '../models/DailyDigest';
import { getTrackingProvider, PUBLIC_TRACKER_URLS } from './tracking/registry';
import { applyTrackingResult, LiveTrackingValue } from './tracking/trackingRefresh';
import { sendPushNotifications, PushMessage } from './pushService';
import { OPEN_STATUSES } from '../constants/containerPipeline';

interface TrackingChange {
  containerNumber: string;
  carrierName?: string;
  before?: string;
  after?: string;
}

// Runs once a day (see server.ts, scheduled for 08:30). Two things happen
// here that the 05:30 digest job deliberately doesn't do: it calls out to
// real carrier APIs/public tracking pages (rate-limited, slower, can fail
// per-carrier), and it pushes to devices rather than just writing a DB row
// someone has to open the app to see.
//
// Only containers whose shipping line has a configured provider (including
// Maersk's public UI scraper by default — see tracking/registry.ts) get polled.
// A carrier with no provider is skipped rather than re-running the static
// BIC-prefix guess, which never changes and cannot produce a notification.
async function refreshTrackingForAgency(agencyId: string): Promise<TrackingChange[]> {
  const containers = await ContainerModel.find({
    agencyId,
    status: { $in: OPEN_STATUSES },
  });

  const changes: TrackingChange[] = [];

  for (const container of containers) {
    const carrierName = container.shippingLine || container.shippingLineDetection?.guess;
    const provider = getTrackingProvider(carrierName);
    if (!provider) continue; // no real source for this carrier — nothing to poll

    const before = container.liveTracking?.status;
    try {
      const live = container.liveTracking as unknown as LiveTrackingValue | undefined;
      const result = await provider.fetchTracking(container.containerNumber, { carrierName, externalRef: live?.externalRef });
      const publicTrackingUrl = carrierName ? PUBLIC_TRACKER_URLS[carrierName] : undefined;
      // A failed lookup never erases tracking a person captured, and is not
      // reported as a change.
      if (applyTrackingResult(container as never, result, { guessedCarrier: carrierName, publicTrackingUrl })) await container.save();

      if (result.resolved && result.status && result.status !== before) {
        changes.push({ containerNumber: container.containerNumber, carrierName, before, after: result.status });
      }
    } catch (err) {
      // One carrier/container failing must not stop the rest of the agency's
      // containers (or the rest of the agencies) from being processed.
      // eslint-disable-next-line no-console
      console.error(`[daily-tracking] failed for container ${container.containerNumber}`, err);
    }
  }

  return changes;
}

async function notifyAgency(agencyId: string, agencyName: string, changes: TrackingChange[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const digest = await DailyDigestModel.findOne({ agencyId, dateKey: today });
  const payload = digest?.payload as
    | { containers?: { urgent: number; attention: number }; missingDocumentsContainerCount?: number; deadlines?: { expired: unknown[] } }
    | undefined;

  const urgentCount = payload?.containers?.urgent || 0;
  const attentionCount = payload?.containers?.attention || 0;
  const missingDocs = payload?.missingDocumentsContainerCount || 0;
  const expiredDeadlines = payload?.deadlines?.expired?.length || 0;

  // Nothing to say — don't send a push just to say "all clear" every single
  // morning; that trains people to ignore notifications.
  if (changes.length === 0 && urgentCount === 0 && attentionCount === 0 && expiredDeadlines === 0) return;

  const parts: string[] = [];
  if (changes.length > 0) parts.push(`${changes.length} tracking update${changes.length === 1 ? '' : 's'}`);
  if (urgentCount > 0) parts.push(`${urgentCount} urgent`);
  if (expiredDeadlines > 0) parts.push(`${expiredDeadlines} deadline${expiredDeadlines === 1 ? '' : 's'} expired`);
  if (missingDocs > 0) parts.push(`${missingDocs} missing document${missingDocs === 1 ? '' : 's'}`);

  const body = parts.join(' · ');

  // Sent to owner + admin (the roles that can see the whole agency's board)
  // rather than every staff member — a per-officer version (only their own
  // assigned containers) would need assignedOfficerId threaded through here,
  // which this pass doesn't do.
  const recipients = await UserModel.find({
    agencyId,
    role: { $in: ['owner', 'admin'] },
    isActive: true,
    pushToken: { $exists: true, $ne: null },
    'notificationPrefs.dailySummary': { $ne: false }, // people who turned the summary off in Settings are skipped
  });

  const messages: PushMessage[] = recipients.map((u) => ({
    to: u.pushToken!,
    title: `${agencyName}: Container updates`,
    body,
    data: { screen: 'Dashboard' },
  }));

  await sendPushNotifications(messages);
}

export async function runDailyTrackingAndNotify(): Promise<{ agencies: number; changes: number }> {
  const agencies = await AgencyModel.find({ isActive: true, 'subscription.status': { $in: ['trialing', 'active'] } });

  let totalChanges = 0;
  for (const agency of agencies) {
    const changes = await refreshTrackingForAgency(String(agency._id));
    await notifyAgency(String(agency._id), agency.name, changes);
    totalChanges += changes.length;
  }

  return { agencies: agencies.length, changes: totalChanges };
}
