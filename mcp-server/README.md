# Servidor MCP de CEO DENIS

Expone las tablas `pm_*` de CEO DENIS como herramientas MCP (crear/completar
tareas, hábitos, proyectos, metas, bitácora, memoria) para que cualquier
cliente MCP —Hermes Agent, Claude Desktop, etc.— pueda operarlas.

Corre localmente por stdio (Hermes lo levanta como subproceso, no hace
falta tenerlo corriendo aparte ni exponer un puerto).

## Variables de entorno requeridas

- `SUPABASE_URL` — `https://ccqbofpojhcuaasqrhpl.supabase.co`
- `SUPABASE_SERVICE_KEY` — la clave `service_role` del proyecto (Settings →
  API Keys → Secret keys en el dashboard de Supabase). Bypasea RLS a
  propósito: no hay sesión de navegador en este contexto.
- `PM_USER_ID` — el UUID del usuario dueño de los datos (single-user):
  `b7acabbb-54fa-4e68-99b0-be2b8670fb6c`

**Nunca subir estos valores a git.** Se pasan como `env` en la config del
cliente MCP (ver más abajo), no en un `.env` versionado.

## Instalación

```bash
cd mcp-server
npm install
```

## Probarlo suelto (sin Hermes)

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... PM_USER_ID=... node index.js
```

Se queda esperando por stdio — es normal, así lo consume un cliente MCP.
Para probar interactivo, usar el inspector oficial:

```bash
npx @modelcontextprotocol/inspector node index.js
```

## Conectarlo a Hermes Agent

En `config.yaml` de Hermes (`%LOCALAPPDATA%\hermes\config.yaml`), agregar
bajo `mcp_servers`:

```yaml
mcp_servers:
  ceo-denis:
    command: node
    args: ["C:\\Users\\Pc\\plan-maestro\\mcp-server\\index.js"]
    env:
      SUPABASE_URL: "https://ccqbofpojhcuaasqrhpl.supabase.co"
      SUPABASE_SERVICE_KEY: "<service_role key>"
      PM_USER_ID: "b7acabbb-54fa-4e68-99b0-be2b8670fb6c"
```

Después de guardar, Hermes detecta el cambio solo (o `/reload-mcp` en el
CLI) y las herramientas quedan disponibles para usar desde cualquier canal
conectado (WhatsApp, Telegram, Discord, CLI).

## Herramientas disponibles

`list_tasks`, `create_task`, `complete_task`, `update_task`, `delete_task`,
`create_project`, `create_goal`, `create_habit`, `log_habit`,
`create_journal_entry`, `add_memory`, `get_daily_summary`.

Es el mismo patrón que las acciones de `src/lib/aiActions.ts` del asistente
web — agregar una herramienta nueva es copiar el bloque `server.registerTool`
de una parecida y ajustar la tabla/columnas.
