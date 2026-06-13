import { useEffect, useState } from 'react';
import { Star, CheckCircle2, Circle, Calendar, AlertCircle, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import {
  type Task,
  type Area,
  type Priority,
  AREA_CONFIG,
  PRIORITY_CONFIG,
  businessBadge,
  getTodayTasks,
  updateTask,
  deleteTask,
  createTask,
} from '../lib/planMaestro';

const TODAY = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const TODAY_ISO = new Date().toISOString().split('T')[0];

interface TaskFormData {
  title: string;
  area: Area;
  priority: Priority;
  notes: string;
  is_mit: boolean;
}

const EMPTY_FORM: TaskFormData = { title: '', area: 'modeltex', priority: 'alta', notes: '', is_mit: true };

export default function Hoy() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setTasks(await getTodayTasks()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const mitTasks = tasks.filter(t => t.is_mit).slice(0, 3);
  const otherTasks = tasks.filter(t => !t.is_mit);

  async function toggleDone(t: Task) {
    const newStatus = t.status === 'hecho' ? 'hoy' : 'hecho';
    await updateTask(t.id, { status: newStatus });
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: newStatus } : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const t = await createTask({
        title: form.title.trim(),
        area: form.area,
        priority: form.priority,
        notes: form.notes.trim() || null,
        is_mit: form.is_mit,
        status: 'hoy',
        due_date: TODAY_ISO,
        position: 0,
        project_id: null,
        goal_id: null,
        business_key: null,
      });
      setTasks(prev => [t, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-bordo-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,26,46,0.18),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(184,146,42,0.10),transparent_40%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
            <h1 className="text-2xl font-bold text-white capitalize">{TODAY}</h1>
            <p className="text-sm text-plata-400 mt-0.5">
              {mitTasks.length} MIT · {otherTasks.length} tareas adicionales
            </p>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl font-medium text-sm transition-colors shadow-pm"
          >
            <Plus size={16} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* Quick form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-dorado-500/30 bg-plata-900/90 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-dorado-300">Nueva tarea para hoy</h3>
          <input
            autoFocus
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="¿Qué hay que hacer?"
            className="pm-input"
            required
          />
          <div className="flex gap-3 flex-wrap">
            <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value as Area }))} className="pm-input flex-1">
              {(Object.keys(AREA_CONFIG) as Area[]).map(a => (
                <option key={a} value={a}>{AREA_CONFIG[a].label}</option>
              ))}
            </select>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))} className="pm-input flex-1">
              {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-plata-300 cursor-pointer">
              <input type="checkbox" checked={form.is_mit} onChange={e => setForm(f => ({ ...f, is_mit: e.target.checked }))} className="accent-dorado-500" />
              <Star size={14} className="text-dorado-400" /> MIT
            </label>
          </div>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notas (opcional)"
            rows={2}
            className="pm-input resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-plata-300 hover:text-white rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-bordo-600 hover:bg-bordo-500 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Agregar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-dorado-400" />
        </div>
      ) : (
        <>
          {/* MIT Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Star size={16} className="text-dorado-400" />
              <h2 className="text-sm font-bold text-dorado-300 uppercase tracking-widest">Most Important Tasks</h2>
              <span className="text-xs text-plata-500">({mitTasks.length}/3)</span>
            </div>
            {mitTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-dorado-500/30 p-6 text-center text-sm text-plata-500">
                No hay tareas MIT para hoy. Marcá hasta 3 tareas como prioridad.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {mitTasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggleDone} onDelete={handleDelete} />)}
              </div>
            )}
          </section>

          {/* Other tasks */}
          {otherTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-plata-400" />
                <h2 className="text-sm font-bold text-plata-300 uppercase tracking-widest">Otras tareas de hoy</h2>
              </div>
              <div className="flex flex-col gap-2">
                {otherTasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggleDone} onDelete={handleDelete} />)}
              </div>
            </section>
          )}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertCircle size={36} className="text-plata-600" />
              <p className="text-plata-400 font-medium">No hay tareas para hoy.</p>
              <p className="text-plata-500 text-sm">Agregá tareas o mové algunas al estado "Hoy" desde el Kanban.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: (t: Task) => void; onDelete: (id: string) => void }) {
  const area = AREA_CONFIG[task.area];
  const biz = businessBadge(task.business_key);
  const done = task.status === 'hecho';
  return (
    <div className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      done ? 'border-plata-700/40 bg-plata-800/30 opacity-60' : 'border-plata-700/60 bg-plata-900/70 hover:border-dorado-500/30'
    }`}>
      <button onClick={() => onToggle(task)} className="shrink-0 text-plata-400 hover:text-dorado-300 transition-colors">
        {done ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Circle size={20} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${done ? 'line-through text-plata-500' : 'text-white'}`}>{task.title}</p>
        {task.notes && <p className="text-xs text-plata-500 truncate mt-0.5">{task.notes}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.is_mit && <Star size={13} className="text-dorado-400" />}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${area.bg} ${area.color} ${area.border} border`}>
          {area.label}
        </span>
        {biz && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold border"
            style={{ color: biz.color, borderColor: `${biz.color}66`, backgroundColor: `${biz.color}22` }}>
            {biz.name}
          </span>
        )}
        <span className={`text-xs font-medium ${PRIORITY_CONFIG[task.priority].color}`}>
          {PRIORITY_CONFIG[task.priority].label}
        </span>
      </div>
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1 text-plata-600 hover:text-red-400 transition-all rounded"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
