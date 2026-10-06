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
