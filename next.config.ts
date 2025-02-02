import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
const port = 3008;

nextConfig.devServer = {
  port: port,
};
