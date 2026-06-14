import { useEffect, useRef, useState } from 'react';
import {
  Compass, Plus, Pencil, Trash2, Loader2, X, Save,
  ImagePlus, AlertCircle, Filter,
} from 'lucide-react';
import {
  type FutureVision, type VisionArea, type VisionStatus, type Timeframe, type Priority,
  VISION_AREA_CONFIG, VISION_STATUS_CONFIG, TIMEFRAME_CONFIG, PRIORITY_CONFIG,
  visionAreaLabel,
  getFutureVisions, createFutureVision, updateFutureVision, deleteFutureVision, uploadVisionImage,
} from '../lib/planMaestro';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface VisionFormData {
  title: string;
  area: VisionArea;
  area_custom: string;
  timeframe: Timeframe;
  status: VisionStatus;
  priority: Priority;
  target_date: string;
  description: string;
  image_url: string;
}

const EMPTY_FORM: VisionFormData = {
  title: '', area: 'negocios', area_custom: '', timeframe: 'mediano',
  status: 'sonado', priority: 'media',
  target_date: '', description: '', image_url: '',
};

const AREAS = Object.keys(VISION_AREA_CONFIG) as VisionArea[];
const STATUSES = Object.keys(VISION_STATUS_CONFIG) as VisionStatus[];

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MapaDeFuturo() {
  const [visions, setVisions] = useState<FutureVision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editVision, setEditVision] = useState<FutureVision | null>(null);
  const [filterArea, setFilterArea] = useState<VisionArea | 'todas'>('todas');
  const [filterStatus, setFilterStatus] = useState<VisionStatus | 'todos'>('todos');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setVisions(await getFutureVisions()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const filtered = visions.filter(v => {
    if (filterArea !== 'todas' && v.area !== filterArea) return false;
    if (filterStatus !== 'todos' && v.status !== filterStatus) return false;
    return true;
  });

  async function handleCreate(data: VisionFormData) {
    const v = await createFutureVision({
      title: data.title.trim(),
      area: data.area,
      area_custom: data.area === 'otra' ? (data.area_custom.trim() || null) : null,
      timeframe: data.timeframe,
      status: data.status,
      priority: data.priority,
      target_date: data.target_date || null,
      description: data.description.trim() || null,
      image_url: data.image_url || null,
      position: 0,
    });
    setVisions(prev => [v, ...prev]);
    setShowForm(false);
  }

  async function handleEdit(data: VisionFormData) {
    if (!editVision) return;
    const area_custom = data.area === 'otra' ? (data.area_custom.trim() || null) : null;
    await updateFutureVision(editVision.id, {
      title: data.title.trim(),
      area: data.area,
      area_custom,
      timeframe: data.timeframe,
      status: data.status,
      priority: data.priority,
      target_date: data.target_date || null,
      description: data.description.trim() || null,
      image_url: data.image_url || null,
    });
    setVisions(prev => prev.map(v => v.id === editVision.id ? { ...v, ...data, area_custom, target_date: data.target_date || null, description: data.description || null, image_url: data.image_url || null } : v));
    setEditVision(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta visión? Esta acción no se puede deshacer.')) return;
    await deleteFutureVision(id);
    setVisions(prev => prev.filter(v => v.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-dorado-500/30 bg-plata-900/80 p-5 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,146,42,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(139,26,46,0.10),transparent_40%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-dorado-400/80">CEO DENIS</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Compass size={22} className="text-dorado-400" /> Brújula
            </h1>
            <p className="text-sm text-plata-400 mt-0.5">Tu visión personal convertida en objetivos visuales</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 text-xs text-plata-400">
              <span className="bg-plata-800/60 px-2 py-1 rounded-lg">{visions.length} visiones</span>
              <span className="bg-emerald-900/40 text-emerald-300 px-2 py-1 rounded-lg">
                {visions.filter(v => v.status === 'logrado').length} logradas
              </span>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm"
            >
              <Plus size={16} /> Nueva visión
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-plata-500 shrink-0" />

        {/* Area filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterArea('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterArea === 'todas' ? 'bg-dorado-500/30 text-dorado-200 border border-dorado-500/50' : 'text-plata-400 hover:text-white border border-plata-700/50 hover:border-plata-500/50'
            }`}
          >
            Todas las áreas
          </button>
          {AREAS.map(a => {
            const cfg = VISION_AREA_CONFIG[a];
            return (
              <button
                key={a}
                onClick={() => setFilterArea(a)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  filterArea === a ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'text-plata-400 border-plata-700/50 hover:text-white hover:border-plata-500/50'
                }`}
              >
                {cfg.emoji} {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-plata-700/50 mx-1" />

        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filterStatus === 'todos' ? 'bg-plata-700/60 text-white border-plata-500/50' : 'text-plata-400 border-plata-700/50 hover:text-white'
            }`}
          >
            Todos
          </button>
          {STATUSES.map(s => {
            const cfg = VISION_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  filterStatus === s ? `${cfg.bg} ${cfg.color} border-current` : 'text-plata-400 border-plata-700/50 hover:text-white'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 size={32} className="animate-spin text-dorado-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasVisions={visions.length > 0} onNew={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(v => (
            <VisionCard
              key={v.id}
              vision={v}
              onEdit={() => setEditVision(v)}
              onDelete={() => handleDelete(v.id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <VisionModal
          title="Nueva visión"
          initialData={EMPTY_FORM}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit modal */}
      {editVision && (
        <VisionModal
          title="Editar visión"
          initialData={{
            title: editVision.title,
            area: editVision.area,
            area_custom: editVision.area_custom ?? '',
            timeframe: editVision.timeframe,
            status: editVision.status,
            priority: editVision.priority,
            target_date: editVision.target_date ?? '',
            description: editVision.description ?? '',
            image_url: editVision.image_url ?? '',
          }}
          onSave={handleEdit}
          onClose={() => setEditVision(null)}
        />
      )}
    </div>
  );
}

// ─── VISION CARD ──────────────────────────────────────────────────────────────

function VisionCard({ vision, onEdit, onDelete }: { vision: FutureVision; onEdit: () => void; onDelete: () => void }) {
  const area = VISION_AREA_CONFIG[vision.area];
  const status = VISION_STATUS_CONFIG[vision.status];
  const prio = PRIORITY_CONFIG[vision.priority];
  const tf = TIMEFRAME_CONFIG[vision.timeframe];

  return (
    <div className="group relative rounded-2xl border border-plata-700/60 bg-plata-900/80 overflow-hidden hover:border-dorado-500/30 hover:shadow-pm-lg transition-all duration-200">
      {/* Image */}
      <div className="relative h-44 bg-plata-800/60 overflow-hidden">
        {vision.image_url ? (
          <img src={vision.image_url} alt={vision.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-30">{area.emoji}</span>
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-plata-900/80 via-transparent to-transparent" />

        {/* Status badge top-left */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.color} backdrop-blur-sm`}>
          {status.label}
        </div>

        {/* Actions top-right */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg bg-plata-900/80 backdrop-blur-sm text-plata-300 hover:text-dorado-300 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg bg-plata-900/80 backdrop-blur-sm text-plata-300 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2.5">
        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{vision.title}</h3>

        {vision.description && (
          <p className="text-xs text-plata-400 line-clamp-2 leading-relaxed">{vision.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${area.bg} ${area.color} ${area.border}`}>
            {area.emoji} {visionAreaLabel(vision)}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tf.color} bg-plata-800/60`}>
            {tf.label}
          </span>
          <span className={`text-[10px] font-medium flex items-center gap-1 ${prio.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
            {prio.label}
          </span>
        </div>

        {vision.target_date && (
          <p className="text-[10px] text-plata-500 mt-0.5">
            🎯 Objetivo: {vision.target_date}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({ hasVisions, onNew }: { hasVisions: boolean; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl border border-dorado-500/20 bg-dorado-900/20 flex items-center justify-center">
        <Compass size={32} className="text-dorado-400/50" />
      </div>
      {hasVisions ? (
        <>
          <p className="text-plata-300 font-medium">No hay visiones con esos filtros.</p>
          <p className="text-plata-500 text-sm">Probá con otros filtros o creá una nueva visión.</p>
        </>
      ) : (
        <>
          <p className="text-plata-300 font-semibold text-base">Todavía no cargaste ninguna visión.</p>
          <p className="text-plata-500 text-sm max-w-sm">
            Agregá imágenes, objetivos y símbolos de la vida que estás construyendo.
          </p>
          <button
            onClick={onNew}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-xl font-semibold text-sm transition-colors shadow-pm"
          >
            <Plus size={16} /> Crear primera visión
          </button>
        </>
      )}
    </div>
  );
}

// ─── MODAL FORM ───────────────────────────────────────────────────────────────

function VisionModal({
  title, initialData, onSave, onClose,
}: {
  title: string;
  initialData: VisionFormData;
  onSave: (data: VisionFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<VisionFormData>(initialData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof VisionFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) { setUploadError('Solo se permiten imágenes.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('La imagen no puede superar 5 MB.'); return; }

    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadVisionImage(file);
      setForm(f => ({ ...f, image_url: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-plata-700/60 bg-plata-900 shadow-pm-lg flex flex-col gap-4 p-5 mb-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Compass size={16} className="text-dorado-400" /> {title}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-plata-400 hover:text-white rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Image upload */}
        <div>
          <label className="text-xs text-plata-400 mb-1.5 block">Imagen</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-full h-36 rounded-xl border border-dashed border-plata-600 hover:border-dorado-500/60 bg-plata-800/40 overflow-hidden cursor-pointer transition-colors group"
          >
            {form.image_url ? (
              <>
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium flex items-center gap-1.5"><ImagePlus size={14} /> Cambiar imagen</span>
                </div>
              </>
            ) : uploading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin text-dorado-400" />
                <span className="text-xs text-plata-400">Subiendo...</span>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-plata-500 group-hover:text-plata-300 transition-colors">
                <ImagePlus size={24} />
                <span className="text-xs">Hacé clic para subir una imagen (máx. 5 MB)</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          {uploadError && (
            <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {uploadError}</p>
          )}
          {form.image_url && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-plata-500 truncate max-w-xs">URL guardada</span>
              <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} className="text-[10px] text-red-400 hover:text-red-300 ml-2">
                Quitar
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Título *</label>
          <input
            autoFocus
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="¿Qué querés lograr?"
            className="pm-input"
            required
          />
        </div>

        {/* Area + Timeframe */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Área *</label>
            <select value={form.area} onChange={e => set('area', e.target.value)} className="pm-input">
              {AREAS.map(a => (
                <option key={a} value={a}>{VISION_AREA_CONFIG[a].emoji} {VISION_AREA_CONFIG[a].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Plazo *</label>
            <select value={form.timeframe} onChange={e => set('timeframe', e.target.value)} className="pm-input">
              <option value="corto">Corto plazo</option>
              <option value="mediano">Mediano plazo</option>
              <option value="largo">Largo plazo</option>
            </select>
          </div>
        </div>

        {/* Campo de área personalizada (solo si area === 'otra') */}
        {form.area === 'otra' && (
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Nombre del área personalizada *</label>
            <input
              value={form.area_custom}
              onChange={e => set('area_custom', e.target.value)}
              placeholder="Ej: Espiritualidad, Casa, Hijos, Moldería..."
              className="pm-input"
              required
            />
          </div>
        )}

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Estado *</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="pm-input">
              {STATUSES.map(s => (
                <option key={s} value={s}>{VISION_STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-plata-400 mb-1 block">Prioridad *</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="pm-input">
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>

        {/* Target date */}
        <div>
          <label className="text-xs text-plata-400 mb-1 block">Fecha objetivo (opcional)</label>
          <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} className="pm-input" />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-plata-400 mb-1 block">¿Por qué querés esto? (opcional)</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="El motivo real detrás de esta visión..."
            rows={3}
            className="pm-input resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-plata-300 rounded-lg border border-plata-700 hover:bg-plata-800 transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-dorado-600 hover:bg-dorado-500 text-plata-900 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
