import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const configuredUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!configuredUri) {
    logger.error('No MONGO_URI configured in server/.env. A live MongoDB URI is required.');
    throw new Error('No MONGO_URI configured in server/.env. Please set a valid live MongoDB URI.');
  }

  try {
    const sanitizedUri = configuredUri.replace(/:([^:@]+)@/, ':****@');
    logger.info(`Attempting connection to live MongoDB at: ${sanitizedUri}`);

    await mongoose.connect(configuredUri, {
      serverSelectionTimeoutMS: 8000,
    });

    logger.info('Successfully connected to live MongoDB Server.');
    return mongoose;
  } catch (err: any) {
    logger.error(`Could not connect to live MongoDB: ${err.message}`);
    throw new Error(`MongoDB connection failed (${err.message}). Verify live MONGO_URI in server/.env`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully.');
  } catch (err: any) {
    logger.warn(`Error disconnecting MongoDB: ${err.message}`);
  }
}

export { mongoose };