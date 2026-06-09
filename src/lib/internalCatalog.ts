import { supabase } from './supabase';
import type { CatalogItem, CatalogStatus, Category } from './types';

// Generate unique code for catalog item
export async function generateCatalogCode(): Promise<string> {
  const { data } = await supabase
    .from('internal_catalog')
    .select('code')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return 'CAT-001';
  const num = parseInt(data.code.replace('CAT-', ''), 10);
  return `CAT-${String(num + 1).padStart(3, '0')}`;
}

// Create catalog item
export async function createCatalogItem(item: Partial<CatalogItem>): Promise<CatalogItem> {
  const code = item.code || await generateCatalogCode();

  const { data, error } = await supabase
    .from('internal_catalog')
    .insert({
      code,
      model_id: item.model_id || null,
      name: item.name || '',
      category: item.category || 'HOMBRE',
      size_curve: item.size_curve || '',
      season: item.season || '',
      photo_url: item.photo_url || '',
      status: item.status || 'active',
      internal_notes: item.internal_notes || '',
      tags: item.tags || [],
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

// Update catalog item
export async function updateCatalogItem(id: string, updates: Partial<CatalogItem>): Promise<CatalogItem> {
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('internal_catalog')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

// Delete catalog item
export async function deleteCatalogItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('internal_catalog')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get all catalog items
export async function getCatalogItems(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('internal_catalog')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get single catalog item
export async function getCatalogItem(id: string): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from('internal_catalog')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Search catalog items
export async function searchCatalogItems(query: string): Promise<CatalogItem[]> {
  const q = query.toLowerCase();
  const { data, error } = await supabase
    .from('internal_catalog')
    .select('*')
    .or(`code.ilike.%${q},name.ilike.%${q},category.ilike.%${q},internal_notes.ilike.%${q}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Filter catalog items
export async function filterCatalogItems(filters: {
  category?: Category;
  status?: CatalogStatus;
  season?: string;
  withPhoto?: boolean;
  tags?: string[];
}): Promise<CatalogItem[]> {
  let query = supabase.from('internal_catalog').select('*');

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.season) query = query.eq('season', filters.season);
  if (filters.withPhoto === true) query = query.not('photo_url', 'eq', '');
  if (filters.withPhoto === false) query = query.eq('photo_url', '');

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Filter by tags in JS ( Postgres array contains )
  let result = data || [];
  if (filters.tags && filters.tags.length > 0) {
    result = result.filter(item =>
      filters.tags!.some(tag => item.tags?.includes(tag))
    );
  }

  return result;
}

// Upload catalog image
export async function uploadCatalogImage(file: File, itemId: string): Promise<string> {
  const path = `catalog/${itemId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from('catalog-images')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('catalog-images').getPublicUrl(path);
  return data.publicUrl;
}

// Get catalog stats
export async function getCatalogStats() {
  const { data: items } = await supabase
    .from('internal_catalog')
    .select('id, status, category, tags, photo_url');

  const all = items || [];

  const tagCounts: Record<string, number> = {};
  all.forEach(item => {
    (item.tags || []).forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return {
    total: all.length,
    active: all.filter(i => i.status === 'active').length,
    hidden: all.filter(i => i.status === 'hidden').length,
    archived: all.filter(i => i.status === 'archived').length,
    noPublish: all.filter(i => i.status === 'no_publish').length,
    clientSpecific: all.filter(i => i.status === 'client_specific').length,
    withPhoto: all.filter(i => i.photo_url && i.photo_url.length > 0).length,
    withoutPhoto: all.filter(i => !i.photo_url || i.photo_url.length === 0).length,
    tags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count })),
  };
}
