-- Plan Maestro: tablas independientes con prefijo pm_
-- Todas usan RLS con políticas de usuario autenticado

-- ─── PROYECTOS ──────────────────────────────────────────────────────────────
create table if not exists pm_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  area        text not null check (area in ('modeltex','moldey','personal','sistemas')),
  description text,
  color       text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table pm_projects enable row level security;

create policy "pm_projects: user owns rows"
  on pm_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── METAS ──────────────────────────────────────────────────────────────────
create table if not exists pm_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  project_id      uuid references pm_projects(id) on delete set null,
  title           text not null,
  area            text not null check (area in ('modeltex','moldey','personal','sistemas')),
  timeframe       text not null check (timeframe in ('corto','mediano','largo')),
  deadline        date,
  next_step       text,
  progress_manual integer check (progress_manual between 0 and 100),
  notes           text,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table pm_goals enable row level security;

create policy "pm_goals: user owns rows"
  on pm_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── TAREAS ─────────────────────────────────────────────────────────────────
create table if not exists pm_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  project_id  uuid references pm_projects(id) on delete set null,
  goal_id     uuid references pm_goals(id) on delete set null,
  title       text not null,
  notes       text,
  area        text not null check (area in ('modeltex','moldey','personal','sistemas')),
  priority    text not null default 'media' check (priority in ('alta','media','baja')),
  status      text not null default 'inbox' check (status in ('inbox','hoy','en_curso','esperando','hecho')),
  is_mit      boolean not null default false,
  due_date    date,
  position    integer default 0,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table pm_tasks enable row level security;

create policy "pm_tasks: user owns rows"
  on pm_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── CONVERSACIONES IA ──────────────────────────────────────────────────────
create table if not exists pm_ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  title      text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table pm_ai_conversations enable row level security;

create policy "pm_ai_conversations: user owns rows"
  on pm_ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── MENSAJES IA ────────────────────────────────────────────────────────────
create table if not exists pm_ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references pm_ai_conversations(id) on delete cascade not null,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  created_at      timestamptz default now() not null
);

alter table pm_ai_messages enable row level security;

create policy "pm_ai_messages: user owns via conversation"
  on pm_ai_messages for all
  using (
    exists (
      select 1 from pm_ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pm_ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- ─── TRIGGERS updated_at ────────────────────────────────────────────────────
create or replace function pm_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pm_projects_updated_at
  before update on pm_projects
  for each row execute function pm_set_updated_at();

create trigger pm_goals_updated_at
  before update on pm_goals
  for each row execute function pm_set_updated_at();

create trigger pm_tasks_updated_at
  before update on pm_tasks
  for each row execute function pm_set_updated_at();

create trigger pm_ai_conversations_updated_at
  before update on pm_ai_conversations
  for each row execute function pm_set_updated_at();

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────
create index if not exists pm_tasks_user_status    on pm_tasks(user_id, status);
create index if not exists pm_tasks_user_due        on pm_tasks(user_id, due_date);
create index if not exists pm_tasks_user_mit        on pm_tasks(user_id, is_mit) where is_mit = true;
create index if not exists pm_goals_user_timeframe  on pm_goals(user_id, timeframe);
create index if not exists pm_projects_user         on pm_projects(user_id);
