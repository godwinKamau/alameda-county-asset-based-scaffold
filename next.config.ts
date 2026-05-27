import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "sharp", "@napi-rs/canvas"],
  experimental: {
    // Clerk middleware runs on /api/*; default 10MB truncates large PDF/image uploads.
    middlewareClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
