import { useState } from 'react';
import { useTheme } from '../lib/theme';
import {
  Sun, Moon, Menu, X, LogOut, Crown, Shield,
  CalendarCheck, LayoutDashboard, Target, FolderKanban, Bot, Compass, Flame, Radar,
} from 'lucide-react';
import BusinessQuickAccess from './BusinessQuickAccess';

export type Page = 'hoy' | 'kanban' | 'metas' | 'proyectos' | 'mapa-futuro' | 'disciplina' | 'radar' | 'ai-assistant' | 'users';

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
  icon: typeof CalendarCheck;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'hoy',          label: 'Hoy',          icon: CalendarCheck },
  { page: 'kanban',       label: 'Kanban',        icon: LayoutDashboard },
  { page: 'metas',        label: 'Metas',         icon: Target },
  { page: 'proyectos',    label: 'Proyectos',     icon: FolderKanban },
  { page: 'mapa-futuro',  label: 'Brújula',       icon: Compass },
  { page: 'disciplina',   label: 'Disciplina',    icon: Flame },
  { page: 'radar',        label: 'Radar',         icon: Radar },
  { page: 'ai-assistant', label: 'Asistente IA',  icon: Bot },
  { page: 'users',        label: 'Usuarios',      icon: Shield, adminOnly: true },
];

export default function Layout({ currentPage, onNavigate, children, isAdmin = false, onLogout }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (page: Page) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-gradient-to-br from-plata-900 via-plata-800 to-bordo-900 transition-colors duration-200">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-plata-900/95 backdrop-blur-sm border-b border-plata-700/50 flex items-center px-4 gap-3 transition-colors duration-200">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-plata-800 transition-colors"
        >
          {sidebarOpen ? <X size={20} className="text-plata-300" /> : <Menu size={20} className="text-dorado-400" />}
        </button>

        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => handleNav('hoy')}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bordo-600 shadow-pm">
            <Crown size={18} className="text-dorado-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-white tracking-tight leading-tight whitespace-nowrap">CEO DENIS</span>
            <span className="text-[10px] text-dorado-400/70 leading-tight">Centro de Operaciones Denis</span>
          </div>
        </div>

        <div className="flex-1" />

        {isAdmin && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-bordo-600/20 border border-bordo-500/30 rounded-lg">
            <Shield size={14} className="text-bordo-400" />
            <span className="text-xs text-bordo-300 font-medium">Admin</span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-plata-800 transition-colors"
          title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
        >
          {theme === 'light'
            ? <Moon size={18} className="text-dorado-400" />
            : <Sun size={18} className="text-dorado-400" />}
        </button>

        <button
          onClick={onLogout}
          className="p-2 rounded-lg hover:bg-plata-800 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={18} className="text-plata-400 hover:text-red-400 transition-colors" />
        </button>
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-56 bg-plata-900/95 backdrop-blur-sm border-r border-plata-700/50 transition-transform duration-200 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {visibleItems.map(({ page, label, icon: Icon }) => (
            <button
              key={page}
              onClick={() => handleNav(page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                currentPage === page
                  ? 'bg-bordo-500/20 text-dorado-300 border-l-2 border-dorado-400'
                  : 'text-plata-300 hover:bg-plata-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}

          {/* Mis negocios */}
          <BusinessQuickAccess />
        </nav>

        {/* Branding at bottom */}
        <div className="shrink-0 p-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-bordo-500/20 bg-bordo-900/30">
            <Crown size={14} className="text-dorado-400" />
            <span className="text-xs text-dorado-400/70 font-medium">CEO DENIS</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-56 mt-14 p-4 md:p-6 min-h-[calc(100vh-3.5rem)]">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
