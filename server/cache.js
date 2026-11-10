/**
 * In-memory cache for Bitrix24 data (used by server/index.js).
 *
 * - Younger than `ttl`: answered from the cache.
 * - Between `ttl` and `maxStale` old: still answered at once, while ONE fresh fetch runs in the
 *   background (the next request gets the fresh data). If that fetch fails, the cached data is kept
 *   and the next request tries again.
 * - `maxStale` old or older: never answered; the request waits for fresh data (sharing a
 *   background fetch that is already running).
 * - Parallel requests for the same key share one fetch.
 * - clear() (the "Refresh data" button) drops everything, so the next request fetches fresh data;
 *   a fetch that started before the clear never overwrites what came after it.
 *
 * `now` and `onBackgroundError` can be replaced in tests.
 */
export function createCache({
  ttl,
  maxStale,
  now = () => Date.now(),
  onBackgroundError = (key, error) =>
    console.error(`Background refresh ERROR (${key}):`, error instanceof Error ? error.message : error),
}) {
  const entries = new Map();

  /**
   * Milliseconds until the oldest cached data expires (fetches still running hold newer
   * data, so they do not count); 0 when nothing is cached yet, and 0 while older data is being
   * answered during a background fetch, so the browser never keeps that data.
   */
  function expiresIn() {
    const loaded = [...entries.values()].filter((entry) => !entry.pending);
    if (loaded.length === 0) return 0;
    return Math.max(0, Math.min(...loaded.map((entry) => entry.time + ttl - now())));
  }

  /**
   * Starts one background fetch for an entry between `ttl` and `maxStale` old; the entry keeps
   * answering meanwhile. The fresh data replaces it only if the cache was not cleared or replaced
   * in the meantime. On failure the entry stays as it is and the next request tries again.
   */
  function refreshInBackground(key, entry, load) {
    const refresh = load();
    entry.refreshing = refresh;
    refresh.then(
      (value) => {
        if (entries.get(key) === entry) entries.set(key, { promise: refresh, time: now(), pending: false });
        return value;
      },
      (error) => {
        onBackgroundError(key, error);
        if (entry.refreshing === refresh) entry.refreshing = null;
      },
    );
  }

  function cached(key, load) {
    const entry = entries.get(key);
    const age = entry ? now() - entry.time : Infinity;
    if (entry && (entry.pending || age < ttl)) return entry.promise;
    if (entry && age < maxStale) {
      if (!entry.refreshing) refreshInBackground(key, entry, load);
      return entry.promise;
    }
    // Too old to answer: wait for fresh data (sharing a background fetch that is already running).
    if (entry?.refreshing) return entry.refreshing;

    const promise = load().then(
      (value) => {
        // Only store it if the cache was not cleared (refreshed) while this fetch was running;
        // otherwise an older, slower fetch could overwrite fresher data.
        if (entries.get(key)?.promise === promise) entries.set(key, { promise, time: now(), pending: false });
        return value;
      },
      (error) => {
        if (entries.get(key)?.promise === promise) entries.delete(key);
        throw error;
      },
    );
    entries.set(key, { promise, time: now(), pending: true });
    return promise;
  }

  return { cached, expiresIn, clear: () => entries.clear() };
}
