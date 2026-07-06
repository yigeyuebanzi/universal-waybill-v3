import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  role: varchar('role', { length: 40 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  warehouseId: varchar('warehouse_id', { length: 80 }).notNull().default('default-warehouse'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const waybillSnapshots = pgTable('waybill_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalCode: varchar('external_code', { length: 255 }).notNull(),
  v2OrderId: uuid('v2_order_id'),
  storeName: varchar('store_name', { length: 255 }),
  receiverName: varchar('receiver_name', { length: 100 }),
  receiverPhone: varchar('receiver_phone', { length: 50 }),
  receiverAddress: text('receiver_address'),
  amount: decimal('amount', { precision: 12, scale: 2 }),
  itemsJson: jsonb('items_json').notNull().default([]),
  source: varchar('source', { length: 40 }).notNull().default('v2_realtime'),
  syncedAt: timestamp('synced_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('ux_waybill_snapshots_external_code').on(table.externalCode),
  index('idx_waybill_snapshots_synced_at').on(table.syncedAt),
]);

export const integrationLogs = pgTable('integration_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: varchar('request_id', { length: 80 }).notNull(),
  system: varchar('system', { length: 40 }).notNull().default('v2'),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  method: varchar('method', { length: 12 }).notNull(),
  paramsDigest: text('params_digest'),
  statusCode: integer('status_code'),
  success: boolean('success').notNull().default(false),
  durationMs: integer('duration_ms').notNull().default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_integration_logs_request_id').on(table.requestId),
  index('idx_integration_logs_created_at').on(table.createdAt),
]);

export const exceptionTickets = pgTable('exception_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNo: varchar('ticket_no', { length: 40 }).notNull(),
  externalCode: varchar('external_code', { length: 255 }).notNull(),
  snapshotId: uuid('snapshot_id').references(() => waybillSnapshots.id),
  source: varchar('source', { length: 40 }).notNull(),
  category: varchar('category', { length: 40 }).notNull(),
  exceptionType: varchar('exception_type', { length: 80 }).notNull(),
  severity: varchar('severity', { length: 40 }).notNull().default('medium'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  description: text('description').notNull(),
  status: varchar('status', { length: 40 }).notNull().default('pending'),
  currentLevel: integer('current_level').notNull().default(1),
  reporterId: uuid('reporter_id').references(() => users.id),
  assignedApproverId: uuid('assigned_approver_id').references(() => users.id),
  resubmitCount: integer('resubmit_count').notNull().default(0),
  maxResubmitCount: integer('max_resubmit_count').notNull().default(2),
  timeoutAt: timestamp('timeout_at'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  closedAt: timestamp('closed_at'),
}, (table) => [
  uniqueIndex('ux_exception_tickets_ticket_no').on(table.ticketNo),
  index('idx_exception_tickets_external_code').on(table.externalCode),
  index('idx_exception_tickets_status').on(table.status),
  index('idx_exception_tickets_timeout_at').on(table.timeoutAt),
]);

export const approvalRecords = pgTable('approval_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => exceptionTickets.id),
  level: integer('level').notNull(),
  approverId: uuid('approver_id').references(() => users.id),
  action: varchar('action', { length: 40 }).notNull(),
  opinion: text('opinion').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
  fromStatus: varchar('from_status', { length: 40 }).notNull(),
  toStatus: varchar('to_status', { length: 40 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  uniqueIndex('ux_approval_records_idempotency').on(table.ticketId, table.idempotencyKey),
  index('idx_approval_records_ticket_id').on(table.ticketId),
]);

export const compensationRecords = pgTable('compensation_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => exceptionTickets.id),
  approvalRecordId: uuid('approval_record_id').references(() => approvalRecords.id),
  direction: varchar('direction', { length: 40 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 40 }).notNull().default('recorded'),
  reconciliationRef: varchar('reconciliation_ref', { length: 120 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  skuCode: varchar('sku_code', { length: 255 }).notNull(),
  skuName: varchar('sku_name', { length: 255 }).notNull(),
  batchNo: varchar('batch_no', { length: 120 }).notNull(),
  availableQty: integer('available_qty').notNull().default(0),
  lockedQty: integer('locked_qty').notNull().default(0),
  status: varchar('status', { length: 40 }).notNull().default('available'),
  warehouseId: varchar('warehouse_id', { length: 80 }).notNull().default('default-warehouse'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('ux_inventory_sku_batch_warehouse').on(table.skuCode, table.batchNo, table.warehouseId),
  index('idx_inventory_status').on(table.status),
]);

export const inventoryMovements = pgTable('inventory_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').references(() => exceptionTickets.id),
  approvalRecordId: uuid('approval_record_id').references(() => approvalRecords.id),
  skuCode: varchar('sku_code', { length: 255 }).notNull(),
  batchNo: varchar('batch_no', { length: 120 }).notNull(),
  movementType: varchar('movement_type', { length: 60 }).notNull(),
  quantity: integer('quantity').notNull(),
  beforeQty: integer('before_qty').notNull(),
  afterQty: integer('after_qty').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const scanRecords = pgTable('scan_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanNo: varchar('scan_no', { length: 40 }).notNull(),
  externalCode: varchar('external_code', { length: 255 }).notNull(),
  skuCode: varchar('sku_code', { length: 255 }).notNull(),
  batchNo: varchar('batch_no', { length: 120 }).notNull(),
  operatorId: uuid('operator_id').references(() => users.id),
  deviceId: varchar('device_id', { length: 80 }),
  qcResult: varchar('qc_result', { length: 40 }).notNull(),
  qcStatus: varchar('qc_status', { length: 40 }).notNull(),
  matchedRuleId: uuid('matched_rule_id'),
  ruleSnapshot: jsonb('rule_snapshot'),
  evidence: jsonb('evidence'),
  description: text('description'),
  ticketId: uuid('ticket_id').references(() => exceptionTickets.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  uniqueIndex('ux_scan_records_scan_no').on(table.scanNo),
  index('idx_scan_records_batch').on(table.skuCode, table.batchNo),
  index('idx_scan_records_ticket_id').on(table.ticketId),
]);

export const qcRules = pgTable('qc_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  subType: varchar('sub_type', { length: 80 }).notNull(),
  conditionType: varchar('condition_type', { length: 80 }).notNull(),
  conditionConfig: jsonb('condition_config').notNull(),
  severity: varchar('severity', { length: 40 }).notNull().default('medium'),
  autoCreateTicket: boolean('auto_create_ticket').notNull().default(true),
  targetApprovalLevel: integer('target_approval_level').notNull().default(2),
  enabled: boolean('enabled').notNull().default(true),
  priority: integer('priority').notNull().default(100),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const approvalRules = pgTable('approval_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  minAmount: decimal('min_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  maxAmount: decimal('max_amount', { precision: 12, scale: 2 }),
  targetLevel: integer('target_level').notNull().default(1),
  timeoutHours: integer('timeout_hours').notNull().default(24),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  entityType: varchar('entity_type', { length: 60 }).notNull(),
  entityId: uuid('entity_id'),
  action: varchar('action', { length: 80 }).notNull(),
  beforeJson: jsonb('before_json'),
  afterJson: jsonb('after_json'),
  requestId: varchar('request_id', { length: 80 }),
  createdAt: timestamp('created_at').defaultNow(),
});
