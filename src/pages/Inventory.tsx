import { useState, useEffect, useMemo } from 'react';
import {
  getModels,
  createModel,
  updateModel,
  deleteModel,
  getModelStats,
  uploadModelPhoto,
} from '../lib/inventory';
import { exportToCSV } from '../lib/exports';
import type { InventoryModel, Category, ModelStatus } from '../lib/types';
import {
  CATEGORY_OPTIONS,
  getCategoryLabel,
  normalizeCategory,
  MODEL_STATUS_CONFIG,
  MODEL_STATUS_OPTIONS,
} from '../lib/types';
import { Search, Plus, CreditCard as Edit3, Eye, Trash2, FileText, Filter, TrendingUp, Package, X, Save, Loader2, Upload, FileSpreadsheet } from 'lucide-react';

interface InventoryProps {
  onNavigate: (page: string, orderId?: string, clientId?: string, modelId?: string) => void;
}

export default function Inventory({ onNavigate }: InventoryProps) {
  const [models, setModels] = useState<InventoryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | ''>('');
  const [filterStatus, setFilterStatus] = useState<ModelStatus | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<InventoryModel | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'HOMBRE' as Category,
    subcategory: '',
    size_curve: '',
    recommended_fabric: '',
    description: '',
    quantity_available: 0,
    quantity_sold: 0,
    status: 'active' as ModelStatus,
    season: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoInputRef = { current: null as HTMLInputElement | null };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [modelsData, statsData] = await Promise.all([getModels(), getModelStats()]);
      setModels(modelsData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    let result = models;
    const q = search.toLowerCase();

    if (search) {
      result = result.filter(m =>
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        getCategoryLabel(m.category).toLowerCase().includes(q)
      );
    }

    if (filterCategory) result = result.filter(m => normalizeCategory(m.category) === filterCategory);
    if (filterStatus) result = result.filter(m => m.status === filterStatus);

    return result;
  }, [models, search, filterCategory, filterStatus]);

  const openNewModel = () => {
    setEditingModel(null);
    setForm({
      code: '',
      name: '',
      category: 'HOMBRE',
      subcategory: '',
      size_curve: '',
      recommended_fabric: '',
      description: '',
      quantity_available: 0,
      quantity_sold: 0,
      status: 'active',
      season: '',
    });
    setPhotoFile(null);
    setShowModal(true);
  };

  const openEditModel = (model: InventoryModel) => {
    setEditingModel(model);
    setForm({
      code: model.code,
      name: model.name,
      category: normalizeCategory(model.category) || 'HOMBRE',
      subcategory: model.subcategory || '',
      size_curve: model.size_curve || '',
      recommended_fabric: model.recommended_fabric || '',
      description: model.description || '',
      quantity_available: model.quantity_available || 0,
      quantity_sold: model.quantity_sold || 0,
      status: model.status as ModelStatus,
      season: model.season || '',
    });
    setPhotoFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let photoUrl = editingModel?.main_photo_url || '';

      if (photoFile) {
        try {
          photoUrl = await uploadModelPhoto(photoFile, editingModel?.id || `temp-${Date.now()}`);
        } catch (uploadErr) {
          console.error('Error uploading photo:', uploadErr);
          alert('Error al subir la foto. Intentá de nuevo.');
          setSaving(false);
          return;
        }
      }

      if (editingModel) {
        await updateModel(editingModel.id, { ...form, main_photo_url: photoUrl });
      } else {
        await createModel({ ...form, main_photo_url: photoUrl });
      }

      // Close modal first, then reload data
      setShowModal(false);
      setPhotoFile(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el modelo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el modelo');
    }
  };

  const exportInventory = () => {
    const data = filteredModels.map(m => ({
      code: m.code,
      date: new Date(m.created_at).toLocaleDateString('es-AR'),
      name: m.name,
      category: getCategoryLabel(m.category),
      sizes: m.size_curve,
      available: m.quantity_available,
      sold: m.quantity_sold,
      status: MODEL_STATUS_CONFIG[m.status as ModelStatus]?.label || m.status,
    }));
    exportToCSV(data.map(d => ({
      order_number: d.code,
      customer_name: d.name,
      garment_type: d.category,
      sizes: d.sizes,
      quantity: d.sold,
      notes: d.status,
      created_at: d.date,
      price: d.available,
    } as any)), 'modeltex-inventario');
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-crudo-100">Inventario</h1>
          <p className="text-sm text-crudo-400 mt-1">{filteredModels.length} modelos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportInventory} className="px-3 py-2 bg-petrol-700 hover:bg-petrol-600 text-crudo-200 rounded-lg text-xs font-medium border border-petrol-600 flex items-center gap-1.5">
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button onClick={openNewModel} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
            <Plus size={18} /> Nuevo Modelo
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2.5 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Total</p>
            <p className="text-lg font-bold text-petrol-800 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2.5 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Activos</p>
            <p className="text-lg font-bold text-emerald-600">{stats.active}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2.5 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Ocultos</p>
            <p className="text-lg font-bold text-amber-600">{stats.hidden}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2.5 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Archivados</p>
            <p className="text-lg font-bold text-gray-500">{stats.archived}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2.5 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Vendidos</p>
            <p className="text-lg font-bold text-violet-600 flex items-center gap-1"><TrendingUp size={12}/>{stats.totalSold}</p>
          </div>
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-2.5 border border-petrol-200 dark:border-slate-700">
            <p className="text-xs text-petrol-500">Disponibles</p>
            <p className="text-lg font-bold text-petrol-700 dark:text-petrol-300">{models.reduce((s, m) => s + (m.quantity_available || 0), 0)}</p>
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
              placeholder="Buscar por código, nombre..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
              showFilters || filterCategory || filterStatus
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
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white"
            >
              <option value="">Todas las categorías</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as ModelStatus | '')}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white"
            >
              <option value="">Todos los estados</option>
              {MODEL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{MODEL_STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-petrol-100 dark:bg-slate-700 text-petrol-700 dark:text-petrol-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Artículo</th>
                <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                <th className="px-4 py-3 text-left font-semibold">Talles</th>
                <th className="px-4 py-3 text-center font-semibold">Disponibles</th>
                <th className="px-4 py-3 text-center font-semibold">Vendidos</th>
                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                <th className="px-4 py-3 text-center font-semibold">Foto</th>
                <th className="px-4 py-3 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-petrol-100 dark:divide-slate-700">
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-petrol-400">
                    <Package size={32} className="mx-auto mb-2 opacity-50" />
                    No se encontraron modelos
                  </td>
                </tr>
              ) : (
                filteredModels.map(model => (
                  <tr key={model.id} className="hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-violet-600 dark:text-violet-400 font-medium">{model.code}</span>
                    </td>
                    <td className="px-4 py-3 text-petrol-600 dark:text-petrol-400">
                      {new Date(model.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-petrol-800 dark:text-white">{model.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-petrol-100 dark:bg-petrol-800 rounded text-petrol-600 dark:text-petrol-300 text-xs">
                        {getCategoryLabel(model.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-petrol-600 dark:text-petrol-400">{model.size_curve || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-petrol-800 dark:text-white">{model.quantity_available || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-violet-600 dark:text-violet-400">{model.quantity_sold || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${MODEL_STATUS_CONFIG[model.status as ModelStatus]?.bgClass} ${MODEL_STATUS_CONFIG[model.status as ModelStatus]?.textClass}`}>
                        {MODEL_STATUS_CONFIG[model.status as ModelStatus]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {model.main_photo_url ? (
                          <img src={model.main_photo_url} alt={model.name} className="w-10 h-10 rounded object-cover border border-petrol-200 dark:border-slate-600" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-petrol-100 dark:bg-slate-700 flex items-center justify-center border border-petrol-200 dark:border-slate-600">
                            <Package size={16} className="text-petrol-400" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onNavigate('library', undefined, undefined, model.id)}
                          className="p-1.5 rounded text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                          title="Ver en Biblioteca"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openEditModel(model)}
                          className="p-1.5 rounded text-petrol-500 hover:bg-petrol-50 dark:hover:bg-slate-700"
                          title="Editar"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(model.id)}
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          onClick={() => onNavigate('library', undefined, undefined, model.id)}
                          className="p-1.5 rounded text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          title="Biblioteca"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-petrol-800 dark:text-white">
                {editingModel ? 'Editar Modelo' : 'Nuevo Modelo'}
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
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Curva de talles</label>
                  <input
                    type="text"
                    value={form.size_curve}
                    onChange={e => setForm(f => ({ ...f, size_curve: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                    placeholder="S/M/L/XL/2XL"
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
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Disponibles</label>
                  <input
                    type="number"
                    min={0}
                    value={form.quantity_available}
                    onChange={e => setForm(f => ({ ...f, quantity_available: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ModelStatus }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  >
                    {MODEL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{MODEL_STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Temporada</label>
                  <input
                    type="text"
                    value={form.season}
                    onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                    placeholder="Invierno 2024"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Tela recomendada</label>
                  <input
                    type="text"
                    value={form.recommended_fabric}
                    onChange={e => setForm(f => ({ ...f, recommended_fabric: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Foto</label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full px-3 py-3 border-2 border-dashed border-petrol-300 dark:border-slate-600 rounded-lg text-sm text-petrol-500 hover:border-violet-500 flex items-center justify-center gap-2"
                >
                  <Upload size={16} />
                  {photoFile ? photoFile.name : 'Subir foto'}
                </button>
                {editingModel?.main_photo_url && !photoFile && (
                  <img src={editingModel.main_photo_url} alt="Actual" className="mt-2 h-20 w-full object-cover rounded-lg border border-petrol-200" />
                )}
              </div>
            </div>
            <div className="p-4 border-t border-petrol-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 p-5">
            <h3 className="text-lg font-semibold text-petrol-800 dark:text-white mb-2">Eliminar modelo</h3>
            <p className="text-sm text-petrol-600 dark:text-petrol-400 mb-4">¿Estás seguro? Se eliminarán también los archivos asociados.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
