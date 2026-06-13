import { useEffect, useMemo, useState } from 'react';
import {
  Target, Plus, Pencil, Trash2, Loader2, X, Save,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus,
  AlertTriangle, ShieldCheck, Zap, Activity, Copy, Archive,
  RotateCcw, Settings, GripVertical,
} from 'lucide-react';
import {
  type PmRadar, type RadarAreaDef, type RadarEvaluation, type RadarScore,
  calcRadarMetrics, getAreaStatus, LIFE_RADAR_DEFAULT_COLORS,
  getRadars, createCustomRadar, updateRadar,
  archiveRadar, reactivateRadar, duplicateRadar, deleteRadar,
  getRadarAreaDefs, updateAreaDef, addAreaToRadar, removeAreaFromRadar,
  getRadarEvaluations, createRadarEvaluation, updateRadarEvaluation,
  deleteRadarEvaluation, getRadarScores, initializeLifeRadar,
} from '../lib/planMaestro';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const RADAR_TEMPLATES = [
  { name: 'Radar Simple',       areas: ['Salud', 'Dinero', 'Familia'] },
  { name: 'Radar de Negocios',  areas: ['Ventas', 'Producción', 'Finanzas', 'Clientes', 'Equipo', 'Marketing', 'Tecnología', 'Procesos'] },
  { name: 'Radar de Disciplina',areas: ['Sueño', 'Entrenamiento', 'Estudio', 'Enfoque', 'Hábitos', 'Orden'] },
  { name: 'Radar de Finanzas',  areas: ['Ingresos', 'Gastos', 'Ahorro', 'Inversión', 'Deuda'] },
  { name: 'Radar de Familia',   areas: ['Tiempo', 'Comunicación', 'Estabilidad', 'Presencia', 'Planes'] },
  { name: 'Radar de Salud',     areas: ['Sueño', 'Alimentación', 'Entrenamiento', 'Energía', 'Estrés', 'Constancia'] },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ScoreMap = Record<string, { current: number; target: number; note: string; action: string }>;

function buildScoreMap(defs: RadarAreaDef[]): ScoreMap {
  const m: ScoreMap = {};
  defs.forEach(d => { m[d.area_key] = { current: 5, target: 8, note: '', action: '' }; });
  return m;
}

function scoresToMap(scores: RadarScore[]): ScoreMap {
  const m: ScoreMap = {};
  scores.forEach(s => {
    const key = s.area_key ?? s.area_name;
    m[key] = { current: s.current_score, target: s.target_score, note: s.note ?? '', action: s.main_action ?? '' };
  });
  return m;
}

function mapToScorePayload(m: ScoreMap, defs: RadarAreaDef[]) {
  return defs.map((d, i) => ({
    area_key: d.area_key,
    area_name: d.display_name,
    current_score: m[d.area_key]?.current ?? 5,
    target_score: m[d.area_key]?.target ?? 8,
    note: m[d.area_key]?.note.trim() || null,
    main_action: m[d.area_key]?.action.trim() || null,
    sort_order: i,
  }));
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function RadarPage() {
  const [tab, setTab] = useState<'vida' | 'custom'>('vida');
  const [radars, setRadars] = useState<PmRadar[]>([]);
  const [lifeRadar, setLifeRadar] = useState<PmRadar | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const all = await getRadars();
      const life = all.find(r => r.type === 'fixed') ?? null;
      setRadars(all);
      setLifeRadar(life);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleInit() {
    setInitializing(true);
    try {
      const { radar } = await initializeLifeRadar();
      setLifeRadar(radar);
      await load();
    } catch (e) { console.error(e); }
    finally { setInitializing(false); }
  }

  async function handleCreateCustom(name: string, desc: string, areas: string[]) {
    const r = await createCustomRadar(name, desc || null, areas);
    setRadars(prev => [...prev, r]);
    setShowCreateModal(false);
    setTab('custom');
  }

  async function handleArchive(id: string) {
    await archiveRadar(id);
    setRadars(prev => prev.map(r => r.id === id ? { ...r, status: 'archived' as const } : r));
  }

  async function handleReactivate(id: string) {
    await reactivateRadar(id);
    setRadars(prev => prev.map(r => r.id === id ? { ...r, status: 'active' as const } : r));
  }

  async function handleDuplicate(id: string) {
    const copy = await duplicateRadar(id);
    setRadars(prev => [...prev, copy]);
  }

  async function handleDeleteRadar(id: string) {
    const result = await deleteRadar(id);
    if (result.hasEvaluations) {
      if (!confirm('Este radar tiene evaluaciones guardadas. ¿Archivar en vez de eliminar?\n\nPresioná Cancelar para no hacer nada.')) return;
      await archiveRadar(id);
      setRadars(prev => prev.map(r => r.id === id ? { ...r, status: 'archived' as const } : r));
    } else {
      setRadars(prev => prev.filter(r => r.id !== id));
    }
  }

  async function handleUpdateRadar(id: string, name: string, desc: string) {
    await updateRadar(id, { name: name.trim(), description: desc.trim() || null });
    setRadars(prev => prev.map(r => r.id === id ? { ...r, name: name.trim(), description: desc.trim() || null } : r));
    if (lifeRadar?.id === id) setLifeRadar(prev => prev ? { ...prev, name: name.trim() } : prev);
  }

  const customActive   = radars.filter(r => r.type === 'custom' && r.status === 'active');
  const customArchived = radars.filter(r => r.type === 'custom' && r.status === 'archived');

  if (loading) return <div className="flex justify-center py-24"><Loader2 size={32} className="animate-spin text-dorado-400" /></div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-dorado-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,146,42,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(139,26,46,0.10),transparent_40%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">Plan Maestro</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Target size={22} className="text-dorado-400" /> Radar
            </h1>
            <p className="text-sm text-plata-400 mt-0.5">Diagnóstico visual de tus áreas clave</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm"
          >
            <Plus size={16} /> Nuevo radar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-plata-700/50 overflow-hidden w-fit">
        <button onClick={() => setTab('vida')}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors ${tab === 'vida' ? 'bg-dorado-600 text-plata-900' : 'text-plata-400 hover:text-white'}`}>
          Radar de Vida
        </button>
        <button onClick={() => setTab('custom')}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2 ${tab === 'custom' ? 'bg-dorado-600 text-plata-900' : 'text-plata-400 hover:text-white'}`}>
          Personalizados
          {customActive.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'custom' ? 'bg-plata-900/30 text-plata-900' : 'bg-dorado-500/20 text-dorado-300'}`}>
              {customActive.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Radar de Vida */}
      {tab === 'vida' && (
        <>
          {!lifeRadar ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl border border-dorado-500/20 bg-dorado-900/20 flex items-center justify-center">
                <Target size={32} className="text-dorado-400/50" />
              </div>
              <p className="text-plata-300 font-semibold">El Radar de Vida no está inicializado.</p>
              <p className="text-plata-500 text-sm max-w-sm">Al inicializar se crea con las 12 áreas base y se migran las evaluaciones existentes.</p>
              <button onClick={handleInit} disabled={initializing}
                className="flex items-center gap-2 px-5 py-2.5 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60">
                {initializing ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                Inicializar Radar de Vida
              </button>
            </div>
          ) : (
            <RadarView
              radar={lifeRadar}
              onUpdateMeta={handleUpdateRadar}
            />
          )}
        </>
      )}

      {/* Tab: Personalizados */}
      {tab === 'custom' && (
        <>
          {customActive.length === 0 && customArchived.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl border border-plata-700/30 bg-plata-800/30 flex items-center justify-center">
                <Target size={32} className="text-plata-600" />
              </div>
              <p className="text-plata-300 font-semibold">No hay radares personalizados.</p>
              <p className="text-plata-500 text-sm max-w-sm">Creá un radar para cualquier área específica: negocios, salud, finanzas, familia...</p>
              <button onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors">
                <Plus size={16} /> Crear primer radar personalizado
              </button>
            </div>
          ) : (
            <CustomRadarsList
              active={customActive}
              archived={showArchived ? customArchived : []}
              showArchived={showArchived}
              archivedCount={customArchived.length}
              onToggleArchived={() => setShowArchived(s => !s)}
              onArchive={handleArchive}
              onReactivate={handleReactivate}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteRadar}
              onUpdateMeta={handleUpdateRadar}
            />
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateRadarModal onSave={handleCreateCustom} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// ─── CUSTOM RADARS LIST ───────────────────────────────────────────────────────

function CustomRadarsList({ active, archived, showArchived, archivedCount, onToggleArchived, onArchive, onReactivate, onDuplicate, onDelete, onUpdateMeta }: {
  active: PmRadar[];
  archived: PmRadar[];
  showArchived: boolean;
  archivedCount: number;
  onToggleArchived: () => void;
  onArchive: (id: string) => void;
  onReactivate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateMeta: (id: string, name: string, desc: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(active[0]?.id ?? null);

  // Bug fix: if selectedId no longer exists in active, reset to first active
  const selectedRadar = [...active, ...archived].find(r => r.id === selectedId);
  const effectiveSelectedId = selectedRadar ? selectedId : (active[0]?.id ?? null);
  const effectiveRadar = [...active, ...archived].find(r => r.id === effectiveSelectedId);

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de radares */}
      <div className="flex flex-wrap gap-2 items-center">
        {active.map(r => (
          <button key={r.id} onClick={() => setSelectedId(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              effectiveSelectedId === r.id ? 'bg-dorado-500/20 text-dorado-200 border-dorado-500/50' : 'text-plata-400 border-plata-700/50 hover:text-white hover:border-plata-500'
            }`}>
            {r.name}
          </button>
        ))}
        {archivedCount > 0 && (
          <button onClick={onToggleArchived}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-plata-500 border border-plata-800 hover:text-plata-300 transition-colors">
            <Archive size={12} />
            {showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}
          </button>
        )}
      </div>

      {/* Archived list */}
      {showArchived && archived.length > 0 && (
        <div className="rounded-xl border border-plata-800/60 bg-plata-900/50 p-3 flex flex-col gap-2">
          <p className="text-xs text-plata-500 uppercase tracking-wider mb-1">Archivados</p>
          {archived.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-plata-800/40">
              <span className="text-sm text-plata-400">{r.name}</span>
              <div className="flex gap-1">
                <button onClick={() => onReactivate(r.id)} title="Reactivar" className="p-1.5 text-plata-500 hover:text-emerald-300 rounded transition-colors"><RotateCcw size={12} /></button>
                <button onClick={() => onDuplicate(r.id)} title="Duplicar" className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors"><Copy size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected radar view */}
      {effectiveRadar && (
        <RadarView
          radar={effectiveRadar}
          onArchive={() => onArchive(effectiveRadar.id)}
          onDuplicate={() => onDuplicate(effectiveRadar.id)}
          onDelete={() => onDelete(effectiveRadar.id)}
          onUpdateMeta={onUpdateMeta}
        />
      )}
    </div>
  );
}

// ─── RADAR VIEW ───────────────────────────────────────────────────────────────

function RadarView({ radar, onArchive, onDuplicate, onDelete, onUpdateMeta }: {
  radar: PmRadar;
  onArchive?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUpdateMeta: (id: string, name: string, desc: string) => void;
}) {
  const [areaDefs, setAreaDefs] = useState<RadarAreaDef[]>([]);
  const [evaluations, setEvaluations] = useState<RadarEvaluation[]>([]);
  const [scoresCache, setScoresCache] = useState<Record<string, RadarScore[]>>({});
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEval, setEditEval] = useState<RadarEvaluation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showEditRadar, setShowEditRadar] = useState(false);
  const [showEditAreas, setShowEditAreas] = useState(false);

  useEffect(() => { loadRadarData(); }, [radar.id]);

  async function loadRadarData() {
    setLoading(true);
    try {
      const [defs, evals] = await Promise.all([
        getRadarAreaDefs(radar.id),
        getRadarEvaluations(radar.id),
      ]);
      setAreaDefs(defs);
      setEvaluations(evals);
      if (evals.length > 0) {
        const id = evals[0].id;
        setSelectedEvalId(id);
        const s = await getRadarScores(id);
        setScoresCache({ [id]: s });
        if (evals.length > 1) {
          const s2 = await getRadarScores(evals[1].id);
          setScoresCache(c => ({ ...c, [evals[1].id]: s2 }));
        }
      } else {
        setSelectedEvalId(null);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function ensureScores(id: string) {
    if (scoresCache[id]) return;
    const s = await getRadarScores(id);
    setScoresCache(c => ({ ...c, [id]: s }));
  }

  async function handleCreate(title: string, date: string, note: string, sm: ScoreMap) {
    const payload = mapToScorePayload(sm, areaDefs);
    const ev = await createRadarEvaluation(radar.id, { title, evaluation_date: date, general_note: note || null }, payload);
    const scores = await getRadarScores(ev.id);
    setEvaluations(prev => [ev, ...prev]);
    setScoresCache(c => ({ ...c, [ev.id]: scores }));
    setSelectedEvalId(ev.id);
    setShowForm(false);
  }

  async function handleEdit(title: string, date: string, note: string, sm: ScoreMap) {
    if (!editEval) return;
    const payload = mapToScorePayload(sm, areaDefs);
    await updateRadarEvaluation(editEval.id, { title, evaluation_date: date, general_note: note || null }, payload);
    const fresh = await getRadarScores(editEval.id);
    setEvaluations(prev => prev.map(e => e.id === editEval.id ? { ...e, title, evaluation_date: date, general_note: note || null } : e));
    setScoresCache(c => ({ ...c, [editEval.id]: fresh }));
    setEditEval(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    await deleteRadarEvaluation(id);
    setEvaluations(prev => prev.filter(e => e.id !== id));
    setScoresCache(c => { const n = { ...c }; delete n[id]; return n; });
    if (selectedEvalId === id) {
      const rem = evaluations.filter(e => e.id !== id);
      setSelectedEvalId(rem[0]?.id ?? null);
    }
  }

  async function handleAreaDefsUpdate(defs: RadarAreaDef[]) {
    setAreaDefs(defs);
    setShowEditAreas(false);
  }

  const current = evaluations.find(e => e.id === selectedEvalId);
  const currentScores = selectedEvalId ? (scoresCache[selectedEvalId] ?? []) : [];
  const currentMetrics = useMemo(() => calcRadarMetrics(currentScores), [currentScores]);
  const prevEval = evaluations.length > 1 && selectedEvalId === evaluations[0].id ? evaluations[1] : null;
  const prevScores = prevEval ? (scoresCache[prevEval.id] ?? []) : [];
  const prevMetrics = useMemo(() => calcRadarMetrics(prevScores), [prevScores]);

  // Build area color map: display_name → hex color (uses area def color or fallback by key)
  const areaColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    areaDefs.forEach(d => {
      m[d.display_name] = d.color ?? LIFE_RADAR_DEFAULT_COLORS[d.area_key] ?? '#6B7280';
    });
    return m;
  }, [areaDefs]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-dorado-400" /></div>;

  return (
    <div className="flex flex-col gap-5">
      {/* Radar header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">{radar.name}</h2>
          {radar.description && <p className="text-xs text-plata-500 mt-0.5">{radar.description}</p>}
          {radar.status === 'archived' && (
            <span className="text-[10px] text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">Archivado</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {areaDefs.length > 0 && (
            <button onClick={() => setShowEditAreas(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-plata-700 text-plata-400 hover:text-white rounded-lg transition-colors"
              title={radar.type === 'fixed' ? 'Renombrar áreas' : 'Editar áreas'}>
              <Settings size={12} /> {radar.type === 'fixed' ? 'Renombrar áreas' : 'Áreas'}
            </button>
          )}
          <button onClick={() => setShowEditRadar(true)}
            className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors" title="Editar nombre">
            <Pencil size={14} />
          </button>
          {radar.type === 'custom' && onDuplicate && (
            <button onClick={onDuplicate} className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors" title="Duplicar">
              <Copy size={14} />
            </button>
          )}
          {radar.type === 'custom' && onArchive && radar.status === 'active' && (
            <button onClick={onArchive} className="p-1.5 text-plata-500 hover:text-amber-400 rounded transition-colors" title="Archivar">
              <Archive size={14} />
            </button>
          )}
          {areaDefs.length > 0 && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg font-semibold transition-colors">
              <Plus size={12} /> Nueva evaluación
            </button>
          )}
        </div>
      </div>

      {/* No area defs yet */}
      {areaDefs.length === 0 && (
        <div className="rounded-xl border border-plata-700/40 bg-plata-900/60 p-8 text-center">
          <p className="text-plata-400 mb-3">Este radar no tiene áreas configuradas todavía.</p>
          {radar.type === 'custom' && (
            <button onClick={() => setShowEditAreas(true)}
              className="flex items-center gap-2 mx-auto px-4 py-2 text-sm bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg font-semibold transition-colors">
              <Settings size={14} /> Configurar áreas
            </button>
          )}
        </div>
      )}

      {/* No evaluations */}
      {areaDefs.length > 0 && evaluations.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Target size={28} className="text-dorado-400/40" />
          <p className="text-plata-400 text-sm">No hay evaluaciones para este radar.</p>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg font-semibold transition-colors">
            <Plus size={14} /> Crear primera evaluación
          </button>
        </div>
      )}

      {/* Content */}
      {evaluations.length > 0 && current && (
        <>
          {/* Historial toggle */}
          {evaluations.length > 1 && (
            <button onClick={() => setShowHistory(s => !s)}
              className="flex items-center gap-2 text-xs text-plata-400 hover:text-white transition-colors self-start">
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Historial ({evaluations.length} evaluaciones)
            </button>
          )}

          {showHistory && (
            <HistoryList
              evaluations={evaluations} selectedId={selectedEvalId} scoresMap={scoresCache}
              onSelect={async (id) => { setSelectedEvalId(id); await ensureScores(id); }}
              onEdit={async (e) => { await ensureScores(e.id); setEditEval(e); }}
              onDelete={handleDelete}
            />
          )}

          {/* Métricas */}
          {currentScores.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard icon={<Activity size={14} className="text-dorado-400" />} label="Promedio" value={`${currentMetrics.overallAvg}/10`} sub={current.title} />
              <MetricCard icon={<Zap size={14} className="text-emerald-400" />} label="Más fuerte" value={currentMetrics.strongestArea}
                sub={`${currentScores.find(s => s.area_name === currentMetrics.strongestArea)?.current_score ?? '—'}/10`} color="text-emerald-300" />
              <MetricCard icon={<AlertTriangle size={14} className="text-red-400" />} label="Más débil" value={currentMetrics.weakestArea}
                sub={`${currentScores.find(s => s.area_name === currentMetrics.weakestArea)?.current_score ?? '—'}/10`} color="text-red-300" />
              <MetricCard icon={<TrendingUp size={14} className="text-amber-400" />} label="Mayor brecha" value={currentMetrics.biggestGapArea}
                sub={(() => { const s = currentScores.find(x => x.area_name === currentMetrics.biggestGapArea); return s ? `${Math.max(0, s.target_score - s.current_score)} pts` : '—'; })()} color="text-amber-300" />
              <MetricCard icon={<ShieldCheck size={14} className="text-plata-400" />} label="Fecha" value={current.evaluation_date} sub="" />
            </div>
          )}

          {/* Chart + Cards */}
          {currentScores.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-5">
              <div className="rounded-2xl border border-plata-700/60 bg-plata-900/80 p-5 flex flex-col items-center gap-3 lg:w-[420px] shrink-0">
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-sm font-bold text-white">{current.title}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditEval(current); }}
                      className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(current.id)}
                      className="p-1.5 text-plata-500 hover:text-red-400 rounded transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
                <RadarChart scores={currentScores} areaColors={areaColorMap} size={340} />
                {current.general_note && (
                  <p className="text-xs text-plata-400 italic text-center border-t border-plata-800 pt-3 w-full">{current.general_note}</p>
                )}
              </div>
              <div className="flex-1 grid gap-3 sm:grid-cols-2 content-start">
                {[...currentScores].sort((a, b) => a.current_score - b.current_score).map(score => (
                  <AreaCard key={score.id} score={score} color={areaColorMap[score.area_name]} />
                ))}
              </div>
            </div>
          )}

          {/* Comparison */}
          {prevEval && prevScores.length > 0 && currentScores.length > 0 && (
            <div className="rounded-2xl border border-plata-700/60 bg-plata-900/80 overflow-hidden">
              <button onClick={() => setShowComparison(s => !s)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-plata-800/40 transition-colors">
                <span className="text-sm font-semibold text-plata-200">
                  Comparación con: <span className="text-plata-400">{prevEval.title}</span>
                </span>
                {showComparison ? <ChevronUp size={14} className="text-plata-500" /> : <ChevronDown size={14} className="text-plata-500" />}
              </button>
              {showComparison && (
                <ComparisonView currentScores={currentScores} prevScores={prevScores}
                  currentMetrics={currentMetrics} prevMetrics={prevMetrics}
                  currentTitle={current.title} prevTitle={prevEval.title} />
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showForm && areaDefs.length > 0 && (
        <EvalModal
          title="Nueva evaluación"
          areaDefs={areaDefs}
          initialTitle={`${radar.name} — ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}
          initialDate={new Date().toISOString().split('T')[0]}
          initialNote="" initialScores={buildScoreMap(areaDefs)}
          onSave={handleCreate} onClose={() => setShowForm(false)}
        />
      )}
      {editEval && areaDefs.length > 0 && (
        <EvalModal
          title="Editar evaluación"
          areaDefs={areaDefs}
          initialTitle={editEval.title}
          initialDate={editEval.evaluation_date}
          initialNote={editEval.general_note ?? ''}
          initialScores={scoresCache[editEval.id] ? scoresToMap(scoresCache[editEval.id]) : buildScoreMap(areaDefs)}
          onSave={handleEdit} onClose={() => setEditEval(null)}
        />
      )}
      {showEditRadar && (
        <EditRadarMetaModal
          radar={radar}
          onSave={(name, desc) => { onUpdateMeta(radar.id, name, desc); setShowEditRadar(false); }}
          onClose={() => setShowEditRadar(false)}
        />
      )}
      {showEditAreas && (
        <EditAreasModal
          radar={radar} areaDefs={areaDefs}
          isFixed={radar.type === 'fixed'}
          onSave={handleAreaDefsUpdate}
          onClose={() => setShowEditAreas(false)}
        />
      )}
    </div>
  );
}

// ─── SVG RADAR CHART ─────────────────────────────────────────────────────────

function RadarChart({ scores, areaColors, size = 320 }: {
  scores: RadarScore[];
  areaColors?: Record<string, string>;
  size?: number;
}) {
  const cx = size / 2, cy = size / 2;
  const maxR = size / 2 - 48;
  const n = scores.length;
  if (n < 3) return null;

  const angle  = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;
  const pt     = (i: number, v: number) => ({ x: cx + (v / 10) * maxR * Math.cos(angle(i)), y: cy + (v / 10) * maxR * Math.sin(angle(i)) });
  const lp     = (i: number) => { const r = maxR + 26; return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) }; };
  const gridLevels = [2, 4, 6, 8, 10];
  const poly   = (fn: (s: RadarScore) => number) => scores.map((s, i) => { const p = pt(i, fn(s)); return `${p.x},${p.y}`; }).join(' ');
  const truncate = (t: string, max = 12) => t.length > max ? t.slice(0, max - 1) + '…' : t;

  // Sector centered on axis i (spans ±halfAngle around axis i)
  // This way each dot sits at the center of its colored sector, not on a boundary
  const sectorPath = (i: number): string => {
    const half = Math.PI / n; // half the angular width of one sector
    const a1 = angle(i) - half;
    const a2 = angle(i) + half;
    const x1 = cx + maxR * Math.cos(a1);
    const y1 = cy + maxR * Math.sin(a1);
    const x2 = cx + maxR * Math.cos(a2);
    const y2 = cy + maxR * Math.sin(a2);
    // large-arc: 0 because sector angle = 2π/n ≤ 120° (n≥3), always < 180°
    return `M ${cx} ${cy} L ${x1} ${y1} A ${maxR} ${maxR} 0 0 1 ${x2} ${y2} Z`;
  };

  const colorOf = (s: RadarScore) =>
    areaColors?.[s.area_name] ?? '#6B7280';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">

      {/* 1. Sector wedges — colored background per area, very subtle */}
      {scores.map((s, i) => (
        <path key={`sector-${i}`} d={sectorPath(i)}
          fill={colorOf(s)} fillOpacity={0.10} stroke="none" />
      ))}

      {/* 2. Grid rings */}
      {gridLevels.map((lv, i) => (
        <polygon key={i} points={scores.map((_, j) => { const p = pt(j, lv); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke={lv === 10 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'} strokeWidth={lv === 10 ? 1.5 : 1} />
      ))}

      {/* 3. Grid level labels */}
      {gridLevels.map((lv, i) => { const p = pt(0, lv); return <text key={i} x={p.x + 4} y={p.y - 3} fontSize="9" fill="rgba(255,255,255,0.20)" fontFamily="sans-serif">{lv}</text>; })}

      {/* 4. Axis lines */}
      {scores.map((s, i) => {
        const o = pt(i, 10);
        return <path key={i} d={`M${cx},${cy} L${o.x},${o.y}`} stroke={colorOf(s)} strokeOpacity={0.25} strokeWidth={1} />;
      })}

      {/* 5. Target polygon */}
      <polygon points={poly(s => s.target_score)} fill="rgba(184,146,42,0.06)" stroke="rgba(184,146,42,0.28)" strokeWidth={1.5} strokeDasharray="4 3" />

      {/* 6. Current polygon — solid, slightly transparent */}
      <polygon points={poly(s => s.current_score)} fill="rgba(139,26,46,0.22)" stroke="rgba(200,50,70,0.75)" strokeWidth={2} />

      {/* 7. Score dots — colored per area */}
      {scores.map((s, i) => {
        const p = pt(i, s.current_score);
        const c = colorOf(s);
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill={c} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />;
      })}

      {/* 8. Area labels — colored per area */}
      {scores.map((s, i) => {
        const { x, y } = lp(i);
        const ang = angle(i);
        const anchor = Math.cos(ang) > 0.2 ? 'start' : Math.cos(ang) < -0.2 ? 'end' : 'middle';
        const c = colorOf(s);
        const parts = truncate(s.area_name, 14).split(' / ');
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} fontSize="10" fill={c} fillOpacity={0.92} fontFamily="sans-serif" fontWeight="600">
            {parts.length === 1
              ? <tspan dominantBaseline="middle">{parts[0]}</tspan>
              : <><tspan x={x} dy="-6">{parts[0]}</tspan><tspan x={x} dy="13">{parts[1]}</tspan></>}
          </text>
        );
      })}

      {/* 9. Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.15)" />

      {/* 10. Legend */}
      <g transform={`translate(${size - 120},${size - 30})`}>
        <line x1={0} y1={8} x2={18} y2={8} stroke="rgba(200,50,70,0.80)" strokeWidth={2} />
        <circle cx={9} cy={8} r={3} fill="rgba(200,50,70,0.80)" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
        <text x={22} y={12} fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">Actual</text>
        <line x1={0} y1={22} x2={18} y2={22} stroke="rgba(184,146,42,0.50)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={22} y={26} fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">Objetivo</text>
      </g>
    </svg>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-plata-400">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className={`text-sm font-bold leading-tight truncate ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-plata-500 truncate">{sub}</p>}
    </div>
  );
}

// ─── AREA CARD ────────────────────────────────────────────────────────────────

function AreaCard({ score, color }: { score: RadarScore; color?: string }) {
  const st = getAreaStatus(score.current_score);
  const gap = Math.max(0, score.target_score - score.current_score);
  const accentColor = color ?? '#6B7280';
  return (
    <div className={`rounded-xl border p-3.5 flex gap-3 ${st.bg} border-current/20`}
      style={{ borderLeft: `3px solid ${accentColor}` }}>
      {/* Left color strip is the border-left */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: accentColor }} />
          <p className="text-sm font-semibold text-white leading-snug">{score.area_name}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/20 ${st.color} shrink-0`}>{st.label}</span>
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-[10px] text-plata-400 mb-1"><span>Actual</span><span className="font-bold text-white">{score.current_score}/10</span></div>
        <div className="h-2 bg-plata-800/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{
            width: `${score.current_score * 10}%`,
            background: score.current_score <= 3 ? 'rgb(248,113,113)' : score.current_score <= 5 ? 'rgb(251,191,36)' : score.current_score <= 7 ? 'rgb(184,146,42)' : 'rgb(52,211,153)',
          }} />
        </div>
        <div className="flex justify-between text-[10px] text-plata-500 mt-0.5">
          <span>Objetivo: {score.target_score}</span><span>Brecha: {gap > 0 ? `+${gap}` : '✓'}</span>
        </div>
      </div>
      {score.note && <p className="text-xs text-plata-400 line-clamp-2">{score.note}</p>}
      {score.main_action && (
        <div className="flex items-start gap-1.5 bg-black/20 rounded-lg px-2.5 py-1.5">
          <span className="text-dorado-400 text-xs mt-px">→</span>
          <p className="text-xs text-dorado-200 line-clamp-2">{score.main_action}</p>
        </div>
      )}
      </div>{/* closes inner flex-col wrapper */}
    </div>
  );
}

// ─── HISTORY LIST ─────────────────────────────────────────────────────────────

function HistoryList({ evaluations, selectedId, scoresMap, onSelect, onEdit, onDelete }: {
  evaluations: RadarEvaluation[]; selectedId: string | null; scoresMap: Record<string, RadarScore[]>;
  onSelect: (id: string) => void; onEdit: (e: RadarEvaluation) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-plata-700/60 bg-plata-900/80 overflow-hidden">
      <div className="divide-y divide-plata-800/50">
        {evaluations.map(e => {
          const sc = scoresMap[e.id] ?? [];
          const m = calcRadarMetrics(sc);
          return (
            <div key={e.id} onClick={() => onSelect(e.id)}
              className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-plata-800/30 transition-colors ${selectedId === e.id ? 'bg-dorado-900/20 border-l-2 border-dorado-400' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{e.title}</p>
                <div className="flex gap-3 text-[10px] text-plata-500 mt-0.5">
                  <span>{e.evaluation_date}</span>
                  {sc.length > 0 && <><span>Prom: <span className="text-dorado-400 font-bold">{m.overallAvg}</span></span><span>✓ {m.strongestArea}</span><span>✗ {m.weakestArea}</span></>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={ev => { ev.stopPropagation(); onEdit(e); }} className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors"><Pencil size={12} /></button>
                <button onClick={ev => { ev.stopPropagation(); onDelete(e.id); }} className="p-1.5 text-plata-500 hover:text-red-400 rounded transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── COMPARISON VIEW ──────────────────────────────────────────────────────────

function ComparisonView({ currentScores, prevScores, currentMetrics, prevMetrics, currentTitle, prevTitle }: {
  currentScores: RadarScore[]; prevScores: RadarScore[];
  currentMetrics: { overallAvg: number }; prevMetrics: { overallAvg: number };
  currentTitle: string; prevTitle: string;
}) {
  const diff = Math.round((currentMetrics.overallAvg - prevMetrics.overallAvg) * 10) / 10;
  const improved: string[] = [], declined: string[] = [];
  currentScores.forEach(cs => {
    const ps = prevScores.find(p => p.area_name === cs.area_name || p.area_key === cs.area_key);
    if (!ps) return;
    if (cs.current_score > ps.current_score) improved.push(cs.area_name);
    if (cs.current_score < ps.current_score) declined.push(cs.area_name);
  });
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[{ t: prevTitle, v: prevMetrics.overallAvg, c: 'text-plata-300' }, { t: 'Variación', v: diff, c: diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-red-300' : 'text-plata-400', diff: true }, { t: currentTitle, v: currentMetrics.overallAvg, c: 'text-white' }].map((item, i) => (
          <div key={i} className={`rounded-xl border p-3 ${i === 1 && diff > 0 ? 'border-emerald-500/30 bg-emerald-900/20' : i === 1 && diff < 0 ? 'border-red-500/20 bg-red-900/10' : 'border-plata-700/50 bg-plata-900/60'}`}>
            <p className="text-[10px] text-plata-500 uppercase tracking-wider mb-1 truncate">{item.t}</p>
            <p className={`text-xl font-bold flex items-center justify-center gap-1 ${item.c}`}>
              {item.diff && (diff > 0 ? <TrendingUp size={16} /> : diff < 0 ? <TrendingDown size={16} /> : <Minus size={16} />)}
              {item.diff && diff > 0 ? `+${item.v}` : item.v}
            </p>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {improved.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-3">
            <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1.5"><TrendingUp size={13} /> Subieron</p>
            <div className="flex flex-wrap gap-1.5">{improved.map(a => <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">{a}</span>)}</div>
          </div>
        )}
        {declined.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-3">
            <p className="text-xs font-semibold text-red-300 mb-2 flex items-center gap-1.5"><TrendingDown size={13} /> Bajaron</p>
            <div className="flex flex-wrap gap-1.5">{declined.map(a => <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20">{a}</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EVAL MODAL ───────────────────────────────────────────────────────────────

function EvalModal({ title, areaDefs, initialTitle, initialDate, initialNote, initialScores, onSave, onClose }: {
  title: string; areaDefs: RadarAreaDef[];
  initialTitle: string; initialDate: string; initialNote: string; initialScores: ScoreMap;
  onSave: (title: string, date: string, note: string, sm: ScoreMap) => Promise<void>; onClose: () => void;
}) {
  const [evalTitle, setEvalTitle] = useState(initialTitle);
  const [evalDate, setEvalDate] = useState(initialDate);
  const [evalNote, setEvalNote] = useState(initialNote);
  const [scores, setScores] = useState<ScoreMap>({ ...initialScores });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'meta' | 'areas'>('meta');

  const avg = useMemo(() => {
    const vals = areaDefs.map(d => scores[d.area_key]?.current ?? 5);
    return (vals.reduce((s, v) => s + v, 0) / (vals.length || 1)).toFixed(1);
  }, [scores, areaDefs]);

  const setScore = (key: string, field: 'current' | 'target' | 'note' | 'action', v: string | number) =>
    setScores(prev => ({ ...prev, [key]: { ...prev[key], [field]: v } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!evalTitle.trim()) return;
    setSaving(true);
    try { await onSave(evalTitle, evalDate, evalNote, scores); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-plata-700/50">
          <h3 className="text-base font-bold text-white flex items-center gap-2"><Target size={16} className="text-dorado-400" /> {title}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-plata-500">Promedio: <span className="text-dorado-300 font-bold">{avg}</span></span>
            <button type="button" onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded-lg"><X size={18} /></button>
          </div>
        </div>
        <div className="flex border-b border-plata-700/50">
          {(['meta', 'areas'] as const).map((s, i) => (
            <button key={s} type="button" onClick={() => setStep(s)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${step === s ? 'text-dorado-300 border-b-2 border-dorado-400' : 'text-plata-400 hover:text-white'}`}>
              {i + 1}. {s === 'meta' ? 'General' : `Áreas (${areaDefs.length})`}
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
          <div className="p-5">
            {step === 'meta' ? (
              <div className="flex flex-col gap-4">
                <div><label className="text-xs text-plata-400 mb-1 block">Título *</label>
                  <input autoFocus value={evalTitle} onChange={e => setEvalTitle(e.target.value)} className="pm-input" required /></div>
                <div><label className="text-xs text-plata-400 mb-1 block">Fecha</label>
                  <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)} className="pm-input" /></div>
                <div><label className="text-xs text-plata-400 mb-1 block">Nota general (opcional)</label>
                  <textarea value={evalNote} onChange={e => setEvalNote(e.target.value)} rows={2} className="pm-input resize-none" /></div>
                <button type="button" onClick={() => setStep('areas')} className="self-end px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors">Siguiente →</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-plata-500 mb-1">Slider = puntaje actual. Campo Obj = puntaje objetivo.</p>
                {areaDefs.map(def => {
                  const s = scores[def.area_key] ?? { current: 5, target: 8, note: '', action: '' };
                  const st = getAreaStatus(s.current);
                  return (
                    <div key={def.area_key} className={`rounded-xl border p-3.5 ${st.bg} border-current/10`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-white">{def.display_name}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold ${st.color}`}>{st.label}</span>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-plata-400">Obj:</label>
                            <input type="number" min={1} max={10} value={s.target}
                              onChange={e => setScore(def.area_key, 'target', Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                              className="w-12 text-center text-xs bg-plata-800/60 border border-plata-700/50 rounded px-1 py-0.5 text-dorado-300 font-bold" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-black text-white w-8 text-center">{s.current}</span>
                        <input type="range" min={1} max={10} value={s.current}
                          onChange={e => setScore(def.area_key, 'current', parseInt(e.target.value))}
                          className="flex-1 accent-bordo-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={s.note} onChange={e => setScore(def.area_key, 'note', e.target.value)} placeholder="Motivo..." className="pm-input text-xs py-1.5" />
                        <input value={s.action} onChange={e => setScore(def.area_key, 'action', e.target.value)} placeholder="Acción..." className="pm-input text-xs py-1.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end px-5 py-4 border-t border-plata-700/50">
            {step === 'areas' && <button type="button" onClick={() => setStep('meta')} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">← Atrás</button>}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
            {step === 'areas' && (
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CREATE RADAR MODAL ───────────────────────────────────────────────────────

function CreateRadarModal({ onSave, onClose }: {
  onSave: (name: string, desc: string, areas: string[]) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [areas, setAreas] = useState<string[]>(['', '', '']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function applyTemplate(t: { name: string; areas: string[] }) {
    setName(t.name);
    setAreas([...t.areas]);
  }

  function addArea() {
    if (areas.length >= 16) return;
    setAreas(prev => [...prev, '']);
  }

  function removeArea(i: number) {
    if (areas.length <= 3) return;
    setAreas(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateArea(i: number, v: string) {
    setAreas(prev => prev.map((a, idx) => idx === i ? v : a));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const valid = areas.filter(a => a.trim());
    if (!name.trim()) { setError('El nombre del radar es obligatorio.'); return; }
    if (valid.length < 3) { setError('Mínimo 3 áreas con nombre.'); return; }
    if (valid.length > 16) { setError('Máximo 16 áreas.'); return; }
    setSaving(true);
    try { await onSave(name, desc, valid); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg mb-8 flex flex-col gap-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-plata-700/50">
          <h3 className="text-base font-bold text-white">Nuevo radar personalizado</h3>
          <button type="button" onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {/* Plantillas */}
          <div>
            <label className="text-xs text-plata-400 mb-2 block">Empezar desde una plantilla (opcional)</label>
            <div className="flex flex-wrap gap-1.5">
              {RADAR_TEMPLATES.map(t => (
                <button key={t.name} type="button" onClick={() => applyTemplate(t)}
                  className="px-2.5 py-1 text-xs border border-plata-700/60 text-plata-400 hover:text-white hover:border-dorado-500/50 hover:bg-dorado-900/20 rounded-lg transition-colors">
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Nombre del radar *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Radar Modeltex" className="pm-input" required autoFocus />
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Descripción (opcional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Para qué usás este radar" className="pm-input" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-plata-400">Áreas ({areas.filter(a => a.trim()).length}/{areas.length}) — mín. 3, máx. 16</label>
              {areas.length < 16 && (
                <button type="button" onClick={addArea} className="text-xs text-dorado-400 hover:text-dorado-300 flex items-center gap-1 transition-colors">
                  <Plus size={12} /> Agregar
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {areas.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-plata-600 w-5 shrink-0">{i + 1}.</span>
                  <input value={a} onChange={e => updateArea(i, e.target.value)} placeholder={`Área ${i + 1}`} className="pm-input flex-1" />
                  {areas.length > 3 && (
                    <button type="button" onClick={() => removeArea(i)} className="p-1.5 text-plata-600 hover:text-red-400 rounded transition-colors shrink-0"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-plata-700/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Crear radar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── EDIT RADAR META MODAL ────────────────────────────────────────────────────

function EditRadarMetaModal({ radar, onSave, onClose }: {
  radar: PmRadar; onSave: (name: string, desc: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(radar.name);
  const [desc, setDesc] = useState(radar.description ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Editar nombre</h3>
          <button onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded"><X size={16} /></button>
        </div>
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Nombre *</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} className="pm-input" />
        </div>
        {radar.type === 'custom' && (
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Descripción</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} className="pm-input" />
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
          <button onClick={() => { if (name.trim()) onSave(name, desc); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors">
            <Save size={14} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT AREAS MODAL ─────────────────────────────────────────────────────────

function EditAreasModal({ radar, areaDefs, isFixed, onSave, onClose }: {
  radar: PmRadar; areaDefs: RadarAreaDef[];
  isFixed: boolean;
  onSave: (defs: RadarAreaDef[]) => void; onClose: () => void;
}) {
  const [defs, setDefs] = useState<RadarAreaDef[]>([...areaDefs]);
  const [newAreaName, setNewAreaName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeDefs = defs.filter(d => d.is_active);

  async function handleRename(id: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setDefs(prev => prev.map(d => d.id === id ? { ...d, display_name: trimmed } : d));
    await updateAreaDef(id, { display_name: trimmed });
  }

  async function handleRemove(id: string) {
    if (isFixed) return; // Radar de Vida: no se pueden eliminar áreas
    if (activeDefs.length <= 3) { setError('Mínimo 3 áreas activas.'); return; }
    await removeAreaFromRadar(id);
    setDefs(prev => prev.filter(d => d.id !== id));
    setError('');
  }

  async function handleAdd() {
    if (isFixed) return; // Radar de Vida: no se pueden agregar áreas
    if (!newAreaName.trim()) return;
    if (activeDefs.length >= 16) { setError('Máximo 16 áreas.'); return; }
    setSaving(true);
    try {
      const def = await addAreaToRadar(radar.id, newAreaName, activeDefs.length);
      setDefs(prev => [...prev, def]);
      setNewAreaName('');
      setError('');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-plata-700/50">
          <div>
            <h3 className="text-base font-bold text-white">{isFixed ? 'Renombrar áreas' : 'Editar áreas'} — {radar.name}</h3>
            {isFixed && <p className="text-xs text-plata-500 mt-0.5">Solo podés cambiar el nombre visible. Las áreas no se pueden agregar ni eliminar.</p>}
          </div>
          <button onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded"><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {!isFixed && <p className="text-xs text-plata-500">{activeDefs.length} áreas activas · mín. 3, máx. 16</p>}
          {defs.filter(d => d.is_active).map((d, idx) => {
            const defColor = d.color ?? LIFE_RADAR_DEFAULT_COLORS[d.area_key] ?? '#6B7280';
            return (
              <div key={d.id} className="flex items-center gap-2">
                {!isFixed && <GripVertical size={14} className="text-plata-700 shrink-0" />}
                {isFixed && <span className="text-xs text-plata-600 w-5 shrink-0 text-center">{idx + 1}.</span>}
                {/* Color picker: onChange → local state only, onBlur → DB write */}
                <input
                  type="color"
                  value={defColor}
                  onChange={e => {
                    const hex = e.target.value;
                    setDefs(prev => prev.map(x => x.id === d.id ? { ...x, color: hex } : x));
                  }}
                  onBlur={e => {
                    updateAreaDef(d.id, { color: e.target.value }).catch(console.error);
                  }}
                  className="w-8 h-8 rounded cursor-pointer shrink-0"
                  title="Color del área"
                />
                <input
                  defaultValue={d.display_name}
                  onBlur={e => { if (e.target.value !== d.display_name) handleRename(d.id, e.target.value); }}
                  className="pm-input flex-1 text-sm"
                />
                {!isFixed && !d.is_required && (
                  <button onClick={() => handleRemove(d.id)} className="p-1.5 text-plata-600 hover:text-red-400 rounded transition-colors shrink-0"><Trash2 size={12} /></button>
                )}
              </div>
            );
          })}

          {/* Agregar área: solo para radares custom */}
          {!isFixed && activeDefs.length < 16 && (
            <div className="flex gap-2 mt-1">
              <input value={newAreaName} onChange={e => setNewAreaName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                placeholder="Nombre de nueva área" className="pm-input flex-1 text-sm" />
              <button onClick={handleAdd} disabled={saving || !newAreaName.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg disabled:opacity-60 shrink-0 transition-colors">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-plata-700/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
          <button onClick={() => { onSave(defs.filter(d => d.is_active)); }} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors">
            <Save size={14} /> Listo
          </button>
        </div>
      </div>
    </div>
  );
}
