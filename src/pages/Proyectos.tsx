import { useEffect, useState } from 'react';
import {
  FolderKanban, Plus, Trash2, Pencil, Loader2, X, Save,
  Target, CheckSquare, Pause, Play, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  type Project,
  type Goal,
  type Task,
  type Area,
  type Priority,
  type ProjectStatus,
  AREA_CONFIG,
  PRIORITY_CONFIG,
  PROJECT_STATUS_CONFIG,
  getProjects,
  getGoalsWithProgress,
  getTasks,
  createProject,
  updateProject,
  deleteProject,
} from '../lib/planMaestro';

// ─── Form data ────────────────────────────────────────────────────────────────

interface ProjectFormData {
  name: string;
  description: string;
  area: Area;
  status: ProjectStatus;
  priority: Priority;
  start_date: string;
  target_date: string;
  progress: string;
  next_step: string;
  notes: string;
}

const TODAY_STR = new Date().toISOString().split('T')[0];

const EMPTY_FORM: ProjectFormData = {
  name: '',
  description: '',
  area: 'modeltex',
  status: 'activo',
  priority: 'media',
  start_date: TODAY_STR,
  target_date: '',
  progress: '0',
  next_step: '',
  notes: '',
};

function formFromProject(p: Project): ProjectFormData {
  return {
    name: p.name,
    description: p.description ?? '',
    area: p.area,
    status: p.status,
    priority: p.priority,
    start_date: p.start_date ?? '',
    target_date: p.target_date ?? '',
    progress: String(p.progress ?? 0),
    next_step: p.next_step ?? '',
    notes: p.notes ?? '',
  };
}

function formToPayload(f: ProjectFormData): Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    area: f.area,
    status: f.status,
    priority: f.priority,
    start_date: f.start_date || null,
    target_date: f.target_date || null,
    progress: parseInt(f.progress) || 0,
    next_step: f.next_step.trim() || null,
    notes: f.notes.trim() || null,
    color: null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeStatus(p: Project): ProjectStatus {
  return p.status ?? 'activo';
}

function safePriority(p: Project): Priority {
  return p.priority ?? 'media';
}

function isOverdue(p: Project): boolean {
  if (!p.target_date) return false;
  const st = safeStatus(p);
  if (['finalizado', 'cancelado'].includes(st)) return false;
  return p.target_date < TODAY_STR;
}

function daysOverdue(target_date: string): number {
  const d = new Date(target_date + 'T00:00:00');
  const t = new Date(TODAY_STR + 'T00:00:00');
  return Math.floor((t.getTime() - d.getTime()) / 86400000);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Proyectos() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [p, g, t] = await Promise.all([getProjects(), getGoalsWithProgress(), getTasks()]);
      setProjects(p);
      setGoals(g);
      setTasks(t);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const p = await createProject(formToPayload(form));
      setProjects(prev => [...prev, p]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function openEdit(p: Project) {
    setEditProject(p);
    setEditForm(formFromProject(p));
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editProject) return;
    setSaving(true);
    try {
      const payload = formToPayload(editForm);
      await updateProject(editProject.id, payload);
      setProjects(prev => prev.map(p => p.id === editProject.id ? { ...p, ...payload } : p));
      setEditProject(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este proyecto? Las metas y tareas vinculadas no se eliminarán.')) return;
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  async function handleStatusChange(id: string, status: ProjectStatus) {
    try {
      await updateProject(id, { status });
      setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch (e) { console.error(e); }
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 size={32} className="animate-spin text-dorado-400" /></div>;
  }

  const activeProjects  = projects.filter(p => p.status === 'activo');
  const pausedProjects  = projects.filter(p => p.status === 'en_pausa');
  const overdueProjects = projects.filter(isOverdue);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-bordo-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,26,46,0.18),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(184,146,42,0.10),transparent_40%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
            <h1 className="text-2xl font-bold text-white">Proyectos</h1>
            <p className="text-sm text-plata-400 mt-0.5">
              {projects.length} totales · {activeProjects.length} activos
              {pausedProjects.length > 0 && ` · ${pausedProjects.length} en pausa`}
              {overdueProjects.length > 0 && (
                <span className="text-red-400"> · {overdueProjects.length} atrasados</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl font-medium text-sm transition-colors shadow-pm"
          >
            <Plus size={16} /> Nuevo proyecto
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <ProjectForm
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          saving={saving}
          title="Nuevo proyecto"
        />
      )}

      {/* Projects grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FolderKanban size={36} className="text-plata-600" />
          <p className="text-plata-400 font-medium">No hay proyectos definidos.</p>
          <p className="text-plata-500 text-sm">Creá los grandes iniciativas de tu trabajo (ej: CEO ModelTex, Moldey 2.0, Sistemas & IA).</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              goals={goals.filter(g => g.project_id === p.id)}
              tasks={tasks.filter(t => t.project_id === p.id)}
              onEdit={() => openEdit(p)}
              onDelete={() => handleDelete(p.id)}
              onStatusChange={(status) => handleStatusChange(p.id, status)}
            />
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <ProjectForm
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleSaveEdit}
            onCancel={() => setEditProject(null)}
            saving={saving}
            title="Editar proyecto"
            modal
          />
        </div>
      )}
    </div>
  );
}

// ─── ProjectCard ─────────────────────────────────────────────────────────────

function ProjectCard({
  project, goals, tasks, onEdit, onDelete, onStatusChange,
}: {
  project: Project;
  goals: Goal[];
  tasks: Task[];
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: ProjectStatus) => void;
}) {
  const area      = AREA_CONFIG[project.area] ?? AREA_CONFIG['personal'];
  const statusCfg = PROJECT_STATUS_CONFIG[safeStatus(project)];
  const priCfg    = PRIORITY_CONFIG[safePriority(project)];
  const overdue   = isOverdue(project);
  const activeTasks = tasks.filter(t => t.status !== 'hecho').length;
  const doneTasks   = tasks.filter(t => t.status === 'hecho').length;

  return (
    <div className={`group rounded-2xl border bg-plata-900/80 p-5 hover:shadow-pm transition-all flex flex-col gap-4 ${
      overdue ? 'border-red-500/30' : 'border-plata-700/60 hover:border-dorado-500/30'
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${area.bg} ${area.color} ${area.border}`}>
              {area.label}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
              {statusCfg.label}
            </span>
            <span className={`text-[10px] font-medium ${priCfg.color}`}>
              ● {priCfg.label}
            </span>
            {overdue && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-red-400">
                <AlertTriangle size={10} /> Atrasado {daysOverdue(project.target_date!)}d
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white leading-snug">{project.name}</h3>
          {project.description && <p className="text-xs text-plata-400 mt-0.5">{project.description}</p>}
        </div>
        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors" title="Editar">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-plata-500 hover:text-red-400 rounded transition-colors" title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-[10px] text-plata-500 mb-1">
          <span>Progreso</span>
          <span className="text-dorado-400 font-medium">{project.progress}%</span>
        </div>
        <div className="h-2 bg-plata-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-bordo-600 to-dorado-500 rounded-full transition-all"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <Target size={13} className="text-dorado-400" />
          <span className="text-xs text-plata-300">{goals.length} metas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckSquare size={13} className="text-bordo-400" />
          <span className="text-xs text-plata-300">{activeTasks} activas · {doneTasks} hechas</span>
        </div>
        {project.target_date && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={`text-[10px] ${overdue ? 'text-red-400' : 'text-plata-500'}`}>
              {overdue ? '⚠' : '📅'} {project.target_date}
            </span>
          </div>
        )}
      </div>

      {/* Next step */}
      {project.next_step && (
        <div className="rounded-lg bg-dorado-900/20 border border-dorado-500/20 px-2.5 py-1.5">
          <p className="text-[10px] text-dorado-300/60 font-semibold uppercase tracking-wider mb-0.5">Próximo paso</p>
          <p className="text-xs text-dorado-200">{project.next_step}</p>
        </div>
      )}

      {/* Status actions */}
      <div className="flex gap-2 flex-wrap pt-1 border-t border-plata-800/60">
        {safeStatus(project) === 'activo' && (
          <>
            <button
              onClick={() => onStatusChange('en_pausa')}
              className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Pause size={11} /> Pausar
            </button>
            <button
              onClick={() => onStatusChange('finalizado')}
              className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <CheckCircle2 size={11} /> Finalizar
            </button>
          </>
        )}
        {safeStatus(project) === 'en_pausa' && (
          <button
            onClick={() => onStatusChange('activo')}
            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Play size={11} /> Reactivar
          </button>
        )}
        {safeStatus(project) === 'planeado' && (
          <button
            onClick={() => onStatusChange('activo')}
            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Play size={11} /> Activar
          </button>
        )}
        {safeStatus(project) === 'finalizado' && (
          <button
            onClick={() => onStatusChange('activo')}
            className="flex items-center gap-1 text-[10px] text-plata-400 hover:text-plata-300 transition-colors"
          >
            <Play size={11} /> Reabrir
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ProjectForm ──────────────────────────────────────────────────────────────

function ProjectForm({
  form, setForm, onSubmit, onCancel, saving, title, modal,
}: {
  form: ProjectFormData;
  setForm: (f: ProjectFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
  modal?: boolean;
}) {
  const content = (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dorado-300">{title}</h3>
        <button type="button" onClick={onCancel} className="p-1 text-plata-400 hover:text-white rounded-lg">
          <X size={16} />
        </button>
      </div>

      {/* Nombre */}
      <input
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
        placeholder="Nombre del proyecto *"
        className="pm-input"
        required
        autoFocus
      />

      {/* Descripción */}
      <input
        value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })}
        placeholder="Descripción breve"
        className="pm-input"
      />

      {/* Área + Estado */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Negocio / Área</label>
          <select value={form.area} onChange={e => setForm({ ...form, area: e.target.value as Area })} className="pm-input">
            <option value="modeltex">MODELTEX</option>
            <option value="moldey">MOLDEY</option>
            <option value="personal">Personal</option>
            <option value="sistemas">Sistemas</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Estado</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })} className="pm-input">
            <option value="planeado">Planeado</option>
            <option value="activo">Activo</option>
            <option value="en_pausa">En pausa</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Prioridad + Progreso */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Prioridad</label>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })} className="pm-input">
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Progreso (%)</label>
          <input
            type="number" min="0" max="100"
            value={form.progress}
            onChange={e => setForm({ ...form, progress: e.target.value })}
            placeholder="0-100"
            className="pm-input"
          />
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Fecha de inicio</label>
          <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="pm-input" />
        </div>
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Fecha objetivo</label>
          <input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} className="pm-input" />
        </div>
      </div>

      {/* Próximo paso */}
      <div>
        <label className="text-xs text-plata-400 mb-1 block">Próximo paso</label>
        <input
          value={form.next_step}
          onChange={e => setForm({ ...form, next_step: e.target.value })}
          placeholder="¿Qué hay que hacer ahora?"
          className="pm-input"
        />
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs text-plata-400 mb-1 block">Notas</label>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="pm-input resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-bordo-600 hover:bg-bordo-500 text-white rounded-lg transition-colors disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
        </button>
      </div>
    </form>
  );

  if (modal) {
    return (
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg p-5">
        {content}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dorado-500/30 bg-plata-900/90 p-4">
      {content}
    </div>
  );
}
