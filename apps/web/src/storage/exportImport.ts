import {
  listLearningEvents,
  replaceLearningData,
  type LearningEvent,
  LEARNING_DB_NAME,
} from './learningDb';

export const EXPORT_FORMAT_VERSION = 1;

export interface LearningExport {
  format: 'strategos-learning';
  formatVersion: number;
  exportedAt: string;
  database: typeof LEARNING_DB_NAME;
  /** Worksheet data is intentionally excluded from learning exports. */
  excludesWorksheet: true;
  events: LearningEvent[];
}

export async function exportLearningToObject(): Promise<LearningExport> {
  const events = await listLearningEvents();
  return {
    format: 'strategos-learning',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    database: LEARNING_DB_NAME,
    excludesWorksheet: true,
    events,
  };
}

export function downloadLearningExport(data: LearningExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `strategos-learning-${data.exportedAt.slice(0, 10)}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const nonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/**
 * Validate a single imported event against the LearningEvent shape. Returns
 * a list of human-readable issues (empty when the event is valid). Imports
 * are validated in full, before any destructive action, so a malformed
 * event anywhere in the file never reaches the database.
 */
function validateImportedEvent(event: unknown, index: number): string[] {
  const issues: string[] = [];
  const prefix = `events[${index}]`;

  if (!isPlainObject(event)) {
    issues.push(`${prefix}: must be an object`);
    return issues;
  }

  if (!nonEmptyString(event.type)) {
    issues.push(`${prefix}.type: must be a non-empty string`);
  }
  if (!isPlainObject(event.payload)) {
    issues.push(`${prefix}.payload: must be an object`);
  }
  if (typeof event.createdAt !== 'string' || Number.isNaN(Date.parse(event.createdAt))) {
    issues.push(`${prefix}.createdAt: must be an ISO date string`);
  }
  if (
    typeof event.schemaVersion !== 'number' ||
    !Number.isInteger(event.schemaVersion) ||
    event.schemaVersion < 1
  ) {
    issues.push(`${prefix}.schemaVersion: must be a positive integer`);
  }
  if (!nonEmptyString(event.engineVersion)) {
    issues.push(`${prefix}.engineVersion: must be a non-empty string`);
  }
  if (!nonEmptyString(event.contentVersion)) {
    issues.push(`${prefix}.contentVersion: must be a non-empty string`);
  }

  return issues;
}

export async function importLearningReplace(
  raw: unknown,
): Promise<{ count: number }> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid export: not an object');
  }
  const data = raw as Partial<LearningExport>;
  if (data.format !== 'strategos-learning') {
    throw new Error('Invalid export: unexpected format');
  }
  if (typeof data.formatVersion !== 'number') {
    throw new Error('Invalid export: missing formatVersion');
  }
  if (!Array.isArray(data.events)) {
    throw new Error('Invalid export: events must be an array');
  }

  const issues = data.events.flatMap((event, index) => validateImportedEvent(event, index));
  if (issues.length > 0) {
    throw new Error(`Invalid export: ${issues.join('; ')}`);
  }

  // Validation above guarantees every element matches LearningEvent (minus id).
  const events = data.events.map(({ id: _id, ...rest }) => rest as Omit<LearningEvent, 'id'>);

  // Phase 0: replace. Merge-by-id comes in a later phase.
  // Erase + write happen in one Dexie transaction (replaceLearningData): if
  // the write fails, the transaction rolls back and existing data survives.
  await replaceLearningData(events);

  return { count: events.length };
}

export async function parseAndImportLearningFile(
  file: File,
): Promise<{ count: number }> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  return importLearningReplace(parsed);
}
