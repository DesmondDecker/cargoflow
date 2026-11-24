const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!apiBaseUrl) {
  console.error('Set EXPO_PUBLIC_API_BASE_URL to the deployed API URL before building the PWA.');
  process.exit(1);
}

let apiUrl;
try {
  apiUrl = new URL(apiBaseUrl);
} catch {
  console.error('EXPO_PUBLIC_API_BASE_URL must be an absolute URL.');
  process.exit(1);
}

const isLoopback = apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1';
if (apiUrl.protocol !== 'https:' && !(apiUrl.protocol === 'http:' && isLoopback)) {
  console.error('PWA builds require an HTTPS API URL; only localhost HTTP is allowed for local tests.');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('Could not start the Expo web export.', result.error);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const serviceWorkerPath = path.join(__dirname, '..', 'dist', 'sw.js');
try {
  const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
  if (!serviceWorker.includes('__BUILD_ID__')) {
    throw new Error('The service worker build identifier placeholder is missing.');
  }
  const buildId = (process.env.RENDER_GIT_COMMIT || `local-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
  fs.writeFileSync(serviceWorkerPath, serviceWorker.replaceAll('__BUILD_ID__', buildId));
} catch (error) {
  console.error('Could not prepare versioned PWA service-worker caches.', error);
  process.exit(1);
}
