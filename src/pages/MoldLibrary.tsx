import { useState, useEffect } from 'react';
import {
  getModelFiles,
  createMoldFile,
  updateMoldFile,
  deleteMoldFile,
  uploadMoldFile,
} from '../lib/moldLibrary';
import { getModels, getModel } from '../lib/inventory';
import type { MoldFile, FileType, InventoryModel } from '../lib/types';
import { FILE_TYPE_CONFIG, FILE_TYPE_OPTIONS, CATEGORY_CONFIG } from '../lib/types';
import {
  FileText,
  Upload,
  X,
  Save,
  Loader2,
  Trash2,
  Star,
  Download,
  Eye,
  Package,
  Plus,
  Search,
  ExternalLink,
} from 'lucide-react';

interface MoldLibraryProps {
  modelId?: string;
  onNavigate: (page: string, orderId?: string, clientId?: string, modelId?: string) => void;
}

export default function MoldLibrary({ modelId, onNavigate }: MoldLibraryProps) {
  const [models, setModels] = useState<InventoryModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<InventoryModel | null>(null);
  const [files, setFiles] = useState<MoldFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingFile, setEditingFile] = useState<MoldFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    file_name: '',
    file_type: 'other' as FileType,
    version: '',
    technical_notes: '',
    is_primary: false,
  });
  const [uploadFileState, setUploadFileState] = useState<File | null>(null);
  const fileInputRef = { current: null as HTMLInputElement | null };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const modelsData = await getModels();
      const activeModels = modelsData.filter(m => m.status === 'active');
      setModels(activeModels);

      if (modelId) {
        const model = activeModels.find(m => m.id === modelId) || await getModel(modelId);
        if (model) {
          setSelectedModel(model);
          const filesData = await getModelFiles(modelId);
          setFiles(filesData);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = models.filter(m => {
    const q = search.toLowerCase();
    return m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });

  const openNewFile = () => {
    if (!selectedModel) return;
    setEditingFile(null);
    setForm({ file_name: '', file_type: 'other', version: '', technical_notes: '', is_primary: false });
    setUploadFileState(null);
    setShowModal(true);
  };

  const openEditFile = (file: MoldFile) => {
    setEditingFile(file);
    setForm({
      file_name: file.file_name,
      file_type: file.file_type as FileType,
      version: file.version || '',
      technical_notes: file.technical_notes || '',
      is_primary: file.is_primary,
    });
    setUploadFileState(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedModel) return;
    if (!uploadFileState && !editingFile) return;
    setSaving(true);
    try {
      let fileUrl = editingFile?.file_url || '';
      if (uploadFileState) {
        fileUrl = await uploadMoldFile(uploadFileState, selectedModel.id);
      }
      if (editingFile) {
        await updateMoldFile(editingFile.id, {
          ...form,
          file_url: fileUrl,
          file_name: form.file_name || uploadFileState?.name || editingFile.file_name,
        });
      } else {
        await createMoldFile({
          model_id: selectedModel.id,
          file_name: form.file_name || uploadFileState?.name || '',
          file_type: form.file_type,
          file_url: fileUrl,
          version: form.version,
          technical_notes: form.technical_notes,
          is_primary: form.is_primary,
        });
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el archivo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMoldFile(id);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el archivo');
    }
  };

  const selectModelAndShowFiles = async (model: InventoryModel) => {
    setSelectedModel(model);
    onNavigate('library', undefined, undefined, model.id);
    try {
      const filesData = await getModelFiles(model.id);
      setFiles(filesData);
    } catch (err) {
      console.error(err);
    }
  };

  // Reserved for future file list modal
  // const openFilesList = (model: InventoryModel) => {
  //   setViewingModel(model);
  //   setShowFilesModal(true);
  // };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If no modelId, show all models as cards
  if (!modelId) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-crudo-100">Biblioteca de Moldes</h1>
            <p className="text-sm text-crudo-400 mt-1">{filteredModels.length} modelos con archivos técnicos</p>
          </div>
        </div>

        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-petrol-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
            />
          </div>
        </div>

        {filteredModels.length === 0 ? (
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-12 border border-petrol-200 dark:border-slate-700 text-center">
            <Package size={40} className="mx-auto text-petrol-300 mb-3" />
            <p className="text-petrol-500 text-sm">No hay modelos en el inventario</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredModels.map(model => (
              <div
                key={model.id}
                className="bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all group"
              >
                {/* Photo container - full aspect ratio */}
                <div className="relative bg-petrol-100 dark:bg-slate-700 min-h-[200px] flex items-center justify-center">
                  {model.main_photo_url ? (
                    <img
                      src={model.main_photo_url}
                      alt={model.name}
                      className="w-full h-auto max-h-[300px] object-contain"
                    />
                  ) : (
                    <Package size={48} className="text-petrol-300" />
                  )}

                  {/* Overlay with code and name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8">
                    <p className="text-xs text-violet-300 font-mono">{model.code}</p>
                    <p className="text-sm text-white font-semibold line-clamp-2">{model.name}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 bg-petrol-100 dark:bg-petrol-800 rounded text-petrol-600 dark:text-petrol-300">
                      {CATEGORY_CONFIG[model.category as keyof typeof CATEGORY_CONFIG]?.label}
                    </span>
                    {model.size_curve && (
                      <span className="text-xs text-violet-600 dark:text-violet-400">{model.size_curve}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => selectModelAndShowFiles(model)}
                      className="flex-1 px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Eye size={14} /> Ver Archivos
                    </button>
                    <button
                      onClick={() => { setSelectedModel(model); openNewFile(); }}
                      className="px-3 py-2 bg-petrol-600 hover:bg-petrol-700 text-white rounded-lg text-xs font-semibold"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => onNavigate('inventory')}
                      className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-crudo-100 dark:hover:bg-slate-600 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-xs"
                      title="Ver en Inventario"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If modelId is set, show files for that model
  if (!selectedModel) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-petrol-400 mb-2">
        <button onClick={() => onNavigate('library')} className="hover:text-violet-400 transition-colors">
          Biblioteca
        </button>
        <span>/</span>
        <span className="text-crudo-200">{selectedModel.code}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedModel.main_photo_url ? (
            <img
              src={selectedModel.main_photo_url}
              alt={selectedModel.name}
              className="w-20 h-20 rounded-lg object-contain bg-petrol-100 dark:bg-slate-700 border border-petrol-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-petrol-100 dark:bg-slate-700 flex items-center justify-center border border-petrol-200">
              <Package size={28} className="text-petrol-300" />
            </div>
          )}
          <div>
            <p className="text-xs text-violet-600 dark:text-violet-400 font-mono">{selectedModel.code}</p>
            <h1 className="text-xl font-bold text-crudo-100">{selectedModel.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-petrol-100 dark:bg-petrol-800 rounded text-petrol-600 dark:text-petrol-300">
                {CATEGORY_CONFIG[selectedModel.category as keyof typeof CATEGORY_CONFIG]?.label}
              </span>
              {selectedModel.size_curve && (
                <span className="text-xs text-violet-600 dark:text-violet-400">{selectedModel.size_curve}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('inventory')}
            className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-crudo-100 dark:hover:bg-slate-600 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-xs"
          >
            Ver en Inventario
          </button>
          <button
            onClick={openNewFile}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <Upload size={16} /> Subir Archivo
          </button>
        </div>
      </div>

      {/* Files list */}
      {files.length === 0 ? (
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-12 border border-petrol-200 dark:border-slate-700 text-center">
          <FileText size={40} className="mx-auto text-petrol-300 mb-3" />
          <p className="text-petrol-500 text-sm mb-4">Sin archivos en la biblioteca</p>
          <button onClick={openNewFile} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm">
            Subir primer archivo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {FILE_TYPE_OPTIONS.filter(t => files.some(f => f.file_type === t)).map(fileType => {
            const typeFiles = files.filter(f => f.file_type === fileType);
            if (typeFiles.length === 0) return null;

            return (
              <div key={fileType} className="bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-petrol-100 dark:bg-slate-700/50 border-b border-petrol-200 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-petrol-600 dark:text-petrol-300 uppercase flex items-center gap-2">
                    <FileText size={14} /> {FILE_TYPE_CONFIG[fileType].label}
                    <span className="px-1.5 py-0.5 bg-white dark:bg-slate-600 rounded text-petrol-700 dark:text-petrol-300">
                      {typeFiles.length}
                    </span>
                  </h3>
                </div>
                <div className="p-3 space-y-2">
                  {typeFiles.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700 rounded-lg border border-petrol-100 dark:border-slate-600"
                    >
                      <div className="flex-shrink-0">
                        {file.is_primary ? (
                          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                            <Star size={16} className="text-amber-600" fill="currentColor" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-petrol-100 dark:bg-slate-600 rounded-lg flex items-center justify-center">
                            <FileText size={16} className="text-petrol-500" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-petrol-800 dark:text-white truncate">{file.file_name}</p>
                          {file.is_primary && <span className="text-xs text-amber-600">Principal</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-petrol-500 mt-0.5">
                          {file.version && <span>V: {file.version}</span>}
                          <span>{new Date(file.created_at).toLocaleDateString('es-AR')}</span>
                        </div>
                        {file.technical_notes && (
                          <p className="text-xs text-petrol-400 mt-1 truncate">{file.technical_notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-petrol-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg"
                          title="Ver"
                        >
                          <Eye size={16} />
                        </a>
                        <a
                          href={file.file_url}
                          download
                          className="p-2 text-petrol-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"
                          title="Descargar"
                        >
                          <Download size={16} />
                        </a>
                        <button
                          onClick={() => openEditFile(file)}
                          className="p-2 text-petrol-400 hover:text-petrol-600 hover:bg-petrol-50 dark:hover:bg-slate-600 rounded-lg"
                          title="Editar"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(file.id)}
                          className="p-2 text-petrol-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* File upload modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700">
            <div className="p-4 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-petrol-800 dark:text-white">
                {editingFile ? 'Editar Archivo' : 'Subir Archivo'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-petrol-400 hover:text-petrol-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {!editingFile && (
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Archivo</label>
                  <input
                    ref={el => { fileInputRef.current = el; }}
                    type="file"
                    accept=".pdf,.plt,.dxf,.cdr,.ai,.zip,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadFileState(file);
                        setForm(f => ({ ...f, file_name: f.file_name || file.name }));
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-4 border-2 border-dashed border-petrol-300 dark:border-slate-600 rounded-lg text-sm text-petrol-500 hover:border-violet-500 flex items-center justify-center gap-2"
                  >
                    <Upload size={16} />
                    {uploadFileState ? uploadFileState.name : 'Seleccionar archivo'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Tipo</label>
                  <select
                    value={form.file_type}
                    onChange={e => setForm(f => ({ ...f, file_type: e.target.value as FileType }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                  >
                    {FILE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{FILE_TYPE_CONFIG[t].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Versión</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                    placeholder="v1.0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={form.is_primary}
                  onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))}
                  className="w-4 h-4 text-violet-500 border-petrol-300 rounded"
                />
                <label htmlFor="is_primary" className="text-xs text-petrol-600 dark:text-petrol-400">Archivo principal</label>
              </div>

              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Observaciones</label>
                <textarea
                  value={form.technical_notes}
                  onChange={e => setForm(f => ({ ...f, technical_notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-petrol-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
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
            <h3 className="text-lg font-semibold text-petrol-800 dark:text-white mb-2">Eliminar archivo</h3>
            <p className="text-sm text-petrol-600 dark:text-petrol-400 mb-4">¿Estás seguro? El archivo será eliminado permanentemente.</p>
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
