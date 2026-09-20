export type UserRole = 'ADMIN' | 'STAFF' | 'VENDOR';

export interface User {
  id: string;
  uid?: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  active?: boolean;
  vendorId?: string;
  staffId?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  id: string;
  vendorId?: string;
  name: string;
  ownerName?: string;
  shopName: string;
  businessName?: string;
  phone: string;
  address: string;
  area: string;
  assignedStaffId?: string;
  creditLimit?: number;
  openingBalance?: number; // Bootstrap balance for migrated vendors; used when no ledger entries exist
  currentBalance: number; // Positive = Receivable (Vendor owes us), Negative = Advance paid
  currentOutstanding?: number;
  payLaterEligible: boolean;
  payLaterEnabled?: boolean;
  preferredPaymentMode: 'CASH' | 'ONLINE' | 'PAY_LATER';
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Staff {
  id: string;
  staffId?: string;
  name: string;
  phone: string;
  activeArea: string;
  todayAssignedDeliveries: number;
  cashInHand: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  productId?: string;
  name: string;
  category: string;
  unit: string; // e.g. "Case (12 pcs)", "Bag (25 kg)", "Box"
  price: number;
  sellingPrice?: number;
  purchasePrice?: number;
  stockQty: number;
  availableStock?: number;
  lowStockThreshold: number;
  minimumStock?: number;
  imageUrl?: string;
  sku: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem extends Product {
  reservedQty: number;
  availableQty: number;
  reorderLevel: number;
  supplierId: string;
}

export interface Supplier {
  id: string;
  supplierId?: string;
  name: string;
  businessName?: string;
  contactPerson: string;
  phone: string;
  email: string;
  category: string;
  balancePayable: number; // Outstanding amount we owe to supplier
  outstandingPayable?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'ONLINE' | 'PAY_LATER' | 'PARTIALLY_PAID' | 'PENDING';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  orderedQty: number;
  deliveredQty: number;
  missingDamagedQty: number;
  damagedQty?: number;   // Items physically damaged — NOT returned to stock
  missingQty?: number;  // Items not delivered / lost in transit — returned to stock
  totalAmount: number;
}

export interface Order {
  id: string;
  orderId?: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  shopName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  requestedDeliveryDate?: string;
  status: OrderStatus;
  preferredPaymentMode: PaymentMethod;
  actualPaymentMode?: PaymentMethod;
  paidAmount: number;
  balanceDue: number;
  orderDate: string;
  deliveryDate: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  deliveredAt?: string;
  notes?: string;
  deliveryFinalized?: boolean;    // Idempotency guard: set to true once financial transaction is written
  invoiceId?: string;             // ID of the corresponding Invoice document (same as orderId)
  pendingAdminOverride?: boolean; // True when order exceeds vendor credit limit; requires Admin approval
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  paymentId?: string;
  vendorId?: string;
  supplierId?: string;
  orderId?: string;
  amount: number;
  paymentMode: PaymentMethod;
  paymentType: 'receivable' | 'payable';
  collectedBy?: string;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  createdAt?: string;
}

export type LedgerEntryType = 'DEBIT' | 'CREDIT'; // DEBIT = You Gave / Bill; CREDIT = You Got / Payment Received

export interface LedgerEntry {
  id: string;
  entryId?: string;
  accountType?: 'vendor' | 'supplier';
  accountId?: string;
  partyId: string; // vendorId or supplierId
  partyName: string;
  partyType: 'VENDOR' | 'SUPPLIER';
  type: LedgerEntryType;
  transactionType?: 'DEBIT' | 'CREDIT';
  direction?: 'debit' | 'credit';
  amount: number;
  runningBalance: number;
  referenceId?: string;
  referenceNo: string; // Invoice # or Payment Txn ID
  orderId?: string;
  date: string;
  note: string;
  reason?: string;
  paymentMethod?: PaymentMethod;
  createdBy: string;
  createdRole: UserRole;
  editedAt?: string;
  editedBy?: string;
  editReason?: string;
  invoiceId?: string;        // Link to invoice document when sourced from a delivery
  sourceType?: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'MANUAL_ADJUSTMENT' | 'OPENING_BALANCE';
  idempotencyKey?: string;   // Format: `${orderId}:DEBIT` or `${orderId}:CREDIT`
  isReversed?: boolean;      // True if this entry was reversed by a credit note
  createdAt?: string;
}

export interface CashCollection {
  id: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  staffId: string;
  staffName: string;
  amountCollected: number;
  paymentMethod: 'CASH' | 'ONLINE';
  timestamp: string;
  settled: boolean;
  settlementId?: string;
}

export interface CashSettlement {
  id: string;
  settlementId?: string;
  settlementNumber: string;
  staffId: string;
  staffName: string;
  date: string;
  settlementDate?: string;
  totalCashCollected: number;
  amountCollected?: number;
  handedOverCash: number;
  amountHandedOver?: number;
  variance: number; // positive = excess, negative = shortage
  difference?: number;
  status: 'PENDING_VERIFICATION' | 'VERIFIED';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  logId?: string;
  action: string; // e.g. "LEDGER_MANUAL_ADJUSTMENT", "CREDIT_LIMIT_UPDATE"
  performedBy: string;
  userRole: UserRole;
  entityType: string;
  entityId: string;
  timestamp: string;
  reason: string;
  details: string;
  createdAt?: string;
}

// ─── New Financial Types (Phase 1 — Additive) ──────────────────────────────

/** Tracks per-item delivery exception (damaged or missing quantities) */
export interface DamagedItem {
  productId: string;
  productName: string;
  orderedQty: number;
  deliveredQty: number;
  damagedQty: number;       // Physically damaged — written off, NOT returned to stock
  missingQty: number;       // Not delivered / lost in transit — IS returned to stock
  returnedToStock: boolean; // Whether missingQty was successfully restocked
}

export type InvoiceStatus =
  | 'DRAFT'
  | 'FINALIZED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

/** Persisted in the `invoices` Firestore collection; created when delivery is finalized */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  shopName: string;
  status: InvoiceStatus;
  lineItems: OrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  invoiceDate: string;
  dueDate?: string;
  deliveryFinalized: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Computed (not stored) summary of a vendor's account position.
 * Derived from ledger entries + vendor master data.
 */
export interface VendorAccountSummary {
  vendorId: string;
  vendorName: string;
  shopName: string;
  creditLimit: number;       // 0 = no limit enforced
  openingBalance: number;
  totalDebits: number;       // Sum of all DEBIT ledger entries
  totalCredits: number;      // Sum of all CREDIT ledger entries
  currentOutstanding: number; // Net amount the vendor owes (positive = receivable)
  availableCredit: number;   // creditLimit - currentOutstanding (0 if no limit)
  lastLedgerBalance: number; // Running balance of the most recent ledger entry
}

export interface AppNotification {
  id: string;
  notificationId?: string;
  recipientId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetRole?: UserRole;
  targetUserId?: string;
  type: 'ORDER' | 'PAYMENT' | 'INVENTORY' | 'SETTLEMENT';
  createdAt?: string;
}
