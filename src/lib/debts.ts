import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReceivableStatus = 'pending' | 'partial' | 'collected' | 'overdue';
export type PayableStatus    = 'pending' | 'partial' | 'paid'      | 'overdue';
export type PayableCategory  = 'supplier' | 'loan' | 'service' | 'other';

export interface AccountsReceivable {
  id: string;
  debtor_name: string;
  amount: number;
  paid_amount: number;
  description: string;
  origin_date: string;
  due_date: string | null;
  status: ReceivableStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AccountsReceivablePayment {
  id: string;
  receivable_id: string;
  amount: number;
  payment_date: string;
  notes: string;
  created_at: string;
}

export interface AccountsPayable {
  id: string;
  creditor_name: string;
  amount: number;
  paid_amount: number;
  description: string;
  category: PayableCategory;
  origin_date: string;
  due_date: string | null;
  status: PayableStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AccountsPayablePayment {
  id: string;
  payable_id: string;
  amount: number;
  payment_date: string;
  notes: string;
  created_at: string;
}

// ─── Receivable CRUD ──────────────────────────────────────────────────────────

export async function getReceivables(): Promise<AccountsReceivable[]> {
  const { data, error } = await supabase
    .from('accounts_receivable')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function createReceivable(payload: Omit<AccountsReceivable, 'id' | 'created_at' | 'updated_at'>): Promise<AccountsReceivable> {
  const { data, error } = await supabase
    .from('accounts_receivable')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReceivable(id: string, payload: Partial<AccountsReceivable>): Promise<void> {
  const { error } = await supabase
    .from('accounts_receivable')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteReceivable(id: string): Promise<void> {
  const { error } = await supabase.from('accounts_receivable').delete().eq('id', id);
  if (error) throw error;
}

// ─── Receivable Payments ──────────────────────────────────────────────────────

export async function getReceivablePayments(receivableId: string): Promise<AccountsReceivablePayment[]> {
  const { data, error } = await supabase
    .from('accounts_receivable_payments')
    .select('*')
    .eq('receivable_id', receivableId)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addReceivablePayment(
  receivableId: string,
  amount: number,
  paymentDate: string,
  notes: string,
  currentPaid: number,
  totalAmount: number,
): Promise<void> {
  const newPaid = currentPaid + amount;
  const newStatus: ReceivableStatus = newPaid >= totalAmount ? 'collected' : 'partial';

  const { error: payError } = await supabase
    .from('accounts_receivable_payments')
    .insert({ receivable_id: receivableId, amount, payment_date: paymentDate, notes });
  if (payError) throw payError;

  const { error: updError } = await supabase
    .from('accounts_receivable')
    .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', receivableId);
  if (updError) throw updError;
}

// ─── Payable CRUD ─────────────────────────────────────────────────────────────

export async function getPayables(): Promise<AccountsPayable[]> {
  const { data, error } = await supabase
    .from('accounts_payable')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function createPayable(payload: Omit<AccountsPayable, 'id' | 'created_at' | 'updated_at'>): Promise<AccountsPayable> {
  const { data, error } = await supabase
    .from('accounts_payable')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayable(id: string, payload: Partial<AccountsPayable>): Promise<void> {
  const { error } = await supabase
    .from('accounts_payable')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePayable(id: string): Promise<void> {
  const { error } = await supabase.from('accounts_payable').delete().eq('id', id);
  if (error) throw error;
}

// ─── Payable Payments ─────────────────────────────────────────────────────────

export async function getPayablePayments(payableId: string): Promise<AccountsPayablePayment[]> {
  const { data, error } = await supabase
    .from('accounts_payable_payments')
    .select('*')
    .eq('payable_id', payableId)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addPayablePayment(
  payableId: string,
  amount: number,
  paymentDate: string,
  notes: string,
  currentPaid: number,
  totalAmount: number,
): Promise<void> {
  const newPaid = currentPaid + amount;
  const newStatus: PayableStatus = newPaid >= totalAmount ? 'paid' : 'partial';

  const { error: payError } = await supabase
    .from('accounts_payable_payments')
    .insert({ payable_id: payableId, amount, payment_date: paymentDate, notes });
  if (payError) throw payError;

  const { error: updError } = await supabase
    .from('accounts_payable')
    .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', payableId);
  if (updError) throw updError;
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

export function computeReceivableSummary(items: AccountsReceivable[]) {
  const today = new Date().toISOString().split('T')[0];
  const pending  = items.filter(i => i.status === 'pending' || i.status === 'partial').reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);
  const overdue  = items.filter(i => i.status !== 'collected' && i.due_date && i.due_date < today).reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);
  const collected = items.filter(i => i.status === 'collected').reduce((s, i) => s + Number(i.amount), 0);
  return { pending, overdue, collected };
}

export function computePayableSummary(items: AccountsPayable[]) {
  const today = new Date().toISOString().split('T')[0];
  const pending  = items.filter(i => i.status === 'pending' || i.status === 'partial').reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);
  const overdue  = items.filter(i => i.status !== 'paid' && i.due_date && i.due_date < today).reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);
  const paid     = items.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  return { pending, overdue, paid };
}

// ─── Config maps ──────────────────────────────────────────────────────────────

export const RECEIVABLE_STATUS_CONFIG: Record<ReceivableStatus, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pendiente',     bg: 'bg-amber-100 dark:bg-amber-900/30',        text: 'text-amber-700 dark:text-amber-300'      },
  partial:   { label: 'Cobro parcial', bg: 'bg-blue-100 dark:bg-blue-900/30',          text: 'text-blue-700 dark:text-blue-300'        },
  collected: { label: 'Saldado',       bg: 'bg-emerald-100 dark:bg-emerald-900/30',    text: 'text-emerald-700 dark:text-emerald-300'  },
  overdue:   { label: 'Vencido',       bg: 'bg-red-100 dark:bg-red-900/30',            text: 'text-red-700 dark:text-red-300'          },
};

export const PAYABLE_STATUS_CONFIG: Record<PayableStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pendiente',    bg: 'bg-amber-100 dark:bg-amber-900/30',           text: 'text-amber-700 dark:text-amber-300'      },
  partial: { label: 'Pago parcial', bg: 'bg-blue-100 dark:bg-blue-900/30',             text: 'text-blue-700 dark:text-blue-300'        },
  paid:    { label: 'Saldado',      bg: 'bg-emerald-100 dark:bg-emerald-900/30',       text: 'text-emerald-700 dark:text-emerald-300'  },
  overdue: { label: 'Vencido',      bg: 'bg-red-100 dark:bg-red-900/30',               text: 'text-red-700 dark:text-red-300'          },
};

export const PAYABLE_CATEGORY_CONFIG: Record<PayableCategory, string> = {
  supplier: 'Proveedor',
  loan:     'Préstamo',
  service:  'Servicio',
  other:    'Otro',
};
