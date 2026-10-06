import {
  eraseLearningData,
  listLearningEvents,
  writeLearningEvent,
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

  // Phase 0: replace. Merge-by-id comes in a later phase.
  await eraseLearningData();

  for (const event of data.events) {
    const { id: _id, ...rest } = event;
    await writeLearningEvent(rest);
  }

  return { count: data.events.length };
}

export async function parseAndImportLearningFile(
  file: File,
): Promise<{ count: number }> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  return importLearningReplace(parsed);
}
