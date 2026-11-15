// Address of the Beyond Horizons API.
// - Inside the Next.js app (Vercel, or localhost:3000): "/bh-api", the same-site rewrite in next.config.ts.
// - On this repository's GitHub Pages copy (estercpaulino2007.github.io/beyond-horizons/): the Vercel app's
//   /bh-api proxy. Render's CORS_ORIGINS must include https://estercpaulino2007.github.io for it to be live.
// If the API can't be reached, the HUD uses data/snapshot.json (real API outputs, deterministic seed).
window.BH_CONFIG = {
  apiBase: location.hostname.endsWith("github.io") ? "https://beyond-horizons-ruddy.vercel.app/bh-api" : "/bh-api",
};
