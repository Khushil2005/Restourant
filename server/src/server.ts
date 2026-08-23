import http from 'http';
import dotenv from 'dotenv';
import { app } from './app';
import { connectDatabase } from './config/database';
import { initSocketIO } from './sockets/socketManager';
import { runDatabaseMigrationsAndSeeds } from './database/seedRunner';
import { logger } from './utils/logger';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function bootstrapServer() {
  try {
    // 1. Connect MongoDB
    await connectDatabase();

    // 2. Initialize Seed Data & Permissions
    await runDatabaseMigrationsAndSeeds();

    // 3. Create HTTP & Socket.IO server
    const httpServer = http.createServer(app);
    initSocketIO(httpServer);

    httpServer.listen(PORT, () => {
      logger.info(`========================================================`);
      logger.info(`  Enterprise Restaurant Management ERP Server Started  `);
      logger.info(`  Listening on Port: http://localhost:${PORT}             `);
      logger.info(`  Real-time Socket.IO: Initialized                     `);
      logger.info(`  Database: MongoDB Connected & Seeded                 `);
      logger.info(`========================================================`);
    });
  } catch (err: any) {
    logger.error('Fatal: Server bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrapServer();
