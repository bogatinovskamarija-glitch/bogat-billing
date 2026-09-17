/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app doesn't use next/image, and the built-in /_next/image route has
  // an unauthenticated RCE advisory (GHSA-2xp9-vwfh-vxw4) affecting all
  // Next.js 14.x. Disabling optimization removes that code path entirely
  // rather than leaving an unused, vulnerable route exposed.
  images: { unoptimized: true },
};

module.exports = nextConfig;
