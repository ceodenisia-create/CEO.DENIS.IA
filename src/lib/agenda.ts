import { supabase } from './supabase';
import type { Client, Order } from './types';

type SupabaseQueryResult = { data: unknown; error: Error | null };

type SupabaseQuery = PromiseLike<SupabaseQueryResult> & {
  select: (columns?: string) => SupabaseQuery;
  insert: (values: unknown) => SupabaseQuery;
  update: (values: unknown) => SupabaseQuery;
  delete: () => SupabaseQuery;
  gte: (column: string, value: string) => SupabaseQuery;
  lte: (column: string, value: string) => SupabaseQuery;
  eq: (column: string, value: string) => SupabaseQuery;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery;
  limit: (count: number) => SupabaseQuery;
  single: () => SupabaseQuery;
};

type SupabaseUntypedClient = {
  from: (table: string) => SupabaseQuery;
};

const db = supabase as unknown as SupabaseUntypedClient;

export type AgendaViewMode = 'month' | 'week' | 'day';
export type AgendaEventType = 'pedido' | 'entrega' | 'reunion' | 'corte' | 'diseno' | 'molderia' | 'impresion' | 'pago' | 'reclamo' | 'llamada' | 'tarea_interna' | 'otro';
export type AgendaPriority = 'baja' | 'normal' | 'alta' | 'urgente';
export type AgendaStatus = 'pendiente' | 'en_proceso' | 'completado' | 'cancelado';
export type AgendaReminder = 'none' | '15_min' | '1_hour' | '1_day';

export interface AgendaUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: AgendaEventType;
  priority: AgendaPriority;
  status: AgendaStatus;
  start_at: string;
  end_at: string | null;
  reminder: AgendaReminder | null;
  color: string | null;
  customer_id: string | null;
  order_id: string | null;
  responsible_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AgendaEventForm = {
  title: string;
  description: string;
  event_type: AgendaEventType;
  priority: AgendaPriority;
  status: AgendaStatus;
  date: string;
  start_time: string;
  end_time: string;
  reminder: AgendaReminder;
  color: string;
  customer_id: string;
  order_id: string;
  responsible_user_id: string;
};

export type AgendaFilters = {
  event_type: string;
  status: string;
  priority: string;
  customer_id: string;
  responsible_user_id: string;
};

export const AGENDA_EVENT_TYPES: Array<{ value: AgendaEventType; label: string; color: string }> = [
  { value: 'pedido', label: 'Pedido', color: '#8b5cf6' },
  { value: 'entrega', label: 'Entrega', color: '#14b8a6' },
  { value: 'reunion', label: 'Reunión', color: '#38bdf8' },
  { value: 'corte', label: 'Corte', color: '#f97316' },
  { value: 'diseno', label: 'Diseño', color: '#ec4899' },
  { value: 'molderia', label: 'Moldería', color: '#10b981' },
  { value: 'impresion', label: 'Impresión', color: '#6366f1' },
  { value: 'pago', label: 'Pago', color: '#eab308' },
  { value: 'reclamo', label: 'Reclamo', color: '#ef4444' },
  { value: 'llamada', label: 'Llamada', color: '#06b6d4' },
  { value: 'tarea_interna', label: 'Tarea interna', color: '#64748b' },
  { value: 'otro', label: 'Otro', color: '#a855f7' },
];

export const AGENDA_PRIORITIES: Array<{ value: AgendaPriority; label: string }> = [
  { value: 'baja', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export const AGENDA_STATUSES: Array<{ value: AgendaStatus; label: string }> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export const AGENDA_REMINDERS: Array<{ value: AgendaReminder; label: string }> = [
  { value: 'none', label: 'Sin recordatorio' },
  { value: '15_min', label: '15 min antes' },
  { value: '1_hour', label: '1 hora antes' },
  { value: '1_day', label: '1 día antes' },
];

export const DEFAULT_AGENDA_FORM: AgendaEventForm = {
  title: '',
  description: '',
  event_type: 'pedido',
  priority: 'normal',
  status: 'pendiente',
  date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  end_time: '10:00',
  reminder: 'none',
  color: '#14b8a6',
  customer_id: '',
  order_id: '',
  responsible_user_id: '',
};

export function getAgendaPermissionMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error ?? '');

  if (/permission|policy|rls|row-level|denied|violates|42501/i.test(message)) {
    return 'No tenés permiso para realizar esta acción.';
  }

  return message || 'Ocurrió un error inesperado en Agenda.';
}

export async function getAgendaEvents(from: Date, to: Date): Promise<AgendaEvent[]> {
  const { data, error } = await db
    .from('agenda_events')
    .select('*')
    .gte('start_at', from.toISOString())
    .lte('start_at', to.toISOString())
    .order('start_at', { ascending: true });

  if (error) throw error;
  return (data || []) as AgendaEvent[];
}

export async function createAgendaEvent(form: AgendaEventForm, userId: string): Promise<AgendaEvent> {
  const startAt = new Date(`${form.date}T${form.start_time || '09:00'}`);
  const endAt = form.end_time ? new Date(`${form.date}T${form.end_time}`) : null;

  const payload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    event_type: form.event_type,
    priority: form.priority,
    status: form.status,
    start_at: startAt.toISOString(),
    end_at: endAt?.toISOString() ?? null,
    reminder: form.reminder,
    color: form.color,
    customer_id: form.customer_id || null,
    order_id: form.order_id || null,
    responsible_user_id: form.responsible_user_id || null,
    created_by: userId,
  };

  const { data, error } = await db
    .from('agenda_events')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as AgendaEvent;
}

export async function updateAgendaEvent(id: string, updates: Partial<AgendaEvent>): Promise<AgendaEvent> {
  const { data, error } = await db
    .from('agenda_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AgendaEvent;
}

export async function deleteAgendaEvent(id: string): Promise<void> {
  const { error } = await db.from('agenda_events').delete().eq('id', id);
  if (error) throw error;
}

export async function getAgendaCatalogData() {
  const [customersResult, ordersResult, usersResult] = await Promise.all([
    db.from('customers').select('*').order('name', { ascending: true }),
    db.from('orders').select('*').order('created_at', { ascending: false }).limit(250),
    db.from('user_profiles').select('id, email, full_name, role').order('full_name', { ascending: true }),
  ]);

  if (customersResult.error) throw customersResult.error;
  if (ordersResult.error) throw ordersResult.error;

  return {
    customers: (customersResult.data || []) as Client[],
    orders: (ordersResult.data || []) as Order[],
    users: usersResult.error ? [] : ((usersResult.data || []) as AgendaUserProfile[]),
  };
}
