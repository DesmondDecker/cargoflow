import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/cargoflow'),

  accessTokenSecret: required('ACCESS_TOKEN_SECRET', 'dev-insecure-access-secret'),
  refreshTokenSecret: required('REFRESH_TOKEN_SECRET', 'dev-insecure-refresh-secret'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10),

  corsOrigin: process.env.CORS_ORIGIN || '*',

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
    get configured() {
      return !!(this.accountId && this.accessKeyId && this.secretAccessKey && this.bucket);
    },
  },

  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'Platform Admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@cargoflow.local',
    password: process.env.SEED_ADMIN_PASSWORD || '',
  },
};

if (env.isProd && (env.accessTokenSecret.startsWith('dev-insecure') || env.refreshTokenSecret.startsWith('dev-insecure'))) {
  // eslint-disable-next-line no-console
  console.warn('[SECURITY WARNING] Running in production with default JWT secrets. Set ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET.');
}
