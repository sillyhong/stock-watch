This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Node.js version

项目声明并锁定 Node.js `16.18.0`：

```bash
nvm install 16.18.0
nvm use 16.18.0
node --version
```

`package.json` 通过 `engines.node` 锁定运行时版本。项目依赖已经按 Node.js `16.18.0` 调整：Next.js 13、React 18、ESLint 8 和 Playwright 1.40。

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Eastmoney browser session

主涨段接口会在服务端启动真实 Chrome/Chromium，访问东方财富页面和 K 线接口，读取浏览器上下文生成 Cookie，再用同一 User-Agent 请求数据。不需要把本机 Chrome 的 Cookie 复制到服务器，也不建议继续写死 Cookie。

服务器需要安装 Chrome/Chromium，并设置可执行文件路径：

```bash
which google-chrome || which chromium
export EASTMONEY_BROWSER_PATH=/usr/bin/google-chrome
 npm ci
npm run build
npm start
```

如果浏览器路径不是 `/usr/bin/google-chrome`，按 `which` 的实际结果设置 `EASTMONEY_BROWSER_PATH`。`playwright-core` 只负责控制已有浏览器，不会自动下载浏览器。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## System log cleanup

Node 服务启动时注册系统日志清理任务。任务默认在上海时区每月最后一天 03:00 执行，截断 `/var/log/secure` 和 `/var/log/cron`，保留文件 inode，避免日志进程失去文件句柄。

运行服务的用户需要具备这两个文件的写权限（通常需要 root）。如需关闭任务，设置：

```bash
export SYSTEM_LOG_CLEANUP_ENABLED=false
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
