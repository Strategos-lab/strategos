import Dexie, { type Table } from 'dexie';

/**
 * Separate worksheet database (stub for Phase 0).
 * Kept apart from learning so default exports never include worksheet content.
 */
export const WORKSHEET_DB_NAME = 'strategos-v1-worksheet';

export interface WorksheetStub {
  id?: number;
  placeholder: true;
}

export class WorksheetDatabase extends Dexie {
  entries!: Table<WorksheetStub, number>;

  constructor() {
    super(WORKSHEET_DB_NAME);
    this.version(1).stores({
      entries: '++id',
    });
  }
}

let worksheetDb: WorksheetDatabase | null = null;

export function getWorksheetDb(): WorksheetDatabase {
  if (!worksheetDb) {
    worksheetDb = new WorksheetDatabase();
  }
  return worksheetDb;
}

/** Phase 0: store exists but stays empty. */
export async function ensureWorksheetStore(): Promise<void> {
  // Opening the DB creates the schema; no writes.
  getWorksheetDb();
}
