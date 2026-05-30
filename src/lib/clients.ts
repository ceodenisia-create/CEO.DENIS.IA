import { supabase } from './supabase';
import type { Client, ClientStatus, Order } from './types';

export async function createClient(client: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: client.name || client.business_name || '',
      business_name: client.business_name || '',
      contact_name: client.contact_name || '',
      phone: client.phone || '',
      whatsapp: client.whatsapp || client.phone || '',
      email: client.email || '',
      address: client.address || '',
      locality: client.locality || '',
      province: client.province || '',
      client_type: client.client_type || 'otro',
      industry: client.industry || '',
      notes: client.notes || '',
      status: client.status || 'active',
      is_favorite: false,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function searchClients(query: string): Promise<Client[]> {
  const q = query.toLowerCase();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(`name.ilike.%${q},business_name.ilike.%${q},phone.ilike.%${q},whatsapp.ilike.%${q},locality.ilike.%${q},email.ilike.%${q}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getClientOrders(clientId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', clientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getClientStats(clientId: string) {
  const orders = await getClientOrders(clientId);
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + Number(o.price), 0);
  const totalPaid = orders.reduce((sum, o) => sum + Number(o.paid_amount), 0);
  const pendingBalance = orders.reduce((sum, o) => sum + Number(o.remaining_balance), 0);
  const deliveredCount = orders.filter(o => o.status === 'entregado').length;
  const lastOrder = orders[0] || null;

  return {
    totalOrders,
    totalSpent,
    totalPaid,
    pendingBalance,
    deliveredCount,
    lastOrder,
  };
}

export async function getClientsWithStats() {
  const clients = await getClients();
  const result = [];

  for (const client of clients) {
    const orders = await getClientOrders(client.id);
    result.push({
      ...client,
      orderCount: orders.length,
      lastOrder: orders[0] || null,
    });
  }

  return result;
}

export async function toggleClientFavorite(clientId: string, isFavorite: boolean): Promise<void> {
  await supabase
    .from('customers')
    .update({ is_favorite: isFavorite })
    .eq('id', clientId);
}

export async function setClientStatus(clientId: string, status: ClientStatus): Promise<void> {
  await supabase
    .from('customers')
    .update({ status })
    .eq('id', clientId);
}

export function formatWhatsAppMessage(order: Order, clientName: string): string {
  const statusLabels: Record<string, string> = {
    nuevo: 'Nuevo',
    en_proceso: 'En proceso',
    esperando_confirmacion: 'Esperando confirmación',
    listo_entregar: 'Listo para entregar',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };

  const workType = order.work_type || 'No especificado';
  const delivery = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-AR') : 'A confirmar';
  const article = order.article_name || order.garment_type || 'Pedido';

  return `Hola ${clientName}, te escribimos de CEO MODELTEX por tu pedido: ${article}.

Estado actual: ${statusLabels[order.status] || order.status}.

Detalle:
• Artículo: ${order.garment_type || article}
• Talle/curva: ${order.sizes || 'No especificado'}
• Tipo de trabajo: ${workType}
• Cantidad: ${order.quantity}
• Fecha estimada de entrega: ${delivery}

Cualquier cambio o confirmación te avisamos por este medio.

CEO MODELTEX - Centro de Operaciones Modeltex`;
}

export function getWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_TEMPLATES = {
  paymentReminder: (orderNumber: string, balance: number) =>
    `Hola, te recordamos que tu pedido *${orderNumber}* tiene un saldo pendiente de *$${balance.toLocaleString('es-AR')}*. - CEO MODELTEX`,
};
