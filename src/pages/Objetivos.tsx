import { useEffect, useMemo, useState } from 'react';
import {
  Target, FolderKanban, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Calendar,
} from 'lucide-react';
import {
  type Goal, type Project,
  AREA_CONFIG, TIMEFRAME_CONFIG,
  getGoalsWithProgress, getProjects,
} from '../lib/planMaestro';
import Metas from './Metas';
import Proyectos from './Proyectos';

type Tab = 'metas' | 'proyectos' | 'avance' | 'atrasados' | 'finalizados';

const TABS: { key: Tab; label: string }[] = [
  { key: 'metas',       label: 'Metas' },
  { key: 'proyectos',   label: 'Proyectos' },
  { key: 'avance',      label: 'Avance' },
  { key: 'atrasados',   label: 'Atrasados' },
  { key: 'finalizados', label: 'Finalizados' },
];

const TODAY = new Date().toISOString().split('T')[0];

function goalProgress(g: Goal): number {
  if (g.task_count && g.task_count > 0) return Math.round((g.done_task_count! / g.task_count) * 100);
  return g.progress_manual ?? 0;
}

function daysOverdue(deadline: string): number {
  const d = new Date(deadline + 'T00:00:00');
  const t = new Date(TODAY + 'T00:00:00');
  return Math.floor((t.getTime() - d.getTime()) / 86400000);
}

export default function Objetivos() {
  const [tab, setTab] = useState<Tab>('metas');

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
          <p className="text-sm text-plata-400 mt-0.5">Metas, proyectos y avances conectados en un solo lugar.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-plata-700/50 pb-px">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${
              tab === t.key
                ? 'text-dorado-300 border-dorado-400'
                : 'text-plata-400 border-transparent hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'metas' && <Metas />}
      {tab === 'proyectos' && <Proyectos />}
      {tab === 'avance' && <AvanceTab />}
      {tab === 'atrasados' && <AtrasadosTab />}
      {tab === 'finalizados' && <FinalizadosTab />}
    </div>
  );
}

// ─── DATA HOOK ────────────────────────────────────────────────────────────────

function useObjetivosData() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [g, p] = await Promise.all([getGoalsWithProgress(), getProjects()]);
        setGoals(g); setProjects(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  return { goals, projects, loading };
}

// ─── TAB AVANCE ───────────────────────────────────────────────────────────────

function AvanceTab() {
  const { goals, projects, loading } = useObjetivosData();

  const stats = useMemo(() => {
    const completed = goals.filter(g => goalProgress(g) >= 100);
    const active = goals.filter(g => goalProgress(g) < 100);
    const avg = goals.length > 0
      ? Math.round(goals.reduce((s, g) => s + goalProgress(g), 0) / goals.length)
      : 0;
    const upcoming = goals
      .filter(g => g.deadline && g.deadline >= TODAY && goalProgress(g) < 100)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
      .slice(0, 5);
    return { completed, active, avg, upcoming };
  }, [goals]);

  if (loading) return <Loading />;

  if (goals.length === 0 && projects.length === 0) {
    return <Empty text="Todavía no hay metas ni proyectos." sub="Creá metas y proyectos para ver tu avance general." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Metric icon={<Target size={15} className="text-dorado-400" />} label="Metas activas" value={stats.active.length} />
        <Metric icon={<CheckCircle2 size={15} className="text-emerald-400" />} label="Metas completadas" value={stats.completed.length} color="text-emerald-300" />
        <Metric icon={<FolderKanban size={15} className="text-bordo-400" />} label="Proyectos" value={projects.length} />
        <Metric icon={<TrendingUp size={15} className="text-sky-400" />} label="Avance general" value={`${stats.avg}%`} />
        <Metric icon={<Calendar size={15} className="text-plata-400" />} label="Próximas fechas" value={stats.upcoming.length} />
      </div>

      {/* Barra de avance general */}
      {goals.length > 0 && (
        <div className="rounded-xl border border-plata-700/60 bg-plata-900/70 p-4">
          <div className="flex justify-between text-xs text-plata-400 mb-1.5">
            <span>Avance general de metas</span>
            <span className="text-dorado-300 font-bold">{stats.avg}%</span>
          </div>
          <div className="h-2.5 bg-plata-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-bordo-600 to-dorado-500 rounded-full transition-all" style={{ width: `${stats.avg}%` }} />
          </div>
        </div>
      )}

      {/* Próximas fechas */}
      <div className="rounded-xl border border-plata-700/60 bg-plata-900/70 p-4">
        <p className="text-sm font-semibold text-plata-200 mb-3 flex items-center gap-2"><Calendar size={14} className="text-dorado-400" /> Próximas fechas importantes</p>
        {stats.upcoming.length === 0 ? (
          <p className="text-xs text-plata-500">Sin fechas próximas en metas activas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.upcoming.map(g => (
              <div key={g.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-white truncate">{g.title}</span>
                <span className="text-xs text-dorado-300 shrink-0">{g.deadline}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB ATRASADOS ────────────────────────────────────────────────────────────

function AtrasadosTab() {
  const { goals, loading } = useObjetivosData();
  const overdue = useMemo(() =>
    goals
      .filter(g => g.deadline && g.deadline < TODAY && goalProgress(g) < 100)
      .sort((a, b) => daysOverdue(b.deadline!) - daysOverdue(a.deadline!)),
    [goals]);

  if (loading) return <Loading />;
  if (overdue.length === 0) return <Empty text="No hay objetivos atrasados." sub="Todas tus metas con fecha están al día." />;

  return (
    <div className="flex flex-col gap-2">
      {overdue.map(g => {
        const area = AREA_CONFIG[g.area];
        const tf = TIMEFRAME_CONFIG[g.timeframe];
        const dias = daysOverdue(g.deadline!);
        return (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-900/10 px-4 py-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{g.title}</p>
              <div className="flex gap-2 flex-wrap mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-plata-800/60 text-plata-300">Meta</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${area.bg} ${area.color} ${area.border}`}>{area.label}</span>
                <span className={`text-[10px] ${tf.color}`}>{tf.label}</span>
                <span className="text-[10px] text-plata-500">Progreso: {goalProgress(g)}%</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-red-300 font-bold">{dias} {dias === 1 ? 'día' : 'días'}</p>
              <p className="text-[10px] text-plata-500">venció {g.deadline}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB FINALIZADOS ──────────────────────────────────────────────────────────

function FinalizadosTab() {
  const { goals, loading } = useObjetivosData();
  const done = useMemo(() => goals.filter(g => goalProgress(g) >= 100), [goals]);

  if (loading) return <Loading />;
  if (done.length === 0) return <Empty text="Todavía no hay objetivos finalizados." sub="Cuando completes una meta al 100% aparecerá acá." />;

  return (
    <div className="flex flex-col gap-2">
      {done.map(g => {
        const area = AREA_CONFIG[g.area];
        const tf = TIMEFRAME_CONFIG[g.timeframe];
        return (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-900/10 px-4 py-3">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{g.title}</p>
              <div className="flex gap-2 flex-wrap mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-plata-800/60 text-plata-300">Meta</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${area.bg} ${area.color} ${area.border}`}>{area.label}</span>
                <span className={`text-[10px] ${tf.color}`}>{tf.label}</span>
                {g.deadline && <span className="text-[10px] text-plata-500">Límite: {g.deadline}</span>}
              </div>
            </div>
            <span className="text-xs text-emerald-300 font-bold shrink-0">100%</span>
          </div>
        );
      })}
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
