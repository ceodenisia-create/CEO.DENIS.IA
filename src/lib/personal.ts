import { supabase } from './supabase';
import type { Employee, EmployeeAttendance, EmployeePayment } from './types';

export type AttendanceField = 'morning_start' | 'morning_end' | 'afternoon_start' | 'afternoon_end';

export interface AttendanceInput {
  employee_id: string;
  work_date: string;
  morning_start?: string | null;
  morning_end?: string | null;
  afternoon_start?: string | null;
  afternoon_end?: string | null;
  hourly_rate: number;
  notes?: string | null;
}

export interface MonthlyEmployeeSummary {
  totalMinutes: number;
  totalAmount: number;
  totalPaid: number;
  pending: number;
}

function normalizeTime(value?: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

function toDateRange(month?: string) {
  const now = new Date();
  const selectedMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, monthNumber] = selectedMonth.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();

  return {
    month: selectedMonth,
    startDate: `${selectedMonth}-01`,
    endDate: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function calculateMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) {
    return 0;
  }

  return endTotal - startTotal;
}

export function formatMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours} h ${minutes} min`;
}

export function calculateAmount(totalMinutes: number, hourlyRate: number): number {
  return (Math.max(0, totalMinutes) / 60) * (Number(hourlyRate) || 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(Number(amount) || 0);
}

export function buildAttendancePayload(input: AttendanceInput) {
  const morningStart = normalizeTime(input.morning_start);
  const morningEnd = normalizeTime(input.morning_end);
  const afternoonStart = normalizeTime(input.afternoon_start);
  const afternoonEnd = normalizeTime(input.afternoon_end);
  const morningMinutes = calculateMinutes(morningStart, morningEnd);
  const afternoonMinutes = calculateMinutes(afternoonStart, afternoonEnd);
  const totalMinutes = morningMinutes + afternoonMinutes;
  const hourlyRate = Number(input.hourly_rate) || 0;

  return {
    employee_id: input.employee_id,
    work_date: input.work_date,
    morning_start: morningStart,
    morning_end: morningEnd,
    afternoon_start: afternoonStart,
    afternoon_end: afternoonEnd,
    morning_minutes: morningMinutes,
    afternoon_minutes: afternoonMinutes,
    total_minutes: totalMinutes,
    hourly_rate: hourlyRate,
    total_amount: calculateAmount(totalMinutes, hourlyRate),
    notes: input.notes || null,
  };
}

// Employees
export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[getEmployees] Supabase error:', error);
    throw error;
  }
  return data || [];
}

export async function getActiveEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    console.error('[getActiveEmployees] Supabase error:', error);
    throw error;
  }
  return data || [];
}

export async function createEmployee(employee: Partial<Employee>): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      name: employee.name || '',
      phone: employee.phone || '',
      position: employee.position || '',
      start_date: employee.start_date || new Date().toISOString().split('T')[0],
      monthly_salary: employee.monthly_salary || 0,
      hourly_rate: employee.hourly_rate || 0,
      payment_type: employee.payment_type || 'mensual',
      status: employee.status || 'active',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('[createEmployee] Supabase error:', error);
    throw new Error(`Error al crear empleado: ${error.message} (código: ${error.code})`);
  }
  return data!;
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Attendance
export async function getTodayAttendance(employeeId: string): Promise<EmployeeAttendance | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('employee_attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('work_date', today)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getEmployeeAttendance(employeeId: string, month?: string): Promise<EmployeeAttendance[]> {
  const { startDate, endDate } = toDateRange(month);
  const { data, error } = await supabase
    .from('employee_attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertAttendance(input: AttendanceInput): Promise<EmployeeAttendance> {
  const payload = buildAttendancePayload(input);
  const { data, error } = await supabase
    .from('employee_attendance')
    .upsert(payload, { onConflict: 'employee_id,work_date' })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

export async function updateAttendance(id: string, input: AttendanceInput): Promise<EmployeeAttendance> {
  const payload = buildAttendancePayload(input);
  const { data, error } = await supabase
    .from('employee_attendance')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase
    .from('employee_attendance')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

const ANA_NAMES = ['ANA', 'ANABEL'];
const ANA_HOURLY_RATE = 5072.46;

function resolveHourlyRate(employee: Employee): number {
  const rate = Number(employee.hourly_rate);
  if (rate > 0) return rate;
  if (ANA_NAMES.some(name => employee.name?.toUpperCase().includes(name))) return ANA_HOURLY_RATE;
  return 0;
}

export async function registerAttendanceTime(
  employee: Employee,
  field: AttendanceField,
  time = new Date().toTimeString().slice(0, 5),
): Promise<EmployeeAttendance> {
  const today = new Date().toISOString().split('T')[0];
  const existing = await getTodayAttendance(employee.id);

  return upsertAttendance({
    employee_id: employee.id,
    work_date: today,
    morning_start: existing?.morning_start || null,
    morning_end: existing?.morning_end || null,
    afternoon_start: existing?.afternoon_start || null,
    afternoon_end: existing?.afternoon_end || null,
    hourly_rate: resolveHourlyRate(employee),
    notes: existing?.notes || null,
    [field]: time,
  });
}

// Payments
export async function getEmployeePayments(employeeId: string, month?: string): Promise<EmployeePayment[]> {
  const { startDate, endDate } = toDateRange(month);
  const { data, error } = await supabase
    .from('employee_payments')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createPayment(payment: Partial<EmployeePayment>): Promise<EmployeePayment> {
  const paymentDate = payment.payment_date || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('employee_payments')
    .insert({
      employee_id: payment.employee_id!,
      date: paymentDate,
      payment_date: paymentDate,
      amount: payment.amount || 0,
      payment_method: payment.payment_method || 'efectivo',
      notes: payment.notes || '',
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase
    .from('employee_payments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function calculateMonthlySummary(attendance: EmployeeAttendance[], payments: EmployeePayment[]): MonthlyEmployeeSummary {
  const totalMinutes = attendance.reduce((sum, item) => sum + (Number(item.total_minutes) || 0), 0);
  const totalAmount = attendance.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
  const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  return {
    totalMinutes,
    totalAmount,
    totalPaid,
    pending: Math.max(0, totalAmount - totalPaid),
  };
}

// Stats
export async function getPersonalStats() {
  const { data: employees } = await supabase
    .from('employees')
    .select('id, monthly_salary, hourly_rate, payment_type, status');

  const { startDate, endDate } = toDateRange();

  const [{ data: payments }, { data: attendance }] = await Promise.all([
    supabase
      .from('employee_payments')
      .select('employee_id, amount')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate),
    supabase
      .from('employee_attendance')
      .select('employee_id, total_amount')
      .gte('work_date', startDate)
      .lte('work_date', endDate),
  ]);

  const activeEmployees = (employees || []).filter(e => e.status === 'active');
  const attendanceAmountByEmployee: Record<string, number> = {};
  (attendance || []).forEach(item => {
    attendanceAmountByEmployee[item.employee_id] = (attendanceAmountByEmployee[item.employee_id] || 0) + Number(item.total_amount || 0);
  });

  const paidByEmployee: Record<string, number> = {};
  (payments || []).forEach(payment => {
    paidByEmployee[payment.employee_id] = (paidByEmployee[payment.employee_id] || 0) + Number(payment.amount || 0);
  });

  const totalSalaries = activeEmployees.reduce((sum, employee) => {
    if (employee.payment_type === 'por_hora') {
      return sum + (attendanceAmountByEmployee[employee.id] || 0);
    }
    return sum + (Number(employee.monthly_salary) || 0);
  }, 0);

  const totalPaid = (payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const totalPending = activeEmployees.reduce((sum, employee) => {
    const generated = employee.payment_type === 'por_hora'
      ? attendanceAmountByEmployee[employee.id] || 0
      : Number(employee.monthly_salary) || 0;
    return sum + Math.max(0, generated - (paidByEmployee[employee.id] || 0));
  }, 0);

  return {
    totalEmployees: (employees || []).length,
    activeEmployees: activeEmployees.length,
    inactiveEmployees: (employees || []).filter(e => e.status === 'inactive').length,
    totalSalaries,
    totalPaid,
    totalPending,
  };
}
