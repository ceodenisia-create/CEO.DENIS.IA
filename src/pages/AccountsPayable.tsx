import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Search, Trash2, X, Save, Loader2,
  AlertCircle, CheckCircle2, Clock, CreditCard, History,
} from 'lucide-react';
import {
  getPayables, createPayable, updatePayable, deletePayable,
  getPayablePayments, addPayablePayment,
  computePayableSummary,
  PAYABLE_STATUS_CONFIG, PAYABLE_CATEGORY_CONFIG,
  type AccountsPayable, type AccountsPayablePayment, type PayableStatus, type PayableCategory,
} from '../lib/debts';

const currency = (v: number) =>
  v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const todayStr = () => new Date().toISOString().split('T')[0];

const isOverdue = (item: AccountsPayable) =>
  item.status !== 'paid' && !!item.due_date && item.due_date < todayStr();

type FilterStatus = PayableStatus | '';

const PAYMENT_METHODS = ['Efectivo', 'Transferencia bancaria', 'Mercado Pago', 'Otro'];

interface DebtForm {
  creditor_name: string;
  amount: string;
  description: string;
  category: PayableCategory;
  origin_date: string;
  due_date: string;
  status: PayableStatus;
  notes: string;
}

const EMPTY_FORM: DebtForm = {
  creditor_name: '',
  amount: '',
  description: '',
  category: 'supplier',
  origin_date: todayStr(),
  due_date: '',
  status: 'pending',
  notes: '',
};

interface PaymentForm {
  amount: string;
  payment_date: string;
  payment_method: string;
  notes: string;
}

const EMPTY_PAYMENT: PaymentForm = {
  amount: '',
  payment_date: todayStr(),
  payment_method: 'Efectivo',
  notes: '',
};

export default function AccountsPayable() {
  const [items, setItems]             = useState<AccountsPayable[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('');

  // Debt modal
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [editing, setEditing]         = useState<AccountsPayable | null>(null);
  const [form, setForm]               = useState<DebtForm>(EMPTY_FORM);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<AccountsPayable | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(EMPTY_PAYMENT);
  const [payingSaving, setPayingSaving] = useState(false);

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<AccountsPayable | null>(null);
  const [history, setHistory]         = useState<AccountsPayablePayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setItems(await getPayables()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const summary = useMemo(() => computePayableSummary(items), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i => {
      const matchSearch = !q || i.creditor_name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
      const matchStatus = !filterStatus || i.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [items, search, filterStatus]);

  // ── Debt CRUD ──────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDebtModal(true);
  };

  const openEdit = (item: AccountsPayable) => {
    setEditing(item);
    setForm({
      creditor_name: item.creditor_name,
      amount: String(item.amount),
      description: item.description,
      category: item.category,
      origin_date: item.origin_date,
      due_date: item.due_date || '',
      status: item.status,
      notes: item.notes || '',
    });
    setShowDebtModal(true);
  };

  const handleSave = async () => {
    if (!form.creditor_name.trim() || !form.amount) return;
    setSaving(true);
    try {
      const payload = {
        creditor_name: form.creditor_name.trim(),
        amount: Number(form.amount),
        paid_amount: editing?.paid_amount ?? 0,
        description: form.description.trim(),
        category: form.category,
        origin_date: form.origin_date,
        due_date: form.due_date || null,
        status: form.status,
        notes: form.notes.trim(),
      };
      if (editing) { await updatePayable(editing.id, payload); }
      else         { await createPayable(payload); }
      setShowDebtModal(false);
      await load();
    } catch (e) { console.error(e); alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta a pagar?')) return;
    try { await deletePayable(id); await load(); }
    catch { alert('Error al eliminar'); }
  };

  // ── Payment modal ──────────────────────────────────────────────────────────

  const openPaymentModal = (item: AccountsPayable) => {
    setPaymentTarget(item);
    setPaymentForm(EMPTY_PAYMENT);
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!paymentTarget || !paymentForm.amount || Number(paymentForm.amount) <= 0) return;
    setPayingSaving(true);
    try {
      await addPayablePayment(
        paymentTarget.id,
        Number(paymentForm.amount),
        paymentForm.payment_date,
        `${paymentForm.payment_method}${paymentForm.notes ? ' · ' + paymentForm.notes : ''}`,
        paymentTarget.paid_amount,
        paymentTarget.amount,
      );
      setShowPaymentModal(false);
      await load();
      if (historyTarget?.id === paymentTarget.id) {
        const p = await getPayablePayments(paymentTarget.id);
        setHistory(p);
      }
    } catch (e) { console.error(e); alert('Error al registrar pago'); }
    finally { setPayingSaving(false); }
  };

  // ── History modal ──────────────────────────────────────────────────────────

  const openHistory = async (item: AccountsPayable) => {
    setHistoryTarget(item);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try { setHistory(await getPayablePayments(item.id)); }
    catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#8B1A1A' }} />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-crudo-100">Cuentas a Pagar</h2>
          <p className="text-xs text-crudo-400 mt-0.5">Lo que Modeltex debe a terceros</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 text-white"
          style={{ backgroundColor: '#8B1A1A' }}
        >
          <Plus size={15} /> Nueva deuda
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Pendiente de pago" value={currency(summary.pending)}  icon={Clock}        colorClass="bg-amber-600"   valueClass="text-amber-500" />
        <SummaryCard label="Vencido"            value={currency(summary.overdue)}  icon={AlertCircle}  colorClass="bg-red-700"     valueClass="text-red-500" />
        <SummaryCard label="Saldado"            value={currency(summary.paid)}     icon={CheckCircle2} colorClass="bg-emerald-600" valueClass="text-emerald-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-petrol-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="partial">Pago parcial</option>
          <option value="paid">Saldado</option>
          <option value="overdue">Vencido</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-petrol-400 text-sm">No hay registros para mostrar.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-petrol-500 dark:text-petrol-400 border-b border-petrol-100 dark:border-slate-700 bg-petrol-50 dark:bg-slate-900/30">
                <th className="py-3 px-4">Acreedor</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Pagado</th>
                <th className="py-3 px-4 text-right">Pendiente</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const overdue  = isOverdue(item);
                const pending  = Number(item.amount) - Number(item.paid_amount);
                const effStatus: PayableStatus = overdue && item.status !== 'paid' ? 'overdue' : item.status;
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-petrol-100 dark:border-slate-700/70 transition-colors ${
                      overdue ? 'bg-red-50/40 dark:bg-red-900/10' : 'hover:bg-white/50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-crudo-100">{item.creditor_name}</div>
                      <div className="text-xs text-petrol-400 truncate max-w-48">{item.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-1 rounded bg-slate-700 text-petrol-300">
                        {PAYABLE_CATEGORY_CONFIG[item.category]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-crudo-200">{currency(Number(item.amount))}</td>
                    <td className="py-3 px-4 text-right text-emerald-500">{currency(Number(item.paid_amount))}</td>
                    <td className={`py-3 px-4 text-right font-bold ${overdue ? 'text-red-500' : pending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {currency(pending)}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {item.due_date
                        ? <span className={overdue ? 'text-red-500 font-semibold' : 'text-crudo-300'}>{item.due_date}</span>
                        : <span className="text-petrol-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <StatusPill status={effStatus} config={PAYABLE_STATUS_CONFIG} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1">
                        {item.status !== 'paid' && (
                          <button
                            onClick={() => openPaymentModal(item)}
                            className="px-2 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                            style={{ backgroundColor: '#8B1A1A' }}
                            title="Registrar pago"
                          >
                            <Plus size={13} /> Pago
                          </button>
                        )}
                        <button
                          onClick={() => openHistory(item)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-petrol-400 hover:text-crudo-200"
                          title="Ver historial"
                        >
                          <History size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-violet-900/30 text-violet-400"
                          title="Editar"
                        >
                          <CreditCard size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg hover:bg-red-900/30 text-red-500"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── DEBT MODAL ────────────────────────────────────────────────────────── */}
      {showDebtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-crudo-100">
                {editing ? 'Editar cuenta a pagar' : 'Nueva cuenta a pagar'}
              </h3>
              <button onClick={() => setShowDebtModal(false)} className="text-petrol-400 hover:text-crudo-200"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <FormField label="Nombre del acreedor *">
                <input
                  value={form.creditor_name}
                  onChange={e => setForm(f => ({ ...f, creditor_name: e.target.value }))}
                  className="finance-input"
                  placeholder="Proveedor, persona o empresa"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Monto total *">
                  <input
                    type="number" min="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="finance-input"
                    placeholder="0"
                  />
                </FormField>
                <FormField label="Categoría">
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as PayableCategory }))} className="finance-input">
                    <option value="supplier">Proveedor</option>
                    <option value="loan">Préstamo</option>
                    <option value="service">Servicio</option>
                    <option value="other">Otro</option>
                  </select>
                </FormField>
                <FormField label="Estado">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PayableStatus }))} className="finance-input">
                    <option value="pending">Pendiente</option>
                    <option value="partial">Pago parcial</option>
                    <option value="paid">Saldado</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </FormField>
                <FormField label="Fecha de origen">
                  <input type="date" value={form.origin_date} onChange={e => setForm(f => ({ ...f, origin_date: e.target.value }))} className="finance-input" />
                </FormField>
                <FormField label="Fecha de vencimiento">
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="finance-input" />
                </FormField>
              </div>
              <FormField label="Motivo / descripción">
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="finance-input"
                  placeholder="Descripción de la deuda"
                />
              </FormField>
              <FormField label="Notas adicionales">
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="finance-input resize-none"
                />
              </FormField>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
              <button onClick={() => setShowDebtModal(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-600 text-petrol-300">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.creditor_name.trim() || !form.amount}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-1.5"
                style={{ backgroundColor: '#8B1A1A' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ─────────────────────────────────────────────────────── */}
      {showPaymentModal && paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-crudo-100">Registrar Pago</h3>
                <p className="text-xs text-petrol-400 mt-0.5">{paymentTarget.creditor_name}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-petrol-400 hover:text-crudo-200"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-slate-700/50 rounded-lg px-4 py-3 flex justify-between text-sm">
                <span className="text-petrol-400">Saldo pendiente</span>
                <span className="font-bold text-amber-400">
                  {currency(Number(paymentTarget.amount) - Number(paymentTarget.paid_amount))}
                </span>
              </div>
              <FormField label="Fecha *">
                <input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} className="finance-input" />
              </FormField>
              <FormField label="Monto pagado *">
                <input type="number" min="1" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} className="finance-input" placeholder="0" />
              </FormField>
              <FormField label="Método de pago">
                <select value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))} className="finance-input">
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </FormField>
              <FormField label="Nota">
                <input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} className="finance-input" placeholder="Opcional" />
              </FormField>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-600 text-petrol-300">Cancelar</button>
              <button
                onClick={handleSavePayment}
                disabled={payingSaving || !paymentForm.amount || Number(paymentForm.amount) <= 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-1.5"
                style={{ backgroundColor: '#8B1A1A' }}
              >
                {payingSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {payingSaving ? 'Guardando...' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY MODAL ─────────────────────────────────────────────────────── */}
      {showHistoryModal && historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-crudo-100">Historial de pagos</h3>
                <p className="text-xs text-petrol-400 mt-0.5">{historyTarget.creditor_name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-petrol-400 hover:text-crudo-200"><X size={20} /></button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-petrol-400">Total deuda</p>
                  <p className="font-bold text-crudo-100 text-sm">{currency(Number(historyTarget.amount))}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-petrol-400">Pagado</p>
                  <p className="font-bold text-emerald-400 text-sm">{currency(Number(historyTarget.paid_amount))}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-petrol-400">Pendiente</p>
                  <p className="font-bold text-amber-400 text-sm">{currency(Number(historyTarget.amount) - Number(historyTarget.paid_amount))}</p>
                </div>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-petrol-400" /></div>
              ) : history.length === 0 ? (
                <p className="text-center text-petrol-400 text-sm py-6">Sin pagos registrados.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-2.5 text-sm">
                      <div>
                        <span className="text-crudo-200 font-medium">{p.payment_date}</span>
                        {p.notes && <span className="text-petrol-400 text-xs ml-2">· {p.notes}</span>}
                      </div>
                      <span className="font-bold text-emerald-400">{currency(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-between items-center">
              {historyTarget.status !== 'paid' && (
                <button
                  onClick={() => { setShowHistoryModal(false); openPaymentModal(historyTarget); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5"
                  style={{ backgroundColor: '#8B1A1A' }}
                >
                  <Plus size={14} /> Nuevo pago
                </button>
              )}
              <button onClick={() => setShowHistoryModal(false)} className="ml-auto px-4 py-2 rounded-lg text-sm border border-slate-600 text-petrol-300">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, colorClass, valueClass }: {
  label: string; value: string; icon: typeof Clock; colorClass: string; valueClass: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-700 rounded-xl p-4 border border-petrol-100 dark:border-slate-600">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colorClass}`}><Icon size={18} className="text-white" /></div>
        <div>
          <p className="text-xs text-petrol-500 dark:text-petrol-400">{label}</p>
          <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, config }: { status: string; config: Record<string, { label: string; bg: string; text: string }> }) {
  const c = config[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
  return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-petrol-400">
      <span>{label}</span>
      {children}
    </label>
  );
}
