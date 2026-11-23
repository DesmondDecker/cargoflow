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

  // Number of reverse proxies (nginx, a load balancer, Railway/Render...) in
  // front of this server. Leave 0 when the API is reached directly. When it
  // sits behind one proxy set 1; otherwise every client appears to come from
  // the proxy's address and the login rate limit is shared by everyone.
  trustProxy: Math.max(0, parseInt(process.env.TRUST_PROXY || '0', 10) || 0),

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

// Placeholder, short or shared signing secrets in production would let anyone
// who has read the example file forge a login token, so the server refuses to
// start with them instead of warning and carrying on.
export function weakSecretProblem(access: string, refresh: string): string | null {
  const weak = (v: string) => v.startsWith('dev-insecure') || v.startsWith('change-me') || v.length < 32;
  if (weak(access)) return 'ACCESS_TOKEN_SECRET is a placeholder or shorter than 32 characters';
  if (weak(refresh)) return 'REFRESH_TOKEN_SECRET is a placeholder or shorter than 32 characters';
  if (access === refresh) return 'ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different';
  return null;
}

if (env.isProd) {
  const problem = weakSecretProblem(env.accessTokenSecret, env.refreshTokenSecret);
  if (problem) throw new Error(`Refusing to start in production: ${problem}. Generate each with: openssl rand -hex 32`);
}

// A wildcard origin in production lets any website call the API from a
// visitor's browser, so production must name the web addresses it serves.
export function corsProblem(origin: string): string | null {
  const list = origin.split(',').map((o) => o.trim()).filter(Boolean);
  if (list.length === 0 || list.includes('*')) return 'CORS_ORIGIN is not set or is "*"';
  return null;
}

if (env.isProd) {
  const problem = corsProblem(env.corsOrigin);
  if (problem) throw new Error(`Refusing to start in production: ${problem}. List the admin and portal web addresses, comma-separated.`);
}
