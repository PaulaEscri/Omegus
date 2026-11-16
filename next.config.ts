import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  basePath: isProd ? "/omegus" : "",
  assetPrefix: isProd ? "/omegus" : "",
};

export default nextConfig;

initOpenNextCloudflareForDev();
