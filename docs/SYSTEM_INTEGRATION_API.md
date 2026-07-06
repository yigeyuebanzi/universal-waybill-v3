# V2/V3 系统间接口文档

## 鉴权

V3 调用 V2 时使用：

```http
x-api-key: <V2_API_KEY>
x-request-id: <uuid>
```

V2 校验 `x-api-key` 是否等于 `V2_INTEGRATION_API_KEY`。所有响应返回 `requestId`，V3 将调用结果写入 `integration_logs`。

## V2 接口

### 获取运单详情

```http
GET /api/v1/integration/orders/{externalCode}
```

用途：

- 手工异常上报前实时校验运单存在。
- V3 更新本地快照。

### 校验 SKU 归属

```http
POST /api/v1/integration/orders/validate-sku
```

请求：

```json
{
  "externalCode": "OUT-001",
  "skuCode": "SKU-001"
}
```

用途：

- 扫描录入时验证 SKU 确实属于该运单。

### 同步运单列表

```http
GET /api/v1/integration/orders?page=1&pageSize=50&updatedAfter=2026-07-01T00:00:00.000Z
```

V2 当前无 `updatedAt` 字段，暂以 `createdAt` 做增量边界。

### 异常标记回写

```http
POST /api/v1/integration/orders/{externalCode}/exception-marker
```

当前 V2 schema 未新增 marker 表，接口先作为兼容扩展点接收请求并记录日志。

## 超时与重试

V3 调 V2 超时时间为 8 秒。V3 对 V2 `5xx`、网络错误、超时错误最多尝试 2 次；`4xx` 业务错误不重试，避免对不存在运单、SKU 不归属等确定性错误做无意义重放。每次尝试共用同一个 Request ID，并在 `integration_logs.params_digest` 中记录 attempt，便于还原调用链。

关键动作失败时不创建新工单；详情页可展示本地缓存并明确同步时间。

## 降级策略

- 上报/扫描这类关键写动作必须实时校验 V2。
- 工单详情展示可使用本地快照。
- 接口失败会写入 `integration_logs`，包含 Request ID、状态码、耗时和错误信息。

## V2 存量系统二开原则

- 新接口统一挂载在 `/api/v1/integration`，不改变现有 `/api/orders` 行为。
- 字段只增不删，金额字段 V2 暂无时返回 `null`。
- V3 对未知字段容忍，避免 V2 字段升级破坏 V3。
- 若 V2 金额从整数升级为 decimal，V3 统一按字符串 decimal 接收并在本地 decimal 字段存储。
