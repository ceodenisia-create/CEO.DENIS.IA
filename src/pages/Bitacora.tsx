import { useEffect, useMemo, useState } from 'react';
import {
  BookText, Plus, Pencil, Trash2, Loader2, X, Save, Search,
  Lightbulb, GitBranch, Map, GraduationCap, MoonStar, NotebookPen, Brain,
} from 'lucide-react';
import {
  type JournalEntry, type JournalType,
  JOURNAL_TYPE_CONFIG,
  getJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry,
  getCierreForDate, upsertCierre,
} from '../lib/planMaestro';

const TODAY = new Date().toISOString().split('T')[0];

type Tab = JournalType | 'todo';

const TABS: { key: Tab; label: string; icon: typeof BookText }[] = [
  { key: 'diario',        label: 'Diario',        icon: NotebookPen },
  { key: 'idea',          label: 'Ideas',         icon: Lightbulb },
  { key: 'decision',      label: 'Decisiones',    icon: GitBranch },
  { key: 'plan',          label: 'Planes',        icon: Map },
  { key: 'leccion',       label: 'Lecciones',     icon: GraduationCap },
  { key: 'mentalidad',    label: 'Mentalidad',    icon: Brain },
  { key: 'cierre_diario', label: 'Cierre diario', icon: MoonStar },
  { key: 'todo',          label: 'Todo',          icon: BookText },
];

const AREAS = ['Personal', 'MODELTEX', 'MOLDEY', 'Salud', 'Dinero', 'Tecnología', 'Familia', 'Negocios', 'Otra'];
const BUSINESSES = ['', 'MODELTEX', 'MOLDEY'];

// Opciones de estado por tipo
const STATUS_OPTIONS: Partial<Record<JournalType, string[]>> = {
  idea:       ['cruda', 'evaluar', 'aprobada', 'descartada', 'convertida'],
  decision:   ['tomada', 'en_revision', 'confirmada', 'fallida', 'ajustada'],
  plan:       ['borrador', 'activo', 'en_pausa', 'completado', 'cancelado'],
  mentalidad: ['nueva', 'fijando', 'integrada'],
};
const STATUS_LABEL: Record<string, string> = {
  cruda: 'Cruda', evaluar: 'Evaluar', aprobada: 'Aprobada', descartada: 'Descartada', convertida: 'Convertida en proyecto',
  tomada: 'Tomada', en_revision: 'En revisión', confirmada: 'Confirmada', fallida: 'Fallida', ajustada: 'Ajustada',
  borrador: 'Borrador', activo: 'Activo', en_pausa: 'En pausa', completado: 'Completado', cancelado: 'Cancelado',
  nueva: 'Nueva', fijando: 'Fijando', integrada: 'Integrada',
};
const MINDSET_CATEGORIES = ['frase', 'creencia', 'reinterpretacion', 'afirmacion', 'principio'];
const MINDSET_CATEGORY_LABEL: Record<string, string> = {
  frase: 'Frase o cita', creencia: 'Creencia a instalar', reinterpretacion: 'Reinterpretar del pasado',
  afirmacion: 'Afirmación / mantra', principio: 'Principio de vida',
};
const HORIZONS = ['hoy', 'semana', 'mes', 'trimestre', 'ano', 'largo'];
const HORIZON_LABEL: Record<string, string> = { hoy: 'Hoy', semana: 'Semana', mes: 'Mes', trimestre: 'Trimestre', ano: 'Año', largo: 'Largo plazo' };
const IMPACTS = ['bajo', 'medio', 'alto', 'critico'];
const IMPACT_LABEL: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' };

export default function Bitacora({ openCierreSignal }: { openCierreSignal?: number }) {
  const [tab, setTab] = useState<Tab>('todo');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<JournalType | null>(null);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => { load(); }, []);

  // Señal externa (botón "Cerrar día" en Hoy) → abrir cierre del día
  useEffect(() => {
    if (openCierreSignal && openCierreSignal > 0) openCierreDelDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCierreSignal]);

  async function load() {
    setLoading(true);
    try { setEntries(await getJournalEntries()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function openCierreDelDia() {
    setTab('cierre_diario');
    try {
      const existing = await getCierreForDate(TODAY);
      if (existing) setEditEntry(existing);
      else setShowForm('cierre_diario');
    } catch (e) { console.error(e); setShowForm('cierre_diario'); }
  }

  async function handleSave(data: Partial<JournalEntry>, type: JournalType) {
    // Cierre diario: upsert por fecha
    if (type === 'cierre_diario' && !editEntry) {
      const saved = await upsertCierre(data.entry_date || TODAY, {
        title: data.title || `Cierre ${data.entry_date || TODAY}`,
        content: data.content ?? null, status: null, area: data.area ?? null,
        priority: null, related_business: data.related_business ?? null,
        mood: null, energy_level: data.energy_level ?? null, focus_level: data.focus_level ?? null,
        tags: null, metadata: data.metadata ?? {},
      });
      setEntries(prev => {
        const without = prev.filter(e => e.id !== saved.id);
        return [saved, ...without];
      });
      setShowForm(null);
      return;
    }
    if (editEntry) {
      await updateJournalEntry(editEntry.id, data);
      setEntries(prev => prev.map(e => e.id === editEntry.id ? { ...e, ...data } as JournalEntry : e));
      setEditEntry(null);
    } else {
      const created = await createJournalEntry({
        type,
        title: data.title || 'Sin título',
        content: data.content ?? null,
        entry_date: data.entry_date || TODAY,
        status: data.status ?? null,
        area: data.area ?? null,
        priority: data.priority ?? null,
        related_business: data.related_business ?? null,
        mood: data.mood ?? null,
        energy_level: data.energy_level ?? null,
        focus_level: data.focus_level ?? null,
        tags: data.tags ?? null,
        metadata: data.metadata ?? {},
      });
      setEntries(prev => [created, ...prev]);
      setShowForm(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta entrada? Esta acción no se puede deshacer.')) return;
    await deleteJournalEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  // Filtrado por tab + filtros
  const visible = useMemo(() => {
    let list = tab === 'todo' ? entries : entries.filter(e => e.type === tab);
    if (filterStatus !== 'all') list = list.filter(e => e.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || (e.content ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [entries, tab, filterStatus, search]);

  // Resumen
  const summary = useMemo(() => {
    const thisMonth = TODAY.slice(0, 7);
    return {
      total: entries.length,
      activeIdeas: entries.filter(e => e.type === 'idea' && !['descartada', 'convertida'].includes(e.status ?? '')).length,
      decisionsReview: entries.filter(e => e.type === 'decision' && e.status === 'en_revision').length,
      activePlans: entries.filter(e => e.type === 'plan' && e.status === 'activo').length,
      mindsetActive: entries.filter(e => e.type === 'mentalidad' && e.status !== 'integrada').length,
      closingsMonth: entries.filter(e => e.type === 'cierre_diario' && e.entry_date.startsWith(thisMonth)).length,
      last: entries[0] ?? null,
    };
  }, [entries]);

  const cierreHoy = entries.find(e => e.type === 'cierre_diario' && e.entry_date === TODAY);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-dorado-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,146,42,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(139,26,46,0.10),transparent_40%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><BookText size={22} className="text-dorado-400" /> Bitácora</h1>
            <p className="text-sm text-plata-400 mt-0.5">Registro personal de ideas, decisiones, planes, lecciones, mentalidad y cierre diario.</p>
          </div>
          <button
            onClick={() => setShowForm(tab === 'todo' ? 'diario' : (tab as JournalType))}
            className="flex items-center gap-2 px-4 py-2 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm"
          >
            <Plus size={16} /> Nueva entrada
          </button>
        </div>
      </div>

      {/* Resumen */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="Entradas" value={summary.total} />
          <Metric label="Ideas activas" value={summary.activeIdeas} />
          <Metric label="Planes activos" value={summary.activePlans} />
          <Metric label="Mentalidad en proceso" value={summary.mindsetActive} />
          <Metric label="Cierres del mes" value={summary.closingsMonth} />
          <Metric label="Última entrada" value={summary.last ? summary.last.entry_date : '—'} small />
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-plata-700/50">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setFilterStatus('all'); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-t-lg -mb-px border-b-2 transition-colors ${
                tab === t.key ? 'text-dorado-300 border-dorado-400' : 'text-plata-400 border-transparent hover:text-white'
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Cierre diario: aviso de estado */}
      {tab === 'cierre_diario' && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${cierreHoy ? 'border-emerald-500/30 bg-emerald-900/15 text-emerald-200' : 'border-dorado-500/30 bg-dorado-900/15 text-dorado-200'}`}>
          <span>{cierreHoy ? `✓ El día de hoy (${TODAY}) ya fue cerrado.` : `El día de hoy (${TODAY}) todavía no fue cerrado.`}</span>
          <button onClick={() => cierreHoy ? setEditEntry(cierreHoy) : setShowForm('cierre_diario')}
            className="px-3 py-1.5 rounded-lg bg-dorado-600 hover:bg-dorado-500 text-plata-900 text-xs font-semibold shrink-0">
            {cierreHoy ? 'Editar cierre de hoy' : 'Cerrar día'}
          </button>
        </div>
      )}

      {/* Filtros */}
      {(tab === 'todo' || STATUS_OPTIONS[tab as JournalType]) && entries.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-2.5 text-plata-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pm-input text-xs pl-8" />
          </div>
          {STATUS_OPTIONS[tab as JournalType] && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterStatus('all')} className={`px-2.5 py-1 rounded-full text-xs border ${filterStatus === 'all' ? 'bg-plata-700/60 text-white border-plata-500/50' : 'text-plata-400 border-plata-700/50'}`}>Todos</button>
              {STATUS_OPTIONS[tab as JournalType]!.map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`px-2.5 py-1 rounded-full text-xs border ${filterStatus === s ? 'bg-dorado-500/25 text-dorado-200 border-dorado-500/50' : 'text-plata-400 border-plata-700/50'}`}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-dorado-400" /></div>
      ) : entries.length === 0 ? (
        <EmptyState onNew={() => setShowForm('diario')} />
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-plata-500 text-sm">Sin entradas con estos filtros.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(e => (
            <EntryCard key={e.id} entry={e} showType={tab === 'todo'} onEdit={() => setEditEntry(e)} onDelete={() => handleDelete(e.id)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {(showForm || editEntry) && (
        <EntryModal
          type={editEntry ? editEntry.type : showForm!}
          entry={editEntry}
          onSave={handleSave}
          onClose={() => { setShowForm(null); setEditEntry(null); }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-3 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-plata-400">{label}</span>
      <p className={`font-bold text-white ${small ? 'text-sm' : 'text-xl'}`}>{value}</p>
    </div>
  );
}

function EntryCard({ entry, showType, onEdit, onDelete }: { entry: JournalEntry; showType: boolean; onEdit: () => void; onDelete: () => void }) {
  const cfg = JOURNAL_TYPE_CONFIG[entry.type];
  return (
    <div className="group rounded-xl border border-plata-700/60 bg-plata-900/80 p-4 hover:border-dorado-500/30 transition-all"
      style={{ borderLeft: `3px solid ${cfg.color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {showType && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ color: cfg.color, backgroundColor: `${cfg.color}22`, border: `1px solid ${cfg.color}55` }}>{cfg.label}</span>}
            <span className="text-[10px] text-plata-500">{entry.entry_date}</span>
            {entry.area && <span className="text-[10px] text-plata-400">· {entry.area}</span>}
            {entry.status && <span className="text-[10px] text-dorado-300">· {STATUS_LABEL[entry.status] ?? entry.status}</span>}
            {entry.priority && <span className="text-[10px] text-plata-400">· {entry.priority}</span>}
            {entry.related_business && <span className="text-[10px] font-semibold text-bordo-300">· {entry.related_business}</span>}
          </div>
          <p className="text-sm font-semibold text-white">{entry.title}</p>
          {entry.content && <p className="text-xs text-plata-400 mt-1 line-clamp-2 leading-relaxed">{entry.content}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="p-1.5 text-plata-500 hover:text-dorado-300 rounded transition-colors"><Pencil size={13} /></button>
          <button onClick={onDelete} className="p-1.5 text-plata-500 hover:text-red-400 rounded transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl border border-dorado-500/20 bg-dorado-900/20 flex items-center justify-center">
        <BookText size={32} className="text-dorado-400/50" />
      </div>
      <p className="text-plata-300 font-semibold text-base">Todavía no hay registros en Bitácora.</p>
      <p className="text-plata-500 text-sm max-w-md">Registrá ideas, decisiones, planes, lecciones y cierres diarios para que CEO DENIS tenga memoria operativa.</p>
      <button onClick={onNew} className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm">
        <Plus size={16} /> Crear primera entrada
      </button>
    </div>
  );
}

// ─── ENTRY MODAL ───────────────────────────────────────────────────────────────

function EntryModal({ type, entry, onSave, onClose }: {
  type: JournalType;
  entry: JournalEntry | null;
  onSave: (data: Partial<JournalEntry>, type: JournalType) => Promise<void>;
  onClose: () => void;
}) {
  const md = (entry?.metadata ?? {}) as Record<string, string>;
  const [title, setTitle] = useState(entry?.title ?? '');
  const [date, setDate] = useState(entry?.entry_date ?? TODAY);
  const [content, setContent] = useState(entry?.content ?? '');
  const [area, setArea] = useState(entry?.area ?? '');
  const [priority, setPriority] = useState(entry?.priority ?? 'media');
  const [status, setStatus] = useState(entry?.status ?? (STATUS_OPTIONS[type]?.[0] ?? ''));
  const [business, setBusiness] = useState(entry?.related_business ?? '');
  const [meta, setMeta] = useState<Record<string, string>>(md);
  const [num, setNum] = useState<Record<string, number>>({
    energy_level: entry?.energy_level ?? 5,
    focus_level: entry?.focus_level ?? 5,
    score: typeof md.score === 'number' ? md.score : 5,
    disciplina: typeof md.disciplina === 'number' ? md.disciplina : 5,
  });
  const [saving, setSaving] = useState(false);

  const cfg = JOURNAL_TYPE_CONFIG[type];
  const setM = (k: string, v: string) => setMeta(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const base: Partial<JournalEntry> = {
        title: title.trim(), entry_date: date, content: content.trim() || null,
        area: area || null, related_business: business || null,
        metadata: meta,
      };
      if (STATUS_OPTIONS[type]) base.status = status;
      if (type === 'idea') base.priority = priority;
      if (type === 'diario') { base.mood = meta.mood || null; base.energy_level = num.energy_level; base.focus_level = num.focus_level; }
      if (type === 'cierre_diario') {
        base.energy_level = num.energy_level; base.focus_level = num.focus_level;
        base.metadata = { ...meta, score: num.score, disciplina: num.disciplina };
      }
      await onSave(base, type);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-plata-700/50">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.color }} />
            {entry ? 'Editar' : 'Nueva'} · {cfg.label}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <Field label="Título *">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} className="pm-input" required />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha *"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="pm-input" required /></Field>
            <Field label="Área">
              <select value={area} onChange={e => setArea(e.target.value)} className="pm-input">
                <option value="">Ninguna</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          {/* Estado (idea/decision/plan) */}
          {STATUS_OPTIONS[type] && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado">
                <select value={status} onChange={e => setStatus(e.target.value)} className="pm-input">
                  {STATUS_OPTIONS[type]!.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
              {type === 'idea' && (
                <Field label="Prioridad">
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="pm-input">
                    <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                  </select>
                </Field>
              )}
              {type === 'plan' && (
                <Field label="Horizonte">
                  <select value={meta.horizon ?? 'semana'} onChange={e => setM('horizon', e.target.value)} className="pm-input">
                    {HORIZONS.map(h => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
                  </select>
                </Field>
              )}
              {type === 'mentalidad' && (
                <Field label="Categoría">
                  <select value={meta.categoria ?? 'frase'} onChange={e => setM('categoria', e.target.value)} className="pm-input">
                    {MINDSET_CATEGORIES.map(c => <option key={c} value={c}>{MINDSET_CATEGORY_LABEL[c]}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}

          {/* DIARIO */}
          {type === 'diario' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Estado del día">
                  <select value={meta.mood ?? 'Bueno'} onChange={e => setM('mood', e.target.value)} className="pm-input">
                    {['Excelente', 'Bueno', 'Regular', 'Malo', 'Crítico'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <NumField label="Energía" value={num.energy_level} onChange={v => setNum(n => ({ ...n, energy_level: v }))} />
                <NumField label="Enfoque" value={num.focus_level} onChange={v => setNum(n => ({ ...n, focus_level: v }))} />
              </div>
              <Field label="Qué pasó hoy"><textarea value={meta.que_paso ?? ''} onChange={e => setM('que_paso', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <Field label="Qué hice hoy"><textarea value={meta.que_hice ?? ''} onChange={e => setM('que_hice', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <Field label="Qué sentí o pensé"><textarea value={content} onChange={e => setContent(e.target.value)} rows={2} className="pm-input resize-none" /></Field>
            </>
          )}

          {/* IDEA */}
          {type === 'idea' && (
            <>
              <Field label="Descripción"><textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="pm-input resize-none" /></Field>
              <Field label="Próxima acción"><input value={meta.next_action ?? ''} onChange={e => setM('next_action', e.target.value)} className="pm-input" /></Field>
            </>
          )}

          {/* DECISION */}
          {type === 'decision' && (
            <>
              <Field label="Decisión tomada"><textarea value={content} onChange={e => setContent(e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <Field label="Motivo"><textarea value={meta.motivo ?? ''} onChange={e => setM('motivo', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Opciones consideradas"><input value={meta.opciones ?? ''} onChange={e => setM('opciones', e.target.value)} className="pm-input" /></Field>
                <Field label="Riesgo"><input value={meta.riesgo ?? ''} onChange={e => setM('riesgo', e.target.value)} className="pm-input" /></Field>
              </div>
              <Field label="Resultado esperado"><input value={meta.resultado_esperado ?? ''} onChange={e => setM('resultado_esperado', e.target.value)} className="pm-input" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de revisión"><input type="date" value={meta.review_date ?? ''} onChange={e => setM('review_date', e.target.value)} className="pm-input" /></Field>
                <Field label="Resultado real"><input value={meta.resultado_real ?? ''} onChange={e => setM('resultado_real', e.target.value)} className="pm-input" /></Field>
              </div>
            </>
          )}

          {/* PLAN */}
          {type === 'plan' && (
            <>
              <Field label="Objetivo del plan"><textarea value={content} onChange={e => setContent(e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <Field label="Pasos principales"><textarea value={meta.pasos ?? ''} onChange={e => setM('pasos', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Recursos necesarios"><input value={meta.recursos ?? ''} onChange={e => setM('recursos', e.target.value)} className="pm-input" /></Field>
                <Field label="Riesgos"><input value={meta.riesgos ?? ''} onChange={e => setM('riesgos', e.target.value)} className="pm-input" /></Field>
              </div>
              <Field label="Próxima acción"><input value={meta.next_action ?? ''} onChange={e => setM('next_action', e.target.value)} className="pm-input" /></Field>
            </>
          )}

          {/* LECCION */}
          {type === 'leccion' && (
            <>
              <Field label="Qué aprendí"><textarea value={content} onChange={e => setContent(e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <Field label="Qué error detecté"><textarea value={meta.error ?? ''} onChange={e => setM('error', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Qué patrón se repite"><input value={meta.patron ?? ''} onChange={e => setM('patron', e.target.value)} className="pm-input" /></Field>
                <Field label="Impacto">
                  <select value={meta.impacto ?? 'medio'} onChange={e => setM('impacto', e.target.value)} className="pm-input">
                    {IMPACTS.map(i => <option key={i} value={i}>{IMPACT_LABEL[i]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Qué voy a corregir"><textarea value={meta.corregir ?? ''} onChange={e => setM('corregir', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
            </>
          )}

          {/* MENTALIDAD */}
          {type === 'mentalidad' && (
            <>
              <Field label="Frase o idea">
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="pm-input resize-none"
                  placeholder="La frase, cita o creencia tal como la querés fijar." />
              </Field>
              <Field label="Fuente (libro / autor)">
                <input value={meta.fuente ?? ''} onChange={e => setM('fuente', e.target.value)} className="pm-input"
                  placeholder="Ej: Los secretos de la mente millonaria — T. Harv Eker" />
              </Field>
              <Field label="¿Por qué me importa / qué reemplaza?">
                <textarea value={meta.por_que ?? ''} onChange={e => setM('por_que', e.target.value)} rows={2} className="pm-input resize-none"
                  placeholder="Qué creencia vieja reemplaza, o qué del pasado reinterpreto con esto." />
              </Field>
              <Field label="Cómo la aplico / recordatorio">
                <input value={meta.aplicacion ?? ''} onChange={e => setM('aplicacion', e.target.value)} className="pm-input"
                  placeholder="Un gesto concreto para que se vuelva parte de mí." />
              </Field>
            </>
          )}

          {/* CIERRE DIARIO */}
          {type === 'cierre_diario' && (
            <>
              <div className="grid grid-cols-4 gap-2">
                <NumField label="Día" value={num.score} onChange={v => setNum(n => ({ ...n, score: v }))} />
                <NumField label="Energía" value={num.energy_level} onChange={v => setNum(n => ({ ...n, energy_level: v }))} />
                <NumField label="Disciplina" value={num.disciplina} onChange={v => setNum(n => ({ ...n, disciplina: v }))} />
                <NumField label="Enfoque" value={num.focus_level} onChange={v => setNum(n => ({ ...n, focus_level: v }))} />
              </div>
              <Field label="¿Qué completé hoy?"><textarea value={meta.completado ?? ''} onChange={e => setM('completado', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <Field label="¿Qué quedó pendiente?"><textarea value={meta.pendiente ?? ''} onChange={e => setM('pendiente', e.target.value)} rows={2} className="pm-input resize-none" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Avance más importante"><input value={meta.avance ?? ''} onChange={e => setM('avance', e.target.value)} className="pm-input" /></Field>
                <Field label="¿Qué me distrajo?"><input value={meta.distraccion ?? ''} onChange={e => setM('distraccion', e.target.value)} className="pm-input" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="¿Qué salió mal?"><input value={meta.salio_mal ?? ''} onChange={e => setM('salio_mal', e.target.value)} className="pm-input" /></Field>
                <Field label="¿Qué corregir mañana?"><input value={meta.corregir_manana ?? ''} onChange={e => setM('corregir_manana', e.target.value)} className="pm-input" /></Field>
              </div>
              <Field label="Primera acción de mañana"><input value={meta.primera_accion ?? ''} onChange={e => setM('primera_accion', e.target.value)} className="pm-input" /></Field>
              <Field label="Nota libre"><textarea value={content} onChange={e => setContent(e.target.value)} rows={2} className="pm-input resize-none" /></Field>
            </>
          )}

          {/* Negocio relacionado (común) */}
          <Field label="Negocio relacionado">
            <select value={business} onChange={e => setBusiness(e.target.value)} className="pm-input">
              {BUSINESSES.map(b => <option key={b} value={b}>{b || 'Ninguno'}</option>)}
              {type === 'cierre_diario' && <option value="ambos">Ambos</option>}
            </select>
          </Field>
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-plata-700/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-plata-400 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] text-plata-400 mb-1 block">{label} ({value})</label>
      <input type="range" min={1} max={10} value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-full accent-dorado-500" />
    </div>
  );
}
