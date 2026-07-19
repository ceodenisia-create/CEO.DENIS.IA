-- BRÚJULA (ex Mapa de Futuro): fixes de storage + área personalizada

-- ─── 1. STORAGE POLICIES para el bucket vision-images ────────────────────────
-- El bucket existía pero sin policies en storage.objects → los uploads fallaban
-- con "new row violates row-level security policy".
-- Cada usuario sube/edita/borra SOLO en su carpeta (primer segmento = su user_id).

drop policy if exists "vision-images insert own" on storage.objects;
create policy "vision-images insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vision-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "vision-images update own" on storage.objects;
create policy "vision-images update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'vision-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'vision-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "vision-images delete own" on storage.objects;
create policy "vision-images delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vision-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública (el bucket es público; las imágenes se ven por URL pública)
drop policy if exists "vision-images public read" on storage.objects;
create policy "vision-images public read"
  on storage.objects for select to public
  using (bucket_id = 'vision-images');

-- ─── 2. ÁREA PERSONALIZADA en pm_future_visions ──────────────────────────────
alter table pm_future_visions
  add column if not exists area_custom text;

-- Relajar el CHECK de area para permitir 'otra' (personalizada)
alter table pm_future_visions
  drop constraint if exists pm_future_visions_area_check;

alter table pm_future_visions
  add constraint pm_future_visions_area_check
  check (area in ('negocios','familia','salud','dinero','viajes','estilo_vida','mentalidad','otra'));
