-- Mis Negocios: enlaces externos por negocio (hub de accesos)
-- Cada negocio puede tener varios enlaces (store, sistema, ia, etc.)

create table if not exists pm_business_links (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  business_key text not null,
  label        text not null,
  url          text,
  type         text not null default 'website',  -- website | system | ai | otro
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

alter table pm_business_links enable row level security;

create policy "pm_business_links: user owns rows"
  on pm_business_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger pm_business_links_updated_at
  before update on pm_business_links
  for each row execute function pm_set_updated_at();

create index if not exists pm_business_links_user on pm_business_links(user_id, business_key, sort_order);
