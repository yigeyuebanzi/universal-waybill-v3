import { db } from '../src/lib/db';
import {
  approvalRules,
  exceptionTickets,
  inventoryItems,
  qcRules,
  users,
  waybillSnapshots,
} from '../src/lib/db/schema';

async function main() {
  const insertedUsers = await db.insert(users).values([
    { name: '仓库操作员', role: 'operator' },
    { name: '一级审批人', role: 'level1_approver' },
    { name: '二级审批人', role: 'level2_approver' },
    { name: '品控主管', role: 'qc_supervisor' },
    { name: '管理员', role: 'admin' },
  ]).returning().catch(async () => db.select().from(users).limit(5));

  await db.insert(approvalRules).values([
    { name: '低金额一级审批', minAmount: '0', maxAmount: '500', targetLevel: 1, timeoutHours: 24 },
    { name: '高金额二级审批', minAmount: '500.01', maxAmount: null, targetLevel: 2, timeoutHours: 24 },
  ]).onConflictDoNothing();

  await db.insert(qcRules).values([
    { name: '数量差异超过 5%', subType: 'quantity_mismatch', conditionType: 'quantity_diff_percent', conditionConfig: { threshold: 5 }, severity: 'medium', priority: 10, targetApprovalLevel: 2 },
    { name: '破损等级 2 级以上', subType: 'appearance_damage', conditionType: 'damage_level', conditionConfig: { minLevel: 2 }, severity: 'high', priority: 20, targetApprovalLevel: 2 },
    { name: '规格偏差超过 3%', subType: 'spec_mismatch', conditionType: 'spec_deviation_percent', conditionConfig: { threshold: 3 }, severity: 'medium', priority: 30, targetApprovalLevel: 2 },
    { name: '标签错误', subType: 'label_error', conditionType: 'label_mismatch', conditionConfig: { expected: true }, severity: 'medium', priority: 40, targetApprovalLevel: 2 },
    { name: '批次风险', subType: 'batch_exception', conditionType: 'batch_risk', conditionConfig: { expected: true }, severity: 'high', priority: 50, targetApprovalLevel: 2 },
  ]).onConflictDoNothing();

  const inventory = Array.from({ length: 20 }, (_, i) => ({
    skuCode: `SKU-${String(i + 1).padStart(3, '0')}`,
    skuName: `演示商品 ${i + 1}`,
    batchNo: `BATCH-${String(i + 1).padStart(3, '0')}`,
    availableQty: 100 + i,
    lockedQty: i % 4,
    status: i % 4 ? 'held' : 'available',
  }));
  await db.insert(inventoryItems).values(inventory).onConflictDoNothing();

  const snapshots = await db.insert(waybillSnapshots).values(
    Array.from({ length: 30 }, (_, i) => ({
      externalCode: `DEMO-ORDER-${String(i + 1).padStart(3, '0')}`,
      storeName: '演示门店',
      receiverName: `收件人${i + 1}`,
      receiverPhone: '13800000000',
      receiverAddress: `演示地址 ${i + 1}`,
      amount: String((i + 1) * 30),
      itemsJson: [{ skuCode: `SKU-${String((i % 20) + 1).padStart(3, '0')}`, skuName: `演示商品 ${(i % 20) + 1}`, skuQuantity: '1' }],
      source: 'seed_cache',
      syncedAt: new Date(),
    }))
  ).returning().catch(async () => db.select().from(waybillSnapshots).limit(30));

  const statuses = ['level1_review', 'level2_review', 'rejected', 'executing', 'completed', 'auto_rejected'];
  const types = ['lost', 'damage', 'rejected', 'timeout', 'address_error', 'quantity_mismatch', 'appearance_damage', 'spec_mismatch'];
  const tickets = Array.from({ length: 200 }, (_, i) => {
    const snapshot = snapshots[i % snapshots.length];
    const qc = i % 3 === 0;
    const status = statuses[i % statuses.length];
    const level = status === 'level2_review' || qc ? 2 : 1;
    return {
      ticketNo: `DEMO-T-${String(i + 1).padStart(4, '0')}`,
      externalCode: snapshot.externalCode,
      snapshotId: snapshot.id,
      source: qc ? 'scan_qc' : 'manual_report',
      category: qc ? 'quality_control' : 'logistics',
      exceptionType: types[i % types.length],
      severity: i % 4 === 0 ? 'high' : 'medium',
      amount: String((i % 20) * 80),
      description: `演示异常工单 ${i + 1}`,
      status,
      currentLevel: level,
      reporterId: insertedUsers[0]?.id,
      assignedApproverId: insertedUsers[level]?.id,
      timeoutAt: new Date(Date.now() + ((i % 8) + 1) * 60 * 60 * 1000),
    };
  });
  await db.insert(exceptionTickets).values(tickets).onConflictDoNothing();
  console.log('Seed completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
