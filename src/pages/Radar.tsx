import { useEffect, useMemo, useState } from 'react';
import {
  Target, Plus, Pencil, Trash2, Loader2, X, Save,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus,
  AlertTriangle, ShieldCheck, Zap, Activity,
} from 'lucide-react';
import {
  type RadarEvaluation, type RadarScore, type RadarAreaName,
  RADAR_AREAS, calcRadarMetrics, getAreaStatus,
  getRadarEvaluations, getRadarScores,
  createRadarEvaluation, updateRadarEvaluation, deleteRadarEvaluation,
} from '../lib/planMaestro';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ScoreMap = Record<string, { current: number; target: number; note: string; action: string }>;

function buildDefaultScoreMap(): ScoreMap {
  const m: ScoreMap = {};
  RADAR_AREAS.forEach(a => { m[a] = { current: 5, target: 8, note: '', action: '' }; });
  return m;
}

function scoresToMap(scores: RadarScore[]): ScoreMap {
  const m = buildDefaultScoreMap();
  scores.forEach(s => {
    m[s.area_name] = {
      current: s.current_score,
      target: s.target_score,
      note: s.note ?? '',
      action: s.main_action ?? '',
    };
  });
  return m;
}

function mapToScores(m: ScoreMap): Omit<RadarScore, 'id' | 'evaluation_id' | 'user_id' | 'created_at' | 'updated_at'>[] {
  return RADAR_AREAS.map(a => ({
    area_name: a,
    current_score: m[a].current,
    target_score: m[a].target,
    note: m[a].note.trim() || null,
    main_action: m[a].action.trim() || null,
  }));
}

// ─── SVG RADAR CHART ─────────────────────────────────────────────────────────

function RadarChart({ scores, size = 320 }: { scores: RadarScore[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 48;
  const n = scores.length;
  if (n === 0) return null;

  const angle = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;

  const point = (i: number, value: number) => {
    const r = (value / 10) * maxR;
    return {
      x: cx + r * Math.cos(angle(i)),
      y: cy + r * Math.sin(angle(i)),
    };
  };

  const labelPoint = (i: number) => {
    const r = maxR + 26;
    return {
      x: cx + r * Math.cos(angle(i)),
      y: cy + r * Math.sin(angle(i)),
    };
  };

  const gridLevels = [2, 4, 6, 8, 10];

  const polygonPoints = (value: (s: RadarScore) => number) =>
    scores.map((s, i) => {
      const p = point(i, value(s));
      return `${p.x},${p.y}`;
    }).join(' ');

  // Axis lines
  const axisLines = scores.map((_, i) => {
    const outer = point(i, 10);
    return `M${cx},${cy} L${outer.x},${outer.y}`;
  });

  // Grid polygons
  const gridPolygons = gridLevels.map(level =>
    scores.map((_, i) => {
      const p = point(i, level);
      return `${p.x},${p.y}`;
    }).join(' ')
  );

  // Label truncation
  const truncate = (text: string, max = 12) =>
    text.length > max ? text.slice(0, max - 1) + '…' : text;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grid polygons */}
      {gridPolygons.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke={gridLevels[i] === 10 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
          strokeWidth={gridLevels[i] === 10 ? 1.5 : 1}
        />
      ))}

      {/* Grid level labels */}
      {gridLevels.map((level, i) => {
        const p = point(0, level);
        return (
          <text key={i} x={p.x + 4} y={p.y - 3} fontSize="9" fill="rgba(255,255,255,0.25)" fontFamily="sans-serif">
            {level}
          </text>
        );
      })}

      {/* Axis lines */}
      {axisLines.map((d, i) => (
        <path key={i} d={d} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      ))}

      {/* Target polygon */}
      <polygon
        points={polygonPoints(s => s.target_score)}
        fill="rgba(184,146,42,0.07)"
        stroke="rgba(184,146,42,0.30)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />

      {/* Current polygon */}
      <polygon
        points={polygonPoints(s => s.current_score)}
        fill="rgba(139,26,46,0.25)"
        stroke="rgba(200,50,70,0.80)"
        strokeWidth={2}
      />

      {/* Score dots */}
      {scores.map((s, i) => {
        const p = point(i, s.current_score);
        return (
          <circle key={i} cx={p.x} cy={p.y} r={3.5}
            fill="#8B1A2E" stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        );
      })}

      {/* Area labels */}
      {scores.map((s, i) => {
        const lp = labelPoint(i);
        const ang = angle(i);
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.cos(ang) > 0.2) anchor = 'start';
        if (Math.cos(ang) < -0.2) anchor = 'end';
        const label = truncate(s.area_name, 14);
        const parts = label.split(' / ');
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor={anchor}
            fontSize="10" fill="rgba(255,255,255,0.75)" fontFamily="sans-serif" fontWeight="500">
            {parts.length === 1 ? (
              <tspan dominantBaseline="middle">{parts[0]}</tspan>
            ) : (
              <>
                <tspan x={lp.x} dy="-6">{parts[0]}</tspan>
                <tspan x={lp.x} dy="13">{parts[1]}</tspan>
              </>
            )}
          </text>
        );
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.2)" />

      {/* Legend */}
      <g transform={`translate(${size - 120}, ${size - 30})`}>
        <line x1={0} y1={8} x2={18} y2={8} stroke="rgba(200,50,70,0.80)" strokeWidth={2} />
        <circle cx={9} cy={8} r={3} fill="#8B1A2E" stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        <text x={22} y={12} fontSize="9" fill="rgba(255,255,255,0.5)" fontFamily="sans-serif">Actual</text>
        <line x1={0} y1={22} x2={18} y2={22} stroke="rgba(184,146,42,0.50)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={22} y={26} fontSize="9" fill="rgba(255,255,255,0.5)" fontFamily="sans-serif">Objetivo</text>
      </g>
    </svg>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Radar() {
  const [evaluations, setEvaluations] = useState<RadarEvaluation[]>([]);
  const [scoresMap, setScoresMap] = useState<Record<string, RadarScore[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEval, setEditEval] = useState<RadarEvaluation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const evals = await getRadarEvaluations();
      setEvaluations(evals);
      if (evals.length > 0) {
        const id = evals[0].id;
        setSelectedId(id);
        const scores = await getRadarScores(id);
        setScoresMap(m => ({ ...m, [id]: scores }));
        // preload second for comparison
        if (evals.length > 1) {
          const id2 = evals[1].id;
          const scores2 = await getRadarScores(id2);
          setScoresMap(m => ({ ...m, [id2]: scores2 }));
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadScores(id: string) {
    if (scoresMap[id]) return;
    const scores = await getRadarScores(id);
    setScoresMap(m => ({ ...m, [id]: scores }));
  }

  async function handleSelectEval(id: string) {
    setSelectedId(id);
    await loadScores(id);
  }

  async function handleCreate(title: string, date: string, note: string, sm: ScoreMap) {
    const ev = await createRadarEvaluation(
      { title: title.trim(), evaluation_date: date, general_note: note.trim() || null },
      mapToScores(sm)
    );
    const scores = mapToScores(sm).map((s, i) => ({ ...s, id: `tmp_${i}`, evaluation_id: ev.id, user_id: '', created_at: '', updated_at: '' })) as RadarScore[];
    setEvaluations(prev => [ev, ...prev]);
    setScoresMap(m => ({ ...m, [ev.id]: scores }));
    setSelectedId(ev.id);
    setShowForm(false);
  }

  async function handleEdit(title: string, date: string, note: string, sm: ScoreMap) {
    if (!editEval) return;
    await updateRadarEvaluation(
      editEval.id,
      { title: title.trim(), evaluation_date: date, general_note: note.trim() || null },
      mapToScores(sm)
    );
    setEvaluations(prev => prev.map(e => e.id === editEval.id ? { ...e, title: title.trim(), evaluation_date: date, general_note: note.trim() || null } : e));
    const freshScores = await getRadarScores(editEval.id);
    setScoresMap(m => ({ ...m, [editEval.id]: freshScores }));
    setEditEval(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta evaluación y todos sus puntajes? Esta acción no se puede deshacer.')) return;
    await deleteRadarEvaluation(id);
    setEvaluations(prev => prev.filter(e => e.id !== id));
    setScoresMap(m => { const n = { ...m }; delete n[id]; return n; });
    if (selectedId === id) {
      const remaining = evaluations.filter(e => e.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
  }

  const current = evaluations.find(e => e.id === selectedId);
  const currentScores = selectedId ? (scoresMap[selectedId] ?? []) : [];
  const currentMetrics = useMemo(() => calcRadarMetrics(currentScores), [currentScores]);

  const prevEval = evaluations.length > 1 && selectedId === evaluations[0].id ? evaluations[1] : null;
  const prevScores = prevEval ? (scoresMap[prevEval.id] ?? []) : [];
  const prevMetrics = useMemo(() => calcRadarMetrics(prevScores), [prevScores]);

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
            <p className="text-sm text-plata-400 mt-0.5">Diagnóstico visual de tus áreas clave de vida</p>
          </div>
          <div className="flex items-center gap-3">
            {evaluations.length > 0 && (
              <button
                onClick={() => setShowHistory(s => !s)}
                className="flex items-center gap-2 px-3 py-2 border border-plata-700 text-plata-300 hover:text-white hover:border-plata-500 rounded-xl text-sm transition-colors"
              >
                {showHistory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                Historial ({evaluations.length})
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm"
            >
              <Plus size={16} /> Nueva evaluación
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 size={32} className="animate-spin text-dorado-400" /></div>
      ) : evaluations.length === 0 ? (
        <EmptyState onNew={() => setShowForm(true)} />
      ) : (
        <>
          {/* Historial */}
          {showHistory && (
            <HistoryList
              evaluations={evaluations}
              selectedId={selectedId}
              scoresMap={scoresMap}
              onSelect={handleSelectEval}
              onEdit={async (e) => {
                await loadScores(e.id);
                setEditEval(e);
              }}
              onDelete={handleDelete}
            />
          )}

          {/* Métricas resumen */}
          {current && currentScores.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard
                icon={<Activity size={15} className="text-dorado-400" />}
                label="Promedio general"
                value={`${currentMetrics.overallAvg}/10`}
                sub={current.title}
              />
              <MetricCard
                icon={<Zap size={15} className="text-emerald-400" />}
                label="Área más fuerte"
                value={currentMetrics.strongestArea}
                sub={`${currentScores.find(s => s.area_name === currentMetrics.strongestArea)?.current_score ?? '—'}/10`}
                color="text-emerald-300"
              />
              <MetricCard
                icon={<AlertTriangle size={15} className="text-red-400" />}
                label="Área más débil"
                value={currentMetrics.weakestArea}
                sub={`${currentScores.find(s => s.area_name === currentMetrics.weakestArea)?.current_score ?? '—'}/10`}
                color="text-red-300"
              />
              <MetricCard
                icon={<TrendingUp size={15} className="text-amber-400" />}
                label="Mayor brecha"
                value={currentMetrics.biggestGapArea}
                sub={(() => {
                  const s = currentScores.find(x => x.area_name === currentMetrics.biggestGapArea);
                  return s ? `${s.target_score - s.current_score} pts` : '—';
                })()}
                color="text-amber-300"
              />
              <MetricCard
                icon={<ShieldCheck size={15} className="text-plata-400" />}
                label="Última evaluación"
                value={current.evaluation_date}
                sub=""
              />
            </div>
          )}

          {/* Layout: gráfico + tarjetas */}
          {current && currentScores.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Gráfico radar */}
              <div className="rounded-2xl border border-plata-700/60 bg-plata-900/80 p-5 flex flex-col items-center gap-3 lg:w-[420px] shrink-0">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-sm font-bold text-white">{current.title}</h2>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditEval(current); }} className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(current.id)} className="p-1.5 text-plata-500 hover:text-red-400 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <RadarChart scores={currentScores} size={340} />
                {current.general_note && (
                  <p className="text-xs text-plata-400 italic text-center border-t border-plata-800 pt-3 w-full">{current.general_note}</p>
                )}
              </div>

              {/* Tarjetas de áreas */}
              <div className="flex-1 grid gap-3 sm:grid-cols-2 content-start">
                {currentScores
                  .sort((a, b) => a.current_score - b.current_score)
                  .map(score => (
                    <AreaCard key={score.area_name} score={score} />
                  ))}
              </div>
            </div>
          )}

          {/* Comparación */}
          {prevEval && prevScores.length > 0 && currentScores.length > 0 && (
            <div className="rounded-2xl border border-plata-700/60 bg-plata-900/80 overflow-hidden">
              <button
                onClick={() => setShowComparison(s => !s)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-plata-800/40 transition-colors"
              >
                <span className="text-sm font-semibold text-plata-200">
                  Comparación con evaluación anterior: <span className="text-plata-400">{prevEval.title}</span>
                </span>
                {showComparison ? <ChevronUp size={15} className="text-plata-500" /> : <ChevronDown size={15} className="text-plata-500" />}
              </button>
              {showComparison && (
                <ComparisonView
                  currentScores={currentScores}
                  prevScores={prevScores}
                  currentMetrics={currentMetrics}
                  prevMetrics={prevMetrics}
                  currentTitle={current?.title ?? ''}
                  prevTitle={prevEval.title}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {showForm && (
        <EvalModal
          title="Nueva evaluación"
          initialTitle={`Radar ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}
          initialDate={new Date().toISOString().split('T')[0]}
          initialNote=""
          initialScores={buildDefaultScoreMap()}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
      {editEval && (
        <EvalModal
          title="Editar evaluación"
          initialTitle={editEval.title}
          initialDate={editEval.evaluation_date}
          initialNote={editEval.general_note ?? ''}
          initialScores={scoresMap[editEval.id] ? scoresToMap(scoresMap[editEval.id]) : buildDefaultScoreMap()}
          onSave={handleEdit}
          onClose={() => setEditEval(null)}
        />
      )}
    </div>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-plata-400">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className={`text-sm font-bold leading-tight truncate ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-plata-500 truncate">{sub}</p>}
    </div>
  );
}

// ─── AREA CARD ────────────────────────────────────────────────────────────────

function AreaCard({ score }: { score: RadarScore }) {
  const status = getAreaStatus(score.current_score);
  const gap = Math.max(0, score.target_score - score.current_score);

  return (
    <div className={`rounded-xl border p-3.5 flex flex-col gap-2 ${status.bg} border-current/20`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white leading-snug">{score.area_name}</p>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/20 ${status.color} shrink-0`}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Score bar */}
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-plata-400 mb-1">
            <span>Actual</span>
            <span className="font-bold text-white">{score.current_score}/10</span>
          </div>
          <div className="h-2 bg-plata-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${score.current_score * 10}%`,
                background: score.current_score <= 3 ? 'rgb(248,113,113)' :
                  score.current_score <= 5 ? 'rgb(251,191,36)' :
                  score.current_score <= 7 ? 'rgb(184,146,42)' : 'rgb(52,211,153)',
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-plata-500 mt-0.5">
            <span>Objetivo: {score.target_score}</span>
            <span>Brecha: {gap > 0 ? `+${gap}` : '✓'}</span>
          </div>
        </div>
      </div>

      {score.note && (
        <p className="text-xs text-plata-400 line-clamp-2 leading-relaxed">{score.note}</p>
      )}
      {score.main_action && (
        <div className="flex items-start gap-1.5 bg-black/20 rounded-lg px-2.5 py-1.5">
          <span className="text-dorado-400 text-xs mt-px">→</span>
          <p className="text-xs text-dorado-200 line-clamp-2">{score.main_action}</p>
        </div>
      )}
    </div>
  );
}

// ─── HISTORY LIST ─────────────────────────────────────────────────────────────

function HistoryList({ evaluations, selectedId, scoresMap, onSelect, onEdit, onDelete }: {
  evaluations: RadarEvaluation[];
  selectedId: string | null;
  scoresMap: Record<string, RadarScore[]>;
  onSelect: (id: string) => void;
  onEdit: (e: RadarEvaluation) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-plata-700/60 bg-plata-900/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-plata-700/50 bg-plata-950/40">
        <h3 className="text-sm font-semibold text-plata-200">Historial de evaluaciones</h3>
      </div>
      <div className="divide-y divide-plata-800/50">
        {evaluations.map(e => {
          const scores = scoresMap[e.id] ?? [];
          const metrics = calcRadarMetrics(scores);
          const isSelected = e.id === selectedId;
          return (
            <div key={e.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-plata-800/30 transition-colors cursor-pointer ${isSelected ? 'bg-dorado-900/20 border-l-2 border-dorado-400' : ''}`}
              onClick={() => onSelect(e.id)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{e.title}</p>
                <div className="flex gap-3 text-[10px] text-plata-500 mt-0.5">
                  <span>{e.evaluation_date}</span>
                  {scores.length > 0 && (
                    <>
                      <span>Prom: <span className="text-dorado-400 font-bold">{metrics.overallAvg}</span></span>
                      <span>✓ {metrics.strongestArea}</span>
                      <span>✗ {metrics.weakestArea}</span>
                    </>
                  )}
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
  currentScores: RadarScore[];
  prevScores: RadarScore[];
  currentMetrics: { overallAvg: number };
  prevMetrics: { overallAvg: number };
  currentTitle: string;
  prevTitle: string;
}) {
  const diff = Math.round((currentMetrics.overallAvg - prevMetrics.overallAvg) * 10) / 10;
  const improved: string[] = [];
  const declined: string[] = [];

  currentScores.forEach(cs => {
    const ps = prevScores.find(p => p.area_name === cs.area_name);
    if (!ps) return;
    if (cs.current_score > ps.current_score) improved.push(cs.area_name);
    if (cs.current_score < ps.current_score) declined.push(cs.area_name);
  });

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-3">
          <p className="text-[10px] text-plata-500 uppercase tracking-wider mb-1">{prevTitle}</p>
          <p className="text-xl font-bold text-plata-300">{prevMetrics.overallAvg}</p>
        </div>
        <div className={`rounded-xl border p-3 ${diff > 0 ? 'border-emerald-500/30 bg-emerald-900/20' : diff < 0 ? 'border-red-500/20 bg-red-900/10' : 'border-plata-700/50 bg-plata-900/60'}`}>
          <p className="text-[10px] text-plata-500 uppercase tracking-wider mb-1">Variación</p>
          <p className={`text-xl font-bold flex items-center justify-center gap-1 ${diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-red-300' : 'text-plata-400'}`}>
            {diff > 0 ? <TrendingUp size={16} /> : diff < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
            {diff > 0 ? `+${diff}` : diff}
          </p>
        </div>
        <div className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-3">
          <p className="text-[10px] text-plata-500 uppercase tracking-wider mb-1">{currentTitle}</p>
          <p className="text-xl font-bold text-white">{currentMetrics.overallAvg}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {improved.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-3">
            <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1.5"><TrendingUp size={13} /> Subieron</p>
            <div className="flex flex-wrap gap-1.5">
              {improved.map(a => <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">{a}</span>)}
            </div>
          </div>
        )}
        {declined.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-3">
            <p className="text-xs font-semibold text-red-300 mb-2 flex items-center gap-1.5"><TrendingDown size={13} /> Bajaron</p>
            <div className="flex flex-wrap gap-1.5">
              {declined.map(a => <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20">{a}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl border border-dorado-500/20 bg-dorado-900/20 flex items-center justify-center">
        <Target size={32} className="text-dorado-400/50" />
      </div>
      <p className="text-plata-300 font-semibold text-base">Todavía no hiciste ningún diagnóstico.</p>
      <p className="text-plata-500 text-sm max-w-sm">
        Medí tus áreas clave y detectá dónde tenés que actuar primero.
      </p>
      <button onClick={onNew} className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm">
        <Plus size={16} /> Crear primera evaluación
      </button>
    </div>
  );
}

// ─── EVAL MODAL ───────────────────────────────────────────────────────────────

function EvalModal({ title, initialTitle, initialDate, initialNote, initialScores, onSave, onClose }: {
  title: string;
  initialTitle: string;
  initialDate: string;
  initialNote: string;
  initialScores: ScoreMap;
  onSave: (title: string, date: string, note: string, scores: ScoreMap) => Promise<void>;
  onClose: () => void;
}) {
  const [evalTitle, setEvalTitle] = useState(initialTitle);
  const [evalDate, setEvalDate] = useState(initialDate);
  const [evalNote, setEvalNote] = useState(initialNote);
  const [scores, setScores] = useState<ScoreMap>(() => ({ ...initialScores }));
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'meta' | 'areas'>('meta');

  const overallAvg = useMemo(() => {
    const vals = RADAR_AREAS.map(a => scores[a]?.current ?? 5);
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
  }, [scores]);

  const setScore = (area: string, field: 'current' | 'target' | 'note' | 'action', value: string | number) => {
    setScores(prev => ({ ...prev, [area]: { ...prev[area], [field]: value } }));
  };

  async function handleSubmit(e: React.FormEvent) {
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-plata-700/50">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Target size={16} className="text-dorado-400" /> {title}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-plata-500">Promedio: <span className="text-dorado-300 font-bold">{overallAvg}</span></span>
            <button type="button" onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded-lg"><X size={18} /></button>
          </div>
        </div>

        {/* Steps */}
        <div className="flex border-b border-plata-700/50">
          <button type="button" onClick={() => setStep('meta')}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${step === 'meta' ? 'text-dorado-300 border-b-2 border-dorado-400' : 'text-plata-400 hover:text-white'}`}>
            1. General
          </button>
          <button type="button" onClick={() => setStep('areas')}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${step === 'areas' ? 'text-dorado-300 border-b-2 border-dorado-400' : 'text-plata-400 hover:text-white'}`}>
            2. Áreas ({RADAR_AREAS.length})
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5">
            {step === 'meta' ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-plata-400 mb-1 block">Título *</label>
                  <input autoFocus value={evalTitle} onChange={e => setEvalTitle(e.target.value)}
                    placeholder="Ej: Radar junio 2026" className="pm-input" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-plata-400 mb-1 block">Fecha</label>
                    <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)} className="pm-input" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-plata-400 mb-1 block">Nota general (opcional)</label>
                  <textarea value={evalNote} onChange={e => setEvalNote(e.target.value)}
                    placeholder="Contexto general de esta evaluación..." rows={2} className="pm-input resize-none" />
                </div>
                <button type="button" onClick={() => setStep('areas')}
                  className="self-end px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors">
                  Siguiente →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-plata-500 mb-1">Puntuá cada área del 1 al 10. El slider mueve el puntaje actual.</p>
                {RADAR_AREAS.map(area => {
                  const s = scores[area] ?? { current: 5, target: 8, note: '', action: '' };
                  const status = getAreaStatus(s.current);
                  return (
                    <div key={area} className={`rounded-xl border p-3.5 ${status.bg} border-current/10`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-white">{area}</p>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold ${status.color}`}>{status.label}</span>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-plata-400">Obj:</label>
                            <input
                              type="number" min={1} max={10}
                              value={s.target}
                              onChange={e => setScore(area, 'target', Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                              className="w-12 text-center text-xs bg-plata-800/60 border border-plata-700/50 rounded px-1 py-0.5 text-dorado-300 font-bold"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-black text-white w-8 text-center">{s.current}</span>
                        <input
                          type="range" min={1} max={10} value={s.current}
                          onChange={e => setScore(area, 'current', parseInt(e.target.value))}
                          className="flex-1 accent-bordo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={s.note} onChange={e => setScore(area, 'note', e.target.value)}
                          placeholder="Motivo del puntaje..." className="pm-input text-xs py-1.5" />
                        <input value={s.action} onChange={e => setScore(area, 'action', e.target.value)}
                          placeholder="Acción principal..." className="pm-input text-xs py-1.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 justify-end px-5 py-4 border-t border-plata-700/50">
            {step === 'areas' && (
              <button type="button" onClick={() => setStep('meta')}
                className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">
                ← Atrás
              </button>
            )}
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">
              Cancelar
            </button>
            {step === 'areas' && (
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar evaluación
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
