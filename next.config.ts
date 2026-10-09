import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["ts", "tsx"],
  env: {
    MYSQL_HOST:'43.156.33.21',
    MYSQL_PORT: '3306',
    MYSQL_DATABASE: 'stock',
    MYSQL_USER: 'root',
    MYSQL_PASSWORD: 'Asd123456!',
  },
  transpilePackages: [
    'antd', 
    '@ant-design/plots', 
    '@ant-design/icons', 
    '@ant-design/icons-svg',
    '@ant-design/colors',
  ],
  serverExternalPackages: ['playwright-core', 'node-cron'],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'antd/lib': 'antd/es',
      'antd': 'antd/es',
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
  },
};

export default nextConfig;
