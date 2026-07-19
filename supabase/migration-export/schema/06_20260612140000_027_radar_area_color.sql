-- Radar: agregar campo color a definiciones de área
-- Backward compatible: nullable, los colores se asignan desde el frontend

alter table pm_radar_area_defs
  add column if not exists color text;

-- Comentario: formato esperado = hex (#RRGGBB), ej: #EF4444
-- Si es null, el frontend usa colores por defecto según area_key
