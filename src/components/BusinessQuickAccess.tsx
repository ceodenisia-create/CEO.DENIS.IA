import { useEffect, useRef, useState } from 'react';
import {
  Briefcase, ExternalLink, Plus, Clock, Timer, BarChart3,
  X, Save, Loader2, Link2, ChevronRight,
} from 'lucide-react';
import {
  type Business, type BusinessDaySummary,
  ensureBusinesses, updateBusiness, upsertTimeBlock, getTimeBlock,
  getBusinessDaySummary, createTask,
} from '../lib/planMaestro';

const TODAY = new Date().toISOString().split('T')[0];

type ModalKind = 'plan' | 'work' | 'summary' | 'task' | 'url' | null;

export default function BusinessQuickAccess() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [modal, setModal] = useState<{ kind: ModalKind; biz: Business } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);

  // Cerrar popover al hacer click afuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function load() {
    try { setBusinesses(await ensureBusinesses()); }
    catch (e) { console.error(e); }
  }

  function handleEntrar(biz: Business) {
    setOpenMenu(null);
    if (biz.url && biz.url.trim()) {
      window.open(biz.url, '_blank', 'noopener,noreferrer');
    } else {
      // sin URL → abrir modal para configurarla
      setModal({ kind: 'url', biz });
    }
  }

  function openModal(kind: ModalKind, biz: Business) {
    setOpenMenu(null);
    setModal({ kind, biz });
  }

  return (
    <div ref={containerRef} className="border-t border-plata-700/50 pt-3 mt-2">
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-plata-500">Mis negocios</p>
      <div className="space-y-1 px-1">
        {businesses.map(biz => (
          <div key={biz.id} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === biz.id ? null : biz.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-plata-300 hover:bg-plata-800 hover:text-white transition-colors group"
            >
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: biz.color ?? '#868E96' }} />
              <span className="flex-1 text-left tracking-wide">{biz.name}</span>
              <ChevronRight size={14} className={`text-plata-600 transition-transform ${openMenu === biz.id ? 'rotate-90' : ''}`} />
            </button>

            {/* Popover */}
            {openMenu === biz.id && (
              <div className="absolute left-2 right-2 mt-1 z-50 rounded-xl border border-plata-700/70 bg-plata-900 shadow-pm-lg overflow-hidden">
                <MenuItem icon={<ExternalLink size={13} />} label="Entrar" onClick={() => handleEntrar(biz)} />
                <MenuItem icon={<Plus size={13} />} label="Asignar tarea" onClick={() => openModal('task', biz)} />
                <MenuItem icon={<Clock size={13} />} label="Planificar tiempo hoy" onClick={() => openModal('plan', biz)} />
                <MenuItem icon={<Timer size={13} />} label="Registrar tiempo trabajado" onClick={() => openModal('work', biz)} />
                <MenuItem icon={<BarChart3 size={13} />} label="Ver resumen" onClick={() => openModal('summary', biz)} />
                <MenuItem icon={<Link2 size={13} />} label="Configurar enlace" onClick={() => openModal('url', biz)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modales */}
      {modal?.kind === 'plan' && <TimeModal biz={modal.biz} mode="plan" onClose={() => setModal(null)} />}
      {modal?.kind === 'work' && <TimeModal biz={modal.biz} mode="work" onClose={() => setModal(null)} />}
      {modal?.kind === 'summary' && <SummaryModal biz={modal.biz} onClose={() => setModal(null)} />}
      {modal?.kind === 'task' && <TaskModal biz={modal.biz} onClose={() => setModal(null)} />}
      {modal?.kind === 'url' && (
        <UrlModal biz={modal.biz} onClose={() => setModal(null)}
          onSaved={(url) => { setBusinesses(prev => prev.map(b => b.id === modal.biz.id ? { ...b, url } : b)); setModal(null); }} />
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-plata-300 hover:bg-plata-800 hover:text-white transition-colors text-left">
      <span className="text-plata-500">{icon}</span>
      {label}
    </button>
  );
}

// ─── MODAL SHELL ──────────────────────────────────────────────────────────────

function ModalShell({ title, color, children, onClose }: { title: string; color?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {color && <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />}
            {title}
          </h3>
          <button onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── TIME MODAL (plan / work) ─────────────────────────────────────────────────

function TimeModal({ biz, mode, onClose }: { biz: Business; mode: 'plan' | 'work'; onClose: () => void }) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTimeBlock(biz.key, TODAY).then(block => {
      if (block) {
        const mins = mode === 'plan' ? block.planned_minutes : block.worked_minutes;
        setHours(String(Math.floor(mins / 60) || ''));
        setMinutes(String(mins % 60 || ''));
        setNote(block.note ?? '');
      }
    }).finally(() => setLoading(false));
  }, [biz.key, mode]);

  async function handleSave() {
    const totalMin = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    setSaving(true);
    try {
      await upsertTimeBlock(biz.key, biz.name, TODAY,
        mode === 'plan' ? { planned_minutes: totalMin, note: note.trim() || null }
                        : { worked_minutes: totalMin, note: note.trim() || null });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title={mode === 'plan' ? `Planificar tiempo · ${biz.name}` : `Registrar tiempo · ${biz.name}`} color={biz.color ?? undefined} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-dorado-400" /></div>
      ) : (
        <>
          <p className="text-xs text-plata-500">Fecha: {TODAY}</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-plata-400 mb-1 block">Horas</label>
              <input type="number" min={0} value={hours} onChange={e => setHours(e.target.value)} placeholder="0" className="pm-input" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-plata-400 mb-1 block">Minutos</label>
              <input type="number" min={0} max={59} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="0" className="pm-input" />
            </div>
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Nota (opcional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} className="pm-input" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── SUMMARY MODAL ────────────────────────────────────────────────────────────

function fmtMin(m: number): string {
  const h = Math.floor(Math.abs(m) / 60);
  const min = Math.abs(m) % 60;
  const sign = m < 0 ? '-' : '';
  if (h === 0) return `${sign}${min}min`;
  return `${sign}${h}h ${min}min`;
}

function SummaryModal({ biz, onClose }: { biz: Business; onClose: () => void }) {
  const [summary, setSummary] = useState<BusinessDaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBusinessDaySummary(biz.key, TODAY).then(setSummary).finally(() => setLoading(false));
  }, [biz.key]);

  return (
    <ModalShell title={`Resumen · ${biz.name}`} color={biz.color ?? undefined} onClose={onClose}>
      {loading || !summary ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-dorado-400" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-plata-700/50 bg-plata-800/40 p-2">
              <p className="text-[10px] text-plata-500 uppercase">Planificado</p>
              <p className="text-sm font-bold text-white">{fmtMin(summary.plannedMinutes)}</p>
            </div>
            <div className="rounded-lg border border-plata-700/50 bg-plata-800/40 p-2">
              <p className="text-[10px] text-plata-500 uppercase">Trabajado</p>
              <p className="text-sm font-bold text-white">{fmtMin(summary.workedMinutes)}</p>
            </div>
            <div className={`rounded-lg border p-2 ${summary.diffMinutes >= 0 ? 'border-emerald-500/30 bg-emerald-900/20' : 'border-red-500/20 bg-red-900/10'}`}>
              <p className="text-[10px] text-plata-500 uppercase">Diferencia</p>
              <p className={`text-sm font-bold ${summary.diffMinutes >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {summary.diffMinutes >= 0 ? '+' : ''}{fmtMin(summary.diffMinutes)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-plata-300 mb-1.5">Tareas de hoy ({summary.todayTasks.length})</p>
            {summary.todayTasks.length === 0 ? (
              <p className="text-xs text-plata-500">Sin tareas para hoy.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {summary.todayTasks.map(t => (
                  <div key={t.id} className="text-xs text-plata-300 bg-plata-800/40 rounded px-2 py-1 truncate">{t.title}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-plata-300 mb-1.5">Pendientes vinculadas ({summary.pendingTasks.length})</p>
            {summary.pendingTasks.length === 0 ? (
              <p className="text-xs text-plata-500">Sin tareas pendientes.</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {summary.pendingTasks.map(t => (
                  <div key={t.id} className="text-xs text-plata-400 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-plata-600" />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ─── TASK MODAL (asignar tarea al negocio) ────────────────────────────────────

function TaskModal({ biz, onClose }: { biz: Business; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        notes: notes.trim() || null,
        area: biz.key === 'moldey' ? 'moldey' : biz.key === 'modeltex' ? 'modeltex' : 'personal',
        priority: 'media',
        status: 'inbox',
        is_mit: false,
        due_date: null,
        position: 0,
        project_id: null,
        goal_id: null,
        business_key: biz.key,
      });
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title={`Asignar tarea · ${biz.name}`} color={biz.color ?? undefined} onClose={onClose}>
      {done ? (
        <p className="text-sm text-emerald-300 py-4 text-center">✓ Tarea creada y vinculada a {biz.name} (en Inbox)</p>
      ) : (
        <>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Título *</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="¿Qué hay que hacer?" className="pm-input" />
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Notas (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="pm-input resize-none" />
          </div>
          <p className="text-[10px] text-plata-500">Negocio: <span style={{ color: biz.color ?? undefined }} className="font-semibold">{biz.name}</span> · se crea en Inbox</p>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !title.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear tarea
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── URL MODAL (configurar enlace) ────────────────────────────────────────────

function UrlModal({ biz, onClose, onSaved }: { biz: Business; onClose: () => void; onSaved: (url: string) => void }) {
  const [url, setUrl] = useState(biz.url ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const clean = url.trim();
      await updateBusiness(biz.id, { url: clean || null });
      onSaved(clean);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title={`Enlace de ${biz.name}`} color={biz.color ?? undefined} onClose={onClose}>
      {!biz.url && <p className="text-xs text-amber-300/80">Todavía no configuraste el enlace de este negocio.</p>}
      <div>
        <label className="text-xs text-plata-400 mb-1 block">URL del sistema / sitio</label>
        <input autoFocus value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://..." className="pm-input" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
        </button>
      </div>
    </ModalShell>
  );
}
