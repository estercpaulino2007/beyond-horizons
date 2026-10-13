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
};

export default nextConfig;
