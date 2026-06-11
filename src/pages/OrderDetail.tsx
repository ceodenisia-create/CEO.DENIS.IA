import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, OrderHistoryEntry, OrderStatus, Priority } from '../lib/types';
import { STATUS_CONFIG, STATUS_OPTIONS, PRIORITY_CONFIG, PRIORITY_OPTIONS } from '../lib/types';
import { updateOrder, getOrderHistory, duplicateOrder } from '../lib/orders';
import { useAuth } from '../lib/AuthContext';
import { getClientOrders, formatWhatsAppMessage, getWhatsAppLink } from '../lib/clients';
import StatusBadge from '../components/StatusBadge';
import {
  ArrowLeft,
  Save,
  Loader2,
  MessageCircle,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  Image as ImageIcon,
  History,
  Copy,
  User,
  ExternalLink,
  CheckCircle2,
  Truck,
  X,
} from 'lucide-react';

interface OrderDetailProps {
  orderId: string;
  onNavigate: (page: string) => void;
}

export default function OrderDetail({ orderId, onNavigate }: OrderDetailProps) {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [_isFavorite, setIsFavorite] = useState(false);

  const [editStatus, setEditStatus] = useState<OrderStatus>('nuevo');
  const [editPriority, setEditPriority] = useState<Priority>('normal');
  const [editPrice, setEditPrice] = useState('');
  const [editPaid, setEditPaid] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editWorkType, setEditWorkType] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [showWhatsAppAlert, setShowWhatsAppAlert] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setOrder(data);
        setEditStatus(data.status);
        setEditPriority(data.priority);
        setEditPrice(String(data.price));
        setEditPaid(String(data.paid_amount));
        setEditNotes(data.notes);
        setEditDeliveryDate(data.delivery_date || '');
        setEditWorkType(data.work_type || '');

        const hist = await getOrderHistory(data.id);
        setHistory(hist);

        if (data.customer_id) {
          const { data: cust } = await supabase
            .from('customers')
            .select('is_favorite')
            .eq('id', data.customer_id)
            .maybeSingle();
          setIsFavorite(cust?.is_favorite || false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await updateOrder(order.id, {
        status: editStatus,
        priority: editPriority,
        price: parseFloat(editPrice) || 0,
        paid_amount: parseFloat(editPaid) || 0,
        notes: editNotes,
        delivery_date: editDeliveryDate || null,
        work_type: editWorkType,
      }, user?.id);
      setEditing(false);
      loadOrder();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    try {
      await updateOrder(order.id, { status: newStatus }, user?.id);
      loadOrder();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async () => {
    try {
      await duplicateOrder(orderId);
      onNavigate('orders');
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewCustomerHistory = async () => {
    if (!order) return;
    try {
      const orders = await getClientOrders(order.customer_id || '');
      setCustomerOrders(orders);
      setShowCustomerHistory(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendWhatsApp = () => {
    if (!order) return;
    const whatsapp = order.client_whatsapp || order.phone;
    if (!whatsapp) {
      setShowWhatsAppAlert(true);
      return;
    }
    const message = formatWhatsAppMessage(order, order.customer_name);
    window.open(getWhatsAppLink(whatsapp, message), '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-petrol-500 dark:text-petrol-400">Pedido no encontrado</p>
        <button onClick={() => onNavigate('orders')} className="mt-4 text-violet-600 dark:text-violet-400 text-sm font-medium hover:underline">
          Volver a pedidos
        </button>
      </div>
    );
  }

  const balance = Number(order.price) - Number(order.paid_amount);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('orders')} className="p-2 hover:bg-crudo-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-petrol-600 dark:text-petrol-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-petrol-800 dark:text-white">{order.order_number}</h1>
            <StatusBadge status={order.status} />
            <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY_CONFIG[order.priority as Priority]?.bgClass} ${PRIORITY_CONFIG[order.priority as Priority]?.textClass}`}>
              {PRIORITY_CONFIG[order.priority as Priority]?.label}
            </span>
          </div>
          <p className="text-sm text-petrol-500 dark:text-petrol-400 mt-1">
            Creado {new Date(order.created_at).toLocaleDateString('es-AR')}
            {order.article_name && <span className="ml-2 text-violet-600 dark:text-violet-400">- {order.article_name}</span>}
          </p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="px-4 py-2 bg-petrol-600 hover:bg-petrol-700 text-white rounded-lg text-xs font-semibold transition-colors"
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSendWhatsApp}
          className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
        >
          <MessageCircle size={18} /> Enviar WhatsApp
        </button>
        <button
          onClick={() => handleStatusChange('listo_entregar')}
          disabled={order.status === 'listo_entregar'}
          className="px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <CheckCircle2 size={16} /> Marcar listo
        </button>
        <button
          onClick={() => handleStatusChange('entregado')}
          disabled={order.status === 'entregado'}
          className="px-4 py-2.5 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Truck size={16} /> Marcar entregado
        </button>
        <button
          onClick={handleDuplicate}
          className="px-4 py-2.5 bg-white dark:bg-slate-700 hover:bg-crudo-100 dark:hover:bg-slate-600 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Copy size={16} /> Duplicar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Cliente */}
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-3">Cliente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">Nombre</p>
                <p className="text-sm font-medium text-petrol-800 dark:text-white">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">Teléfono</p>
                <a href={`tel:${order.phone}`} className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1">
                  <Phone size={12} /> {order.phone || '-'}
                </a>
              </div>
              <div>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">WhatsApp</p>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">{order.client_whatsapp || order.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">Fecha de entrega</p>
                <p className="text-sm font-medium text-petrol-800 dark:text-white flex items-center gap-1">
                  <Calendar size={12} /> {order.delivery_date || 'Sin definir'}
                </p>
              </div>
            </div>
            <button
              onClick={handleViewCustomerHistory}
              className="mt-4 px-3 py-1.5 bg-white dark:bg-slate-700 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-xs font-medium hover:bg-crudo-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5"
            >
              <User size={12} /> Ver historial del cliente
            </button>
          </div>

          {/* Detalles */}
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-3">Detalles del pedido</h2>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-petrol-500 dark:text-petrol-400 mb-1">Estado</label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value as OrderStatus)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-petrol-500 dark:text-petrol-400 mb-1">Prioridad</label>
                    <select
                      value={editPriority}
                      onChange={e => setEditPriority(e.target.value as Priority)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-petrol-500 dark:text-petrol-400 mb-1">Fecha de entrega</label>
                    <input
                      type="date"
                      value={editDeliveryDate}
                      onChange={e => setEditDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-petrol-500 dark:text-petrol-400 mb-1">Tipo de trabajo</label>
                    <input
                      type="text"
                      value={editWorkType}
                      onChange={e => setEditWorkType(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-petrol-500 dark:text-petrol-400 mb-1">Precio total</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                      step={0.01}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-petrol-500 dark:text-petrol-400 mb-1">Pagado</label>
                    <input
                      type="number"
                      value={editPaid}
                      onChange={e => setEditPaid(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                      step={0.01}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-petrol-500 dark:text-petrol-400 mb-1">Observaciones</label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar cambios
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Artículo / Prenda</p>
                    <p className="text-sm font-medium text-petrol-800 dark:text-white">{order.article_name || order.garment_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Tipo de prenda</p>
                    <p className="text-sm text-petrol-800 dark:text-white">{order.garment_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Talles / Curva</p>
                    <p className="text-sm text-petrol-800 dark:text-white">{order.sizes || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Cantidad</p>
                    <p className="text-sm font-semibold text-petrol-800 dark:text-white">{order.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Tipo de trabajo</p>
                    <p className="text-sm text-violet-600 dark:text-violet-400">{order.work_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Tipo de tela</p>
                    <p className="text-sm text-petrol-800 dark:text-white">{order.fabric_type || '-'}</p>
                  </div>
                </div>
                {order.notes && (
                  <div className="pt-2">
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Observaciones</p>
                    <p className="text-sm text-petrol-800 dark:text-white whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pago */}
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <DollarSign size={14} /> Pago
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">Precio total</p>
                <p className="text-lg font-bold text-petrol-800 dark:text-white">${Number(order.price).toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">Pagado</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${Number(order.paid_amount).toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">Saldo</p>
                <p className={`text-lg font-bold ${balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  ${balance.toLocaleString('es-AR')}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2.5 bg-petrol-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-petrol-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (Number(order.paid_amount) / Math.max(Number(order.price), 1)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-petrol-500 dark:text-petrol-400 mt-1.5 text-right">
                {Math.round((Number(order.paid_amount) / Math.max(Number(order.price), 1)) * 100)}% pagado
              </p>
            </div>
          </div>

          {/* Archivos */}
          {(order.reference_image_url || order.pdf_file_url || order.mold_file_url) && (
            <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
              <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-3">Archivos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {order.reference_image_url && (
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400 mb-1 flex items-center gap-1"><ImageIcon size={12} /> Imagen de referencia</p>
                    <img
                      src={order.reference_image_url}
                      alt="Referencia"
                      className="w-full h-32 object-cover rounded-lg border border-petrol-200 dark:border-slate-600"
                    />
                  </div>
                )}
                {order.pdf_file_url && (
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400 mb-1 flex items-center gap-1"><FileText size={12} /> PDF</p>
                    <a
                      href={order.pdf_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-4 bg-white dark:bg-slate-700 rounded-lg border border-petrol-200 dark:border-slate-600 text-sm text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      <FileText size={20} /> Ver PDF <ExternalLink size={12} />
                    </a>
                  </div>
                )}
                {order.mold_file_url && (
                  <div>
                    <p className="text-xs text-petrol-500 dark:text-petrol-400 mb-1 flex items-center gap-1"><FileText size={12} /> Molde</p>
                    <a
                      href={order.mold_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-4 bg-white dark:bg-slate-700 rounded-lg border border-petrol-200 dark:border-slate-600 text-sm text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      <FileText size={20} /> Ver molde <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* WhatsApp */}
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <MessageCircle size={14} className="text-green-500" /> WhatsApp
            </h2>
            <button
              onClick={handleSendWhatsApp}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <MessageCircle size={18} /> Enviar mensaje al cliente
            </button>
            <p className="text-xs text-petrol-500 dark:text-petrol-400 mt-2 text-center">
              Mensaje automático con detalles del pedido
            </p>
          </div>

          {/* Historial */}
          <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide"
            >
              <span className="flex items-center gap-2"><History size={14} /> Historial</span>
              <span className="text-xs text-petrol-500">{history.length} cambios</span>
            </button>
            {showHistory && (
              <div className="mt-3 pt-3 border-t border-petrol-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-xs text-petrol-400">Sin historial registrado</p>
                ) : (
                  <div className="space-y-3">
                    {history.map(h => (
                      <div key={h.id} className="flex gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-petrol-700 dark:text-petrol-300">{h.action}</p>
                          {h.old_value && (
                            <p className="text-petrol-400 dark:text-petrol-500">
                              {h.old_value} → {h.new_value}
                            </p>
                          )}
                          <p className="text-petrol-400 dark:text-petrol-500 mt-0.5">
                            {new Date(h.created_at).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info rápida */}
          <div className="bg-petrol-800 dark:bg-slate-900 rounded-xl p-5 border border-petrol-700">
            <h3 className="text-xs font-semibold text-petrol-300 uppercase tracking-wide mb-3">Información</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-petrol-400">Pedido</span>
                <span className="text-white font-medium">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-petrol-400">Creado</span>
                <span className="text-white">{new Date(order.created_at).toLocaleDateString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-petrol-400">Entrega</span>
                <span className={order.delivery_date && new Date(order.delivery_date) < new Date() && order.status !== 'entregado' ? 'text-red-400 font-medium' : 'text-white'}>
                  {order.delivery_date || 'Sin definir'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-petrol-400">Prioridad</span>
                <span className="text-violet-400">{PRIORITY_CONFIG[order.priority as Priority]?.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer history modal */}
      {showCustomerHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-petrol-800 dark:text-white">Pedidos de {order.customer_name}</h3>
              <button onClick={() => setShowCustomerHistory(false)} className="text-petrol-400 hover:text-petrol-600">
                <X size={20} />
              </button>
            </div>
            {customerOrders.length === 0 ? (
              <p className="text-sm text-petrol-400">No hay otros pedidos</p>
            ) : (
              <div className="space-y-2">
                {customerOrders.map(co => (
                  <button
                    key={co.id}
                    onClick={() => { setShowCustomerHistory(false); if (co.id !== orderId) onNavigate('order-detail'); }}
                    className="w-full text-left px-3 py-2 bg-white dark:bg-slate-700 rounded-lg text-sm hover:bg-crudo-100 dark:hover:bg-slate-600 border border-petrol-200 dark:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-violet-600 dark:text-violet-400">{co.order_number}</span>
                      <StatusBadge status={co.status} />
                    </div>
                    <div className="text-xs text-petrol-500 dark:text-petrol-400 mt-0.5">
                      {co.article_name || co.garment_type} - ${Number(co.price).toLocaleString('es-AR')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp alert modal */}
      {showWhatsAppAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 p-5">
            <div className="text-center">
              <MessageCircle size={40} className="mx-auto text-amber-500 mb-3" />
              <h3 className="text-lg font-semibold text-petrol-800 dark:text-white mb-2">Sin WhatsApp registrado</h3>
              <p className="text-sm text-petrol-600 dark:text-petrol-400 mb-4">
                Este cliente no tiene un número de WhatsApp registrado. Agregá el número en el cliente o en el pedido para poder enviar mensajes.
              </p>
              <button
                onClick={() => setShowWhatsAppAlert(false)}
                className="px-4 py-2 bg-petrol-600 hover:bg-petrol-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
