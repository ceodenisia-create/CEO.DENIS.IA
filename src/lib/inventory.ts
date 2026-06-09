import { supabase } from './supabase';
import type { InventoryModel, Category, ModelStatus } from './types';

// Generate unique code for inventory model
export async function generateModelCode(): Promise<string> {
  const { data } = await supabase
    .from('inventory_models')
    .select('code')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return 'MOD-001';
  const num = parseInt(data.code.replace('MOD-', ''), 10);
  return `MOD-${String(num + 1).padStart(3, '0')}`;
}

// Create new inventory model
export async function createModel(model: Partial<InventoryModel>): Promise<InventoryModel> {
  console.log('[createModel] Inserting model:', model);
  const code = model.code || await generateModelCode();

  const { data, error } = await supabase
    .from('inventory_models')
    .insert({
      code,
      name: model.name || '',
      category: model.category || 'HOMBRE',
      subcategory: model.subcategory || '',
      size_curve: model.size_curve || '',
      recommended_fabric: model.recommended_fabric || '',
      description: model.description || '',
      main_photo_url: model.main_photo_url || '',
      quantity_available: model.quantity_available || 0,
      quantity_sold: model.quantity_sold || 0,
      status: model.status || 'active',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('[createModel] Supabase error:', error);
    throw new Error(`Error al crear modelo: ${error.message} (código: ${error.code})`);
  }
  console.log('[createModel] Success:', data);
  return data!;
}

// Update inventory model
export async function updateModel(id: string, updates: Partial<InventoryModel>): Promise<InventoryModel> {
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('inventory_models')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}

// Delete inventory model
export async function deleteModel(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_models')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get single model by ID
export async function getModel(id: string): Promise<InventoryModel | null> {
  const { data, error } = await supabase
    .from('inventory_models')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Get all models
export async function getModels(): Promise<InventoryModel[]> {
  const { data, error } = await supabase
    .from('inventory_models')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Search models
export async function searchModels(query: string): Promise<InventoryModel[]> {
  const q = query.toLowerCase();
  const { data, error } = await supabase
    .from('inventory_models')
    .select('*')
    .or(`code.ilike.%${q},name.ilike.%${q},category.ilike.%${q},description.ilike.%${q}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Filter models
export async function filterModels(filters: {
  category?: Category;
  status?: ModelStatus;
}): Promise<InventoryModel[]> {
  let query = supabase.from('inventory_models').select('*');

  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get model stats
export async function getModelStats() {
  const { data: models } = await supabase
    .from('inventory_models')
    .select('id, status, quantity_sold, category');

  const all = models || [];

  return {
    total: all.length,
    active: all.filter(m => m.status === 'active').length,
    hidden: all.filter(m => m.status === 'hidden').length,
    archived: all.filter(m => m.status === 'archived').length,
    totalSold: all.reduce((sum, m) => sum + (m.quantity_sold || 0), 0),
    topCategories: getCategoryBreakdown(all),
    topSelling: all.sort((a, b) => (b.quantity_sold || 0) - (a.quantity_sold || 0)).slice(0, 5),
  };
}

function getCategoryBreakdown(models: any[]) {
  const breakdown: Record<string, number> = {};
  models.forEach(m => {
    breakdown[m.category] = (breakdown[m.category] || 0) + 1;
  });
  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, count]) => ({ category: cat, count }));
}

// Upload photo for model
export async function uploadModelPhoto(file: File, modelId: string): Promise<string> {
  const path = `models/${modelId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from('order-files')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('order-files').getPublicUrl(path);
  return data.publicUrl;
}

// Get orders for model
export async function getModelOrders(modelId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('model_id', modelId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get clients who ordered this model
export async function getModelClients(modelId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_id, customer_name')
    .eq('model_id', modelId)
    .not('customer_id', 'is', null);

  if (error) throw error;

  // Deduplicate by customer_id
  const uniqueClients = new Map();
  (data || []).forEach(o => {
    if (o.customer_id && !uniqueClients.has(o.customer_id)) {
      uniqueClients.set(o.customer_id, {
        id: o.customer_id,
        name: o.customer_name,
      });
    }
  });

  return Array.from(uniqueClients.values());
}

// Increment quantity sold
export async function incrementQuantitySold(modelId: string, quantity: number = 1): Promise<void> {
  const { data: model } = await supabase
    .from('inventory_models')
    .select('quantity_sold')
    .eq('id', modelId)
    .maybeSingle();

  if (model) {
    await supabase
      .from('inventory_models')
      .update({ quantity_sold: (model.quantity_sold || 0) + quantity })
      .eq('id', modelId);
  }
}
