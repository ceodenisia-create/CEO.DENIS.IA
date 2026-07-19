-- Kanban: columnas personalizadas
-- Las 5 columnas de sistema (inbox/hoy/en_curso/esperando/hecho) viven en código
-- y siguen usando pm_tasks.status. Esta tabla guarda SOLO columnas custom del usuario.

create table if not exists pm_kanban_columns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  key         text not null,            -- slug estable de la columna custom
  color       text,
  sort_order  integer not null default 0,
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null,
  unique(user_id, key)
);

alter table pm_kanban_columns enable row level security;

create policy "pm_kanban_columns: user owns rows"
  on pm_kanban_columns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger pm_kanban_columns_updated_at
  before update on pm_kanban_columns
  for each row execute function pm_set_updated_at();

create index if not exists pm_kanban_columns_user on pm_kanban_columns(user_id, sort_order);

-- Vínculo tarea → columna custom (nullable; si es null la tarea vive en su status base)
alter table pm_tasks
  add column if not exists column_key text;

create index if not exists pm_tasks_column on pm_tasks(user_id, column_key);
