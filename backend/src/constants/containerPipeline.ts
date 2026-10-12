// Single source of truth for the container status pipeline and cargo
// document types. Before this file existed, the exact same literal arrays
// were hand-copied across seven places — Container.ts's schema enum AND its
// TypeScript union, containerController.ts's changeStatusSchema,
// agencyController.ts's label-customization keys, dailyTrackingNotifyJob.ts's
// OPEN_STATUSES, digestService.ts's inline terminal-status check,
// importerController.ts's HISTORICAL_STATUSES, and CargoDocument.ts's schema
// enum alongside documentController.ts's own copy — with nothing tying them
// together. Any of them could drift from the rest with a single edit that
// looked correct in isolation. They now all import from here instead.
//
// Changing what's IN these arrays is still a real, coordinated change across
// every file listed above (see agencyController.ts's comment on why these
// values are load-bearing for driver dispatch, the attention engine, and the
// daily digest) — this file doesn't make that safer, it just makes the
// duplication visible and single-edit instead of seven-edit.

export const STATUS_KEYS = [
  'Pending Documents',
  'In Transit',
  'Arrived',
  'Under Clearance',
  'Cleared',
  'Transport Required',
  'Driver Assigned',
  'Picked Up',
  'In Transit To Destination',
  'Delivered',
  'Closed',
] as const;

export type ContainerStatus = (typeof STATUS_KEYS)[number];

// A container in one of these is done moving — no further driver/warehouse
// action expected. Used by the daily digest (stale-container detection),
// the importer profile (active vs. historical split), and the tracking
// notify job (which containers still need a live-tracking refresh).
export const TERMINAL_STATUSES: ContainerStatus[] = ['Delivered', 'Closed'];

export const OPEN_STATUSES: ContainerStatus[] = STATUS_KEYS.filter(
  (s): s is ContainerStatus => !TERMINAL_STATUSES.includes(s)
);

export const DOCUMENT_TYPE_KEYS = ['CTN', 'BL', 'Invoice', 'PackingList', 'CustomsDeclaration', 'Other'] as const;

export type DocumentType = (typeof DOCUMENT_TYPE_KEYS)[number];
