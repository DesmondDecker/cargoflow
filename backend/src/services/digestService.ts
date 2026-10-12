import { Types } from 'mongoose';
import { ContainerModel } from '../models/Container';
import { BillOfLadingModel } from '../models/BillOfLading';
import { ActivityLogModel } from '../models/ActivityLog';
import { CargoDocumentModel } from '../models/CargoDocument';
import { DailyDigestModel } from '../models/DailyDigest';
import { AgencyModel } from '../models/Agency';
import { TERMINAL_STATUSES } from '../constants/containerPipeline';

function dateKeyFor(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const STALE_DAYS = 10; // no status change in this many days = "stale"

// Computes the real DailyDigest shape from live container/document/activity
// data for one agency — every field here is a genuine query result, not a
// placeholder count.
export async function computeDailyDigest(agencyId: string | Types.ObjectId) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const containers = await ContainerModel.find({ agencyId }).populate('importerId', 'name').populate('blId', 'blNumber');

  const byStatus: Record<string, number> = {};
  let urgent = 0, attention = 0, normal = 0;
  const documentReminders: { containerNumber: string; blNumber: string; importerName: string; missingDocumentTypes: string[] }[] = [];
  const missingCTNReminders: { containerNumber: string; blNumber: string; importerName: string }[] = [];
  const expired: { containerNumber: string; ruleName: string; dueDate: string }[] = [];
  const dueWithin3Days: { containerNumber: string; ruleName: string; dueDate: string }[] = [];
  let staleContainerCount = 0;

  for (const c of containers) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    if (c.attentionLevel === 'urgent') urgent++;
    else if (c.attentionLevel === 'attention') attention++;
    else normal++;

    const importerName = (c.importerId as unknown as { name?: string })?.name || 'Unknown importer';
    const blNumber = (c.blId as unknown as { blNumber?: string })?.blNumber || '—';

    const docs = await CargoDocumentModel.find({ containerId: c._id, deletedAt: null });
    const typesPresent = new Set<string>(docs.map((d) => d.documentType));
    const missing = c.requiredDocumentTypes.filter((t) => !typesPresent.has(t));
    if (missing.length > 0) {
      documentReminders.push({ containerNumber: c.containerNumber, blNumber, importerName, missingDocumentTypes: missing });
      if (missing.includes('CTN')) missingCTNReminders.push({ containerNumber: c.containerNumber, blNumber, importerName });
    }

    for (const d of c.deadlines) {
      if (d.status === 'expired') expired.push({ containerNumber: c.containerNumber, ruleName: d.ruleName, dueDate: d.dueDate.toISOString() });
      else if (d.status === 'pending' && d.dueDate <= in3Days) dueWithin3Days.push({ containerNumber: c.containerNumber, ruleName: d.ruleName, dueDate: d.dueDate.toISOString() });
    }

    const lastActive = c.statusHistory.length ? c.statusHistory[c.statusHistory.length - 1].changedAt : c.updatedAt;
    if (lastActive < staleThreshold && !TERMINAL_STATUSES.includes(c.status)) staleContainerCount++;
  }

  const [billsOfLadingTotal, activityCountLast24h, newlyRegisteredLast24h, clearedLast24h, deliveredLast24h] = await Promise.all([
    BillOfLadingModel.countDocuments({ agencyId }),
    ActivityLogModel.countDocuments({ agencyId, createdAt: { $gte: dayAgo } }),
    ActivityLogModel.countDocuments({ agencyId, action: 'container_created', createdAt: { $gte: dayAgo } }),
    ActivityLogModel.countDocuments({ agencyId, action: 'status_changed', 'details.status': 'Cleared', createdAt: { $gte: dayAgo } }),
    ActivityLogModel.countDocuments({ agencyId, action: 'status_changed', 'details.status': 'Delivered', createdAt: { $gte: dayAgo } }),
  ]);

  const blWithAttention = await ContainerModel.distinct('blId', { agencyId, attentionLevel: { $ne: 'normal' } });

  const payload = {
    dateKey: dateKeyFor(now),
    generatedAt: now.toISOString(),
    containers: { total: containers.length, urgent, attention, normal, byStatus },
    billsOfLading: { total: billsOfLadingTotal, withAttentionContainers: blWithAttention.length },
    deadlines: { expired, dueWithin3Days },
    missingDocumentsContainerCount: documentReminders.length,
    documentReminders,
    missingCTNReminders,
    staleContainerCount,
    activityCountLast24h,
    newlyRegisteredLast24h,
    clearedLast24h,
    deliveredLast24h,
  };

  await DailyDigestModel.findOneAndUpdate(
    { agencyId, dateKey: payload.dateKey },
    { agencyId, dateKey: payload.dateKey, generatedAt: now, payload },
    { upsert: true }
  );

  return payload;
}

// Called by the daily cron (see server.ts) for every agency with an
// active/trialing subscription — a suspended or expired agency doesn't need
// a digest generated on its behalf.
export async function generateDigestsForAllActiveAgencies(): Promise<number> {
  const agencies = await AgencyModel.find({ isActive: true, 'subscription.status': { $in: ['trialing', 'active'] } }, '_id');
  await Promise.all(agencies.map((a) => computeDailyDigest(a._id)));
  return agencies.length;
}
