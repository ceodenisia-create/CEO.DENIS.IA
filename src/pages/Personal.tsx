import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildAttendancePayload,
  calculateAmount,
  calculateMinutes,
  calculateMonthlySummary,
  deleteAttendance,
  deleteEmployee,
  deletePayment,
  formatCurrency,
  formatMinutes,
  getEmployeeAttendance,
  getEmployeePayments,
  getEmployees,
  getPersonalStats,
  getTodayAttendance,
  registerAttendanceTime,
  upsertAttendance,
  createEmployee,
  createPayment,
  updateAttendance,
  updateEmployee,
  type AttendanceField,
} from '../lib/personal';
import type { Employee, EmployeeAttendance, EmployeePayment, EmployeePaymentMethod, EmployeeStatus, PaymentType } from '../lib/types';
import {
  EMPLOYEE_STATUS_CONFIG,
  EMPLOYEE_STATUS_OPTIONS,
  PAYMENT_METHOD_CONFIG,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_CONFIG,
  PAYMENT_TYPE_OPTIONS,
} from '../lib/types';
import { Users, Plus, CreditCard as Edit3, Trash2, Clock, DollarSign, X, Save, Loader2, LogIn, LogOut, TrendingUp, TrendingDown, CalendarDays } from 'lucide-react';

const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_MONTH = TODAY.slice(0, 7);
const ANA_HOURLY_RATE = 5072.46;
const ANA_MONTHLY_GOAL_LABEL = '$700.000';

type PersonalStats = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalSalaries: number;
  totalPaid: number;
  totalPending: number;
};

type AttendanceForm = {
  work_date: string;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
  notes: string;
};

const emptyAttendanceForm = (workDate = TODAY): AttendanceForm => ({
  work_date: workDate,
  morning_start: '',
  morning_end: '',
  afternoon_start: '',
  afternoon_end: '',
  notes: '',
});

function isAna(employee: Employee) {
  return ['ANA', 'ANABEL'].some(name => employee.name?.toUpperCase().includes(name));
}

function getEmployeeRate(employee: Employee | null) {
  if (!employee) return 0;
  return Number(employee.hourly_rate) || (isAna(employee) ? ANA_HOURLY_RATE : 0);
}

function getEmployeeCompensationSummary(employee: Employee) {
  if (isAna(employee)) return `Objetivo mensual: ${ANA_MONTHLY_GOAL_LABEL}`;
  if (employee.payment_type === 'por_hora') return 'Pago variable';
  return `Mensual: ${formatCurrency(Number(employee.monthly_salary))}`;
}

function toTimeInput(value?: string | null) {
  return value ? value.slice(0, 5) : '';
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
}

export default function Personal() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<EmployeeAttendance | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<EmployeeAttendance[]>([]);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<EmployeeAttendance | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    phone: '',
    position: '',
    start_date: TODAY,
    monthly_salary: 0,
    hourly_rate: 0,
    payment_type: 'mensual' as PaymentType,
    status: 'active' as EmployeeStatus,
  });

  const [todayForm, setTodayForm] = useState<AttendanceForm>(emptyAttendanceForm());
  const [attendanceForm, setAttendanceForm] = useState<AttendanceForm>(emptyAttendanceForm());
  const [paymentForm, setPaymentForm] = useState({
    payment_date: TODAY,
    amount: 0,
    payment_method: 'efectivo' as EmployeePaymentMethod,
    notes: '',
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      refreshEmployeeDetail(selectedEmployee, selectedMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  useEffect(() => {
    setTodayForm(attendanceToForm(attendance, TODAY));
  }, [attendance]);

  const loadData = async () => {
    try {
      const [employeesData, statsData] = await Promise.all([
        getEmployees(),
        getPersonalStats(),
      ]);
      const normalizedEmployees = employeesData.map(employee => {
        if (isAna(employee) && (!employee.hourly_rate || employee.payment_type !== 'por_hora')) {
          return { ...employee, hourly_rate: Number(employee.hourly_rate) || ANA_HOURLY_RATE, payment_type: 'por_hora' as PaymentType, position: employee.position || 'ASISTENTE' };
        }
        return employee;
      });
      setEmployees(normalizedEmployees);
      setStats(statsData);
      if (selectedEmployee) {
        const refreshed = normalizedEmployees.find(employee => employee.id === selectedEmployee.id);
        if (refreshed) setSelectedEmployee(refreshed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const attendanceToForm = (item: EmployeeAttendance | null, workDate = TODAY): AttendanceForm => ({
    work_date: item?.work_date || item?.date || workDate,
    morning_start: toTimeInput(item?.morning_start),
    morning_end: toTimeInput(item?.morning_end),
    afternoon_start: toTimeInput(item?.afternoon_start),
    afternoon_end: toTimeInput(item?.afternoon_end),
    notes: item?.notes || '',
  });

  const refreshEmployeeDetail = async (employee = selectedEmployee, month = selectedMonth) => {
    if (!employee) return;
    try {
      const [todayAtt, employeeAttendance, employeePayments] = await Promise.all([
        getTodayAttendance(employee.id),
        getEmployeeAttendance(employee.id, month),
        getEmployeePayments(employee.id, month),
      ]);
      setAttendance(todayAtt);
      setAttendanceHistory(employeeAttendance);
      setPayments(employeePayments);
    } catch (err) {
      console.error(err);
    }
  };

  const selectEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee);
    await refreshEmployeeDetail(employee, selectedMonth);
  };

  const openNewEmployee = () => {
    setEditingEmployee(null);
    setEmployeeForm({
      name: '',
      phone: '',
      position: '',
      start_date: TODAY,
      monthly_salary: 0,
      hourly_rate: 0,
      payment_type: 'mensual',
      status: 'active',
    });
    setShowEmployeeModal(true);
  };

  const openEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name,
      phone: employee.phone || '',
      position: employee.position || '',
      start_date: employee.start_date || TODAY,
      monthly_salary: Number(employee.monthly_salary) || 0,
      hourly_rate: getEmployeeRate(employee),
      payment_type: employee.payment_type || (isAna(employee) ? 'por_hora' : 'mensual'),
      status: employee.status as EmployeeStatus,
    });
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...employeeForm,
        position: employeeForm.position || (employeeForm.name.toUpperCase().includes('ANA') ? 'ASISTENTE' : ''),
        hourly_rate: Number(employeeForm.hourly_rate) || 0,
        monthly_salary: Number(employeeForm.monthly_salary) || 0,
      };
      const saved = editingEmployee
        ? await updateEmployee(editingEmployee.id, payload)
        : await createEmployee(payload);
      setShowEmployeeModal(false);
      await loadData();
      if (selectedEmployee?.id === saved.id || editingEmployee?.id === saved.id) {
        setSelectedEmployee(saved);
        await refreshEmployeeDetail(saved, selectedMonth);
      }
    } catch (err) {
      console.error(err);
      alert('Error al guardar empleado');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteEmployee(id);
      setDeleteConfirm(null);
      setSelectedEmployee(null);
      setAttendance(null);
      setAttendanceHistory([]);
      setPayments([]);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar empleado');
    }
  };

  const saveTodayAttendance = async (form = todayForm) => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      const saved = await upsertAttendance({
        employee_id: selectedEmployee.id,
        work_date: TODAY,
        morning_start: form.morning_start || null,
        morning_end: form.morning_end || null,
        afternoon_start: form.afternoon_start || null,
        afternoon_end: form.afternoon_end || null,
        hourly_rate: getEmployeeRate(selectedEmployee),
        notes: form.notes || null,
      });
      setAttendance(saved);
      await refreshEmployeeDetail(selectedEmployee, selectedMonth);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar asistencia');
    } finally {
      setSaving(false);
    }
  };

  const markTime = async (field: AttendanceField) => {
    if (!selectedEmployee) return;
    try {
      const saved = await registerAttendanceTime(selectedEmployee, field);
      setAttendance(saved);
      setTodayForm(attendanceToForm(saved, TODAY));
      await refreshEmployeeDetail(selectedEmployee, selectedMonth);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al registrar horario');
    }
  };

  const openAttendanceModal = (item?: EmployeeAttendance) => {
    setEditingAttendance(item || null);
    setAttendanceForm(item ? attendanceToForm(item) : emptyAttendanceForm(TODAY));
    setShowAttendanceModal(true);
  };

  const handleSaveAttendance = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      if (editingAttendance) {
        await updateAttendance(editingAttendance.id, {
          employee_id: selectedEmployee.id,
          work_date: attendanceForm.work_date,
          morning_start: attendanceForm.morning_start || null,
          morning_end: attendanceForm.morning_end || null,
          afternoon_start: attendanceForm.afternoon_start || null,
          afternoon_end: attendanceForm.afternoon_end || null,
          hourly_rate: Number(editingAttendance.hourly_rate) || getEmployeeRate(selectedEmployee),
          notes: attendanceForm.notes || null,
        });
      } else {
        await upsertAttendance({
          employee_id: selectedEmployee.id,
          work_date: attendanceForm.work_date,
          morning_start: attendanceForm.morning_start || null,
          morning_end: attendanceForm.morning_end || null,
          afternoon_start: attendanceForm.afternoon_start || null,
          afternoon_end: attendanceForm.afternoon_end || null,
          hourly_rate: getEmployeeRate(selectedEmployee),
          notes: attendanceForm.notes || null,
        });
      }
      setShowAttendanceModal(false);
      await refreshEmployeeDetail(selectedEmployee, selectedMonth);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar asistencia');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!selectedEmployee || !confirm('¿Eliminar este registro de asistencia?')) return;
    try {
      await deleteAttendance(id);
      await refreshEmployeeDetail(selectedEmployee, selectedMonth);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar asistencia');
    }
  };

  const openPaymentModal = () => {
    setPaymentForm({ payment_date: TODAY, amount: 0, payment_method: 'efectivo', notes: '' });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!selectedEmployee || paymentForm.amount <= 0) return;
    setSaving(true);
    try {
      await createPayment({
        employee_id: selectedEmployee.id,
        payment_date: paymentForm.payment_date,
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes,
      });
      setShowPaymentModal(false);
      await refreshEmployeeDetail(selectedEmployee, selectedMonth);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al registrar pago');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!selectedEmployee) return;
    try {
      await deletePayment(id);
      await refreshEmployeeDetail(selectedEmployee, selectedMonth);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar pago');
    }
  };

  const currentRate = getEmployeeRate(selectedEmployee);
  const todayPreview = buildAttendancePayload({
    employee_id: selectedEmployee?.id || '',
    work_date: TODAY,
    morning_start: todayForm.morning_start || null,
    morning_end: todayForm.morning_end || null,
    afternoon_start: todayForm.afternoon_start || null,
    afternoon_end: todayForm.afternoon_end || null,
    hourly_rate: currentRate,
    notes: todayForm.notes || null,
  });

  const monthlySummary = useMemo(() => calculateMonthlySummary(attendanceHistory, payments), [attendanceHistory, payments]);
  const generatedForEmployee = selectedEmployee?.payment_type === 'mensual'
    ? Number(selectedEmployee.monthly_salary) || 0
    : monthlySummary.totalAmount;
  const totalPaid = monthlySummary.totalPaid;
  const pending = Math.max(0, generatedForEmployee - totalPaid);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-crudo-100">Personal</h1>
          <p className="text-sm text-crudo-400 mt-1">{employees.length} empleados registrados</p>
        </div>
        <button onClick={openNewEmployee} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
          <Plus size={18} /> Nuevo Empleado
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total empleados" value={stats.totalEmployees} />
          <StatCard label="Activos" value={stats.activeEmployees} valueClass="text-emerald-600" />
          <StatCard label="Inactivos" value={stats.inactiveEmployees} valueClass="text-gray-500" />
          <StatCard label="Generado mes" value={formatCurrency(stats.totalSalaries)} />
          <StatCard label="Pagado" value={formatCurrency(stats.totalPaid)} valueClass="text-emerald-600" icon={<TrendingUp size={12} />} />
          <StatCard label="Pendiente" value={formatCurrency(stats.totalPending)} valueClass="text-amber-600" icon={<TrendingDown size={12} />} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-petrol-100 dark:bg-slate-700/50 border-b border-petrol-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300">Empleados</h2>
          </div>
          <div className="divide-y divide-petrol-100 dark:divide-slate-700 max-h-[620px] overflow-y-auto">
            {employees.length === 0 ? (
              <div className="p-6 text-center text-petrol-400 text-sm">
                <Users size={24} className="mx-auto mb-2 opacity-50" />
                Sin empleados
              </div>
            ) : (
              employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => selectEmployee(emp)}
                  className={`w-full text-left p-3 hover:bg-white dark:hover:bg-slate-700 transition-colors ${
                    selectedEmployee?.id === emp.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-petrol-800 dark:text-white text-sm">{emp.name}</p>
                      <p className="text-xs text-petrol-500">{emp.position || 'Sin rol'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${EMPLOYEE_STATUS_CONFIG[emp.status as EmployeeStatus]?.bgClass} ${EMPLOYEE_STATUS_CONFIG[emp.status as EmployeeStatus]?.textClass}`}>
                      {EMPLOYEE_STATUS_CONFIG[emp.status as EmployeeStatus]?.label}
                    </span>
                  </div>
                  <p className="text-xs text-petrol-400 mt-1">
                    {getEmployeeCompensationSummary(emp)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {!selectedEmployee ? (
            <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-8 border border-petrol-200 dark:border-slate-700 text-center">
              <Users size={40} className="mx-auto text-petrol-300 mb-3" />
              <p className="text-petrol-500 text-sm">Seleccioná un empleado</p>
            </div>
          ) : (
            <>
              <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-petrol-800 dark:text-white">{selectedEmployee.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-petrol-100 dark:bg-petrol-800 rounded text-petrol-600 dark:text-petrol-300">
                        {selectedEmployee.position || 'Sin rol'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${PAYMENT_TYPE_CONFIG[selectedEmployee.payment_type || 'mensual'].color}`}>
                        {isAna(selectedEmployee) ? 'Objetivo mensual' : PAYMENT_TYPE_CONFIG[selectedEmployee.payment_type || 'mensual'].label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${EMPLOYEE_STATUS_CONFIG[selectedEmployee.status as EmployeeStatus]?.bgClass} ${EMPLOYEE_STATUS_CONFIG[selectedEmployee.status as EmployeeStatus]?.textClass}`}>
                        {EMPLOYEE_STATUS_CONFIG[selectedEmployee.status as EmployeeStatus]?.label}
                      </span>
                    </div>
                    {selectedEmployee.phone && <p className="text-sm text-petrol-500 mt-1">{selectedEmployee.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-petrol-500 flex items-center gap-2">
                      <CalendarDays size={14} /> Mes
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm"
                      />
                    </label>
                    <button onClick={() => openEditEmployee(selectedEmployee)} className="p-2 text-petrol-500 hover:bg-petrol-100 dark:hover:bg-slate-700 rounded-lg">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => setDeleteConfirm(selectedEmployee.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-petrol-100 dark:border-slate-700">
                  {isAna(selectedEmployee) && <SummaryCard label="Objetivo mensual" value={ANA_MONTHLY_GOAL_LABEL} />}
                  <SummaryCard label={`Horas ${monthLabel(selectedMonth)}`} value={formatMinutes(monthlySummary.totalMinutes)} />
                  <SummaryCard label="Sueldo generado" value={formatCurrency(generatedForEmployee)} />
                  <SummaryCard label="Pagado este mes" value={formatCurrency(totalPaid)} valueClass="text-emerald-600" />
                  <SummaryCard label="Pendiente" value={formatCurrency(pending)} valueClass="text-amber-600" />
                </div>
              </div>

              <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 flex items-center gap-2">
                    <Clock size={16} /> Asistencia de hoy
                  </h4>
                  <button onClick={() => saveTodayAttendance()} disabled={saving} className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar manual
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ShiftInput label="Entrada mañana" value={todayForm.morning_start} onChange={value => setTodayForm(f => ({ ...f, morning_start: value }))} onMark={() => markTime('morning_start')} buttonLabel="Mañana entrada" icon={<LogIn size={14} />} />
                  <ShiftInput label="Salida mañana" value={todayForm.morning_end} onChange={value => setTodayForm(f => ({ ...f, morning_end: value }))} onMark={() => markTime('morning_end')} buttonLabel="Mañana salida" icon={<LogOut size={14} />} />
                  <ShiftInput label="Entrada tarde" value={todayForm.afternoon_start} onChange={value => setTodayForm(f => ({ ...f, afternoon_start: value }))} onMark={() => markTime('afternoon_start')} buttonLabel="Tarde entrada" icon={<LogIn size={14} />} />
                  <ShiftInput label="Salida tarde" value={todayForm.afternoon_end} onChange={value => setTodayForm(f => ({ ...f, afternoon_end: value }))} onMark={() => markTime('afternoon_end')} buttonLabel="Tarde salida" icon={<LogOut size={14} />} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <SummaryCard label="Horas mañana" value={formatMinutes(todayPreview.morning_minutes)} />
                  <SummaryCard label="Horas tarde" value={formatMinutes(todayPreview.afternoon_minutes)} />
                  <SummaryCard label="Total día" value={formatMinutes(todayPreview.total_minutes)} />
                  <SummaryCard label="Monto día" value={formatCurrency(todayPreview.total_amount)} valueClass="text-emerald-600" />
                </div>
              </div>

              <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 bg-petrol-100 dark:bg-slate-700/50 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 flex items-center gap-2">
                    <Clock size={16} /> Historial de asistencia
                  </h4>
                  <button onClick={() => openAttendanceModal()} className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                    <Plus size={14} /> Día
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs text-petrol-500 bg-white/60 dark:bg-slate-900/30">
                      <tr>
                        {['Fecha', 'Entrada mañana', 'Salida mañana', 'Horas mañana', 'Entrada tarde', 'Salida tarde', 'Horas tarde', 'Total horas del día', 'Monto generado', 'Acciones'].map(header => (
                          <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-petrol-100 dark:divide-slate-700">
                      {attendanceHistory.length === 0 ? (
                        <tr><td colSpan={10} className="p-4 text-center text-petrol-400">Sin asistencia en este mes</td></tr>
                      ) : attendanceHistory.map(item => (
                        <tr key={item.id} className="text-petrol-700 dark:text-petrol-200">
                          <td className="px-3 py-2 whitespace-nowrap">{new Date(`${item.work_date}T00:00:00`).toLocaleDateString('es-AR')}</td>
                          <td className="px-3 py-2">{toTimeInput(item.morning_start) || '-'}</td>
                          <td className="px-3 py-2">{toTimeInput(item.morning_end) || '-'}</td>
                          <td className="px-3 py-2">{formatMinutes(item.morning_minutes)}</td>
                          <td className="px-3 py-2">{toTimeInput(item.afternoon_start) || '-'}</td>
                          <td className="px-3 py-2">{toTimeInput(item.afternoon_end) || '-'}</td>
                          <td className="px-3 py-2">{formatMinutes(item.afternoon_minutes)}</td>
                          <td className="px-3 py-2 font-semibold">{formatMinutes(item.total_minutes)}</td>
                          <td className="px-3 py-2 font-semibold text-emerald-600">{formatCurrency(item.total_amount)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => openAttendanceModal(item)} className="p-1.5 text-petrol-500 hover:bg-petrol-100 dark:hover:bg-slate-700 rounded"><Edit3 size={14} /></button>
                              <button onClick={() => handleDeleteAttendance(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl border border-petrol-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 bg-petrol-100 dark:bg-slate-700/50 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 flex items-center gap-2">
                    <DollarSign size={16} /> Pagos del mes
                  </h4>
                  <button onClick={openPaymentModal} className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                    <Plus size={14} /> Pago
                  </button>
                </div>
                <div className="divide-y divide-petrol-100 dark:divide-slate-700 max-h-56 overflow-y-auto">
                  {payments.length === 0 ? (
                    <div className="p-4 text-center text-petrol-400 text-sm">Sin pagos este mes</div>
                  ) : payments.map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${PAYMENT_METHOD_CONFIG[payment.payment_method || 'efectivo']?.color}`}>
                            {PAYMENT_METHOD_CONFIG[payment.payment_method || 'efectivo']?.label}
                          </span>
                          <span className="text-sm font-medium text-petrol-800 dark:text-white">{formatCurrency(payment.amount)}</span>
                        </div>
                        <p className="text-xs text-petrol-500 mt-0.5">
                          {new Date(`${payment.payment_date || payment.date}T00:00:00`).toLocaleDateString('es-AR')}
                          {payment.notes && ` - ${payment.notes}`}
                        </p>
                      </div>
                      <button onClick={() => handleDeletePayment(payment.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showEmployeeModal && (
        <Modal title={editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'} onClose={() => setShowEmployeeModal(false)} maxWidth="max-w-md">
          <div className="p-4 space-y-4">
            <Input label="Nombre *" value={employeeForm.name} onChange={value => setEmployeeForm(f => ({ ...f, name: value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Teléfono" value={employeeForm.phone} onChange={value => setEmployeeForm(f => ({ ...f, phone: value }))} />
              <Input label="Rol" value={employeeForm.position} onChange={value => setEmployeeForm(f => ({ ...f, position: value }))} />
              <Input label="Fecha ingreso" type="date" value={employeeForm.start_date} onChange={value => setEmployeeForm(f => ({ ...f, start_date: value }))} />
              <div>
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Tipo de pago</label>
                <select value={employeeForm.payment_type} onChange={e => setEmployeeForm(f => ({ ...f, payment_type: e.target.value as PaymentType }))} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm">
                  {PAYMENT_TYPE_OPTIONS.map(type => <option key={type} value={type}>{PAYMENT_TYPE_CONFIG[type].label}</option>)}
                </select>
              </div>
              <NumberInput label="Sueldo por hora" value={employeeForm.hourly_rate} onChange={value => setEmployeeForm(f => ({ ...f, hourly_rate: value }))} />
              <NumberInput label="Sueldo mensual opcional" value={employeeForm.monthly_salary} onChange={value => setEmployeeForm(f => ({ ...f, monthly_salary: value }))} />
              <div className="col-span-2">
                <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Estado</label>
                <select value={employeeForm.status} onChange={e => setEmployeeForm(f => ({ ...f, status: e.target.value as EmployeeStatus }))} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm">
                  {EMPLOYEE_STATUS_OPTIONS.map(status => <option key={status} value={status}>{EMPLOYEE_STATUS_CONFIG[status].label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <ModalActions onCancel={() => setShowEmployeeModal(false)} onSave={handleSaveEmployee} saving={saving} disabled={!employeeForm.name.trim()} />
        </Modal>
      )}

      {showAttendanceModal && (
        <Modal title={editingAttendance ? 'Editar asistencia' : 'Nueva asistencia'} onClose={() => setShowAttendanceModal(false)} maxWidth="max-w-lg">
          <div className="p-4 space-y-4">
            <Input label="Fecha" type="date" value={attendanceForm.work_date} onChange={value => setAttendanceForm(f => ({ ...f, work_date: value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Entrada mañana" type="time" value={attendanceForm.morning_start} onChange={value => setAttendanceForm(f => ({ ...f, morning_start: value }))} />
              <Input label="Salida mañana" type="time" value={attendanceForm.morning_end} onChange={value => setAttendanceForm(f => ({ ...f, morning_end: value }))} />
              <Input label="Entrada tarde" type="time" value={attendanceForm.afternoon_start} onChange={value => setAttendanceForm(f => ({ ...f, afternoon_start: value }))} />
              <Input label="Salida tarde" type="time" value={attendanceForm.afternoon_end} onChange={value => setAttendanceForm(f => ({ ...f, afternoon_end: value }))} />
            </div>
            <Input label="Nota" value={attendanceForm.notes} onChange={value => setAttendanceForm(f => ({ ...f, notes: value }))} />
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label="Horas mañana" value={formatMinutes(calculateMinutes(attendanceForm.morning_start, attendanceForm.morning_end))} />
              <SummaryCard label="Horas tarde" value={formatMinutes(calculateMinutes(attendanceForm.afternoon_start, attendanceForm.afternoon_end))} />
              <SummaryCard label="Monto" value={formatCurrency(calculateAmount(calculateMinutes(attendanceForm.morning_start, attendanceForm.morning_end) + calculateMinutes(attendanceForm.afternoon_start, attendanceForm.afternoon_end), currentRate))} />
            </div>
          </div>
          <ModalActions onCancel={() => setShowAttendanceModal(false)} onSave={handleSaveAttendance} saving={saving} />
        </Modal>
      )}

      {showPaymentModal && (
        <Modal title="Registrar Pago" onClose={() => setShowPaymentModal(false)} maxWidth="max-w-sm">
          <div className="p-4 space-y-4">
            <Input label="Fecha" type="date" value={paymentForm.payment_date} onChange={value => setPaymentForm(f => ({ ...f, payment_date: value }))} />
            <NumberInput label="Monto *" value={paymentForm.amount} onChange={value => setPaymentForm(f => ({ ...f, amount: value }))} />
            <div>
              <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Método de pago</label>
              <select value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value as EmployeePaymentMethod }))} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm">
                {PAYMENT_METHOD_OPTIONS.map(method => <option key={method} value={method}>{PAYMENT_METHOD_CONFIG[method].label}</option>)}
              </select>
            </div>
            <Input label="Nota" value={paymentForm.notes} onChange={value => setPaymentForm(f => ({ ...f, notes: value }))} />
          </div>
          <ModalActions onCancel={() => setShowPaymentModal(false)} onSave={handleSavePayment} saving={saving} disabled={paymentForm.amount <= 0} icon="money" />
        </Modal>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 p-5">
            <h3 className="text-lg font-semibold text-petrol-800 dark:text-white mb-2">Eliminar empleado</h3>
            <p className="text-sm text-petrol-600 dark:text-petrol-400 mb-4">¿Estás seguro? Se eliminarán también todos los pagos y asistencias.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 border border-petrol-200 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => handleDeleteEmployee(deleteConfirm)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, valueClass = 'text-petrol-800 dark:text-white', icon }: { label: string; value: string | number; valueClass?: string; icon?: ReactNode }) {
  return (
    <div className="bg-crudo-50 dark:bg-slate-800 rounded-lg p-3 border border-petrol-200 dark:border-slate-700">
      <p className="text-xs text-petrol-500 flex items-center gap-1">{icon}{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, valueClass = 'text-petrol-800 dark:text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-white/70 dark:bg-slate-900/30 rounded-lg p-3 border border-petrol-100 dark:border-slate-700">
      <p className="text-xs text-petrol-500">{label}</p>
      <p className={`text-base font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ShiftInput({ label, value, onChange, onMark, buttonLabel, icon }: { label: string; value: string; onChange: (value: string) => void; onMark: () => void; buttonLabel: string; icon: ReactNode }) {
  return (
    <div className="bg-white/70 dark:bg-slate-900/30 rounded-lg p-3 border border-petrol-100 dark:border-slate-700">
      <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="time" value={value} onChange={e => onChange(e.target.value)} className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm" />
        <button onClick={onMark} className="px-3 py-2 bg-petrol-600 hover:bg-petrol-700 text-white rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
          {icon} {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, maxWidth }: { title: string; children: ReactNode; onClose: () => void; maxWidth: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className={`w-full ${maxWidth} bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700`}>
        <div className="p-4 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-petrol-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-petrol-400 hover:text-petrol-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm" />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">{label}</label>
      <input type="number" min={0} step="0.01" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm" />
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving, disabled, icon }: { onCancel: () => void; onSave: () => void; saving: boolean; disabled?: boolean; icon?: 'money' }) {
  return (
    <div className="p-4 border-t border-petrol-200 dark:border-slate-700 flex gap-3 justify-end">
      <button onClick={onCancel} className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 border border-petrol-200 rounded-lg text-sm">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : icon === 'money' ? <DollarSign size={16} /> : <Save size={16} />}
        Guardar
      </button>
    </div>
  );
}
