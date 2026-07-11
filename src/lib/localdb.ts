import Dexie, { type Table } from 'dexie';

// Todas las tablas que se espejan localmente y se sincronizan con Supabase.
export const SYNC_TABLES = [
  'pm_projects',
  'pm_goals',
  'pm_tasks',
  'pm_kanban_columns',
  'pm_ai_conversations',
  'pm_ai_messages',
  'pm_future_visions',
  'pm_habits',
  'pm_habit_logs',
  'pm_radars',
  'pm_radar_area_defs',
  'pm_radar_evaluations',
  'pm_radar_scores',
  'pm_business_links',
  'pm_businesses',
  'pm_business_time_blocks',
  'pm_journal_entries',
  'pm_week_board',
  'pm_week_tasks',
  'pm_ai_memory',
  'pm_eng_words',
  'pm_eng_user_words',
  'pm_office_cards',
  'pm_office_links',
  'user_profiles',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export interface OutboxOp {
  seq?: number;
  ts: number;
  table: string;
  type: 'insert' | 'update' | 'delete' | 'upsert' | 'file_upload';
  // insert: rows a insertar (con id local generado)
  rows?: Record<string, unknown>[];
  // update: patch + filtros
  patch?: Record<string, unknown>;
  // update/delete: filtros [col, op, value]
  filters?: Array<[string, string, unknown]>;
  // upsert
  row?: Record<string, unknown>;
  onConflict?: string;
  // file_upload
  bucket?: string;
  path?: string;
  fileKey?: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export interface LocalFile {
  key: string;          // URL pública del archivo (determinística)
  bucket: string;
  path: string;
  blob: Blob;
  contentType: string;
  pending: boolean;     // true = todavía no subido al servidor
}

class CeoDenisLocalDB extends Dexie {
  _outbox!: Table<OutboxOp, number>;
  _meta!: Table<MetaEntry, string>;
  _files!: Table<LocalFile, string>;

  constructor() {
    super('ceo-denis-local');
    const stores: Record<string, string> = {
      _outbox: '++seq',
      _meta: 'key',
      _files: 'key',
    };
    for (const t of SYNC_TABLES) stores[t] = 'id';
    // v2: + pm_office_cards / pm_office_links (sección Oficina)
    this.version(2).stores(stores);
  }

  dataTable(name: string): Table<Record<string, unknown>, string> {
    return this.table(name);
  }
}

export const localdb = new CeoDenisLocalDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const entry = await localdb._meta.get(key);
  return entry?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await localdb._meta.put({ key, value });
}
