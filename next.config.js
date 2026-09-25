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
  // This app doesn't use next/image, and the built-in /_next/image route has
  // an unauthenticated RCE advisory (GHSA-2xp9-vwfh-vxw4) affecting all
  // Next.js 14.x. Disabling optimization removes that code path entirely
  // rather than leaving an unused, vulnerable route exposed.
  images: { unoptimized: true },
  // @react-pdf/renderer pulls in @react-pdf/hyphenate, an ESM-only package
  // whose subpath exports (e.g. "@react-pdf/hyphenate/en-us") only declare
  // an "import" condition, not "require". Turbopack — Next 16's new default
  // bundler for both dev and build — was observed failing to resolve that
  // subpath when the package gets bundled into a route (confirmed directly:
  // running the same render call outside Next's bundler throws
  // ERR_PACKAGE_PATH_NOT_EXPORTED on that exact path). Marking it external
  // leaves it to Node's own native module resolution at request time
  // instead of going through the bundler at all, which is the standard fix
  // for this class of ESM/exports-map incompatibility.
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/hyphenate"],
};

module.exports = nextConfig;
