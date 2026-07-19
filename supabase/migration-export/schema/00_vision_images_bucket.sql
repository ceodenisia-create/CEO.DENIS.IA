-- El bucket 'vision-images' (usado por Mapa de Futuro / Brújula) nunca se creó
-- vía migración en el proyecto original: se creó a mano desde el Dashboard de
-- Supabase (Storage > New bucket). Lo recreamos acá vía SQL para que quede
-- versionado. Debe aplicarse ANTES de 08_..._029_brujula_fixes.sql (que crea
-- las políticas de storage.objects sobre este bucket).

INSERT INTO storage.buckets (id, name, public)
VALUES ('vision-images', 'vision-images', true)
ON CONFLICT (id) DO NOTHING;
