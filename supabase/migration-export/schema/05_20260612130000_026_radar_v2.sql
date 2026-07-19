-- Radar v2: múltiples radares (fijo + personalizados)
-- Evolución incremental — NO elimina pm_radar_evaluations ni pm_radar_scores
-- Prefijo pm_ — mismo patrón que el resto del proyecto

-- ─── RADARES ─────────────────────────────────────────────────────────────────
create table if not exists pm_radars (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text,
  type        text not null default 'custom' check (type in ('fixed','custom')),
  status      text not null default 'active' check (status in ('active','archived')),
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table pm_radars enable row level security;

create policy "pm_radars: user owns rows"
  on pm_radars for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── DEFINICIONES DE ÁREA POR RADAR ──────────────────────────────────────────
create table if not exists pm_radar_area_defs (
  id           uuid primary key default gen_random_uuid(),
  radar_id     uuid references pm_radars(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  area_key     text not null,           -- slug estable, nunca cambia
  display_name text not null,           -- nombre visible, puede editarse
  sort_order   integer not null default 0,
  is_required  boolean not null default false,  -- true = no se puede borrar
  is_active    boolean not null default true,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null,
  unique(radar_id, area_key)
);

alter table pm_radar_area_defs enable row level security;

create policy "pm_radar_area_defs: user owns via radar"
  on pm_radar_area_defs for all
  using (
    exists (
      select 1 from pm_radars r
      where r.id = radar_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pm_radars r
      where r.id = radar_id and r.user_id = auth.uid()
    )
  );

-- ─── ALTERAR TABLAS EXISTENTES ───────────────────────────────────────────────

-- Agregar radar_id a evaluaciones (nullable para no romper datos existentes)
alter table pm_radar_evaluations
  add column if not exists radar_id uuid references pm_radars(id) on delete cascade;

-- Agregar area_key y sort_order a puntajes
alter table pm_radar_scores
  add column if not exists area_key text,
  add column if not exists sort_order integer default 0;

-- ─── TRIGGERS updated_at ─────────────────────────────────────────────────────
create trigger pm_radars_updated_at
  before update on pm_radars
  for each row execute function pm_set_updated_at();

create trigger pm_radar_area_defs_updated_at
  before update on pm_radar_area_defs
  for each row execute function pm_set_updated_at();

-- ─── ÍNDICES ─────────────────────────────────────────────────────────────────
create index if not exists pm_radars_user         on pm_radars(user_id, status);
create index if not exists pm_radar_area_defs_radar on pm_radar_area_defs(radar_id, sort_order);
create index if not exists pm_radar_evals_radar   on pm_radar_evaluations(radar_id, evaluation_date desc);
