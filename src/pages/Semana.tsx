import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, ChevronLeft, ChevronRight, Plus, Target, Flame, Trash2,
  Link2, Star, AlertTriangle, CheckCircle2, Lock, TrendingUp, Sparkles,
} from 'lucide-react';
import {
  type Task, type Project, type Business,
  type WeeklyPlan, type WeeklyGoal, type WeeklyTaskLink, type WeeklyColumn,
  type WeeklyGoalStatus, type WeeklyIndicators, type Priority,
  WEEKLY_COLUMNS, WEEKLY_GOAL_STATUS_CONFIG, PRIORITY_CONFIG, DEFAULT_BUSINESSES,
  businessBadge,
  getTasks, getProjects, getBusinesses, updateTask,
  getWeekStart, getWeekDays,
  getOrCreateWeeklyPlan, updateWeeklyPlan,
  getWeeklyGoals, createWeeklyGoal, updateWeeklyGoal, deleteWeeklyGoal,
  getWeeklyTaskLinks, linkTaskToWeek, updateWeeklyTaskLink, unlinkTaskFromWeek,
  getWeeklyWorkedMinutes, createJournalEntry,
} from '../lib/planMaestro';

const TODAY_ISO = new Date().toISOString().split('T')[0];

// Mapea columna semanal → status real de la tarea (sincronización con Kanban principal)
const COLUMN_TO_STATUS: Partial<Record<WeeklyColumn, Task['status']>> = {
  proceso: 'en_curso',
  bloqueado: 'esperando',
  hecho: 'hecho',
};

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function weekLabel(weekStart: string) {
  const days = getWeekDays(weekStart);
  const a = new Date(days[0] + 'T00:00:00');
  const b = new Date(days[6] + 'T00:00:00');
  const f = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return `${f(a)} — ${f(b)}`;
}

export default function SemanaTab() {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [links, setLinks] = useState<WeeklyTaskLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [worked, setWorked] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, gs, lk, ts, pr, bs, wk] = await Promise.all([
        getOrCreateWeeklyPlan(weekStart),
        getWeeklyGoals(weekStart),
        getWeeklyTaskLinks(weekStart),
        getTasks(),
        getProjects(),
        getBusinesses().catch(() => [] as Business[]),
        getWeeklyWorkedMinutes(weekStart).catch(() => ({} as Record<string, number>)),
      ]);
      setPlan(pl); setGoals(gs); setLinks(lk);
      setTasks(ts); setProjects(pr);
      setBusinesses(bs.length ? bs : DEFAULT_BUSINESSES.map(b => ({ key: b.key, name: b.name } as Business)));
      setWorked(wk);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const isCurrentWeek = weekStart === getWeekStart();

  function shiftWeek(deltaDays: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(getWeekStart(d));
  }

  if (loading || !plan) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-dorado-400" /></div>;
  }

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const linkedTaskIds = new Set(links.map(l => l.task_id));

  // ── Regla 1-3-5 ──
  const criticalGoals = goals.filter(g => g.is_critical).length;
  const criticalTasks = links.filter(l => l.is_critical).length;
  const hasFoco = !!plan.focus_title?.trim();
  const warn135 = criticalGoals > 3 || criticalTasks > 5;

  // ── Avance ──
  const goalsDone = goals.filter(g => g.status === 'hecha').length;
  const goalsPct = goals.length ? Math.round((goalsDone / goals.length) * 100) : 0;
  const linkTasks = links.map(l => taskById.get(l.task_id)).filter(Boolean) as Task[];
  const linkDone = linkTasks.filter(t => t.status === 'hecho').length;
  const tasksPct = linkTasks.length ? Math.round((linkDone / linkTasks.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header + nav semanas */}
      <div className="relative overflow-hidden rounded-2xl border border-dorado-500/20 bg-plata-900/80 p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">AGENDA · SEMANA</p>
          <h2 className="text-xl font-bold text-white">Control operativo semanal</h2>
          <p className="text-sm text-plata-400 mt-0.5 capitalize">
            {weekLabel(weekStart)} {isCurrentWeek && <span className="text-dorado-400">· semana actual</span>}
            {plan.closed && <span className="text-fuchsia-400"> · cerrada</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftWeek(-7)} className="p-2 rounded-lg hover:bg-plata-800 text-plata-300 hover:text-white"><ChevronLeft size={18} /></button>
          {!isCurrentWeek && (
            <button onClick={() => setWeekStart(getWeekStart())} className="text-xs px-2 py-1 rounded-lg text-dorado-300 border border-dorado-500/30 hover:bg-dorado-900/20">Hoy</button>
          )}
          <button onClick={() => shiftWeek(7)} className="p-2 rounded-lg hover:bg-plata-800 text-plata-300 hover:text-white"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Regla 1-3-5 */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap text-xs ${warn135 ? 'border-amber-500/40 bg-amber-900/15' : 'border-plata-700/50 bg-plata-900/50'}`}>
        <span className="font-semibold text-plata-300">Regla 1-3-5:</span>
        <Chip ok={hasFoco} label={`${hasFoco ? 1 : 0}/1 Foco`} />
        <Chip ok={criticalGoals <= 3} label={`${criticalGoals}/3 Metas críticas`} />
        <Chip ok={criticalTasks <= 5} label={`${criticalTasks}/5 Tareas críticas`} />
        {warn135 && <span className="text-amber-300 flex items-center gap-1"><AlertTriangle size={12} /> Estás sobrecargando la semana. Recortá para mantener foco.</span>}
      </div>

      <FocoBlock plan={plan} projects={projects} businesses={businesses} onSaved={setPlan} />

      <IndicadoresBlock plan={plan} businesses={businesses} worked={worked} onSaved={setPlan} />

      <MetasBlock
        weekStart={weekStart} goals={goals} projects={projects} businesses={businesses}
        onChange={setGoals}
      />

      <KanbanBlock
        weekStart={weekStart} links={links} taskById={taskById}
        availableTasks={tasks.filter(t => !linkedTaskIds.has(t.id) && t.status !== 'hecho')}
        onChange={(l, t) => { setLinks(l); if (t) setTasks(t); }}
        tasks={tasks}
      />

      <AvanceBlock plan={plan} businesses={businesses} worked={worked} goalsPct={goalsPct} tasksPct={tasksPct} goalsDone={goalsDone} goalsTotal={goals.length} linkDone={linkDone} linkTotal={linkTasks.length} />

      <CierreBlock
        plan={plan} weekStart={weekStart}
        goals={goals} goalsDone={goalsDone} linkDone={linkDone} linkTotal={linkTasks.length}
        onClosed={setPlan}
      />
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border font-semibold ${ok ? 'text-emerald-300 border-emerald-600/40 bg-emerald-900/20' : 'text-amber-300 border-amber-600/40 bg-amber-900/20'}`}>
      {label}
    </span>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-plata-700/50 bg-plata-900/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-dorado-400">{icon}</span>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

// ─── BLOQUE 1: FOCO ────────────────────────────────────────────────────────────

function FocoBlock({ plan, projects, businesses, onSaved }: {
  plan: WeeklyPlan; projects: Project[]; businesses: Business[];
  onSaved: (p: WeeklyPlan) => void;
}) {
  const [f, setF] = useState({
    focus_title: plan.focus_title ?? '',
    focus_business: plan.focus_business ?? '',
    focus_project_id: plan.focus_project_id ?? '',
    motivation: plan.motivation ?? '',
    avoid_list: plan.avoid_list ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setF({
      focus_title: plan.focus_title ?? '', focus_business: plan.focus_business ?? '',
      focus_project_id: plan.focus_project_id ?? '', motivation: plan.motivation ?? '',
      avoid_list: plan.avoid_list ?? '',
    });
  }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function upd(k: keyof typeof f, v: string) { setF(p => ({ ...p, [k]: v })); setSaved(false); }

  async function save() {
    setSaving(true);
    try {
      const fields = {
        focus_title: f.focus_title.trim() || null,
        focus_business: f.focus_business || null,
        focus_project_id: f.focus_project_id || null,
        motivation: f.motivation.trim() || null,
        avoid_list: f.avoid_list.trim() || null,
      };
      await updateWeeklyPlan(plan.id, fields);
      onSaved({ ...plan, ...fields });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el foco. Revisá tu conexión e intentá de nuevo.');
    }
    finally { setSaving(false); }
  }

  return (
    <SectionCard icon={<Flame size={15} />} title="Foco de la semana">
      <div className="flex flex-col gap-3">
        <input className="pm-input" placeholder="¿Cuál es EL foco de esta semana?" value={f.focus_title} onChange={e => upd('focus_title', e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3">
          <select className="pm-input" value={f.focus_business} onChange={e => upd('focus_business', e.target.value)}>
            <option value="">Negocio / área…</option>
            {businesses.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
            <option value="personal">Personal</option>
            <option value="otro">Otro</option>
          </select>
          <select className="pm-input" value={f.focus_project_id} onChange={e => upd('focus_project_id', e.target.value)}>
            <option value="">Proyecto relacionado (opcional)…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <input className="pm-input" placeholder="Frase motivadora de la semana" value={f.motivation} onChange={e => upd('motivation', e.target.value)} />
        <textarea className="pm-input min-h-[60px]" placeholder="Qué voy a EVITAR esta semana (distracciones, hábitos, etc.)" value={f.avoid_list} onChange={e => upd('avoid_list', e.target.value)} />
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="self-start flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar foco'}
          </button>
          {saved && <span className="text-sm text-emerald-300 flex items-center gap-1"><CheckCircle2 size={15} /> Guardado</span>}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── BLOQUE 2: INDICADORES ─────────────────────────────────────────────────────

function IndicadoresBlock({ plan, businesses, worked, onSaved }: {
  plan: WeeklyPlan; businesses: Business[]; worked: Record<string, number>;
  onSaved: (p: WeeklyPlan) => void;
}) {
  const [ind, setInd] = useState<WeeklyIndicators>(plan.indicators ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setInd(plan.indicators ?? {}); }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setPair(key: 'ventas' | 'ingreso' | 'ahorro', field: 'objetivo' | 'logrado', v: number) {
    setInd(p => ({ ...p, [key]: { objetivo: 0, logrado: 0, ...(p[key] ?? {}), [field]: v } }));
    setSaved(false);
  }
  function setHours(bkey: string, field: 'objetivo' | 'trabajadas', v: number) {
    setInd(p => ({ ...p, horas: { ...(p.horas ?? {}), [bkey]: { objetivo: 0, trabajadas: 0, ...(p.horas?.[bkey] ?? {}), [field]: v } } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await updateWeeklyPlan(plan.id, { indicators: ind });
      onSaved({ ...plan, indicators: ind });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
      alert('No se pudieron guardar los indicadores. Intentá de nuevo.');
    }
    finally { setSaving(false); }
  }

  const money: Array<{ key: 'ventas' | 'ingreso' | 'ahorro'; label: string }> = [
    { key: 'ventas', label: 'Ventas ($)' },
    { key: 'ingreso', label: 'Ingreso ($)' },
    { key: 'ahorro', label: 'Ahorro ($)' },
  ];

  return (
    <SectionCard icon={<TrendingUp size={15} />} title="Indicadores obligatorios">
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {money.map(m => (
          <div key={m.key} className="rounded-xl border border-plata-700/50 bg-plata-900/50 p-3">
            <p className="text-xs font-semibold text-plata-300 mb-2">{m.label}</p>
            <div className="flex gap-2">
              <NumField label="Objetivo" value={ind[m.key]?.objetivo ?? 0} onChange={v => setPair(m.key, 'objetivo', v)} />
              <NumField label="Logrado" value={ind[m.key]?.logrado ?? 0} onChange={v => setPair(m.key, 'logrado', v)} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold text-plata-400 mb-2">Horas por negocio (trabajadas se autocalculan desde tus bloques de tiempo)</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {businesses.map(b => {
          const autoMin = worked[b.key] ?? 0;
          const hrs = ind.horas?.[b.key];
          return (
            <div key={b.key} className="rounded-xl border border-plata-700/50 bg-plata-900/50 p-3">
              <p className="text-xs font-semibold text-white mb-2">{b.name}</p>
              <div className="flex gap-2 items-end">
                <NumField label="Obj (h)" value={hrs?.objetivo ?? 0} onChange={v => setHours(b.key, 'objetivo', v)} />
                <div className="flex-1">
                  <p className="text-[10px] text-plata-500 mb-1">Trabajadas</p>
                  <div className="text-sm font-bold text-emerald-300 px-2 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                    {autoMin > 0 ? fmtH(autoMin) : (hrs?.trabajadas ? `${hrs.trabajadas}h` : '—')}
                  </div>
                </div>
              </div>
              {autoMin === 0 && (
                <div className="mt-2">
                  <NumField label="Manual (h)" value={hrs?.trabajadas ?? 0} onChange={v => setHours(b.key, 'trabajadas', v)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar indicadores'}
        </button>
        {saved && <span className="text-sm text-emerald-300 flex items-center gap-1"><CheckCircle2 size={15} /> Guardado</span>}
      </div>
    </SectionCard>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex-1">
      <p className="text-[10px] text-plata-500 mb-1">{label}</p>
      <input
        type="number" min={0} value={value || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="pm-input w-full text-sm py-1.5" placeholder="0"
      />
    </div>
  );
}

// ─── BLOQUE 3: METAS LIBRES ────────────────────────────────────────────────────

function MetasBlock({ weekStart, goals, projects, businesses, onChange }: {
  weekStart: string; goals: WeeklyGoal[]; projects: Project[]; businesses: Business[];
  onChange: (g: WeeklyGoal[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [area, setArea] = useState('');
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const g = await createWeeklyGoal({
        week_start: weekStart, title: title.trim(), description: null,
        area: area || null, priority, status: 'pendiente', progress: 0,
        deadline: null, project_id: null, goal_id: null, is_critical: false,
        position: goals.length,
      });
      onChange([...goals, g]);
      setTitle(''); setArea(''); setPriority('media'); setShowForm(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function patch(id: string, fields: Partial<WeeklyGoal>) {
    onChange(goals.map(g => g.id === id ? { ...g, ...fields } : g));
    try { await updateWeeklyGoal(id, fields); } catch (e) { console.error(e); }
  }
  async function remove(id: string) {
    onChange(goals.filter(g => g.id !== id));
    try { await deleteWeeklyGoal(id); } catch (e) { console.error(e); }
  }

  return (
    <SectionCard icon={<Target size={15} />} title={`Metas libres de la semana (${goals.length})`}>
      <button onClick={() => setShowForm(s => !s)} className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-dorado-300 border border-dorado-500/30 hover:bg-dorado-900/20 px-3 py-1.5 rounded-lg">
        <Plus size={13} /> Nueva meta
      </button>
      {showForm && (
        <form onSubmit={create} className="mb-3 rounded-xl border border-dorado-500/30 bg-plata-900/80 p-3 flex flex-col gap-2">
          <input autoFocus className="pm-input" placeholder="Título de la meta semanal" value={title} onChange={e => setTitle(e.target.value)} required />
          <div className="flex gap-2 flex-wrap">
            <select className="pm-input flex-1" value={area} onChange={e => setArea(e.target.value)}>
              <option value="">Área / negocio…</option>
              {businesses.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
              <option value="personal">Personal</option>
            </select>
            <select className="pm-input" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
            <button type="submit" disabled={saving} className="px-3 py-2 text-sm font-semibold bg-bordo-600 hover:bg-bordo-500 text-white rounded-lg disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Agregar'}
            </button>
          </div>
        </form>
      )}
      {goals.length === 0 ? (
        <p className="text-xs text-plata-500">Sin metas esta semana. Definí 1-3 metas críticas para mantener foco.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {goals.map(g => {
            const st = WEEKLY_GOAL_STATUS_CONFIG[g.status];
            const pri = PRIORITY_CONFIG[g.priority];
            const biz = businessBadge(g.area);
            const proj = projects.find(p => p.id === g.project_id);
            return (
              <div key={g.id} className="rounded-xl border border-plata-700/50 bg-plata-900/50 p-3">
                <div className="flex items-start gap-2">
                  <button onClick={() => patch(g.id, { is_critical: !g.is_critical })} title="Marcar crítica" className="mt-0.5 shrink-0">
                    <Star size={14} className={g.is_critical ? 'text-dorado-400 fill-dorado-400' : 'text-plata-600'} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{g.title}</p>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      <span className={`text-[10px] font-medium ${pri.color}`}>● {pri.label}</span>
                      {biz && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ color: biz.color, borderColor: `${biz.color}66`, backgroundColor: `${biz.color}22` }}>{biz.name}</span>}
                      {proj && <span className="text-[10px] text-plata-400">📁 {proj.name}</span>}
                    </div>
                  </div>
                  <button onClick={() => remove(g.id)} className="text-plata-500 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <select value={g.status} onChange={e => patch(g.id, { status: e.target.value as WeeklyGoalStatus })} className={`text-[11px] rounded-lg px-2 py-1 border border-plata-700 bg-plata-800 ${st.color}`}>
                    {(Object.keys(WEEKLY_GOAL_STATUS_CONFIG) as WeeklyGoalStatus[]).map(k => (
                      <option key={k} value={k}>{WEEKLY_GOAL_STATUS_CONFIG[k].label}</option>
                    ))}
                  </select>
                  <div className="flex-1 flex items-center gap-2">
                    <input type="range" min={0} max={100} step={5} value={g.progress}
                      onChange={e => patch(g.id, { progress: Number(e.target.value) })}
                      className="flex-1 accent-dorado-500" />
                    <span className="text-[11px] text-plata-400 w-9 text-right">{g.progress}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── BLOQUE 4: KANBAN SEMANAL (tareas reales vinculadas) ───────────────────────

function KanbanBlock({ weekStart, links, taskById, availableTasks, tasks, onChange }: {
  weekStart: string; links: WeeklyTaskLink[]; taskById: Map<string, Task>;
  availableTasks: Task[]; tasks: Task[];
  onChange: (l: WeeklyTaskLink[], t?: Task[]) => void;
}) {
  const [picking, setPicking] = useState<WeeklyColumn | null>(null);
  const [search, setSearch] = useState('');

  async function addTask(taskId: string, col: WeeklyColumn) {
    try {
      await linkTaskToWeek(weekStart, taskId, col, false);
      const fresh = await getWeeklyTaskLinks(weekStart);
      onChange(fresh);
      setPicking(null); setSearch('');
    } catch (e) { console.error(e); }
  }

  async function move(link: WeeklyTaskLink, col: WeeklyColumn) {
    onChange(links.map(l => l.id === link.id ? { ...l, week_column: col } : l));
    try {
      await updateWeeklyTaskLink(link.id, { week_column: col });
      // Sincronización con tarea real
      const newStatus = COLUMN_TO_STATUS[col];
      if (newStatus) {
        await updateTask(link.task_id, { status: newStatus });
        onChange(
          links.map(l => l.id === link.id ? { ...l, week_column: col } : l),
          tasks.map(t => t.id === link.task_id ? { ...t, status: newStatus } : t)
        );
      }
    } catch (e) { console.error(e); }
  }

  async function toggleCritical(link: WeeklyTaskLink) {
    onChange(links.map(l => l.id === link.id ? { ...l, is_critical: !l.is_critical } : l));
    try { await updateWeeklyTaskLink(link.id, { is_critical: !link.is_critical }); } catch (e) { console.error(e); }
  }

  async function unlink(link: WeeklyTaskLink) {
    onChange(links.filter(l => l.id !== link.id));
    try { await unlinkTaskFromWeek(link.id); } catch (e) { console.error(e); }
  }

  const filtered = availableTasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  return (
    <SectionCard icon={<Link2 size={15} />} title="Kanban semanal (tareas reales vinculadas)">
      <p className="text-xs text-plata-500 mb-3">Las tareas son las mismas del Kanban principal. Mover acá actualiza la tarea real. No se duplican.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {WEEKLY_COLUMNS.map(col => {
          const colLinks = links.filter(l => l.week_column === col.key);
          return (
            <div key={col.key} className="rounded-xl border border-plata-700/50 bg-plata-950/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-xs font-bold text-white flex-1">{col.label}</span>
                <span className="text-[10px] text-plata-500 bg-plata-800/60 px-1.5 py-0.5 rounded-full">{colLinks.length}</span>
                <button onClick={() => setPicking(picking === col.key ? null : col.key)} className="text-dorado-400 hover:text-dorado-300"><Plus size={14} /></button>
              </div>

              {picking === col.key && (
                <div className="mb-2 rounded-lg border border-dorado-500/30 bg-plata-900/90 p-2">
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarea existente…" className="pm-input w-full text-xs py-1.5 mb-1.5" />
                  <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
                    {filtered.length === 0 ? <p className="text-[11px] text-plata-500 px-1 py-2">Sin tareas disponibles.</p> :
                      filtered.map(t => (
                        <button key={t.id} onClick={() => addTask(t.id, col.key)} className="text-left text-[11px] text-plata-200 hover:text-white px-2 py-1.5 rounded hover:bg-plata-800 truncate">
                          {t.title}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                {colLinks.map(link => {
                  const t = taskById.get(link.task_id);
                  if (!t) return null;
                  const biz = businessBadge(t.business_key);
                  const done = t.status === 'hecho';
                  return (
                    <div key={link.id} className="rounded-lg border border-plata-700/40 bg-plata-900/60 px-2.5 py-2">
                      <div className="flex items-start gap-1.5">
                        <button onClick={() => toggleCritical(link)} title="Crítica" className="mt-0.5 shrink-0">
                          <Star size={11} className={link.is_critical ? 'text-dorado-400 fill-dorado-400' : 'text-plata-600'} />
                        </button>
                        <p className={`text-[11px] font-medium flex-1 ${done ? 'line-through text-plata-500' : 'text-white'}`}>{t.title}</p>
                        <button onClick={() => unlink(link)} className="text-plata-600 hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {biz && <span className="text-[8px] font-semibold px-1 py-0.5 rounded border" style={{ color: biz.color, borderColor: `${biz.color}66`, backgroundColor: `${biz.color}22` }}>{biz.name}</span>}
                        <select value={link.week_column} onChange={e => move(link, e.target.value as WeeklyColumn)} className="ml-auto text-[9px] rounded px-1 py-0.5 border border-plata-700 bg-plata-800 text-plata-300">
                          {WEEKLY_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── BLOQUE 5: AVANCE ──────────────────────────────────────────────────────────

function AvanceBlock({ plan, businesses, worked, goalsPct, tasksPct, goalsDone, goalsTotal, linkDone, linkTotal }: {
  plan: WeeklyPlan; businesses: Business[]; worked: Record<string, number>;
  goalsPct: number; tasksPct: number; goalsDone: number; goalsTotal: number; linkDone: number; linkTotal: number;
}) {
  const ind = plan.indicators ?? {};
  function pct(o?: number, l?: number) { return o && o > 0 ? Math.min(100, Math.round(((l ?? 0) / o) * 100)) : 0; }

  return (
    <SectionCard icon={<Sparkles size={15} />} title="Avance semanal">
      <div className="flex flex-col gap-3">
        <Bar label={`Metas (${goalsDone}/${goalsTotal})`} pct={goalsPct} />
        <Bar label={`Tareas (${linkDone}/${linkTotal})`} pct={tasksPct} />
        {ind.ventas && <Bar label={`Ventas $${ind.ventas.logrado ?? 0} / $${ind.ventas.objetivo ?? 0}`} pct={pct(ind.ventas.objetivo, ind.ventas.logrado)} />}
        {ind.ingreso && <Bar label={`Ingreso $${ind.ingreso.logrado ?? 0} / $${ind.ingreso.objetivo ?? 0}`} pct={pct(ind.ingreso.objetivo, ind.ingreso.logrado)} />}
        {ind.ahorro && <Bar label={`Ahorro $${ind.ahorro.logrado ?? 0} / $${ind.ahorro.objetivo ?? 0}`} pct={pct(ind.ahorro.objetivo, ind.ahorro.logrado)} />}
        {businesses.map(b => {
          const obj = ind.horas?.[b.key]?.objetivo ?? 0;
          if (!obj) return null;
          const workedH = (worked[b.key] ?? 0) / 60 || (ind.horas?.[b.key]?.trabajadas ?? 0);
          return <Bar key={b.key} label={`${b.name} ${workedH.toFixed(1)}h / ${obj}h`} pct={pct(obj, workedH)} />;
        })}
      </div>
    </SectionCard>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 100 ? '#16A34A' : pct >= 50 ? '#B8922A' : '#8B1A2E';
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1"><span className="text-plata-300">{label}</span><span className="text-plata-400 font-semibold">{pct}%</span></div>
      <div className="h-2 rounded-full bg-plata-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── BLOQUE 6: CIERRE SEMANAL ──────────────────────────────────────────────────

function CierreBlock({ plan, weekStart, goals, goalsDone, linkDone, linkTotal, onClosed }: {
  plan: WeeklyPlan; weekStart: string; goals: WeeklyGoal[];
  goalsDone: number; linkDone: number; linkTotal: number;
  onClosed: (p: WeeklyPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [wins, setWins] = useState('');
  const [learnings, setLearnings] = useState('');
  const [nextWeek, setNextWeek] = useState('');
  const [saving, setSaving] = useState(false);

  async function cerrar() {
    setSaving(true);
    try {
      const content =
        `FOCO: ${plan.focus_title ?? '—'}\n\n` +
        `LOGROS:\n${wins || '—'}\n\n` +
        `APRENDIZAJES:\n${learnings || '—'}\n\n` +
        `PRÓXIMA SEMANA:\n${nextWeek || '—'}\n\n` +
        `MÉTRICAS: Metas ${goalsDone}/${goals.length} · Tareas ${linkDone}/${linkTotal}`;
      await createJournalEntry({
        type: 'cierre_semanal',
        title: `Cierre semanal ${weekLabel(weekStart)}`,
        content,
        entry_date: TODAY_ISO,
        status: null, area: plan.focus_business, priority: null,
        related_business: plan.focus_business, mood: null,
        energy_level: null, focus_level: null,
        tags: ['cierre_semanal'],
        metadata: {
          week_start: weekStart, wins, learnings, next_week: nextWeek,
          goals_done: goalsDone, goals_total: goals.length, tasks_done: linkDone, tasks_total: linkTotal,
          indicators: plan.indicators,
        },
      });
      await updateWeeklyPlan(plan.id, { closed: true, closed_at: new Date().toISOString() });
      onClosed({ ...plan, closed: true, closed_at: new Date().toISOString() });
      setOpen(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  if (plan.closed) {
    return (
      <SectionCard icon={<Lock size={15} />} title="Cierre semanal">
        <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 size={15} /> Semana cerrada. El resumen se guardó en la Bitácora.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={<Lock size={15} />} title="Cierre semanal">
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl text-sm font-medium">
          <Lock size={15} /> Cerrar semana
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea className="pm-input min-h-[60px]" placeholder="🏆 Logros de la semana" value={wins} onChange={e => setWins(e.target.value)} />
          <textarea className="pm-input min-h-[60px]" placeholder="💡 Aprendizajes" value={learnings} onChange={e => setLearnings(e.target.value)} />
          <textarea className="pm-input min-h-[60px]" placeholder="➡️ Qué llevar a la próxima semana" value={nextWeek} onChange={e => setNextWeek(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={cerrar} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar cierre en Bitácora'}
            </button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-plata-400 hover:text-white rounded-xl border border-plata-700 hover:bg-plata-800">Cancelar</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
