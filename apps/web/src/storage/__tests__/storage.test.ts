import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  eraseLearningData,
  exportLearningToObject,
  importLearningReplace,
  listLearningEvents,
  writeLearningEvent,
  LEARNING_DB_NAME,
} from '../index';
import { getLearningDb, resetLearningDbForTests } from '../learningDb';
import { requestPersistentStorage } from '../persist';

const sampleEvent = {
  type: 'old',
  payload: {},
  createdAt: '2026-10-01T00:00:00.000Z',
  schemaVersion: 1,
  engineVersion: '0.0.0-phase0',
  contentVersion: '0.0.0-phase0',
};

function sampleExport(events: unknown[]) {
  return {
    format: 'strategos-learning',
    formatVersion: 1,
    exportedAt: '2026-10-07T00:00:00.000Z',
    database: LEARNING_DB_NAME,
    excludesWorksheet: true,
    events,
  };
}

describe('learning storage', () => {
  beforeEach(async () => {
    await resetLearningDbForTests();
  });

  afterEach(async () => {
    await resetLearningDbForTests();
  });

  it('writes and reads a sample learning event', async () => {
    const id = await writeLearningEvent({
      type: 'phase0.sample',
      payload: { demo: true },
      createdAt: '2026-10-07T00:00:00.000Z',
      schemaVersion: 1,
      engineVersion: '0.0.0-phase0',
      contentVersion: '0.0.0-phase0',
    });

    expect(id).toBeTypeOf('number');
    const events = await listLearningEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('phase0.sample');
    expect(events[0]?.payload).toEqual({ demo: true });
  });

  it('exports learning JSON without worksheet fields', async () => {
    await writeLearningEvent({
      type: 'phase0.sample',
      payload: {},
      createdAt: '2026-10-07T00:00:00.000Z',
      schemaVersion: 1,
      engineVersion: '0.0.0-phase0',
      contentVersion: '0.0.0-phase0',
    });

    const exported = await exportLearningToObject();
    expect(exported.format).toBe('strategos-learning');
    expect(exported.database).toBe(LEARNING_DB_NAME);
    expect(exported.excludesWorksheet).toBe(true);
    expect(exported.events).toHaveLength(1);
    expect(exported).not.toHaveProperty('worksheet');
  });

  it('import replace clears then loads events', async () => {
    await writeLearningEvent({
      type: 'old',
      payload: {},
      createdAt: '2026-10-01T00:00:00.000Z',
      schemaVersion: 1,
      engineVersion: '0.0.0-phase0',
      contentVersion: '0.0.0-phase0',
    });

    const result = await importLearningReplace({
      format: 'strategos-learning',
      formatVersion: 1,
      exportedAt: '2026-10-07T00:00:00.000Z',
      database: LEARNING_DB_NAME,
      excludesWorksheet: true,
      events: [
        {
          type: 'imported',
          payload: { n: 1 },
          createdAt: '2026-10-06T00:00:00.000Z',
          schemaVersion: 1,
          engineVersion: '0.0.0-phase0',
          contentVersion: '0.0.0-phase0',
        },
      ],
    });

    expect(result.count).toBe(1);
    const events = await listLearningEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('imported');
  });

  it('erase clears all learning events', async () => {
    await writeLearningEvent({
      type: 'x',
      payload: {},
      createdAt: '2026-10-07T00:00:00.000Z',
      schemaVersion: 1,
      engineVersion: '0.0.0-phase0',
      contentVersion: '0.0.0-phase0',
    });
    await eraseLearningData();
    expect(await listLearningEvents()).toHaveLength(0);
  });

  it('rejects invalid import payloads', async () => {
    await expect(importLearningReplace({ format: 'nope' })).rejects.toThrow(
      /unexpected format/,
    );
  });

  it('rejects an import with a malformed event at the start, leaving existing data intact', async () => {
    await writeLearningEvent(sampleEvent);

    await expect(
      importLearningReplace(
        sampleExport([
          { type: 'bad', payload: {} /* missing createdAt, schemaVersion, etc. */ },
          { ...sampleEvent, type: 'good' },
        ]),
      ),
    ).rejects.toThrow(/events\[0\]/);

    const events = await listLearningEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('old');
  });

  it('rejects an import with a malformed event later in the array, leaving existing data intact and no partial import', async () => {
    await writeLearningEvent(sampleEvent);

    await expect(
      importLearningReplace(
        sampleExport([
          { ...sampleEvent, type: 'good-1' },
          { ...sampleEvent, type: 'good-2', schemaVersion: 'not-a-number' },
        ]),
      ),
    ).rejects.toThrow(/events\[1\]/);

    const events = await listLearningEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('old');
    expect(events.some((e) => e.type === 'good-1')).toBe(false);
  });

  it('rolls back the whole replace if the write step fails, leaving existing data intact', async () => {
    await writeLearningEvent(sampleEvent);

    const bulkAddSpy = vi
      .spyOn(getLearningDb().events, 'bulkAdd')
      .mockRejectedValueOnce(new Error('simulated write failure'));

    await expect(
      importLearningReplace(sampleExport([{ ...sampleEvent, type: 'imported' }])),
    ).rejects.toThrow(/simulated write failure/);

    bulkAddSpy.mockRestore();

    const events = await listLearningEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('old');
  });

  it('round-trips a real export through import and reproduces the same learning history', async () => {
    await writeLearningEvent({ ...sampleEvent, type: 'a', payload: { n: 1 } });

    const exported = await exportLearningToObject();

    // Simulate a fresh device: wipe, then import the exported file.
    await eraseLearningData();
    expect(await listLearningEvents()).toHaveLength(0);

    const result = await importLearningReplace(exported);

    expect(result.count).toBe(1);
    const events = await listLearningEvents();
    expect(events.map((e) => e.type)).toEqual(['a']);
    expect(events.map((e) => e.payload)).toEqual([{ n: 1 }]);
  });

  it('accepts an empty events array and replaces existing data with an empty set', async () => {
    await writeLearningEvent(sampleEvent);

    const result = await importLearningReplace(sampleExport([]));

    expect(result.count).toBe(0);
    expect(await listLearningEvents()).toHaveLength(0);
  });
});

describe('requestPersistentStorage', () => {
  it('reports unsupported when API missing', async () => {
    const original = navigator.storage;
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: undefined,
    });

    const result = await requestPersistentStorage();
    expect(result.supported).toBe(false);

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: original,
    });
  });

  it('returns granted when persist succeeds', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const persisted = vi.fn().mockResolvedValue(false);
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist, persisted },
    });

    const result = await requestPersistentStorage();
    expect(result.supported).toBe(true);
    expect(result.persistent).toBe(true);
    expect(persist).toHaveBeenCalled();
  });
});
