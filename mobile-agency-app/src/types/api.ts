export type UserRole = 'owner' | 'admin' | 'staff';
export type AttentionLevel = 'urgent' | 'attention' | 'normal';

export interface AgencySummary {
  id: string;
  name: string;
  agencyCode: string;
}

export interface AuthUser {
  id: string;
  agencyId: string;
  name: string;
  phone?: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface Importer {
  _id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  tin?: string;
  hasIdCardFront?: boolean;
  hasIdCardBack?: boolean;
  isActive: boolean;
}

export interface ImporterProfile {
  importer: Importer;
  summary: {
    activeContainers: number;
    historicalContainers: number;
    billsOfLading: number;
    documents: number;
    containersRequiringAttention: number;
  };
  attentionContainers: { _id: string; containerNumber: string; status: string; attentionLevel: AttentionLevel; attentionReasons: string[] }[];
  upcomingDeadlines: { containerNumber: string; ruleName: string; dueDate: string }[];
}

export interface ContainerDeadline {
  ruleName: string;
  startEvent: string;
  startDate: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'expired';
}

export interface ContainerListItem {
  _id: string;
  containerNumber: string;
  status: string;
  attentionLevel: AttentionLevel;
  attentionReasons: string[];
  shippingLine?: string;
  vessel?: string;
  importerId?: { _id: string; name: string } | string;
  assignedOfficerId?: { _id: string; name: string } | string;
  liveTracking?: LiveTracking;
  updatedAt: string;
  version: number;
}

export interface LiveTracking {
  resolved: boolean;
  carrierName?: string;
  status?: string;
  vesselName?: string;
  eta?: string;
  source: string;
  publicTrackingUrl?: string;
  // Present only when staff pasted a carrier tracking page (source 'pasted:*').
  originPlace?: string;
  destinationPlace?: string;
  departedAt?: string;
  latestEvent?: { description: string; location?: string; facility?: string; at?: string };
  eventsCompleted?: number;
  carrierUpdatedNote?: string;
  recordedAt?: string;
  recordedByName?: string;
}

export interface ExternalTrackingLookup {
  code: string;
  carrierName?: string;
  publicTrackingUrl: string;
}

export interface ContainerCaseFile {
  container: ContainerListItem & {
    dates: { arrival?: string; doReceived?: string; discharged?: string; cleared?: string; delivered?: string };
    deadlines: ContainerDeadline[];
    blId: { _id: string; blNumber: string; shippingLine?: string; vesselName?: string; portOfLoading?: string; portOfDischarge?: string };
    statusHistory: { status: string; changedAt: string; changedBy?: { name: string }; note?: string }[];
    liveTracking?: LiveTracking;
    numberValidation?: { formatValid: boolean; checkDigitValid: boolean | null; issue?: string };
    requiredDocumentTypes: string[];
  };
  documents: { _id: string; documentType: string; currentVersion: number }[];
  documentChecklist: { type: string; satisfied: boolean }[];
  timeline: { action: string; description: string; occurredAt: string; performedBy?: { name: string } }[];
}

export interface DashboardStats {
  totalContainers: number;
  byStatus: { _id: string; count: number }[];
  byAttention: { _id: AttentionLevel; count: number }[];
  byOfficer: { _id: string | null; count: number; officerName?: string }[];
  byCarrier: { _id: string; count: number }[];
}

export interface DailyDigest {
  dateKey: string;
  generatedAt: string;
  containers: { total: number; urgent: number; attention: number; normal: number; byStatus: Record<string, number> };
  billsOfLading: { total: number; withAttentionContainers: number };
  deadlines: {
    expired: { containerNumber: string; ruleName: string; dueDate: string }[];
    dueWithin3Days: { containerNumber: string; ruleName: string; dueDate: string }[]; // despite the name: deadlines due within `windowDays`
    windowDays?: number;
  };
  missingDocumentsContainerCount: number;
  documentReminders: { containerNumber: string; blNumber: string; importerName: string; missingDocumentTypes: string[] }[];
  missingCTNReminders: { containerNumber: string; blNumber: string; importerName: string }[];
  staleContainerCount: number;
  activityCountLast24h: number;
  newlyRegisteredLast24h: number;
  clearedLast24h: number;
  deliveredLast24h: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { message: string; code: string };
}

export interface DocumentVersion {
  versionNumber: number;
  fileKey: string;
  fileUrl?: string;
  mimeType: string;
  uploadedAt: string;
  downloadUrl?: string;
}

export interface CargoDocument {
  _id: string;
  documentType: string;
  importerId: string;
  blId?: string;
  containerId?: string;
  versions: DocumentVersion[];
  currentVersion: number;
  reviewStatus?: 'pending_review' | 'verified';
  reviewedAt?: string;
  reviewedByName?: string;
  createdAt: string;
}

export type VehicleType = '20ft Truck' | '40ft Truck' | 'Flatbed' | 'Low Bed' | 'Pickup' | 'Van' | 'Other';
export type ContainerSize = '20ft' | '40ft' | '40ft HC' | '45ft';

export interface DriverVehicle {
  _id: string;
  vehicleType: VehicleType;
  plateNumber: string;
  containerCompatibility: ContainerSize[];
}

export interface DriverCandidate {
  _id: string;
  name: string;
  phone: string;
  location?: string;
  yearsExperience?: number;
  sponsored: boolean;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  matchingVehicles: DriverVehicle[];
}

export type TransportStatus = 'pending' | 'accepted' | 'declined' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

export interface TransportAssignment {
  _id: string;
  containerId: { _id: string; containerNumber: string; status: string } | string;
  driverId: { _id: string; name: string; phone: string; ratingAverage: number } | string;
  vehicleId: { _id: string; vehicleType: string; plateNumber: string } | string;
  pickupLocation: string;
  destination: string;
  requiredDate?: string;
  status: TransportStatus;
  createdAt: string;
}

export interface LetterFieldDef {
  key: string;
  label: string;
  required: boolean;
  multiline?: boolean;
  hint?: string;
}

export interface LetterTemplate {
  key: string;
  title: string;
  description: string;
  carrier: string;
  fields: LetterFieldDef[];
}

export interface LetterSummary {
  _id: string;
  templateKey: string;
  title: string;
  missingCount: number;
  updatedAt: string;
  createdByName: string;
}

export interface Letter {
  _id: string;
  containerId: string;
  templateKey: string;
  template: LetterTemplate;
  fields: Record<string, string>;
  missing: string[];
  warnings: string[];
  history: { editedByName: string; editedAt: string }[];
  createdByName: string;
  lastDownloadedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomsFields {
  cvcNumber: string;
  billOfLadingNumber: string;
  shippingAgency: string;
  containerNumber: string;
  documentName: string;
  itsNumber: string;
}

export interface CustomsSubmission extends CustomsFields {
  _id: string;
  source: 'agent' | 'customs_assisted';
  submittedByName: string;
  status: 'pending' | 'approved' | 'returned';
  submittedAt: string;
  submissionCount: number;
  approvalReference?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  returnReason?: string;
  history: { at: string; actorType: string; actorName: string; action: string; note?: string }[];
}
