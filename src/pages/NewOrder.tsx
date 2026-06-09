import { useState, useEffect, useRef } from 'react';
import { createOrder, uploadFile, getRecentGarmentTypes } from '../lib/orders';
import { getClients, createClient } from '../lib/clients';
import { getModels } from '../lib/inventory';
import { getModelFiles } from '../lib/moldLibrary';
import {
  STATUS_CONFIG,
  STATUS_OPTIONS,
  PRIORITY_CONFIG,
  PRIORITY_OPTIONS,
  WORK_TYPE_OPTIONS,
  getCategoryLabel,
  type OrderStatus,
  type Priority,
  type Client,
  type InventoryModel,
  type MoldFile,
} from '../lib/types';
import { Upload, Save, Loader2, ChevronDown, Plus, X, User, Package, FileText } from 'lucide-react';

interface NewOrderProps {
  onNavigate: (page: string, orderId?: string, clientId?: string, modelId?: string) => void;
  initialData?: Partial<Order>;
}

interface Order {
  customer_name: string;
  phone: string;
  client_whatsapp: string;
  garment_type: string;
  article_name: string;
  sizes: string;
  quantity: number;
  fabric_type: string;
  work_type: string;
  notes: string;
  delivery_date: string;
  status: OrderStatus;
  priority: Priority;
  price: number;
  paid_amount: number;
  reference_image_url: string;
  pdf_file_url: string;
  mold_file_url: string;
  customer_id: string | null;
  model_id: string | null;
}

export default function NewOrder({ onNavigate, initialData }: NewOrderProps) {
  const [form, setForm] = useState<Order>({
    customer_name: '',
    phone: '',
    client_whatsapp: '',
    garment_type: '',
    article_name: '',
    sizes: '',
    quantity: 1,
    fabric_type: '',
    work_type: '',
    notes: '',
    delivery_date: '',
    status: 'nuevo',
    priority: 'normal',
    price: 0,
    paid_amount: 0,
    reference_image_url: '',
    pdf_file_url: '',
    mold_file_url: '',
    customer_id: null,
    model_id: null,
  });

  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [recentGarments, setRecentGarments] = useState<string[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showGarmentDropdown, setShowGarmentDropdown] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [moldFile, setMoldFile] = useState<File | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const moldRef = useRef<HTMLInputElement>(null);

  // Inventory selection
  const [models, setModels] = useState<InventoryModel[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedModel, setSelectedModel] = useState<InventoryModel | null>(null);
  const [modelFiles, setModelFiles] = useState<MoldFile[]>([]);

  // New client quick form
  const [newClientForm, setNewClientForm] = useState({
    business_name: '',
    phone: '',
    whatsapp: '',
  });

  useEffect(() => {
    if (initialData) {
      setForm(prev => ({ ...prev, ...initialData }));
    }
    loadData();
  }, [initialData]);

  const loadData = async () => {
    try {
      const [garments, clientsList, modelsList] = await Promise.all([getRecentGarmentTypes(), getClients(), getModels()]);
      setRecentGarments(garments.map(g => g.name));
      setClients(clientsList);
      setModels(modelsList.filter(m => m.status === 'active'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (field: keyof Order, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const selectClient = (client: Client) => {
    setForm(prev => ({
      ...prev,
      customer_id: client.id,
      customer_name: client.business_name || client.name,
      phone: client.phone || '',
      client_whatsapp: client.whatsapp || client.phone || '',
    }));
    setShowClientDropdown(false);
  };

  const selectModel = async (model: InventoryModel) => {
    setSelectedModel(model);
    setForm(prev => ({
      ...prev,
      model_id: model.id,
      garment_type: model.name,
      article_name: model.name,
      sizes: model.size_curve || '',
      fabric_type: model.recommended_fabric || '',
      reference_image_url: model.main_photo_url || prev.reference_image_url,
    }));
    setShowModelDropdown(false);

    // Load model files
    try {
      const files = await getModelFiles(model.id);
      setModelFiles(files);
    } catch (err) {
      console.error(err);
      setModelFiles([]);
    }
  };

  const clearModelSelection = () => {
    setSelectedModel(null);
    setModelFiles([]);
    setForm(prev => ({
      ...prev,
      model_id: null,
    }));
  };

  const handleQuickCreateClient = async () => {
    if (!newClientForm.business_name.trim()) return;
    try {
      const client = await createClient({
        business_name: newClientForm.business_name,
        phone: newClientForm.phone,
        whatsapp: newClientForm.whatsapp || newClientForm.phone,
        name: newClientForm.business_name,
      });
      selectClient(client);
      setShowNewClientModal(false);
      setNewClientForm({ business_name: '', phone: '', whatsapp: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al crear cliente');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      alert('Por favor, seleccioná o ingresá un cliente');
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.reference_image_url;
      let pdfUrl = form.pdf_file_url;
      let moldUrl = form.mold_file_url;

      if (imageFile) {
        imageUrl = await uploadFile(imageFile, `images/${Date.now()}_${imageFile.name}`, 'order-files');
      }
      if (pdfFile) {
        pdfUrl = await uploadFile(pdfFile, `pdfs/${Date.now()}_${pdfFile.name}`, 'order-files');
      }
      if (moldFile) {
        moldUrl = await uploadFile(moldFile, `molds/${Date.now()}_${moldFile.name}`, 'mold-files');
      }

      const order = await createOrder({
        ...form,
        reference_image_url: imageUrl,
        pdf_file_url: pdfUrl,
        mold_file_url: moldUrl,
      });
      onNavigate('order-detail', order.id);
    } catch (err) {
      console.error(err);
      alert('Error al crear el pedido. Por favor, intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const balance = Number(form.price) - Number(form.paid_amount);

  const filteredClients = clients.filter(c => {
    const q = form.customer_name.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.business_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.whatsapp?.includes(q)
    );
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-petrol-800 dark:text-white">Nuevo Pedido</h1>
          <p className="text-sm text-petrol-500 dark:text-petrol-400 mt-1">Crear nuevo pedido de producción</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente */}
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide">Cliente</h2>
            <button
              type="button"
              onClick={() => setShowNewClientModal(true)}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
            >
              <Plus size={14} /> Cliente nuevo
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Buscar cliente *</label>
              <input
                type="text"
                value={form.customer_name}
                onChange={e => { handleChange('customer_name', e.target.value); setShowClientDropdown(true); }}
                onFocus={() => setShowClientDropdown(true)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
                placeholder="Buscar por nombre o teléfono..."
                required
              />
              {showClientDropdown && form.customer_name.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.length > 0 ? (
                    filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-crudo-100 dark:hover:bg-slate-600 text-sm transition-colors"
                      >
                        <span className="font-medium text-petrol-800 dark:text-white">{c.business_name || c.name}</span>
                        <span className="text-petrol-500 dark:text-petrol-400 text-xs ml-2">{c.phone}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2.5 text-sm text-petrol-500 dark:text-petrol-400">
                      No se encontraron clientes
                      <button
                        type="button"
                        onClick={() => setShowNewClientModal(true)}
                        className="ml-2 text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Crear nuevo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">WhatsApp</label>
              <input
                type="tel"
                value={form.client_whatsapp}
                onChange={e => handleChange('client_whatsapp', e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
                placeholder="5491112345678"
              />
            </div>
          </div>
        </div>

        {/* Seleccionar desde Inventario */}
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide">Seleccionar desde Inventario</h2>
            {selectedModel && (
              <button
                type="button"
                onClick={clearModelSelection}
                className="text-xs text-petrol-500 dark:text-petrol-400 hover:text-red-500"
              >
                <X size={14} /> Limpiar
              </button>
            )}
          </div>

          {selectedModel ? (
            <div className="flex items-center gap-4 p-3 bg-white dark:bg-slate-700 rounded-lg border border-violet-300 dark:border-violet-700">
              {selectedModel.main_photo_url ? (
                <img
                  src={selectedModel.main_photo_url}
                  alt={selectedModel.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-petrol-100 dark:bg-slate-600 flex items-center justify-center">
                  <Package size={24} className="text-petrol-400" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs text-violet-600 dark:text-violet-400 font-mono">{selectedModel.code}</p>
                <p className="font-medium text-petrol-800 dark:text-white">{selectedModel.name}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-petrol-100 dark:bg-petrol-800 rounded text-petrol-600 dark:text-petrol-300">
                    {getCategoryLabel(selectedModel.category)}
                  </span>
                  {selectedModel.size_curve && (
                    <span className="text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 rounded text-violet-600 dark:text-violet-400">
                      {selectedModel.size_curve}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('library', undefined, undefined, selectedModel.id)}
                  className="p-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white"
                  title="Ver biblioteca"
                >
                  <FileText size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="w-full px-4 py-3 border-2 border-dashed border-petrol-300 dark:border-slate-600 rounded-lg text-sm text-petrol-500 dark:text-petrol-400 hover:border-violet-500 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
              >
                <Package size={18} /> Seleccionar modelo del inventario
              </button>
              {showModelDropdown && models.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {models.slice(0, 20).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectModel(m)}
                      className="w-full text-left px-3 py-2.5 hover:bg-crudo-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-3"
                    >
                      {m.main_photo_url ? (
                        <img src={m.main_photo_url} alt={m.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-petrol-100 dark:bg-slate-600 flex items-center justify-center">
                          <Package size={16} className="text-petrol-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-violet-600 dark:text-violet-400 font-mono">{m.code}</p>
                        <p className="text-sm font-medium text-petrol-800 dark:text-white">{m.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedModel && modelFiles.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-petrol-500 dark:text-petrol-400 mb-2">Archivos disponibles ({modelFiles.length})</p>
              <div className="flex flex-wrap gap-2">
                {modelFiles.slice(0, 6).map(f => (
                  <a
                    key={f.id}
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-white dark:bg-slate-700 rounded text-xs text-violet-600 dark:text-violet-400 border border-petrol-200 dark:border-slate-600 hover:border-violet-400 transition-colors flex items-center gap-1"
                  >
                    <FileText size={12} /> {f.file_type.toUpperCase()}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detalles del pedido */}
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide">Detalles del pedido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Prenda / Artículo</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.garment_type}
                  onChange={e => { handleChange('garment_type', e.target.value); setShowGarmentDropdown(true); }}
                  onFocus={() => setShowGarmentDropdown(true)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors pr-8"
                  placeholder="Remera, Pantalón, Vestido..."
                />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-petrol-400" />
              </div>
              {showGarmentDropdown && recentGarments.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  {recentGarments
                    .filter(g => g.toLowerCase().includes(form.garment_type.toLowerCase()))
                    .map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => { handleChange('garment_type', g); setShowGarmentDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-crudo-100 dark:hover:bg-slate-600 text-petrol-800 dark:text-white transition-colors"
                      >
                        {g}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Nombre del artículo</label>
              <input
                type="text"
                value={form.article_name}
                onChange={e => handleChange('article_name', e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
                placeholder="Remera estampada verano"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Talles / Curva</label>
              <input
                type="text"
                value={form.sizes}
                onChange={e => handleChange('sizes', e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
                placeholder="S, M, L, XL o 36-48"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Cantidad</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => handleChange('quantity', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Tipo de trabajo</label>
              <select
                value={form.work_type}
                onChange={e => handleChange('work_type', e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
              >
                <option value="">Seleccionar...</option>
                {WORK_TYPE_OPTIONS.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Tipo de tela</label>
              <input
                type="text"
                value={form.fabric_type}
                onChange={e => handleChange('fabric_type', e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
                placeholder="Algodón, Jersey, etc."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Fecha de entrega</label>
              <input
                type="date"
                value={form.delivery_date}
                onChange={e => handleChange('delivery_date', e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={e => handleChange('status', e.target.value as OrderStatus)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Prioridad</label>
              <select
                value={form.priority}
                onChange={e => handleChange('priority', e.target.value as Priority)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Observaciones</label>
            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors resize-none"
              placeholder="Notas especiales, detalles adicionales..."
            />
          </div>
        </div>

        {/* Pago */}
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide">Pago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Precio total</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={e => handleChange('price', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Pagado</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.paid_amount}
                onChange={e => handleChange('paid_amount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Saldo pendiente</label>
              <div className={`w-full px-3 py-2.5 rounded-lg text-sm font-semibold ${
                balance > 0 ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
              }`}>
                ${balance.toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        </div>

        {/* Archivos */}
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide">Archivos y referencias</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Imagen de referencia</label>
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className="w-full px-3 py-4 border-2 border-dashed border-petrol-300 dark:border-slate-600 rounded-lg text-sm text-petrol-500 dark:text-petrol-400 hover:border-violet-500 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {imageFile ? imageFile.name : 'Subir imagen'}
              </button>
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
              {form.reference_image_url && !imageFile && (
                <img src={form.reference_image_url} alt="Referencia" className="mt-2 h-20 w-full object-cover rounded-lg border border-petrol-200 dark:border-slate-600" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Archivo PDF</label>
              <button
                type="button"
                onClick={() => pdfRef.current?.click()}
                className="w-full px-3 py-4 border-2 border-dashed border-petrol-300 dark:border-slate-600 rounded-lg text-sm text-petrol-500 dark:text-petrol-400 hover:border-violet-500 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {pdfFile ? pdfFile.name : 'Subir PDF'}
              </button>
              <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Archivo de molde</label>
              <button
                type="button"
                onClick={() => moldRef.current?.click()}
                className="w-full px-3 py-4 border-2 border-dashed border-petrol-300 dark:border-slate-600 rounded-lg text-sm text-petrol-500 dark:text-petrol-400 hover:border-violet-500 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {moldFile ? moldFile.name : 'Subir molde'}
              </button>
              <input ref={moldRef} type="file" accept=".pdf,.dxf,.svg,.ai,.eps,.plt" className="hidden" onChange={e => setMoldFile(e.target.files?.[0] || null)} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="px-6 py-3 bg-white dark:bg-slate-700 text-petrol-600 dark:text-petrol-300 rounded-xl text-sm font-medium border border-petrol-200 dark:border-slate-600 hover:bg-crudo-100 dark:hover:bg-slate-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : 'Crear pedido'}
          </button>
        </div>
      </form>

      {/* Quick create client modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-petrol-800 dark:text-white flex items-center gap-2">
                <User size={18} /> Cliente rápido
              </h3>
              <button onClick={() => setShowNewClientModal(false)} className="text-petrol-400 hover:text-petrol-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Nombre / Razón social *</label>
                <input
                  type="text"
                  value={newClientForm.business_name}
                  onChange={e => setNewClientForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                  placeholder="Nombre del cliente"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={newClientForm.phone}
                  onChange={e => setNewClientForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                  placeholder="Teléfono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={newClientForm.whatsapp}
                  onChange={e => setNewClientForm(f => ({ ...f, whatsapp: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                  placeholder="5491112345678"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowNewClientModal(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-crudo-100 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleQuickCreateClient}
                disabled={!newClientForm.business_name.trim()}
                className="flex-1 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Crear y seleccionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
