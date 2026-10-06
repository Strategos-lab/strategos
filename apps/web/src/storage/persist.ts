export type PersistResult =
  | { supported: false; persistent: false; message: string }
  | { supported: true; persistent: boolean; message: string };

export async function requestPersistentStorage(): Promise<PersistResult> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return {
      supported: false,
      persistent: false,
      message: 'Persistent storage API not available in this browser.',
    };
  }

  const already = await navigator.storage.persisted();
  if (already) {
    return {
      supported: true,
      persistent: true,
      message: 'Storage is already persistent.',
    };
  }

  const granted = await navigator.storage.persist();
  return {
    supported: true,
    persistent: granted,
    message: granted
      ? 'Persistent storage granted.'
      : 'Persistent storage denied or deferred by the browser. Data may still be evicted under pressure.',
  };
}

export async function checkPersisted(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return null;
  }
  return navigator.storage.persisted();
}
