/**
 * Motor de sincronización offline-first.
 *
 * - Las lecturas de la app salen SIEMPRE de la base local (Dexie/IndexedDB).
 * - Las escrituras se aplican localmente y se encolan en _outbox.
 * - Al haber conexión: push de la cola (en orden) y luego pull completo
 *   de todas las tablas (espejo del servidor → local).
 * - Conflictos: last-write-wins (la operación local pisa al servidor en push;
 *   el pull posterior trae el estado final).
 */
import { supabase as remote } from './supabase';
import { localdb, SYNC_TABLES, getMeta, setMeta, type OutboxOp } from './localdb';

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'pending' | 'error';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSync: string | null;
}

let state: SyncState = { status: navigator.onLine ? 'synced' : 'offline', pending: 0, lastSync: null };
const listeners = new Set<(s: SyncState) => void>();

function emit(partial: Partial<SyncState>) {
  state = { ...state, ...partial };
  listeners.forEach(l => l(state));
}

export function subscribeSync(cb: (s: SyncState) => void): () => void {
  listeners.add(cb);
  cb(state);
  return () => listeners.delete(cb);
}

export function getSyncState(): SyncState {
  return state;
}

async function refreshPendingCount(): Promise<number> {
  const count = await localdb._outbox.count();
  emit({ pending: count });
  return count;
}

// ── Cola de salida ────────────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function enqueue(op: Omit<OutboxOp, 'seq' | 'ts'>): Promise<void> {
  await localdb._outbox.add({ ...op, ts: Date.now() } as OutboxOp);
  await refreshPendingCount();
  if (!navigator.onLine) {
    emit({ status: 'offline' });
    return;
  }
  emit({ status: 'pending' });
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { void syncNow(); }, 1500);
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return /fetch|network|failed to|ERR_|timeout|abort/i.test(msg);
}

// ── Push ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: Array<[string, string, unknown]> | undefined): any {
  let q = query;
  for (const [col, op, value] of filters ?? []) {
    if (op === 'eq') q = q.eq(col, value);
    else if (op === 'neq') q = q.neq(col, value);
    else if (op === 'is') q = q.is(col, value);
    else if (op === 'in') q = q.in(col, value as unknown[]);
    else if (op === 'gte') q = q.gte(col, value);
    else if (op === 'lte') q = q.lte(col, value);
    else if (op === 'ilike') q = q.ilike(col, value as string);
  }
  return q;
}

async function pushOp(op: OutboxOp): Promise<void> {
  switch (op.type) {
    case 'insert': {
      const { error } = await remote.from(op.table).insert(op.rows as never);
      // Fila ya existente (reintento tras un push parcial) → tratar como éxito
      if (error && !/duplicate|already exists|23505/i.test(error.message)) throw error;
      break;
    }
    case 'update': {
      const { error } = await applyFilters(remote.from(op.table).update(op.patch as never), op.filters);
      if (error) throw error;
      break;
    }
    case 'delete': {
      const { error } = await applyFilters(remote.from(op.table).delete(), op.filters);
      if (error) throw error;
      break;
    }
    case 'upsert': {
      const { error } = await remote.from(op.table).upsert(op.row as never, op.onConflict ? { onConflict: op.onConflict } : undefined);
      if (error) throw error;
      break;
    }
    case 'file_upload': {
      const file = op.fileKey ? await localdb._files.get(op.fileKey) : undefined;
      if (!file) break; // archivo perdido — nada que subir
      const { error } = await remote.storage
        .from(op.bucket!)
        .upload(op.path!, file.blob, { upsert: true, contentType: file.contentType });
      if (error) throw error;
      await localdb._files.put({ ...file, pending: false });
      break;
    }
  }
}

async function pushOutbox(): Promise<void> {
  const ops = await localdb._outbox.orderBy('seq').toArray();
  for (const op of ops) {
    try {
      await pushOp(op);
    } catch (err) {
      if (isNetworkError(err)) throw err; // se corta el sync, se reintenta después
      // Tabla aún no creada en Supabase: la operación queda en cola esperando
      // (no se descarta) y no bloquea al resto.
      const msg = String((err as { message?: string })?.message ?? err ?? '');
      if (/does not exist|42P01|PGRST2/i.test(msg)) continue;
      // Error del servidor (constraint, RLS, etc): registrar y descartar para
      // no bloquear la cola entera con una operación envenenada.
      console.error('[sync] Operación descartada por error del servidor:', op, err);
      const errors = (await getMeta<unknown[]>('syncErrors')) ?? [];
      await setMeta('syncErrors', [...errors.slice(-19), { op: { ...op }, error: String((err as Error)?.message ?? err), at: new Date().toISOString() }]);
    }
    await localdb._outbox.delete(op.seq!);
    await refreshPendingCount();
  }
}

// ── Pull ──────────────────────────────────────────────────────────────────────

const PAGE = 1000;

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await remote.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

async function pullAll(): Promise<void> {
  for (const table of SYNC_TABLES) {
    let rows: Record<string, unknown>[];
    try {
      rows = await fetchAllRows(table);
    } catch (err) {
      if (isNetworkError(err)) throw err;
      // Tabla inaccesible (RLS/permiso) — no rompe el resto del pull
      console.warn(`[sync] No se pudo bajar ${table}:`, err);
      continue;
    }
    const store = localdb.dataTable(table);
    await localdb.transaction('rw', store, async () => {
      await store.clear();
      if (rows.length) await store.bulkPut(rows);
    });
  }
  await setMeta('lastPullAt', new Date().toISOString());
}

// ── Ciclo de sync ─────────────────────────────────────────────────────────────

let syncing: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (syncing) return syncing;
  syncing = doSync().finally(() => { syncing = null; });
  return syncing;
}

async function doSync(): Promise<void> {
  if (!navigator.onLine) {
    emit({ status: 'offline' });
    return;
  }
  // Sin sesión no hay nada que sincronizar (RLS bloquearía todo)
  try {
    const { data: { session } } = await remote.auth.getSession();
    if (!session) return;
  } catch {
    return;
  }
  emit({ status: 'syncing' });
  try {
    await pushOutbox();
    await pullAll();
    const now = new Date().toISOString();
    await setMeta('lastSyncAt', now);
    emit({ status: 'synced', lastSync: now });
  } catch (err) {
    console.warn('[sync] Sync interrumpido, se reintenta más tarde:', err);
    const pending = await refreshPendingCount();
    emit({ status: navigator.onLine ? (pending > 0 ? 'pending' : 'error') : 'offline' });
  }
}

/**
 * Garantiza que exista al menos UN pull completo antes de leer datos locales.
 * - Ya hubo pull alguna vez → resuelve al instante (los datos locales sirven).
 * - Nunca hubo pull y hay internet → espera el primer sync.
 * - Nunca hubo pull y NO hay internet → resuelve (la app arranca vacía).
 */
let initialPullChecked = false;
export async function ensureInitialPull(): Promise<void> {
  if (initialPullChecked) return;
  const last = await getMeta<string>('lastPullAt');
  if (last) { initialPullChecked = true; return; }
  if (!navigator.onLine) return;
  await syncNow();
  initialPullChecked = true;
}

// ── Arranque y triggers automáticos ──────────────────────────────────────────

let started = false;
export function startSyncEngine(): void {
  if (started) return;
  started = true;
  void refreshPendingCount();
  void getMeta<string>('lastSyncAt').then(v => { if (v) emit({ lastSync: v }); });

  window.addEventListener('online', () => {
    emit({ status: 'pending' });
    void syncNow();
  });
  window.addEventListener('offline', () => emit({ status: 'offline' }));

  // Sync periódico de fondo cada 5 minutos
  setInterval(() => { if (navigator.onLine) void syncNow(); }, 5 * 60 * 1000);

  // Primer sync al arrancar (si hay sesión e internet)
  if (navigator.onLine) setTimeout(() => { void syncNow(); }, 1000);
}
