// EXPO_PUBLIC_API_BASE_URL overrides the placeholder localhost address in
// app.json, e.g.  EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 npx expo start
const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || appJson.expo.extra.apiBaseUrl,
  },
});
