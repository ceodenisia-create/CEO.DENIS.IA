import { useEffect, useState, useMemo } from 'react';
import {
  Flame, Plus, Pencil, Trash2, Loader2, X, Save,
  CheckCircle2, XCircle, PauseCircle, PlayCircle,
  TrendingUp, Trophy, BarChart3, Clock,
} from 'lucide-react';
import {
  type Habit, type HabitLog, type HabitArea, type HabitFrequency,
  type HabitStatus, type HabitLogStatus, type Priority,
  HABIT_AREA_CONFIG, PRIORITY_CONFIG,
  getHabits, createHabit, updateHabit, deleteHabit,
  getHabitLogs, upsertHabitLog,
} from '../lib/planMaestro';

// ─── UTILS ────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function formatDayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short' });
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type FilterToday = 'todos' | 'pendientes' | 'cumplidos';
type FilterHabitStatus = 'activos' | 'pausados' | 'abandonados' | 'todos';

interface HabitFormData {
  name: string;
  area: HabitArea;
  frequency: HabitFrequency;
  priority: Priority;
  status: HabitStatus;
  suggested_time: string;
  note: string;
}

const EMPTY_FORM: HabitFormData = {
  name: '', area: 'salud', frequency: 'diario',
  priority: 'media', status: 'activo',
  suggested_time: '', note: '',
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Disciplina() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [filterToday, setFilterToday] = useState<FilterToday>('todos');
  const [filterArea, setFilterArea] = useState<HabitArea | 'todas'>('todas');
  const [filterStatus, setFilterStatus] = useState<FilterHabitStatus>('activos');
  const [activeView, setActiveView] = useState<'tarjetas' | 'semanal'>('tarjetas');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const last7 = useMemo(() => getLast7Days(), []);
  const AREAS = Object.keys(HABIT_AREA_CONFIG) as HabitArea[];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const h = await getHabits();
      setHabits(h);
      if (h.length > 0) {
        const l = await getHabitLogs(h.map(x => x.id), last7[0]);
        setLogs(l);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Log del día para un hábito
  const todayLog = (habitId: string): HabitLog | undefined =>
    logs.find(l => l.habit_id === habitId && l.log_date === TODAY);

  // Métricas
  const activeHabits = habits.filter(h => h.status === 'activo');
  const completedToday = activeHabits.filter(h => todayLog(h.id)?.status === 'completed').length;
  const pendingToday = activeHabits.length - completedToday;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.best_streak), 0);
  const weeklyPct = useMemo(() => {
    if (activeHabits.length === 0) return 0;
    const possible = activeHabits.length * 7;
    const done = logs.filter(l =>
      l.status === 'completed' &&
      activeHabits.some(h => h.id === l.habit_id)
    ).length;
    return possible > 0 ? Math.round((done / possible) * 100) : 0;
  }, [activeHabits, logs]);

  // Filtrado
  const filtered = useMemo(() => {
    return habits.filter(h => {
      // Filtro estado hábito
      if (filterStatus !== 'todos' && h.status !== filterStatus.replace('s', '').replace('ivos','tivo').replace('ados','ado')) {
        const map: Record<FilterHabitStatus, HabitStatus | null> = { activos: 'activo', pausados: 'pausado', abandonados: 'abandonado', todos: null };
        const expected = map[filterStatus];
        if (expected && h.status !== expected) return false;
      }
      // Filtro área
      if (filterArea !== 'todas' && h.area !== filterArea) return false;
      // Filtro hoy
      if (filterToday === 'pendientes') {
        if (h.status !== 'activo') return false;
        const log = todayLog(h.id);
        if (log?.status === 'completed') return false;
      }
      if (filterToday === 'cumplidos') {
        const log = todayLog(h.id);
        if (log?.status !== 'completed') return false;
      }
      return true;
    });
  }, [habits, logs, filterStatus, filterArea, filterToday]);

  async function handleLog(habit: Habit, status: HabitLogStatus) {
    setActionLoading(habit.id + status);
    try {
      await upsertHabitLog(habit.id, TODAY, status);
      // Refrescar
      const [updatedHabits, updatedLogs] = await Promise.all([
        getHabits(),
        getHabitLogs(habits.map(x => x.id), last7[0]),
      ]);
      setHabits(updatedHabits);
      setLogs(updatedLogs);
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  async function handleToggleStatus(habit: Habit) {
    const newStatus: HabitStatus = habit.status === 'activo' ? 'pausado' : 'activo';
    await updateHabit(habit.id, { status: newStatus });
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, status: newStatus } : h));
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este hábito y todo su historial? Esta acción no se puede deshacer.')) return;
    await deleteHabit(id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setLogs(prev => prev.filter(l => l.habit_id !== id));
  }

  async function handleCreate(data: HabitFormData) {
    const h = await createHabit({
      name: data.name.trim(),
      area: data.area,
      frequency: data.frequency,
      priority: data.priority,
      status: data.status,
      suggested_time: data.suggested_time.trim() || null,
      note: data.note.trim() || null,
      position: habits.length,
    });
    setHabits(prev => [...prev, h]);
    setShowForm(false);
  }

  async function handleEditSave(data: HabitFormData) {
    if (!editHabit) return;
    await updateHabit(editHabit.id, {
      name: data.name.trim(),
      area: data.area,
      frequency: data.frequency,
      priority: data.priority,
      status: data.status,
      suggested_time: data.suggested_time.trim() || null,
      note: data.note.trim() || null,
    });
    setHabits(prev => prev.map(h => h.id === editHabit.id ? {
      ...h, ...data,
      suggested_time: data.suggested_time || null,
      note: data.note || null,
    } : h));
    setEditHabit(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-bordo-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,26,46,0.18),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(184,146,42,0.10),transparent_40%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Flame size={22} className="text-bordo-400" /> Disciplina
            </h1>
            <p className="text-sm text-plata-400 mt-0.5">Controlá tus hábitos, rachas y constancia diaria</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl font-semibold text-sm transition-colors shadow-pm"
          >
            <Plus size={16} /> Nuevo hábito
          </button>
        </div>
      </div>

      {/* Métricas */}
      {!loading && habits.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard icon={<Flame size={16} className="text-bordo-400" />} label="Hábitos activos" value={activeHabits.length} />
          <MetricCard icon={<CheckCircle2 size={16} className="text-emerald-400" />} label="Cumplidos hoy" value={`${completedToday}/${activeHabits.length}`} highlight={completedToday === activeHabits.length && activeHabits.length > 0} />
          <MetricCard icon={<Clock size={16} className="text-dorado-400" />} label="Pendientes hoy" value={pendingToday} warn={pendingToday > 0} />
          <MetricCard icon={<Trophy size={16} className="text-dorado-400" />} label="Mejor racha" value={`${bestStreak}d`} />
          <MetricCard icon={<BarChart3 size={16} className="text-sky-400" />} label="Disciplina semanal" value={`${weeklyPct}%`} />
        </div>
      )}

      {/* Filtros + vistas */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Estado hoy */}
          {(['todos', 'pendientes', 'cumplidos'] as FilterToday[]).map(f => (
            <button key={f} onClick={() => setFilterToday(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border capitalize ${
                filterToday === f ? 'bg-bordo-500/25 text-bordo-200 border-bordo-500/50' : 'text-plata-400 border-plata-700/50 hover:text-white'
              }`}>{f}</button>
          ))}

          <div className="w-px h-5 bg-plata-700/50 self-center" />

          {/* Área */}
          <button onClick={() => setFilterArea('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filterArea === 'todas' ? 'bg-dorado-500/25 text-dorado-200 border-dorado-500/50' : 'text-plata-400 border-plata-700/50 hover:text-white'
            }`}>Todas</button>
          {AREAS.map(a => {
            const cfg = HABIT_AREA_CONFIG[a];
            return (
              <button key={a} onClick={() => setFilterArea(a)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  filterArea === a ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'text-plata-400 border-plata-700/50 hover:text-white'
                }`}>{cfg.emoji} {cfg.label}</button>
            );
          })}

          <div className="w-px h-5 bg-plata-700/50 self-center" />

          {/* Estado hábito */}
          {([['activos','Activos'],['pausados','Pausados'],['abandonados','Abandonados'],['todos','Todos']] as [FilterHabitStatus, string][]).map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                filterStatus === val ? 'bg-plata-700/60 text-white border-plata-500/50' : 'text-plata-400 border-plata-700/50 hover:text-white'
              }`}>{lbl}</button>
          ))}
        </div>

        {/* Toggle vista */}
        <div className="flex rounded-lg border border-plata-700/50 overflow-hidden shrink-0">
          <button onClick={() => setActiveView('tarjetas')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeView === 'tarjetas' ? 'bg-bordo-600 text-white' : 'text-plata-400 hover:text-white'}`}>
            Tarjetas
          </button>
          <button onClick={() => setActiveView('semanal')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeView === 'semanal' ? 'bg-bordo-600 text-white' : 'text-plata-400 hover:text-white'}`}>
            Semana
          </button>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 size={32} className="animate-spin text-dorado-400" />
        </div>
      ) : habits.length === 0 ? (
        <EmptyState onNew={() => setShowForm(true)} />
      ) : activeView === 'tarjetas' ? (
        filtered.length === 0 ? (
          <div className="text-center py-12 text-plata-500 text-sm">
            No hay hábitos con esos filtros.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(h => (
              <HabitCard
                key={h.id}
                habit={h}
                todayLog={todayLog(h.id)}
                actionLoading={actionLoading}
                onComplete={() => handleLog(h, 'completed')}
                onFail={() => handleLog(h, 'failed')}
                onTogglePause={() => handleToggleStatus(h)}
                onEdit={() => setEditHabit(h)}
                onDelete={() => handleDelete(h.id)}
              />
            ))}
          </div>
        )
      ) : (
        <WeeklyView habits={habits.filter(h => h.status === 'activo')} logs={logs} days={last7} />
      )}

      {/* Modals */}
      {showForm && (
        <HabitModal title="Nuevo hábito" initialData={EMPTY_FORM} onSave={handleCreate} onClose={() => setShowForm(false)} />
      )}
      {editHabit && (
        <HabitModal
          title="Editar hábito"
          initialData={{
            name: editHabit.name,
            area: editHabit.area,
            frequency: editHabit.frequency,
            priority: editHabit.priority,
            status: editHabit.status,
            suggested_time: editHabit.suggested_time ?? '',
            note: editHabit.note ?? '',
          }}
          onSave={handleEditSave}
          onClose={() => setEditHabit(null)}
        />
      )}
    </div>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, highlight, warn }: {
  icon: React.ReactNode; label: string; value: string | number;
  highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 transition-all ${
      highlight ? 'border-emerald-500/40 bg-emerald-900/20' :
      warn ? 'border-dorado-500/30 bg-dorado-900/20' :
      'border-plata-700/50 bg-plata-900/60'
    }`}>
      <div className="flex items-center gap-1.5 text-plata-400">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className={`text-xl font-bold ${highlight ? 'text-emerald-300' : warn ? 'text-dorado-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

// ─── HABIT CARD ──────────────────────────────────────────────────────────────

function HabitCard({ habit, todayLog, actionLoading, onComplete, onFail, onTogglePause, onEdit, onDelete }: {
  habit: Habit;
  todayLog: HabitLog | undefined;
  actionLoading: string | null;
  onComplete: () => void;
  onFail: () => void;
  onTogglePause: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const area = HABIT_AREA_CONFIG[habit.area];
  const prio = PRIORITY_CONFIG[habit.priority];
  const todayStatus = todayLog?.status;
  const isPaused = habit.status === 'pausado';
  const isAbandoned = habit.status === 'abandonado';
  const isLoading = (s: string) => actionLoading === habit.id + s;

  return (
    <div className={`group rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
      isAbandoned ? 'border-plata-800/40 bg-plata-900/40 opacity-60' :
      isPaused ? 'border-plata-700/40 bg-plata-900/50' :
      todayStatus === 'completed' ? 'border-emerald-500/30 bg-emerald-900/10' :
      todayStatus === 'failed' ? 'border-red-500/20 bg-red-900/10' :
      'border-plata-700/60 bg-plata-900/80 hover:border-dorado-500/30 hover:shadow-pm'
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-2 justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">{habit.name}</p>
          {habit.note && <p className="text-xs text-plata-500 mt-0.5 line-clamp-1">{habit.note}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="p-1 text-plata-500 hover:text-dorado-300 rounded transition-colors"><Pencil size={12} /></button>
          <button onClick={onDelete} className="p-1 text-plata-500 hover:text-red-400 rounded transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${area.bg} ${area.color} ${area.border}`}>
          {area.emoji} {area.label}
        </span>
        <span className={`text-[10px] font-medium flex items-center gap-1 ${prio.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />{prio.label}
        </span>
        <span className="text-[10px] text-plata-500 bg-plata-800/60 px-2 py-0.5 rounded-full capitalize">{habit.frequency}</span>
        {habit.suggested_time && (
          <span className="text-[10px] text-plata-500 flex items-center gap-0.5">
            <Clock size={9} />{habit.suggested_time}
          </span>
        )}
        {isPaused && <span className="text-[10px] text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">Pausado</span>}
        {isAbandoned && <span className="text-[10px] text-plata-500 bg-plata-800/60 px-2 py-0.5 rounded-full">Abandonado</span>}
      </div>

      {/* Racha */}
      <div className="flex gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Flame size={13} className={habit.current_streak > 0 ? 'text-bordo-400' : 'text-plata-600'} />
          <span className={habit.current_streak > 0 ? 'text-white font-semibold' : 'text-plata-500'}>
            {habit.current_streak}d racha
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy size={13} className="text-dorado-500/70" />
          <span className="text-plata-500">{habit.best_streak}d mejor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={13} className="text-plata-600" />
          <span className="text-plata-500">{habit.total_completed}✓ {habit.total_failed}✗</span>
        </div>
      </div>

      {/* Acciones del día */}
      {!isAbandoned && (
        <div className="flex gap-2 pt-1 border-t border-plata-800/60">
          {!isPaused ? (
            <>
              <button
                onClick={onComplete}
                disabled={!!actionLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  todayStatus === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30'
                } disabled:opacity-50`}
              >
                {isLoading('completed') ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
                {todayStatus === 'completed' ? 'Cumplido ✓' : 'Cumplir'}
              </button>
              <button
                onClick={onFail}
                disabled={!!actionLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  todayStatus === 'failed'
                    ? 'bg-red-800/60 text-red-200'
                    : 'border border-red-500/20 text-red-400/70 hover:bg-red-900/20'
                } disabled:opacity-50`}
              >
                {isLoading('failed') ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
                {todayStatus === 'failed' ? 'Fallado' : 'Fallar'}
              </button>
            </>
          ) : null}
          <button
            onClick={onTogglePause}
            className="px-2.5 py-1.5 rounded-lg text-xs border border-plata-700/50 text-plata-400 hover:text-white hover:border-plata-500 transition-colors"
            title={isPaused ? 'Reactivar' : 'Pausar'}
          >
            {isPaused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WEEKLY VIEW ─────────────────────────────────────────────────────────────

function WeeklyView({ habits, logs, days }: { habits: Habit[]; logs: HabitLog[]; days: string[] }) {
  const logMap = useMemo(() => {
    const m: Record<string, HabitLogStatus> = {};
    logs.forEach(l => { m[`${l.habit_id}_${l.log_date}`] = l.status; });
    return m;
  }, [logs]);

  if (habits.length === 0) {
    return <div className="text-center py-12 text-plata-500 text-sm">No hay hábitos activos para mostrar.</div>;
  }

  return (
    <div className="rounded-2xl border border-plata-700/60 bg-plata-900/80 overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-plata-700/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-plata-400 uppercase tracking-wider w-48">Hábito</th>
            {days.map(d => (
              <th key={d} className={`px-2 py-3 text-center text-xs font-medium min-w-[60px] ${d === TODAY ? 'text-dorado-300' : 'text-plata-500'}`}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="uppercase">{formatDayShort(d)}</span>
                  <span className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${d === TODAY ? 'bg-dorado-500/30 text-dorado-200' : ''}`}>
                    {new Date(d + 'T12:00:00').getDate()}
                  </span>
                </div>
              </th>
            ))}
            <th className="px-3 py-3 text-center text-xs text-plata-500 uppercase tracking-wider">Racha</th>
          </tr>
        </thead>
        <tbody>
          {habits.map((h, i) => {
            const area = HABIT_AREA_CONFIG[h.area];
            return (
              <tr key={h.id} className={`border-b border-plata-800/40 ${i % 2 === 0 ? '' : 'bg-plata-800/20'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{area.emoji}</span>
                    <div>
                      <p className="text-xs font-medium text-white leading-snug">{h.name}</p>
                      <p className={`text-[10px] ${area.color}`}>{area.label}</p>
                    </div>
                  </div>
                </td>
                {days.map(d => {
                  const status = logMap[`${h.id}_${d}`];
                  return (
                    <td key={d} className="px-2 py-3 text-center">
                      <div className="flex justify-center">
                        {status === 'completed' ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          </div>
                        ) : status === 'failed' ? (
                          <div className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                            <XCircle size={14} className="text-red-400" />
                          </div>
                        ) : status === 'paused' ? (
                          <div className="w-7 h-7 rounded-full bg-plata-700/30 border border-plata-600/30 flex items-center justify-center">
                            <PauseCircle size={14} className="text-plata-500" />
                          </div>
                        ) : (
                          <div className={`w-2 h-2 rounded-full mx-auto ${d <= TODAY ? 'bg-plata-700' : 'bg-plata-800/40'}`} />
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Flame size={11} className={h.current_streak > 0 ? 'text-bordo-400' : 'text-plata-700'} />
                    <span className={`text-xs font-bold ${h.current_streak > 0 ? 'text-white' : 'text-plata-600'}`}>{h.current_streak}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl border border-bordo-500/20 bg-bordo-900/20 flex items-center justify-center">
        <Flame size={32} className="text-bordo-400/50" />
      </div>
      <p className="text-plata-300 font-semibold text-base">Todavía no cargaste ningún hábito.</p>
      <p className="text-plata-500 text-sm max-w-sm">
        La disciplina se construye con acciones repetidas, no con motivación barata.
      </p>
      <button
        onClick={onNew}
        className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-bordo-600 hover:bg-bordo-500 text-white rounded-xl font-semibold text-sm transition-colors shadow-pm"
      >
        <Plus size={16} /> Crear primer hábito
      </button>
    </div>
  );
}

// ─── MODAL FORM ──────────────────────────────────────────────────────────────

function HabitModal({ title, initialData, onSave, onClose }: {
  title: string;
  initialData: HabitFormData;
  onSave: (d: HabitFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<HabitFormData>(initialData);
  const [saving, setSaving] = useState(false);
  const AREAS = Object.keys(HABIT_AREA_CONFIG) as HabitArea[];

  const set = (k: keyof HabitFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave(form); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg flex flex-col gap-4 p-5 my-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Flame size={16} className="text-bordo-400" /> {title}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded-lg"><X size={18} /></button>
        </div>

        <div>
          <label className="text-xs text-plata-400 mb-1 block">Nombre del hábito *</label>
          <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Meditar 10 minutos" className="pm-input" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Área *</label>
            <select value={form.area} onChange={e => set('area', e.target.value)} className="pm-input">
              {AREAS.map(a => <option key={a} value={a}>{HABIT_AREA_CONFIG[a].emoji} {HABIT_AREA_CONFIG[a].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Frecuencia *</label>
            <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className="pm-input">
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Prioridad *</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="pm-input">
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Estado *</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="pm-input">
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="abandonado">Abandonado</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-plata-400 mb-1 block">Hora sugerida (opcional)</label>
          <input type="time" value={form.suggested_time} onChange={e => set('suggested_time', e.target.value)} className="pm-input" />
        </div>

        <div>
          <label className="text-xs text-plata-400 mb-1 block">Nota personal (opcional)</label>
          <textarea value={form.note} onChange={e => set('note', e.target.value)} placeholder="Por qué querés mantener este hábito..." rows={2} className="pm-input resize-none" />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-bordo-600 hover:bg-bordo-500 text-white rounded-lg transition-colors disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
