/**
 * API endpoint para subir imágenes al bucket R2 de Cloudflare.
 * Las credenciales permanecen en el servidor — nunca se exponen al browser.
 *
 * POST /api/r2-upload
 * Body: multipart/form-data con campo "file" y campo "path"
 * Returns: { url: string }
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Faltan variables de entorno R2_ENDPOINT, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Parse multipart form data manually (Vercel Edge doesn't always support formidable)
async function parseMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type debe ser multipart/form-data');
  }

  // Use the built-in formData if available (Vercel Node runtime)
  if (typeof req.formData === 'function') {
    const fd = await req.formData();
    const file = fd.get('file');
    const path = fd.get('path');
    if (!file || typeof file === 'string') throw new Error('Campo "file" requerido');
    const buffer = Buffer.from(await file.arrayBuffer());
    return { buffer, mimeType: file.type || 'image/jpeg', path: String(path || `upload-${Date.now()}.jpg`) };
  }

  // Fallback: read raw body and parse boundary
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);

  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) throw new Error('No se encontró boundary en Content-Type');
  const boundary = '--' + boundaryMatch[1];

  const parts = raw.toString('binary').split(boundary).slice(1, -1);
  let fileBuffer = null;
  let mimeType = 'image/jpeg';
  let filePath = `upload-${Date.now()}.jpg`;

  for (const part of parts) {
    const [headerRaw, ...bodyParts] = part.split('\r\n\r\n');
    const body = bodyParts.join('\r\n\r\n').replace(/\r\n$/, '');
    const header = headerRaw.toLowerCase();

    if (header.includes('name="file"')) {
      const mimeMatch = headerRaw.match(/content-type:\s*([^\r\n]+)/i);
      if (mimeMatch) mimeType = mimeMatch[1].trim();
      fileBuffer = Buffer.from(body, 'binary');
    } else if (header.includes('name="path"')) {
      filePath = body.trim();
    }
  }

  if (!fileBuffer) throw new Error('No se encontró el campo "file" en el form');
  return { buffer: fileBuffer, mimeType, path: filePath };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const bucket = process.env.R2_BUCKET;
    if (!bucket) return res.status(500).json({ error: 'Falta R2_BUCKET en variables de entorno' });

    const { buffer, mimeType, path: filePath } = await parseMultipart(req);

    const client = getR2Client();
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: buffer,
      ContentType: mimeType,
    }));

    // URL pública: usa R2_PUBLIC_URL (ej: https://pub-xxx.r2.dev) o fallback al endpoint
    const publicBase = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT || '';
    const publicUrl = `${publicBase}/${filePath}`;

    return res.status(200).json({ url: publicUrl });
  } catch (err) {
    console.error('[r2-upload] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error al subir imagen' });
  }
}
