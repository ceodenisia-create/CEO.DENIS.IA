import { supabase } from './supabase';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiSystemContext {
  // Resumen general
  pendingOrders: number;
  activeModels: number;
  totalClients: number;
  generatedAt: string;

  // Pedidos
  allOrders: Array<{
    order_number: string;
    customer_name: string;
    phone: string;
    garment_type: string;
    sizes: string;
    quantity: number;
    fabric_type: string;
    notes: string;
    delivery_date: string | null;
    status: string;
    price: number;
    paid_amount: number;
    remaining_balance: number;
    created_at: string;
  }>;

  // Clientes
  allClients: Array<{
    name: string;
    phone: string;
    is_favorite: boolean;
    created_at: string;
  }>;

  // Inventario / Modelos
  allInventory: Array<{
    code: string;
    name: string;
    category: string;
    subcategory: string;
    size_curve: string;
    recommended_fabric: string;
    quantity_available: number;
    quantity_sold: number;
    status: string;
  }>;

  // Agenda
  upcomingAgenda: Array<{
    title: string;
    description: string | null;
    event_type: string;
    priority: string;
    status: string;
    start_at: string;
    end_at: string | null;
  }>;

  // Personal
  employees: Array<{
    name: string;
    phone: string;
    position: string;
    monthly_salary: number;
    status: string;
    start_date: string;
  }>;

  recentAttendance: Array<{
    employee_id: string;
    date: string;
    entry_time: string | null;
    exit_time: string | null;
  }>;

  recentEmployeePayments: Array<{
    employee_id: string;
    date: string;
    amount: number;
    payment_type: string;
    notes: string;
  }>;

  // Finanzas
  recentFinanceMovements: Array<{
    type: string;
    amount: number;
    category: string;
    payment_method: string;
    description: string;
    status: string;
    movement_date: string;
    related_person: string | null;
  }>;

  // Stock bajo
  lowStockModels: Array<{
    code: string;
    name: string;
    quantity_available: number;
  }>;
}

export async function getAiSystemContext(): Promise<AiSystemContext> {
  const pendingStatuses = ['nuevo', 'en_proceso', 'esperando_confirmacion'];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [
    pendingOrdersRes,
    activeModelsRes,
    totalClientsRes,
    allOrdersRes,
    allClientsRes,
    allInventoryRes,
    upcomingAgendaRes,
    employeesRes,
    recentAttendanceRes,
    recentEmployeePaymentsRes,
    recentFinanceMovementsRes,
    lowStockModelsRes,
  ] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', pendingStatuses),
    supabase.from('inventory_models').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),

    supabase
      .from('orders')
      .select('order_number, customer_name, phone, garment_type, sizes, quantity, fabric_type, notes, delivery_date, status, price, paid_amount, remaining_balance, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    supabase
      .from('customers')
      .select('name, phone, is_favorite, created_at')
      .order('created_at', { ascending: false }),

    supabase
      .from('inventory_models')
      .select('code, name, category, subcategory, size_curve, recommended_fabric, quantity_available, quantity_sold, status')
      .order('name', { ascending: true }),

    supabase
      .from('agenda_events')
      .select('title, description, event_type, priority, status, start_at, end_at')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(30),

    supabase
      .from('employees')
      .select('name, phone, position, monthly_salary, status, start_date')
      .order('name', { ascending: true }),

    supabase
      .from('employee_attendance')
      .select('employee_id, date, entry_time, exit_time')
      .gte('date', thirtyDaysAgoStr)
      .order('date', { ascending: false })
      .limit(60),

    supabase
      .from('employee_payments')
      .select('employee_id, date, amount, payment_type, notes')
      .gte('date', thirtyDaysAgoStr)
      .order('date', { ascending: false })
      .limit(50),

    supabase
      .from('finance_movements')
      .select('type, amount, category, payment_method, description, status, movement_date, related_person')
      .order('movement_date', { ascending: false })
      .limit(100),

    supabase
      .from('inventory_models')
      .select('code, name, quantity_available')
      .lte('quantity_available', 2)
      .eq('status', 'active')
      .order('quantity_available', { ascending: true })
      .limit(10),
  ]);

  return {
    pendingOrders: pendingOrdersRes.count ?? 0,
    activeModels: activeModelsRes.count ?? 0,
    totalClients: totalClientsRes.count ?? 0,
    generatedAt: new Date().toISOString(),
    allOrders: allOrdersRes.data ?? [],
    allClients: allClientsRes.data ?? [],
    allInventory: allInventoryRes.data ?? [],
    upcomingAgenda: upcomingAgendaRes.data ?? [],
    employees: employeesRes.data ?? [],
    recentAttendance: recentAttendanceRes.data ?? [],
    recentEmployeePayments: recentEmployeePaymentsRes.data ?? [],
    recentFinanceMovements: recentFinanceMovementsRes.data ?? [],
    lowStockModels: lowStockModelsRes.data ?? [],
  };
}

export async function sendAiChat(messages: AiChatMessage[], context: AiSystemContext): Promise<string> {
  const response = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, context }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo obtener respuesta del asistente.');
  }

  if (typeof payload.reply !== 'string' || !payload.reply.trim()) {
    throw new Error('La respuesta del asistente llegó vacía.');
  }

  return payload.reply.trim();
}
