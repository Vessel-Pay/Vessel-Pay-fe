import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },

  allowedDevOrigins: ["vessel.vercel.app", "unwesternized-vonnie-nontangibly.ngrok-free.dev"],
};

export default nextConfig;
