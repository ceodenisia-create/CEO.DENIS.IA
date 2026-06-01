import { supabase } from './supabase';
import type { Order, OrderHistoryEntry, GarmentType } from './types';

export async function generateOrderNumber(): Promise<string> {
  const { data } = await supabase
    .from('orders')
    .select('order_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return 'MOD-0001';
  const num = parseInt(data.order_number.split('-')[1], 10);
  return `MOD-${String(num + 1).padStart(4, '0')}`;
}

export async function createOrder(order: Partial<Order>): Promise<Order> {
  console.log('[createOrder] Inserting order:', order);
  const orderNumber = await generateOrderNumber();
  const remaining_balance = (Number(order.price) || 0) - (Number(order.paid_amount) || 0);

  const { data, error } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_id: order.customer_id,
      customer_name: order.customer_name || '',
      phone: order.phone || '',
      client_whatsapp: order.client_whatsapp || order.phone || '',
      garment_type: order.garment_type || '',
      article_name: order.article_name || order.garment_type || '',
      sizes: order.sizes || '',
      quantity: order.quantity || 1,
      fabric_type: order.fabric_type || '',
      work_type: order.work_type || '',
      notes: order.notes || '',
      delivery_date: order.delivery_date || null,
      status: order.status || 'nuevo',
      priority: order.priority || 'normal',
      price: order.price || 0,
      paid_amount: order.paid_amount || 0,
      remaining_balance,
      reference_image_url: order.reference_image_url || '',
      pdf_file_url: order.pdf_file_url || '',
      mold_file_url: order.mold_file_url || '',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('[createOrder] Supabase error:', error);
    throw new Error(`Error al crear pedido: ${error.message} (código: ${error.code})`);
  }
  console.log('[createOrder] Success:', data);

  await addHistoryEntry(data.id, 'Pedido creado', '', orderNumber);

  if (order.garment_type) {
    await incrementGarmentType(order.garment_type);
  }

  return data!;
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
  const { data: oldOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (updates.price !== undefined || updates.paid_amount !== undefined) {
    const price = updates.price ?? oldOrder?.price ?? 0;
    const paid = updates.paid_amount ?? oldOrder?.paid_amount ?? 0;
    updates.remaining_balance = Number(price) - Number(paid);
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (oldOrder) {
    if (updates.status && updates.status !== oldOrder.status) {
      await addHistoryEntry(id, 'Estado cambiado', oldOrder.status, updates.status);
    }
    if (updates.paid_amount !== undefined && updates.paid_amount !== oldOrder.paid_amount) {
      await addHistoryEntry(id, 'Pago actualizado', String(oldOrder.paid_amount), String(updates.paid_amount));
    }
    if (updates.priority && updates.priority !== oldOrder.priority) {
      await addHistoryEntry(id, 'Prioridad cambiada', oldOrder.priority, updates.priority);
    }
  }

  return data!;
}

export async function duplicateOrder(orderId: string): Promise<Order> {
  const { data: original } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!original) throw new Error('Pedido no encontrado');

  return createOrder({
    customer_id: original.customer_id,
    customer_name: original.customer_name,
    phone: original.phone,
    client_whatsapp: original.client_whatsapp,
    garment_type: original.garment_type,
    article_name: original.article_name,
    sizes: original.sizes,
    quantity: original.quantity,
    fabric_type: original.fabric_type,
    work_type: original.work_type,
    notes: original.notes,
    delivery_date: null,
    status: 'nuevo',
    priority: 'normal',
    price: original.price,
    paid_amount: 0,
  });
}

export async function addHistoryEntry(orderId: string, action: string, oldValue: string, newValue: string): Promise<void> {
  await supabase.from('order_history').insert({
    order_id: orderId,
    action,
    old_value: oldValue,
    new_value: newValue,
  });
}

export async function getOrderHistory(orderId: string): Promise<OrderHistoryEntry[]> {
  const { data, error } = await supabase
    .from('order_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function incrementGarmentType(name: string): Promise<void> {
  const { data: existing } = await supabase
    .from('garment_types')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (existing) {
    await supabase.from('garment_types').update({ usage_count: existing.usage_count + 1 }).eq('id', existing.id);
  } else {
    await supabase.from('garment_types').insert({ name, usage_count: 1 });
  }
}

export async function getRecentGarmentTypes(limit = 8): Promise<GarmentType[]> {
  const { data, error } = await supabase
    .from('garment_types')
    .select('*')
    .order('usage_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function uploadFile(file: File, path: string, bucket: string = 'order-files'): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (error) {
      console.error(`[uploadFile] Storage error (${bucket}):`, error);
      throw new Error(`Error al subir archivo: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.error('[uploadFile] Error:', err);
    throw err;
  }
}

export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];

  const [ordersResult, clientsResult] = await Promise.all([
    supabase.from('orders').select('price, paid_amount, remaining_balance, status, delivery_date, priority'),
    supabase.from('customers').select('id, status'),
  ]);

  const orders = ordersResult.data || [];
  const clients = clientsResult.data || [];

  const totalSales = orders.reduce((sum, o) => sum + Number(o.price), 0);
  const pendingPayments = orders
    .filter(o => o.status !== 'entregado')
    .reduce((sum, o) => sum + Number(o.remaining_balance), 0);
  const delayedOrders = orders.filter(o => o.delivery_date && o.delivery_date < today && !['entregado', 'cancelado'].includes(o.status)).length;
  const urgentOrders = orders.filter(o => o.priority === 'urgent' || o.priority === 'very_urgent').length;

  return {
    totalOrders: orders.length,
    newOrders: orders.filter(o => o.status === 'nuevo').length,
    inProcessOrders: orders.filter(o => o.status === 'en_proceso').length,
    pendingOrders: orders.filter(o => !['entregado', 'cancelado'].includes(o.status)).length,
    deliveredOrders: orders.filter(o => o.status === 'entregado').length,
    activeClients: clients.filter(c => c.status === 'active').length,
    totalClients: clients.length,
    totalSales,
    pendingPayments,
    delayedOrders,
    urgentOrders,
    paidOrders: orders.filter(o => Number(o.remaining_balance) <= 0 && Number(o.price) > 0).length,
    unpaidOrders: orders.filter(o => Number(o.remaining_balance) > 0).length,
  };
}
