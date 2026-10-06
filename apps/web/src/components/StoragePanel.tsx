import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkPersisted,
  downloadLearningExport,
  eraseLearningData,
  exportLearningToObject,
  listLearningEvents,
  parseAndImportLearningFile,
  requestPersistentStorage,
  writeLearningEvent,
  type LearningEvent,
  type PersistResult,
} from '../storage';

export function StoragePanel() {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [persistInfo, setPersistInfo] = useState<PersistResult | null>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const list = await listLearningEvents();
    setEvents(list);
    const persisted = await checkPersisted();
    if (persisted === null) {
      setPersistInfo({
        supported: false,
        persistent: false,
        message: 'Persistent storage API not available.',
      });
    } else if (!persistInfo || persistInfo.persistent !== persisted) {
      setPersistInfo({
        supported: true,
        persistent: persisted,
        message: persisted
          ? 'Storage: persistent'
          : 'Storage: may be cleared by the browser',
      });
    }
  }, [persistInfo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatus('');
    try {
      await fn();
      await refresh();
      setStatus(label);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="storage-panel" aria-label="Device storage spike">
      <h2>Device storage</h2>
      <p className="muted small">
        IndexedDB <code>strategos-v1-learning</code> (separate from worksheet stub{' '}
        <code>strategos-v1-worksheet</code>). Data never leaves this device unless you
        export it.
      </p>

      <div className="persist-status" data-testid="persist-status">
        {persistInfo?.message ?? 'Checking storage…'}
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          disabled={busy}
          data-testid="btn-write-sample"
          onClick={() =>
            void run('Sample event written.', async () => {
              await writeLearningEvent({
                type: 'phase0.sample',
                payload: { note: 'Phase 0 IndexedDB spike', demo: true },
                createdAt: new Date().toISOString(),
                schemaVersion: 1,
                engineVersion: '0.0.0-phase0',
                contentVersion: '0.0.0-phase0',
              });
            })
          }
        >
          Write sample event
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          data-testid="btn-request-persist"
          onClick={() =>
            void run('Persist request complete.', async () => {
              const result = await requestPersistentStorage();
              setPersistInfo(result);
            })
          }
        >
          Request persistent storage
        </button>
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          disabled={busy}
          data-testid="btn-export"
          onClick={() =>
            void run('Export downloaded (learning only).', async () => {
              const data = await exportLearningToObject();
              downloadLearningExport(data);
            })
          }
        >
          Export learning JSON
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          data-testid="btn-import"
          onClick={() => fileRef.current?.click()}
        >
          Import learning JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="import-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void run(`Imported ${file.name} (replace).`, async () => {
              const { count } = await parseAndImportLearningFile(file);
              setStatus(`Replaced learning data with ${count} event(s).`);
            });
          }}
        />
        <button
          type="button"
          className="btn danger"
          disabled={busy}
          data-testid="btn-erase"
          onClick={() =>
            void run('Learning data erased.', async () => {
              await eraseLearningData();
            })
          }
        >
          Erase learning data
        </button>
      </div>

      {status ? (
        <p className="status-line" data-testid="storage-status" role="status">
          {status}
        </p>
      ) : null}

      <h3>Events in learning DB</h3>
      {events.length === 0 ? (
        <p className="muted" data-testid="events-empty">
          No events yet.
        </p>
      ) : (
        <ul className="event-list" data-testid="events-list">
          {events.map((ev) => (
            <li key={ev.id}>
              <code>
                #{ev.id} {ev.type}
              </code>{' '}
              <span className="muted small">{ev.createdAt}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
