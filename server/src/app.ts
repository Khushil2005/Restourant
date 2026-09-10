import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { apiRouter } from './routes';
import { systemStatusGuard } from './middleware/systemStatusMiddleware';
import { errorHandler } from './middleware/errorHandler';
import { expressCorsOptions } from './config/cors';

export const app = express();

// Enable high-speed GZIP/deflate response compression
app.use(compression({
  threshold: 1024, // Only compress responses > 1KB
  level: 6
}));

// Middlewares
app.use(cors(expressCorsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads folder
const uploadsDir = path.resolve(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadsDir));

// System Status Guard (Maintenance & Emergency Lockdown enforcement)
app.use(systemStatusGuard);

// Master API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Enterprise Restaurant Management ERP Server',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use(errorHandler);
