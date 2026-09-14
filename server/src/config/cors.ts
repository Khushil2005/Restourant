import { CorsOptions } from 'cors';
import { logger } from '../utils/logger';

export function getAllowedOrigins(): string[] {
  const origins = [
    'https://restourant-ten.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  if (process.env.ALLOWED_ORIGINS) {
    const extra = process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
    origins.push(...extra);
  }

  return origins;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow requests with no origin (like mobile apps, curl, Postman, server-to-server)
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Allow live Vercel production deployment
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'restourant-ten.vercel.app' || parsed.hostname.endsWith('.vercel.app')) {
      return true;
    }
  } catch {
    // Malformed origin string
  }

  return false;
}

export const expressCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

export const socketCorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, success?: boolean) => void) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[Socket.IO CORS] Blocked connection from unauthorized origin: ${origin}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
};
