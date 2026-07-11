-- Sección OFICINA: tarjetas de acceso rápido y sus botones/links.
-- Ejecutar en Supabase Dashboard > SQL Editor > Run.

create table if not exists public.pm_office_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'folder',
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pm_office_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.pm_office_cards(id) on delete cascade,
  label text not null,
  url text not null,
  detail text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pm_office_cards enable row level security;
alter table public.pm_office_links enable row level security;

drop policy if exists "own office cards" on public.pm_office_cards;
create policy "own office cards" on public.pm_office_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own office links" on public.pm_office_links;
create policy "own office links" on public.pm_office_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at automático
create extension if not exists moddatetime;

drop trigger if exists set_updated_at on public.pm_office_cards;
create trigger set_updated_at before update on public.pm_office_cards
  for each row execute procedure moddatetime(updated_at);

drop trigger if exists set_updated_at on public.pm_office_links;
create trigger set_updated_at before update on public.pm_office_links
  for each row execute procedure moddatetime(updated_at);
