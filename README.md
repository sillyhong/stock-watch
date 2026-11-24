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

## Eastmoney board stocks

拉取东方财富指定板块的全部股票，并写入 `src/pages/data/astock/<fileName>.ts`。CPO 概念的板块编号为 `BK1128`，可以直接使用别名：

```bash
curl 'http://localhost:3008/stock/api/eastmoney/board-stocks?board=cpo'
```

此请求更新 `src/pages/data/astock/cpo.ts`，保留 `export const a_cpo = [...]`，每行使用东方财富返回的 `市场编号.股票代码` 和股票名称注释。无需浏览器或手动复制 Cookie。

其他板块传入 `bkCode`（官网行情页 URL 中的 `BKxxxx`）和不含扩展名的 `fileName`，例如：

```bash
curl 'http://localhost:3008/stock/api/eastmoney/board-stocks?bkCode=BK0546&fileName=boliboxian'
```

`exportName` 可选，默认为 `a_<fileName>`。原 `/stock/api/easymony/board-stocks` 地址也可继续使用。接口返回写入路径、数量和代码数组；逐页获取、检查完整性后原子替换文件，请求失败或数据为空时保留原文件。

访问 `/stock/boards` 可按名称或 BK 代码搜索地域、行业和概念板块，行业支持东方财富一级、二级和三级行业筛选。板块列表接口 `/stock/api/eastmoney/boards` 按页获取并缓存 15 分钟。页面浏览使用 `preview=true`，不会写入文件；点击保存并确认后才更新股票列表。

生产环境中，被 Next.js 构建打包的股票列表需要在更新文件后重新构建并重启服务，才会使用新列表。

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

## 部署到生产服务器

执行 `npm run deploy` 会连接生产服务器，确认本地和服务器分支一致、本地提交已推送、服务器没有未提交的已跟踪文件，然后依次执行 `git pull --ff-only`、`npm ci --include=dev`、`npm run build` 和 `pm2 restart stock-watch`，最后检查 `http://127.0.0.1:3008/stock/`。本地未提交及未跟踪文件不会部署。构建前会备份原构建产物；构建失败、缺少 `BUILD_ID` 或健康检查失败时恢复产物，必要时重启旧服务。Git 代码和依赖不会自动回滚。

默认服务器为 `root@43.156.33.21`，项目目录为 `/root/project/stock-watch`，SSH 密钥为 `~/ssh/mac.pem`。可通过 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_REMOTE_DIR` 和 `DEPLOY_KEY_PATH` 修改连接参数。脚本使用已有的 SSH `known_hosts` 校验服务器，并临时复制密钥以满足 OpenSSH 的文件权限要求。

服务器缺少 `config/.env.production.local` 时，脚本会从本地同路径复制该文件并设置为仅所有者可读写；已有文件不会覆盖。请先填写生产数据库配置，相关说明见 [平台配置](database/README-platform-config.md)。部署只更新 Git 跟踪的代码，保留服务器的 `config/`、Baogao 每日调用计数及 Reuters 数据文件；不会清除共享 Nginx 缓存。

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
