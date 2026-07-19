-- Migración 023: extender pm_projects con campos de gestión avanzada
-- No elimina columnas existentes ni modifica datos actuales
-- Los proyectos existentes quedan con status='activo', priority='media', progress=0

alter table pm_projects
  add column if not exists status    text not null default 'activo'
    check (status in ('planeado','activo','en_pausa','finalizado','cancelado')),
  add column if not exists priority  text not null default 'media'
    check (priority in ('alta','media','baja')),
  add column if not exists start_date  date,
  add column if not exists target_date date,
  add column if not exists progress  integer not null default 0
    check (progress between 0 and 100),
  add column if not exists next_step text,
  add column if not exists notes     text;
