# 运单全流程管理系统 V3

V3 是独立部署、独立数据库的运单全生命周期管理系统。它通过 HTTP API 与 V2 录单系统对接，不直接连接或读写 V2 数据库。

## 技术栈

- Next.js App Router + TypeScript
- Drizzle ORM
- Neon PostgreSQL
- Tailwind CSS
- DeepSeek 可选建议能力

## 环境变量

```env
DATABASE_URL=
DATABASE_URL_UNPOOLED=
V2_API_BASE_URL=https://universal-import-v2-phi.vercel.app
V2_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek/deepseek-v4-flash
```

V2 项目需配置：

```env
V2_INTEGRATION_API_KEY=
```

`V2_API_KEY` 与 `V2_INTEGRATION_API_KEY` 必须完全相同。

## 本地运行

```bash
npm install
npm run db:generate
npm run db:push
npm run seed
npm run dev
```

## 关键能力

- 手工物流异常上报，实时调用 V2 校验运单。
- 扫描品控，实时调用 V2 校验 SKU 归属。
- 品控规则与审批规则可配置。
- 工单状态机与扫描批次状态分离。
- 一级/二级审批、拒绝重提、超时流转、快速放行。
- 库存、赔付、审批记录可追溯到工单和审批记录。
- 接口同步日志记录 Request ID、状态码、耗时和错误信息。
- V2 不可用时允许展示本地快照并标注缓存来源。

## 演示角色

种子脚本会创建：

- 仓库操作员
- 一级审批人
- 二级审批人
- 品控主管
- 管理员

当前演示版通过请求体传 `actorId` 或默认用户模拟角色，后续可接入正式登录系统。
