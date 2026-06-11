import { useEffect, useRef, useState, useMemo } from 'react';
import { Plus, X, Save, Loader2, CheckSquare, Square, Trash2, GripVertical, Flag, User, Calendar, ListChecks } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  AGENDA_EVENT_TYPES, AGENDA_PRIORITIES,
  createAgendaEvent, updateAgendaEvent, deleteAgendaEvent,
  DEFAULT_AGENDA_FORM,
  type AgendaEvent, type AgendaEventForm, type AgendaUserProfile,
} from '../lib/agenda';
import type { Client } from '../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  event_id: string;
  text: string;
  completed: boolean;
  position: number;
  created_at: string;
}

type KanbanColumn = {
  id: AgendaEvent['status'];
  label: string;
  color: string;
  headerBg: string;
  borderColor: string;
  dotColor: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: 'pendiente',  label: 'Por hacer',   color: 'text-slate-300',  headerBg: 'bg-slate-800/80',   borderColor: 'border-slate-600',   dotColor: 'bg-slate-400'  },
  { id: 'en_proceso', label: 'En proceso',  color: 'text-sky-300',    headerBg: 'bg-sky-900/40',     borderColor: 'border-sky-600/60',  dotColor: 'bg-sky-400'    },
  { id: 'cancelado',  label: 'Esperando',   color: 'text-amber-300',  headerBg: 'bg-amber-900/30',   borderColor: 'border-amber-600/50',dotColor: 'bg-amber-400'  },
  { id: 'completado', label: 'Completado',  color: 'text-emerald-300',headerBg: 'bg-emerald-900/30', borderColor: 'border-emerald-600/50',dotColor: 'bg-emerald-400'},
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  baja:    { label: 'Baja',   color: 'text-slate-400',  dot: 'bg-slate-400'  },
  normal:  { label: 'Media',  color: 'text-teal-400',   dot: 'bg-teal-400'   },
  alta:    { label: 'Alta',   color: 'text-amber-400',  dot: 'bg-amber-400'  },
  urgente: { label: 'Urgente',color: 'text-red-400',    dot: 'bg-red-400'    },
};

// ─── Checklist API ────────────────────────────────────────────────────────────

async function getChecklist(eventId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('agenda_event_checklist')
    .select('*')
    .eq('event_id', eventId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function addChecklistItem(eventId: string, text: string, position: number): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from('agenda_event_checklist')
    .insert({ event_id: eventId, text, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function toggleChecklistItem(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('agenda_event_checklist')
    .update({ completed })
    .eq('id', id);
  if (error) throw error;
}

async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from('agenda_event_checklist').delete().eq('id', id);
  if (error) throw error;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTypeConfig = (type: string) => AGENDA_EVENT_TYPES.find(t => t.value === type) || { label: type, color: '#64748b' };

const isDateOverdue = (iso: string | null) => {
  if (!iso) return false;
  return new Date(iso) < new Date();
};

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(iso));
};

// ─── KanbanCard ───────────────────────────────────────────────────────────────

interface KanbanCardProps {
  event: AgendaEvent;
  customers: Client[];
  users: AgendaUserProfile[];
  checklistCounts: Record<string, { total: number; done: number }>;
  onDragStart: (e: React.DragEvent, event: AgendaEvent) => void;
  onClick: (event: AgendaEvent) => void;
}

function KanbanCard({ event, customers, users, checklistCounts, onDragStart, onClick }: KanbanCardProps) {
  const typeConfig = getTypeConfig(event.event_type);
  const customer = customers.find(c => c.id === event.customer_id);
  const responsible = users.find(u => u.id === event.responsible_user_id);
  const overdue = isDateOverdue(event.start_at) && event.status !== 'completado';
  const priority = PRIORITY_CONFIG[event.priority] || PRIORITY_CONFIG.normal;
  const counts = checklistCounts[event.id];

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, event)}
      onClick={() => onClick(event)}
      className="group cursor-pointer rounded-2xl border border-slate-700/60 bg-slate-900/80 p-3.5 shadow-lg transition-all hover:border-teal-500/40 hover:shadow-teal-900/20 hover:-translate-y-0.5 active:scale-95"
    >
      {/* Drag handle + type badge */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ backgroundColor: typeConfig.color + '25', color: typeConfig.color }}
        >
          {typeConfig.label}
        </span>
        <GripVertical size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Title */}
      <p className="mb-2.5 text-sm font-semibold text-white leading-snug line-clamp-2">{event.title}</p>

      {/* Client */}
      {customer && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          <User size={11} />
          <span className="truncate">{customer.name || customer.business_name}</span>
        </div>
      )}

      {/* Responsible */}
      {responsible && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          <User size={11} className="text-teal-400" />
          <span className="truncate text-teal-300/80">{responsible.full_name || responsible.email}</span>
        </div>
      )}

      {/* Footer: date + priority + checklist */}
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date */}
          {event.start_at && (
            <span className={`flex items-center gap-1 text-[11px] font-medium ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
              <Calendar size={11} />
              {fmtDate(event.start_at)}
            </span>
          )}
          {/* Priority */}
          <span className={`flex items-center gap-1 text-[11px] font-semibold ${priority.color}`}>
            <Flag size={11} />
            {priority.label}
          </span>
        </div>

        {/* Checklist progress */}
        {counts && counts.total > 0 && (
          <span className={`flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
            counts.done === counts.total
              ? 'bg-emerald-900/40 text-emerald-400'
              : 'bg-slate-800 text-slate-400'
          }`}>
            <ListChecks size={11} />
            {counts.done}/{counts.total}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── DetailModal ──────────────────────────────────────────────────────────────

interface DetailModalProps {
  event: AgendaEvent;
  customers: Client[];
  users: AgendaUserProfile[];
  userId: string;
  canEditFully: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function DetailModal({ event, customers, users, userId, canEditFully, onClose, onSaved, onDeleted }: DetailModalProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getChecklist(event.id).then(setChecklist).catch(console.error);
  }, [event.id]);

  const done  = checklist.filter(i => i.completed).length;
  const total = checklist.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleToggle = async (item: ChecklistItem) => {
    try {
      await toggleChecklistItem(item.id, !item.completed);
      const updated = checklist.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i);
      setChecklist(updated);
      // All done?
      const allDone = updated.every(i => i.completed) && updated.length > 0;
      if (allDone && event.status !== 'completado') {
        if (confirm('¡Todas las subtareas completadas! ¿Marcar la tarea como Completada?')) {
          await updateAgendaEvent(event.id, { status: 'completado' });
          onSaved();
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    setAddingSub(true);
    try {
      const item = await addChecklistItem(event.id, newItemText.trim(), checklist.length);
      setChecklist(prev => [...prev, item]);
      setNewItemText('');
      inputRef.current?.focus();
    } catch (e) { console.error(e); }
    finally { setAddingSub(false); }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteChecklistItem(id);
      setChecklist(prev => prev.filter(i => i.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleMarkComplete = async () => {
    if (!confirm('¿Marcar esta tarea como Completada?')) return;
    setSaving(true);
    try {
      await updateAgendaEvent(event.id, { status: 'completado' });
      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try {
      await deleteAgendaEvent(event.id);
      onDeleted();
      onClose();
    } catch (e) { console.error(e); }
  };

  const customer    = customers.find(c => c.id === event.customer_id);
  const responsible = users.find(u => u.id === event.responsible_user_id);
  const typeConfig  = getTypeConfig(event.event_type);
  const priority    = PRIORITY_CONFIG[event.priority] || PRIORITY_CONFIG.normal;
  const overdue     = isDateOverdue(event.start_at) && event.status !== 'completado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-950 rounded-3xl border border-teal-400/20 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-xs font-bold rounded-full px-2 py-0.5"
                style={{ backgroundColor: typeConfig.color + '25', color: typeConfig.color }}
              >
                {typeConfig.label}
              </span>
              <span className={`text-xs font-semibold flex items-center gap-1 ${priority.color}`}>
                <Flag size={10} /> {priority.label}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white leading-snug">{event.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {customer && (
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Cliente</p>
                <p className="text-slate-200 font-medium truncate">{customer.name || customer.business_name}</p>
              </div>
            )}
            {responsible && (
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Responsable</p>
                <p className="text-teal-300 font-medium truncate">{responsible.full_name || responsible.email}</p>
              </div>
            )}
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-0.5">Fecha límite</p>
              <p className={`font-medium ${overdue ? 'text-red-400' : 'text-slate-200'}`}>
                {fmtDate(event.start_at) || '—'}
                {overdue && ' · Vencida'}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-0.5">Estado</p>
              <p className="text-slate-200 font-medium capitalize">
                {COLUMNS.find(c => c.id === event.status)?.label || event.status}
              </p>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="bg-slate-800/40 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Notas</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <ListChecks size={15} className="text-teal-400" />
                Subtareas
                {total > 0 && <span className="text-xs text-slate-500">{done}/{total}</span>}
              </h4>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="mb-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {/* Items */}
            <div className="space-y-1.5 mb-3">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2.5 group/item rounded-xl px-2 py-1.5 hover:bg-slate-800/50 transition">
                  <button onClick={() => handleToggle(item)} className="flex-shrink-0 text-slate-400 hover:text-teal-400 transition">
                    {item.completed
                      ? <CheckSquare size={16} className="text-teal-400" />
                      : <Square size={16} />
                    }
                  </button>
                  <span className={`flex-1 text-sm ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 text-red-500 hover:text-red-400 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                placeholder="Agregar subtarea..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-teal-400 placeholder-slate-500"
              />
              <button
                onClick={handleAddItem}
                disabled={addingSub || !newItemText.trim()}
                className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1 transition"
              >
                {addingSub ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
          <div className="flex gap-2">
            {canEditFully && event.status !== 'completado' && (
              <button
                onClick={handleMarkComplete}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                Completar
              </button>
            )}
            {canEditFully && (
              <button
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-900/20 text-sm transition"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QuickCreateModal ─────────────────────────────────────────────────────────

interface QuickCreateProps {
  defaultStatus: AgendaEvent['status'];
  customers: Client[];
  users: AgendaUserProfile[];
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

function QuickCreateModal({ defaultStatus, customers, users, userId, onClose, onCreated }: QuickCreateProps) {
  const [form, setForm] = useState<AgendaEventForm>({
    ...DEFAULT_AGENDA_FORM,
    status: defaultStatus,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createAgendaEvent(form, userId);
      onCreated();
      onClose();
    } catch (err) { console.error(err); alert('Error al crear la actividad'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-950 rounded-3xl border border-teal-400/20 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h3 className="font-bold text-white">Nueva actividad</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-400 mb-1 block">Título *</span>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-teal-400"
              placeholder="Ej: Entregar molde campera"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-400 mb-1 block">Tipo</span>
              <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value as AgendaEventForm['event_type'] }))} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
                {AGENDA_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400 mb-1 block">Prioridad</span>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as AgendaEventForm['priority'] }))} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
                {AGENDA_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400 mb-1 block">Fecha límite</span>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400 mb-1 block">Responsable</span>
              <select value={form.responsible_user_id} onChange={e => setForm(f => ({ ...f, responsible_user_id: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
                <option value="">Sin responsable</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-400 mb-1 block">Cliente</span>
            <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400">
              <option value="">Sin cliente</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name || c.business_name}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition">Cancelar</button>
            <button type="submit" disabled={saving || !form.title.trim()} className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold flex items-center gap-1.5 transition disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main KanbanBoard ─────────────────────────────────────────────────────────

interface KanbanBoardProps {
  events: AgendaEvent[];
  customers: Client[];
  users: AgendaUserProfile[];
  userId: string;
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function KanbanBoard({ events, customers, users, userId, isAdmin, onRefresh }: KanbanBoardProps) {
  const [dragging, setDragging]         = useState<AgendaEvent | null>(null);
  const [dragOver, setDragOver]         = useState<AgendaEvent['status'] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [quickCreate, setQuickCreate]   = useState<AgendaEvent['status'] | null>(null);
  const [checklistCounts, setChecklistCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Load checklist counts for all events
  useEffect(() => {
    if (events.length === 0) return;
    Promise.all(
      events.map(e =>
        supabase
          .from('agenda_event_checklist')
          .select('id, completed')
          .eq('event_id', e.id)
          .then(({ data }) => ({
            id: e.id,
            total: data?.length || 0,
            done: data?.filter(i => i.completed).length || 0,
          }))
      )
    ).then(results => {
      const map: Record<string, { total: number; done: number }> = {};
      results.forEach(r => { map[r.id] = { total: r.total, done: r.done }; });
      setChecklistCounts(map);
    });
  }, [events]);

  const filteredEvents = useMemo(() => events.filter(e => {
    if (filterResponsible && e.responsible_user_id !== filterResponsible) return false;
    if (filterType && e.event_type !== filterType) return false;
    if (filterPriority && e.priority !== filterPriority) return false;
    return true;
  }), [events, filterResponsible, filterType, filterPriority]);

  const eventsByColumn = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    COLUMNS.forEach(col => { map[col.id] = []; });
    filteredEvents.forEach(e => {
      if (map[e.status]) map[e.status].push(e);
    });
    return map;
  }, [filteredEvents]);

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, event: AgendaEvent) => {
    setDragging(event);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: AgendaEvent['status']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colId);
  };

  const handleDrop = async (e: React.DragEvent, colId: AgendaEvent['status']) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragging || dragging.status === colId) { setDragging(null); return; }

    if (colId === 'completado') {
      if (!confirm(`¿Marcar "${dragging.title}" como Completada?`)) { setDragging(null); return; }
    }

    try {
      await updateAgendaEvent(dragging.id, { status: colId });
      onRefresh();
    } catch (err) { console.error(err); }
    setDragging(null);
  };

  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  const selectOption = 'rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-teal-400';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-3">
        <select value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)} className={selectOption}>
          <option value="">Todos los responsables</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectOption}>
          <option value="">Todos los tipos</option>
          {AGENDA_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={selectOption}>
          <option value="">Todas las prioridades</option>
          {AGENDA_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {(filterResponsible || filterType || filterPriority) && (
          <button
            onClick={() => { setFilterResponsible(''); setFilterType(''); setFilterPriority(''); }}
            className="px-3 py-2 rounded-2xl border border-slate-600 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const colEvents = eventsByColumn[col.id] || [];
          const isDragTarget = dragOver === col.id;
          return (
            <div
              key={col.id}
              onDragOver={e => handleDragOver(e, col.id)}
              onDrop={e => handleDrop(e, col.id)}
              onDragLeave={() => setDragOver(null)}
              className={`flex flex-col rounded-3xl border transition-all ${col.borderColor} ${
                isDragTarget
                  ? 'bg-slate-800/80 scale-[1.01] shadow-xl shadow-teal-900/20'
                  : 'bg-slate-950/60'
              }`}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between rounded-t-3xl px-4 py-3 ${col.headerBg}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                  <span className={`text-sm font-bold ${col.color}`}>{col.label}</span>
                  <span className="ml-1 rounded-full bg-slate-700/80 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    {colEvents.length}
                  </span>
                </div>
                <button
                  onClick={() => setQuickCreate(col.id)}
                  className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
                  title="Nueva tarea en esta columna"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Cards */}
              <div className={`flex-1 space-y-3 p-3 min-h-[200px] transition-colors ${isDragTarget ? 'bg-teal-900/10 rounded-b-3xl' : ''}`}>
                {colEvents.length === 0 && (
                  <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-slate-700/50 text-xs text-slate-600">
                    {isDragTarget ? 'Soltar aquí' : 'Sin tareas'}
                  </div>
                )}
                {colEvents.map(event => (
                  <KanbanCard
                    key={event.id}
                    event={event}
                    customers={customers}
                    users={users}
                    checklistCounts={checklistCounts}
                    onDragStart={handleDragStart}
                    onClick={setSelectedEvent}
                  />
                ))}
                {isDragTarget && colEvents.length > 0 && (
                  <div className="h-16 rounded-2xl border-2 border-dashed border-teal-500/40 flex items-center justify-center text-xs text-teal-400">
                    Soltar aquí
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {selectedEvent && (
        <DetailModal
          event={selectedEvent}
          customers={customers}
          users={users}
          userId={userId}
          canEditFully={isAdmin || selectedEvent.created_by === userId}
          onClose={() => setSelectedEvent(null)}
          onSaved={() => { setSelectedEvent(null); onRefresh(); }}
          onDeleted={() => { setSelectedEvent(null); onRefresh(); }}
        />
      )}

      {quickCreate && (
        <QuickCreateModal
          defaultStatus={quickCreate}
          customers={customers}
          users={users}
          userId={userId}
          onClose={() => setQuickCreate(null)}
          onCreated={() => { setQuickCreate(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
