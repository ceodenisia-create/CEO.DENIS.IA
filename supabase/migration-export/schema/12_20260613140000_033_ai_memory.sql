-- Memoria IA: base de conocimiento personal persistente del usuario
-- El Asistente IA lee las memorias activas y las suma a su contexto.

create table if not exists pm_ai_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  category    text not null default 'general',
  title       text not null,
  content     text not null,
  importance  integer not null default 3 check (importance between 1 and 5),
  source      text,
  is_active   boolean not null default true,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table pm_ai_memory enable row level security;

create policy "pm_ai_memory: user owns rows"
  on pm_ai_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger pm_ai_memory_updated_at
  before update on pm_ai_memory
  for each row execute function pm_set_updated_at();

create index if not exists pm_ai_memory_user        on pm_ai_memory(user_id, is_active);
create index if not exists pm_ai_memory_importance   on pm_ai_memory(user_id, importance desc);
