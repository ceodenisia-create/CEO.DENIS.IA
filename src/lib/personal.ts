import { supabase } from './supabase';
import type { Employee, EmployeeAttendance, EmployeePayment } from './types';

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
  console.log('[createEmployee] Inserting employee:', employee);
  const { data, error } = await supabase
    .from('employees')
    .insert({
      name: employee.name || '',
      phone: employee.phone || '',
      position: employee.position || '',
      start_date: employee.start_date || new Date().toISOString().split('T')[0],
      monthly_salary: employee.monthly_salary || 0,
      status: employee.status || 'active',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('[createEmployee] Supabase error:', error);
    throw new Error(`Error al crear empleado: ${error.message} (código: ${error.code})`);
  }
  console.log('[createEmployee] Success:', data);
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
    .eq('date', today)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getEmployeeAttendance(employeeId: string, month?: string): Promise<EmployeeAttendance[]> {
  let query = supabase
    .from('employee_attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .order('date', { ascending: false });

  if (month) {
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    query = query.gte('date', startDate).lte('date', endDate);
  } else {
    // Current month by default
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    query = query.gte('date', startDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function registerEntry(employeeId: string): Promise<EmployeeAttendance> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0];

  const { data, error } = await supabase
    .from('employee_attendance')
    .insert({
      employee_id: employeeId,
      date: today,
      entry_time: now,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

export async function registerExit(employeeId: string): Promise<EmployeeAttendance> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0];

  const { data, error } = await supabase
    .from('employee_attendance')
    .update({ exit_time: now })
    .eq('employee_id', employeeId)
    .eq('date', today)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

// Payments
export async function getEmployeePayments(employeeId: string, month?: string): Promise<EmployeePayment[]> {
  let query = supabase
    .from('employee_payments')
    .select('*')
    .eq('employee_id', employeeId)
    .order('date', { ascending: false });

  if (month) {
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    query = query.gte('date', startDate).lte('date', endDate);
  } else {
    // Current month by default
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    query = query.gte('date', startDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPayment(payment: Partial<EmployeePayment>): Promise<EmployeePayment> {
  const { data, error } = await supabase
    .from('employee_payments')
    .insert({
      employee_id: payment.employee_id!,
      date: payment.date || new Date().toISOString().split('T')[0],
      amount: payment.amount || 0,
      payment_type: payment.payment_type || 'adelanto',
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

// Stats
export async function getPersonalStats() {
  const { data: employees } = await supabase
    .from('employees')
    .select('id, monthly_salary, status');

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { data: payments } = await supabase
    .from('employee_payments')
    .select('employee_id, amount')
    .gte('date', monthStart);

  const activeEmployees = (employees || []).filter(e => e.status === 'active');

  const totalSalaries = activeEmployees.reduce((sum, e) => sum + (Number(e.monthly_salary) || 0), 0);

  const totalPaid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Calculate paid per employee
  const paidByEmployee: Record<string, number> = {};
  (payments || []).forEach(p => {
    paidByEmployee[p.employee_id] = (paidByEmployee[p.employee_id] || 0) + Number(p.amount);
  });

  const totalPending = activeEmployees.reduce((sum, e) => {
    const paid = paidByEmployee[e.id] || 0;
    const pending = Math.max(0, (Number(e.monthly_salary) || 0) - paid);
    return sum + pending;
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
