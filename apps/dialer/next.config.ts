import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  experimental: {
    optimizePackageImports: ["@twilio/voice-sdk", "@google/generative-ai"],
  },
};

export default nextConfig;
