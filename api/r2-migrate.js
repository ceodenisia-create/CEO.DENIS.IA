/**
 * API endpoint para migrar imágenes desde Supabase Storage a Cloudflare R2.
 * Solo puede ser llamado desde el panel admin de la app.
 *
 * POST /api/r2-migrate
 * Returns: { migrated: number, failed: number, details: [...] }
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Faltan variables SUPABASE_URL y SUPABASE_ANON_KEY en el servidor');
  return createClient(url, key);
}

async function fileExistsInR2(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const r2Bucket = process.env.R2_BUCKET;
  const r2Endpoint = process.env.R2_ENDPOINT;

  if (!r2Bucket || !r2Endpoint || !process.env.R2_ACCESS_KEY_ID) {
    return res.status(500).json({ error: 'Faltan variables de entorno de R2' });
  }

  try {
    const supabase = getSupabase();
    const r2 = getR2Client();

    // 1. Obtener todos los ítems del catálogo con foto
    const { data: items, error: dbError } = await supabase
      .from('internal_catalog')
      .select('id, name, photo_url')
      .not('photo_url', 'eq', '')
      .not('photo_url', 'is', null);

    if (dbError) throw dbError;

    const results = [];
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items || []) {
      const photoUrl = item.photo_url;

      // Saltear si ya está en R2
      if (photoUrl.includes('r2.cloudflarestorage.com') || photoUrl.includes(r2Endpoint)) {
        skipped++;
        results.push({ id: item.id, name: item.name, status: 'already_r2', url: photoUrl });
        continue;
      }

      // Solo migrar imágenes de Supabase Storage
      if (!photoUrl.includes('supabase')) {
        skipped++;
        results.push({ id: item.id, name: item.name, status: 'skipped_external', url: photoUrl });
        continue;
      }

      try {
        // Descargar imagen de Supabase
        const imgResponse = await fetch(photoUrl);
        if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status} al descargar`);

        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';

        // Generar key para R2
        const urlParts = photoUrl.split('/');
        const fileName = urlParts.slice(-2).join('/'); // ej: catalog/uuid/timestamp.jpg
        const r2Key = `catalog/${fileName}`;

        // Subir a R2
        await r2.send(new PutObjectCommand({
          Bucket: r2Bucket,
          Key: r2Key,
          Body: buffer,
          ContentType: contentType,
        }));

        const newUrl = `${r2Endpoint}/${r2Bucket}/${r2Key}`;

        // Actualizar URL en base de datos
        await supabase
          .from('internal_catalog')
          .update({ photo_url: newUrl, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        migrated++;
        results.push({ id: item.id, name: item.name, status: 'migrated', oldUrl: photoUrl, newUrl });
      } catch (itemErr) {
        failed++;
        results.push({ id: item.id, name: item.name, status: 'failed', error: itemErr.message, url: photoUrl });
      }
    }

    return res.status(200).json({
      total: (items || []).length,
      migrated,
      skipped,
      failed,
      details: results,
    });
  } catch (err) {
    console.error('[r2-migrate] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error en migración' });
  }
}
