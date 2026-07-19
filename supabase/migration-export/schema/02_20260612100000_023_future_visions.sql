-- Mapa de Futuro: visiones personales
create table if not exists pm_future_visions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  title        text not null,
  area         text not null check (area in ('negocios','familia','salud','dinero','viajes','estilo_vida','mentalidad')),
  timeframe    text not null check (timeframe in ('corto','mediano','largo')),
  status       text not null default 'sonado' check (status in ('sonado','planificacion','en_proceso','logrado')),
  priority     text not null default 'media' check (priority in ('alta','media','baja')),
  target_date  date,
  description  text,
  image_url    text,
  position     integer default 0,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

alter table pm_future_visions enable row level security;

create policy "pm_future_visions: user owns rows"
  on pm_future_visions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger pm_future_visions_updated_at
  before update on pm_future_visions
  for each row execute function pm_set_updated_at();

create index if not exists pm_future_visions_user on pm_future_visions(user_id);
create index if not exists pm_future_visions_area on pm_future_visions(user_id, area);
create index if not exists pm_future_visions_status on pm_future_visions(user_id, status);
