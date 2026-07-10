import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../lib/theme';
import {
  Sun, Moon, Menu, X, LogOut, Crown, Shield,
  CalendarDays, Target, Bot, Compass, Flame, Radar, BookText, Languages,
  GripVertical, RotateCcw,
} from 'lucide-react';
import BusinessQuickAccess from './BusinessQuickAccess';
import SyncStatus from './SyncStatus';
import {
  getTasks, getGoalsWithProgress, getProjects,
  getHabits, getHabitLogs, getCierreForDate, getJournalEntries, getFutureVisions,
} from '../lib/planMaestro';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Page =
  | 'agenda' | 'hoy' | 'kanban'
  | 'objetivos' | 'metas' | 'proyectos'
  | 'mapa-futuro' | 'disciplina' | 'radar'
  | 'bitacora' | 'ai-assistant' | 'memoria-ia' | 'english-hub' | 'users';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
  isAdmin?: boolean;
  onLogout: () => void;
}

interface NavItem {
  page: Page;
  label: string;
  icon: typeof CalendarDays;
  adminOnly?: boolean;
}

// ─── Nav items (orden por defecto) ───────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { page: 'agenda',       label: 'Agenda',      icon: CalendarDays },
  { page: 'objetivos',    label: 'Objetivos',   icon: Target },
  { page: 'mapa-futuro',  label: 'Brújula',     icon: Compass },
  { page: 'disciplina',   label: 'Disciplina',  icon: Flame },
  { page: 'radar',        label: 'Radar',       icon: Radar },
  { page: 'bitacora',     label: 'Bitácora',    icon: BookText },
  { page: 'ai-assistant', label: 'Agente CEO',  icon: Bot },
  { page: 'english-hub',  label: 'My English',  icon: Languages },
  { page: 'users',        label: 'Usuarios',    icon: Shield, adminOnly: true },
];

const DEFAULT_ORDER: Page[] = NAV_ITEMS.map(i => i.page);
const STORAGE_KEY = 'ceo_denis_sidebar_order';
const AGENDA_PAGES: Page[] = ['agenda', 'hoy', 'kanban'];

// ─── Order persistence ────────────────────────────────────────────────────────

function loadOrder(): Page[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed: Page[] = JSON.parse(raw);
    const known = new Set(DEFAULT_ORDER);
    const valid = parsed.filter(p => known.has(p));
    const missing = DEFAULT_ORDER.filter(p => !valid.includes(p));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

function saveOrder(order: Page[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* ignore */ }
}

// ─── Alerts hook ──────────────────────────────────────────────────────────────

interface AlertInfo { count: number; urgent: boolean }
type AlertMap = Partial<Record<Page, AlertInfo>>;

function useSidebarAlerts(): AlertMap {
  const [alerts, setAlerts] = useState<AlertMap>({});

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    async function load() {
      const result: AlertMap = {};

      await Promise.allSettled([
        // Agenda: tareas que necesitan atención (sin doble conteo)
        (async () => {
          const tasks = await getTasks();
          const attnTasks = tasks.filter(t =>
            t.status !== 'hecho' && (
              (t.due_date && t.due_date <= today) ||
              t.status === 'hoy' ||
              t.status === 'en_curso'
            )
          );
          const overdueCount = tasks.filter(t =>
            t.status !== 'hecho' && t.due_date && t.due_date < today
          ).length;
          if (attnTasks.length > 0)
            result['agenda'] = { count: attnTasks.length, urgent: overdueCount > 0 };
        })(),

        // Objetivos: proyectos y metas atrasados
        (async () => {
          const [goals, projects] = await Promise.all([getGoalsWithProgress(), getProjects()]);
          const overdueGoals = goals.filter(g => {
            if (!g.deadline || g.deadline >= today) return false;
            // Progreso real: por tareas si existen, si no por progress_manual
            const progress = g.task_count && g.task_count > 0
              ? Math.round(((g.done_task_count ?? 0) / g.task_count) * 100)
              : g.progress_manual ?? 0;
            return progress < 100;
          }).length;
          const overdueProj  = projects.filter(p =>
            p.target_date && p.target_date < today &&
            !['finalizado', 'cancelado'].includes(p.status ?? 'activo')
          ).length;
          const count = overdueGoals + overdueProj;
          if (count > 0) result['objetivos'] = { count, urgent: true };
        })(),

        // Disciplina: hábitos activos diarios sin log hoy
        (async () => {
          const habits = await getHabits();
          const active  = habits.filter(h => h.status === 'activo' && h.frequency === 'diario');
          if (!active.length) return;
          const logs    = await getHabitLogs(active.map(h => h.id), today);
          const pending = active.filter(h =>
            !logs.some(l => l.habit_id === h.id && l.log_date === today)
          ).length;
          if (pending > 0) result['disciplina'] = { count: pending, urgent: false };
        })(),

        // Bitácora: falta cierre + decisiones en revisión
        (async () => {
          const [cierre, entries] = await Promise.all([
            getCierreForDate(today),
            getJournalEntries('decision'),
          ]);
          const noCierre   = cierre ? 0 : 1;
          const inReview   = entries.filter(e => e.status === 'en_revision').length;
          const count      = noCierre + inReview;
          if (count > 0) result['bitacora'] = { count, urgent: false };
        })(),

        // Brújula: visiones con target_date vencida
        (async () => {
          const visions = await getFutureVisions();
          const overdue = visions.filter(v =>
            v.target_date && v.target_date < today && v.status !== 'logrado'
          ).length;
          if (overdue > 0) result['mapa-futuro'] = { count: overdue, urgent: true };
        })(),
      ]);

      setAlerts(result);
    }

    load();
  }, []);

  return alerts;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({
  currentPage, onNavigate, children, isAdmin = false, onLogout,
}: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [order, setOrder]   = useState<Page[]>(loadOrder);
  const [dragging, setDragging]   = useState<Page | null>(null);
  const [dragOver, setDragOver]   = useState<Page | null>(null);
  const dragRef = useRef<Page | null>(null);
  const alerts  = useSidebarAlerts();

  const handleNav = (page: Page) => { onNavigate(page); setSidebarOpen(false); };

  function isActive(page: Page): boolean {
    if (page === 'agenda') return AGENDA_PAGES.includes(currentPage);
    return currentPage === page;
  }

  // Ordered & visible items
  const orderedItems = useMemo(() =>
    order
      .map(p => NAV_ITEMS.find(i => i.page === p))
      .filter((i): i is NavItem => !!i && (!i.adminOnly || isAdmin)),
    [order, isAdmin]
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, page: Page) {
    dragRef.current = page;
    setDragging(page);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, page: Page) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragRef.current && dragRef.current !== page) setDragOver(page);
  }

  function handleDrop(e: React.DragEvent, targetPage: Page) {
    e.preventDefault();
    const source = dragRef.current;
    if (!source || source === targetPage) { cleanup(); return; }

    setOrder(prev => {
      const next    = [...prev];
      const fromIdx = next.indexOf(source);
      const toIdx   = next.indexOf(targetPage);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, source);
      saveOrder(next);
      return next;
    });
    cleanup();
  }

  function cleanup() {
    setDragging(null);
    setDragOver(null);
    dragRef.current = null;
  }

  function resetOrder() {
    setOrder(DEFAULT_ORDER);
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-plata-900 via-plata-800 to-bordo-900 transition-colors duration-200">

      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-plata-900/95 backdrop-blur-sm border-b border-plata-700/50 flex items-center px-4 gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-plata-800 transition-colors"
        >
          {sidebarOpen
            ? <X size={20} className="text-plata-300" />
            : <Menu size={20} className="text-dorado-400" />}
        </button>

        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => handleNav('agenda')}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bordo-600 shadow-pm">
            <Crown size={18} className="text-dorado-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-white tracking-tight leading-tight whitespace-nowrap">CEO DENIS</span>
            <span className="text-[10px] text-dorado-400/70 leading-tight">Centro de Operaciones Denis</span>
          </div>
        </div>

        <div className="flex-1" />

        <SyncStatus />

        {isAdmin && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-bordo-600/20 border border-bordo-500/30 rounded-lg">
            <Shield size={14} className="text-bordo-400" />
            <span className="text-xs text-bordo-300 font-medium">Admin</span>
          </div>
        )}

        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-plata-800 transition-colors"
          title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}>
          {theme === 'light'
            ? <Moon size={18} className="text-dorado-400" />
            : <Sun size={18} className="text-dorado-400" />}
        </button>

        <button onClick={onLogout} className="p-2 rounded-lg hover:bg-plata-800 transition-colors" title="Cerrar sesión">
          <LogOut size={18} className="text-plata-400 hover:text-red-400 transition-colors" />
        </button>
      </header>

      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-56 bg-plata-900/95 backdrop-blur-sm border-r border-plata-700/50 transition-transform duration-200 lg:translate-x-0 flex flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>

        <nav className="p-2.5 flex-1 overflow-y-auto flex flex-col gap-1">

          {/* ── Nav cards ── */}
          {orderedItems.map(({ page, label, icon: Icon }) => {
            const active  = isActive(page);
            const alert   = alerts[page];
            const isDrag  = dragging === page;
            const isOver  = dragOver === page;

            return (
              <div
                key={page}
                draggable
                onDragStart={e => handleDragStart(e, page)}
                onDragOver={e => handleDragOver(e, page)}
                onDrop={e => handleDrop(e, page)}
                onDragEnd={cleanup}
                onClick={() => handleNav(page)}
                className={`
                  group relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl
                  border cursor-pointer select-none
                  transition-all duration-150
                  ${isDrag  ? 'opacity-40 scale-95' : ''}
                  ${isOver  ? 'border-dorado-400/70 bg-dorado-900/20 scale-[1.02]' : ''}
                  ${active && !isOver
                    ? 'bg-bordo-500/25 border-dorado-400/50 shadow-sm'
                    : !isOver
                      ? 'bg-plata-800/20 border-plata-700/30 hover:bg-plata-700/30 hover:border-plata-600/50'
                      : ''
                  }
                `}
              >
                {/* Drag handle */}
                <div className="opacity-0 group-hover:opacity-30 transition-opacity shrink-0 cursor-grab active:cursor-grabbing">
                  <GripVertical size={12} className="text-plata-400" />
                </div>

                {/* Icon */}
                <Icon
                  size={16}
                  className={`shrink-0 transition-colors ${
                    active ? 'text-dorado-300' : 'text-plata-400 group-hover:text-plata-200'
                  }`}
                />

                {/* Label */}
                <span className={`flex-1 text-left text-sm font-medium transition-colors ${
                  active ? 'text-dorado-300' : 'text-plata-300 group-hover:text-white'
                }`}>
                  {label}
                </span>

                {/* Alert badge */}
                {alert && (
                  <span className={`
                    text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center
                    px-1 rounded-full shrink-0
                    ${alert.urgent
                      ? 'bg-red-500/80 text-white animate-pulse'
                      : 'bg-dorado-500/70 text-plata-900'}
                  `}>
                    {alert.count > 9 ? '9+' : alert.count}
                  </span>
                )}

                {/* Active dot */}
                {active && !alert && (
                  <div className="w-1.5 h-1.5 rounded-full bg-dorado-400 shrink-0" />
                )}
              </div>
            );
          })}

          {/* ── Mis negocios ── */}
          <div className="mt-1">
            <BusinessQuickAccess onNavigate={p => handleNav(p as Page)} />
          </div>
        </nav>

        {/* ── Footer: restore + branding ── */}
        <div className="shrink-0 p-2.5 flex flex-col gap-2">
          <button
            onClick={resetOrder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 w-full rounded-lg text-[11px] text-plata-500 hover:text-plata-300 hover:bg-plata-800/40 transition-colors"
            title="Restaurar orden por defecto"
          >
            <RotateCcw size={11} /> Restaurar orden
          </button>
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-bordo-500/20 bg-bordo-900/30">
            <Crown size={13} className="text-dorado-400" />
            <span className="text-[11px] text-dorado-400/70 font-medium">CEO DENIS</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="lg:ml-56 mt-14 p-4 md:p-6 min-h-[calc(100vh-3.5rem)]">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
