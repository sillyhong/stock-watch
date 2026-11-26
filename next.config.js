const { loadPlatformEnvironment } = require('./src/services/lib/loadPlatformEnvironment');

loadPlatformEnvironment(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["api.ts", "tsx"],
  basePath: "/stock",
  env: {
    NEXT_PUBLIC_BASE_PATH: "/stock",
  },
  transpilePackages: [
    "antd",
    "@ant-design/icons",
    "@ant-design/icons-svg",
    "@ant-design/colors",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({ typescript: "commonjs typescript" });
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      "antd/lib": "antd/es",
      antd: "antd/es",
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        dns: false,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
  experimental: {
    esmExternals: false,
    instrumentationHook: true,
    serverComponentsExternalPackages: ["playwright-core", "node-cron"],
  },
};

module.exports = nextConfig;
