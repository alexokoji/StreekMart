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
      // libsql + the Prisma adapter ship native .node binaries and dynamic
      // requires that Webpack can't trace. Keep them out of the bundle so
      // Next.js loads them via require() at runtime on the server.
      "@prisma/adapter-libsql",
      "@libsql/client",
      "libsql",
    ],
    // (Removed `outputFileTracingIncludes` — it was triggering a Prisma
    // adapter init crash at build-time page-data collection. The Dockerfile
    // now copies @libsql + libsql + adapter-libsql into the runner stage
    // explicitly; that's what actually ships the native binary.)
  },
};

module.exports = nextConfig;
