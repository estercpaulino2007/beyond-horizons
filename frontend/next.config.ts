import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces .next/standalone with a minimal server.js, used by
  // the Docker image. Vercel has its own equivalent and doesn't need this --
  // worse, this combination is a known cause of the compiled CSS (and other
  // /_next/static assets) failing to serve correctly on Vercel, which shows
  // up as a build that succeeds but a live page with zero styling applied. 
  // Vercel sets the VERCEL env var at both build and runtime, so this keeps
  // standalone output for the Docker build while skipping it on Vercel.
  output: process.env.VERCEL ? undefined : "standalone",
  // The 3D Health HUD (public/hud3d/) calls the API through /bh-api on this
  // same domain, so no extra CORS origin is needed and it shares this site's
  // localStorage (vitals history) with the rest of the app.
  // The site opens straight on the 3D Health HUD; the earlier pages stay at
  // their own addresses (/simulation, /vitals, /genetics, ...).
  async redirects() {
    return [{ source: "/", destination: "/hud3d/index.html", permanent: false }];
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    return [{ source: "/bh-api/:path*", destination: `${api.replace(/\/+$/, "")}/:path*` }];
  },
};

export default nextConfig;
