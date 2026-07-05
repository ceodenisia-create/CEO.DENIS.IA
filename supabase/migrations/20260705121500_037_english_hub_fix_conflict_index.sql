-- 037 English Hub: corrige el indice unico de pm_eng_user_words.
-- El indice parcial (where catalog_word_id is not null) no puede resolver
-- ON CONFLICT (user_id, catalog_word_id) via PostgREST (error 42P10).
-- Un indice unico simple funciona igual: Postgres no considera duplicados
-- los NULL en un indice unico, asi que las filas 'custom' (catalog_word_id
-- null) igual pueden repetirse sin problema.

drop index if exists pm_eng_user_words_user_catalog;

create unique index if not exists pm_eng_user_words_user_catalog
  on pm_eng_user_words(user_id, catalog_word_id);
