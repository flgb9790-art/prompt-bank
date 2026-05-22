const REFERENCE_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEnvelope<T> = {
  savedAt: number;
  data: T;
};

export function readReferenceCache<T>(key: string): T | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope?.savedAt || envelope.data === undefined) {
      sessionStorage.removeItem(key);
      return null;
    }
    if (Date.now() - envelope.savedAt > REFERENCE_CACHE_TTL_MS) {
      return null;
    }
    return envelope.data;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function writeReferenceCache<T>(key: string, data: T) {
  const envelope: CacheEnvelope<T> = { savedAt: Date.now(), data };
  sessionStorage.setItem(key, JSON.stringify(envelope));
}

export function removeReferenceCache(key: string) {
  sessionStorage.removeItem(key);
}
