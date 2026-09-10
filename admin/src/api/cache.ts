/**
 * High-Performance Client-Side Cache and Preloader Service
 * Provides instant 0ms data retrieval from in-memory Map & persistent LocalStorage.
 * Eliminates loading spinners on module navigation and preloads all core data on login.
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const STORAGE_PREFIX = 'bb_fast_cache_';
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes default cache

class AppCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private listeners = new Map<string, Set<(data: any) => void>>();

  // Normalize URL key
  private normalizeKey(url: string): string {
    return url.trim();
  }

  // Get data immediately in 0 milliseconds
  get<T = any>(url: string): T | null {
    const key = this.normalizeKey(url);

    // 1. Check in-memory fast cache
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < memEntry.ttl) {
        return memEntry.data as T;
      }
      this.memoryCache.delete(key);
    }

    // 2. Check localStorage fallback (for instant load across refresh / re-open)
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw) {
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() - entry.timestamp < entry.ttl) {
          this.memoryCache.set(key, entry);
          return entry.data as T;
        } else {
          localStorage.removeItem(STORAGE_PREFIX + key);
        }
      }
    } catch {
      // Ignore storage errors
    }

    return null;
  }

  // Check if data is already cached
  has(url: string): boolean {
    return this.get(url) !== null;
  }

  // Check if data needs background revalidation
  isStale(url: string, freshThresholdMs = 20000): boolean {
    const key = this.normalizeKey(url);
    const entry = this.memoryCache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > freshThresholdMs;
  }

  // Store data in both memory and localStorage
  set(url: string, data: any, ttl = DEFAULT_TTL_MS): void {
    if (!data) return;
    const key = this.normalizeKey(url);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.memoryCache.set(key, entry);

    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // LocalStorage full or quota exceeded, silent ignore
    }

    // Notify listeners of fresh data
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(cb => cb(data));
    }
  }

  // Subscribe to background updates for a given URL
  subscribe(url: string, callback: (data: any) => void): () => void {
    const key = this.normalizeKey(url);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  // Invalidate matching keys on mutations (POST, PUT, DELETE)
  invalidateMatching(pattern: string): void {
    const p = pattern.toLowerCase();

    // Memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.toLowerCase().includes(p)) {
        this.memoryCache.delete(key);
      }
    }

    // LocalStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX) && k.toLowerCase().includes(p)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  // Clear everything (e.g. on user logout)
  invalidateAll(): void {
    this.memoryCache.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }
}

export const appCache = new AppCacheService();
