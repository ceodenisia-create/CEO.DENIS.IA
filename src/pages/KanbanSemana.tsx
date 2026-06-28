import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, ChevronLeft, ChevronRight, Plus, Trash2, Target,
  Flame, TrendingUp, FolderKanban, CheckCircle2, Link2, Star, Pencil, X,
} from 'lucide-react';
import {
  type Task, type Project, type WeekBoard, type WeekTaskLink, type WeekIndicator,
  PRIORITY_CONFIG, STATUS_CONFIG, businessBadge,
  getTasks, updateTask, getProjects, updateProject,
  getWeekStart, getWeekDays,
  getOrCreateWeekBoard, updateWeekBoard,
  getWeekTaskLinks, linkWeekTask, unlinkWeekTask,
} from '../lib/planMaestro';

function weekLabel(weekStart: string) {
  const days = getWeekDays(weekStart);
  const f = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return `${f(days[0])} — ${f(days[6])}`;
}

function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

export default function KanbanSemana() {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [navOpen, setNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<WeekBoard | null>(null);
  const [links, setLinks] = useState<WeekTaskLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, lk, ts, pr] = await Promise.all([
        getOrCreateWeekBoard(weekStart),
        getWeekTaskLinks(weekStart),
        getTasks(),
        getProjects(),
      ]);
      setBoard(b); setLinks(lk); setTasks(ts); setProjects(pr);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const isCurrentWeek = weekStart === getWeekStart();
  function shiftWeek(delta: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setWeekStart(getWeekStart(d));
  }
  function goToday() { setWeekStart(getWeekStart()); setNavOpen(false); }

  if (loading || !board) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-dorado-400" /></div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + nav */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between flex-wrap gap-3 ${
        isCurrentWeek ? 'border-dorado-500/20 bg-plata-900/80' : 'border-amber-500/40 bg-amber-900/15'
      }`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">KANBAN · SEMANA</p>
          <h2 className="text-xl font-bold text-white">Control semanal</h2>
          <p className="text-sm mt-0.5">
            <span className="text-plata-300 font-semibold">{weekLabel(weekStart)}</span>{' '}
            {isCurrentWeek
              ? <span className="text-emerald-400">· semana actual</span>
              : <span className="text-amber-300">· NO es la semana actual</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!navOpen ? (
            <button onClick={() => setNavOpen(true)} className="text-xs px-3 py-1.5 rounded-lg text-plata-300 border border-plata-700 hover:bg-plata-800 hover:text-white">Ver otra semana</button>
          ) : (
            <>
              <button onClick={() => shiftWeek(-7)} className="p-2 rounded-lg hover:bg-plata-800 text-plata-300 hover:text-white"><ChevronLeft size={18} /></button>
              <button onClick={goToday} className="text-xs px-2 py-1 rounded-lg text-dorado-300 border border-dorado-500/30 hover:bg-dorado-900/20">Ir a hoy</button>
              <button onClick={() => shiftWeek(7)} className="p-2 rounded-lg hover:bg-plata-800 text-plata-300 hover:text-white"><ChevronRight size={18} /></button>
            </>
          )}
        </div>
      </div>

      {!isCurrentWeek && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-900/15 px-4 py-3 text-sm text-amber-200">
          <span>⚠️ Estás viendo otra semana. Lo que cargues se guarda en <b>{weekLabel(weekStart)}</b>.</span>
          <button onClick={goToday} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold">Volver a hoy</button>
        </div>
      )}

      <FocoCard board={board} onSaved={setBoard} />
      <IndicadoresBlock board={board} onSaved={setBoard} />
      <MetasBlock weekStart={weekStart} links={links} tasks={tasks} onChange={(l, t) => { setLinks(l); if (t) setTasks(t); }} />
      <ProyectosBlock projects={projects} onChange={setProjects} />
    </div>
  );
}

function Card({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-plata-700/50 bg-plata-900/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-dorado-400">{icon}</span>
        <h3 className="text-sm font-bold text-white flex-1">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── FOCO: tarjeta de solo lectura cuando hay datos; formulario para crear/editar ─

function FocoCard({ board, onSaved }: { board: WeekBoard; onSaved: (b: WeekBoard) => void }) {
  const hasData = !!(board.enfoque || board.meta_principal);
  const [editing, setEditing] = useState(!hasData);
  const [enfoque, setEnfoque] = useState(board.enfoque ?? '');
  const [meta, setMeta] = useState(board.meta_principal ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setEnfoque(board.enfoque ?? ''); setMeta(board.meta_principal ?? '');
    setEditing(!(board.enfoque || board.meta_principal));
  }, [board.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      const fields = { enfoque: enfoque.trim() || null, meta_principal: meta.trim() || null };
      await updateWeekBoard(board.id, fields);
      onSaved({ ...board, ...fields });
      setEditing(false);
    } catch (e) { console.error(e); alert('No se pudo guardar.'); }
    finally { setSaving(false); }
  }

  if (!editing && hasData) {
    return (
      <Card icon={<Flame size={15} />} title="Enfoque y meta principal"
        action={<button onClick={() => setEditing(true)} className="text-plata-400 hover:text-white"><Pencil size={14} /></button>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-dorado-500/40 bg-dorado-900/10 p-3">
            <p className="text-[10px] uppercase tracking-widest text-dorado-400/80 mb-1">🔥 Enfoque</p>
            <p className="text-base font-bold text-white">{board.enfoque || '—'}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/10 p-3">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">🎯 Meta principal</p>
            <p className="text-base font-bold text-white">{board.meta_principal || '—'}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card icon={<Flame size={15} />} title="Enfoque y meta principal">
      <div className="flex flex-col gap-3">
        <input className="pm-input" placeholder="Enfoque de la semana (ej: Mejorar modeltex.com.ar)" value={enfoque} onChange={e => setEnfoque(e.target.value)} />
        <input className="pm-input" placeholder="Meta principal (ej: 30 ventas)" value={meta} onChange={e => setMeta(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
          </button>
          {hasData && <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-plata-400 hover:text-white rounded-xl border border-plata-700 hover:bg-plata-800">Cancelar</button>}
        </div>
      </div>
    </Card>
  );
}

// ─── INDICADORES: registrás y aparece como TARJETA (guarda solo) ─────────────────

function IndicadoresBlock({ board, onSaved }: { board: WeekBoard; onSaved: (b: WeekBoard) => void }) {
  const items = board.indicators ?? [];
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [logrado, setLogrado] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() { setName(''); setObjetivo(''); setLogrado(''); setEditId(null); setShowForm(false); }

  async function persist(next: WeekIndicator[]) {
    setBusy(true);
    try {
      await updateWeekBoard(board.id, { indicators: next });
      onSaved({ ...board, indicators: next });
    } catch (e) { console.error(e); alert('No se pudo guardar.'); }
    finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const data = { name: name.trim(), objetivo: Number(objetivo) || 0, logrado: Number(logrado) || 0 };
    const next = editId
      ? items.map(i => i.id === editId ? { ...i, ...data } : i)
      : [...items, { id: uid(), ...data }];
    await persist(next);
    resetForm();
  }

  function startEdit(it: WeekIndicator) {
    setEditId(it.id); setName(it.name); setObjetivo(String(it.objetivo || '')); setLogrado(String(it.logrado || '')); setShowForm(true);
  }
  async function remove(id: string) { await persist(items.filter(i => i.id !== id)); }
  async function bump(it: WeekIndicator, delta: number) {
    await persist(items.map(i => i.id === it.id ? { ...i, logrado: Math.max(0, i.logrado + delta) } : i));
  }

  return (
    <Card
      icon={<TrendingUp size={15} />}
      title={`Objetivos obligatorios (${items.length})`}
      action={<button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1 text-xs font-semibold text-dorado-300 border border-dorado-500/30 hover:bg-dorado-900/20 px-2.5 py-1 rounded-lg"><Plus size={13} /> Agregar</button>}
    >
      {showForm && (
        <form onSubmit={submit} className="mb-3 rounded-xl border border-dorado-500/30 bg-plata-900/90 p-3 flex flex-col gap-2">
          <input autoFocus className="pm-input" placeholder="Nombre (ej: Ventas totales MODELTEX)" value={name} onChange={e => setName(e.target.value)} required />
          <div className="flex gap-2">
            <input type="number" min={0} className="pm-input flex-1" placeholder="Objetivo" value={objetivo} onChange={e => setObjetivo(e.target.value)} />
            <input type="number" min={0} className="pm-input flex-1" placeholder="Logrado" value={logrado} onChange={e => setLogrado(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {busy ? <Loader2 size={14} className="animate-spin" /> : (editId ? 'Guardar cambios' : 'Agregar tarjeta')}
            </button>
            <button type="button" onClick={resetForm} className="px-3 py-2 text-sm text-plata-400 hover:text-white rounded-lg border border-plata-700 hover:bg-plata-800"><X size={14} /></button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-plata-500">Sin indicadores. Apretá “Agregar” y aparecerá una tarjeta por cada uno (ventas, ingresos, etc.).</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(it => {
            const pct = it.objetivo > 0 ? Math.min(100, Math.round((it.logrado / it.objetivo) * 100)) : 0;
            const color = pct >= 100 ? '#16A34A' : pct >= 50 ? '#B8922A' : '#8B1A2E';
            return (
              <div key={it.id} className="rounded-xl border border-plata-700/50 bg-plata-900/50 p-3">
                <div className="flex items-start gap-2">
                  <p className="text-sm font-bold text-white flex-1">{it.name}</p>
                  <button onClick={() => startEdit(it)} className="text-plata-500 hover:text-white"><Pencil size={13} /></button>
                  <button onClick={() => remove(it.id)} className="text-plata-500 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
                <div className="flex items-end justify-between mt-2">
                  <div>
                    <p className="text-2xl font-bold text-white leading-none">{it.logrado}<span className="text-sm text-plata-500"> / {it.objetivo}</span></p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => bump(it, -1)} className="w-7 h-7 rounded-lg border border-plata-700 text-plata-300 hover:bg-plata-800 text-sm font-bold">−</button>
                    <button onClick={() => bump(it, 1)} className="w-7 h-7 rounded-lg border border-dorado-500/40 text-dorado-300 hover:bg-dorado-900/20 text-sm font-bold">+</button>
                    <span className="text-sm font-bold ml-1 w-10 text-right" style={{ color }}>{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-plata-800 overflow-hidden mt-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── METAS DE LA SEMANA: tarjetas = tareas reales ───────────────────────────────

function MetasBlock({ weekStart, links, tasks, onChange }: {
  weekStart: string; links: WeekTaskLink[]; tasks: Task[];
  onChange: (l: WeekTaskLink[], t?: Task[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const linkedIds = new Set(links.map(l => l.task_id));
  const available = tasks.filter(t => !linkedIds.has(t.id) && t.status !== 'hecho');
  const filtered = available.filter(t => t.title.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  async function add(taskId: string) {
    try {
      await linkWeekTask(weekStart, taskId);
      const fresh = await getWeekTaskLinks(weekStart);
      onChange(fresh);
      setPicking(false); setSearch('');
    } catch (e) { console.error(e); }
  }
  async function remove(link: WeekTaskLink) {
    onChange(links.filter(l => l.id !== link.id));
    try { await unlinkWeekTask(link.id); } catch (e) { console.error(e); }
  }
  async function toggleDone(t: Task) {
    const next = t.status === 'hecho' ? 'hoy' : 'hecho';
    onChange(links, tasks.map(x => x.id === t.id ? { ...x, status: next } : x));
    try { await updateTask(t.id, { status: next }); } catch (e) { console.error(e); }
  }

  return (
    <Card
      icon={<Target size={15} />}
      title={`Metas / prioridades de la semana (${links.length})`}
      action={<button onClick={() => setPicking(p => !p)} className="flex items-center gap-1 text-xs font-semibold text-dorado-300 border border-dorado-500/30 hover:bg-dorado-900/20 px-2.5 py-1 rounded-lg"><Link2 size={13} /> Vincular tarea</button>}
    >
      <p className="text-xs text-plata-500 mb-3">Son tus tareas reales del Kanban marcadas como metas de la semana. No se duplican.</p>

      {picking && (
        <div className="mb-3 rounded-xl border border-dorado-500/30 bg-plata-900/90 p-2">
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarea existente…" className="pm-input w-full text-sm py-1.5 mb-1.5" />
          <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
            {filtered.length === 0 ? <p className="text-[11px] text-plata-500 px-1 py-2">Sin tareas disponibles. Creá tareas en el Kanban primero.</p> :
              filtered.map(t => (
                <button key={t.id} onClick={() => add(t.id)} className="text-left text-[12px] text-plata-200 hover:text-white px-2 py-1.5 rounded hover:bg-plata-800 truncate">{t.title}</button>
              ))}
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-xs text-plata-500">Sin metas vinculadas. Marcá 3-5 tareas clave para esta semana.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {links.map(link => {
            const t = taskById.get(link.task_id);
            if (!t) return null;
            const pri = PRIORITY_CONFIG[t.priority];
            const st = STATUS_CONFIG[t.status];
            const biz = businessBadge(t.business_key);
            const done = t.status === 'hecho';
            return (
              <div key={link.id} className="flex items-center gap-3 rounded-xl border border-plata-700/50 bg-plata-900/50 px-3 py-2.5">
                <button onClick={() => toggleDone(t)} title={done ? 'Marcar pendiente' : 'Marcar hecha'} className="shrink-0">
                  <CheckCircle2 size={18} className={done ? 'text-emerald-400' : 'text-plata-600 hover:text-emerald-400'} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'line-through text-plata-500' : 'text-white'}`}>{t.title}</p>
                  <div className="flex gap-1.5 flex-wrap mt-0.5">
                    <span className={`text-[10px] font-medium ${pri.color}`}>● {pri.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                    {biz && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ color: biz.color, borderColor: `${biz.color}66`, backgroundColor: `${biz.color}22` }}>{biz.name}</span>}
                  </div>
                </div>
                <button onClick={() => remove(link)} title="Quitar de la semana (no borra la tarea)" className="text-plata-500 hover:text-red-400 shrink-0"><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── AVANCE DE PROYECTOS (tarjetas con % editable) ──────────────────────────────

function ProyectosBlock({ projects, onChange }: { projects: Project[]; onChange: (p: Project[]) => void }) {
  const active = projects.filter(p => p.status !== 'finalizado' && p.status !== 'cancelado');

  async function setProgress(id: string, progress: number) {
    onChange(projects.map(p => p.id === id ? { ...p, progress } : p));
    try { await updateProject(id, { progress }); } catch (e) { console.error(e); }
  }

  return (
    <Card icon={<FolderKanban size={15} />} title={`Avance de proyectos (${active.length})`}>
      {active.length === 0 ? (
        <p className="text-xs text-plata-500">No tenés proyectos activos.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map(p => {
            const biz = businessBadge(p.area);
            const color = p.progress >= 100 ? '#16A34A' : p.progress >= 50 ? '#B8922A' : '#8B1A2E';
            return (
              <div key={p.id} className="rounded-xl border border-plata-700/50 bg-plata-900/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={12} className="text-dorado-400 shrink-0" />
                  <span className="text-sm font-semibold text-white flex-1 truncate">{p.name}</span>
                  {biz && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0" style={{ color: biz.color, borderColor: `${biz.color}66`, backgroundColor: `${biz.color}22` }}>{biz.name}</span>}
                  <span className="text-sm font-bold w-10 text-right" style={{ color }}>{p.progress}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={p.progress} onChange={e => setProgress(p.id, Number(e.target.value))} className="w-full accent-dorado-500" />
                <div className="h-1.5 rounded-full bg-plata-800 overflow-hidden mt-1">
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.progress}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-plata-500 mt-3">Al llegar a 100% marcá el proyecto como finalizado desde Objetivos → queda guardado en Finalizados.</p>
    </Card>
  );
}
