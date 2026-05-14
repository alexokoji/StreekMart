/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `standalone` produces a self-contained server bundle in
  // .next/standalone/server.js — half the size of a regular build's
  // node_modules, which keeps the Fly Docker image small and cold-starts fast.
  // Has no effect on `npm run dev`.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // Don't try to bundle the Anthropic SDK or Prisma client into webpack
    // vendor chunks — they're Node-side libraries with native bindings and
    // dynamic requires. Bundling them into ./vendor-chunks/* on Windows
    // causes "Cannot find module './vendor-chunks/@anthropic-ai.js'" runtime
    // errors when the rename step races with antivirus / OneDrive sync.
    serverComponentsExternalPackages: [
      "@anthropic-ai/sdk",
      "@prisma/client",
      "bcryptjs",
    ],
  },
};

module.exports = nextConfig;
