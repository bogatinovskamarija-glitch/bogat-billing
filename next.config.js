/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Render's free tier gives the build container 0.1 vCPU. Next's default
  // production build spawns parallel worker threads sized to the detected
  // core count, which on a host this constrained produces racy, spurious
  // "Module not found" errors for files that demonstrably exist on disk
  // (confirmed directly against this Render service — see commit history).
  // Capping to 1 worker removes that race entirely.
  experimental: { cpus: 1, workerThreads: false },
  webpack: (config) => {
    config.bail = false;
    return config;
  },
  // This app doesn't use next/image, and the built-in /_next/image route has
  // an unauthenticated RCE advisory (GHSA-2xp9-vwfh-vxw4) affecting all
  // Next.js 14.x. Disabling optimization removes that code path entirely
  // rather than leaving an unused, vulnerable route exposed.
  images: { unoptimized: true },
};

module.exports = nextConfig;
