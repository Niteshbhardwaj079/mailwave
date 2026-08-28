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

  // Tracking PUBLIC hai — ise recipient ka mail app kholta hai, isliye yahan
  // requireAuth nahi lagta. Aur /api ke bahar hai taki link chhota rahe.
  app.use('/t', trackRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
