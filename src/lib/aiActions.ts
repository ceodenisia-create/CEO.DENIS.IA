// Capa de acciones del Asistente IA (se ejecuta en el frontend, con sesión + RLS del usuario).
// Reutiliza los helpers existentes de planMaestro. No usa service_role.

import {
  type Area, type Priority, type TaskStatus, type ProjectStatus,
  type JournalType, type Project, type Goal,
  type HabitArea, type HabitLogStatus, type VisionArea, type VisionStatus, type Timeframe,
  DEFAULT_BUSINESSES,
  createTask, createProject, createGoal,
  createJournalEntry, upsertCierre, upsertTimeBlock,
  getTasks, getGoals, getProjects, getKanbanColumns,
  moveTaskToSystemColumn, moveTaskToCustomColumn, updateTask,
  deleteTask, updateProject, deleteProject, updateGoal, deleteGoal,
  getJournalEntries, updateJournalEntry, deleteJournalEntry,
  createHabit, upsertHabitLog, getHabits,
  createFutureVision, createAiMemory,
  createKanbanColumn,
  getWeekStart, getWeekDays, getOrCreateWeekBoard, updateWeekBoard, linkWeekTask,
  getEngWordByText, toggleEngWordState,
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

function clampPct(v: unknown): number {
  const n = minutes(v);
  return Math.max(0, Math.min(100, n));
}

function normProjectStatus(v: unknown): ProjectStatus {
  const s = str(v).toLowerCase();
  if (s.startsWith('final') || s.includes('termin') || s.includes('complet')) return 'finalizado';
  if (s.includes('pausa')) return 'en_pausa';
  if (s.includes('cancel')) return 'cancelado';
  if (s.includes('plane')) return 'planeado';
  return 'activo';
}

function normTimeframe(v: unknown): Timeframe {
  const s = str(v).toLowerCase();
  if (s.startsWith('larg')) return 'largo';
  if (s.startsWith('med')) return 'mediano';
  return 'corto';
}

function normHabitArea(v: unknown): HabitArea {
  const s = str(v).toLowerCase();
  const valid: HabitArea[] = ['salud', 'trabajo', 'estudio', 'dinero', 'familia', 'mentalidad', 'personal'];
  return (valid.find(a => s.includes(a)) ?? 'personal') as HabitArea;
}

function normVisionArea(v: unknown): VisionArea {
  const s = str(v).toLowerCase();
  const valid: VisionArea[] = ['negocios', 'familia', 'salud', 'dinero', 'viajes', 'estilo_vida', 'mentalidad', 'otra'];
  return (valid.find(a => s.includes(a.replace('_', ' ')) || s.includes(a)) ?? 'otra') as VisionArea;
}

function normVisionStatus(v: unknown): VisionStatus {
  const s = str(v).toLowerCase();
  if (s.includes('logr')) return 'logrado';
  if (s.includes('proceso')) return 'en_proceso';
  if (s.includes('planif')) return 'planificacion';
  return 'sonado';
}

async function findProject(query: string): Promise<{ project?: Project; error?: string }> {
  const q = query.toLowerCase().trim();
  if (!q) return { error: 'No me dijiste qué proyecto.' };
  const projs = await getProjects();
  const matches = projs.filter(p => p.name.toLowerCase().includes(q));
  if (matches.length === 0) return { error: `No encontré ningún proyecto que coincida con "${query}".` };
  if (matches.length > 1) return { error: `Hay varios proyectos con "${query}": ${matches.slice(0, 5).map(p => p.name).join(', ')}. ¿Cuál?` };
  return { project: matches[0] };
}

async function findGoal(query: string): Promise<{ goal?: Goal; error?: string }> {
  const q = query.toLowerCase().trim();
  if (!q) return { error: 'No me dijiste qué meta.' };
  const gs = await getGoals();
  const matches = gs.filter(g => g.title.toLowerCase().includes(q));
  if (matches.length === 0) return { error: `No encontré ninguna meta que coincida con "${query}".` };
  if (matches.length > 1) return { error: `Hay varias metas con "${query}": ${matches.slice(0, 5).map(g => g.title).join(', ')}. ¿Cuál?` };
  return { goal: matches[0] };
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
    case 'create_journal_lesson':
    case 'create_journal_mindset': {
      const typeMap: Record<string, JournalType> = {
        create_journal_idea: 'idea', create_journal_decision: 'decision',
        create_journal_plan: 'plan', create_journal_lesson: 'leccion',
        create_journal_mindset: 'mentalidad',
      };
      const jt = typeMap[a.type];
      const business = normBusiness(p.business);
      const statusDefault: Record<string, string | null> = {
        idea: 'cruda', decision: 'tomada', plan: 'activo', leccion: null, mentalidad: 'nueva',
      };
      const metadata: Record<string, unknown> = {};
      if (jt === 'mentalidad') {
        if (str(p.categoria)) metadata.categoria = str(p.categoria);
        if (str(p.fuente)) metadata.fuente = str(p.fuente);
        if (str(p.por_que)) metadata.por_que = str(p.por_que);
      }
      await createJournalEntry({
        type: jt,
        title: str(p.title, str(p.content, 'Entrada')),
        content: str(p.content) || null,
        entry_date: str(p.entry_date) || TODAY(),
        status: str(p.status) || statusDefault[jt],
        area: str(p.area) || null,
        priority: str(p.priority) || null,
        related_business: business ? businessName(business) : null,
        mood: null, energy_level: null, focus_level: null, tags: null, metadata,
      });
      const label: Record<JournalType, string> = {
        idea: 'idea', decision: 'decisión', plan: 'plan', leccion: 'lección',
        diario: 'entrada', cierre_diario: 'cierre', mentalidad: 'nota de mentalidad',
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

    case 'set_week_focus': {
      const board = await getOrCreateWeekBoard(getWeekStart());
      const fields: { enfoque?: string | null; meta_principal?: string | null } = {};
      if (p.enfoque !== undefined) fields.enfoque = str(p.enfoque) || null;
      if (p.meta !== undefined || p.meta_principal !== undefined) fields.meta_principal = str(p.meta || p.meta_principal) || null;
      await updateWeekBoard(board.id, fields);
      return `Listo. Actualicé la semana${fields.enfoque ? ` · Enfoque: ${fields.enfoque}` : ''}${fields.meta_principal ? ` · Meta: ${fields.meta_principal}` : ''}.`;
    }

    case 'add_week_indicator': {
      const board = await getOrCreateWeekBoard(getWeekStart());
      const name = str(p.name).trim();
      if (!name) return 'Falta el nombre del indicador.';
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}`;
      const next = [...(board.indicators ?? []), { id, name, objetivo: minutes(p.objetivo), logrado: minutes(p.logrado) }];
      await updateWeekBoard(board.id, { indicators: next });
      return `Listo. Agregué el objetivo semanal "${name}" (meta ${minutes(p.objetivo)}).`;
    }

    case 'update_week_indicator': {
      const board = await getOrCreateWeekBoard(getWeekStart());
      const q = str(p.name).toLowerCase().trim();
      const inds = board.indicators ?? [];
      const found = inds.find(i => i.name.toLowerCase().includes(q));
      if (!found) return `No encontré el indicador "${str(p.name)}".`;
      const next = inds.map(i => {
        if (i.id !== found.id) return i;
        let logrado = i.logrado;
        if (p.add !== undefined) logrado = Math.max(0, i.logrado + minutes(p.add));
        if (p.logrado !== undefined) logrado = minutes(p.logrado);
        const objetivo = p.objetivo !== undefined ? minutes(p.objetivo) : i.objetivo;
        return { ...i, logrado, objetivo };
      });
      await updateWeekBoard(board.id, { indicators: next });
      const upd = next.find(i => i.id === found.id)!;
      return `Listo. "${found.name}": ${upd.logrado}/${upd.objetivo}.`;
    }

    case 'add_day_task': {
      const business = normBusiness(p.business);
      const due = resolveDay(p.day);
      const t = await createTask({
        title: str(p.title, 'Tarea'),
        notes: null,
        area: areaFromBusiness(business, p.area),
        priority: normPriority(p.priority),
        status: 'hoy',
        is_mit: false,
        due_date: due,
        position: 0,
        project_id: null, goal_id: null,
        business_key: business, column_key: null,
      });
      return `Listo. Creé la tarea "${t.title}" en el tablero del ${due}.`;
    }

    // ── TAREAS: editar / completar / borrar ──
    case 'update_task': {
      const m = await findTask(str(p.task_query || p.task));
      if (m.error) return m.error;
      const patch: Record<string, unknown> = {};
      if (p.title !== undefined) patch.title = str(p.title);
      if (p.due_date !== undefined) patch.due_date = str(p.due_date) || null;
      if (p.priority !== undefined) patch.priority = normPriority(p.priority);
      if (p.status !== undefined) patch.status = normStatus(p.status);
      if (p.notes !== undefined) patch.notes = str(p.notes) || null;
      if (p.is_mit !== undefined) patch.is_mit = bool(p.is_mit);
      await updateTask(m.task!.id, patch);
      return `Listo. Actualicé la tarea "${m.task!.title}".`;
    }

    case 'complete_task': {
      const m = await findTask(str(p.task_query || p.task));
      if (m.error) return m.error;
      await updateTask(m.task!.id, { status: 'hecho' });
      return `Listo. Marqué como hecha "${m.task!.title}".`;
    }

    case 'delete_task': {
      const m = await findTask(str(p.task_query || p.task));
      if (m.error) return m.error;
      await deleteTask(m.task!.id);
      return `Listo. Borré la tarea "${m.task!.title}".`;
    }

    // ── PROYECTOS: editar / borrar ──
    case 'update_project': {
      const r = await findProject(str(p.project_query || p.project || p.name));
      if (r.error) return r.error;
      const patch: Record<string, unknown> = {};
      if (p.new_name !== undefined) patch.name = str(p.new_name);
      if (p.status !== undefined) patch.status = normProjectStatus(p.status);
      if (p.priority !== undefined) patch.priority = normPriority(p.priority);
      if (p.progress !== undefined) patch.progress = clampPct(p.progress);
      if (p.target_date !== undefined) patch.target_date = str(p.target_date) || null;
      if (p.next_step !== undefined) patch.next_step = str(p.next_step) || null;
      if (p.notes !== undefined) patch.notes = str(p.notes) || null;
      await updateProject(r.project!.id, patch);
      return `Listo. Actualicé el proyecto "${r.project!.name}".`;
    }

    case 'delete_project': {
      const r = await findProject(str(p.project_query || p.project || p.name));
      if (r.error) return r.error;
      await deleteProject(r.project!.id);
      return `Listo. Borré el proyecto "${r.project!.name}".`;
    }

    // ── METAS: editar / borrar ──
    case 'update_goal': {
      const r = await findGoal(str(p.goal_query || p.goal || p.title));
      if (r.error) return r.error;
      const patch: Record<string, unknown> = {};
      if (p.new_title !== undefined) patch.title = str(p.new_title);
      if (p.progress !== undefined) patch.progress_manual = clampPct(p.progress);
      if (p.deadline !== undefined) patch.deadline = str(p.deadline) || null;
      if (p.next_step !== undefined) patch.next_step = str(p.next_step) || null;
      await updateGoal(r.goal!.id, patch);
      return `Listo. Actualicé la meta "${r.goal!.title}".`;
    }

    case 'delete_goal': {
      const r = await findGoal(str(p.goal_query || p.goal || p.title));
      if (r.error) return r.error;
      await deleteGoal(r.goal!.id);
      return `Listo. Borré la meta "${r.goal!.title}".`;
    }

    // ── BITÁCORA: editar / borrar ──
    case 'update_journal':
    case 'delete_journal': {
      const q = str(p.title || p.query).toLowerCase().trim();
      if (!q) return 'No me dijiste qué entrada de Bitácora.';
      const entries = await getJournalEntries();
      const found = entries.find(e => e.title.toLowerCase().includes(q));
      if (!found) return `No encontré la entrada "${str(p.title || p.query)}".`;
      if (a.type === 'delete_journal') {
        await deleteJournalEntry(found.id);
        return `Listo. Borré la entrada "${found.title}".`;
      }
      const patch: Record<string, unknown> = {};
      if (p.new_title !== undefined) patch.title = str(p.new_title);
      if (p.content !== undefined) patch.content = str(p.content) || null;
      if (p.status !== undefined) patch.status = str(p.status) || null;
      await updateJournalEntry(found.id, patch);
      return `Listo. Actualicé la entrada "${found.title}".`;
    }

    // ── DISCIPLINA: crear hábito / registrar día ──
    case 'create_habit': {
      const h = await createHabit({
        name: str(p.name, 'Hábito'),
        area: normHabitArea(p.area),
        frequency: str(p.frequency).toLowerCase().startsWith('seman') ? 'semanal' : 'diario',
        priority: normPriority(p.priority),
        status: 'activo',
        suggested_time: str(p.time) || null,
        note: str(p.note) || null,
        position: 0,
      });
      return `Listo. Creé el hábito "${h.name}".`;
    }

    case 'log_habit': {
      const habits = await getHabits().catch(() => []);
      const q = str(p.habit_query || p.habit || p.name).toLowerCase();
      const found = habits.find(h => h.name.toLowerCase().includes(q));
      if (!found) return `No encontré el hábito "${str(p.habit_query || p.habit)}".`;
      const st = str(p.status).toLowerCase();
      const status: HabitLogStatus = (st.startsWith('fall') || st.includes(' no')) ? 'failed' : st.includes('paus') ? 'paused' : 'completed';
      await upsertHabitLog(found.id, str(p.date) || TODAY(), status);
      const label = status === 'completed' ? 'cumplido' : status === 'failed' ? 'fallado' : 'pausado';
      return `Listo. Registré "${found.name}" como ${label}.`;
    }

    // ── BRÚJULA / MAPA DE FUTURO: crear visión ──
    case 'create_vision': {
      const v = await createFutureVision({
        title: str(p.title, 'Visión'),
        area: normVisionArea(p.area),
        area_custom: null,
        timeframe: normTimeframe(p.timeframe),
        status: normVisionStatus(p.status),
        priority: normPriority(p.priority),
        target_date: str(p.target_date) || null,
        description: str(p.description) || null,
        image_url: null,
        position: 0,
      });
      return `Listo. Agregué la visión "${v.title}" a la Brújula.`;
    }

    // ── MEMORIA IA: que el agente guarde un hecho persistente ──
    case 'add_memory': {
      const m = await createAiMemory({
        category: str(p.category) || 'general',
        title: str(p.title, 'Memoria'),
        content: str(p.content, str(p.title)),
        importance: Math.max(1, Math.min(5, minutes(p.importance) || 3)),
        source: 'agente_ceo',
        is_active: true,
      });
      return `Listo. Guardé en tu memoria: "${m.title}".`;
    }

    // ── KANBAN: crear columna ──
    case 'create_kanban_column': {
      const cols = await getKanbanColumns().catch(() => []);
      const col = await createKanbanColumn(str(p.name, 'Columna'), str(p.color) || null, cols.length);
      return `Listo. Creé la columna "${col.name}" en el Kanban.`;
    }

    // ── KANBAN SEMANA: completar meta diaria / borrar indicador / vincular meta ──
    case 'complete_week_meta': {
      const board = await getOrCreateWeekBoard(getWeekStart());
      const q = str(p.name || p.indicator).toLowerCase().trim();
      const inds = board.indicators ?? [];
      const found = inds.find(i => i.name.toLowerCase().includes(q));
      if (!found) return `No encontré el indicador "${str(p.name || p.indicator)}".`;
      const day = resolveDay(p.day);
      const quota = Math.ceil(found.objetivo / 5);
      const next = inds.map(i => i.id === found.id
        ? { ...i, done_days: Array.from(new Set([...(i.done_days ?? []), day])), logrado: Math.min(i.objetivo, (i.logrado || 0) + quota) }
        : i);
      await updateWeekBoard(board.id, { indicators: next });
      return `Listo. Marqué la meta diaria de "${found.name}" (${day}) como cumplida (+${quota}).`;
    }

    case 'delete_week_indicator': {
      const board = await getOrCreateWeekBoard(getWeekStart());
      const q = str(p.name).toLowerCase().trim();
      const inds = board.indicators ?? [];
      const found = inds.find(i => i.name.toLowerCase().includes(q));
      if (!found) return `No encontré el indicador "${str(p.name)}".`;
      await updateWeekBoard(board.id, { indicators: inds.filter(i => i.id !== found.id) });
      return `Listo. Borré el indicador "${found.name}".`;
    }

    case 'link_week_meta': {
      const m = await findTask(str(p.task_query || p.task));
      if (m.error) return m.error;
      await linkWeekTask(getWeekStart(), m.task!.id);
      return `Listo. Marqué "${m.task!.title}" como meta de la semana.`;
    }

    case 'mark_english_word': {
      const wordText = str(p.word).trim();
      if (!wordText) return 'Falta indicar qué palabra de inglés marcar.';
      const catalogWord = await getEngWordByText(wordText);
      if (!catalogWord) return `No encontré "${wordText}" en el banco de vocabulario de My English.`;
      const patch: { learned?: boolean; favorite?: boolean } = {};
      if (p.learned !== undefined) patch.learned = bool(p.learned);
      if (p.favorite !== undefined) patch.favorite = bool(p.favorite);
      if (patch.learned === undefined && patch.favorite === undefined) patch.learned = true;
      await toggleEngWordState(catalogWord, patch);
      const bits: string[] = [];
      if (patch.learned !== undefined) bits.push(patch.learned ? 'aprendida' : 'no aprendida');
      if (patch.favorite !== undefined) bits.push(patch.favorite ? 'favorita' : 'sin favorito');
      return `Listo. Marqué "${catalogWord.word}" como ${bits.join(' y ')} en My English.`;
    }

    default:
      return `Acción no reconocida: ${a.type}.`;
  }
}

// Resuelve un día: 'YYYY-MM-DD', o nombre (lunes..domingo) dentro de la semana actual. Default hoy.
function resolveDay(v: unknown): string {
  const raw = str(v).toLowerCase().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const names = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo'];
  const idxMap: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, 'miércoles': 2, jueves: 3, viernes: 4, sabado: 5, 'sábado': 5, domingo: 6 };
  if (names.includes(raw)) {
    const days = getWeekDays(getWeekStart());
    return days[idxMap[raw]];
  }
  return TODAY();
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
