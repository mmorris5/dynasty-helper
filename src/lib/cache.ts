/**
 * Tiny IndexedDB key/value store with TTL. Used for the 14MB Sleeper player
 * dictionary (too large for localStorage) and for day-scoped API responses.
 */
const DB_NAME = "dynasty-helper";
const STORE = "cache";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

interface Entry<T> {
  value: T;
  expires: number;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    const entry = await new Promise<Entry<T> | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as Entry<T> | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!entry) return null;
    if (Date.now() > entry.expires) return null;
    return entry.value;
  } catch {
    return null; // private mode / blocked storage: behave as a cache miss
  }
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ value, expires: Date.now() + ttlMs }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal: the app works without a cache, just slower.
  }
}

export async function cacheClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
