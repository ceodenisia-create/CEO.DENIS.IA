-- Radar: evaluaciones de vida por áreas
-- Prefijo pm_ — mismo patrón que el resto del proyecto

-- ─── EVALUACIONES ────────────────────────────────────────────────────────────
create table if not exists pm_radar_evaluations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  title           text not null,
  evaluation_date date not null default current_date,
  general_note    text,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table pm_radar_evaluations enable row level security;

create policy "pm_radar_evaluations: user owns rows"
  on pm_radar_evaluations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── PUNTAJES POR ÁREA ───────────────────────────────────────────────────────
create table if not exists pm_radar_scores (
  id              uuid primary key default gen_random_uuid(),
  evaluation_id   uuid references pm_radar_evaluations(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  area_name       text not null,
  current_score   integer not null default 5 check (current_score between 1 and 10),
  target_score    integer not null default 8 check (target_score between 1 and 10),
  note            text,
  main_action     text,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  unique (evaluation_id, area_name)
);

alter table pm_radar_scores enable row level security;

create policy "pm_radar_scores: user owns via evaluation"
  on pm_radar_scores for all
  using (
    exists (
      select 1 from pm_radar_evaluations e
      where e.id = evaluation_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pm_radar_evaluations e
      where e.id = evaluation_id and e.user_id = auth.uid()
    )
  );

-- ─── TRIGGERS updated_at ─────────────────────────────────────────────────────
create trigger pm_radar_evaluations_updated_at
  before update on pm_radar_evaluations
  for each row execute function pm_set_updated_at();

create trigger pm_radar_scores_updated_at
  before update on pm_radar_scores
  for each row execute function pm_set_updated_at();

-- ─── ÍNDICES ─────────────────────────────────────────────────────────────────
create index if not exists pm_radar_evaluations_user on pm_radar_evaluations(user_id, evaluation_date desc);
create index if not exists pm_radar_scores_evaluation on pm_radar_scores(evaluation_id);
create index if not exists pm_radar_scores_user on pm_radar_scores(user_id);
