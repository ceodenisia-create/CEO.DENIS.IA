/**
 * Sincronización automática entre Pedidos y Agenda/Kanban
 *
 * Reglas de mapeo:
 *   nuevo                → pendiente  (Por hacer)
 *   en_proceso           → en_proceso (En proceso)
 *   esperando_confirmacion → cancelado (Esperando)
 *   listo_entregar       → en_proceso (En proceso)
 *   entregado            → completado (Completado)
 *   finalizado           → completado (Completado)
 *   cancelado            → no aparece en Kanban (cancelado)
 *
 * Inverso desde Kanban:
 *   completado → entregado
 *   cancelado  → esperando_confirmacion
 */

import { supabase } from './supabase';
import type { Order } from './types';
import type { AgendaEvent } from './agenda';

// ─── Mapeos ───────────────────────────────────────────────────────────────────

export function orderStatusToAgendaStatus(orderStatus: Order['status']): AgendaEvent['status'] {
  switch (orderStatus) {
    case 'nuevo':                  return 'confirmado';
    case 'en_proceso':             return 'en_proceso';
    case 'esperando_confirmacion': return 'pendiente';
    case 'listo_entregar':         return 'terminado';
    case 'entregado':              return 'entregado';
    case 'finalizado':             return 'completado';
    case 'cancelado':              return 'cancelado';
    default:                       return 'confirmado';
  }
}

export function agendaStatusToOrderStatus(agendaStatus: AgendaEvent['status']): Order['status'] | null {
  switch (agendaStatus) {
    case 'confirmado':  return 'nuevo';
    case 'pendiente':   return 'esperando_confirmacion';
    case 'en_proceso':  return 'en_proceso';
    case 'terminado':   return 'listo_entregar';
    case 'entregado':   return 'entregado';
    case 'completado':  return 'finalizado';
    default:            return null;
  }
}

export function orderPriorityToAgendaPriority(priority: Order['priority']): AgendaEvent['priority'] {
  switch (priority) {
    case 'very_urgent': return 'urgente';
    case 'urgent':      return 'alta';
    default:            return 'normal';
  }
}

// ─── Buscar actividad vinculada a un pedido ───────────────────────────────────

export async function findAgendaEventForOrder(orderId: string): Promise<AgendaEvent | null> {
  const { data } = await supabase
    .from('agenda_events')
    .select('*')
    .eq('order_id', orderId)
    .eq('event_type', 'entrega')
    .maybeSingle();
  return (data as AgendaEvent | null) ?? null;
}

// ─── Crear o actualizar actividad de entrega ──────────────────────────────────

export async function syncOrderToAgenda(order: Order, createdByUserId: string): Promise<void> {
  if (!order.delivery_date) return; // Sin fecha de entrega no se crea actividad

  const title   = `Entrega ${order.order_number} - ${order.customer_name}`;
  const startAt = new Date(`${order.delivery_date}T09:00:00`).toISOString();
  const agendaStatus = orderStatusToAgendaStatus(order.status);
  const agendaPriority = orderPriorityToAgendaPriority(order.priority);

  const existing = await findAgendaEventForOrder(order.id);

  if (existing) {
    // Actualizar actividad existente
    await supabase
      .from('agenda_events')
      .update({
        title,
        start_at: startAt,
        status: agendaStatus,
        priority: agendaPriority,
        customer_id: order.customer_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Crear nueva actividad
    await supabase
      .from('agenda_events')
      .insert({
        title,
        description: order.notes || null,
        event_type: 'entrega',
        priority: agendaPriority,
        status: agendaStatus,
        start_at: startAt,
        end_at: null,
        reminder: 'none',
        color: '#14b8a6',
        customer_id: order.customer_id || null,
        order_id: order.id,
        responsible_user_id: null,
        created_by: createdByUserId,
      });
  }
}

// ─── Eliminar actividad cuando se elimina un pedido ──────────────────────────

export async function deleteAgendaEventForOrder(orderId: string): Promise<void> {
  await supabase
    .from('agenda_events')
    .delete()
    .eq('order_id', orderId)
    .eq('event_type', 'entrega');
}

// ─── Sincronizar estado del pedido cuando se mueve en Kanban ─────────────────

export async function syncKanbanToOrder(agendaEvent: AgendaEvent, newAgendaStatus: AgendaEvent['status']): Promise<void> {
  if (!agendaEvent.order_id) return;

  const newOrderStatus = agendaStatusToOrderStatus(newAgendaStatus);
  if (!newOrderStatus) return;

  await supabase
    .from('orders')
    .update({
      status: newOrderStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agendaEvent.order_id);
}
