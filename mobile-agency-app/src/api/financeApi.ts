import { api } from './client';
import { ApiEnvelope } from '../types/api';

export const EXPENSE_CATEGORIES = ['Transportation', 'Fuel', 'Handling', 'Customs', 'Packaging', 'Salaries', 'Storage', 'Other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  _id: string;
  containerId?: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description?: string;
  evidenceUrls: string[];
  recordedByUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedByUserId?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export async function createExpense(input: {
  containerId?: string;
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  description?: string;
  evidenceUrls?: string[];
}) {
  const { data } = await api.post<ApiEnvelope<{ expense: Expense }>>('/finance/expenses', input);
  return data.data.expense;
}

export async function fetchExpenses(params: { containerId?: string; status?: string }) {
  const { data } = await api.get<ApiEnvelope<{ expenses: Expense[] }>>('/finance/expenses', { params });
  return data.data.expenses;
}

export async function approveExpense(id: string) {
  const { data } = await api.post<ApiEnvelope<{ expense: Expense }>>(`/finance/expenses/${id}/approve`);
  return data.data.expense;
}

export async function rejectExpense(id: string, rejectionReason?: string) {
  const { data } = await api.post<ApiEnvelope<{ expense: Expense }>>(`/finance/expenses/${id}/reject`, { rejectionReason });
  return data.data.expense;
}

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'] as const;
export type ShipmentPaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface ShipmentPayment {
  _id: string;
  importerId: string;
  containerId?: string;
  amount: number;
  currency: string;
  paymentMethod: ShipmentPaymentMethod;
  paidAt: string;
  recordedByUserId: string;
  notes?: string;
  createdAt: string;
}

export async function recordPayment(input: {
  importerId: string;
  containerId?: string;
  amount: number;
  currency?: string;
  paymentMethod: ShipmentPaymentMethod;
  paidAt?: string;
  notes?: string;
}) {
  const { data } = await api.post<ApiEnvelope<{ payment: ShipmentPayment }>>('/finance/payments', input);
  return data.data.payment;
}

export async function fetchPayments(params: { containerId?: string; importerId?: string }) {
  const { data } = await api.get<ApiEnvelope<{ payments: ShipmentPayment[] }>>('/finance/payments', { params });
  return data.data.payments;
}

export interface Receipt {
  _id: string;
  receiptNumber: string;
  paymentId: string;
  importerId: string;
  containerId?: string;
  amount: number;
  currency: string;
  issuedAt: string;
  pdfUrl: string;
}

export async function generateReceipt(paymentId: string) {
  const { data } = await api.post<ApiEnvelope<{ receipt: Receipt }>>('/finance/receipts', { paymentId });
  return data.data.receipt;
}

export async function fetchReceipts(params: { containerId?: string; importerId?: string }) {
  const { data } = await api.get<ApiEnvelope<{ receipts: Receipt[] }>>('/finance/receipts', { params });
  return data.data.receipts;
}
