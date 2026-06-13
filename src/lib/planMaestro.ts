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

// ─── AI CONTEXT ───────────────────────────────────────────────────────────────

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
}

export async function getPmAiContext(): Promise<PmAiContext> {
  const today = new Date().toISOString().split('T')[0];
  const [tasks, goals, projects] = await Promise.all([getTasks(), getGoalsWithProgress(), getProjects()]);

  const tasksByStatus = { inbox: 0, hoy: 0, en_curso: 0, esperando: 0, hecho: 0 };
  for (const t of tasks) tasksByStatus[t.status]++;

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

export type VisionArea = 'negocios' | 'familia' | 'salud' | 'dinero' | 'viajes' | 'estilo_vida' | 'mentalidad';
export type VisionStatus = 'sonado' | 'planificacion' | 'en_proceso' | 'logrado';

export interface FutureVision {
  id: string;
  user_id: string;
  title: string;
  area: VisionArea;
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
};

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

// ─── RADAR ────────────────────────────────────────────────────────────────────

export const RADAR_AREAS = [
  'Salud',
  'Energía',
  'Disciplina',
  'Familia',
  'Relación / Pareja',
  'Dinero',
  'Negocios / Trabajo',
  'Aprendizaje',
  'Mentalidad',
  'Tiempo libre / Viajes',
  'Naturaleza / Calma',
] as const;

export type RadarAreaName = typeof RADAR_AREAS[number];

export interface RadarScore {
  id: string;
  evaluation_id: string;
  user_id: string;
  area_name: RadarAreaName;
  current_score: number;   // 1–10
  target_score: number;    // 1–10
  note: string | null;
  main_action: string | null;
  created_at: string;
  updated_at: string;
}

export interface RadarEvaluation {
  id: string;
  user_id: string;
  title: string;
  evaluation_date: string;
  general_note: string | null;
  created_at: string;
  updated_at: string;
  scores?: RadarScore[];
}

// Derived metrics (calculated client-side)
export interface RadarMetrics {
  overallAvg: number;
  strongestArea: string;
  weakestArea: string;
  biggestGapArea: string;
}

export function calcRadarMetrics(scores: RadarScore[]): RadarMetrics {
  if (scores.length === 0) {
    return { overallAvg: 0, strongestArea: '—', weakestArea: '—', biggestGapArea: '—' };
  }
  const avg = scores.reduce((s, x) => s + x.current_score, 0) / scores.length;
  const strongest = scores.reduce((a, b) => a.current_score >= b.current_score ? a : b);
  const weakest = scores.reduce((a, b) => a.current_score <= b.current_score ? a : b);
  const biggestGap = scores.reduce((a, b) =>
    (b.target_score - b.current_score) >= (a.target_score - a.current_score) ? b : a
  );
  return {
    overallAvg: Math.round(avg * 10) / 10,
    strongestArea: strongest.area_name,
    weakestArea: weakest.area_name,
    biggestGapArea: biggestGap.area_name,
  };
}

export function getAreaStatus(score: number): { label: string; color: string; bg: string } {
  if (score <= 3) return { label: 'Crítico',   color: 'text-red-300',     bg: 'bg-red-900/30' };
  if (score <= 5) return { label: 'En riesgo', color: 'text-amber-300',   bg: 'bg-amber-900/30' };
  if (score <= 7) return { label: 'Estable',   color: 'text-dorado-300',  bg: 'bg-dorado-900/30' };
  return              { label: 'Fuerte',    color: 'text-emerald-300', bg: 'bg-emerald-900/30' };
}

// ─── CRUD RADAR ───────────────────────────────────────────────────────────────

export async function getRadarEvaluations(): Promise<RadarEvaluation[]> {
  const { data, error } = await supabase
    .from('pm_radar_evaluations')
    .select('*')
    .order('evaluation_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRadarEvaluationWithScores(id: string): Promise<RadarEvaluation | null> {
  const [evalRes, scoresRes] = await Promise.all([
    supabase.from('pm_radar_evaluations').select('*').eq('id', id).single(),
    supabase.from('pm_radar_scores').select('*').eq('evaluation_id', id),
  ]);
  if (evalRes.error) throw evalRes.error;
  return { ...evalRes.data, scores: scoresRes.data ?? [] };
}

export async function createRadarEvaluation(
  eval_: Omit<RadarEvaluation, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'scores'>,
  scores: Omit<RadarScore, 'id' | 'evaluation_id' | 'user_id' | 'created_at' | 'updated_at'>[]
): Promise<RadarEvaluation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: evalData, error: evalErr } = await supabase
    .from('pm_radar_evaluations')
    .insert({ ...eval_, user_id: user.id })
    .select()
    .single();
  if (evalErr) throw evalErr;

  if (scores.length > 0) {
    const { error: scoresErr } = await supabase
      .from('pm_radar_scores')
      .insert(scores.map(s => ({ ...s, evaluation_id: evalData.id, user_id: user.id })));
    if (scoresErr) throw scoresErr;
  }

  return { ...evalData, scores };
}

export async function updateRadarEvaluation(
  id: string,
  eval_: Partial<Omit<RadarEvaluation, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'scores'>>,
  scores?: Omit<RadarScore, 'id' | 'evaluation_id' | 'user_id' | 'created_at' | 'updated_at'>[]
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error: evalErr } = await supabase.from('pm_radar_evaluations').update(eval_).eq('id', id);
  if (evalErr) throw evalErr;

  if (scores) {
    // Delete all existing scores and re-insert
    await supabase.from('pm_radar_scores').delete().eq('evaluation_id', id);
    if (scores.length > 0) {
      const { error: scoresErr } = await supabase
        .from('pm_radar_scores')
        .insert(scores.map(s => ({ ...s, evaluation_id: id, user_id: user.id })));
      if (scoresErr) throw scoresErr;
    }
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
    .eq('evaluation_id', evaluationId);
  if (error) throw error;
  return data ?? [];
}
