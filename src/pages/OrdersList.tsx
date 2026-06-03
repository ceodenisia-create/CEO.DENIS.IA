import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, OrderStatus, Priority } from '../lib/types';
import { STATUS_CONFIG, STATUS_OPTIONS, PRIORITY_CONFIG, PRIORITY_OPTIONS } from '../lib/types';
import { updateOrder, duplicateOrder } from '../lib/orders';
import { formatWhatsAppMessage, getWhatsAppLink } from '../lib/clients';
import { exportToCSV, exportToPDFSimple } from '../lib/exports';
import StatusBadge from '../components/StatusBadge';
import { Search, Filter, Import as SortAsc, Dessert as SortDesc, FileDown, FileSpreadsheet, Copy, CreditCard as Edit3, Check, X, Eye, MessageCircle } from 'lucide-react';

interface OrdersListProps {
  onNavigate: (page: string, orderId?: string) => void;
}

type SortField = 'delivery_date' | 'created_at' | 'price';
type SortDir = 'asc' | 'desc';
type QuickFilter = 'todos' | 'nuevos' | 'en_proceso' | 'listo_entregar' | 'entregados' | 'con_demora' | 'falta_cobrar' | 'urgentes';

type OrderWithOptionalFields = Order & Record<string, unknown>;

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'nuevos', label: 'Nuevos' },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'listo_entregar', label: 'Listo para entregar' },
  { key: 'entregados', label: 'Entregados' },
  { key: 'con_demora', label: 'Con demora' },
  { key: 'falta_cobrar', label: 'Falta cobrar' },
  { key: 'urgentes', label: 'Urgentes' },
];

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const getOrderStatusValue = (order: OrderWithOptionalFields) =>
  normalizeText(order.order_status ?? order.status);

const isDeliveredOrder = (order: OrderWithOptionalFields) =>
  getOrderStatusValue(order) === 'entregado' || getOrderStatusValue(order) === 'delivered';

const isCancelledOrder = (order: OrderWithOptionalFields) =>
  getOrderStatusValue(order) === 'cancelado' || getOrderStatusValue(order) === 'cancelled';

const isOrderOverdue = (order: OrderWithOptionalFields) => {
  if (!order.delivery_date || isDeliveredOrder(order) || isCancelledOrder(order)) return false;
  const today = new Date().toISOString().split('T')[0];
  return String(order.delivery_date) < today;
};

const isDelayedOrder = (order: OrderWithOptionalFields) => {
  const deliveryStatus = normalizeText(order.delivery_status);
  return order.is_delayed === true || deliveryStatus === 'demorado' || deliveryStatus === 'delayed' || isOrderOverdue(order);
};

const getPendingBalance = (order: OrderWithOptionalFields) =>
  Number(order.remaining_balance ?? order.balance ?? order.saldo ?? 0);

const isNewOrder = (order: OrderWithOptionalFields) => {
  const status = getOrderStatusValue(order);
  return ['nuevo', 'pendiente', 'pending', 'por_iniciar', 'sin_iniciar'].includes(status);
};

const isInProcessOrder = (order: OrderWithOptionalFields) => {
  const status = getOrderStatusValue(order);
  return ['en_proceso', 'in_process', 'in_progress', 'in_design', 'in_correction'].includes(status);
};

const isReadyToDeliverOrder = (order: OrderWithOptionalFields) => {
  const status = getOrderStatusValue(order);
  return ['listo_entregar', 'ready', 'ready_to_deliver'].includes(status);
};

const isUrgentOrder = (order: OrderWithOptionalFields) => {
  const priority = normalizeText(order.priority);
  return order.urgent === true || priority === 'urgent' || priority === 'very_urgent';
};

export default function OrdersList({ onNavigate }: OrdersListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>('nuevo');
  const [editPaid, setEditPaid] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (quickFilter !== 'todos') {
      result = result.filter(order => {
        const o = order as OrderWithOptionalFields;
        if (quickFilter === 'nuevos') return isNewOrder(o);
        if (quickFilter === 'en_proceso') return isInProcessOrder(o);
        if (quickFilter === 'listo_entregar') return isReadyToDeliverOrder(o);
        if (quickFilter === 'entregados') return isDeliveredOrder(o);
        if (quickFilter === 'con_demora') return isDelayedOrder(o);
        if (quickFilter === 'falta_cobrar') return getPendingBalance(o) > 0;
        if (quickFilter === 'urgentes') return isUrgentOrder(o);
        return true;
      });
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(s) ||
        o.customer_name.toLowerCase().includes(s) ||
        o.phone.includes(s) ||
        o.garment_type.toLowerCase().includes(s) ||
        (o.article_name || '').toLowerCase().includes(s)
      );
    }

    if (statusFilter) {
      result = result.filter(o => o.status === statusFilter);
    }

    if (priorityFilter) {
      result = result.filter(o => o.priority === priorityFilter);
    }

    result = [...result].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if (sortField === 'delivery_date') {
        aVal = a.delivery_date || '9999-12-31';
        bVal = b.delivery_date || '9999-12-31';
      } else if (sortField === 'created_at') {
        aVal = a.created_at;
        bVal = b.created_at;
      } else {
        aVal = Number(a.price);
        bVal = Number(b.price);
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [orders, quickFilter, search, statusFilter, priorityFilter, sortField, sortDir]);

  const handleQuickEdit = async (orderId: string) => {
    try {
      const updates: Partial<Order> = {};
      if (editStatus) updates.status = editStatus;
      if (editPaid !== '') updates.paid_amount = parseFloat(editPaid) || 0;
      await updateOrder(orderId, updates);
      setEditingId(null);
      loadOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (order: Order) => {
    setEditingId(order.id);
    setEditStatus(order.status);
    setEditPaid(String(order.paid_amount));
  };

  const handleDuplicate = async (orderId: string) => {
    try {
      await duplicateOrder(orderId);
      loadOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleWhatsApp = (order: Order) => {
    const whatsapp = order.client_whatsapp || order.phone;
    if (!whatsapp) return;
    const message = formatWhatsAppMessage(order, order.customer_name);
    window.open(getWhatsAppLink(whatsapp, message), '_blank');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-crudo-100">Pedidos</h1>
          <p className="text-sm text-crudo-400 mt-1">{filteredOrders.length} pedidos encontrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => exportToCSV(filteredOrders)}
            className="px-3 py-2 bg-petrol-700 hover:bg-petrol-600 text-crudo-200 rounded-lg text-xs font-medium border border-petrol-600 transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button
            onClick={() => exportToPDFSimple(filteredOrders)}
            className="px-3 py-2 bg-petrol-700 hover:bg-petrol-600 text-crudo-200 rounded-lg text-xs font-medium border border-petrol-600 transition-colors flex items-center gap-1.5"
          >
            <FileDown size={14} /> PDF
          </button>
          <button
            onClick={() => onNavigate('new-order')}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-violet-500/20"
          >
            + Nuevo Pedido
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700/50 space-y-3">
        <div className="flex flex-wrap gap-2" aria-label="Filtros rápidos de pedidos">
          {QUICK_FILTERS.map(filter => {
            const isActive = quickFilter === filter.key;
            return (
              <button
                key={filter.key}
                onClick={() => setQuickFilter(filter.key)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  isActive
                    ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'bg-white dark:bg-slate-700 border-petrol-200 dark:border-slate-600 text-petrol-600 dark:text-petrol-300 hover:bg-crudo-100 dark:hover:bg-slate-600'
                }`}
                aria-pressed={isActive}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-petrol-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar pedidos, clientes, artículos..."
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
              showFilters || statusFilter || priorityFilter
                ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                : 'bg-white dark:bg-slate-700 border-petrol-200 dark:border-slate-600 text-petrol-600 dark:text-petrol-300 hover:bg-crudo-100 dark:hover:bg-slate-600'
            }`}
          >
            <Filter size={16} /> Filtros
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as OrderStatus | '')}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as Priority | '')}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Todas las prioridades</option>
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
            <div className="col-span-2 flex gap-2">
              {(['delivery_date', 'created_at', 'price'] as SortField[]).map(field => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1 ${
                    sortField === field
                      ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                      : 'bg-white dark:bg-slate-700 border-petrol-200 dark:border-slate-600 text-petrol-600 dark:text-petrol-400'
                  }`}
                >
                  {field === 'delivery_date' ? 'Entrega' : field === 'created_at' ? 'Creado' : 'Precio'}
                  {sortField === field && (sortDir === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-12 border border-petrol-200 dark:border-slate-700/50 text-center">
          <p className="text-petrol-400 dark:text-petrol-500 text-sm">No se encontraron pedidos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => {
            const isEditing = editingId === order.id;
            return (
              <div
                key={order.id}
                className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700/50 hover:shadow-md transition-all duration-150"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Left: order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{order.order_number}</span>
                      <StatusBadge status={order.status} />
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[order.priority as Priority]?.bgClass} ${PRIORITY_CONFIG[order.priority as Priority]?.textClass}`}>
                        {PRIORITY_CONFIG[order.priority as Priority]?.label}
                      </span>
                      {order.delivery_date && new Date(order.delivery_date) < new Date() && !['entregado', 'cancelado'].includes(order.status) && (
                        <span className="text-xs text-red-500 font-medium px-2 py-0.5 bg-red-100 dark:bg-red-900/30 rounded-full">DEMORADO</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-petrol-500 dark:text-petrol-400">
                      <span className="font-medium text-petrol-700 dark:text-crudo-200">{order.customer_name}</span>
                      <span>{order.article_name || order.garment_type}</span>
                      <span>Qty: {order.quantity}</span>
                      <span className="text-violet-600 dark:text-violet-400 font-medium">${Number(order.price).toLocaleString('es-AR')}</span>
                      {Number(order.remaining_balance) > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Saldo: ${Number(order.remaining_balance).toLocaleString('es-AR')}</span>
                      )}
                      {order.delivery_date && <span>Entrega: {order.delivery_date}</span>}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <select
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value as OrderStatus)}
                          className="px-2 py-1.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded text-xs text-petrol-800 dark:text-white"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={editPaid}
                          onChange={e => setEditPaid(e.target.value)}
                          placeholder="Pagado"
                          className="w-20 px-2 py-1.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded text-xs text-petrol-800 dark:text-white"
                          step={0.01}
                        />
                        <button onClick={() => handleQuickEdit(order.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-petrol-400 hover:bg-petrol-50 dark:hover:bg-slate-700 rounded-lg">
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        {(order.client_whatsapp || order.phone) && (
                          <button
                            onClick={() => handleWhatsApp(order)}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => onNavigate('order-detail', order.id)}
                          className="p-2 text-petrol-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => startEdit(order)}
                          className="p-2 text-petrol-400 hover:text-petrol-600 hover:bg-crudo-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edición rápida"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(order.id)}
                          className="p-2 text-petrol-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                          title="Duplicar"
                        >
                          <Copy size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
