import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

let mongoMemoryServerInstance: any = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const defaultAtlasUri = 'mongodb+srv://khirsariyakhushil111_db_user:Khushil_123@cluster0.yiwgvoh.mongodb.net/restaurant_erp?retryWrites=true&w=majority';
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || defaultAtlasUri;

  try {
    // Attempt connecting to configured MongoDB (local or Atlas)
    const sanitizedUri = uri.replace(/:([^:@]+)@/, ':****@');
    logger.info(`Attempting connection to MongoDB at: ${sanitizedUri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('Successfully connected to MongoDB Server.');
    return mongoose;
  } catch (err: any) {
    logger.warn(`Could not connect to external MongoDB (${err.message}). Starting embedded high-performance MongoDB instance...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongoMemoryServerInstance = await MongoMemoryServer.create();
      const memUri = mongoMemoryServerInstance.getUri();
      logger.info(`Embedded MongoDB Server started at: ${memUri}`);
      await mongoose.connect(memUri);
      logger.info('Connected to Embedded MongoDB successfully.');
      return mongoose;
    } catch (memErr: any) {
      logger.error('Failed to initialize embedded MongoDB engine:', memErr);
      throw memErr;
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServerInstance) {
    await mongoMemoryServerInstance.stop();
  }
}

export { mongoose };
