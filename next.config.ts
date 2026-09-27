import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  basePath: "/omegus",
  assetPrefix: "/omegus",
};

export default nextConfig;

initOpenNextCloudflareForDev();
