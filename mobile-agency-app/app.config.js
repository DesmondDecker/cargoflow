const os = require('os');
const appJson = require('./app.json');

function detectLocalIp() {
  const interfaces = os.networkInterfaces();
  const orderedNames = Object.keys(interfaces).sort((a, b) => {
    const rank = (name) => {
      const lower = name.toLowerCase();
      if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('ethernet') || lower.includes('lan')) return 0;
      if (lower.includes('virtualbox')) return 2;
      if (lower.includes('loopback')) return 3;
      return 1;
    };
    return rank(a) - rank(b);
  });

  const candidates = [];
  for (const name of orderedNames) {
    for (const address of interfaces[name] || []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (address.address.startsWith('169.254.')) continue;
      candidates.push(address.address);
    }
  }

  const preferredCandidates = candidates.filter((ip) => !ip.startsWith('192.168.56.'));
  return (
    preferredCandidates.find((ip) => ip.startsWith('192.168.')) ||
    preferredCandidates.find((ip) => ip.startsWith('10.')) ||
    preferredCandidates.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) ||
    candidates.find((ip) => ip.startsWith('192.168.')) ||
    candidates.find((ip) => ip.startsWith('10.')) ||
    candidates.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) ||
    candidates[0] ||
    '10.0.2.2'
  );
}

function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) return envUrl;

  const configuredUrl = appJson.expo.extra.apiBaseUrl;
  const isLocalHostFallback = !configuredUrl || configuredUrl === 'http://localhost:4000/api/v1' || configuredUrl.includes('cargoflow.example.com');
  if (configuredUrl && !isLocalHostFallback) {
    return configuredUrl;
  }

  const localIp = detectLocalIp();
  return `http://${localIp}:4000/api/v1`;
}

module.exports = ({ config } = {}) => {
  const resolvedConfig = config || {};
  const apiBaseUrl = getApiBaseUrl();

  if (appJson.expo.extra.apiBaseUrl?.includes('cargoflow.example.com')) {
    // Loud, impossible-to-miss warning in the terminal/build log rather than a
    // silent placeholder that only surfaces as a confusing in-app error later.
    // eslint-disable-next-line no-console
    console.warn(
      '\n[CargoFlow] WARNING: apiBaseUrl is still the placeholder ' +
        '(https://api.cargoflow.example.com/api/v1). Falling back to the local LAN IP instead.\n'
    );
  }

  return {
    ...appJson.expo,
    ...resolvedConfig,
    extra: {
      ...appJson.expo.extra,
      ...resolvedConfig.extra,
      apiBaseUrl,
    },
  };
};
