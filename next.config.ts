import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'antd/lib': 'antd/es',
      'antd': 'antd/es',
    };
    return config;
  },
  experimental: {
    esmExternals: false,
  },
};

export default nextConfig;
