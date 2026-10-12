import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone with a minimal server.js, used by the Docker image.
  output: "standalone",
};

export default nextConfig;
