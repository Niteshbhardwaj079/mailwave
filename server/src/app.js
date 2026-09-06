import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import templateRoutes from './routes/templates.js';
import campaignRoutes from './routes/campaigns.js';
import trackRoutes from './routes/track.js';
import fileRoutes from './routes/files.js';
import accountRoutes from './routes/accounts.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import statsRoutes from './routes/stats.js';
import activityRoutes from './routes/activity.js';
import subscriberRoutes from './routes/subscribers.js';
import systemEmailRoutes from './routes/systemEmails.js';
import segmentRoutes from './routes/segments.js';
import imageRoutes from './routes/images.js';
import backupRoutes from './routes/backup.js';
import settingsRoutes from './routes/settings.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy, trust it for req.ip so rate limiting and the
  // activity log record the real client address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The tracking pixel and click redirects are loaded by mail clients on
      // other origins; a strict CSP here would buy nothing and break those.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin, curl and mail clients send no Origin at all.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    })
  );

  // Templates are HTML documents, so the body limit has to be generous.
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // A global ceiling. Individual routes tighten this where it matters.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    })
  );

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'mailwave-api', env: env.nodeEnv, time: new Date().toISOString() });
  });

  // Har resource ka apna file. requireAuth yahan lagta hai, taki har route
  // file me dobara likhna na pade.
  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', requireAuth, contactRoutes);
  app.use('/api/templates', requireAuth, templateRoutes);
  app.use('/api/campaigns', requireAuth, campaignRoutes);
  app.use('/api/accounts', requireAuth, accountRoutes);
  app.use('/api/users', requireAuth, userRoutes);
  app.use('/api/roles', requireAuth, roleRoutes);
  app.use('/api/stats', requireAuth, statsRoutes);
  app.use('/api/activity', requireAuth, activityRoutes);
  app.use('/api/subscribers', requireAuth, subscriberRoutes);
  app.use('/api/system-emails', requireAuth, systemEmailRoutes);
  app.use('/api/segments', requireAuth, segmentRoutes);
  app.use('/api/images', requireAuth, imageRoutes);
  app.use('/api/settings', requireAuth, settingsRoutes);

  // Backup upload me poori file body me aati hai, JSON nahi — isliye express
  // ke JSON parser se pehle raw stream chahiye. Route khud stream padhta hai.
  app.use('/api/backups', requireAuth, backupRoutes);

  // Tracking PUBLIC hai — ise recipient ka mail app kholta hai, isliye yahan
  // requireAuth nahi lagta. Aur /api ke bahar hai taki link chhota rahe.
  app.use('/t', trackRoutes);

  // Email me lagi images. Yeh bhi PUBLIC hai — Gmail/Outlook ka server inhe
  // kholta hai aur wo kabhi login nahi kar sakta. Yahan se sirf image jati
  // hai, aur kuch nahi.
  app.use('/files', fileRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
