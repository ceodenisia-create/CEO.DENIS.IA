import { useEffect, useMemo, useState } from 'react';
import {
  Languages, Check, Star, Rocket, Loader2, KeyRound, GraduationCap as VerbIcon,
  Sparkles, Box, BookMarked,
} from 'lucide-react';
import {
  type EngCategory, type EngWord, type EngUserWord,
  getEngCatalog, getEngUserWords, getEngFavorites, toggleEngWordState,
  sendAiChat,
} from '../lib/planMaestro';
import { parseAiReply, executeAiActions } from '../lib/aiActions';

type Tab = EngCategory | 'favoritos';

const TABS: { key: Tab; label: string; icon: typeof Languages }[] = [
  { key: 'keyword',   label: 'Palabras Clave', icon: KeyRound },
  { key: 'verb',      label: 'Verbos',         icon: VerbIcon },
  { key: 'adjective', label: 'Adjetivos',      icon: Sparkles },
  { key: 'noun',      label: 'Sustantivos',    icon: Box },
  { key: 'favoritos', label: 'Mis Diccionarios', icon: BookMarked },
];

const TIERS = [10, 50, 100, 200, 300, 500, 1000];

export default function EnglishHub() {
  const [tab, setTab] = useState<Tab>('keyword');
  const [tier, setTier] = useState<number>(50);
  const [catalog, setCatalog] = useState<EngWord[]>([]);
  const [userWords, setUserWords] = useState<EngUserWord[]>([]);
  const [favorites, setFavorites] = useState<EngUserWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [missionQty, setMissionQty] = useState(10);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionResult, setMissionResult] = useState<string | null>(null);

  useEffect(() => {
    loadUserWords();
  }, []);

  useEffect(() => {
    if (tab === 'favoritos') {
      loadFavorites();
    } else {
      loadCatalog(tab, tier);
    }
  }, [tab, tier]);

  async function loadUserWords() {
    try {
      const rows = await getEngUserWords();
      setUserWords(rows);
    } catch { /* silencioso, no bloquea la vista */ }
  }

  async function loadCatalog(category: EngCategory, maxRank: number) {
    setLoading(true);
    try {
      const rows = await getEngCatalog(category, maxRank);
      setCatalog(rows);
    } finally {
      setLoading(false);
    }
  }

  async function loadFavorites() {
    setLoading(true);
    try {
      const rows = await getEngFavorites();
      setFavorites(rows);
    } finally {
      setLoading(false);
    }
  }

  const userWordByCatalogId = useMemo(() => {
    const map = new Map<string, EngUserWord>();
    for (const uw of userWords) {
      if (uw.catalog_word_id) map.set(uw.catalog_word_id, uw);
    }
    return map;
  }, [userWords]);

  async function handleToggle(word: EngWord, field: 'learned' | 'favorite') {
    setBusyId(word.id);
    const current = userWordByCatalogId.get(word.id);
    const nextValue = !(current?.[field] ?? false);
    try {
      await toggleEngWordState(word, { [field]: nextValue });
      await loadUserWords();
    } finally {
      setBusyId(null);
    }
  }

  async function generarMisionDeEstudio() {
    const words = favorites.slice(0, missionQty);
    if (words.length === 0) return;
    setMissionLoading(true);
    setMissionResult(null);
    try {
      const list = words.map(w => `${w.word} = ${w.translation}`).join(', ');
      const prompt = `Creá una tarea de estudio de inglés con estas ${words.length} palabras favoritas: ${list}. ` +
        `Para cada palabra escribí un ejemplo práctico de uso en una oración en inglés con su traducción al español. ` +
        `Respondé ÚNICAMENTE con la acción create_task: title corto tipo "Estudiar: ${words.length} palabras nuevas", ` +
        `notes con la lista completa de ejemplos, area "personal", status "inbox".`;
      const reply = await sendAiChat([{ role: 'user', content: prompt }]);
      const parsed = parseAiReply(reply);
      if (!parsed) {
        setMissionResult('La IA no devolvió una tarea válida. Probá de nuevo.');
        return;
      }
      const results = await executeAiActions(parsed.actions);
      setMissionResult(results.join(' ') || 'Misión creada. Revisá el Kanban.');
    } catch (e) {
      setMissionResult(e instanceof Error ? e.message : 'No se pudo generar la misión.');
    } finally {
      setMissionLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-dorado-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,146,42,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(139,26,46,0.10),transparent_40%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Languages size={22} className="text-dorado-400" /> My English
          </h1>
          <p className="text-sm text-plata-400 mt-0.5">
            Vocabulario de inglés por frecuencia de uso. Marcá aprendidas, guardá favoritas y generá misiones de estudio en el Kanban.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-plata-700/50">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-t-lg -mb-px border-b-2 transition-colors ${
                tab === t.key ? 'text-dorado-300 border-dorado-400' : 'text-plata-400 border-transparent hover:text-white'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab !== 'favoritos' ? (
        <>
          {/* Sub-filtros de frecuencia */}
          <div className="flex flex-wrap gap-1.5">
            {TIERS.map(n => (
              <button
                key={n}
                onClick={() => setTier(n)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  tier === n ? 'bg-dorado-500/25 text-dorado-200 border-dorado-500/50' : 'text-plata-400 border-plata-700/50 hover:text-white'
                }`}
              >
                Las {n}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-plata-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {catalog.map(word => {
                const uw = userWordByCatalogId.get(word.id);
                const learned = uw?.learned ?? false;
                const favorite = uw?.favorite ?? false;
                const busy = busyId === word.id;
                return (
                  <div
                    key={word.id}
                    className={`rounded-xl border p-3 flex flex-col gap-2 transition-colors ${
                      learned ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-plata-700/50 bg-plata-900/60'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-white text-sm">{word.word}</p>
                      <p className="text-xs text-plata-400">{word.translation}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-auto">
                      <button
                        disabled={busy}
                        onClick={() => handleToggle(word, 'learned')}
                        title="Marcar como aprendida"
                        className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-colors disabled:opacity-50 ${
                          learned ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300' : 'border-plata-700/50 text-plata-400 hover:text-white'
                        }`}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => handleToggle(word, 'favorite')}
                        title="Guardar en Mis Diccionarios"
                        className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-colors disabled:opacity-50 ${
                          favorite ? 'bg-dorado-500/25 border-dorado-500/50 text-dorado-300' : 'border-plata-700/50 text-plata-400 hover:text-white'
                        }`}
                      >
                        <Star size={13} fill={favorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-plata-300">Generar misión con</span>
            <select
              value={missionQty}
              onChange={e => setMissionQty(Number(e.target.value))}
              className="pm-input text-sm w-auto"
            >
              {[5, 10, 15, 20].filter(n => n <= Math.max(favorites.length, 5)).map(n => (
                <option key={n} value={n}>{n} palabras</option>
              ))}
              {favorites.length > 0 && (
                <option value={favorites.length}>Todas ({favorites.length})</option>
              )}
            </select>
            <button
              onClick={generarMisionDeEstudio}
              disabled={missionLoading || favorites.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm disabled:opacity-50"
            >
              {missionLoading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Generar Misión de Estudio
            </button>
          </div>

          {missionResult && (
            <div className="rounded-xl border border-dorado-500/30 bg-dorado-900/15 text-dorado-200 text-sm px-4 py-3">
              {missionResult}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-plata-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : favorites.length === 0 ? (
            <p className="text-sm text-plata-400 py-6 text-center">
              Todavía no marcaste palabras favoritas. Andá a cualquier pestaña de vocabulario y tocá la estrella ⭐.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {favorites.map(w => (
                <div key={w.id} className="rounded-xl border border-plata-700/50 bg-plata-900/60 p-3">
                  <p className="font-bold text-white text-sm">{w.word}</p>
                  <p className="text-xs text-plata-400">{w.translation}</p>
                  <p className="text-[10px] uppercase tracking-wider text-dorado-400/70 mt-1">{w.category}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
