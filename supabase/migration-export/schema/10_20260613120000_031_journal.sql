-- Bitácora: registro personal (diario, ideas, decisiones, planes, lecciones, cierre diario)
-- Tabla flexible única con metadata jsonb para campos específicos por tipo.

create table if not exists pm_journal_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  type             text not null check (type in ('diario','idea','decision','plan','leccion','cierre_diario')),
  title            text not null,
  content          text,
  entry_date       date not null default current_date,
  status           text,
  area             text,
  priority         text,
  related_business text,
  mood             text,
  energy_level     integer,
  focus_level      integer,
  tags             text[],
  metadata         jsonb default '{}'::jsonb,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

alter table pm_journal_entries enable row level security;

create policy "pm_journal_entries: user owns rows"
  on pm_journal_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger pm_journal_entries_updated_at
  before update on pm_journal_entries
  for each row execute function pm_set_updated_at();

-- Un solo cierre diario por usuario por fecha
create unique index if not exists pm_journal_cierre_unico
  on pm_journal_entries(user_id, entry_date)
  where type = 'cierre_diario';

create index if not exists pm_journal_user_type on pm_journal_entries(user_id, type, entry_date desc);
create index if not exists pm_journal_user_date on pm_journal_entries(user_id, entry_date desc);
