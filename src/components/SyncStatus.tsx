import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import { subscribeSync, syncNow, type SyncState } from '../lib/sync';

/**
 * Chip de estado de sincronización para el header:
 * 🟢 sincronizado · 🟡 cambios pendientes · 🔵 sincronizando · 🔴 sin conexión.
 * Click = forzar sync.
 */
export default function SyncStatus() {
  const [state, setState] = useState<SyncState>({ status: 'synced', pending: 0, lastSync: null });

  useEffect(() => subscribeSync(setState), []);

  const cfg = (() => {
    switch (state.status) {
      case 'offline':
        return { icon: CloudOff, text: 'Sin conexión', cls: 'text-red-300 bg-red-900/30 border-red-500/40', spin: false };
      case 'syncing':
        return { icon: RefreshCw, text: 'Sincronizando…', cls: 'text-sky-300 bg-sky-900/30 border-sky-500/40', spin: true };
      case 'pending':
      case 'error':
        return { icon: UploadCloud, text: `${state.pending} pendiente${state.pending === 1 ? '' : 's'}`, cls: 'text-dorado-300 bg-dorado-900/30 border-dorado-500/40', spin: false };
      default:
        return { icon: Cloud, text: 'Sincronizado', cls: 'text-emerald-300 bg-emerald-900/30 border-emerald-500/40', spin: false };
    }
  })();

  const Icon = cfg.icon;
  const title = state.lastSync
    ? `Última sincronización: ${new Date(state.lastSync).toLocaleString()}`
    : 'Todavía no se sincronizó';

  return (
    <button
      onClick={() => { void syncNow(); }}
      title={`${title} — click para sincronizar ahora`}
      className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${cfg.cls}`}
    >
      <Icon size={14} className={cfg.spin ? 'animate-spin' : ''} />
      <span>{cfg.text}</span>
    </button>
  );
}
