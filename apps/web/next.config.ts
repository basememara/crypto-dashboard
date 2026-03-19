import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/utils"],
};

export default nextConfig;
