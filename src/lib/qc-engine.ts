import { db } from '@/lib/db';
import { qcRules } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export interface QcInput {
  quantityDiffPercent?: number;
  damageLevel?: number;
  specDeviationPercent?: number;
  labelMismatch?: boolean;
  batchRisk?: boolean;
}

export async function evaluateQc(input: QcInput) {
  const rules = await db
    .select()
    .from(qcRules)
    .where(eq(qcRules.enabled, true))
    .orderBy(asc(qcRules.priority));

  for (const rule of rules) {
    const config = rule.conditionConfig as Record<string, number | boolean>;
    let matched = false;
    if (rule.conditionType === 'quantity_diff_percent') {
      matched = (input.quantityDiffPercent || 0) >= Number(config.threshold || 0);
    }
    if (rule.conditionType === 'damage_level') {
      matched = (input.damageLevel || 0) >= Number(config.minLevel || 0);
    }
    if (rule.conditionType === 'spec_deviation_percent') {
      matched = (input.specDeviationPercent || 0) >= Number(config.threshold || 0);
    }
    if (rule.conditionType === 'label_mismatch') {
      matched = input.labelMismatch === true;
    }
    if (rule.conditionType === 'batch_risk') {
      matched = input.batchRisk === true;
    }

    if (matched) {
      return {
        passed: false,
        rule,
        reason: `${rule.name} matched`,
      };
    }
  }

  return {
    passed: true,
    rule: null,
    reason: 'No QC rule matched',
  };
}
