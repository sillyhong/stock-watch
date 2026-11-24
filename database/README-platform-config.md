# 平台配置

`platform_config` 可保存不同平台的配置项，以 `platform` 和 `config_key` 唯一标识。包含创建、更新和软删除时间；更新软删除的配置会恢复该记录。配置值可能包含凭据，应限制数据库访问权限。

## 数据库环境

数据库配置保存在项目根目录 `config/` 下：开发环境读取 `.env.development.local`，生产环境读取 `.env.production.local`。填写对应 MySQL 数据库信息；`config/` 整个目录不会提交到 Git，需要在各部署环境单独配置。项目启动时按 `NODE_ENV` 选择配置文件，已有进程环境变量优先。修改数据库连接后重启服务。

所需键为 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER` 和 `MYSQL_PASSWORD`。可参考 `config/` 中对应的 `.example` 文件，或在新环境自行创建上述环境文件；含 `#` 的值请使用引号包裹。

在本地和生产的目标数据库分别执行 `database/platform_config.sql`，该脚本使用当前选中的数据库，不会创建数据库或覆盖已有表。创建表后再启用报告日报任务。

原有 Next.js 构建配置中写死的 MySQL 连接信息已移除。现有部署必须在环境文件或进程环境中配置 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER` 和 `MYSQL_PASSWORD`，否则将使用本机默认连接。

## 更新报告平台授权

报告日报读取平台 `baogao` 下键 `BAOGAO_AI_AUTHORIZATION` 的值，格式为 `Bearer <token>`。每次调用报告平台前读取当前数据库值；更新后无需重启服务。该机制不会自动获取或刷新令牌，令牌过期后需要从报告平台取得新值并更新。

通过 `PUT /stock/api/platform-config` 写入，JSON 请求体为 `{"platform":"baogao","key":"BAOGAO_AI_AUTHORIZATION","value":"Bearer <报告平台令牌>"}`。接口不在响应中返回配置值。也可以用同样的 `platform`、`key` 查询参数调用 `GET /stock/api/platform-config` 查看创建和更新时间；该接口只返回元数据。接口不校验管理令牌，能够访问该接口的客户端可以修改平台配置，部署时应通过网络访问控制限制调用范围。

报告查询之前若配置缺失，任务会直接失败且不会消耗报告平台调用额度。既有每天最多 7 次的调用限制继续生效。
