import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Client, Employee, FinanceMovement, FinanceMovementStatus, FinanceMovementType, Order } from '../lib/types';
import {
  AlertCircle,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Coins,
  CreditCard,
  DollarSign,
  Edit3,
  FileSpreadsheet,
  Filter,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

type DateFilter = 'day' | 'week' | 'month' | 'custom' | 'all';
type MovementSource = 'manual' | 'order';

type FinanceMovementView = FinanceMovement & {
  source: MovementSource;
  order_number?: string;
  customer_name?: string;
  employee_name?: string;
};

type MovementForm = {
  type: FinanceMovementType;
  amount: string;
  category: string;
  payment_method: string;
  description: string;
  status: FinanceMovementStatus;
  movement_date: string;
  customer_id: string;
  order_id: string;
  employee_id: string;
  related_person: string;
  attachment_url: string;
};

const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia bancaria',
  'Mercado Pago',
  'Binance',
  'PayPal',
  'Criptomonedas',
  'Otro',
];

const INCOME_CATEGORIES = ['Pedidos', 'Ventas directas', 'Señas', 'Servicios', 'Otros'];

const EXPENSE_CATEGORIES = [
  'Sueldos',
  'Adelantos',
  'Materiales',
  'Cartón',
  'Impresión',
  'Moto / envíos',
  'Alquiler',
  'Internet / servicios',
  'Software / herramientas',
  'Comida',
  'Compras varias',
  'Otros',
];


const ORDER_TOTAL_FIELDS = ['total_amount', 'total', 'amount', 'price', 'final_price'];
const ORDER_PAID_FIELDS = ['paid_amount', 'amount_paid', 'paid', 'paid_total', 'collected_amount'];
const ORDER_PENDING_FIELDS = ['remaining_balance', 'balance', 'pending_amount', 'amount_due'];
const ORDER_PAYMENT_STATUS_FIELDS = ['payment_status', 'payment_state', 'paid_status', 'billing_status'];
const ORDER_STATUS_FIELDS = ['status', 'order_status', 'delivery_status'];
const ORDER_PAYMENT_DATE_FIELDS = ['paid_at', 'payment_date', 'collected_at', 'paid_date', 'payment_updated_at'];
const ORDER_FALLBACK_DATE_FIELDS = ['delivery_date', 'created_at', 'updated_at'];
const ORDER_PAYMENT_METHOD_FIELDS = ['payment_method', 'payment_type', 'payment_channel'];
const PAID_STATUS_VALUES = ['paid', 'pagado', 'cobrado', 'collected', 'completed', 'complete', 'settled', 'abonado'];
const PENDING_STATUS_VALUES = ['pending', 'pendiente', 'unpaid', 'partial', 'parcial', 'partially_paid'];
const DELIVERED_STATUS_VALUES = ['entregado', 'delivered', 'entregada', 'finalizado', 'finalizada', 'completed', 'complete'];

const getOrderRecord = (order: Order) => order as unknown as Record<string, unknown>;

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getNumericOrderField = (order: Order, fields: string[]) => {
  const record = getOrderRecord(order);
  for (const field of fields) {
    const rawValue = record[field];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const value = Number(rawValue);
    if (Number.isFinite(value)) return value;
  }
  return 0;
};

const getOptionalNumericOrderField = (order: Order, fields: string[]) => {
  const record = getOrderRecord(order);
  for (const field of fields) {
    const rawValue = record[field];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const value = Number(rawValue);
    if (Number.isFinite(value)) return { field, value: Math.max(0, value) };
  }
  return { field: '', value: null as number | null };
};

const getStringOrderField = (order: Order, fields: string[]) => {
  const record = getOrderRecord(order);
  for (const field of fields) {
    const rawValue = record[field];
    if (typeof rawValue === 'string' && rawValue.trim()) return rawValue.trim();
  }
  return '';
};

const getBooleanOrderField = (order: Order, field: string) => {
  const rawValue = getOrderRecord(order)[field];
  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'string') return ['true', '1', 'yes', 'si', 'sí'].includes(normalizeText(rawValue));
  if (typeof rawValue === 'number') return rawValue === 1;
  return false;
};

const getOrderTotalAmount = (order: Order) => getNumericOrderField(order, ORDER_TOTAL_FIELDS);
const getOrderPaidAmount = (order: Order) => getNumericOrderField(order, ORDER_PAID_FIELDS);
const getOrderPendingInfo = (order: Order) => getOptionalNumericOrderField(order, ORDER_PENDING_FIELDS);
const statusMatches = (status: string, values: string[]) => values.some(value => status === value || status.includes(value));
const getOrderPaymentStatus = (order: Order) => normalizeText(getStringOrderField(order, ORDER_PAYMENT_STATUS_FIELDS));
const getOrderStatus = (order: Order) => normalizeText(getStringOrderField(order, ORDER_STATUS_FIELDS));
const getOrderPaymentMethod = (order: Order) => getStringOrderField(order, ORDER_PAYMENT_METHOD_FIELDS) || 'Sin definir';
const getOrderIncomeDate = (order: Order, paid: boolean) => {
  const dateFields = paid ? [...ORDER_PAYMENT_DATE_FIELDS, ...ORDER_FALLBACK_DATE_FIELDS] : ORDER_FALLBACK_DATE_FIELDS;
  const date = getStringOrderField(order, dateFields);
  return (date || new Date().toISOString()).split('T')[0];
};

const getOrderPaymentEvaluation = (order: Order) => {
  const total = getOrderTotalAmount(order);
  const paidAmount = getOrderPaidAmount(order);
  const pendingInfo = getOrderPendingInfo(order);
  const explicitPending = pendingInfo.value;
  const inferredPending = Math.max(0, total - paidAmount);
  const pendingAmount = explicitPending ?? inferredPending;
  const paymentStatus = getOrderPaymentStatus(order);
  const status = getOrderStatus(order);
  const hasPaidStatus = statusMatches(paymentStatus, PAID_STATUS_VALUES);
  const hasPendingStatus = statusMatches(paymentStatus, PENDING_STATUS_VALUES);
  const delivered = statusMatches(status, DELIVERED_STATUS_VALUES);
  const markedPaid = getBooleanOrderField(order, 'is_paid');
  const hasTotal = total > 0;

  let fullyPaid = false;
  let reason = '';
  let exclusionReason = '';

  if (!hasTotal) {
    exclusionReason = 'sin monto total mayor a 0';
  } else if (explicitPending !== null && explicitPending > 0) {
    exclusionReason = `saldo pendiente explícito mayor a 0 (${pendingInfo.field}: ${explicitPending})`;
  } else if (markedPaid) {
    fullyPaid = true;
    reason = 'is_paid verdadero';
  } else if (hasPaidStatus) {
    fullyPaid = true;
    reason = `payment_status cobrado/pagado (${paymentStatus})`;
  } else if (explicitPending === 0) {
    fullyPaid = true;
    reason = `saldo pendiente explícito en 0 (${pendingInfo.field})`;
  } else if (paidAmount >= total) {
    fullyPaid = true;
    reason = 'paid_amount mayor o igual al total';
  } else if (delivered && !hasPendingStatus) {
    fullyPaid = true;
    reason = 'pedido entregado sin saldo pendiente explícito';
  } else if (hasPendingStatus) {
    exclusionReason = `estado de pago pendiente/parcial (${paymentStatus})`;
  } else {
    exclusionReason = `no cumple reglas de cobro completo (pagado: ${paidAmount}, saldo inferido: ${inferredPending})`;
  }

  return {
    total,
    paidAmount,
    pendingAmount,
    explicitPending,
    pendingField: pendingInfo.field,
    paymentStatus,
    status,
    delivered,
    fullyPaid,
    reason,
    exclusionReason,
    incomeDate: getOrderIncomeDate(order, fullyPaid),
  };
};

const EMPTY_FORM: MovementForm = {
  type: 'income',
  amount: '',
  category: 'Pedidos',
  payment_method: 'Efectivo',
  description: '',
  status: 'collected',
  movement_date: new Date().toISOString().split('T')[0],
  customer_id: '',
  order_id: '',
  employee_id: '',
  related_person: '',
  attachment_url: '',
};

const currency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const getStartOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
};

const toISODate = (date: Date) => date.toISOString().split('T')[0];

const getDefaultDateRange = (filter: DateFilter) => {
  const today = new Date();
  if (filter === 'day') {
    return { start: toISODate(today), end: toISODate(today) };
  }
  if (filter === 'week') {
    const start = getStartOfWeek(today);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }
  if (filter === 'month') {
    return {
      start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
      end: toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  return { start: '', end: '' };
};

export default function Finance() {
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MovementForm>(EMPTY_FORM);
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [dateRange, setDateRange] = useState(getDefaultDateRange('month'));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | FinanceMovementType>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FinanceMovementStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    setLoading(true);
    setError('');
    try {
      const [movementResult, orderResult, clientResult, employeeResult] = await Promise.all([
        supabase.from('finance_movements').select('*').order('movement_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('employees').select('*').order('name', { ascending: true }),
      ]);

      if (movementResult.error) throw movementResult.error;
      if (orderResult.error) throw orderResult.error;
      if (clientResult.error) throw clientResult.error;
      if (employeeResult.error) throw employeeResult.error;

      setMovements(movementResult.data || []);
      setOrders(orderResult.data || []);
      setClients(clientResult.data || []);
      setEmployees(employeeResult.data || []);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar Finanzas. Verificá que la migración finance_movements esté aplicada en Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const orderDerivedMovements = useMemo<FinanceMovementView[]>(() => {
    const manuallyTrackedOrderIds = new Set(
      movements.filter(movement => movement.type === 'income' && movement.order_id).map(movement => movement.order_id)
    );

    const loadedLog = orders.map(order => {
      const evaluation = getOrderPaymentEvaluation(order);
      return {
        pedido: order.order_number,
        cliente: order.customer_name,
        total: evaluation.total,
        pagado: evaluation.paidAmount,
        saldo_explicito: evaluation.explicitPending,
        campo_saldo: evaluation.pendingField || 'sin campo',
        payment_status: evaluation.paymentStatus || 'sin estado de pago',
        status: evaluation.status || 'sin estado',
        fecha_ingreso: evaluation.incomeDate,
      };
    });
    const paidLog: Array<Record<string, string | number | boolean | null>> = [];
    const excludedLog: Array<Record<string, string | number | boolean | null>> = [];
    const generatedMovements: FinanceMovementView[] = [];

    orders.forEach(order => {
      const evaluation = getOrderPaymentEvaluation(order);
      const alreadyManual = manuallyTrackedOrderIds.has(order.id);

      if (alreadyManual) {
        excludedLog.push({
          pedido: order.order_number,
          total: evaluation.total,
          pagado: evaluation.paidAmount,
          saldo: evaluation.pendingAmount,
          motivo: 'ya existe un movimiento manual asociado al order_id',
        });
        return;
      }

      if (evaluation.total <= 0 && evaluation.paidAmount <= 0 && evaluation.pendingAmount <= 0) {
        excludedLog.push({
          pedido: order.order_number,
          total: evaluation.total,
          pagado: evaluation.paidAmount,
          saldo: evaluation.pendingAmount,
          motivo: evaluation.exclusionReason || 'sin monto para generar movimiento',
        });
        return;
      }

      const base = {
        type: 'income' as FinanceMovementType,
        category: 'Pedidos',
        payment_method: getOrderPaymentMethod(order),
        customer_id: order.customer_id,
        order_id: order.id,
        employee_id: null,
        related_person: order.customer_name || '',
        attachment_url: null,
        created_at: order.created_at,
        updated_at: order.updated_at,
        source: 'order' as MovementSource,
        order_number: order.order_number,
        customer_name: order.customer_name,
      };

      if (evaluation.fullyPaid) {
        generatedMovements.push({
          ...base,
          id: `order-collected-${order.id}`,
          amount: evaluation.total,
          description: `Cobrado del pedido ${order.order_number}`,
          status: 'collected',
          movement_date: evaluation.incomeDate,
        });
        paidLog.push({
          pedido: order.order_number,
          total: evaluation.total,
          pagado: evaluation.paidAmount,
          saldo_explicito: evaluation.explicitPending,
          payment_status: evaluation.paymentStatus || 'sin estado de pago',
          status: evaluation.status || 'sin estado',
          fecha_ingreso: evaluation.incomeDate,
          motivo: evaluation.reason,
        });
        return;
      }

      if (evaluation.paidAmount > 0) {
        generatedMovements.push({
          ...base,
          id: `order-collected-${order.id}`,
          amount: evaluation.paidAmount,
          description: `Cobrado parcial del pedido ${order.order_number}`,
          status: 'collected',
          movement_date: evaluation.incomeDate,
        });
      }

      if (evaluation.pendingAmount > 0) {
        generatedMovements.push({
          ...base,
          id: `order-pending-${order.id}`,
          amount: evaluation.pendingAmount,
          description: `Pendiente del pedido ${order.order_number}`,
          status: 'pending',
          movement_date: getOrderIncomeDate(order, false),
        });
      }

      excludedLog.push({
        pedido: order.order_number,
        total: evaluation.total,
        pagado: evaluation.paidAmount,
        saldo: evaluation.pendingAmount,
        saldo_explicito: evaluation.explicitPending,
        payment_status: evaluation.paymentStatus || 'sin estado de pago',
        status: evaluation.status || 'sin estado',
        motivo: evaluation.exclusionReason || 'no detectado como cobrado completo',
      });
    });

    console.groupCollapsed('[Finanzas] Diagnóstico ingresos derivados desde orders');
    console.table(loadedLog);
    console.table(paidLog);
    console.table(excludedLog);
    console.info('[Finanzas] Movimientos derivados generados:', generatedMovements.length, generatedMovements.map(movement => ({
      pedido: movement.order_number,
      estado: movement.status,
      monto: movement.amount,
      fecha: movement.movement_date,
    })));
    console.groupEnd();

    return generatedMovements;
  }, [movements, orders]);

  const allMovements = useMemo<FinanceMovementView[]>(() => {
    const clientById = new Map(clients.map(client => [client.id, client]));
    const orderById = new Map(orders.map(order => [order.id, order]));
    const employeeById = new Map(employees.map(employee => [employee.id, employee]));
    const manualMovements = movements.map(movement => {
      const order = movement.order_id ? orderById.get(movement.order_id) : undefined;
      const client = movement.customer_id ? clientById.get(movement.customer_id) : undefined;
      const employee = movement.employee_id ? employeeById.get(movement.employee_id) : undefined;
      return {
        ...movement,
        amount: Number(movement.amount),
        source: 'manual' as MovementSource,
        order_number: order?.order_number,
        customer_name: client?.business_name || client?.name || order?.customer_name,
        employee_name: employee?.name,
      };
    });

    return [...manualMovements, ...orderDerivedMovements].sort((a, b) => {
      const dateCompare = b.movement_date.localeCompare(a.movement_date);
      return dateCompare !== 0 ? dateCompare : b.created_at.localeCompare(a.created_at);
    });
  }, [clients, employees, movements, orderDerivedMovements, orders]);

  const filteredMovements = useMemo(() => {
    return allMovements.filter(movement => {
      const normalizedSearch = search.trim().toLowerCase();
      const inRange =
        dateFilter === 'all' ||
        ((!dateRange.start || movement.movement_date >= dateRange.start) && (!dateRange.end || movement.movement_date <= dateRange.end));
      const matchesSearch =
        !normalizedSearch ||
        [movement.description, movement.category, movement.related_person || '', movement.order_number || '', movement.customer_name || '', movement.employee_name || '']
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);

      return (
        inRange &&
        matchesSearch &&
        (typeFilter === 'all' || movement.type === typeFilter) &&
        (categoryFilter === 'all' || movement.category === categoryFilter) &&
        (statusFilter === 'all' || movement.status === statusFilter) &&
        (paymentFilter === 'all' || movement.payment_method === paymentFilter)
      );
    });
  }, [allMovements, categoryFilter, dateFilter, dateRange.end, dateRange.start, paymentFilter, search, statusFilter, typeFilter]);

  const summary = useMemo(() => {
    const totalIncome = filteredMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + Number(m.amount), 0);
    const totalExpenses = filteredMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + Number(m.amount), 0);
    const collectedIncome = filteredMovements
      .filter(m => m.type === 'income' && m.status === 'collected')
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const paidExpenses = filteredMovements
      .filter(m => m.type === 'expense' && m.status === 'paid')
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const pendingCollection = filteredMovements
      .filter(m => m.type === 'income' && m.status === 'pending')
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const pendingPayment = filteredMovements
      .filter(m => m.type === 'expense' && m.status === 'pending')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      currentCash: collectedIncome - paidExpenses,
      collectedIncome,
      paidExpenses,
      pendingCollection,
      pendingPayment,
    };
  }, [filteredMovements]);

  const balanceByPaymentMethod = useMemo(() => {
    return filteredMovements
      .filter(m => (m.type === 'income' && m.status === 'collected') || (m.type === 'expense' && m.status === 'paid'))
      .reduce<Record<string, number>>((acc, movement) => {
        const key = movement.payment_method || 'Sin definir';
        acc[key] = (acc[key] || 0) + (movement.type === 'income' ? Number(movement.amount) : -Number(movement.amount));
        return acc;
      }, {});
  }, [filteredMovements]);

  const categories = useMemo(() => {
    const base = typeFilter === 'expense' ? EXPENSE_CATEGORIES : typeFilter === 'income' ? INCOME_CATEGORIES : [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
    return Array.from(new Set([...base, ...allMovements.map(m => m.category).filter(Boolean)])).sort();
  }, [allMovements, typeFilter]);

  const activeOrders = orders.filter(order => order.status !== 'cancelado');

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter !== 'custom') {
      setDateRange(getDefaultDateRange(filter));
    }
  };

  const setFormValue = (field: keyof MovementForm, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'type') {
        next.category = value === 'income' ? 'Pedidos' : 'Otros';
        next.status = value === 'income' ? 'collected' : 'paid';
      }
      if (field === 'order_id') {
        const order = orders.find(item => item.id === value);
        next.customer_id = order?.customer_id || next.customer_id;
        next.related_person = order?.customer_name || next.related_person;
        if (order && !next.description) next.description = `Ingreso por pedido ${order.order_number}`;
      }
      return next;
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
  };

  const startCreate = (type: FinanceMovementType) => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      type,
      category: type === 'income' ? 'Pedidos' : 'Otros',
      status: type === 'income' ? 'collected' : 'paid',
    });
    setFormOpen(true);
  };

  const startEdit = (movement: FinanceMovementView) => {
    if (movement.source === 'order') return;
    setEditingId(movement.id);
    setForm({
      type: movement.type,
      amount: String(movement.amount),
      category: movement.category,
      payment_method: movement.payment_method,
      description: movement.description,
      status: movement.status,
      movement_date: movement.movement_date,
      customer_id: movement.customer_id || '',
      order_id: movement.order_id || '',
      employee_id: movement.employee_id || '',
      related_person: movement.related_person || '',
      attachment_url: movement.attachment_url || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError('Ingresá un monto mayor a cero.');
      setSaving(false);
      return;
    }

    const payload = {
      type: form.type,
      amount,
      category: form.category,
      payment_method: form.payment_method,
      description: form.description,
      status: form.status,
      movement_date: form.movement_date,
      customer_id: form.customer_id || null,
      order_id: form.order_id || null,
      employee_id: form.employee_id || null,
      related_person: form.related_person || null,
      attachment_url: form.attachment_url || null,
    };

    try {
      const request = editingId
        ? supabase.from('finance_movements').update(payload).eq('id', editingId)
        : supabase.from('finance_movements').insert(payload);
      const { error: saveError } = await request;
      if (saveError) throw saveError;
      await loadFinanceData();
      resetForm();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar el movimiento financiero.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMovement = async (movement: FinanceMovementView) => {
    if (movement.source === 'order') return;
    const confirmed = window.confirm('¿Eliminar este movimiento financiero?');
    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase.from('finance_movements').delete().eq('id', movement.id);
      if (deleteError) throw deleteError;
      setMovements(prev => prev.filter(item => item.id !== movement.id));
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar el movimiento.');
    }
  };

  const exportMovementsCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Medio de pago', 'Estado', 'Origen'];
    const rows = filteredMovements.map(movement => [
      movement.movement_date,
      movement.type === 'income' ? 'Ingreso' : 'Egreso',
      movement.category,
      movement.description,
      movement.amount,
      movement.payment_method,
      getStatusLabel(movement.status),
      movement.source === 'order' ? 'Pedido existente' : 'Manual',
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modeltex-finanzas-movimientos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-crudo-100">Finanzas</h1>
          <p className="text-sm text-crudo-400 mt-1">Control de ingresos, egresos, caja y pendientes de Modeltex</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => startCreate('income')}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Nuevo ingreso
          </button>
          <button
            onClick={() => startCreate('expense')}
            className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Nuevo egreso
          </button>
          <button
            onClick={exportMovementsCSV}
            className="px-3 py-2 bg-petrol-700 hover:bg-petrol-600 text-crudo-200 rounded-lg text-xs font-medium border border-petrol-600 transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet size={14} /> CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 rounded-xl p-4 text-sm flex items-start gap-2">
          <AlertCircle size={18} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <section className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide flex items-center gap-2">
            <CalendarRange size={16} /> Resumen financiero
          </h2>
          <div className="flex flex-wrap gap-2">
            {(['day', 'week', 'month', 'all'] as DateFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => handleDateFilterChange(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  dateFilter === filter
                    ? 'bg-violet-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-petrol-700 dark:text-slate-200 border border-petrol-100 dark:border-slate-600'
                }`}
              >
                {filter === 'day' ? 'Día' : filter === 'week' ? 'Semana' : filter === 'month' ? 'Mes' : 'Todo'}
              </button>
            ))}
            <button
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateFilter === 'custom'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white dark:bg-slate-700 text-petrol-700 dark:text-slate-200 border border-petrol-100 dark:border-slate-600'
              }`}
            >
              Rango
            </button>
          </div>
        </div>
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="date"
              value={dateRange.start}
              onChange={event => setDateRange(prev => ({ ...prev, start: event.target.value }))}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-petrol-200 dark:border-slate-700 rounded-lg text-sm text-petrol-800 dark:text-white"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={event => setDateRange(prev => ({ ...prev, end: event.target.value }))}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-petrol-200 dark:border-slate-700 rounded-lg text-sm text-petrol-800 dark:text-white"
            />
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <SummaryCard label="Total ingresos" value={currency(summary.totalIncome)} icon={TrendingUp} color="bg-emerald-600" valueClass="text-emerald-600 dark:text-emerald-400" />
          <SummaryCard label="Total egresos" value={currency(summary.totalExpenses)} icon={TrendingDown} color="bg-rose-600" valueClass="text-rose-600 dark:text-rose-400" />
          <SummaryCard label="Ganancia neta" value={currency(summary.netProfit)} icon={DollarSign} color="bg-violet-500" valueClass={summary.netProfit >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'} />
          <SummaryCard label="Caja actual" value={currency(summary.currentCash)} icon={Wallet} color="bg-petrol-600" valueClass="text-petrol-800 dark:text-white" />
          <SummaryCard label="Pendiente de cobro" value={currency(summary.pendingCollection)} icon={AlertCircle} color="bg-amber-600" valueClass="text-amber-600 dark:text-amber-400" />
          <SummaryCard label="Pendiente de pago" value={currency(summary.pendingPayment)} icon={CreditCard} color="bg-orange-600" valueClass="text-orange-600 dark:text-orange-400" />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide flex items-center gap-2">
            <Wallet size={16} /> Caja
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CashCard label="Saldo actual" value={currency(summary.currentCash)} helper="Ingresos cobrados - egresos pagados" icon={Wallet} />
            <CashCard label="Ingresos cobrados" value={currency(summary.collectedIncome)} helper="Dinero efectivamente entrado" icon={Banknote} />
            <CashCard label="Egresos pagados" value={currency(summary.paidExpenses)} helper="Dinero efectivamente salido" icon={Coins} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-petrol-600 dark:text-petrol-300 mb-2">Saldo por medio de pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(balanceByPaymentMethod).length === 0 ? (
                <p className="text-xs text-petrol-500 dark:text-petrol-400">Todavía no hay movimientos cobrados o pagados.</p>
              ) : (
                Object.entries(balanceByPaymentMethod).map(([method, balance]) => (
                  <div key={method} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-700 rounded-lg border border-petrol-100 dark:border-slate-600 text-sm">
                    <span className="text-petrol-700 dark:text-slate-200">{method}</span>
                    <span className={`font-semibold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{currency(balance)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
          <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-3">Movimientos recientes</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {filteredMovements.slice(0, 8).map(movement => (
              <div key={movement.id} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-700 rounded-lg border border-petrol-100 dark:border-slate-600 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-petrol-800 dark:text-white truncate">{movement.description || movement.category}</p>
                  <p className="text-petrol-500 dark:text-petrol-400">{movement.movement_date} · {movement.payment_method}</p>
                </div>
                <span className={`font-semibold ${movement.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {movement.type === 'income' ? '+' : '-'}{currency(Number(movement.amount))}
                </span>
              </div>
            ))}
            {filteredMovements.length === 0 && <p className="text-xs text-petrol-500 dark:text-petrol-400">No hay movimientos para los filtros actuales.</p>}
          </div>
        </section>
      </div>

      {formOpen && (
        <section className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-violet-300 dark:border-violet-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide">
              {editingId ? 'Editar movimiento' : form.type === 'income' ? 'Nuevo ingreso' : 'Nuevo egreso'}
            </h2>
            <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/70 dark:hover:bg-slate-700 text-petrol-500 dark:text-slate-300">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Field label="Tipo">
              <select value={form.type} onChange={event => setFormValue('type', event.target.value)} className="finance-input">
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" required value={form.movement_date} onChange={event => setFormValue('movement_date', event.target.value)} className="finance-input" />
            </Field>
            <Field label="Monto">
              <input type="number" min="0" step="0.01" required value={form.amount} onChange={event => setFormValue('amount', event.target.value)} className="finance-input" placeholder="0" />
            </Field>
            <Field label="Categoría">
              <select value={form.category} onChange={event => setFormValue('category', event.target.value)} className="finance-input">
                {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(category => <option key={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Medio de pago">
              <select value={form.payment_method} onChange={event => setFormValue('payment_method', event.target.value)} className="finance-input">
                {PAYMENT_METHODS.map(method => <option key={method}>{method}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.status} onChange={event => setFormValue('status', event.target.value)} className="finance-input">
                {form.type === 'income' ? (
                  <>
                    <option value="collected">Cobrado</option>
                    <option value="pending">Pendiente</option>
                  </>
                ) : (
                  <>
                    <option value="paid">Pagado</option>
                    <option value="pending">Pendiente</option>
                  </>
                )}
              </select>
            </Field>
            <Field label="Cliente relacionado">
              <select value={form.customer_id} onChange={event => setFormValue('customer_id', event.target.value)} className="finance-input">
                <option value="">Sin cliente</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.business_name || client.name}</option>)}
              </select>
            </Field>
            <Field label="Pedido relacionado">
              <select value={form.order_id} onChange={event => setFormValue('order_id', event.target.value)} className="finance-input">
                <option value="">Sin pedido</option>
                {activeOrders.map(order => <option key={order.id} value={order.id}>{order.order_number} · {order.customer_name}</option>)}
              </select>
            </Field>
            <Field label={form.type === 'expense' ? 'Empleado relacionado' : 'Empleado relacionado'}>
              <select value={form.employee_id} onChange={event => setFormValue('employee_id', event.target.value)} className="finance-input">
                <option value="">Sin empleado</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </Field>
            <Field label={form.type === 'expense' ? 'Proveedor / persona' : 'Persona relacionada'}>
              <input value={form.related_person} onChange={event => setFormValue('related_person', event.target.value)} className="finance-input" placeholder="Nombre opcional" />
            </Field>
            <Field label="Comprobante (URL)">
              <input value={form.attachment_url} onChange={event => setFormValue('attachment_url', event.target.value)} className="finance-input" placeholder="https://..." />
            </Field>
            <Field label="Descripción">
              <input value={form.description} onChange={event => setFormValue('description', event.target.value)} className="finance-input" placeholder="Detalle del movimiento" />
            </Field>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2 pt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium border border-petrol-200 dark:border-slate-600 text-petrol-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-500 hover:bg-violet-400 disabled:opacity-60 text-white">
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Cargar movimiento'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide flex items-center gap-2">
            <Filter size={16} /> Tabla de movimientos
          </h2>
          <div className="relative w-full lg:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-petrol-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="finance-input pl-9" placeholder="Buscar movimiento..." />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as 'all' | FinanceMovementType)} className="finance-input">
            <option value="all">Todos los tipos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Egresos</option>
          </select>
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="finance-input">
            <option value="all">Todas las categorías</option>
            {categories.map(category => <option key={category}>{category}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | FinanceMovementStatus)} className="finance-input">
            <option value="all">Todos los estados</option>
            <option value="collected">Cobrado</option>
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente</option>
          </select>
          <select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)} className="finance-input">
            <option value="all">Todos los medios</option>
            {[...PAYMENT_METHODS, 'Sin definir'].map(method => <option key={method}>{method}</option>)}
          </select>
          <select value={dateFilter} onChange={event => handleDateFilterChange(event.target.value as DateFilter)} className="finance-input">
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="custom">Rango personalizado</option>
            <option value="all">Todas las fechas</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-petrol-500 dark:text-petrol-400 border-b border-petrol-100 dark:border-slate-700">
                <th className="py-3 pr-3">Fecha</th>
                <th className="py-3 pr-3">Tipo</th>
                <th className="py-3 pr-3">Categoría</th>
                <th className="py-3 pr-3">Descripción</th>
                <th className="py-3 pr-3 text-right">Monto</th>
                <th className="py-3 pr-3">Medio</th>
                <th className="py-3 pr-3">Estado</th>
                <th className="py-3 pr-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map(movement => (
                <tr key={movement.id} className="border-b border-petrol-100 dark:border-slate-700/70 text-petrol-800 dark:text-slate-100">
                  <td className="py-3 pr-3 whitespace-nowrap">{movement.movement_date}</td>
                  <td className="py-3 pr-3"><TypeBadge type={movement.type} /></td>
                  <td className="py-3 pr-3 whitespace-nowrap">{movement.category}</td>
                  <td className="py-3 pr-3 min-w-64">
                    <div className="font-medium">{movement.description || '-'}</div>
                    <div className="text-xs text-petrol-500 dark:text-petrol-400">
                      {movement.source === 'order' ? 'Pedido existente' : 'Manual'}
                      {movement.order_number ? ` · ${movement.order_number}` : ''}
                      {movement.customer_name ? ` · ${movement.customer_name}` : ''}
                      {movement.employee_name ? ` · ${movement.employee_name}` : ''}
                      {movement.related_person && !movement.customer_name ? ` · ${movement.related_person}` : ''}
                    </div>
                  </td>
                  <td className={`py-3 pr-3 text-right font-semibold ${movement.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {movement.type === 'income' ? '+' : '-'}{currency(Number(movement.amount))}
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">{movement.payment_method}</td>
                  <td className="py-3 pr-3"><StatusBadge status={movement.status} /></td>
                  <td className="py-3 pr-3 text-right">
                    {movement.source === 'manual' ? (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(movement)} className="p-1.5 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-600 dark:text-violet-300" title="Editar">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => deleteMovement(movement)} className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-300" title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-petrol-400 dark:text-slate-500">Desde pedido</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMovements.length === 0 && <p className="py-8 text-center text-sm text-petrol-500 dark:text-petrol-400">No hay movimientos para mostrar.</p>}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color, valueClass }: { label: string; value: string; icon: typeof DollarSign; color: string; valueClass: string }) {
  return (
    <div className="bg-white dark:bg-slate-700 rounded-xl p-4 border border-petrol-100 dark:border-slate-600">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${color}`}><Icon size={18} className="text-white" /></div>
        <div className="min-w-0">
          <p className="text-xs text-petrol-500 dark:text-petrol-400">{label}</p>
          <p className={`text-lg font-bold truncate ${valueClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function CashCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Wallet }) {
  return (
    <div className="bg-white dark:bg-slate-700 rounded-xl p-4 border border-petrol-100 dark:border-slate-600">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-violet-500"><Icon size={18} className="text-white" /></div>
        <div>
          <p className="text-xs text-petrol-500 dark:text-petrol-400">{label}</p>
          <p className="text-xl font-bold text-petrol-800 dark:text-white">{value}</p>
          <p className="text-[11px] text-petrol-400 dark:text-slate-400 mt-1">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-medium text-petrol-600 dark:text-petrol-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TypeBadge({ type }: { type: FinanceMovementType }) {
  const isIncome = type === 'income';
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isIncome ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
      {isIncome ? 'Ingreso' : 'Egreso'}
    </span>
  );
}

function StatusBadge({ status }: { status: FinanceMovementStatus }) {
  const config = {
    collected: { label: 'Cobrado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2 },
    paid: { label: 'Pagado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2 },
    pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: AlertCircle },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon size={12} /> {config.label}
    </span>
  );
}

function getStatusLabel(status: FinanceMovementStatus) {
  if (status === 'collected') return 'Cobrado';
  if (status === 'paid') return 'Pagado';
  return 'Pendiente';
}
