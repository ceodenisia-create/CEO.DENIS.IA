import { supabase } from './supabase';

export interface SearchResult {
  id: string;
  category: 'client' | 'order' | 'inventory';
  title: string;
  subtitle: string;
  page: string;
  orderId?: string;
  modelId?: string;
}

export interface SearchResults {
  clients: SearchResult[];
  orders: SearchResult[];
  inventory: SearchResult[];
  total: number;
}

const AI_TRIGGER_WORDS = [
  'cómo', 'como', 'qué', 'que', 'cuándo', 'cuando', 'cuánto', 'cuanto',
  'por qué', 'porque', 'dónde', 'donde', 'quién', 'quien',
  'ayudame', 'ayúdame', 'necesito', 'podés', 'podes', 'puedo',
  'dame', 'explicá', 'explica', 'calculá', 'calcula', 'resumí', 'resumi',
];

export function looksLikeAiQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.endsWith('?')) return true;
  if (q.length > 40) return true;
  return AI_TRIGGER_WORDS.some(word => q.startsWith(word) || q.includes(` ${word} `));
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q || q.length < 2) return { clients: [], orders: [], inventory: [], total: 0 };

  const [clientsRes, ordersRes, inventoryRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, business_name, name, contact_name, phone, locality')
      .or(`business_name.ilike.%${q}%,name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%,locality.ilike.%${q}%`)
      .limit(5),

    supabase
      .from('orders')
      .select('id, order_number, customer_name, garment_type, status, article_name')
      .or(`order_number.ilike.%${q}%,customer_name.ilike.%${q}%,garment_type.ilike.%${q}%,article_name.ilike.%${q}%`)
      .limit(5),

    supabase
      .from('inventory_models')
      .select('id, code, name, category')
      .or(`code.ilike.%${q}%,name.ilike.%${q}%,category.ilike.%${q}%`)
      .eq('status', 'active')
      .limit(5),
  ]);

  const STATUS_LABELS: Record<string, string> = {
    nuevo: 'Nuevo', en_proceso: 'En proceso',
    esperando_confirmacion: 'Esperando confirmación',
    listo_entregar: 'Listo para entregar',
    entregado: 'Entregado', cancelado: 'Cancelado',
  };

  const clients: SearchResult[] = (clientsRes.data ?? []).map(c => ({
    id: c.id,
    category: 'client',
    title: c.business_name || c.name || 'Sin nombre',
    subtitle: [c.contact_name, c.phone, c.locality].filter(Boolean).join(' · '),
    page: 'clients',
  }));

  const orders: SearchResult[] = (ordersRes.data ?? []).map(o => ({
    id: o.id,
    category: 'order',
    title: `${o.order_number} — ${o.customer_name || 'Sin cliente'}`,
    subtitle: `${o.article_name || o.garment_type || ''} · ${STATUS_LABELS[o.status] ?? o.status}`,
    page: 'order-detail',
    orderId: o.id,
  }));

  const inventory: SearchResult[] = (inventoryRes.data ?? []).map(m => ({
    id: m.id,
    category: 'inventory',
    title: `${m.code} — ${m.name}`,
    subtitle: m.category || '',
    page: 'library',
    modelId: m.id,
  }));

  return {
    clients,
    orders,
    inventory,
    total: clients.length + orders.length + inventory.length,
  };
}
