import { supabase } from './supabase';
import type { MoldFile, FileType } from './types';

const MOLD_FILES_BUCKET = 'mold-files';

function sanitizeStorageFileName(fileName: string): string {
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const safeBaseName = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${safeBaseName || 'archivo'}${extension.toLowerCase()}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

// Upload mold file to storage
export async function uploadMoldFile(file: File, modelId: string): Promise<string> {
  const path = `molds/${modelId}/${Date.now()}_${sanitizeStorageFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(MOLD_FILES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    console.error('[uploadMoldFile] Storage upload failed:', {
      bucket: MOLD_FILES_BUCKET,
      path,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      error,
    });
    throw new Error(`Error al subir archivo a Storage: ${getErrorMessage(error)}`);
  }

  const { data: urlData } = supabase.storage.from(MOLD_FILES_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

// Create mold file record
export async function createMoldFile(moldFile: Partial<MoldFile>): Promise<MoldFile> {
  const { data, error } = await supabase
    .from('mold_library')
    .insert({
      model_id: moldFile.model_id,
      file_name: moldFile.file_name || '',
      file_type: moldFile.file_type || 'other',
      file_url: moldFile.file_url || '',
      version: moldFile.version || '',
      technical_notes: moldFile.technical_notes || '',
      is_primary: moldFile.is_primary || false,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('[createMoldFile] Database insert failed:', { moldFile, error });
    throw new Error(`Error al guardar metadata del archivo: ${getErrorMessage(error)}`);
  }
  return data!;
}

// Update mold file
export async function updateMoldFile(id: string, updates: Partial<MoldFile>): Promise<MoldFile> {
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('mold_library')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[updateMoldFile] Database update failed:', { id, updates, error });
    throw new Error(`Error al actualizar metadata del archivo: ${getErrorMessage(error)}`);
  }
  return data!;
}

// Delete mold file
export async function deleteMoldFile(id: string): Promise<void> {
  // Get file URL first to delete from storage
  const { data: moldFile } = await supabase
    .from('mold_library')
    .select('file_url')
    .eq('id', id)
    .maybeSingle();

  if (moldFile?.file_url) {
    // Extract path from URL
    const url = new URL(moldFile.file_url);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${MOLD_FILES_BUCKET}/`);
    if (pathParts.length > 1) {
      const filePath = pathParts[1];
      await supabase.storage.from(MOLD_FILES_BUCKET).remove([filePath]);
    }
  }

  const { error } = await supabase
    .from('mold_library')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get all files for a model
export async function getModelFiles(modelId: string): Promise<MoldFile[]> {
  const { data, error } = await supabase
    .from('mold_library')
    .select('*')
    .eq('model_id', modelId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get files by type for a model
export async function getModelFilesByType(modelId: string, fileType: FileType): Promise<MoldFile[]> {
  const { data, error } = await supabase
    .from('mold_library')
    .select('*')
    .eq('model_id', modelId)
    .eq('file_type', fileType)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get primary file for a model and type
export async function getPrimaryFile(modelId: string, fileType: FileType): Promise<MoldFile | null> {
  const { data, error } = await supabase
    .from('mold_library')
    .select('*')
    .eq('model_id', modelId)
    .eq('file_type', fileType)
    .eq('is_primary', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Set file as primary (unsets other primaries of same type)
export async function setPrimaryFile(fileId: string, modelId: string, fileType: FileType): Promise<void> {
  // Unset all other primaries of same type for model
  await supabase
    .from('mold_library')
    .update({ is_primary: false })
    .eq('model_id', modelId)
    .eq('file_type', fileType);

  // Set this file as primary
  await supabase
    .from('mold_library')
    .update({ is_primary: true })
    .eq('id', fileId);
}

// Get library stats
export async function getLibraryStats() {
  const { data: files } = await supabase
    .from('mold_library')
    .select('file_type');

  const all = files || [];

  return {
    totalFiles: all.length,
    pdfA4: all.filter(f => f.file_type === 'pdf_a4').length,
    pdfPlotter: all.filter(f => f.file_type === 'pdf_plotter').length,
    plt: all.filter(f => f.file_type === 'plt').length,
    dxf: all.filter(f => f.file_type === 'dxf').length,
    cdr: all.filter(f => f.file_type === 'cdr').length,
    ai: all.filter(f => f.file_type === 'ai').length,
    images: all.filter(f => ['jpg', 'png'].includes(f.file_type)).length,
  };
}

// Search files by name
export async function searchMoldFiles(query: string): Promise<MoldFile[]> {
  const q = query.toLowerCase();
  const { data, error } = await supabase
    .from('mold_library')
    .select('*')
    .or(`file_name.ilike.%${q},version.ilike.%${q},technical_notes.ilike.%${q}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
