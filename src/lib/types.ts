export type UserRole = 'operator' | 'level1_approver' | 'level2_approver' | 'qc_supervisor' | 'admin';
export type TicketSource = 'manual_report' | 'scan_qc';
export type TicketCategory = 'logistics' | 'quality_control';
export type TicketStatus =
  | 'pending'
  | 'level1_review'
  | 'level2_review'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'closed'
  | 'auto_rejected'
  | 'fast_released';

export type CompensationDirection = 'pay_customer' | 'claim_supplier';

export interface V2OrderItem {
  skuCode: string;
  skuName: string;
  skuQuantity: string;
  skuSpec: string | null;
}

export interface V2OrderDetail {
  orderId: string;
  externalCode: string;
  storeName: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
  remark: string | null;
  createdAt: string | null;
  amount: string | null;
  items: V2OrderItem[];
}
