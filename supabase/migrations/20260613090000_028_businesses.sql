-- Mis Negocios: configuración + planificación de tiempo + vínculo con tareas
-- Prefijo pm_ — mismo patrón del proyecto

-- ─── NEGOCIOS ────────────────────────────────────────────────────────────────
create table if not exists pm_businesses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  key         text not null,            -- slug estable: modeltex, moldey
  name        text not null,            -- visible: MODELTEX, MOLDEY
  url         text,
  color       text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null,
  unique(user_id, key)
);

alter table pm_businesses enable row level security;

create policy "pm_businesses: user owns rows"
  on pm_businesses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── BLOQUES DE TIEMPO POR NEGOCIO ───────────────────────────────────────────
create table if not exists pm_business_time_blocks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  business_key    text not null,
  business_name   text not null,
  work_date       date not null default current_date,
  planned_minutes integer not null default 0,
  worked_minutes  integer not null default 0,
  note            text,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  unique(user_id, business_key, work_date)
);

alter table pm_business_time_blocks enable row level security;

create policy "pm_business_time_blocks: user owns rows"
  on pm_business_time_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── VÍNCULO TAREA → NEGOCIO ─────────────────────────────────────────────────
alter table pm_tasks
  add column if not exists business_key text;

-- ─── TRIGGERS updated_at ─────────────────────────────────────────────────────
create trigger pm_businesses_updated_at
  before update on pm_businesses
  for each row execute function pm_set_updated_at();

create trigger pm_business_time_blocks_updated_at
  before update on pm_business_time_blocks
  for each row execute function pm_set_updated_at();

-- ─── ÍNDICES ─────────────────────────────────────────────────────────────────
create index if not exists pm_businesses_user on pm_businesses(user_id, sort_order);
create index if not exists pm_business_time_user_date on pm_business_time_blocks(user_id, work_date);
create index if not exists pm_tasks_business on pm_tasks(user_id, business_key);
