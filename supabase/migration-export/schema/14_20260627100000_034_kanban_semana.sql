-- 034 Kanban Semana (control semanal dentro de Agenda > Kanban)
-- Tablero de planificación semanal. No borra ni modifica datos existentes.
-- RLS por user_id. Nada se elimina automáticamente.

-- ── 1. Tablero semanal: enfoque, meta principal e indicadores libres ───────────
create table if not exists pm_week_board (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start      date not null,                       -- lunes de la semana
  enfoque         text,
  meta_principal  text,
  indicators      jsonb not null default '[]'::jsonb,  -- [{id,name,objetivo,logrado}]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists pm_week_board_user_week
  on pm_week_board(user_id, week_start);

alter table pm_week_board enable row level security;
create policy "pm_week_board: user owns rows"
  on pm_week_board for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger pm_week_board_updated_at
  before update on pm_week_board
  for each row execute function pm_set_updated_at();

-- ── 2. Metas de la semana = vínculo a tareas reales (sin duplicar) ─────────────
create table if not exists pm_week_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  week_start   date not null,
  task_id      uuid not null references pm_tasks(id) on delete cascade,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists pm_week_tasks_unique
  on pm_week_tasks(user_id, week_start, task_id);
create index if not exists pm_week_tasks_user_week
  on pm_week_tasks(user_id, week_start);

alter table pm_week_tasks enable row level security;
create policy "pm_week_tasks: user owns rows"
  on pm_week_tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger pm_week_tasks_updated_at
  before update on pm_week_tasks
  for each row execute function pm_set_updated_at();
