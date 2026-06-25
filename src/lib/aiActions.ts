// Capa de acciones del Asistente IA (se ejecuta en el frontend, con sesión + RLS del usuario).
// Reutiliza los helpers existentes de planMaestro. No usa service_role.

import {
  type Area, type Priority, type TaskStatus,
  type JournalType,
  DEFAULT_BUSINESSES,
  createTask, createProject, createGoal,
  createJournalEntry, upsertCierre, upsertTimeBlock,
  getTasks, getGoals, getProjects, getKanbanColumns,
  moveTaskToSystemColumn, moveTaskToCustomColumn, updateTask,
} from './planMaestro';

const TODAY = () => new Date().toISOString().split('T')[0];

export interface AiAction {
  type: string;
  params: Record<string, unknown>;
}

export interface ParsedReply {
  actions: AiAction[];
  reply: string;
}

// Extrae un objeto JSON de acciones de la respuesta del modelo.
// Acepta bloque ```json ... ``` o un objeto crudo que empiece con {.
export function parseAiReply(text: string): ParsedReply | null {
  if (!text) return null;
  let jsonStr: string | null = null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) jsonStr = fenced[1].trim();
  else if (text.trim().startsWith('{')) jsonStr = text.trim();

  if (!jsonStr) return null;
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && Array.isArray(obj.actions) && obj.actions.length > 0) {
      return { actions: obj.actions, reply: typeof obj.reply === 'string' ? obj.reply : '' };
    }
  } catch { /* no es JSON de acciones */ }
  return null;
}

// ── Helpers de normalización ──
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const bool = (v: unknown): boolean => v === true || v === 'true';

function normPriority(v: unknown): Priority {
  const p = str(v).toLowerCase();
  if (p.startsWith('alt')) return 'alta';
  if (p.startsWith('baj')) return 'baja';
  return 'media';
}

function normBusiness(v: unknown): string | null {
  const b = str(v).toLowerCase();
  // Verificar modeltex_ia ANTES de modeltex (es más específico)
  if (b.includes('modeltex_ia') || b.includes('modeltex ia')) return 'modeltex_ia';
  if (b.includes('modeltex')) return 'modeltex';
  if (b.includes('moldey')) return 'moldey';
  return null;
}

function areaFromBusiness(business: string | null, areaRaw?: unknown): Area {
  const a = str(areaRaw).toLowerCase();
  if (a === 'modeltex' || a === 'moldey' || a === 'personal' || a === 'sistemas') return a as Area;
  if (business === 'modeltex') return 'modeltex';
  if (business === 'moldey') return 'moldey';
  if (business === 'modeltex_ia') return 'sistemas';
  return 'personal';
}

const SYSTEM_STATUS: Record<string, TaskStatus> = {
  inbox: 'inbox', hoy: 'hoy', 'en curso': 'en_curso', en_curso: 'en_curso',
  encurso: 'en_curso', esperando: 'esperando', hecho: 'hecho',
  terminado: 'hecho', completado: 'hecho', listo: 'hecho',
};
function normStatus(v: unknown): TaskStatus {
  return SYSTEM_STATUS[str(v).toLowerCase().trim()] ?? 'inbox';
}

function minutes(v: unknown): number {
  if (typeof v === 'number') return Math.round(v);
  const n = parseInt(str(v).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function businessName(key: string): string {
  return DEFAULT_BUSINESSES.find(b => b.key === key)?.name ?? key.toUpperCase();
}

// ── Ejecutor ──
// Devuelve un string por acción (resultado para mostrar al usuario).
export async function executeAiActions(actions: AiAction[]): Promise<string[]> {
  const results: string[] = [];
  for (const a of actions) {
    try {
      results.push(await executeOne(a));
    } catch (e) {
      results.push(`No pude ejecutar "${a.type}": ${e instanceof Error ? e.message : 'error'}`);
    }
  }
  return results;
}

async function executeOne(a: AiAction): Promise<string> {
  const p = a.params || {};
  switch (a.type) {
    case 'create_task': {
      const business = normBusiness(p.business);

      // Buscar project_id por nombre si se menciona
      let projectId: string | null = null;
      const projName = str(p.project_name || p.project || p.proyecto);
      if (projName) {
        const projs = await getProjects().catch(() => []);
        const match = projs.find(pr =>
          pr.name.toLowerCase().includes(projName.toLowerCase()) ||
          projName.toLowerCase().includes(pr.name.toLowerCase())
        );
        if (match) projectId = match.id;
      }

      // Buscar goal_id por nombre si se menciona
      let goalId: string | null = null;
      const goalName = str(p.goal_name || p.goal || p.meta);
      if (goalName) {
        const gs = await getGoals().catch(() => []);
        const match = gs.find(g =>
          g.title.toLowerCase().includes(goalName.toLowerCase()) ||
          goalName.toLowerCase().includes(g.title.toLowerCase())
        );
        if (match) { goalId = match.id; if (!projectId) projectId = match.project_id; }
      }

      const t = await createTask({
        title: str(p.title, 'Tarea sin título'),
        notes: str(p.notes) || null,
        area: areaFromBusiness(business, p.area),
        priority: normPriority(p.priority),
        status: normStatus(p.status),
        is_mit: bool(p.is_mit),
        due_date: str(p.due_date) || null,
        position: 0,
        project_id: projectId,
        goal_id: goalId,
        business_key: business,
        column_key: null,
      });
      const bits = [`Prioridad: ${t.priority}`];
      if (t.due_date) bits.push(`Fecha: ${t.due_date}`);
      if (business) bits.push(`Negocio: ${businessName(business)}`);
      if (goalId) bits.push('vinculada a meta');
      if (t.is_mit) bits.push('MIT');
      return `Listo. Creé la tarea: "${t.title}". ${bits.join(' · ')}`;
    }

    case 'create_project': {
      const business = normBusiness(p.business);
      const proj = await createProject({
        name: str(p.name, 'Proyecto sin nombre'),
        description: str(p.description) || null,
        area: areaFromBusiness(business, p.area),
        color: null,
        status: 'activo',
        priority: normPriority(p.priority),
        start_date: str(p.start_date) || null,
        target_date: str(p.target_date) || null,
        progress: 0,
        next_step: str(p.next_step) || null,
        notes: str(p.notes) || null,
      });
      const bits = [`Estado: activo`, `Prioridad: ${proj.priority}`];
      if (proj.target_date) bits.push(`Fecha objetivo: ${proj.target_date}`);
      if (business) bits.push(`Negocio: ${businessName(business)}`);
      return `Listo. Creé el proyecto: "${proj.name}". ${bits.join(' · ')}`;
    }

    case 'create_goal': {
      const business = normBusiness(p.business);
      const tf = str(p.timeframe).toLowerCase();
      const timeframe = tf.startsWith('larg') ? 'largo' : tf.startsWith('med') ? 'mediano' : 'corto';

      // Buscar project_id por nombre si se menciona
      let projectId: string | null = null;
      const projName = str(p.project_name || p.project || p.proyecto);
      if (projName) {
        const projs = await getProjects().catch(() => []);
        const match = projs.find(pr =>
          pr.name.toLowerCase().includes(projName.toLowerCase()) ||
          projName.toLowerCase().includes(pr.name.toLowerCase())
        );
        if (match) projectId = match.id;
      }

      const g = await createGoal({
        title: str(p.title, 'Meta sin título'),
        area: areaFromBusiness(business, p.area),
        timeframe,
        deadline: str(p.deadline) || null,
        next_step: str(p.next_step) || null,
        progress_manual: null,
        notes: null,
        project_id: projectId,
      });
      const suffix = projectId ? ' · vinculada a proyecto' : ' · sin proyecto asignado (asignala desde Objetivos)';
      return `Listo. Creé la meta: "${g.title}". Plazo: ${g.timeframe}${g.deadline ? ` · Límite: ${g.deadline}` : ''}${suffix}`;
    }

    case 'create_journal_idea':
    case 'create_journal_decision':
    case 'create_journal_plan':
    case 'create_journal_lesson': {
      const typeMap: Record<string, JournalType> = {
        create_journal_idea: 'idea', create_journal_decision: 'decision',
        create_journal_plan: 'plan', create_journal_lesson: 'leccion',
      };
      const jt = typeMap[a.type];
      const business = normBusiness(p.business);
      const statusDefault: Record<string, string | null> = {
        idea: 'cruda', decision: 'tomada', plan: 'activo', leccion: null,
      };
      await createJournalEntry({
        type: jt,
        title: str(p.title, str(p.content, 'Entrada')),
        content: str(p.content) || null,
        entry_date: str(p.entry_date) || TODAY(),
        status: str(p.status) || statusDefault[jt],
        area: str(p.area) || null,
        priority: str(p.priority) || null,
        related_business: business ? businessName(business) : null,
        mood: null, energy_level: null, focus_level: null, tags: null, metadata: {},
      });
      const label: Record<JournalType, string> = {
        idea: 'idea', decision: 'decisión', plan: 'plan', leccion: 'lección',
        diario: 'entrada', cierre_diario: 'cierre',
      };
      return `Listo. Guardé la ${label[jt]} en Bitácora: "${str(p.title, str(p.content))}".`;
    }

    case 'create_daily_closure': {
      const date = str(p.entry_date) || TODAY();
      await upsertCierre(date, {
        title: str(p.title, `Cierre ${date}`),
        content: str(p.content) || null,
        status: null, area: null, priority: null,
        related_business: normBusiness(p.business) ? businessName(normBusiness(p.business)!) : null,
        mood: null, energy_level: null, focus_level: null, tags: null,
        metadata: {},
      });
      return `Listo. Registré el cierre diario de ${date}.`;
    }

    case 'plan_business_time':
    case 'log_business_time': {
      const business = normBusiness(p.business);
      if (!business) return 'No pude registrar el tiempo: especificá MODELTEX, MOLDEY o MODELTEX IA.';
      const date = str(p.date) || TODAY();
      const mins = minutes(p.minutes);
      if (mins <= 0) return 'No pude registrar el tiempo: falta la cantidad (en minutos u horas).';
      if (a.type === 'plan_business_time') {
        await upsertTimeBlock(business, businessName(business), date, { planned_minutes: mins });
        return `Listo. Planifiqué ${fmtMin(mins)} para ${businessName(business)} (${date}).`;
      } else {
        await upsertTimeBlock(business, businessName(business), date, { worked_minutes: mins });
        return `Listo. Registré ${fmtMin(mins)} trabajados en ${businessName(business)} (${date}).`;
      }
    }

    case 'move_task': {
      const match = await findTask(str(p.task_query));
      if (match.error) return match.error;
      const task = match.task!;
      const target = await resolveColumn(str(p.column));
      if (!target) return `No encontré la columna "${str(p.column)}".`;
      if (target.isSystem) await moveTaskToSystemColumn(task.id, target.key as TaskStatus);
      else await moveTaskToCustomColumn(task.id, target.key);
      return `Listo. Moví "${task.title}" a ${target.label}.`;
    }

    case 'assign_task_business': {
      const business = normBusiness(p.business);
      if (!business) return 'Especificá MODELTEX, MOLDEY o MODELTEX IA para asignar la tarea.';
      const match = await findTask(str(p.task_query));
      if (match.error) return match.error;
      await updateTask(match.task!.id, { business_key: business });
      return `Listo. Asigné "${match.task!.title}" a ${businessName(business)}.`;
    }

    default:
      return `Acción no reconocida: ${a.type}.`;
  }
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60), min = m % 60;
  if (h === 0) return `${min}min`;
  return min === 0 ? `${h}h` : `${h}h ${min}min`;
}

// Busca una tarea por coincidencia de título (parcial, case-insensitive).
async function findTask(query: string): Promise<{ task?: { id: string; title: string }; error?: string }> {
  const q = query.toLowerCase().trim();
  if (!q) return { error: 'No me dijiste qué tarea mover.' };
  const tasks = await getTasks();
  const matches = tasks.filter(t => t.title.toLowerCase().includes(q));
  if (matches.length === 0) return { error: `No encontré ninguna tarea que coincida con "${query}".` };
  if (matches.length > 1) {
    const list = matches.slice(0, 5).map(t => `• ${t.title}`).join('\n');
    return { error: `Hay varias tareas que coinciden con "${query}". ¿Cuál?\n${list}` };
  }
  return { task: matches[0] };
}

// Resuelve una columna por nombre: primero sistema, luego custom.
async function resolveColumn(name: string): Promise<{ key: string; label: string; isSystem: boolean } | null> {
  const sys = SYSTEM_STATUS[name.toLowerCase().trim()];
  const SYS_LABEL: Record<string, string> = {
    inbox: 'Inbox', hoy: 'Hoy', en_curso: 'En curso', esperando: 'Esperando', hecho: 'Hecho',
  };
  if (sys) return { key: sys, label: SYS_LABEL[sys], isSystem: true };
  const custom = await getKanbanColumns();
  const found = custom.find(c => c.name.toLowerCase() === name.toLowerCase().trim());
  if (found) return { key: found.key, label: found.name, isSystem: false };
  return null;
}
