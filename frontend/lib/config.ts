/**
 * Public runtime configuration.
 * NEXT_PUBLIC_* values are inlined at build time (see frontend/Dockerfile).
 */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
