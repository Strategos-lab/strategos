import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  eraseLearningData,
  exportLearningToObject,
  importLearningReplace,
  listLearningEvents,
  writeLearningEvent,
  LEARNING_DB_NAME,
} from '../index';
import { resetLearningDbForTests } from '../learningDb';
import { requestPersistentStorage } from '../persist';

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
