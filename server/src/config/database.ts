import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

dotenv.config();

let mongoMemoryServerInstance: any = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const configuredUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  // 1. Try configured external / Atlas URI if provided
  if (configuredUri) {
    try {
      const sanitizedUri = configuredUri.replace(/:([^:@]+)@/, ':****@');
      logger.info(`Attempting connection to configured MongoDB at: ${sanitizedUri}`);

      await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 4000,
      });

      logger.info('Successfully connected to configured MongoDB Server.');
      return mongoose;
    } catch (err: any) {
      logger.warn(`Could not connect to configured MongoDB (${err.message}). Trying fallbacks...`);
    }
  }

  // 2. Try local standard MongoDB service
  try {
    const localUri = 'mongodb://127.0.0.1:27017/restaurant_erp';
    logger.info(`Attempting connection to local MongoDB service at: ${localUri}`);

    await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 2000,
    });

    logger.info('Successfully connected to local MongoDB daemon.');
    return mongoose;
  } catch (localErr: any) {
    logger.warn(`Local MongoDB service not found. Launching zero-config embedded MongoDB engine...`);
  }

  // 3. Fallback to embedded MongoMemoryServer with local disk persistence
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const storageDir = path.resolve(__dirname, '../../../.mongo_data');

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    try {
      mongoMemoryServerInstance = await MongoMemoryServer.create({
        instance: {
          dbPath: storageDir,
          storageEngine: 'wiredTiger',
          dbName: 'restaurant_erp'
        }
      });
    } catch (persistErr: any) {
      logger.warn('Disk-backed storage initialization fell back to in-memory:', persistErr.message);
      mongoMemoryServerInstance = await MongoMemoryServer.create({
        instance: {
          dbName: 'restaurant_erp'
        }
      });
    }

    const memUri = mongoMemoryServerInstance.getUri();
    logger.info(`Embedded MongoDB Engine started successfully at: ${memUri}`);

    await mongoose.connect(memUri);
    logger.info('Connected to Embedded MongoDB database.');
    return mongoose;
  } catch (memErr: any) {
    logger.error('Failed to initialize embedded MongoDB engine:', memErr);
    throw memErr;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServerInstance) {
      await mongoMemoryServerInstance.stop();
      mongoMemoryServerInstance = null;
    }
    logger.info('MongoDB disconnected successfully.');
  } catch (err: any) {
    logger.warn(`Error disconnecting MongoDB: ${err.message}`);
  }
}

export { mongoose };