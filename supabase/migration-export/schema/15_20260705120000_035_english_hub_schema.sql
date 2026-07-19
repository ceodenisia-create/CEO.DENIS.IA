-- 035 English Hub: banco de vocabulario + progreso por usuario.
-- No borra ni modifica datos existentes.

-- ── 1. Catalogo compartido de palabras (referencia, solo lectura desde el cliente) ─
create table if not exists pm_eng_words (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('keyword','verb','adjective','noun')),
  rank        int not null,
  word        text not null,
  translation text not null,
  created_at  timestamptz not null default now(),
  unique (category, word)
);

create index if not exists pm_eng_words_cat_rank on pm_eng_words(category, rank);

alter table pm_eng_words enable row level security;

create policy "pm_eng_words: authenticated can read"
  on pm_eng_words for select
  to authenticated
  using (true);

-- ── 2. Progreso por usuario (aprendida / favorita) ─────────────────────────────────
-- catalog_word_id nulo + source='custom' queda reservado para vocabulario propio
-- (ej. extraido de un video mas adelante), sin necesitar otra migracion.
create table if not exists pm_eng_user_words (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  catalog_word_id  uuid references pm_eng_words(id) on delete cascade,
  word             text not null,
  translation      text not null,
  category         text not null check (category in ('keyword','verb','adjective','noun')),
  learned          boolean not null default false,
  favorite         boolean not null default false,
  source           text not null default 'catalog' check (source in ('catalog','custom')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists pm_eng_user_words_user_catalog
  on pm_eng_user_words(user_id, catalog_word_id) where catalog_word_id is not null;
create index if not exists pm_eng_user_words_user on pm_eng_user_words(user_id);

alter table pm_eng_user_words enable row level security;

create policy "pm_eng_user_words: user owns rows"
  on pm_eng_user_words for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger pm_eng_user_words_updated_at
  before update on pm_eng_user_words
  for each row execute function pm_set_updated_at();
