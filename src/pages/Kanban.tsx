import { useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2, Star, Loader2, X, Save } from 'lucide-react';
import {
  type Task,
  type TaskStatus,
  type Area,
  type Priority,
  AREA_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  DEFAULT_BUSINESSES,
  businessBadge,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
} from '../lib/planMaestro';

const COLUMNS: TaskStatus[] = ['inbox', 'hoy', 'en_curso', 'esperando', 'hecho'];

interface TaskFormData {
  title: string;
  area: Area;
  priority: Priority;
  notes: string;
  is_mit: boolean;
  due_date: string;
  status: TaskStatus;
  business: string;
}

const EMPTY_FORM: TaskFormData = {
  title: '', area: 'modeltex', priority: 'media', notes: '',
  is_mit: false, due_date: '', status: 'inbox', business: '',
};

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [showForm, setShowForm] = useState<TaskStatus | null>(null);
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [filterBusiness, setFilterBusiness] = useState<string>('all');
  const dragRef = useRef<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setTasks(await getTasks()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const byStatus = (s: TaskStatus) => tasks.filter(t => {
    if (t.status !== s) return false;
    if (filterBusiness === 'all') return true;
    if (filterBusiness === 'none') return !t.business_key;
    return t.business_key === filterBusiness;
  });

  // Drag handlers
  function onDragStart(e: React.DragEvent, id: string) {
    dragRef.current = id;
    setDragging(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    setDragging(null);
    setDragOver(null);
    dragRef.current = null;
  }

  async function onDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const id = dragRef.current;
    if (!id) return;
    setDragOver(null);
    setDragging(null);
    dragRef.current = null;
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === status) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await moveTask(id, status);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !showForm) return;
    setSaving(true);
    try {
      const t = await createTask({
        title: form.title.trim(),
        area: form.area,
        priority: form.priority,
        notes: form.notes.trim() || null,
        is_mit: form.is_mit,
        status: showForm,
        due_date: form.due_date || null,
        position: 0,
        project_id: null,
        goal_id: null,
        business_key: form.business || null,
      });
      setTasks(prev => [t, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTask) return;
    setSaving(true);
    try {
      await updateTask(editTask.id, {
        title: editTask.title,
        area: editTask.area,
        priority: editTask.priority,
        notes: editTask.notes,
        is_mit: editTask.is_mit,
        due_date: editTask.due_date,
        business_key: editTask.business_key,
      });
      setTasks(prev => prev.map(t => t.id === editTask.id ? editTask : t));
      setEditTask(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar tarea?')) return;
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin text-dorado-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-bordo-500/30 bg-plata-900/80 p-4 shadow-pm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,26,46,0.15),transparent_40%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
          <h1 className="text-xl font-bold text-white">Kanban</h1>
          <p className="text-sm text-plata-400">{tasks.filter(t => t.status !== 'hecho').length} tareas activas · {tasks.filter(t => t.status === 'hecho').length} completadas</p>
        </div>
      </div>

      {/* Filtro por negocio */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {([['all', 'Todas'], ['none', 'Sin negocio']] as [string, string][]).map(([val, lbl]) => (
          <button key={val} onClick={() => setFilterBusiness(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filterBusiness === val ? 'bg-plata-700/60 text-white border-plata-500/50' : 'text-plata-400 border-plata-700/50 hover:text-white'
            }`}>{lbl}</button>
        ))}
        {DEFAULT_BUSINESSES.map(b => (
          <button key={b.key} onClick={() => setFilterBusiness(b.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5 ${
              filterBusiness === b.key ? 'text-white border-current' : 'text-plata-400 border-plata-700/50 hover:text-white'
            }`}
            style={filterBusiness === b.key ? { backgroundColor: `${b.color}33`, borderColor: b.color } : undefined}>
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: b.color }} />{b.name}
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {COLUMNS.map(col => {
            const cfg = STATUS_CONFIG[col];
            const colTasks = byStatus(col);
            const isDragTarget = dragOver === col;
            return (
              <div
                key={col}
                className={`w-64 flex flex-col rounded-2xl border transition-all ${cfg.bg} ${
                  isDragTarget ? 'border-dorado-400/60 ring-2 ring-dorado-400/20' : 'border-plata-700/50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(col); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, col)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-plata-700/50">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-plata-500 bg-plata-800/60 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>
                  <button
                    onClick={() => { setShowForm(col); setForm({ ...EMPTY_FORM, status: col }); }}
                    className="p-1 rounded-lg text-plata-500 hover:text-dorado-300 hover:bg-dorado-900/30 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Quick create form */}
                {showForm === col && (
                  <form onSubmit={handleCreate} className="p-3 border-b border-plata-700/50 flex flex-col gap-2">
                    <input
                      autoFocus
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Título de la tarea"
                      className="pm-input text-xs"
                      required
                    />
                    <div className="flex gap-2">
                      <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value as Area }))} className="pm-input text-xs flex-1">
                        {(Object.keys(AREA_CONFIG) as Area[]).map(a => (
                          <option key={a} value={a}>{AREA_CONFIG[a].label}</option>
                        ))}
                      </select>
                      <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))} className="pm-input text-xs flex-1">
                        {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => (
                          <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                        ))}
                      </select>
                    </div>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="pm-input text-xs" />
                    <select value={form.business} onChange={e => setForm(f => ({ ...f, business: e.target.value }))} className="pm-input text-xs">
                      <option value="">Sin negocio</option>
                      {DEFAULT_BUSINESSES.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-plata-300 cursor-pointer">
                      <input type="checkbox" checked={form.is_mit} onChange={e => setForm(f => ({ ...f, is_mit: e.target.checked }))} className="accent-dorado-500" />
                      <Star size={11} className="text-dorado-400" /> MIT
                    </label>
                    <div className="flex gap-1.5">
                      <button type="submit" disabled={saving} className="flex-1 py-1.5 text-xs font-semibold bg-bordo-600 hover:bg-bordo-500 text-white rounded-lg transition-colors disabled:opacity-60">
                        {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Agregar'}
                      </button>
                      <button type="button" onClick={() => setShowForm(null)} className="p-1.5 text-plata-400 hover:text-white rounded-lg border border-plata-700 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  </form>
                )}

                {/* Cards */}
                <div className="flex-1 p-2 flex flex-col gap-2 min-h-[120px]">
                  {colTasks.map(t => (
                    <KanbanCard
                      key={t.id}
                      task={t}
                      isDragging={dragging === t.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onEdit={() => setEditTask({ ...t })}
                      onDelete={() => handleDelete(t.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit modal */}
      {editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleSaveEdit} className="w-full max-w-md rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Editar tarea</h3>
              <button type="button" onClick={() => setEditTask(null)} className="p-1 text-plata-400 hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>
            <input value={editTask.title} onChange={e => setEditTask(t => t ? { ...t, title: e.target.value } : t)} className="pm-input" required />
            <textarea value={editTask.notes ?? ''} onChange={e => setEditTask(t => t ? { ...t, notes: e.target.value } : t)} placeholder="Notas" rows={2} className="pm-input resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-plata-400 mb-1 block">Área</label>
                <select value={editTask.area} onChange={e => setEditTask(t => t ? { ...t, area: e.target.value as Area } : t)} className="pm-input">
                  {(Object.keys(AREA_CONFIG) as Area[]).map(a => <option key={a} value={a}>{AREA_CONFIG[a].label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-plata-400 mb-1 block">Prioridad</label>
                <select value={editTask.priority} onChange={e => setEditTask(t => t ? { ...t, priority: e.target.value as Priority } : t)} className="pm-input">
                  {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-plata-400 mb-1 block">Fecha límite</label>
                <input type="date" value={editTask.due_date ?? ''} onChange={e => setEditTask(t => t ? { ...t, due_date: e.target.value || null } : t)} className="pm-input" />
              </div>
              <div>
                <label className="text-xs text-plata-400 mb-1 block">Negocio</label>
                <select value={editTask.business_key ?? ''} onChange={e => setEditTask(t => t ? { ...t, business_key: e.target.value || null } : t)} className="pm-input">
                  <option value="">Ninguno</option>
                  {DEFAULT_BUSINESSES.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-plata-300 cursor-pointer">
              <input type="checkbox" checked={editTask.is_mit} onChange={e => setEditTask(t => t ? { ...t, is_mit: e.target.checked } : t)} className="accent-dorado-500" />
              <Star size={14} className="text-dorado-400" /> Marcar como MIT
            </label>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setEditTask(null)} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-bordo-600 hover:bg-bordo-500 text-white rounded-lg transition-colors disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function KanbanCard({
  task, isDragging, onDragStart, onDragEnd, onEdit, onDelete,
}: {
  task: Task;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const area = AREA_CONFIG[task.area];
  const prio = PRIORITY_CONFIG[task.priority];
  const biz = businessBadge(task.business_key);
  const today = new Date().toISOString().split('T')[0];
  const overdue = task.due_date && task.due_date < today && task.status !== 'hecho';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border bg-plata-900 p-3 cursor-grab active:cursor-grabbing transition-all select-none ${
        isDragging ? 'opacity-40 border-dorado-400/60 shadow-pm' : 'border-plata-700/60 hover:border-dorado-500/40 hover:shadow-pm'
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-plata-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1 justify-between">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 flex-1">{task.title}</p>
            {task.is_mit && <Star size={12} className="text-dorado-400 shrink-0 mt-0.5" />}
          </div>
          {task.notes && <p className="text-xs text-plata-500 mt-0.5 line-clamp-1">{task.notes}</p>}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${area.bg} ${area.color} ${area.border} border`}>
              {area.label}
            </span>
            {biz && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold border flex items-center gap-1"
                style={{ color: biz.color, borderColor: `${biz.color}66`, backgroundColor: `${biz.color}22` }}>
                {biz.name}
              </span>
            )}
            <span className={`text-[10px] font-medium flex items-center gap-1 ${prio.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
              {prio.label}
            </span>
            {task.due_date && (
              <span className={`text-[10px] font-medium ${overdue ? 'text-red-400' : 'text-plata-500'}`}>
                {overdue ? '⚠ ' : ''}{task.due_date}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1 mt-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 text-plata-500 hover:text-dorado-300 rounded transition-colors">
          <Plus size={12} />
        </button>
        <button onClick={onDelete} className="p-1 text-plata-500 hover:text-red-400 rounded transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
