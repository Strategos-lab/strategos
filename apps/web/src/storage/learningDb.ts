import Dexie, { type Table } from 'dexie';

/** Namespaced learning database. Never store worksheet data here. */
export const LEARNING_DB_NAME = 'strategos-v1-learning';

export interface LearningEvent {
  id?: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  schemaVersion: number;
  engineVersion: string;
  contentVersion: string;
}

export class LearningDatabase extends Dexie {
  events!: Table<LearningEvent, number>;

  constructor() {
    super(LEARNING_DB_NAME);
    this.version(1).stores({
      events: '++id, type, createdAt',
    });
  }
}

let learningDb: LearningDatabase | null = null;

export function getLearningDb(): LearningDatabase {
  if (!learningDb) {
    learningDb = new LearningDatabase();
  }
  return learningDb;
}

/** Test helper — close and drop the singleton so each suite starts clean. */
export async function resetLearningDbForTests(): Promise<void> {
  if (learningDb) {
    learningDb.close();
    learningDb = null;
  }
  await Dexie.delete(LEARNING_DB_NAME);
}

export async function writeLearningEvent(
  event: Omit<LearningEvent, 'id'>,
): Promise<number> {
  return getLearningDb().events.add(event);
}

export async function listLearningEvents(): Promise<LearningEvent[]> {
  return getLearningDb().events.orderBy('id').toArray();
}

export async function eraseLearningData(): Promise<void> {
  await getLearningDb().events.clear();
}

/**
 * Atomically replace all learning events. The clear and the writes happen in
 * one Dexie transaction: if any write fails, the whole transaction rolls
 * back and existing data is left untouched (no cleared-but-not-reloaded
 * state).
 */
export async function replaceLearningData(
  events: Array<Omit<LearningEvent, 'id'>>,
): Promise<void> {
  const db = getLearningDb();
  await db.transaction('rw', db.events, async () => {
    await db.events.clear();
    if (events.length > 0) {
      await db.events.bulkAdd(events);
    }
  });
}
