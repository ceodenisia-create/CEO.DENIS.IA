/**
 * Cliente offline-first con la misma interfaz que el cliente de Supabase
 * (el subconjunto que usa la app). Toda la app lee y escribe contra la base
 * LOCAL (IndexedDB); el motor de sync (sync.ts) replica contra Supabase.
 *
 * Uso: `import { supabase } from './offlineClient'` — drop-in replacement.
 */
import type { User } from '@supabase/supabase-js';
import { supabase as remote } from './supabase';
import { config } from './config';
import { localdb, getMeta, setMeta } from './localdb';
import { enqueue, ensureInitialPull, startSyncEngine, syncNow } from './sync';

type Row = Record<string, unknown>;
type FilterTuple = [string, string, unknown];

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Evaluación de filtros en memoria ─────────────────────────────────────────

function ilikeToRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}

function matchOne(row: Row, col: string, op: string, value: unknown): boolean {
  const v = row[col];
  switch (op) {
    case 'eq': return v === value || String(v) === String(value);
    case 'neq': return !(v === value || String(v) === String(value));
    case 'is': return value === null ? (v === null || v === undefined) : v === value;
    case 'in': return Array.isArray(value) && (value as unknown[]).some(x => x === v || String(x) === String(v));
    case 'gte': return v != null && (v as never) >= (value as never);
    case 'lte': return v != null && (v as never) <= (value as never);
    case 'gt': return v != null && (v as never) > (value as never);
    case 'lt': return v != null && (v as never) < (value as never);
    case 'ilike': return typeof v === 'string' && ilikeToRegex(String(value)).test(v);
    default: return true;
  }
}

// Parser del formato .or('col.op.valor,col.op.valor')
function matchOrExpr(row: Row, expr: string): boolean {
  return expr.split(',').some(part => {
    const bits = part.split('.');
    if (bits.length < 3) return false;
    const col = bits[0];
    const op = bits[1];
    const value = bits.slice(2).join('.');
    const parsed = value === 'null' ? null : value;
    return matchOne(row, col, op, parsed);
  });
}

function compareVals(a: unknown, b: unknown): number {
  // nulls al final siempre
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  return String(a).localeCompare(String(b));
}

function project(row: Row, columns: string): Row {
  if (columns === '*' || !columns.trim()) return row;
  const out: Row = {};
  for (const c of columns.split(',').map(s => s.trim()).filter(Boolean)) {
    out[c] = row[c];
  }
  return out;
}

// ── Query builder local ──────────────────────────────────────────────────────

interface ExecResult {
  // `any` a propósito: replica el tipado laxo del cliente de Supabase sin
  // generics, así los archivos existentes compilan sin cambios.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  data: any;
  error: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  count: number | null;
}

class LocalQuery implements PromiseLike<ExecResult> {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: Row | Row[] | null = null;
  private upsertOptions: { onConflict?: string } | undefined;
  private filters: FilterTuple[] = [];
  private orExprs: string[] = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private columns = '*';
  private takeSingle = false;
  private takeMaybeSingle = false;
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private countMode: string | null = null;
  private headOnly = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*', opts?: { count?: string; head?: boolean }): this {
    if (this.action === 'select') {
      this.columns = columns;
      if (opts?.count) this.countMode = opts.count;
      if (opts?.head) this.headOnly = true;
    } else {
      // .select() encadenado a insert/upsert: devolver las filas escritas
      this.columns = columns;
    }
    return this;
  }

  insert(payload: Row | Row[]): this { this.action = 'insert'; this.payload = payload; return this; }
  update(payload: Row): this { this.action = 'update'; this.payload = payload; return this; }
  delete(): this { this.action = 'delete'; return this; }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }): this {
    this.action = 'upsert'; this.payload = payload; this.upsertOptions = opts; return this;
  }

  eq(col: string, v: unknown): this { this.filters.push([col, 'eq', v]); return this; }
  neq(col: string, v: unknown): this { this.filters.push([col, 'neq', v]); return this; }
  is(col: string, v: unknown): this { this.filters.push([col, 'is', v]); return this; }
  in(col: string, v: unknown[]): this { this.filters.push([col, 'in', v]); return this; }
  gte(col: string, v: unknown): this { this.filters.push([col, 'gte', v]); return this; }
  lte(col: string, v: unknown): this { this.filters.push([col, 'lte', v]); return this; }
  gt(col: string, v: unknown): this { this.filters.push([col, 'gt', v]); return this; }
  lt(col: string, v: unknown): this { this.filters.push([col, 'lt', v]); return this; }
  ilike(col: string, v: string): this { this.filters.push([col, 'ilike', v]); return this; }
  or(expr: string): this { this.orExprs.push(expr); return this; }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number): this { this.limitN = n; return this; }
  range(from: number, to: number): this { this.rangeFrom = from; this.rangeTo = to; return this; }
  single(): this { this.takeSingle = true; return this; }
  maybeSingle(): this { this.takeMaybeSingle = true; return this; }

  then<T1 = ExecResult, T2 = never>(
    onfulfilled?: ((value: ExecResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every(([c, o, v]) => matchOne(row, c, o, v))
      && this.orExprs.every(expr => matchOrExpr(row, expr));
  }

  private sortRows(rows: Row[]): Row[] {
    if (!this.orders.length) return rows;
    return [...rows].sort((a, b) => {
      for (const { col, asc } of this.orders) {
        const cmp = compareVals(a[col], b[col]);
        if (cmp !== 0) return asc ? cmp : -cmp;
      }
      return 0;
    });
  }

  private finalize(rows: Row[]): ExecResult {
    let data: Row[] | Row | null = rows.map(r => project(r, this.columns));
    const count = this.countMode ? rows.length : null;
    if (this.headOnly) return { data: null, error: null, count };
    if (this.takeSingle) {
      if (rows.length !== 1) {
        return { data: null, error: { message: `Se esperaba exactamente 1 fila, hay ${rows.length}`, code: 'PGRST116' }, count };
      }
      data = (data as Row[])[0];
    } else if (this.takeMaybeSingle) {
      data = (data as Row[])[0] ?? null;
    }
    return { data, error: null, count };
  }

  private async exec(): Promise<ExecResult> {
    try {
      return await this.execInner();
    } catch (err) {
      return { data: null, error: { message: String((err as Error)?.message ?? err) }, count: null };
    }
  }

  private async execInner(): Promise<ExecResult> {
    const store = localdb.dataTable(this.table);

    if (this.action === 'select') {
      await ensureInitialPull();
      let rows = (await store.toArray()).filter(r => this.matches(r));
      rows = this.sortRows(rows);
      if (this.rangeFrom !== null && this.rangeTo !== null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      return this.finalize(rows);
    }

    if (this.action === 'insert') {
      const now = new Date().toISOString();
      const input = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const ids = input.map(() => uuid());
      const rows = input.map((r, i) => ({
        id: ids[i],
        created_at: now,
        updated_at: now,
        ...r,
      }));
      await store.bulkPut(rows);
      // Al servidor se manda solo lo que la app definió + el id generado:
      // los timestamps los pone el servidor (hay tablas sin esas columnas).
      const pushRows = input.map((r, i) => ({ id: ids[i], ...r }));
      await enqueue({ table: this.table, type: 'insert', rows: pushRows });
      return this.finalize(rows);
    }

    if (this.action === 'update') {
      const now = new Date().toISOString();
      const patch = this.payload as Row;
      const all = await store.toArray();
      const targets = all.filter(r => this.matches(r));
      const updated = targets.map(r => ({ ...r, ...patch, updated_at: now }));
      if (updated.length) await store.bulkPut(updated);
      await enqueue({ table: this.table, type: 'update', patch, filters: this.filters });
      return this.finalize(updated);
    }

    if (this.action === 'delete') {
      const all = await store.toArray();
      const targets = all.filter(r => this.matches(r));
      if (targets.length) await store.bulkDelete(targets.map(r => String(r.id)));
      await enqueue({ table: this.table, type: 'delete', filters: this.filters });
      return this.finalize(targets);
    }

    if (this.action === 'upsert') {
      const now = new Date().toISOString();
      const input = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const conflictCols = (this.upsertOptions?.onConflict ?? 'id').split(',').map(s => s.trim());
      const all = await store.toArray();
      const results: Row[] = [];
      for (const r of input) {
        const existing = all.find(e => conflictCols.every(c => e[c] === r[c] || String(e[c]) === String(r[c])));
        const merged: Row = existing
          ? { ...existing, ...r, id: existing.id, updated_at: now }
          : { id: uuid(), created_at: now, updated_at: now, ...r };
        await store.put(merged);
        results.push(merged);
        // En el push NO se manda el id local: el servidor resuelve por onConflict
        const { id: _id, created_at: _c, updated_at: _u, ...pushRow } = merged;
        void _id; void _c; void _u;
        await enqueue({ table: this.table, type: 'upsert', row: pushRow, onConflict: this.upsertOptions?.onConflict });
      }
      return this.finalize(results);
    }

    return { data: null, error: { message: 'Acción no soportada' }, count: null };
  }
}

// ── Auth con caché offline ────────────────────────────────────────────────────

interface CachedUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

async function cacheUser(user: User | null): Promise<void> {
  if (user) {
    await setMeta('cachedUser', {
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    } satisfies CachedUser);
  } else {
    await setMeta('cachedUser', null);
  }
}

export async function getCachedUser(): Promise<CachedUser | null> {
  return (await getMeta<CachedUser | null>('cachedUser')) ?? null;
}

const offlineAuth = {
  async getUser(): Promise<{ data: { user: User | null }; error: null }> {
    try {
      const { data: { session } } = await remote.auth.getSession();
      if (session?.user) {
        void cacheUser(session.user);
        return { data: { user: session.user }, error: null };
      }
    } catch { /* sin red o storage — probamos caché */ }
    const cached = await getCachedUser();
    return { data: { user: (cached as User | null) }, error: null };
  },

  async getSession() {
    try {
      const res = await remote.auth.getSession();
      if (res.data.session?.user) {
        void cacheUser(res.data.session.user);
        return res;
      }
    } catch { /* fallback */ }
    const cached = await getCachedUser();
    if (cached) {
      // Sesión sintética offline: la app solo usa session.user
      return { data: { session: { user: cached as User } as never }, error: null };
    }
    return { data: { session: null }, error: null };
  },

  async signInWithPassword(creds: { email: string; password: string }) {
    const res = await remote.auth.signInWithPassword(creds);
    if (!res.error && res.data.user) {
      await cacheUser(res.data.user);
      void syncNow();
    }
    return res;
  },

  async signUp(params: Parameters<typeof remote.auth.signUp>[0]) {
    const res = await remote.auth.signUp(params);
    if (!res.error && res.data.user) await cacheUser(res.data.user);
    return res;
  },

  async signOut() {
    await cacheUser(null);
    try {
      return await remote.auth.signOut();
    } catch {
      return { error: null };
    }
  },

  onAuthStateChange(cb: Parameters<typeof remote.auth.onAuthStateChange>[0]) {
    return remote.auth.onAuthStateChange(cb);
  },
};

// ── Storage con caché local de imágenes ──────────────────────────────────────

function publicUrlFor(bucket: string, path: string): string {
  return `${config.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

const offlineStorage = {
  from(bucket: string) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async upload(path: string, file: Blob, opts?: { upsert?: boolean; contentType?: string }): Promise<{ data: any; error: any }> {
        const url = publicUrlFor(bucket, path);
        const contentType = opts?.contentType || (file as File).type || 'application/octet-stream';
        // Guardar SIEMPRE el blob local: sirve como caché offline de la imagen
        await localdb._files.put({ key: url, bucket, path, blob: file, contentType, pending: true });
        if (navigator.onLine) {
          try {
            const res = await remote.storage.from(bucket).upload(path, file, opts);
            if (!res.error) {
              await localdb._files.put({ key: url, bucket, path, blob: file, contentType, pending: false });
              return res;
            }
          } catch { /* cae al modo offline */ }
        }
        // Offline (o falló la subida): queda encolada para el próximo sync
        await enqueue({ type: 'file_upload', table: '_storage', bucket, path, fileKey: url });
        return { data: { path }, error: null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: publicUrlFor(bucket, path) } };
      },
    };
  },
};

// ── Cliente exportado ─────────────────────────────────────────────────────────

export const supabase = {
  from(table: string): LocalQuery {
    return new LocalQuery(table);
  },
  auth: offlineAuth,
  storage: offlineStorage,
};

// Arrancar el motor de sync al cargar el módulo
startSyncEngine();
