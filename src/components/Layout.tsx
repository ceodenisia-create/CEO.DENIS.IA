import { useState } from 'react';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/hooks';
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
} from 'lucide-react';

type Page = 'dashboard' | 'orders' | 'new-order' | 'finance' | 'order-detail' | 'clients' | 'inventory' | 'library' | 'catalog';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page, orderId?: string, clientId?: string, modelId?: string) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'orders', label: 'Pedidos', icon: ClipboardList },
  { page: 'clients', label: 'Clientes', icon: Users },
  { page: 'inventory', label: 'Inventario', icon: Package },
  { page: 'library', label: 'Biblioteca', icon: FolderOpen },
  { page: 'catalog', label: 'Catálogo Interno', icon: ImageIcon },
  { page: 'new-order', label: 'Nuevo Pedido', icon: PlusCircle },
  { page: 'finance', label: 'Finanzas', icon: DollarSign },
];

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (page: Page) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-petrol-900 dark:bg-slate-950 transition-colors duration-200">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-petrol-800 dark:bg-slate-900 border-b border-petrol-700 dark:border-slate-800 flex items-center px-4 gap-3 transition-colors duration-200">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-petrol-700 dark:hover:bg-slate-800 transition-colors"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} className="text-crudo-200" />}
        </button>

        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNav('dashboard')}>
          <Factory size={24} className="text-violet-400" />
          <span className="text-lg font-bold text-crudo-100 tracking-tight">Modeltex</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-petrol-700 dark:hover:bg-slate-800 transition-colors"
          title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
        >
          {theme === 'light' ? (
            <Moon size={18} className="text-violet-400" />
          ) : (
            <Sun size={18} className="text-yellow-400" />
          )}
        </button>

        {user && (
          <button
            onClick={signOut}
            className="p-2 rounded-lg hover:bg-petrol-700 dark:hover:bg-slate-800 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={18} className="text-crudo-400" />
          </button>
        )}
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
        className={`fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-56 bg-petrol-800/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-petrol-700 dark:border-slate-800 transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
            <button
              key={page}
              onClick={() => handleNav(page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                currentPage === page
                  ? 'bg-violet-500/20 text-violet-300 border-l-2 border-violet-400'
                  : 'text-crudo-300 hover:bg-petrol-700 dark:hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Quick new order button at bottom */}
        <div className="absolute bottom-4 left-3 right-3">
          <button
            onClick={() => handleNav('new-order')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-semibold transition-colors duration-150 text-sm shadow-lg shadow-violet-500/20"
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
