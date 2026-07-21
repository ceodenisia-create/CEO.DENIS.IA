#!/usr/bin/env node
// Servidor MCP para CEO DENIS — expone las tablas pm_* de Supabase como
// herramientas que cualquier cliente MCP (Hermes Agent, Claude, etc.) puede
// usar. Corre localmente (stdio), pensado para que Hermes lo levante como
// subproceso. Usa la service role key: es de un solo usuario (Denis), sin
// sesión de navegador de por medio.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PM_USER_ID = process.env.PM_USER_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PM_USER_ID) {
  console.error('[ceo-denis-mcp] Faltan variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY, PM_USER_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const today = () => new Date().toISOString().split('T')[0];

async function findOneByTitle(table, titleCol, query) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', PM_USER_ID)
    .ilike(titleCol, `%${query}%`)
    .limit(5);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`No encontré "${query}" en ${table}.`);
  if (data.length > 1) {
    const names = data.map(d => d[titleCol]).join(', ');
    throw new Error(`Hay ${data.length} coincidencias para "${query}": ${names}. Sé más específico.`);
  }
  return data[0];
}

const server = new McpServer({ name: 'ceo-denis', version: '1.0.0' });

// ── Tareas ──────────────────────────────────────────────────────────────

server.registerTool('list_tasks', {
  title: 'Listar tareas de CEO DENIS',
  description: 'Lista tareas de CEO DENIS. Sin filtros trae las no completadas. Usar para responder "qué tengo pendiente", "qué vence hoy", etc.',
  inputSchema: {
    status: z.enum(['inbox', 'hoy', 'en_curso', 'esperando', 'hecho']).optional().describe('Filtrar por estado exacto'),
    only_overdue: z.boolean().optional().describe('Solo tareas vencidas (due_date < hoy, no hechas)'),
    only_mit: z.boolean().optional().describe('Solo tareas marcadas como MIT (prioridad del día)'),
  },
}, async ({ status, only_overdue, only_mit }) => {
  let q = supabase.from('pm_tasks').select('*').eq('user_id', PM_USER_ID);
  if (status) q = q.eq('status', status);
  else if (!only_overdue) q = q.neq('status', 'hecho');
  if (only_overdue) q = q.lt('due_date', today()).neq('status', 'hecho');
  if (only_mit) q = q.eq('is_mit', true).neq('status', 'hecho');
  const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).limit(50);
  if (error) throw new Error(error.message);
  if (!data.length) return { content: [{ type: 'text', text: 'No hay tareas que coincidan.' }] };
  const lines = data.map(t => `- [${t.status}] ${t.title}${t.is_mit ? ' ★MIT' : ''} | prioridad ${t.priority} | ${t.due_date ?? 'sin fecha'}`);
  return { content: [{ type: 'text', text: lines.join('\n') }] };
});

server.registerTool('create_task', {
  title: 'Crear tarea en CEO DENIS',
  description: 'Crea una tarea nueva en CEO DENIS.',
  inputSchema: {
    title: z.string().describe('Título de la tarea'),
    notes: z.string().optional(),
    area: z.enum(['modeltex', 'moldey', 'personal', 'sistemas']).optional().default('personal'),
    priority: z.enum(['alta', 'media', 'baja']).optional().default('media'),
    status: z.enum(['inbox', 'hoy', 'en_curso', 'esperando', 'hecho']).optional().default('inbox'),
    due_date: z.string().optional().describe('YYYY-MM-DD'),
    is_mit: z.boolean().optional().default(false),
  },
}, async (args) => {
  const { data, error } = await supabase.from('pm_tasks').insert({
    user_id: PM_USER_ID,
    title: args.title,
    notes: args.notes ?? null,
    area: args.area ?? 'personal',
    priority: args.priority ?? 'media',
    status: args.status ?? 'inbox',
    due_date: args.due_date ?? null,
    is_mit: args.is_mit ?? false,
  }).select().single();
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Creé la tarea "${data.title}" (${data.status}, prioridad ${data.priority}).` }] };
});

server.registerTool('complete_task', {
  title: 'Completar tarea en CEO DENIS',
  description: 'Marca una tarea como hecha, buscándola por texto en el título.',
  inputSchema: { task_query: z.string().describe('Texto para buscar la tarea por título') },
}, async ({ task_query }) => {
  const task = await findOneByTitle('pm_tasks', 'title', task_query);
  const { error } = await supabase.from('pm_tasks').update({ status: 'hecho' }).eq('id', task.id);
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Marqué "${task.title}" como hecha.` }] };
});

server.registerTool('update_task', {
  title: 'Editar tarea en CEO DENIS',
  description: 'Edita una tarea existente, buscándola por texto en el título.',
  inputSchema: {
    task_query: z.string(),
    title: z.string().optional(),
    notes: z.string().optional(),
    priority: z.enum(['alta', 'media', 'baja']).optional(),
    status: z.enum(['inbox', 'hoy', 'en_curso', 'esperando', 'hecho']).optional(),
    due_date: z.string().optional(),
    is_mit: z.boolean().optional(),
  },
}, async ({ task_query, ...updates }) => {
  const task = await findOneByTitle('pm_tasks', 'title', task_query);
  const patch = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
  const { error } = await supabase.from('pm_tasks').update(patch).eq('id', task.id);
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Actualicé "${task.title}".` }] };
});

server.registerTool('delete_task', {
  title: 'Borrar tarea en CEO DENIS',
  description: 'Borra una tarea, buscándola por texto en el título. Usar con cuidado, es irreversible.',
  inputSchema: { task_query: z.string() },
}, async ({ task_query }) => {
  const task = await findOneByTitle('pm_tasks', 'title', task_query);
  const { error } = await supabase.from('pm_tasks').delete().eq('id', task.id);
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Borré la tarea "${task.title}".` }] };
});

// ── Proyectos y metas ──────────────────────────────────────────────────

server.registerTool('create_project', {
  title: 'Crear proyecto en CEO DENIS',
  description: 'Crea un proyecto nuevo en CEO DENIS.',
  inputSchema: {
    name: z.string(),
    description: z.string().optional(),
    area: z.enum(['modeltex', 'moldey', 'personal', 'sistemas']).optional().default('personal'),
    priority: z.enum(['alta', 'media', 'baja']).optional().default('media'),
    target_date: z.string().optional(),
    next_step: z.string().optional(),
  },
}, async (args) => {
  const { data, error } = await supabase.from('pm_projects').insert({
    user_id: PM_USER_ID,
    name: args.name,
    description: args.description ?? null,
    area: args.area ?? 'personal',
    status: 'activo',
    priority: args.priority ?? 'media',
    progress: 0,
    target_date: args.target_date ?? null,
    next_step: args.next_step ?? null,
  }).select().single();
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Creé el proyecto "${data.name}".` }] };
});

server.registerTool('create_goal', {
  title: 'Crear meta en CEO DENIS',
  description: 'Crea una meta nueva en CEO DENIS.',
  inputSchema: {
    title: z.string(),
    area: z.enum(['modeltex', 'moldey', 'personal', 'sistemas']).optional().default('personal'),
    timeframe: z.enum(['corto', 'mediano', 'largo']).optional().default('corto'),
    deadline: z.string().optional(),
    next_step: z.string().optional(),
  },
}, async (args) => {
  const { data, error } = await supabase.from('pm_goals').insert({
    user_id: PM_USER_ID,
    title: args.title,
    area: args.area ?? 'personal',
    timeframe: args.timeframe ?? 'corto',
    deadline: args.deadline ?? null,
    next_step: args.next_step ?? null,
  }).select().single();
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Creé la meta "${data.title}".` }] };
});

// ── Hábitos ─────────────────────────────────────────────────────────────

server.registerTool('create_habit', {
  title: 'Crear hábito en CEO DENIS',
  description: 'Crea un hábito nuevo en la sección Disciplina de CEO DENIS.',
  inputSchema: {
    name: z.string(),
    area: z.enum(['salud', 'trabajo', 'estudio', 'dinero', 'familia', 'mentalidad', 'personal']).optional().default('personal'),
    frequency: z.enum(['diario', 'semanal']).optional().default('diario'),
    priority: z.enum(['alta', 'media', 'baja']).optional().default('media'),
    note: z.string().optional(),
  },
}, async (args) => {
  const { data, error } = await supabase.from('pm_habits').insert({
    user_id: PM_USER_ID,
    name: args.name,
    area: args.area ?? 'personal',
    frequency: args.frequency ?? 'diario',
    priority: args.priority ?? 'media',
    note: args.note ?? null,
  }).select().single();
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Creé el hábito "${data.name}".` }] };
});

server.registerTool('log_habit', {
  title: 'Registrar hábito de hoy en CEO DENIS',
  description: 'Marca un hábito como cumplido, fallado o pausado para el día de hoy.',
  inputSchema: {
    habit_query: z.string().describe('Texto para buscar el hábito por nombre'),
    status: z.enum(['completed', 'failed', 'paused']),
    note: z.string().optional(),
  },
}, async ({ habit_query, status, note }) => {
  const habit = await findOneByTitle('pm_habits', 'name', habit_query);
  const { error } = await supabase.from('pm_habit_logs').upsert({
    habit_id: habit.id,
    user_id: PM_USER_ID,
    log_date: today(),
    status,
    note: note ?? null,
  }, { onConflict: 'habit_id,log_date' });
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Registré "${habit.name}" como ${status} hoy.` }] };
});

// ── Bitácora y memoria ──────────────────────────────────────────────────

server.registerTool('create_journal_entry', {
  title: 'Crear entrada de Bitácora en CEO DENIS',
  description: 'Crea una entrada en la Bitácora (diario, idea, decisión, plan, lección o cierre del día).',
  inputSchema: {
    type: z.enum(['diario', 'idea', 'decision', 'plan', 'leccion', 'cierre_diario']),
    title: z.string(),
    content: z.string().optional(),
  },
}, async ({ type, title, content }) => {
  const { data, error } = await supabase.from('pm_journal_entries').insert({
    user_id: PM_USER_ID,
    type,
    title,
    content: content ?? null,
    entry_date: today(),
  }).select().single();
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Guardé en Bitácora: "${data.title}" (${type}).` }] };
});

server.registerTool('add_memory', {
  title: 'Guardar memoria en CEO DENIS',
  description: 'Guarda un hecho, regla o preferencia persistente en la Memoria IA de CEO DENIS, para que el asistente lo tenga en cuenta siempre.',
  inputSchema: {
    title: z.string(),
    content: z.string(),
    category: z.string().optional().default('general'),
    importance: z.number().min(1).max(5).optional().default(3),
  },
}, async (args) => {
  const { data, error } = await supabase.from('pm_ai_memory').insert({
    user_id: PM_USER_ID,
    title: args.title,
    content: args.content,
    category: args.category ?? 'general',
    importance: args.importance ?? 3,
    is_active: true,
  }).select().single();
  if (error) throw new Error(error.message);
  return { content: [{ type: 'text', text: `Guardé en memoria: "${data.title}".` }] };
});

// ── Resumen diario (para reportes por cron) ─────────────────────────────

server.registerTool('get_daily_summary', {
  title: 'Resumen diario de CEO DENIS',
  description: 'Trae un resumen del día: tareas MIT, tareas de hoy, tareas vencidas y hábitos pendientes de hoy. Ideal para un reporte matutino automático.',
  inputSchema: {},
}, async () => {
  const t = today();
  const [tasksRes, habitsRes, logsRes] = await Promise.all([
    supabase.from('pm_tasks').select('*').eq('user_id', PM_USER_ID).neq('status', 'hecho'),
    supabase.from('pm_habits').select('*').eq('user_id', PM_USER_ID).eq('status', 'activo'),
    supabase.from('pm_habit_logs').select('*').eq('user_id', PM_USER_ID).eq('log_date', t),
  ]);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (habitsRes.error) throw new Error(habitsRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);

  const tasks = tasksRes.data ?? [];
  const mit = tasks.filter(x => x.is_mit);
  const todayTasks = tasks.filter(x => x.due_date === t || x.status === 'hoy');
  const overdue = tasks.filter(x => x.due_date && x.due_date < t);
  const habits = habitsRes.data ?? [];
  const loggedIds = new Set((logsRes.data ?? []).map(l => l.habit_id));
  const pendingHabits = habits.filter(h => !loggedIds.has(h.id));

  const lines = [
    `=== Resumen ${t} ===`,
    `MIT (${mit.length}): ${mit.map(x => x.title).join(', ') || 'ninguna'}`,
    `Hoy (${todayTasks.length}): ${todayTasks.map(x => x.title).join(', ') || 'ninguna'}`,
    `Vencidas (${overdue.length}): ${overdue.map(x => x.title).join(', ') || 'ninguna'}`,
    `Hábitos sin registrar hoy (${pendingHabits.length}): ${pendingHabits.map(x => x.name).join(', ') || 'ninguno'}`,
  ];
  return { content: [{ type: 'text', text: lines.join('\n') }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[ceo-denis-mcp] listo, esperando por stdio.');
