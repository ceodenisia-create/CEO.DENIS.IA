import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Flag,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import type { Client, Order } from '../lib/types';
import {
  AGENDA_EVENT_TYPES,
  AGENDA_PRIORITIES,
  AGENDA_REMINDERS,
  AGENDA_STATUSES,
  DEFAULT_AGENDA_FORM,
  createAgendaEvent,
  deleteAgendaEvent,
  getAgendaCatalogData,
  getAgendaEvents,
  getAgendaPermissionMessage,
  updateAgendaEvent,
  type AgendaEvent,
  type AgendaEventForm,
  type AgendaFilters,
  type AgendaUserProfile,
  type AgendaViewMode,
} from '../lib/agenda';

type SummaryCards = {
  today: number;
  pending: number;
  urgent: number;
  completedWeek: number;
  upcomingDeliveries: number;
};

const FILTER_DEFAULTS: AgendaFilters = {
  event_type: '',
  status: '',
  priority: '',
  customer_id: '',
  responsible_user_id: '',
};

const VIEW_LABELS: Record<AgendaViewMode, string> = {
  month: 'Mensual',
  week: 'Semanal',
  day: 'Diaria',
};

const PRIORITY_STYLES: Record<string, string> = {
  baja: 'bg-slate-700/70 text-slate-200 border-slate-500/40',
  normal: 'bg-teal-500/15 text-teal-200 border-teal-400/30',
  alta: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  urgente: 'bg-red-500/20 text-red-200 border-red-400/40 shadow-red-900/20',
};

const STATUS_STYLES: Record<string, string> = {
  pendiente: 'bg-violet-500/15 text-violet-200 border-violet-400/30',
  en_proceso: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  completado: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  cancelado: 'bg-slate-600/40 text-slate-300 border-slate-500/40 line-through',
};

const SUMMARY_ICON_STYLES: Record<string, string> = {
  teal: 'text-teal-300',
  violet: 'text-violet-300',
  red: 'text-red-300',
  emerald: 'text-emerald-300',
  sky: 'text-sky-300',
};

const formatDateKey = (date: Date) => date.toISOString().split('T')[0];
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const getWeekStart = (date: Date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => formatDateKey(a) === formatDateKey(b);

const formatTime = (iso: string | null) => {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
};

const formatLongDate = (date: Date) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);

const getTypeLabel = (value: string) => AGENDA_EVENT_TYPES.find(type => type.value === value)?.label || value;
const getStatusLabel = (value: string) => AGENDA_STATUSES.find(status => status.value === value)?.label || value;
const getPriorityLabel = (value: string) => AGENDA_PRIORITIES.find(priority => priority.value === value)?.label || value;
const getReminderLabel = (value: string | null) => AGENDA_REMINDERS.find(reminder => reminder.value === value)?.label || 'Sin recordatorio';

const getEventColor = (event: AgendaEvent) => event.color || AGENDA_EVENT_TYPES.find(type => type.value === event.event_type)?.color || '#14b8a6';

function getCalendarRange(referenceDate: Date, viewMode: AgendaViewMode) {
  if (viewMode === 'month') {
    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
    return { from: getWeekStart(monthStart), to: endOfDay(addDays(getWeekStart(monthEnd), 6)) };
  }

  if (viewMode === 'week') {
    const from = getWeekStart(referenceDate);
    return { from, to: endOfDay(addDays(from, 6)) };
  }

  return { from: startOfDay(referenceDate), to: endOfDay(referenceDate) };
}

function getCalendarDays(referenceDate: Date, viewMode: AgendaViewMode) {
  const { from, to } = getCalendarRange(referenceDate, viewMode);
  const days: Date[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

function isAllowedRole(role: unknown) {
  const normalized = String(role ?? '').trim().toLowerCase();
  return ['admin', 'administrator', 'administrador', 'empleado', 'staff'].includes(normalized);
}

function isAdminRole(role: unknown) {
  return ['admin', 'administrator', 'administrador'].includes(String(role ?? '').trim().toLowerCase());
}

function buildEventForm(event: AgendaEvent): AgendaEventForm {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;

  return {
    title: event.title,
    description: event.description || '',
    event_type: event.event_type,
    priority: event.priority,
    status: event.status,
    date: formatDateKey(start),
    start_time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    end_time: end ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '',
    reminder: event.reminder || 'none',
    color: event.color || getEventColor(event),
    customer_id: event.customer_id || '',
    order_id: event.order_id || '',
    responsible_user_id: event.responsible_user_id || '',
  };
}

function AgendaBadge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>;
}

function AgendaModal({
  form,
  isEditMode,
  canEditFully,
  canSubmit,
  customers,
  orders,
  users,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  form: AgendaEventForm;
  isEditMode: boolean;
  canEditFully: boolean;
  canSubmit: boolean;
  customers: Client[];
  orders: Order[];
  users: AgendaUserProfile[];
  error: string;
  onClose: () => void;
  onChange: (updates: Partial<AgendaEventForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const fieldDisabled = isEditMode && !canEditFully;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-teal-400/20 bg-slate-950 shadow-2xl shadow-teal-950/40">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="text-xl font-bold text-white">{isEditMode ? 'Editar actividad' : 'Nueva actividad'}</h2>
            <p className="text-sm text-slate-400">Planificación operativa conectada con clientes y pedidos.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {isEditMode && !canEditFully && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Como empleado podés cambiar el estado de esta actividad, pero no editar los datos importantes ni eliminarla.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-300">Título</span>
              <input
                value={form.title}
                onChange={event => onChange({ title: event.target.value })}
                disabled={fieldDisabled}
                required
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-teal-400 disabled:opacity-60"
                placeholder="Ej: Entregar molde campera hombre"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Tipo de actividad</span>
              <select value={form.event_type} onChange={event => onChange({ event_type: event.target.value as AgendaEventForm['event_type'] })} disabled={fieldDisabled} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60">
                {AGENDA_EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Fecha</span>
              <input type="date" value={form.date} onChange={event => onChange({ date: event.target.value })} disabled={fieldDisabled} required className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60" />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Hora de inicio</span>
              <input type="time" value={form.start_time} onChange={event => onChange({ start_time: event.target.value })} disabled={fieldDisabled} required className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60" />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Hora de fin</span>
              <input type="time" value={form.end_time} onChange={event => onChange({ end_time: event.target.value })} disabled={fieldDisabled} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60" />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Cliente relacionado</span>
              <select value={form.customer_id} onChange={event => onChange({ customer_id: event.target.value })} disabled={fieldDisabled} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60">
                <option value="">Sin cliente</option>
                {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name || customer.business_name || 'Cliente sin nombre'}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Pedido relacionado</span>
              <select value={form.order_id} onChange={event => onChange({ order_id: event.target.value })} disabled={fieldDisabled} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60">
                <option value="">Sin pedido</option>
                {orders.map(order => <option key={order.id} value={order.id}>{order.order_number} · {order.customer_name || order.article_name || 'Pedido'}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Prioridad</span>
              <select value={form.priority} onChange={event => onChange({ priority: event.target.value as AgendaEventForm['priority'] })} disabled={fieldDisabled} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60">
                {AGENDA_PRIORITIES.map(priority => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Estado</span>
              <select value={form.status} onChange={event => onChange({ status: event.target.value as AgendaEventForm['status'] })} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400">
                {AGENDA_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Recordatorio</span>
              <select value={form.reminder} onChange={event => onChange({ reminder: event.target.value as AgendaEventForm['reminder'] })} disabled={fieldDisabled} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60">
                {AGENDA_REMINDERS.map(reminder => <option key={reminder.value} value={reminder.value}>{reminder.label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Responsable</span>
              <select value={form.responsible_user_id} onChange={event => onChange({ responsible_user_id: event.target.value })} disabled={fieldDisabled} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60">
                <option value="">Sin responsable</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.full_name || user.email} · {user.role}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-300">Color / etiqueta visual</span>
              <input type="color" value={form.color} onChange={event => onChange({ color: event.target.value })} disabled={fieldDisabled} className="h-[50px] w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 disabled:opacity-60" />
            </label>

            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-300">Descripción / notas</span>
              <textarea value={form.description} onChange={event => onChange({ description: event.target.value })} disabled={fieldDisabled} rows={4} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400 disabled:opacity-60" placeholder="Notas operativas, material pendiente, dirección de entrega, detalles del reclamo..." />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={!canSubmit} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 font-semibold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50">
              <Save size={18} />
              {isEditMode ? 'Guardar cambios' : 'Crear actividad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Agenda() {
  const { user, profile, isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<AgendaViewMode>('month');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [customers, setCustomers] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AgendaUserProfile[]>([]);
  const [filters, setFilters] = useState<AgendaFilters>(FILTER_DEFAULTS);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [form, setForm] = useState<AgendaEventForm>(DEFAULT_AGENDA_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  const canUseAgenda = isAllowedRole(profile?.role) || isAdmin;
  const canDelete = isAdminRole(profile?.role) || isAdmin;
  const isEditMode = Boolean(editingEvent);
  const canEditFully = !isEditMode || isAdmin || editingEvent?.created_by === user?.id;

  const range = useMemo(() => getCalendarRange(referenceDate, viewMode), [referenceDate, viewMode]);
  const calendarDays = useMemo(() => getCalendarDays(referenceDate, viewMode), [referenceDate, viewMode]);

  const customerById = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const orderById = useMemo(() => new Map(orders.map(order => [order.id, order])), [orders]);
  const userById = useMemo(() => new Map(users.map(item => [item.id, item])), [users]);

  const filteredEvents = useMemo(() => events.filter(event => (
    (!filters.event_type || event.event_type === filters.event_type) &&
    (!filters.status || event.status === filters.status) &&
    (!filters.priority || event.priority === filters.priority) &&
    (!filters.customer_id || event.customer_id === filters.customer_id) &&
    (!filters.responsible_user_id || event.responsible_user_id === filters.responsible_user_id)
  )), [events, filters]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    filteredEvents.forEach(event => {
      const key = formatDateKey(new Date(event.start_at));
      map.set(key, [...(map.get(key) || []), event]);
    });
    return map;
  }, [filteredEvents]);

  const summary: SummaryCards = useMemo(() => {
    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const nextSevenDays = endOfDay(addDays(today, 7));

    return {
      today: events.filter(event => sameDay(new Date(event.start_at), today)).length,
      pending: events.filter(event => event.status === 'pendiente' || event.status === 'en_proceso').length,
      urgent: events.filter(event => event.priority === 'urgente' && event.status !== 'completado' && event.status !== 'cancelado').length,
      completedWeek: events.filter(event => event.status === 'completado' && new Date(event.start_at) >= weekStart && new Date(event.start_at) <= weekEnd).length,
      upcomingDeliveries: events.filter(event => event.event_type === 'entrega' && new Date(event.start_at) >= startOfDay(today) && new Date(event.start_at) <= nextSevenDays && event.status !== 'cancelado').length,
    };
  }, [events]);

  const periodTitle = useMemo(() => {
    if (viewMode === 'month') return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(referenceDate);
    if (viewMode === 'week') {
      const start = getWeekStart(referenceDate);
      const end = addDays(start, 6);
      return `${new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(start)} - ${new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(end)}`;
    }
    return formatLongDate(referenceDate);
  }, [referenceDate, viewMode]);

  const rangeFromIso = range.from.toISOString();
  const rangeToIso = range.to.toISOString();

  const loadAgenda = useCallback(async () => {
    if (!canUseAgenda) return;
    setLoading(true);
    setError('');
    try {
      const [eventData, catalogData] = await Promise.all([
        getAgendaEvents(new Date(rangeFromIso), new Date(rangeToIso)),
        getAgendaCatalogData(),
      ]);
      setEvents(eventData);
      setCustomers(catalogData.customers);
      setOrders(catalogData.orders);
      setUsers(catalogData.users);
    } catch (err) {
      setError(getAgendaPermissionMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canUseAgenda, rangeFromIso, rangeToIso]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  const openCreateModal = (date?: Date) => {
    setEditingEvent(null);
    setForm({ ...DEFAULT_AGENDA_FORM, date: formatDateKey(date || referenceDate) });
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (event: AgendaEvent) => {
    setEditingEvent(event);
    setForm(buildEventForm(event));
    setModalError('');
    setModalOpen(true);
  };

  const handleNavigatePeriod = (direction: number) => {
    if (viewMode === 'month') setReferenceDate(current => addMonths(current, direction));
    if (viewMode === 'week') setReferenceDate(current => addDays(current, direction * 7));
    if (viewMode === 'day') setReferenceDate(current => addDays(current, direction));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setModalError('');

    try {
      if (editingEvent) {
        if (canEditFully) {
          const startAt = new Date(`${form.date}T${form.start_time || '09:00'}`);
          const endAt = form.end_time ? new Date(`${form.date}T${form.end_time}`) : null;
          await updateAgendaEvent(editingEvent.id, {
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
          });
        } else {
          await updateAgendaEvent(editingEvent.id, { status: form.status });
        }
      } else {
        await createAgendaEvent(form, user.id);
      }
      setModalOpen(false);
      setEditingEvent(null);
      await loadAgenda();
    } catch (err) {
      setModalError(getAgendaPermissionMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (event: AgendaEvent, status: AgendaEvent['status']) => {
    try {
      await updateAgendaEvent(event.id, { status });
      await loadAgenda();
      setSelectedEvent(current => current?.id === event.id ? { ...current, status } : current);
    } catch (err) {
      setError(getAgendaPermissionMessage(err));
    }
  };

  const handleDelete = async (event: AgendaEvent) => {
    if (!canDelete) {
      setError('No tenés permiso para realizar esta acción.');
      return;
    }

    if (!window.confirm('¿Querés borrar esta actividad de Agenda? Esta acción no elimina pedidos ni clientes relacionados.')) return;
    try {
      await deleteAgendaEvent(event.id);
      setSelectedEvent(null);
      await loadAgenda();
    } catch (err) {
      setError(getAgendaPermissionMessage(err));
    }
  };

  if (!canUseAgenda) {
    return (
      <div className="rounded-3xl border border-red-400/20 bg-slate-950/70 p-8 text-center shadow-xl">
        <AlertCircle className="mx-auto mb-4 text-red-300" size={42} />
        <h1 className="text-2xl font-bold text-white">Agenda no disponible</h1>
        <p className="mt-2 text-slate-300">Tu usuario está pendiente de aprobación. No tenés permiso para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-teal-400/20 bg-slate-950/70 shadow-2xl shadow-teal-950/20">
        <div className="relative p-6 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.20),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.18),transparent_30%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
                <Sparkles size={14} /> Centro operativo
              </div>
              <h1 className="text-3xl font-black text-white md:text-4xl">Agenda</h1>
              <p className="mt-2 text-slate-300">Planificación operativa de Modeltex</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadAgenda} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 font-semibold text-slate-200 transition hover:border-teal-400/50 hover:text-white">
                <RefreshCw size={18} /> Actualizar
              </button>
              <button onClick={() => openCreateModal()} className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 font-semibold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500">
                <Plus size={18} /> Nueva actividad
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <span className="inline-flex items-center gap-2"><AlertCircle size={18} /> {error}</span>
          <button onClick={() => setError('')}><X size={18} /></button>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Actividades de hoy', value: summary.today, icon: CalendarDays, tone: 'teal' },
          { label: 'Pendientes', value: summary.pending, icon: Clock, tone: 'violet' },
          { label: 'Urgentes', value: summary.urgent, icon: Flag, tone: 'red' },
          { label: 'Completadas esta semana', value: summary.completedWeek, icon: CheckCircle2, tone: 'emerald' },
          { label: 'Entregas próximas', value: summary.upcomingDeliveries, icon: ArrowRight, tone: 'sky' },
        ].map(card => (
          <div key={card.label} className="rounded-3xl border border-slate-700/70 bg-slate-950/60 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{card.label}</span>
              <card.icon size={20} className={SUMMARY_ICON_STYLES[card.tone]} />
            </div>
            <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-4 shadow-xl md:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Filter size={16} /> Filtros operativos
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select value={filters.event_type} onChange={event => setFilters(current => ({ ...current, event_type: event.target.value }))} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
            <option value="">Todos los tipos</option>
            {AGENDA_EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
            <option value="">Todos los estados</option>
            {AGENDA_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <select value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value }))} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
            <option value="">Todas las prioridades</option>
            {AGENDA_PRIORITIES.map(priority => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
          </select>
          <select value={filters.customer_id} onChange={event => setFilters(current => ({ ...current, customer_id: event.target.value }))} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
            <option value="">Todos los clientes</option>
            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name || customer.business_name || 'Cliente sin nombre'}</option>)}
          </select>
          <select value={filters.responsible_user_id} onChange={event => setFilters(current => ({ ...current, responsible_user_id: event.target.value }))} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
            <option value="">Todos los responsables</option>
            {users.map(item => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-950/80 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Vista {VIEW_LABELS[viewMode]}</p>
            <h2 className="mt-1 text-2xl font-black capitalize text-white">{periodTitle}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setReferenceDate(new Date())} className="rounded-xl border border-teal-400/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-100 transition hover:bg-teal-500/20">Hoy</button>
            <button onClick={() => handleNavigatePeriod(-1)} className="rounded-xl border border-slate-700 p-2 text-slate-200 transition hover:bg-slate-800"><ArrowLeft size={18} /></button>
            <button onClick={() => handleNavigatePeriod(1)} className="rounded-xl border border-slate-700 p-2 text-slate-200 transition hover:bg-slate-800"><ArrowRight size={18} /></button>
            <div className="ml-0 flex rounded-xl border border-slate-700 bg-slate-900 p-1 md:ml-2">
              {(['month', 'week', 'day'] as AgendaViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${viewMode === mode ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}>{VIEW_LABELS[mode]}</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7">
            {viewMode !== 'day' && ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="hidden border-b border-slate-800 bg-slate-900/60 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400 md:block">{day}</div>
            ))}
            {calendarDays.map(day => {
              const key = formatDateKey(day);
              const dayEvents = eventsByDay.get(key) || [];
              const muted = viewMode === 'month' && day.getMonth() !== referenceDate.getMonth();
              return (
                <div key={key} className={`min-h-[150px] border-b border-slate-800 p-3 md:border-r ${sameDay(day, new Date()) ? 'bg-teal-500/10' : muted ? 'bg-slate-900/30' : 'bg-slate-950/40'} ${viewMode === 'day' ? 'md:col-span-7 min-h-[560px]' : ''}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <button onClick={() => openCreateModal(day)} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition ${sameDay(day, new Date()) ? 'bg-teal-500 text-white' : muted ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-200 hover:bg-slate-800'}`}>{day.getDate()}</button>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 md:hidden">{new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(day)}</span>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.length === 0 && viewMode === 'day' && (
                      <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No hay actividades para este día. Creá una nueva actividad para planificar trabajo, entregas o pagos.</div>
                    )}
                    {dayEvents.slice(0, viewMode === 'month' ? 4 : 20).map(event => (
                      <button key={event.id} onClick={() => setSelectedEvent(event)} className="group w-full rounded-2xl border border-slate-700/70 bg-slate-900/80 p-2.5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-teal-400/50 hover:bg-slate-900">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: getEventColor(event) }} />
                          <span className="truncate text-xs font-black text-white">{formatTime(event.start_at)} · {event.title}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <AgendaBadge label={getTypeLabel(event.event_type)} className="border-slate-600 bg-slate-800/80 text-slate-300" />
                          {event.priority === 'urgente' && <AgendaBadge label="Urgente" className={PRIORITY_STYLES.urgente} />}
                          <AgendaBadge label={getStatusLabel(event.status)} className={STATUS_STYLES[event.status]} />
                        </div>
                      </button>
                    ))}
                    {dayEvents.length > 4 && viewMode === 'month' && <p className="text-xs font-semibold text-teal-300">+{dayEvents.length - 4} actividades más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedEvent && (
        <aside className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-md rounded-3xl border border-teal-400/20 bg-slate-950 p-5 shadow-2xl shadow-black/50">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Detalle</p>
              <h3 className="mt-1 text-xl font-black text-white">{selectedEvent.title}</h3>
            </div>
            <button onClick={() => setSelectedEvent(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex flex-wrap gap-2">
              <AgendaBadge label={getTypeLabel(selectedEvent.event_type)} className="border-slate-600 bg-slate-800 text-slate-200" />
              <AgendaBadge label={getPriorityLabel(selectedEvent.priority)} className={PRIORITY_STYLES[selectedEvent.priority]} />
              <AgendaBadge label={getStatusLabel(selectedEvent.status)} className={STATUS_STYLES[selectedEvent.status]} />
            </div>
            <p className="flex items-center gap-2"><Clock size={16} className="text-teal-300" /> {formatLongDate(new Date(selectedEvent.start_at))} · {formatTime(selectedEvent.start_at)} {selectedEvent.end_at ? `a ${formatTime(selectedEvent.end_at)}` : ''}</p>
            {selectedEvent.customer_id && <p><strong className="text-slate-100">Cliente:</strong> {customerById.get(selectedEvent.customer_id)?.name || customerById.get(selectedEvent.customer_id)?.business_name || 'Cliente vinculado'}</p>}
            {selectedEvent.order_id && <p><strong className="text-slate-100">Pedido:</strong> {orderById.get(selectedEvent.order_id)?.order_number || 'Pedido vinculado'}</p>}
            {selectedEvent.responsible_user_id && <p className="flex items-center gap-2"><UserRound size={16} className="text-violet-300" /> {userById.get(selectedEvent.responsible_user_id)?.full_name || userById.get(selectedEvent.responsible_user_id)?.email || 'Responsable asignado'}</p>}
            <p><strong className="text-slate-100">Recordatorio:</strong> {getReminderLabel(selectedEvent.reminder)}</p>
            {selectedEvent.description && <p className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 leading-relaxed">{selectedEvent.description}</p>}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <select value={selectedEvent.status} onChange={event => handleStatusChange(selectedEvent, event.target.value as AgendaEvent['status'])} className="col-span-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
              {AGENDA_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <button onClick={() => openEditModal(selectedEvent)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-teal-400/30 bg-teal-500/10 px-4 py-2.5 font-semibold text-teal-100 transition hover:bg-teal-500/20"><Eye size={16} /> Editar</button>
            <button onClick={() => handleDelete(selectedEvent)} disabled={!canDelete} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={16} /> Borrar</button>
          </div>
        </aside>
      )}

      {modalOpen && (
        <AgendaModal
          form={form}
          isEditMode={isEditMode}
          canEditFully={Boolean(canEditFully)}
          canSubmit={!saving && Boolean(form.title.trim())}
          customers={customers}
          orders={orders}
          users={users}
          error={modalError}
          onClose={() => setModalOpen(false)}
          onChange={updates => setForm(current => ({ ...current, ...updates }))}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
