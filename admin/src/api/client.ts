import axios from 'axios';
import { appCache } from './cache';

// Centralized API Base URL resolution
const getApiBaseUrl = (): string => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim()) {
    return envApiUrl.trim().replace(/\/+$/, '');
  }

  // If accessed from a local development host (localhost, 127.0.0.1, LAN IP), use local proxy
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
      return '/api';
    }
  }

  // Production fallback: ALWAYS communicate with Render backend
  if (import.meta.env.PROD) {
    return 'https://restourant-eoj3.onrender.com/api';
  }

  // Local development default (routes through Vite dev proxy)
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Authorization Bearer token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle expired tokens and global API errors + Cache Auto-Management
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    const method = response.config?.method?.toLowerCase();
    const url = response.config?.url;

    // Cache successful GET responses
    if (method === 'get' && url && data && data.success !== false) {
      appCache.set(url, data);
    }

    // Auto-invalidate caches on write mutations (POST, PUT, PATCH, DELETE)
    if (method && ['post', 'put', 'patch', 'delete'].includes(method) && url) {
      if (url.includes('/orders') || url.includes('/tables') || url.includes('/billing')) {
        appCache.invalidateMatching('/tables/floor-layout');
        appCache.invalidateMatching('/orders');
        appCache.invalidateMatching('/dashboard');
        appCache.invalidateMatching('/kitchen');
      } else if (url.includes('/daily-menu')) {
        appCache.invalidateMatching('/daily-menu');
        appCache.invalidateMatching('/pos');
      } else if (url.includes('/masters')) {
        appCache.invalidateMatching('/masters');
        appCache.invalidateMatching('/tables/floor-layout');
        appCache.invalidateMatching('/daily-menu');
      } else if (url.includes('/tokens')) {
        appCache.invalidateMatching('/tokens');
        appCache.invalidateMatching('/dashboard');
      } else {
        appCache.invalidateMatching(url);
      }
    }

    return data;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          if (res.data?.data?.accessToken) {
            localStorage.setItem('access_token', res.data.data.accessToken);
            originalRequest.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
            return apiClient(originalRequest);
          }
        } catch (refreshErr) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          appCache.invalidateAll();
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        appCache.invalidateAll();
        if (!window.location.pathname.startsWith('/display') && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }

    const message = error.response?.data?.message || error.message || 'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

// High-speed transparent GET caching layer:
// Resolves in 0ms from in-memory / persistent cache, and silently revalidates in background if stale
const rawGet = apiClient.get.bind(apiClient);

(apiClient as any).get = async function (url: string, config?: any) {
  // If explicitly requested fresh or noCache, bypass cache
  if (config?.noCache || config?.forceFresh) {
    return rawGet(url, config);
  }

  const cached = appCache.get(url);
  if (cached !== null) {
    // If data is older than 20 seconds, revalidate in background silently
    if (appCache.isStale(url, 20000)) {
      rawGet(url, { ...config, noCache: true })
        .then((fresh: any) => {
          if (fresh && fresh.success !== false) {
            appCache.set(url, fresh);
          }
        })
        .catch(() => {});
    }
    // Return cached data immediately in 0ms!
    return cached;
  }

  // Otherwise fetch from network and store in cache
  const res: any = await rawGet(url, config);
  if (res && res.success !== false) {
    appCache.set(url, res);
  }
  return res;
};

