import { TrackingResult } from './types';

// Decides what ends up on a container after a lookup. This is the last step
// of the chain: when no live source answered, generic public tracking applies.
// The carrier is identified from the container number's owner prefix and the
// app links to the carrier's own public page; it says plainly that it is not
// live data.

// The shape of container.liveTracking that this module reads and writes.
export interface LiveTrackingValue {
  resolved: boolean;
  carrierName?: string;
  status?: string;
  vesselName?: string;
  eta?: Date;
  originPlace?: string;
  destinationPlace?: string;
  departedAt?: Date;
  latestEvent?: { description: string; location?: string; facility?: string; at?: Date };
  eventsCompleted?: number;
  carrierUpdatedNote?: string;
  checkedAt?: Date;
  source: string;
  publicTrackingUrl?: string;
  externalRef?: string;
  [extra: string]: unknown;
}

export interface TrackingContainer {
  vessel?: string;
  liveTracking?: LiveTrackingValue;
}

export interface RefreshContext {
  guessedCarrier?: string;
  blVesselName?: string;
  publicTrackingUrl?: string;
}

const isPasted = (lt?: LiveTrackingValue): boolean => !!lt?.source?.startsWith('pasted:');

// Generic public tracking: nothing live, but the carrier is named and linked.
// `failureNote` carries why the live sources could not answer, so a failure is
// visible instead of silently looking like "no data".
export function genericPublicTracking(container: TrackingContainer, ctx: RefreshContext, failureNote?: string): LiveTrackingValue {
  const known = !!ctx.guessedCarrier;
  return {
    resolved: known,
    carrierName: ctx.guessedCarrier,
    status: known
      ? `Carrier identified. ${failureNote ? `Live lookup unavailable (${failureNote}). ` : 'No live tracking source is configured for this line. '}Check the carrier's public page or capture the result from it.`
      : 'Unable to identify carrier from container number',
    vesselName: container.vessel || ctx.blVesselName,
    eta: container.liveTracking?.eta,
    source: 'bic_owner_code_table',
    publicTrackingUrl: ctx.publicTrackingUrl,
  };
}

// Applies one lookup result. Rules:
//  - A live answer replaces whatever was there, including captured tracking
//    (it is newer and from a real source).
//  - A failed lookup never erases captured tracking, which a person recorded
//    from the carrier's page.
//  - Otherwise a failed lookup falls through to generic public tracking, with
//    the reason in the status.
// Returns true if the container's tracking changed.
export function applyTrackingResult(container: TrackingContainer, result: TrackingResult, ctx: RefreshContext): boolean {
  if (result.resolved) {
    container.liveTracking = {
      ...result,
      checkedAt: result.checkedAt ?? new Date(),
      publicTrackingUrl: ctx.publicTrackingUrl,
    } as LiveTrackingValue;
    return true;
  }
  if (isPasted(container.liveTracking)) return false;
  container.liveTracking = {
    ...genericPublicTracking(container, ctx, result.status),
    externalRef: result.externalRef ?? container.liveTracking?.externalRef,
  };
  return true;
}

// For containers whose carrier has no live source at all.
export function applyGenericTracking(container: TrackingContainer, ctx: RefreshContext): boolean {
  if (isPasted(container.liveTracking)) return false;
  container.liveTracking = genericPublicTracking(container, ctx);
  return true;
}
