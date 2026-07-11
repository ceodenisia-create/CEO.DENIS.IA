import { supabase } from './offlineClient';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface OfficeCard {
  id: string;
  user_id: string;
  name: string;
  icon: string;         // clave de OFFICE_ICONS
  color: string | null; // hex del acento de la tarjeta
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OfficeLink {
  id: string;
  user_id: string;
  card_id: string;
  label: string;
  url: string;
  detail: string | null; // dato asociado: @usuario, teléfono, email…
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Paleta de acentos para tarjetas (coherente con la marca)
export const OFFICE_COLORS = [
  '#B8922A', '#8B1A2E', '#16A34A', '#0EA5E9', '#8B5CF6', '#EC4899',
  '#D97706', '#14B8A6', '#6366F1', '#868E96',
];

// ─── CARDS ────────────────────────────────────────────────────────────────────

export async function getOfficeCards(): Promise<OfficeCard[]> {
  const { data, error } = await supabase
    .from('pm_office_cards')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OfficeCard[];
}

const DEFAULT_CARDS: Array<Pick<OfficeCard, 'name' | 'icon' | 'color'>> = [
  { name: 'Producción', icon: 'printer', color: '#B8922A' },
  { name: 'Diseño',     icon: 'pen',     color: '#8B5CF6' },
  { name: 'Redes',      icon: 'share',   color: '#EC4899' },
];

// Crea las 3 tarjetas iniciales si el usuario no tiene ninguna
export async function ensureOfficeCards(): Promise<OfficeCard[]> {
  const existing = await getOfficeCards();
  if (existing.length > 0) return existing;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const rows = DEFAULT_CARDS.map((c, i) => ({ ...c, user_id: user.id, sort_order: i }));
  const { data, error } = await supabase.from('pm_office_cards').insert(rows).select();
  if (error) throw error;
  return (data ?? []) as OfficeCard[];
}

export async function createOfficeCard(name: string, icon: string, color: string, sortOrder: number): Promise<OfficeCard> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_office_cards')
    .insert({ user_id: user.id, name: name.trim(), icon, color, sort_order: sortOrder })
    .select().single();
  if (error) throw error;
  return data as OfficeCard;
}

export async function updateOfficeCard(id: string, patch: Partial<Pick<OfficeCard, 'name' | 'icon' | 'color' | 'sort_order'>>): Promise<void> {
  const { error } = await supabase.from('pm_office_cards').update(patch).eq('id', id);
  if (error) throw error;
}

// Borra la tarjeta y todos sus botones
export async function deleteOfficeCard(id: string): Promise<void> {
  const { error: linksErr } = await supabase.from('pm_office_links').delete().eq('card_id', id);
  if (linksErr) throw linksErr;
  const { error } = await supabase.from('pm_office_cards').delete().eq('id', id);
  if (error) throw error;
}

// ─── LINKS (botones) ──────────────────────────────────────────────────────────

export async function getOfficeLinks(): Promise<OfficeLink[]> {
  const { data, error } = await supabase
    .from('pm_office_links')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OfficeLink[];
}

export async function createOfficeLink(
  cardId: string,
  l: { label: string; url: string; detail?: string | null },
  sortOrder: number
): Promise<OfficeLink> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_office_links')
    .insert({
      user_id: user.id, card_id: cardId,
      label: l.label.trim(), url: l.url.trim(),
      detail: l.detail?.trim() || null,
      sort_order: sortOrder,
    })
    .select().single();
  if (error) throw error;
  return data as OfficeLink;
}

export async function updateOfficeLink(id: string, patch: Partial<Pick<OfficeLink, 'label' | 'url' | 'detail' | 'sort_order' | 'card_id'>>): Promise<void> {
  const { error } = await supabase.from('pm_office_links').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteOfficeLink(id: string): Promise<void> {
  const { error } = await supabase.from('pm_office_links').delete().eq('id', id);
  if (error) throw error;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Asegura protocolo para window.open ("instagram.com" → "https://instagram.com")
export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return `https://${u}`;
}

export function openOfficeUrl(url: string): void {
  window.open(normalizeUrl(url), '_blank', 'noopener,noreferrer');
}
