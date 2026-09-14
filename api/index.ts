import { app } from '../server/src/app';
import { connectDatabase } from '../server/src/config/database';
import { runDatabaseMigrationsAndSeeds } from '../server/src/database/seedRunner';

let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      await connectDatabase();
      try {
        await runDatabaseMigrationsAndSeeds();
      } catch (seedErr) {
        console.warn('[Vercel Serverless] Seed check warning (non-fatal):', seedErr);
      }
    })();
  }
  await initPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await ensureInitialized();
    return app(req, res);
  } catch (error: any) {
    console.error('API initialization error on Vercel:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Server initialization failed'
    });
  }
}