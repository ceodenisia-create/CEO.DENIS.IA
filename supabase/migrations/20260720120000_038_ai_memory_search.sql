-- Memoria IA más inteligente: búsqueda de texto completo en vez de mandar
-- siempre las 200+ memorias enteras al modelo en cada mensaje.
alter table pm_ai_memory
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(category, '')), 'C')
  ) stored;

create index if not exists pm_ai_memory_search_idx on pm_ai_memory using gin(search_vector);
