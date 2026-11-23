export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'canceled';
export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'activated' | 'rejected';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { message: string; code: string };
}

export interface Agency {
  _id: string;
  name: string;
  agencyCode: string;
  isActive: boolean;
  subscription: {
    status: SubscriptionStatus;
    planId?: string;
    currentPeriodEnd?: string;
  };
  createdAt: string;
}

export interface Payment {
  _id: string;
  agencyId: Agency | string;
  planId: string;
  amountExpected: number;
  currency: string;
  paymentMethod: 'orange_money' | 'afrimoney';
  merchantNumber: string;
  referenceCode: string;
  payerPhoneNumber?: string;
  submittedTransactionId?: string;
  status: PaymentStatus;
  rejectionReason?: string;
  verificationMethod?: 'auto_sms' | 'manual';
  activationCodeSentVia?: 'sms' | 'in_app_only';
  createdAt: string;
  verifiedAt?: string;
  activatedAt?: string;
}

export interface Expense {
  _id: string;
  agencyId: Agency | string;
  containerId?: { _id: string; containerNumber?: string } | string;
  category: string;
  amount: number;
  currency: string;
  description?: string;
  evidenceUrls: string[];
  status: ExpenseStatus;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
}

export interface GatewayDevice {
  _id: string;
  name: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export interface Driver {
  _id: string;
  name: string;
  phone: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  licenseDocumentUrl?: string;
  location?: string;
  yearsExperience?: number;
  availability: boolean;
  isActive: boolean;
  ratingAverage: number;
  ratingCount: number;
  sponsored?: boolean;
  sponsoredUntil?: string | null;
  createdAt: string;
}

export interface Warehouse {
  _id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  location?: string;
  capacityUnit?: string;
  totalCapacity?: number;
  availableCapacity?: number;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  isActive: boolean;
  ratingAverage: number;
  ratingCount: number;
  sponsored?: boolean;
  sponsoredUntil?: string | null;
  createdAt: string;
}

export type AdminRole = 'super_admin' | 'finance' | 'support' | 'viewer';

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super admin — everything',
  finance: 'Finance — payments, expenses, plans',
  support: 'Support — agencies, drivers, warehouses, customs/AGL users',
  viewer: 'Viewer — read only',
};

export interface PlatformAdmin {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  isActive?: boolean;
  role?: AdminRole;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodDays: number;
  description: string;
}

export interface Analytics {
  totalAgencies: number;
  agenciesByStatus: { _id: SubscriptionStatus; count: number }[];
  newAgenciesLast30Days: number;
  paymentsByStatus: { _id: PaymentStatus; count: number }[];
  revenue: { total: number; activatedCount: number };
  revenueByMonth: { _id: { year: number; month: number }; total: number; count: number }[];
  totalContainers: number;
  pendingReviewCount: number;
}
