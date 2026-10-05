// MaaNote Stage 14.1 PROD runtime configuration.
// Google Drive automatic backup is enabled for the personal app.
// Admin authentication stays OFF until Cloudflare Worker/API is configured.
window.MAANOTE_CONFIG = Object.freeze({
  ENV: "production",
  API_BASE: "",
  GOOGLE_CLIENT_ID: "983518832862-81o2lp171kb77plp4j9melibnh23pm5q.apps.googleusercontent.com",
  ADMIN_AUTH_ENABLED: false,
  DRIVE_SYNC_ENABLED: true
});
