import { apiClient } from './client';
import { appCache } from './cache';

// Core endpoints to preload immediately when user logs in
const PRELOAD_ENDPOINTS = [
  '/dashboard/metrics',
  '/tables/floor-layout',
  '/masters/floor-zones',
  '/masters/menu-categories',
  '/masters/menu-items',
  '/masters/tables',
  '/daily-menu/today',
  '/daily-menu',
  '/tokens/queue/today',
  '/kitchen/kot/active',
  '/masters/taxes',
  '/masters/payment-modes',
  '/masters/customers',
  '/masters/suppliers',
  '/employees'
];

let isPreloading = false;

/**
 * Preloads all essential ERP modules in parallel in the background.
 * Automatically saves results into appCache so every module opens in 0ms.
 */
export async function preloadAllModulesData(force = false): Promise<void> {
  const token = localStorage.getItem('access_token');
  if (!token) return;

  if (isPreloading && !force) return;
  isPreloading = true;

  try {
    await Promise.allSettled(
      PRELOAD_ENDPOINTS.map(async (endpoint) => {
        try {
          // If we already have fresh data in cache and not forcing, skip
          if (!force && !appCache.isStale(endpoint, 30000) && appCache.has(endpoint)) {
            return;
          }
          const res: any = await (apiClient as any).get(endpoint, { noCache: true });
          if (res && (res.success !== false)) {
            appCache.set(endpoint, res);
          }
        } catch {
          // Ignore individual endpoint failure in background
        }
      })
    );
  } catch {
    // Silent
  } finally {
    isPreloading = false;
  }
}
