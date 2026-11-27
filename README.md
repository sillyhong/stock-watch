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

`exportName` 可选，默认为 `a_<fileName>`。原 `/stock/api/easymony/board-stocks` 地址也可继续使用。接口返回写入路径、数量和代码数组；逐页获取、检查完整性后原子替换文件，请求失败或数据为空时保留原文件。保存文件同时记录 BK 编码，并从东方财富板块行情页核实板块名称；名称暂时获取失败时不阻止股票保存，不会使用猜测名称覆盖原有名称。

访问 `/stock/boards` 可按名称或 BK 代码搜索地域、行业和概念板块，行业支持东方财富一级、二级和三级行业筛选。板块列表接口 `/stock/api/eastmoney/boards` 按页获取并缓存 15 分钟。页面浏览使用 `preview=true`，不会写入文件；点击保存并确认后才更新股票列表。

## 配置池

访问 `/stock/stock-pools`，可为各市场的 RSI、主涨段及回测任务分别选择股票分类。配置保存在 MySQL 的 `task_stock_pools` 表中，每个任务一行，`market` 区分 `A`、`HK`、`US`，`sources` 存储所选分类。数据库连接使用 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`，账号需要建表、修改表和读写权限。股票池配置不受 `ENABLE_DATABASE_STORAGE` 开关控制，数据库不可用时相关任务会报错，不会静默使用旧列表。

配置保存后，下一次任务执行时读取所选文件并按股票代码去重，无需重新构建或重启。独立分类文件位于 `src/pages/data/stock-pools/A`、`HK`、`US`；新增文件以 `export const label = "名称"; export const stocks = ["116.00981"];` 格式导出，文件名使用字母、数字、下划线或连字符。保存到 `src/pages/data/astock` 的东方财富板块文件也可选择。新分类只出现在对应市场的选择列表，不会自动加入任务。部署或 Git 操作应注意保留服务器上动态生成和修改的文件。

A 股旧股票按 2026-11-26 东方财富个股行情页的所属行业和 BK 编码拆分；这些分类只包含旧文件中的部分股票，不代表完整板块成分股。股票可能属于多个概念，所属行业并不等于其全部概念板块。无法核实的代码、港美股旧股票及缺少板块来源的历史文件保留并标记待核实；历史半导体、MLCC 文件仅按文件名提示候选官方板块，文件成分和关联均需核实。分类为一次核对快照，行业及成分可能变化。原股票代码和市场前缀不会自动更正。

旧表在首次读取时增加 `market` 字段并逐任务迁移，旧自选分类仅在拆分前后股票集合完全一致时迁移；如果服务器上的旧分类被单独修改，则保留原分类并标记待核实。如果旧合并列表与原分类本身不一致，配置会保持原样并报错，需先合并这些差异。请先备份数据库及服务器上的股票文件，首次迁移完成前不要修改拆分分类；版本号会随迁移递增以避免覆盖并发修改。

全市场日线接口仍从原有市场 JSON 文件读取全市场股票，并排除当前 A 股日线任务股票池中已监控的股票；它不单独配置股票池。

## 富途行情兜底

东方财富单只股票请求失败或返回无效数据时，默认尝试富途网页行情。系统先通过富途网页搜索接口根据股票代码查询内部 ID，严格匹配代码和市场；搜索不可用时尝试解析股票页面，再对实时行情请求参数签名，无需配置 OAuth 或复制 Cookie。搜索返回限流或认证错误时停止继续请求。主涨段东方财富熔断后会尝试富途，不再继续请求东方财富。可通过环境变量关闭：

```bash
FUTU_FALLBACK_ENABLED=false
```

保存东方财富板块文件后，服务器在后台生成与其一一对应的映射文件，例如 `src/pages/data/astock/cpo.ts` 对应 `src/pages/data/futu-mappings/astock/cpo.json`。独立分类按市场分目录，例如 `stock-pools/HK/bandaoti.ts` 对应 `futu-mappings/HK/bandaoti.json`。文件只保存股票身份映射，不保存 Cookie 或请求签名；板块文件或分类加入任务时会后台补齐缺失的映射，已有 ID 不会按时间过期或定期重新查询。股票移出板块时，其旧映射保留在该文件的 `archivedStocks` 中；兜底时找到新映射也会补充到包含该股票的板块文件中。若同一股票出现多个有效但不同的 ID，系统会报错并保留原文件，需人工核对。旧的平铺映射及之前生成的 `auto` 文件只兼容读取，不会再向 `auto` 写入新映射。

板块页面显示进度；也可通过 `/stock/api/eastmoney/futu-mapping?fileName=<文件名>` 查询。映射保存或生成失败不会影响东方财富股票池，后台任务在当前服务进程运行，进程重启可能中断，重新保存股票池可重新生成。映射文件不加入 Git。

网页接口为非公开接口，可能因地域、访问频率、权限或接口变更失败；部分股票的分钟线会因全量历史过大返回 504，美股分钟线可能返回业务错误。5 分钟真实 K 线失败时不会用分时价格伪造数据。不同数据源的复权、成交量、时间口径可能不同，应在生产环境对目标市场逐项核对；目前仅 A 股成交量已按 100 股/手转换，其他市场保持富途原始成交量。周/月线使用富途日线查找周期内最后交易日以对齐东方财富；历史查询不会使用截至日期后才完成的周期。富途网页模式不支持指定不复权或后复权。

如需改用官方 API，可按照 [富途 OAuth 授权指南](https://open.futunn.com/api/overview/getting-started) 获取具备 `quote:read` 权限的客户端 ID 和刷新令牌，并在仅服务账号可读的环境配置文件中设置 `FUTU_QUOTE_PROVIDER=openapi`、`FUTU_CLIENT_ID`、`FUTU_REFRESH_TOKEN`。官方 API 可能受权限与历史标的配额限制；刷新令牌过期后需要重新授权。

**待处理：** 富途 OAuth 授权和实际行情联调暂缓。网页行情中部分股票分钟线仍可能返回 504 或业务错误，不能保证兜底成功；这不影响股票池文件和任务配置的保存。

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

执行 `npm run deploy` 会确认本地提交已推送、服务器分支一致且没有未提交的已跟踪文件，然后在临时目录中检出该提交，使用与服务器完全一致的 Node.js 版本安装依赖并在本地构建。脚本将产物上传服务器；仅当依赖锁文件变更或服务器依赖缺失时，才在服务器的独立暂存目录安装依赖。准备完成后拉取代码、切换产物并执行 `pm2 restart stock-watch`，最后检查 `http://127.0.0.1:3008/stock/`。本地未提交及未跟踪文件不会进入构建。

本地需安装与服务器相同版本的 Node.js 和 npm。脚本默认查找当前 Node 或 `~/.nvm/versions/node/`，也可通过 `DEPLOY_NODE_PATH` 指定 Node 可执行文件。服务器使用部署锁阻止并发部署；中断后若锁未释放，应先确认没有部署进行中再清理 `.deploy-lock`。切换或健康检查失败时尝试恢复原代码、依赖和构建产物；失败暂存目录会保留供排查。需要更新服务器依赖时，部署前要求至少 1 GiB 空间。

默认服务器为 `root@43.156.33.21`，项目目录为 `/root/project/stock-watch`，SSH 密钥为 `~/ssh/mac.pem`。可通过 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_REMOTE_DIR` 和 `DEPLOY_KEY_PATH` 修改连接参数。脚本使用已有的 SSH `known_hosts` 校验服务器，并临时复制密钥以满足 OpenSSH 的文件权限要求。

服务器缺少 `config/.env.production.local` 时，脚本会从本地同路径复制该文件并设置为仅所有者可读写；已有文件不会覆盖。请先填写生产数据库配置，相关说明见 [平台配置](database/README-platform-config.md)。部署只更新 Git 跟踪的代码，保留服务器的 `config/`、Baogao 每日调用计数及 Reuters 数据文件；不会清除共享 Nginx 缓存。

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
