-- Disciplina: hábitos y registros diarios
-- Prefijo pm_ — mismo patrón que el resto del proyecto

-- ─── HÁBITOS ────────────────────────────────────────────────────────────────
create table if not exists pm_habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  area             text not null check (area in ('salud','trabajo','estudio','dinero','familia','mentalidad','personal')),
  frequency        text not null default 'diario' check (frequency in ('diario','semanal')),
  priority         text not null default 'media' check (priority in ('alta','media','baja')),
  status           text not null default 'activo' check (status in ('activo','pausado','abandonado')),
  suggested_time   text,
  note             text,
  current_streak   integer not null default 0,
  best_streak      integer not null default 0,
  total_completed  integer not null default 0,
  total_failed     integer not null default 0,
  position         integer default 0,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

alter table pm_habits enable row level security;

create policy "pm_habits: user owns rows"
  on pm_habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── REGISTROS DIARIOS ───────────────────────────────────────────────────────
create table if not exists pm_habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid references pm_habits(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  log_date   date not null,
  status     text not null check (status in ('completed','failed','paused')),
  note       text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- un solo registro por hábito por día
  unique (habit_id, log_date)
);

alter table pm_habit_logs enable row level security;

create policy "pm_habit_logs: user owns via habit"
  on pm_habit_logs for all
  using (
    exists (
      select 1 from pm_habits h
      where h.id = habit_id and h.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pm_habits h
      where h.id = habit_id and h.user_id = auth.uid()
    )
  );

-- ─── TRIGGERS updated_at ────────────────────────────────────────────────────
create trigger pm_habits_updated_at
  before update on pm_habits
  for each row execute function pm_set_updated_at();

create trigger pm_habit_logs_updated_at
  before update on pm_habit_logs
  for each row execute function pm_set_updated_at();

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────
create index if not exists pm_habits_user_status   on pm_habits(user_id, status);
create index if not exists pm_habits_user_area     on pm_habits(user_id, area);
create index if not exists pm_habit_logs_habit     on pm_habit_logs(habit_id, log_date);
create index if not exists pm_habit_logs_user_date on pm_habit_logs(user_id, log_date);
