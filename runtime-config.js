// MaaNote Stage 14 PROD runtime configuration.
// Production storage is isolated from /maanote-test/.
// Google/Cloudflare features remain OFF until credentials are configured.
window.MAANOTE_CONFIG = Object.freeze({
  ENV: "production",
  API_BASE: "",
  GOOGLE_CLIENT_ID: "",
  ADMIN_AUTH_ENABLED: false,
  DRIVE_SYNC_ENABLED: false
});
