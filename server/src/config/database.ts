import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const configuredUri =
    process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!configuredUri) {
    logger.error('MONGODB_URI is not configured.');
    throw new Error('MONGODB_URI environment variable is required.');
  }

  try {
    const sanitizedUri = configuredUri.replace(
      /:([^:@]+)@/,
      ':****@'
    );

    logger.info(
      `Attempting connection to configured MongoDB at: ${sanitizedUri}`
    );

    await mongoose.connect(configuredUri, {
      serverSelectionTimeoutMS: 10000,
    });

    logger.info(
      'Successfully connected to configured MongoDB Server.'
    );

    return mongoose;
  } catch (err: any) {
    logger.error(
      `MongoDB connection failed: ${err.message}`
    );

    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully.');
  } catch (err: any) {
    logger.warn(
      `Error disconnecting MongoDB: ${err.message}`
    );
  }
}

export { mongoose };