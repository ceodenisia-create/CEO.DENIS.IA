import { supabase } from './supabase';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type Area = 'modeltex' | 'moldey' | 'personal' | 'sistemas';
export type Priority = 'alta' | 'media' | 'baja';
export type TaskStatus = 'inbox' | 'hoy' | 'en_curso' | 'esperando' | 'hecho';
export type Timeframe = 'corto' | 'mediano' | 'largo';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  area: Area;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  area: Area;
  timeframe: Timeframe;
  deadline: string | null;
  next_step: string | null;
  progress_manual: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // computed
  task_count?: number;
  done_task_count?: number;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  goal_id: string | null;
  title: string;
  notes: string | null;
  area: Area;
  priority: Priority;
  status: TaskStatus;
  is_mit: boolean;
  due_date: string | null;
  position: number;
  business_key: string | null;  // vínculo opcional a un negocio (modeltex/moldey)
  column_key: string | null;    // columna custom del Kanban; null = vive en su status base
  created_at: string;
  updated_at: string;
}

// ─── AREA CONFIG ─────────────────────────────────────────────────────────────

export const AREA_CONFIG: Record<Area, { label: string; color: string; bg: string; border: string }> = {
  modeltex: { label: 'ModelTex', color: 'text-bordo-300',  bg: 'bg-bordo-500/20',  border: 'border-bordo-500/40' },
  moldey:   { label: 'Moldey',   color: 'text-dorado-300', bg: 'bg-dorado-500/20', border: 'border-dorado-500/40' },
  personal: { label: 'Personal', color: 'text-plata-300',  bg: 'bg-plata-600/20',  border: 'border-plata-500/40' },
  sistemas: { label: 'Sistemas', color: 'text-emerald-300',bg: 'bg-emerald-500/20',border: 'border-emerald-500/40' },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  alta:  { label: 'Alta',  color: 'text-red-300',    dot: 'bg-red-400' },
  media: { label: 'Media', color: 'text-dorado-300', dot: 'bg-dorado-400' },
  baja:  { label: 'Baja',  color: 'text-plata-400',  dot: 'bg-plata-500' },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  inbox:    { label: 'Inbox',    color: 'text-plata-300',  bg: 'bg-plata-700/40' },
  hoy:      { label: 'Hoy',     color: 'text-dorado-300', bg: 'bg-dorado-900/40' },
  en_curso: { label: 'En curso', color: 'text-bordo-300',  bg: 'bg-bordo-900/40' },
  esperando:{ label: 'Esperando',color: 'text-amber-300',  bg: 'bg-amber-900/30' },
  hecho:    { label: 'Hecho',   color: 'text-emerald-300',bg: 'bg-emerald-900/30' },
};

export const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; color: string }> = {
  corto:   { label: 'Corto plazo',   color: 'text-red-300' },
  mediano: { label: 'Mediano plazo', color: 'text-dorado-300' },
  largo:   { label: 'Largo plazo',   color: 'text-plata-400' },
};

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('pm_projects')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createProject(p: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_projects')
    .insert({ ...p, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, p: Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('pm_projects').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('pm_projects').delete().eq('id', id);
  if (error) throw error;
}

// ─── GOALS ────────────────────────────────────────────────────────────────────

export async function getGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('pm_goals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGoalsWithProgress(): Promise<Goal[]> {
  const [goals, tasks] = await Promise.all([getGoals(), getTasks()]);
  return goals.map(g => {
    const linked = tasks.filter(t => t.goal_id === g.id);
    const done = linked.filter(t => t.status === 'hecho').length;
    return { ...g, task_count: linked.length, done_task_count: done };
  });
}

export async function createGoal(g: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'task_count' | 'done_task_count'>): Promise<Goal> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_goals')
    .insert({ ...g, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, g: Partial<Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('pm_goals').update(g).eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('pm_goals').delete().eq('id', id);
  if (error) throw error;
}

// ─── TASKS ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('pm_tasks')
    .select('*')
    .order('position')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTasksByStatus(status: TaskStatus): Promise<Task[]> {
  const { data, error } = await supabase
    .from('pm_tasks')
    .select('*')
    .eq('status', status)
    .order('position')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTodayTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('pm_tasks')
    .select('*')
    .neq('status', 'hecho')
    .or(`status.eq.hoy,due_date.eq.${today}`)
    .order('is_mit', { ascending: false })
    .order('position');
  if (error) throw error;
  return data ?? [];
}

export async function createTask(t: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_tasks')
    .insert({ ...t, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, t: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('pm_tasks').update(t).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('pm_tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function moveTask(id: string, newStatus: TaskStatus): Promise<void> {
  await updateTask(id, { status: newStatus });
}

// ─── KANBAN COLUMNS ────────────────────────────────────────────────────────────

export interface KanbanColumn {
  id: string;
  user_id: string;
  name: string;
  key: string;
  color: string | null;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Columnas de sistema (viven en código, usan pm_tasks.status)
export const SYSTEM_COLUMNS: Array<{ key: TaskStatus; label: string; color: string }> = [
  { key: 'inbox',     label: 'Inbox',     color: '#868E96' },
  { key: 'hoy',       label: 'Hoy',       color: '#B8922A' },
  { key: 'en_curso',  label: 'En curso',  color: '#8B1A2E' },
  { key: 'esperando', label: 'Esperando', color: '#D97706' },
  { key: 'hecho',     label: 'Hecho',     color: '#16A34A' },
];

export async function getKanbanColumns(): Promise<KanbanColumn[]> {
  const { data, error } = await supabase
    .from('pm_kanban_columns')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createKanbanColumn(name: string, color: string | null, sortOrder: number): Promise<KanbanColumn> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const key = `col_${Date.now()}`;
  const { data, error } = await supabase
    .from('pm_kanban_columns')
    .insert({ user_id: user.id, name: name.trim(), key, color, sort_order: sortOrder, is_system: false, is_active: true })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateKanbanColumn(id: string, data: Partial<Pick<KanbanColumn, 'name' | 'color' | 'sort_order' | 'is_active'>>): Promise<void> {
  const { error } = await supabase.from('pm_kanban_columns').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteKanbanColumn(id: string): Promise<void> {
  const { error } = await supabase.from('pm_kanban_columns').delete().eq('id', id);
  if (error) throw error;
}

// Mueve una tarea a una columna de SISTEMA (status base, limpia column_key)
export async function moveTaskToSystemColumn(id: string, status: TaskStatus): Promise<void> {
  await updateTask(id, { status, column_key: null });
}

// Mueve una tarea a una columna CUSTOM (status neutro inbox + column_key)
export async function moveTaskToCustomColumn(id: string, columnKey: string): Promise<void> {
  await updateTask(id, { column_key: columnKey, status: 'inbox' });
}

// ─── AI CONTEXT ───────────────────────────────────────────────────────────────

export interface PmAiContextRadar {
  name: string;
  type: string;
  latestEvalTitle: string | null;
  latestEvalDate: string | null;
  areas: Array<{ name: string; current: number; target: number }>;
}

export interface PmAiContextHabit {
  name: string;
  area: string;
  status: string;
  current_streak: number;
  best_streak: number;
  total_completed: number;
  total_failed: number;
  todayStatus: string | null; // completed | failed | paused | null
}

export interface PmAiContextBusinessTime {
  name: string;
  planned_minutes: number;
  worked_minutes: number;
}

export interface PmAiContextVision {
  title: string;
  area: string;
  timeframe: string;
  status: string;
  priority: string;
  target_date: string | null;
  description: string | null;
}

export interface PmAiContextJournal {
  recentEntries: Array<{ type: string; title: string; entry_date: string; status: string | null; area: string | null }>;
  activeIdeas: Array<{ title: string; status: string | null; area: string | null; priority: string | null }>;
  decisionsInReview: Array<{ title: string; entry_date: string }>;
  activePlans: Array<{ title: string; entry_date: string }>;
  recentLessons: Array<{ title: string; entry_date: string }>;
  recentClosings: Array<{ entry_date: string; title: string }>;
  cierreTodayDone: boolean;
}

export interface PmAiContext {
  generatedAt: string;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  mitTasks: Task[];
  todayTasks: Task[];
  overdueTasks: Task[];
  allTasks: Task[];
  goals: Goal[];
  projects: Project[];
  radars: PmAiContextRadar[];
  habits: PmAiContextHabit[];
  businessTimeToday: PmAiContextBusinessTime[];
  visions: PmAiContextVision[];
  journal: PmAiContextJournal | null;
  memories: Array<{ category: string; title: string; content: string; importance: number }>;
}

export async function getPmAiContext(): Promise<PmAiContext> {
  const today = new Date().toISOString().split('T')[0];

  // Cada bloque está aislado en try/catch: si una tabla no existe o falla,
  // se devuelve vacío en vez de romper todo el contexto.
  const [tasks, goals, projects] = await Promise.all([
    getTasks().catch(() => [] as Task[]),
    getGoalsWithProgress().catch(() => [] as Goal[]),
    getProjects().catch(() => [] as Project[]),
  ]);

  const tasksByStatus = { inbox: 0, hoy: 0, en_curso: 0, esperando: 0, hecho: 0 };
  for (const t of tasks) tasksByStatus[t.status]++;

  // Radar: última evaluación + puntajes de cada radar activo
  let radars: PmAiContextRadar[] = [];
  try {
    const allRadars = (await getRadars()).filter(r => r.status === 'active');
    radars = await Promise.all(allRadars.map(async (r): Promise<PmAiContextRadar> => {
      const evals = await getRadarEvaluations(r.id);
      const latest = evals[0] ?? null;
      const scores = latest ? await getRadarScores(latest.id) : [];
      return {
        name: r.name,
        type: r.type,
        latestEvalTitle: latest?.title ?? null,
        latestEvalDate: latest?.evaluation_date ?? null,
        areas: scores.map(s => ({ name: s.area_name, current: s.current_score, target: s.target_score })),
      };
    }));
  } catch { radars = []; }

  // Disciplina: hábitos + estado de hoy
  let habits: PmAiContextHabit[] = [];
  try {
    const allHabits = await getHabits();
    const logs = await getHabitLogs(allHabits.map(h => h.id), today);
    habits = allHabits.map(h => {
      const todayLog = logs.find(l => l.habit_id === h.id && l.log_date === today);
      return {
        name: h.name, area: h.area, status: h.status,
        current_streak: h.current_streak, best_streak: h.best_streak,
        total_completed: h.total_completed, total_failed: h.total_failed,
        todayStatus: todayLog?.status ?? null,
      };
    });
  } catch { habits = []; }

  // Negocios: planificación/registro de tiempo de hoy
  let businessTimeToday: PmAiContextBusinessTime[] = [];
  try {
    const [businesses, blocks] = await Promise.all([getBusinesses(), getTimeBlocksForDate(today)]);
    businessTimeToday = businesses.map(b => {
      const block = blocks.find(bl => bl.business_key === b.key);
      return {
        name: b.name,
        planned_minutes: block?.planned_minutes ?? 0,
        worked_minutes: block?.worked_minutes ?? 0,
      };
    });
  } catch { businessTimeToday = []; }

  // Brújula: visiones
  let visions: PmAiContextVision[] = [];
  try {
    const vs = await getFutureVisions();
    visions = vs.map(v => ({
      title: v.title,
      area: visionAreaLabel(v),
      timeframe: v.timeframe,
      status: v.status,
      priority: v.priority,
      target_date: v.target_date,
      description: v.description,
    }));
  } catch { visions = []; }

  // Bitácora: resumen
  let journal: PmAiContextJournal | null = null;
  try {
    const jc = await getJournalContext();
    journal = {
      recentEntries: jc.recentEntries.slice(0, 15).map(e => ({ type: e.type, title: e.title, entry_date: e.entry_date, status: e.status, area: e.area })),
      activeIdeas: jc.activeIdeas.map(e => ({ title: e.title, status: e.status, area: e.area, priority: e.priority })),
      decisionsInReview: jc.decisionsInReview.map(e => ({ title: e.title, entry_date: e.entry_date })),
      activePlans: jc.activePlans.map(e => ({ title: e.title, entry_date: e.entry_date })),
      recentLessons: jc.recentLessons.map(e => ({ title: e.title, entry_date: e.entry_date })),
      recentClosings: jc.recentClosings.map(e => ({ entry_date: e.entry_date, title: e.title })),
      cierreTodayDone: jc.recentClosings.some(e => e.entry_date === today),
    };
  } catch { journal = null; }

  // Memoria IA: hechos persistentes activos del usuario
  let memories: Array<{ category: string; title: string; content: string; importance: number }> = [];
  try {
    const mem = await getActiveAiMemories();
    memories = mem.map(m => ({ category: m.category, title: m.title, content: m.content, importance: m.importance }));
  } catch { memories = []; }

  return {
    generatedAt: new Date().toISOString(),
    totalTasks: tasks.length,
    tasksByStatus,
    mitTasks: tasks.filter(t => t.is_mit && t.status !== 'hecho'),
    todayTasks: tasks.filter(t => (t.status === 'hoy' || t.due_date === today) && t.status !== 'hecho'),
    overdueTasks: tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'hecho'),
    allTasks: tasks,
    goals,
    projects,
    radars,
    habits,
    businessTimeToday,
    visions,
    journal,
    memories,
  };
}

// ─── AI CONVERSATIONS ─────────────────────────────────────────────────────────

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

function generateTitle(msg: string): string {
  const words = msg.trim().split(/\s+/).slice(0, 6).join(' ');
  return words.length < msg.trim().length ? `${words}…` : words;
}

export async function createConversation(firstMessage: string): Promise<AiConversation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_ai_conversations')
    .insert({ user_id: user.id, title: generateTitle(firstMessage) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConversations(): Promise<AiConversation[]> {
  const { data, error } = await supabase
    .from('pm_ai_conversations')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getConversationMessages(convId: string): Promise<AiChatMessage[]> {
  const { data, error } = await supabase
    .from('pm_ai_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AiChatMessage[];
}

export async function saveMessage(convId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const { error } = await supabase
    .from('pm_ai_messages')
    .insert({ conversation_id: convId, role, content });
  if (error) throw error;
}

export async function deleteConversation(convId: string): Promise<void> {
  const { error } = await supabase.from('pm_ai_conversations').delete().eq('id', convId);
  if (error) throw error;
}

export async function sendAiChat(messages: AiChatMessage[], context: PmAiContext): Promise<string> {
  const response = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'No se pudo obtener respuesta.');
  if (typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error('Respuesta vacía del asistente.');
  return payload.reply.trim();
}

// ─── MAPA DE FUTURO ───────────────────────────────────────────────────────────

export type VisionArea = 'negocios' | 'familia' | 'salud' | 'dinero' | 'viajes' | 'estilo_vida' | 'mentalidad' | 'otra';
export type VisionStatus = 'sonado' | 'planificacion' | 'en_proceso' | 'logrado';

export interface FutureVision {
  id: string;
  user_id: string;
  title: string;
  area: VisionArea;
  area_custom: string | null;   // nombre libre cuando area === 'otra'
  timeframe: Timeframe;
  status: VisionStatus;
  priority: Priority;
  target_date: string | null;
  description: string | null;
  image_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export const VISION_AREA_CONFIG: Record<VisionArea, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  negocios:    { label: 'Negocios',          color: 'text-bordo-300',   bg: 'bg-bordo-500/20',   border: 'border-bordo-500/40',   emoji: '🏢' },
  familia:     { label: 'Familia',           color: 'text-rose-300',    bg: 'bg-rose-500/20',    border: 'border-rose-500/40',    emoji: '👨‍👩‍👧' },
  salud:       { label: 'Salud',             color: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', emoji: '💪' },
  dinero:      { label: 'Dinero / Patrimonio', color: 'text-dorado-300', bg: 'bg-dorado-500/20', border: 'border-dorado-500/40', emoji: '💰' },
  viajes:      { label: 'Viajes',            color: 'text-sky-300',     bg: 'bg-sky-500/20',     border: 'border-sky-500/40',     emoji: '✈️' },
  estilo_vida: { label: 'Estilo de vida',    color: 'text-violet-300',  bg: 'bg-violet-500/20',  border: 'border-violet-500/40',  emoji: '🌿' },
  mentalidad:  { label: 'Mentalidad',        color: 'text-amber-300',   bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   emoji: '🧠' },
  otra:        { label: 'Personalizada',     color: 'text-plata-300',   bg: 'bg-plata-600/20',   border: 'border-plata-500/40',   emoji: '🧭' },
};

// Nombre visible real del área de una visión (usa el custom si es 'otra')
export function visionAreaLabel(v: Pick<FutureVision, 'area' | 'area_custom'>): string {
  if (v.area === 'otra' && v.area_custom?.trim()) return v.area_custom.trim();
  return VISION_AREA_CONFIG[v.area]?.label ?? 'Personalizada';
}

export const VISION_STATUS_CONFIG: Record<VisionStatus, { label: string; color: string; bg: string }> = {
  sonado:       { label: 'Soñado',          color: 'text-plata-400',   bg: 'bg-plata-700/40' },
  planificacion:{ label: 'En planificación', color: 'text-dorado-300',  bg: 'bg-dorado-900/40' },
  en_proceso:   { label: 'En proceso',      color: 'text-bordo-300',   bg: 'bg-bordo-900/40' },
  logrado:      { label: 'Logrado',         color: 'text-emerald-300', bg: 'bg-emerald-900/30' },
};

export async function getFutureVisions(): Promise<FutureVision[]> {
  const { data, error } = await supabase
    .from('pm_future_visions')
    .select('*')
    .order('position')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFutureVision(v: Omit<FutureVision, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<FutureVision> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_future_visions')
    .insert({ ...v, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFutureVision(id: string, v: Partial<Omit<FutureVision, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('pm_future_visions').update(v).eq('id', id);
  if (error) throw error;
}

export async function deleteFutureVision(id: string): Promise<void> {
  const { error } = await supabase.from('pm_future_visions').delete().eq('id', id);
  if (error) throw error;
}

// Subida de imagen a Supabase Storage
export async function uploadVisionImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${user.id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('vision-images')
    .upload(fileName, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(`Error subiendo imagen: ${error.message}`);

  const { data } = supabase.storage.from('vision-images').getPublicUrl(fileName);
  return data.publicUrl;
}

// ─── DISCIPLINA ───────────────────────────────────────────────────────────────

export type HabitArea = 'salud' | 'trabajo' | 'estudio' | 'dinero' | 'familia' | 'mentalidad' | 'personal';
export type HabitFrequency = 'diario' | 'semanal';
export type HabitStatus = 'activo' | 'pausado' | 'abandonado';
export type HabitLogStatus = 'completed' | 'failed' | 'paused';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  area: HabitArea;
  frequency: HabitFrequency;
  priority: Priority;
  status: HabitStatus;
  suggested_time: string | null;
  note: string | null;
  current_streak: number;
  best_streak: number;
  total_completed: number;
  total_failed: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  status: HabitLogStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const HABIT_AREA_CONFIG: Record<HabitArea, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  salud:      { label: 'Salud',      color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', emoji: '💪' },
  trabajo:    { label: 'Trabajo',    color: 'text-bordo-300',   bg: 'bg-bordo-500/15',   border: 'border-bordo-500/30',   emoji: '💼' },
  estudio:    { label: 'Estudio',    color: 'text-sky-300',     bg: 'bg-sky-500/15',     border: 'border-sky-500/30',     emoji: '📚' },
  dinero:     { label: 'Dinero',     color: 'text-dorado-300',  bg: 'bg-dorado-500/15',  border: 'border-dorado-500/30',  emoji: '💰' },
  familia:    { label: 'Familia',    color: 'text-rose-300',    bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    emoji: '👨‍👩‍👧' },
  mentalidad: { label: 'Mentalidad', color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   emoji: '🧠' },
  personal:   { label: 'Personal',   color: 'text-plata-300',   bg: 'bg-plata-600/15',   border: 'border-plata-500/30',   emoji: '⭐' },
};

// ─── CRUD HABITS ─────────────────────────────────────────────────────────────

export async function getHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('pm_habits')
    .select('*')
    .order('position')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createHabit(h: Omit<Habit, 'id' | 'user_id' | 'current_streak' | 'best_streak' | 'total_completed' | 'total_failed' | 'created_at' | 'updated_at'>): Promise<Habit> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_habits')
    .insert({ ...h, user_id: user.id, current_streak: 0, best_streak: 0, total_completed: 0, total_failed: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHabit(id: string, h: Partial<Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('pm_habits').update(h).eq('id', id);
  if (error) throw error;
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('pm_habits').delete().eq('id', id);
  if (error) throw error;
}

// ─── HABIT LOGS ──────────────────────────────────────────────────────────────

export async function getHabitLogs(habitIds: string[], fromDate: string): Promise<HabitLog[]> {
  if (habitIds.length === 0) return [];
  const { data, error } = await supabase
    .from('pm_habit_logs')
    .select('*')
    .in('habit_id', habitIds)
    .gte('log_date', fromDate)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Upsert: crea o actualiza el log del día
export async function upsertHabitLog(habitId: string, logDate: string, status: HabitLogStatus): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // Upsert del log
  const { error: logError } = await supabase
    .from('pm_habit_logs')
    .upsert(
      { habit_id: habitId, user_id: user.id, log_date: logDate, status },
      { onConflict: 'habit_id,log_date' }
    );
  if (logError) throw logError;

  // Recalcular contadores y racha en el hábito
  await recalculateHabitStats(habitId);
}

async function recalculateHabitStats(habitId: string): Promise<void> {
  // Traer todos los logs ordenados por fecha
  const { data: logs, error } = await supabase
    .from('pm_habit_logs')
    .select('log_date, status')
    .eq('habit_id', habitId)
    .order('log_date', { ascending: true });

  if (error || !logs) return;

  const totalCompleted = logs.filter(l => l.status === 'completed').length;
  const totalFailed = logs.filter(l => l.status === 'failed').length;

  // Calcular racha actual (desde hoy hacia atrás, solo 'completed')
  const today = new Date().toISOString().split('T')[0];
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  // Ordenar por fecha descendente para calcular racha actual
  const sorted = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date));

  // Racha actual: días consecutivos completados desde hoy/ayer hacia atrás
  let expectDate = today;
  for (const log of sorted) {
    if (log.log_date > expectDate) continue; // log futuro, ignorar
    if (log.log_date === expectDate || log.log_date < expectDate) {
      if (log.log_date < expectDate) {
        // Hay un gap — si es 'paused' no rompemos, si es 'failed' o no existe sí
        // Solo continuamos si el log es del día esperado
        break;
      }
      if (log.status === 'completed') {
        currentStreak++;
        // retroceder un día
        const d = new Date(expectDate);
        d.setDate(d.getDate() - 1);
        expectDate = d.toISOString().split('T')[0];
      } else if (log.status === 'paused') {
        // día pausado: no suma ni rompe
        const d = new Date(expectDate);
        d.setDate(d.getDate() - 1);
        expectDate = d.toISOString().split('T')[0];
      } else {
        // failed: rompe racha
        break;
      }
    }
  }

  // Mejor racha histórica (secuencia más larga de 'completed' consecutivos)
  const asc = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  for (let i = 0; i < asc.length; i++) {
    if (asc[i].status === 'completed') {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else if (asc[i].status === 'failed') {
      tempStreak = 0;
    }
    // paused: no resetea tempStreak
  }

  const finalBest = Math.max(bestStreak, currentStreak);

  await supabase.from('pm_habits').update({
    total_completed: totalCompleted,
    total_failed: totalFailed,
    current_streak: currentStreak,
    best_streak: finalBest,
  }).eq('id', habitId);
}

// ─── RADAR v2 ─────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export type RadarType   = 'fixed' | 'custom';
export type RadarStatus = 'active' | 'archived';

export interface PmRadar {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: RadarType;
  status: RadarStatus;
  created_at: string;
  updated_at: string;
}

export interface RadarAreaDef {
  id: string;
  radar_id: string;
  user_id: string;
  area_key: string;      // slug estable, nunca cambia
  display_name: string;  // nombre visible, editable
  sort_order: number;
  is_required: boolean;  // true = no se puede borrar
  is_active: boolean;
  color: string | null;  // hex color, ej: #EF4444 — null usa defaults del frontend
  created_at: string;
  updated_at: string;
}

export interface RadarScore {
  id: string;
  evaluation_id: string;
  user_id: string;
  area_name: string;     // snapshot del nombre al momento de evaluar
  area_key: string | null;
  current_score: number;
  target_score: number;
  note: string | null;
  main_action: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RadarEvaluation {
  id: string;
  user_id: string;
  radar_id: string | null;
  title: string;
  evaluation_date: string;
  general_note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export interface RadarMetrics {
  overallAvg: number;
  strongestArea: string;
  weakestArea: string;
  biggestGapArea: string;
}

export function calcRadarMetrics(scores: RadarScore[]): RadarMetrics {
  if (scores.length === 0)
    return { overallAvg: 0, strongestArea: '—', weakestArea: '—', biggestGapArea: '—' };
  const avg = scores.reduce((s, x) => s + x.current_score, 0) / scores.length;
  const strongest  = scores.reduce((a, b) => a.current_score >= b.current_score ? a : b);
  const weakest    = scores.reduce((a, b) => a.current_score <= b.current_score ? a : b);
  const biggestGap = scores.reduce((a, b) =>
    (b.target_score - b.current_score) >= (a.target_score - a.current_score) ? b : a
  );
  return {
    overallAvg: Math.round(avg * 10) / 10,
    strongestArea:  strongest.area_name,
    weakestArea:    weakest.area_name,
    biggestGapArea: biggestGap.area_name,
  };
}

export function getAreaStatus(score: number): { label: string; color: string; bg: string } {
  if (score <= 3) return { label: 'Crítico',   color: 'text-red-300',     bg: 'bg-red-900/30' };
  if (score <= 5) return { label: 'En riesgo', color: 'text-amber-300',   bg: 'bg-amber-900/30' };
  if (score <= 7) return { label: 'Estable',   color: 'text-dorado-300',  bg: 'bg-dorado-900/30' };
  return                 { label: 'Fuerte',    color: 'text-emerald-300', bg: 'bg-emerald-900/30' };
}

// Colores por defecto para áreas del Radar de Vida (sobrios, palette oscura)
export const LIFE_RADAR_DEFAULT_COLORS: Record<string, string> = {
  salud:            '#EF4444', // rojo
  energia:          '#F59E0B', // ámbar
  disciplina:       '#8B5CF6', // violeta
  familia:          '#10B981', // esmeralda
  relacion_pareja:  '#EC4899', // rosa
  dinero:           '#3B82F6', // azul
  negocios_trabajo: '#1D4ED8', // azul oscuro
  aprendizaje:      '#7C3AED', // púrpura
  mentalidad:       '#6B1E2E', // bordo (paleta del proyecto)
  viajes:           '#06B6D4', // cyan
  naturaleza_calma: '#16A34A', // verde natural
  proposito:        '#B8922A', // dorado (paleta del proyecto)
};

// 12 áreas fijas del Radar de Vida
export const LIFE_RADAR_AREA_DEFS: Array<{ key: string; name: string; color: string }> = [
  { key: 'salud',              name: 'Salud',                 color: LIFE_RADAR_DEFAULT_COLORS.salud },
  { key: 'energia',            name: 'Energía',               color: LIFE_RADAR_DEFAULT_COLORS.energia },
  { key: 'disciplina',         name: 'Disciplina',            color: LIFE_RADAR_DEFAULT_COLORS.disciplina },
  { key: 'familia',            name: 'Familia',               color: LIFE_RADAR_DEFAULT_COLORS.familia },
  { key: 'relacion_pareja',    name: 'Relación / Pareja',     color: LIFE_RADAR_DEFAULT_COLORS.relacion_pareja },
  { key: 'dinero',             name: 'Dinero',                color: LIFE_RADAR_DEFAULT_COLORS.dinero },
  { key: 'negocios_trabajo',   name: 'Negocios / Trabajo',    color: LIFE_RADAR_DEFAULT_COLORS.negocios_trabajo },
  { key: 'aprendizaje',        name: 'Aprendizaje',           color: LIFE_RADAR_DEFAULT_COLORS.aprendizaje },
  { key: 'mentalidad',         name: 'Mentalidad',            color: LIFE_RADAR_DEFAULT_COLORS.mentalidad },
  { key: 'viajes',             name: 'Tiempo libre / Viajes', color: LIFE_RADAR_DEFAULT_COLORS.viajes },
  { key: 'naturaleza_calma',   name: 'Naturaleza / Calma',    color: LIFE_RADAR_DEFAULT_COLORS.naturaleza_calma },
  { key: 'proposito',          name: 'Propósito / Dirección', color: LIFE_RADAR_DEFAULT_COLORS.proposito },
];

// Mapping viejo area_name → area_key (para migrar evaluaciones heredadas)
const LEGACY_AREA_KEY_MAP: Record<string, string> = {
  'Salud': 'salud', 'Energía': 'energia', 'Disciplina': 'disciplina',
  'Familia': 'familia', 'Relación / Pareja': 'relacion_pareja',
  'Dinero': 'dinero', 'Negocios / Trabajo': 'negocios_trabajo',
  'Aprendizaje': 'aprendizaje', 'Mentalidad': 'mentalidad',
  'Tiempo libre / Viajes': 'viajes', 'Naturaleza / Calma': 'naturaleza_calma',
};

// ── CRUD Radares ──────────────────────────────────────────────────────────────

export async function getRadars(): Promise<PmRadar[]> {
  const { data, error } = await supabase
    .from('pm_radars')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLifeRadar(): Promise<PmRadar | null> {
  const { data } = await supabase
    .from('pm_radars')
    .select('*')
    .eq('type', 'fixed')
    .maybeSingle();
  return data ?? null;
}

export async function createLifeRadar(): Promise<PmRadar> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: radar, error: rErr } = await supabase
    .from('pm_radars')
    .insert({ user_id: user.id, name: 'Radar de Vida', type: 'fixed', status: 'active' })
    .select().single();
  if (rErr) throw rErr;

  const areaDefs = LIFE_RADAR_AREA_DEFS.map((a, i) => ({
    radar_id: radar.id, user_id: user.id,
    area_key: a.key, display_name: a.name,
    color: a.color,
    sort_order: i, is_required: true, is_active: true,
  }));
  await supabase.from('pm_radar_area_defs').insert(areaDefs);

  return radar;
}

// Paleta por defecto para áreas de radares personalizados (hasta 16)
export const RADAR_AREA_PALETTE = [
  '#EF4444', '#F59E0B', '#EAB308', '#22C55E', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#14B8A6',
  '#A855F7', '#84CC16', '#0EA5E9', '#D946EF',
];

export async function createCustomRadar(
  name: string, description: string | null, areas: Array<{ name: string; color: string }>
): Promise<PmRadar> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: radar, error } = await supabase
    .from('pm_radars')
    .insert({ user_id: user.id, name: name.trim(), description: description?.trim() || null, type: 'custom', status: 'active' })
    .select().single();
  if (error) throw error;

  const areaDefs = areas.map((a, i) => ({
    radar_id: radar.id, user_id: user.id,
    area_key: `area_${i}_${Date.now()}`,
    display_name: a.name.trim(),
    color: a.color || RADAR_AREA_PALETTE[i % RADAR_AREA_PALETTE.length],
    sort_order: i, is_required: false, is_active: true,
  }));
  await supabase.from('pm_radar_area_defs').insert(areaDefs);
  return radar;
}

export async function updateRadar(id: string, data: Partial<Pick<PmRadar, 'name' | 'description' | 'status'>>): Promise<void> {
  const { error } = await supabase.from('pm_radars').update(data).eq('id', id);
  if (error) throw error;
}

export async function archiveRadar(id: string): Promise<void> {
  await updateRadar(id, { status: 'archived' });
}

export async function reactivateRadar(id: string): Promise<void> {
  await updateRadar(id, { status: 'active' });
}

export async function duplicateRadar(id: string): Promise<PmRadar> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const [radarRes, areasRes] = await Promise.all([
    supabase.from('pm_radars').select('*').eq('id', id).single(),
    supabase.from('pm_radar_area_defs').select('*').eq('radar_id', id).order('sort_order'),
  ]);
  if (radarRes.error) throw radarRes.error;
  const orig = radarRes.data;

  const { data: copy, error: cErr } = await supabase
    .from('pm_radars')
    .insert({
      user_id: user.id,
      name: `${orig.name} (copia)`,
      description: orig.description,
      type: 'custom',
      status: 'active',
    })
    .select().single();
  if (cErr) throw cErr;

  const ts = Date.now();
  const areas = (areasRes.data ?? []).map((a, i) => ({
    radar_id: copy.id, user_id: user.id,
    area_key: `dup_${ts}_${i}`,
    display_name: a.display_name,
    color: a.color ?? RADAR_AREA_PALETTE[i % RADAR_AREA_PALETTE.length],
    sort_order: a.sort_order, is_required: false, is_active: a.is_active,
  }));
  if (areas.length) await supabase.from('pm_radar_area_defs').insert(areas);
  return copy;
}

export async function deleteRadar(id: string): Promise<{ hasEvaluations: boolean }> {
  const { count } = await supabase
    .from('pm_radar_evaluations').select('id', { count: 'exact', head: true }).eq('radar_id', id);
  if ((count ?? 0) > 0) return { hasEvaluations: true };
  const { error } = await supabase.from('pm_radars').delete().eq('id', id);
  if (error) throw error;
  return { hasEvaluations: false };
}

// ── CRUD Área Definitions ─────────────────────────────────────────────────────

export async function getRadarAreaDefs(radarId: string): Promise<RadarAreaDef[]> {
  const { data, error } = await supabase
    .from('pm_radar_area_defs')
    .select('*')
    .eq('radar_id', radarId)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function updateAreaDef(id: string, data: Partial<Pick<RadarAreaDef, 'display_name' | 'sort_order' | 'is_active' | 'color'>>): Promise<void> {
  const { error } = await supabase.from('pm_radar_area_defs').update(data).eq('id', id);
  if (error) throw error;
}

export async function addAreaToRadar(radarId: string, areaName: string, sortOrder: number, color?: string): Promise<RadarAreaDef> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_radar_area_defs')
    .insert({
      radar_id: radarId, user_id: user.id,
      area_key: `area_${Date.now()}`,
      display_name: areaName.trim(),
      color: color || RADAR_AREA_PALETTE[sortOrder % RADAR_AREA_PALETTE.length],
      sort_order: sortOrder, is_required: false, is_active: true,
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function removeAreaFromRadar(defId: string): Promise<void> {
  const { error } = await supabase.from('pm_radar_area_defs').delete().eq('id', defId);
  if (error) throw error;
}

// ── CRUD Evaluaciones ─────────────────────────────────────────────────────────

export async function getRadarEvaluations(radarId: string): Promise<RadarEvaluation[]> {
  const { data, error } = await supabase
    .from('pm_radar_evaluations')
    .select('*')
    .eq('radar_id', radarId)
    .order('evaluation_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOrphanEvaluations(): Promise<RadarEvaluation[]> {
  const { data, error } = await supabase
    .from('pm_radar_evaluations')
    .select('*')
    .is('radar_id', null);
  if (error) throw error;
  return data ?? [];
}

export async function createRadarEvaluation(
  radarId: string,
  eval_: { title: string; evaluation_date: string; general_note: string | null },
  scores: Array<{ area_key: string; area_name: string; current_score: number; target_score: number; note: string | null; main_action: string | null; sort_order: number }>
): Promise<RadarEvaluation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: evalData, error: evalErr } = await supabase
    .from('pm_radar_evaluations')
    .insert({ ...eval_, radar_id: radarId, user_id: user.id })
    .select().single();
  if (evalErr) throw evalErr;

  if (scores.length > 0) {
    const { error: scoresErr } = await supabase
      .from('pm_radar_scores')
      .insert(scores.map(s => ({ ...s, evaluation_id: evalData.id, user_id: user.id })));
    if (scoresErr) throw scoresErr;
  }
  return evalData;
}

export async function updateRadarEvaluation(
  id: string,
  eval_: { title: string; evaluation_date: string; general_note: string | null },
  scores: Array<{ area_key: string; area_name: string; current_score: number; target_score: number; note: string | null; main_action: string | null; sort_order: number }>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error: evalErr } = await supabase.from('pm_radar_evaluations').update(eval_).eq('id', id);
  if (evalErr) throw evalErr;
  await supabase.from('pm_radar_scores').delete().eq('evaluation_id', id);
  if (scores.length > 0) {
    const { error: scoresErr } = await supabase
      .from('pm_radar_scores')
      .insert(scores.map(s => ({ ...s, evaluation_id: id, user_id: user.id })));
    if (scoresErr) throw scoresErr;
  }
}

export async function deleteRadarEvaluation(id: string): Promise<void> {
  const { error } = await supabase.from('pm_radar_evaluations').delete().eq('id', id);
  if (error) throw error;
}

export async function getRadarScores(evaluationId: string): Promise<RadarScore[]> {
  const { data, error } = await supabase
    .from('pm_radar_scores')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

// ── Inicialización / Migración ────────────────────────────────────────────────

export async function initializeLifeRadar(): Promise<{ radar: PmRadar; migrated: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // Crear el Radar de Vida si no existe
  let radar = await getLifeRadar();
  if (!radar) radar = await createLifeRadar();

  // Vincular evaluaciones huérfanas (sin radar_id)
  const orphans = await getOrphanEvaluations();
  let migrated = 0;
  if (orphans.length > 0) {
    await supabase
      .from('pm_radar_evaluations')
      .update({ radar_id: radar.id })
      .is('radar_id', null);

    // Actualizar area_key en scores de esas evaluaciones
    for (const orphan of orphans) {
      const scores = await getRadarScores(orphan.id);
      for (const score of scores) {
        if (!score.area_key && score.area_name) {
          const key = LEGACY_AREA_KEY_MAP[score.area_name];
          if (key) {
            await supabase.from('pm_radar_scores').update({ area_key: key }).eq('id', score.id);
          }
        }
      }
    }
    migrated = orphans.length;
  }

  return { radar, migrated };
}

// ─── MIS NEGOCIOS ─────────────────────────────────────────────────────────────

export type BusinessKey = string; // 'modeltex' | 'moldey' | futuros

export interface Business {
  id: string;
  user_id: string;
  key: string;
  name: string;
  url: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessTimeBlock {
  id: string;
  user_id: string;
  business_key: string;
  business_name: string;
  work_date: string;
  planned_minutes: number;
  worked_minutes: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// Negocios iniciales (se crean en la primera carga si no existen)
export const DEFAULT_BUSINESSES: Array<{ key: string; name: string; color: string }> = [
  { key: 'modeltex', name: 'MODELTEX', color: '#6B1E2E' }, // bordo
  { key: 'moldey',   name: 'MOLDEY',   color: '#B8922A' }, // dorado
];

// ── Enlaces externos por negocio ──
export interface BusinessLink {
  id: string;
  user_id: string;
  business_key: string;
  label: string;
  url: string | null;
  type: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Enlaces por defecto (sin URL — se configuran después). NO inventar URLs.
export const DEFAULT_BUSINESS_LINKS: Array<{ business_key: string; label: string; type: string }> = [
  { business_key: 'modeltex', label: 'MODELTEX.STORE', type: 'website' },
  { business_key: 'modeltex', label: 'CEO MODELTEX',   type: 'system' },
  { business_key: 'modeltex', label: 'MODELTEX IA',    type: 'ai' },
  { business_key: 'moldey',   label: 'MOLDEY.COM',     type: 'website' },
  { business_key: 'moldey',   label: 'CEO MOLDEY',     type: 'system' },
];

export async function getBusinessLinks(): Promise<BusinessLink[]> {
  const { data, error } = await supabase
    .from('pm_business_links')
    .select('*')
    .eq('is_active', true)
    .order('business_key')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

// Crea los enlaces por defecto si el usuario no tiene ninguno
export async function ensureBusinessLinks(): Promise<BusinessLink[]> {
  const existing = await getBusinessLinks();
  if (existing.length > 0) return existing;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const rows = DEFAULT_BUSINESS_LINKS.map((l, i) => ({
    user_id: user.id, business_key: l.business_key, label: l.label,
    url: null, type: l.type, sort_order: i, is_active: true,
  }));
  const { data, error } = await supabase.from('pm_business_links').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function updateBusinessLink(id: string, url: string | null): Promise<void> {
  const { error } = await supabase.from('pm_business_links').update({ url }).eq('id', id);
  if (error) throw error;
}

// Label + color para badges (usa los defaults; sirve aunque el negocio sea custom)
export function businessBadge(key: string | null | undefined): { name: string; color: string } | null {
  if (!key) return null;
  const found = DEFAULT_BUSINESSES.find(b => b.key === key);
  if (found) return { name: found.name, color: found.color };
  return { name: key.toUpperCase(), color: '#868E96' };
}

export async function getBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase
    .from('pm_businesses')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Crea los negocios por defecto si el usuario no tiene ninguno
export async function ensureBusinesses(): Promise<Business[]> {
  const existing = await getBusinesses();
  if (existing.length > 0) return existing;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const rows = DEFAULT_BUSINESSES.map((b, i) => ({
    user_id: user.id, key: b.key, name: b.name, color: b.color,
    url: null, is_active: true, sort_order: i,
  }));
  const { data, error } = await supabase.from('pm_businesses').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function updateBusiness(id: string, data: Partial<Pick<Business, 'name' | 'url' | 'color' | 'is_active' | 'sort_order'>>): Promise<void> {
  const { error } = await supabase.from('pm_businesses').update(data).eq('id', id);
  if (error) throw error;
}

// ── Time blocks ─────────────────────────────────────────────────────────────

export async function getTimeBlock(businessKey: string, workDate: string): Promise<BusinessTimeBlock | null> {
  const { data } = await supabase
    .from('pm_business_time_blocks')
    .select('*')
    .eq('business_key', businessKey)
    .eq('work_date', workDate)
    .maybeSingle();
  return data ?? null;
}

export async function getTimeBlocksForDate(workDate: string): Promise<BusinessTimeBlock[]> {
  const { data, error } = await supabase
    .from('pm_business_time_blocks')
    .select('*')
    .eq('work_date', workDate);
  if (error) throw error;
  return data ?? [];
}

// Upsert: crea o actualiza el bloque del día para el negocio
export async function upsertTimeBlock(
  businessKey: string, businessName: string, workDate: string,
  fields: { planned_minutes?: number; worked_minutes?: number; note?: string | null }
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const existing = await getTimeBlock(businessKey, workDate);
  if (existing) {
    const { error } = await supabase
      .from('pm_business_time_blocks')
      .update(fields)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('pm_business_time_blocks')
      .insert({
        user_id: user.id, business_key: businessKey, business_name: businessName,
        work_date: workDate,
        planned_minutes: fields.planned_minutes ?? 0,
        worked_minutes: fields.worked_minutes ?? 0,
        note: fields.note ?? null,
      });
    if (error) throw error;
  }
}

// ── Resumen del día por negocio ───────────────────────────────────────────────

export interface BusinessDaySummary {
  plannedMinutes: number;
  workedMinutes: number;
  diffMinutes: number;          // worked - planned
  todayTasks: Task[];           // tareas del negocio con due_date hoy o status hoy
  pendingTasks: Task[];         // tareas del negocio no hechas
}

export async function getBusinessDaySummary(businessKey: string, workDate: string): Promise<BusinessDaySummary> {
  const [block, tasksRes] = await Promise.all([
    getTimeBlock(businessKey, workDate),
    supabase.from('pm_tasks').select('*').eq('business_key', businessKey),
  ]);
  const tasks = (tasksRes.data ?? []) as Task[];
  const pending = tasks.filter(t => t.status !== 'hecho');
  const today = tasks.filter(t => t.status !== 'hecho' && (t.status === 'hoy' || t.due_date === workDate));
  const planned = block?.planned_minutes ?? 0;
  const worked = block?.worked_minutes ?? 0;
  return {
    plannedMinutes: planned,
    workedMinutes: worked,
    diffMinutes: worked - planned,
    todayTasks: today,
    pendingTasks: pending,
  };
}

// ─── BITÁCORA ───────────────────────────────────────────────────────────────

export type JournalType = 'diario' | 'idea' | 'decision' | 'plan' | 'leccion' | 'cierre_diario';

export interface JournalEntry {
  id: string;
  user_id: string;
  type: JournalType;
  title: string;
  content: string | null;
  entry_date: string;
  status: string | null;
  area: string | null;
  priority: string | null;
  related_business: string | null;
  mood: string | null;
  energy_level: number | null;
  focus_level: number | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const JOURNAL_TYPE_CONFIG: Record<JournalType, { label: string; color: string }> = {
  diario:        { label: 'Diario',        color: '#3B82F6' },
  idea:          { label: 'Idea',          color: '#B8922A' },
  decision:      { label: 'Decisión',      color: '#8B1A2E' },
  plan:          { label: 'Plan',          color: '#8B5CF6' },
  leccion:       { label: 'Lección',       color: '#16A34A' },
  cierre_diario: { label: 'Cierre diario', color: '#D97706' },
};

export async function getJournalEntries(type?: JournalType): Promise<JournalEntry[]> {
  let q = supabase.from('pm_journal_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
  if (type) q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as JournalEntry[];
}

export async function createJournalEntry(
  e: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<JournalEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_journal_entries')
    .insert({ ...e, user_id: user.id })
    .select().single();
  if (error) throw error;
  return data as JournalEntry;
}

export async function updateJournalEntry(
  id: string, e: Partial<Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase.from('pm_journal_entries').update(e).eq('id', id);
  if (error) throw error;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const { error } = await supabase.from('pm_journal_entries').delete().eq('id', id);
  if (error) throw error;
}

// Cierre diario: uno por fecha. Devuelve el de la fecha dada si existe.
export async function getCierreForDate(date: string): Promise<JournalEntry | null> {
  const { data } = await supabase
    .from('pm_journal_entries')
    .select('*')
    .eq('type', 'cierre_diario')
    .eq('entry_date', date)
    .maybeSingle();
  return (data as JournalEntry) ?? null;
}

// Crea o actualiza el cierre del día (evita duplicados por fecha)
export async function upsertCierre(
  date: string,
  fields: Omit<JournalEntry, 'id' | 'user_id' | 'type' | 'entry_date' | 'created_at' | 'updated_at'>
): Promise<JournalEntry> {
  const existing = await getCierreForDate(date);
  if (existing) {
    await updateJournalEntry(existing.id, fields);
    return { ...existing, ...fields } as JournalEntry;
  }
  return createJournalEntry({ ...fields, type: 'cierre_diario', entry_date: date });
}

// ── Contexto para el Asistente IA (solo lectura) ──
export interface JournalContext {
  recentEntries: JournalEntry[];
  activeIdeas: JournalEntry[];
  decisionsInReview: JournalEntry[];
  activePlans: JournalEntry[];
  recentClosings: JournalEntry[];
  recentLessons: JournalEntry[];
}

export async function getJournalContext(): Promise<JournalContext> {
  const all = await getJournalEntries();
  return {
    recentEntries: all.slice(0, 20),
    activeIdeas: all.filter(e => e.type === 'idea' && !['descartada', 'convertida'].includes(e.status ?? '')),
    decisionsInReview: all.filter(e => e.type === 'decision' && e.status === 'en_revision'),
    activePlans: all.filter(e => e.type === 'plan' && e.status === 'activo'),
    recentClosings: all.filter(e => e.type === 'cierre_diario').slice(0, 7),
    recentLessons: all.filter(e => e.type === 'leccion').slice(0, 10),
  };
}

// ─── MEMORIA IA ───────────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'general' | 'identidad' | 'personalidad' | 'vision' | 'preferencias'
  | 'objetivos' | 'salud' | 'negocios' | 'familia' | 'reglas' | 'contexto'
  | 'perfil_personal' | 'riesgos' | 'emprendimiento' | 'estrategia' | 'diagnostico'
  | 'modeltex' | 'tecnologia_textil' | 'procesos' | 'vision_negocio' | 'moldey'
  | 'tecnologia' | 'automatizacion' | 'ia' | 'hardware'
  | 'ceo_modeltex' | 'ceo_denis' | 'ia_personal'
  | 'fortalezas' | 'debilidades' | 'reglas_ia' | 'modo_anti_caos'
  | 'crm' | 'ventas';

export interface AiMemory {
  id: string;
  user_id: string;
  category: string;
  title: string;
  content: string;
  importance: number;   // 1–5
  source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const MEMORY_CATEGORIES: Array<{ key: MemoryCategory; label: string }> = [
  { key: 'general',      label: 'General' },
  { key: 'identidad',    label: 'Identidad' },
  { key: 'personalidad', label: 'Personalidad' },
  { key: 'vision',       label: 'Visión' },
  { key: 'preferencias', label: 'Preferencias' },
  { key: 'objetivos',    label: 'Objetivos' },
  { key: 'salud',        label: 'Salud' },
  { key: 'negocios',     label: 'Negocios' },
  { key: 'familia',      label: 'Familia' },
  { key: 'reglas',          label: 'Reglas' },
  { key: 'contexto',        label: 'Contexto' },
  { key: 'perfil_personal', label: 'Perfil personal' },
  { key: 'riesgos',         label: 'Riesgos' },
  { key: 'emprendimiento',  label: 'Emprendimiento' },
  { key: 'estrategia',      label: 'Estrategia' },
  { key: 'diagnostico',     label: 'Diagnóstico' },
  { key: 'modeltex',          label: 'Modeltex' },
  { key: 'tecnologia_textil', label: 'Tecnología textil' },
  { key: 'procesos',          label: 'Procesos' },
  { key: 'vision_negocio',    label: 'Visión de negocio' },
  { key: 'moldey',            label: 'Moldey' },
  { key: 'tecnologia',        label: 'Tecnología' },
  { key: 'automatizacion',    label: 'Automatización' },
  { key: 'ia',                label: 'IA' },
  { key: 'hardware',          label: 'Hardware' },
  { key: 'ceo_modeltex',      label: 'CEO Modeltex' },
  { key: 'ceo_denis',         label: 'CEO Denis' },
  { key: 'ia_personal',       label: 'IA personal' },
  { key: 'fortalezas',        label: 'Fortalezas' },
  { key: 'debilidades',       label: 'Debilidades' },
  { key: 'reglas_ia',         label: 'Reglas IA' },
  { key: 'modo_anti_caos',    label: 'Modo anti caos' },
  { key: 'crm',               label: 'CRM' },
  { key: 'ventas',            label: 'Ventas' },
];

export async function getAiMemories(): Promise<AiMemory[]> {
  const { data, error } = await supabase
    .from('pm_ai_memory')
    .select('*')
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AiMemory[];
}

export async function getActiveAiMemories(): Promise<AiMemory[]> {
  const { data, error } = await supabase
    .from('pm_ai_memory')
    .select('*')
    .eq('is_active', true)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AiMemory[];
}

export async function createAiMemory(
  m: Omit<AiMemory, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<AiMemory> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await supabase
    .from('pm_ai_memory')
    .insert({ ...m, user_id: user.id })
    .select().single();
  if (error) throw error;
  return data as AiMemory;
}

export async function updateAiMemory(
  id: string, m: Partial<Omit<AiMemory, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase.from('pm_ai_memory').update(m).eq('id', id);
  if (error) throw error;
}

export async function setAiMemoryActive(id: string, isActive: boolean): Promise<void> {
  await updateAiMemory(id, { is_active: isActive });
}

export async function deleteAiMemory(id: string): Promise<void> {
  const { error } = await supabase.from('pm_ai_memory').delete().eq('id', id);
  if (error) throw error;
}
