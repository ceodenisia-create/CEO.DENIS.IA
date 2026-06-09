import { useState, useEffect, useMemo } from 'react';
import {
  getCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCatalogStats,
  uploadCatalogImage,
} from '../lib/internalCatalog';
import { getModels } from '../lib/inventory';
import type { CatalogItem, CatalogStatus, Category, InventoryModel } from '../lib/types';
import {
  CATEGORY_OPTIONS,
  getCategoryLabel,
  normalizeCategory,
  CATALOG_STATUS_CONFIG,
  CATALOG_STATUS_OPTIONS,
  CATALOG_TAG_CONFIG,
  CATALOG_TAG_OPTIONS,
} from '../lib/types';
import { Search, Plus, CreditCard as Edit3, Trash2, Filter, X, Save, Loader2, Upload, Image as ImageIcon, ZoomIn, ExternalLink } from 'lucide-react';

interface InternalCatalogProps {
  onNavigate: (page: string, orderId?: string, clientId?: string, modelId?: string) => void;
}

export default function InternalCatalog({ onNavigate }: InternalCatalogProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [models, setModels] = useState<InventoryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | ''>('');
  const [filterStatus, setFilterStatus] = useState<CatalogStatus | ''>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterWithPhoto, setFilterWithPhoto] = useState<'yes' | 'no' | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'HOMBRE' as Category,
    size_curve: '',
    season: '',
    status: 'active' as CatalogStatus,
    internal_notes: '',
    tags: [] as string[],
    model_id: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoInputRef = { current: null as HTMLInputElement | null };

  const [showViewer, setShowViewer] = useState(false);
  const [viewerItem, setViewerItem] = useState<CatalogItem | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsData, modelsData, statsData] = await Promise.all([
        getCatalogItems(),
        getModels(),
        getCatalogStats(),
      ]);
      setItems(itemsData);
      setModels(modelsData.filter(m => m.status === 'active'));
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let result = items;
    const q = search.toLowerCase();

    if (search) {
      result = result.filter(i =>
        i.code.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.internal_notes?.toLowerCase().includes(q) ||
        getCategoryLabel(i.category).toLowerCase().includes(q)
      );
    }

    if (filterCategory) result = result.filter(i => normalizeCategory(i.category) === filterCategory);
    if (filterStatus) result = result.filter(i => i.status === filterStatus);
    if (filterTag) result = result.filter(i => i.tags?.includes(filterTag));
    if (filterWithPhoto === 'yes') result = result.filter(i => i.photo_url && i.photo_url.length > 0);
    if (filterWithPhoto === 'no') result = result.filter(i => !i.photo_url || i.photo_url.length === 0);

    return result;
  }, [items, search, filterCategory, filterStatus, filterTag, filterWithPhoto]);

  const openNewItem = () => {
    setEditingItem(null);
    setForm({
      code: '',
      name: '',
      category: 'HOMBRE',
      size_curve: '',
      season: '',
      status: 'active',
      internal_notes: '',
      tags: [],
      model_id: '',
    });
    setPhotoFile(null);
    setShowModal(true);
  };

  const openEditItem = (item: CatalogItem) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      name: item.name,
      category: normalizeCategory(item.category) || 'HOMBRE',
      size_curve: item.size_curve || '',
      season: item.season || '',
      status: item.status as CatalogStatus,
      internal_notes: item.internal_notes || '',
      tags: item.tags || [],
      model_id: item.model_id || '',
    });
    setPhotoFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let photoUrl = editingItem?.photo_url || '';

      if (photoFile) {
        try {
          photoUrl = await uploadCatalogImage(photoFile, editingItem?.id || `temp-${Date.now()}`);
        } catch (uploadErr) {
          console.error('Error uploading photo:', uploadErr);
          alert('Error al subir la foto. Intentá de nuevo.');
          setSaving(false);
          return;
        }
      }

      if (editingItem) {
        await updateCatalogItem(editingItem.id, {
          ...form,
          model_id: form.model_id || null,
          photo_url: photoUrl,
        });
      } else {
        await createCatalogItem({
          ...form,
          model_id: form.model_id || null,
          photo_url: photoUrl,
        });
      }

      // Close modal first, then reload data
      setShowModal(false);
      setPhotoFile(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCatalogItem(id);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const openViewer = (item: CatalogItem) => {
    setViewerItem(item);
    setZoom(1);
    setShowViewer(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-crudo-100">Catálogo Interno</h1>
          <p className="text-sm text-crudo-400 mt-1">{filteredItems.length} imágenes privadas</p>
        </div>
        <button onClick={openNewItem} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
          <Plus size={18} /> Nueva Imagen
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Total</p>
            <p className="text-lg font-bold text-petrol-800 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Activos</p>
            <p className="text-lg font-bold text-emerald-600">{stats.active}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Ocultos</p>
            <p className="text-lg font-bold text-amber-600">{stats.hidden}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Archivados</p>
            <p className="text-lg font-bold text-gray-500">{stats.archived}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">No publicar</p>
            <p className="text-lg font-bold text-red-600">{stats.noPublish}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Privados</p>
            <p className="text-lg font-bold text-violet-600">{stats.clientSpecific}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Con foto</p>
            <p className="text-lg font-bold text-petrol-700">{stats.withPhoto}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Sin foto</p>
            <p className="text-lg font-bold text-gray-400">{stats.withoutPhoto}</p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-petrol-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
              showFilters || filterCategory || filterStatus || filterTag || filterWithPhoto
                ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                : 'bg-white dark:bg-slate-700 border-petrol-200 dark:border-slate-600 text-petrol-600 dark:text-petrol-300'
            }`}
          >
            <Filter size={16} /> Filtros
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3" aria-label="Filtrar por categoría">
          {(['', ...CATEGORY_OPTIONS] as (Category | '')[]).map(category => {
            const active = filterCategory === category;
            return (
              <button
                key={category || 'TODOS'}
                type="button"
                onClick={() => setFilterCategory(category)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-violet-500 border-violet-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-700 border-petrol-200 dark:border-slate-600 text-petrol-600 dark:text-petrol-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300'
                }`}
              >
                {category || 'TODOS'}
              </button>
            );
          })}
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as Category | '')}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
            >
              <option value="">Todas categorías</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as CatalogStatus | '')}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
            >
              <option value="">Todos estados</option>
              {CATALOG_STATUS_OPTIONS.map(s => <option key={s} value={s}>{CATALOG_STATUS_CONFIG[s].label}</option>)}
            </select>
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
            >
              <option value="">Todas etiquetas</option>
              {CATALOG_TAG_OPTIONS.map(t => <option key={t} value={t}>{CATALOG_TAG_CONFIG[t]?.label || t}</option>)}
            </select>
            <select
              value={filterWithPhoto}
              onChange={e => setFilterWithPhoto(e.target.value as 'yes' | 'no' | '')}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
            >
              <option value="">Todas</option>
              <option value="yes">Con foto</option>
              <option value="no">Sin foto</option>
            </select>
          </div>
        )}
      </div>

      {/* Gallery */}
      {filteredItems.length === 0 ? (
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-12 border border-petrol-200 dark:border-slate-700 text-center">
          <ImageIcon size={40} className="mx-auto text-petrol-300 mb-3" />
          <p className="text-petrol-500 text-sm">No hay imágenes en el catálogo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all group"
            >
              {/* Photo */}
              <div
                className="relative bg-petrol-100 dark:bg-slate-700 min-h-[180px] flex items-center justify-center cursor-pointer"
                onClick={() => openViewer(item)}
              >
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.name}
                    className="w-full h-auto max-h-[280px] object-contain group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <ImageIcon size={40} className="text-petrol-300" />
                )}

                {/* Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8">
                  <p className="text-xs text-violet-300 font-mono">{item.code}</p>
                  <p className="text-sm text-white font-semibold line-clamp-2">{item.name}</p>
                </div>

                {/* Zoom indicator */}
                <div className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn size={16} className="text-white" />
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 bg-petrol-100 dark:bg-petrol-800 rounded text-petrol-600 dark:text-petrol-300">
                    {getCategoryLabel(item.category)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATALOG_STATUS_CONFIG[item.status as CatalogStatus]?.bgClass} ${CATALOG_STATUS_CONFIG[item.status as CatalogStatus]?.textClass}`}>
                    {CATALOG_STATUS_CONFIG[item.status as CatalogStatus]?.label}
                  </span>
                </div>

                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className={`text-xs px-1.5 py-0.5 rounded ${CATALOG_TAG_CONFIG[tag]?.color || 'bg-gray-100 text-gray-600'}`}
                      >
                        {CATALOG_TAG_CONFIG[tag]?.label || tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-xs text-petrol-400">+{item.tags.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => openViewer(item)}
                    className="flex-1 px-3 py-2 bg-petrol-600 hover:bg-petrol-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <ZoomIn size={14} /> Ver
                  </button>
                  <button
                    onClick={() => openEditItem(item)}
                    className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-crudo-100 dark:hover:bg-slate-600 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-xs"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(item.id)}
                    className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 border border-petrol-200 dark:border-slate-600 rounded-lg text-xs"
                  >
                    <Trash2 size={14} />
                  </button>
                  {item.model_id && (
                    <button
                      onClick={() => onNavigate('library', undefined, undefined, item.model_id!)}
                      className="px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs"
                      title="Ver en Biblioteca"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-petrol-800 dark:text-white">
                {editingItem ? 'Editar Imagen' : 'Nueva Imagen'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-petrol-400 hover:text-petrol-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Código</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                    placeholder="Auto-generado"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Categoría</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  >
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as CatalogStatus }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  >
                    {CATALOG_STATUS_OPTIONS.map(s => <option key={s} value={s}>{CATALOG_STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Talles</label>
                  <input
                    type="text"
                    value={form.size_curve}
                    onChange={e => setForm(f => ({ ...f, size_curve: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, size_curve: '4/6/8/10/12/14/16' }))}
                      className="px-2.5 py-1 bg-petrol-100 dark:bg-slate-700 hover:bg-petrol-200 dark:hover:bg-slate-600 border border-petrol-200 dark:border-slate-600 rounded-md text-xs font-medium text-petrol-700 dark:text-petrol-300"
                    >
                      Niños 4-16
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, size_curve: 'S/M/L/XL/2XL' }))}
                      className="px-2.5 py-1 bg-petrol-100 dark:bg-slate-700 hover:bg-petrol-200 dark:hover:bg-slate-600 border border-petrol-200 dark:border-slate-600 rounded-md text-xs font-medium text-petrol-700 dark:text-petrol-300"
                    >
                      Adultos S-2XL
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Temporada</label>
                  <input
                    type="text"
                    value={form.season}
                    onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Vincular a modelo del inventario</label>
                  <select
                    value={form.model_id}
                    onChange={e => setForm(f => ({ ...f, model_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  >
                    <option value="">Sin vincular</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-2">Etiquetas</label>
                <div className="flex flex-wrap gap-2">
                  {CATALOG_TAG_OPTIONS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        form.tags.includes(tag)
                          ? CATALOG_TAG_CONFIG[tag]?.color || 'bg-violet-500 text-white'
                          : 'bg-white dark:bg-slate-700 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600'
                      }`}
                    >
                      {CATALOG_TAG_CONFIG[tag]?.label || tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Notas internas</label>
                <textarea
                  value={form.internal_notes}
                  onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Foto</label>
                <input
                  ref={el => { photoInputRef.current = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full px-3 py-4 border-2 border-dashed border-petrol-300 dark:border-slate-600 rounded-lg text-sm text-petrol-500 hover:border-violet-500 flex items-center justify-center gap-2"
                >
                  <Upload size={16} />
                  {photoFile ? photoFile.name : 'Subir foto'}
                </button>
                {editingItem?.photo_url && !photoFile && (
                  <img src={editingItem.photo_url} alt="Actual" className="mt-2 h-24 w-full object-contain rounded-lg border border-petrol-200" />
                )}
              </div>
            </div>
            <div className="p-4 border-t border-petrol-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 border border-petrol-200 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {showViewer && viewerItem && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setShowViewer(false)}>
          <div className="max-w-5xl max-h-full p-4" onClick={e => e.stopPropagation()}>
            {/* Controls */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-violet-400 font-mono">{viewerItem.code}</p>
                <p className="text-white font-semibold">{viewerItem.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                >
                  -
                </button>
                <span className="text-white text-sm px-3">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                >
                  +
                </button>
                <button
                  onClick={() => setShowViewer(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="overflow-auto max-h-[70vh] flex items-center justify-center">
              {viewerItem.photo_url ? (
                <img
                  src={viewerItem.photo_url}
                  alt={viewerItem.name}
                  style={{ transform: `scale(${zoom})` }}
                  className="max-w-full transition-transform"
                />
              ) : (
                <div className="text-white/50 flex flex-col items-center gap-4">
                  <ImageIcon size={64} />
                  <p>Sin imagen</p>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="px-2 py-1 bg-petrol-800 rounded text-crudo-200">
                {getCategoryLabel(viewerItem.category)}
              </span>
              <span className={`px-2 py-1 rounded ${CATALOG_STATUS_CONFIG[viewerItem.status as CatalogStatus]?.bgClass} ${CATALOG_STATUS_CONFIG[viewerItem.status as CatalogStatus]?.textClass}`}>
                {CATALOG_STATUS_CONFIG[viewerItem.status as CatalogStatus]?.label}
              </span>
              {viewerItem.tags?.map(tag => (
                <span key={tag} className={`px-2 py-1 rounded ${CATALOG_TAG_CONFIG[tag]?.color || 'bg-gray-700 text-gray-200'}`}>
                  {CATALOG_TAG_CONFIG[tag]?.label || tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 p-5">
            <h3 className="text-lg font-semibold text-petrol-800 dark:text-white mb-2">Eliminar imagen</h3>
            <p className="text-sm text-petrol-600 dark:text-petrol-400 mb-4">¿Estás seguro?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 border border-petrol-200 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
