import AsyncStorage from "@react-native-async-storage/async-storage";

// Read-through cache wrapper for API calls. Used on rails that should
// stay readable offline (home, recently-viewed, cart). The pattern:
//
//   const items = await getCached(
//     "home:featured",
//     () => api.get<{items: ...}>("/api/products/list", {...}),
//     5 * 60 * 1000,
//   );
//
// While the network is up, we refresh on every call AND write back to
// the cache. When the network is down or the call errors, we serve the
// last successful payload. TTL is informational only -- stale data is
// always preferred over an empty rail.

type CachedEntry<T> = { value: T; storedAt: number };

const PREFIX = "streekmart:cache:";

async function read<T>(key: string): Promise<CachedEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedEntry<T>;
  } catch {
    return null;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ value, storedAt: Date.now() }));
  } catch {
    /* best effort */
  }
}

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  // The TTL is advisory -- we always try the network first and only
  // fall back to cache on error. The value matters mostly when we
  // expose it to UI ("cached 5 min ago").
  ttlMs = 5 * 60 * 1000,
): Promise<T> {
  try {
    const fresh = await fetcher();
    await write(key, fresh);
    return fresh;
  } catch (err) {
    const cached = await read<T>(key);
    if (cached && Date.now() - cached.storedAt < ttlMs * 6) {
      return cached.value;
    }
    throw err;
  }
}

// Drop the entire cache (called on logout so the next signed-in user
// doesn't see the previous user's snapshot).
export async function clearApiCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    /* ignore */
  }
}