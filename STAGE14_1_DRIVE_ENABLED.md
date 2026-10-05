# MaaNote v0.9 Stage 14.1 PROD

Google OAuth Web Client ID has been configured for the production app.

- Google Drive automatic backup: ENABLED
- Admin Google authentication: DISABLED
- Cloudflare API: not configured yet

Client ID:
983518832862-81o2lp171kb77plp4j9melibnh23pm5g.apps.googleusercontent.com

Important:
The OAuth client secret is NOT used by MaaNote's browser code and is not included in this ZIP.
Do not place the client secret in runtime-config.js, app.js, GitHub, or any public frontend file.

After deployment:
1. Open https://2008e22-eng.github.io/maanote/
2. Choose personal management
3. Choose Google Drive automatic backup
4. Sign in with a Google account registered as an OAuth test user
5. Confirm the first backup completes
