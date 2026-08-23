import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const defaultAtlasUri = 'mongodb+srv://khirsariyakhushil111_db_user:Khushil_123@cluster0.yiwgvoh.mongodb.net/restaurant_erp?retryWrites=true&w=majority';
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || defaultAtlasUri;

  try {
    const sanitizedUri = uri.replace(/:([^:@]+)@/, ':****@');
    logger.info(`Attempting connection to MongoDB at: ${sanitizedUri}`);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    logger.info('Successfully connected to MongoDB Server.');
    return mongoose;
  } catch (err: any) {
    logger.error('Failed to connect to MongoDB Atlas:', err.message);
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export { mongoose };