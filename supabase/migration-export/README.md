# Migración de Plan Maestro (CEO DENIS) a un Supabase nuevo

Este paquete separa **solo** los datos de Plan Maestro del proyecto Supabase
compartido actual (`sdlkrcqithhqhwwmeets`, usado también por CEO MODELTEX).
Todo lo de acá se generó leyendo `supabase/migrations/*.sql` de este repo —
**no se conectó ni se escribió nada en el proyecto Supabase original.**

## Qué NO se toca del proyecto viejo

No se copia ni se borra nada de: `customers`, `orders`, `order_history`,
`garment_types`, `inventory_models`, `mold_library`, `internal_catalog`,
`employees`, `employee_attendance`, `employee_payments`, `finances`,
`finance_movements`, `library_files`, `client_files`, `agenda_events`,
`savings_goals`, `savings_contributions`, `ai_conversations`/`ai_messages`
(viejas, sin prefijo), ni los buckets `mold-files`, `order-files`,
`catalog-images`, `client-files`. Tampoco las funciones `is_agenda_admin()`
ni `can_access_agenda()` (solo las usa Modeltex).

## Paso 1 — Crear el proyecto Supabase nuevo

En la cuenta destino: **New project** en supabase.com/dashboard. Guardá la
`Project URL` y la `anon public key` (Settings > API) — van a `.env` de este
repo después.

## Paso 2 — Aplicar el esquema

Los archivos de `schema/` están en el orden correcto para pegarlos uno por
uno en **SQL Editor** del proyecto nuevo (o vía `supabase db push` si
preferís linkear el proyecto nuevo con la CLI). Orden:

1. `00_shared_auth_user_profiles.sql` — tabla `user_profiles`, funciones
   `is_admin()` / `handle_new_user()`, trigger de auto-alta, políticas RLS.
   Extraído a mano de las migraciones 009/018/020 del proyecto viejo,
   quitando todo lo de Modeltex.
2. `00_vision_images_bucket.sql` — crea el bucket `vision-images` (en el
   proyecto viejo se creó a mano desde el Dashboard, no está en ninguna
   migración).
3. `01_...` a `18_...` — copias **textuales, sin modificar**, de las
   migraciones `022` a `037` + `oficina.sql` del proyecto viejo. Todas son
   100% de Plan Maestro (prefijo `pm_`), verificadas con grep para
   descartar referencias cruzadas a tablas de Modeltex.

## Paso 3 — Exportar los DATOS del proyecto viejo (solo lectura)

Necesitás el **connection string** del proyecto viejo (Dashboard >
Settings > Database > Connection string, modo *URI*, con la contraseña de
la base). Con eso, desde tu máquina (no hace falta que yo tenga esa
contraseña):

```bash
# Todas las tablas pm_* — es seguro dumpear TODO sin filtrar por usuario,
# porque ninguna fila de pm_* pertenece a Modeltex (Modeltex nunca las usa).
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --data-only --column-inserts \
  -t 'pm_*' \
  > pm_data.sql
```

Luego, en el proyecto **nuevo**, correr `pm_data.sql` en el SQL Editor (o
`psql` contra el connection string nuevo) — pero recién después del Paso 4,
porque las filas `pm_*` tienen `user_id` que debe existir en `auth.users`
del proyecto nuevo antes de insertarlas (por el `FOREIGN KEY`).

## Paso 4 — Usuarios (la parte delicada)

`user_profiles` es la única tabla realmente compartida entre las dos apps,
así que **no conviene** volcar `auth.users`/`auth.identities` en crudo — es
frágil y evitable. Confirmado: el único usuario de Plan Maestro es
`j.denis.ia.1305@gmail.com` (la cuenta `ceo.modletex@gmail.com` queda
afuera, es solo de Modeltex). Pasos:

1. En el proyecto nuevo: Authentication > Users > **Invite user** con
   `j.denis.ia.1305@gmail.com` (o hacer *sign up* normal desde la app ya
   apuntando al proyecto nuevo). Esto dispara `handle_new_user()` y crea la
   fila en `user_profiles` con rol `asistente` por defecto.
2. Darle rol admin — correr en el SQL Editor del proyecto nuevo:
   ```sql
   update user_profiles set role = 'admin'
   where email = 'j.denis.ia.1305@gmail.com';
   ```

Como solo hay un usuario, todas las filas `pm_*` del dump (Paso 3) le
pertenecen a él — no hace falta filtrar nada por `user_id`.

## Paso 5 — Storage: copiar `vision-images`

Desde el Dashboard del proyecto viejo (Storage > `vision-images`), bajar
los archivos, y subirlos al mismo path (`{user_id}/...`) en el bucket
nuevo — las políticas ya están armadas para ese formato de carpeta.

## Paso 6 — Vercel + variables de entorno

En el repo (`.env`, y en el proyecto Vercel nuevo, Settings > Environment
Variables):

```
VITE_SUPABASE_URL=<URL del proyecto nuevo>
VITE_SUPABASE_ANON_KEY=<anon key del proyecto nuevo>
OPENROUTER_API_KEY=<tu key de OpenRouter, para /api/ai-chat>
```

Y en [.env.desktop](../../.env.desktop), actualizar `VITE_API_BASE` con la
URL del nuevo deploy de Vercel (la app de escritorio la usa para llamar a
`/api/ai-chat`).

No hace falta cuenta nueva de Cloudflare: `api/r2-upload.js` y
`api/r2-migrate.js` son de Modeltex (usan la tabla `internal_catalog`) y el
frontend de Plan Maestro nunca los llama.
