import { useEffect, useState } from 'react';
import { getDashboardStats } from '../lib/orders';
import {
  ClipboardList,
  Users,
  Truck,
  Clock,
  AlertTriangle,
  TrendingUp,
  Zap,
  PlusCircle,
} from 'lucide-react';

interface Stats {
  totalOrders: number;
  newOrders: number;
  inProcessOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  activeClients: number;
  totalClients: number;
  totalSales: number;
  pendingPayments: number;
  delayedOrders: number;
  urgentOrders: number;
  paidOrders: number;
  unpaidOrders: number;
}

interface StatCardProps {
  icon: typeof ClipboardList;
  label: string;
  value: string | number;
  colorClass: string;
  bgClass: string;
  onClick?: () => void;
}

function StatCard({ icon: Icon, label, value, colorClass, bgClass, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-xl ${bgClass} border border-petrol-200/50 dark:border-slate-700/50 transition-all duration-150 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] text-left w-full`}
    >
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-petrol-800 dark:text-white">{value}</p>
        <p className="text-xs text-petrol-500 dark:text-petrol-400 mt-0.5">{label}</p>
      </div>
    </button>
  );
}

interface DashboardProps {
  onNavigate: (page: string, orderId?: string, clientId?: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const formatCurrency = (n: number) => `$${n.toLocaleString('es-AR')}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-petrol-800 dark:text-white">Dashboard</h1>
          <p className="text-sm text-petrol-500 dark:text-petrol-400 mt-1">Centro de Operaciones Modeltex</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-petrol-500 dark:text-petrol-400">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Pedidos totales"
          value={stats.totalOrders}
          colorClass="bg-petrol-700"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          icon={Zap}
          label="Pedidos nuevos"
          value={stats.newOrders}
          colorClass="bg-violet-500"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          icon={Clock}
          label="En proceso"
          value={stats.inProcessOrders}
          colorClass="bg-petrol-600"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          icon={Truck}
          label="Entregados"
          value={stats.deliveredOrders}
          colorClass="bg-emerald-600"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('orders')}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Clientes activos"
          value={stats.activeClients}
          colorClass="bg-violet-600"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('clients')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Pedidos urgentes"
          value={stats.urgentOrders}
          colorClass="bg-amber-500"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Pedidos demorados"
          value={stats.delayedOrders}
          colorClass="bg-red-500"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          icon={TrendingUp}
          label="Ventas totales"
          value={formatCurrency(stats.totalSales)}
          colorClass="bg-petrol-800"
          bgClass="bg-crudo-50 dark:bg-slate-800"
          onClick={() => onNavigate('finance')}
        />
      </div>

      {/* Financial summary */}
      <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
        <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-4">Resumen financiero</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-petrol-500 dark:text-petrol-400">Total vendido</p>
            <p className="text-2xl font-bold text-petrol-800 dark:text-white">${stats.totalSales.toLocaleString('es-AR')}</p>
          </div>
          <div>
            <p className="text-xs text-petrol-500 dark:text-petrol-400">Cobrado</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${(stats.totalSales - stats.pendingPayments).toLocaleString('es-AR')}</p>
          </div>
          <div>
            <p className="text-xs text-petrol-500 dark:text-petrol-400">Pendiente de cobro</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">${stats.pendingPayments.toLocaleString('es-AR')}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-3 bg-petrol-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-petrol-600 rounded-full transition-all duration-500"
              style={{ width: `${stats.totalSales > 0 ? Math.min(100, ((stats.totalSales - stats.pendingPayments) / stats.totalSales) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-petrol-500 dark:text-petrol-400 mt-1.5 text-right">
            {stats.totalSales > 0 ? Math.round(((stats.totalSales - stats.pendingPayments) / stats.totalSales) * 100) : 0}% cobrado
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-5 border border-petrol-200 dark:border-slate-700/50">
        <h2 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 uppercase tracking-wide mb-3">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('new-order')}
            className="px-5 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
          >
            <PlusCircle size={18} /> Nuevo pedido
          </button>
          <button
            onClick={() => onNavigate('clients')}
            className="px-5 py-3 bg-petrol-600 hover:bg-petrol-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
          >
            <Users size={18} /> Nuevo cliente
          </button>
          <button
            onClick={() => onNavigate('orders')}
            className="px-5 py-3 bg-white dark:bg-slate-700 hover:bg-crudo-100 dark:hover:bg-slate-600 text-petrol-700 dark:text-petrol-300 rounded-xl text-sm font-medium border border-petrol-300 dark:border-slate-600 transition-colors"
          >
            Ver todos los pedidos
          </button>
          <button
            onClick={() => onNavigate('finance')}
            className="px-5 py-3 bg-white dark:bg-slate-700 hover:bg-crudo-100 dark:hover:bg-slate-600 text-petrol-700 dark:text-petrol-300 rounded-xl text-sm font-medium border border-petrol-300 dark:border-slate-600 transition-colors"
          >
            Resumen financiero
          </button>
        </div>
      </div>
    </div>
  );
}
