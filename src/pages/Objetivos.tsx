import { useEffect, useMemo, useState } from 'react';
import {
  Target, FolderKanban, TrendingUp, AlertTriangle, CheckCircle2,
  Loader2, Calendar, ListChecks, Pause,
} from 'lucide-react';
import {
  type Goal, type Project, type Task,
  AREA_CONFIG, TIMEFRAME_CONFIG, PRIORITY_CONFIG, PROJECT_STATUS_CONFIG,
  getGoalsWithProgress, getProjects, getTasks,
} from '../lib/planMaestro';
import Metas from './Metas';
import Proyectos from './Proyectos';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'proyectos' | 'metas' | 'tareas' | 'avance' | 'atrasados' | 'finalizados' | 'en_pausa';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'proyectos',   label: 'Proyectos',   icon: <FolderKanban size={13} /> },
  { key: 'metas',       label: 'Metas',       icon: <Target size={13} /> },
  { key: 'tareas',      label: 'Tareas',      icon: <ListChecks size={13} /> },
  { key: 'avance',      label: 'Avance',      icon: <TrendingUp size={13} /> },
  { key: 'atrasados',   label: 'Atrasados',   icon: <AlertTriangle size={13} /> },
  { key: 'finalizados', label: 'Finalizados', icon: <CheckCircle2 size={13} /> },
  { key: 'en_pausa',    label: 'En pausa',    icon: <Pause size={13} /> },
];

const TODAY = new Date().toISOString().split('T')[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function goalProgress(g: Goal): number {
  if (g.task_count && g.task_count > 0) return Math.round((g.done_task_count! / g.task_count) * 100);
  return g.progress_manual ?? 0;
}

function daysOverdue(date: string): number {
  const d = new Date(date + 'T00:00:00');
  const t = new Date(TODAY + 'T00:00:00');
  return Math.floor((t.getTime() - d.getTime()) / 86400000);
}

function safeProjectStatus(p: Project) {
  return p.status ?? 'activo';
}

function isProjectOverdue(p: Project): boolean {
  if (!p.target_date) return false;
  if (['finalizado', 'cancelado'].includes(safeProjectStatus(p))) return false;
  return p.target_date < TODAY;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Objetivos() {
  const [tab, setTab] = useState<Tab>('proyectos');

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-dorado-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,146,42,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(139,26,46,0.10),transparent_40%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target size={22} className="text-dorado-400" /> Objetivos
          </h1>
          <p className="text-sm text-plata-400 mt-0.5">Proyectos, metas y tareas conectados en un solo lugar.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-plata-700/50 pb-px">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${
              tab === t.key
                ? 'text-dorado-300 border-dorado-400'
                : 'text-plata-400 border-transparent hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'proyectos'   && <Proyectos />}
      {tab === 'metas'       && <Metas />}
      {tab === 'tareas'      && <TareasTab />}
      {tab === 'avance'      && <AvanceTab />}
      {tab === 'atrasados'   && <AtrasadosTab />}
      {tab === 'finalizados' && <FinalizadosTab />}
      {tab === 'en_pausa'    && <EnPausaTab />}
    </div>
  );
}

// ─── DATA HOOK ────────────────────────────────────────────────────────────────

function useObjetivosData() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [g, p, t] = await Promise.all([getGoalsWithProgress(), getProjects(), getTasks()]);
        setGoals(g); setProjects(p); setTasks(t);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  return { goals, projects, tasks, loading };
}

// ─── TAB TAREAS ───────────────────────────────────────────────────────────────

function TareasTab() {
  const { tasks, loading } = useObjetivosData();

  const activeTasks = useMemo(() =>
    tasks
      .filter(t => t.status !== 'hecho')
      .sort((a, b) => {
        // MITs primero, luego por prioridad, luego por fecha
        if (a.is_mit !== b.is_mit) return a.is_mit ? -1 : 1;
        const priOrder = { alta: 0, media: 1, baja: 2 };
        if (a.priority !== b.priority) return priOrder[a.priority] - priOrder[b.priority];
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      })
      .slice(0, 50),
    [tasks]
  );

  if (loading) return <Loading />;
  if (activeTasks.length === 0) return <Empty text="No hay tareas activas." sub="Las tareas aparecerán acá desde tu Kanban." />;

  const overdueTasks = activeTasks.filter(t => t.due_date && t.due_date < TODAY);

  return (
    <div className="flex flex-col gap-3">
      {overdueTasks.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/10 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertTriangle size={13} />
          {overdueTasks.length} {overdueTasks.length === 1 ? 'tarea atrasada' : 'tareas atrasadas'}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {activeTasks.map(t => {
          const area = AREA_CONFIG[t.area];
          const pri  = PRIORITY_CONFIG[t.priority];
          const overdue = t.due_date && t.due_date < TODAY;
          return (
            <div key={t.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              overdue ? 'border-red-500/20 bg-red-900/10' : 'border-plata-700/50 bg-plata-900/60'
            }`}>
              {t.is_mit && <span className="text-[9px] font-bold text-dorado-300 bg-dorado-900/40 border border-dorado-500/30 px-1.5 py-0.5 rounded shrink-0">MIT</span>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{t.title}</p>
                <div className="flex gap-1.5 flex-wrap mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${area.bg} ${area.color} ${area.border}`}>{area.label}</span>
                  <span className={`text-[10px] font-medium ${pri.color}`}>● {pri.label}</span>
                  {t.due_date && (
                    <span className={`text-[10px] ${overdue ? 'text-red-400' : 'text-plata-500'}`}>
                      {overdue ? '⚠' : '📅'} {t.due_date}
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                t.status === 'hoy' ? 'bg-dorado-900/40 text-dorado-300'
                : t.status === 'en_curso' ? 'bg-bordo-900/40 text-bordo-300'
                : t.status === 'esperando' ? 'bg-amber-900/30 text-amber-300'
                : 'bg-plata-700/40 text-plata-300'
              }`}>
                {t.status === 'hoy' ? 'Hoy' : t.status === 'en_curso' ? 'En curso' : t.status === 'esperando' ? 'Esperando' : 'Inbox'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB AVANCE ───────────────────────────────────────────────────────────────

function AvanceTab() {
  const { goals, projects, tasks, loading } = useObjetivosData();

  const stats = useMemo(() => {
    // Proyectos
    const projActive    = projects.filter(p => safeProjectStatus(p) === 'activo');
    const projPaused    = projects.filter(p => safeProjectStatus(p) === 'en_pausa');
    const projFinished  = projects.filter(p => safeProjectStatus(p) === 'finalizado');
    const projOverdue   = projects.filter(isProjectOverdue);
    const projAvgProgress = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (p.progress ?? 0), 0) / projects.length)
      : 0;

    // Metas
    const goalsCompleted = goals.filter(g => goalProgress(g) >= 100);
    const goalsActive    = goals.filter(g => goalProgress(g) < 100);
    const goalsAvg       = goals.length > 0
      ? Math.round(goals.reduce((s, g) => s + goalProgress(g), 0) / goals.length)
      : 0;

    // Tareas
    const tasksPending = tasks.filter(t => t.status !== 'hecho').length;

    // Próximos vencimientos (proyectos + metas)
    const upcoming: Array<{ name: string; date: string; type: string }> = [
      ...projects
        .filter(p => p.target_date && p.target_date >= TODAY && !['finalizado','cancelado'].includes(p.status))
        .map(p => ({ name: p.name, date: p.target_date!, type: 'Proyecto' })),
      ...goals
        .filter(g => g.deadline && g.deadline >= TODAY && goalProgress(g) < 100)
        .map(g => ({ name: g.title, date: g.deadline!, type: 'Meta' })),
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

    return { projActive, projPaused, projFinished, projOverdue, projAvgProgress, goalsCompleted, goalsActive, goalsAvg, tasksPending, upcoming };
  }, [goals, projects, tasks]);

  if (loading) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Metric icon={<FolderKanban size={15} className="text-bordo-400" />} label="Proyectos activos" value={stats.projActive.length} />
        <Metric icon={<Pause size={15} className="text-amber-400" />} label="En pausa" value={stats.projPaused.length} />
        <Metric icon={<CheckCircle2 size={15} className="text-emerald-400" />} label="Finalizados" value={stats.projFinished.length} color="text-emerald-300" />
        <Metric icon={<TrendingUp size={15} className="text-dorado-400" />} label="Avance promedio" value={`${stats.projAvgProgress}%`} />
        <Metric icon={<Target size={15} className="text-dorado-400" />} label="Metas activas" value={stats.goalsActive.length} />
        <Metric icon={<CheckCircle2 size={15} className="text-emerald-400" />} label="Metas completadas" value={stats.goalsCompleted.length} color="text-emerald-300" />
        <Metric icon={<ListChecks size={15} className="text-plata-400" />} label="Tareas pendientes" value={stats.tasksPending} />
        {stats.projOverdue.length > 0 && (
          <Metric icon={<AlertTriangle size={15} className="text-red-400" />} label="Proyectos atrasados" value={stats.projOverdue.length} color="text-red-300" />
        )}
      </div>

      {/* Barra avance proyectos */}
      {projects.length > 0 && (
        <div className="rounded-xl border border-plata-700/60 bg-plata-900/70 p-4">
          <div className="flex justify-between text-xs text-plata-400 mb-1.5">
            <span>Avance promedio de proyectos</span>
            <span className="text-dorado-300 font-bold">{stats.projAvgProgress}%</span>
          </div>
          <div className="h-2.5 bg-plata-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-bordo-600 to-dorado-500 rounded-full transition-all" style={{ width: `${stats.projAvgProgress}%` }} />
          </div>
        </div>
      )}

      {/* Barra avance metas */}
      {goals.length > 0 && (
        <div className="rounded-xl border border-plata-700/60 bg-plata-900/70 p-4">
          <div className="flex justify-between text-xs text-plata-400 mb-1.5">
            <span>Avance general de metas</span>
            <span className="text-dorado-300 font-bold">{stats.goalsAvg}%</span>
          </div>
          <div className="h-2 bg-plata-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-bordo-600 to-dorado-500 rounded-full transition-all" style={{ width: `${stats.goalsAvg}%` }} />
          </div>
        </div>
      )}

      {/* Próximos vencimientos */}
      {stats.upcoming.length > 0 && (
        <div className="rounded-xl border border-plata-700/60 bg-plata-900/70 p-4">
          <p className="text-sm font-semibold text-plata-200 mb-3 flex items-center gap-2">
            <Calendar size={14} className="text-dorado-400" /> Próximas fechas importantes
          </p>
          <div className="flex flex-col gap-2">
            {stats.upcoming.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-plata-800/60 text-plata-400 shrink-0">{item.type}</span>
                  <span className="text-white truncate">{item.name}</span>
                </div>
                <span className="text-xs text-dorado-300 shrink-0">{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {projects.length === 0 && goals.length === 0 && (
        <Empty text="Todavía no hay proyectos ni metas." sub="Creá proyectos y metas para ver tu avance general." />
      )}
    </div>
  );
}

// ─── TAB ATRASADOS ────────────────────────────────────────────────────────────

function AtrasadosTab() {
  const { goals, projects, tasks, loading } = useObjetivosData();

  const items = useMemo(() => {
    const result: Array<{
      id: string; type: 'Proyecto' | 'Meta' | 'Tarea';
      name: string; date: string; dias: number;
      priority: string; status: string; area: string;
    }> = [];

    // Proyectos atrasados
    projects
      .filter(isProjectOverdue)
      .forEach(p => result.push({
        id: p.id, type: 'Proyecto',
        name: p.name, date: p.target_date!,
        dias: daysOverdue(p.target_date!),
        priority: p.priority ?? 'media',
        status: PROJECT_STATUS_CONFIG[safeProjectStatus(p)]?.label ?? 'Activo',
        area: (AREA_CONFIG[p.area] ?? AREA_CONFIG['personal']).label,
      }));

    // Metas atrasadas
    goals
      .filter(g => g.deadline && g.deadline < TODAY && goalProgress(g) < 100)
      .forEach(g => result.push({
        id: g.id, type: 'Meta',
        name: g.title, date: g.deadline!,
        dias: daysOverdue(g.deadline!),
        priority: '', status: `${goalProgress(g)}%`,
        area: AREA_CONFIG[g.area].label,
      }));

    // Tareas atrasadas
    tasks
      .filter(t => t.due_date && t.due_date < TODAY && t.status !== 'hecho')
      .forEach(t => result.push({
        id: t.id, type: 'Tarea',
        name: t.title, date: t.due_date!,
        dias: daysOverdue(t.due_date!),
        priority: t.priority, status: t.status,
        area: AREA_CONFIG[t.area].label,
      }));

    return result.sort((a, b) => b.dias - a.dias);
  }, [goals, projects, tasks]);

  if (loading) return <Loading />;
  if (items.length === 0) return <Empty text="No hay ítems atrasados." sub="¡Bien! Todo está al día." />;

  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-900/10 px-4 py-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{item.name}</p>
            <div className="flex gap-2 flex-wrap mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-plata-800/60 text-plata-300">{item.type}</span>
              <span className="text-[10px] text-plata-400">{item.area}</span>
              <span className="text-[10px] text-plata-500">{item.status}</span>
              {item.priority && (
                <span className={`text-[10px] font-medium ${PRIORITY_CONFIG[item.priority as 'alta'|'media'|'baja']?.color ?? 'text-plata-400'}`}>
                  ● {PRIORITY_CONFIG[item.priority as 'alta'|'media'|'baja']?.label}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-red-300 font-bold">{item.dias}d</p>
            <p className="text-[10px] text-plata-500">venció {item.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TAB FINALIZADOS ──────────────────────────────────────────────────────────

function FinalizadosTab() {
  const { goals, projects, tasks, loading } = useObjetivosData();

  const items = useMemo(() => {
    const result: Array<{
      id: string; type: 'Proyecto' | 'Meta' | 'Tarea';
      name: string; date: string | null; progress: number; area: string;
    }> = [];

    projects
      .filter(p => safeProjectStatus(p) === 'finalizado')
      .forEach(p => result.push({
        id: p.id, type: 'Proyecto',
        name: p.name, date: p.target_date,
        progress: p.progress ?? 100,
        area: (AREA_CONFIG[p.area] ?? AREA_CONFIG['personal']).label,
      }));

    goals
      .filter(g => goalProgress(g) >= 100)
      .forEach(g => result.push({
        id: g.id, type: 'Meta',
        name: g.title, date: g.deadline,
        progress: 100, area: AREA_CONFIG[g.area].label,
      }));

    tasks
      .filter(t => t.status === 'hecho')
      .slice(0, 30) // limitar tareas completadas
      .forEach(t => result.push({
        id: t.id, type: 'Tarea',
        name: t.title, date: t.due_date,
        progress: 100, area: AREA_CONFIG[t.area].label,
      }));

    return result;
  }, [goals, projects, tasks]);

  if (loading) return <Loading />;
  if (items.length === 0) return <Empty text="Todavía no hay ítems finalizados." sub="Cuando completes proyectos, metas o tareas aparecerán acá." />;

  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-900/10 px-4 py-3">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{item.name}</p>
            <div className="flex gap-2 flex-wrap mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-plata-800/60 text-plata-300">{item.type}</span>
              <span className="text-[10px] text-plata-400">{item.area}</span>
              {item.date && <span className="text-[10px] text-plata-500">Fecha: {item.date}</span>}
            </div>
          </div>
          <span className="text-xs text-emerald-300 font-bold shrink-0">{item.progress}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── TAB EN PAUSA ─────────────────────────────────────────────────────────────

function EnPausaTab() {
  const { projects, loading } = useObjetivosData();
  const pausedProjects = useMemo(() => projects.filter(p => safeProjectStatus(p) === 'en_pausa'), [projects]);

  if (loading) return <Loading />;
  if (pausedProjects.length === 0) return <Empty text="No hay proyectos en pausa." sub="Los proyectos pausados aparecerán acá." />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-plata-500">
        Para reactivar un proyecto, entrá a <span className="text-dorado-400">Proyectos</span> y usá el botón "Reactivar" en la tarjeta.
      </p>
      <div className="flex flex-col gap-2">
        {pausedProjects.map(p => {
          const area = AREA_CONFIG[p.area] ?? AREA_CONFIG['personal'];
          const pri  = PRIORITY_CONFIG[p.priority ?? 'media'];
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-900/10 px-4 py-3">
              <Pause size={16} className="text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.name}</p>
                <div className="flex gap-2 flex-wrap mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-plata-800/60 text-plata-300">Proyecto</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${area.bg} ${area.color} ${area.border}`}>{area.label}</span>
                  <span className={`text-[10px] font-medium ${pri.color}`}>● {pri.label}</span>
                  {p.notes && <span className="text-[10px] text-plata-500 truncate max-w-[200px]">{p.notes}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-dorado-300 font-bold">{p.progress}%</p>
                {p.target_date && <p className="text-[10px] text-plata-500">Obj: {p.target_date}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-plata-400">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className={`text-xl font-bold ${color ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function Loading() {
  return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-dorado-400" /></div>;
}

function Empty({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Target size={28} className="text-plata-600" />
      <p className="text-plata-300 font-medium">{text}</p>
      <p className="text-plata-500 text-sm max-w-sm">{sub}</p>
    </div>
  );
}
