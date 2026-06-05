import { useState } from 'react';
import { useTheme } from '../lib/theme';
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  DollarSign,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  Factory,
  Users,
  Package,
  FolderOpen,
  Image as ImageIcon,
  UserCog,
  Shield,
  CalendarDays,
} from 'lucide-react';

type Page = 'dashboard' | 'orders' | 'new-order' | 'finance' | 'order-detail' | 'clients' | 'inventory' | 'library' | 'catalog' | 'personal' | 'agenda';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page, orderId?: string, clientId?: string, modelId?: string) => void;
  children: React.ReactNode;
  isAdmin?: boolean;
  userRole?: string;
  onLogout: () => void;
}

interface NavItem {
  page: Page;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  hiddenForPending?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'orders', label: 'Pedidos', icon: ClipboardList },
  { page: 'clients', label: 'Clientes', icon: Users },
  { page: 'agenda', label: 'Agenda', icon: CalendarDays, hiddenForPending: true },
  { page: 'inventory', label: 'Inventario', icon: Package },
  { page: 'library', label: 'Biblioteca', icon: FolderOpen },
  { page: 'catalog', label: 'Catálogo Interno', icon: ImageIcon },
  { page: 'personal', label: 'Personal', icon: UserCog },
  { page: 'finance', label: 'Finanzas', icon: DollarSign },
];

export default function Layout({ currentPage, onNavigate, children, isAdmin = false, userRole, onLogout }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (page: Page) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  const normalizedRole = String(userRole ?? '').trim().toLowerCase();
  const visibleNavItems = NAV_ITEMS.filter(item => !item.hiddenForPending || normalizedRole !== 'pendiente');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 transition-colors duration-200">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 flex items-center px-4 gap-3 transition-colors duration-200">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {sidebarOpen ? <X size={20} className="text-slate-300" /> : <Menu size={20} className="text-teal-400" />}
        </button>

        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNav('dashboard')}>
          <Factory size={24} className="text-teal-400" />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white tracking-tight leading-tight">CEO MODELTEX</span>
            <span className="text-[10px] text-teal-400/70 leading-tight">Centro de Operaciones</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Admin badge */}
        {isAdmin && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-teal-600/20 border border-teal-500/30 rounded-lg">
            <Shield size={14} className="text-teal-400" />
            <span className="text-xs text-teal-300 font-medium">Admin</span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
        >
          {theme === 'light' ? (
            <Moon size={18} className="text-teal-400" />
          ) : (
            <Sun size={18} className="text-yellow-400" />
          )}
        </button>

        <button
          onClick={onLogout}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={18} className="text-slate-400 hover:text-red-400 transition-colors" />
        </button>
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-56 bg-slate-900/95 backdrop-blur-sm border-r border-slate-700/50 transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-3 space-y-1">
          {visibleNavItems.map(({ page, label, icon: Icon, adminOnly }) => (
            <button
              key={page}
              onClick={() => handleNav(page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                currentPage === page
                  ? 'bg-teal-500/20 text-teal-300 border-l-2 border-teal-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{label}</span>
              {adminOnly && (
                <Shield size={12} className="text-teal-400" />
              )}
            </button>
          ))}
        </nav>

        {/* Quick new order button at bottom */}
        <div className="absolute bottom-4 left-3 right-3">
          <button
            onClick={() => handleNav('new-order')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold transition-colors duration-150 text-sm shadow-lg shadow-teal-600/20"
          >
            <PlusCircle size={18} />
            Nuevo Pedido
          </button>
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
