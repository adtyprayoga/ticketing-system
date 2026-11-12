import type { NextConfig } from 'next';

const webOrigin = process.env.WEB_ORIGIN;

const nextConfig: NextConfig = {
  // Dev mode serves its scripts to localhost only; WEB_ORIGIN may be a tunnel (https://<tunnel>).
  allowedDevOrigins: webOrigin ? [new URL(webOrigin).hostname] : [],
  // e2e runs its own dev server next to yours, so it needs its own build folder.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
