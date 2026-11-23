import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import apiRoutes from './routes/index';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

  app.use(helmet());
  // credentials: the admin dashboard's refresh cookie. Production refuses CORS_ORIGIN='*', so a cookie is never offered to an arbitrary site.
  app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean), credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));

  // Every route this server exposes lives under /api/v1 — matches the
  // apiBaseUrl every client (mobile, admin, driver) is configured with
  // (".../api/v1"), so nothing needs its own base-path override.
  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
