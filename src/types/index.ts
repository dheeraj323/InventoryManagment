export type UserRole = 'ADMIN' | 'STAFF' | 'VENDOR';
export type AccountStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'REJECTED';

export interface User {
  id: string;
  uid?: string;
  name: string;
  username?: string;
  phone: string;
  email: string;
  role: UserRole;
  status?: AccountStatus;
  active?: boolean;
  vendorId?: string;
  staffId?: string;
  businessName?: string;
  area?: string;
  address?: string;
  locationUrl?: string;
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
  passwordManagedByAdmin?: boolean;
  customPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type VendorStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'ON_HOLD' | 'SUSPENDED';

export interface Vendor {
  id: string;
  vendorId?: string;
  name: string;
  ownerName?: string;
  shopName: string;
  businessName?: string;
  username?: string;
  phone: string;
  email?: string;
  address?: string;
  locationUrl?: string;
  latitude?: number;
  longitude?: number;
  area?: string;
  vendorType?: string; // e.g. "Retailer", "Supermarket", "Kirana Store", "Wholesaler"
  paymentTerms?: string; // e.g. "Net 15 Days", "Payment On Delivery", "Weekly"
  assignedStaffId?: string;
  creditLimit?: number;
  openingBalance?: number; // Bootstrap balance for migrated vendors; used when no ledger entries exist
  currentBalance: number; // Positive = Receivable (Vendor owes us), Negative = Advance paid
  currentOutstanding?: number;
  overdueAmount?: number;
  lastOrderDate?: string;
  lastPaymentDate?: string;
  payLaterEligible: boolean;
  payLaterEnabled?: boolean;
  preferredPaymentMode: 'CASH' | 'ONLINE' | 'PAY_LATER';
  passwordManagedByAdmin?: boolean;
  status?: VendorStatus;
  active?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Staff {
  id: string;
  staffId?: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  activeArea?: string;
  role?: UserRole;
  status?: AccountStatus;
  todayAssignedDeliveries: number;
  cashInHand: number;
  monthlySalary?: number;
  salaryType?: 'MONTHLY' | 'DAILY';
  dailyRate?: number;
  totalAdvanceOutstanding?: number;
  active?: boolean;
  notes?: string;
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
  category?: string;
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
  locationUrl?: string;
  latitude?: number;
  longitude?: number;
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
  assignedStaffPhone?: string;
  dispatchedAt?: string;
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
  vendorName?: string;
  shopName?: string;
  supplierId?: string;
  orderId?: string;
  invoiceId?: string;
  amount: number;
  paymentMode: PaymentMethod;
  paymentType: 'receivable' | 'payable';
  collectedBy?: string;
  paymentDate: string;
  referenceNumber?: string;
  verificationStatus?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'DISPUTED';
  verifiedBy?: string;
  verifiedAt?: string;
  allocatedAmount?: number;
  unallocatedAmount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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
  currentOutstanding: number; // Net amount the vendor owes (positive = receivable, 0 if settled/advance)
  advanceBalance: number;    // Net excess payment (positive when totalCredits > totalDebits)
  overdueAmount: number;     // Overdue amount if invoices are past due
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

// ─── Supplier Bill & History Types ──────────────────────────────────────────

export type BillPaymentStatus = 'PAID' | 'PENDING' | 'PARTIALLY_PAID';

export interface SupplierBillItem {
  id?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export type BillAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PAYMENT_UPDATED'
  | 'ATTACHMENT_REPLACED'
  | 'DELETED';

export interface BillAuditRecord {
  id: string;
  billId: string;
  supplierId?: string;
  action: BillAuditAction;
  field?: string;
  oldValue?: any;
  newValue?: any;
  description: string;
  changedBy: string;
  changedByName?: string;
  changedAt: string;
}

export interface SupplierBill {
  id: string;
  billId?: string;
  supplierId: string;
  supplierName?: string;
  userId: string;
  createdByName?: string;
  invoiceNumber: string;
  billDate: string; // YYYY-MM-DD
  uploadedAt?: string;
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  paymentStatus: BillPaymentStatus;
  paidAmount?: number;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  notes?: string;
  items: SupplierBillItem[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierPurchaseStats {
  totalBills: number;
  totalPurchases: number;
  currentMonthPurchases: number;
  currentYearPurchases: number;
  lastPurchaseDate?: string;
  averageBillValue: number;
  totalProductsCount: number;
  outstandingAmount: number;
  paidBillsCount: number;
  pendingBillsCount: number;
}

// ── Staff Attendance Types ──
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';

export interface StaffAttendance {
  id: string; // e.g. "att_<staffId>_<YYYY-MM-DD>"
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  markedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MonthlyAttendanceSummary {
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  unmarkedDays: number;
  payableDays: number; // present + (halfDays * 0.5)
}

// ── Staff Advance Types ──
export type AdvanceStatus = 'ACTIVE' | 'PARTIALLY_REPAID' | 'REPAID' | 'DEDUCTED_FROM_SALARY';

export interface StaffAdvanceRepayment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: 'CASH_RETURN' | 'SALARY_DEDUCTION' | 'ONLINE_RETURN';
  salarySlipId?: string;
  notes?: string;
  createdAt?: string;
}

export interface StaffAdvance {
  id: string;
  advanceNumber: string; // e.g. "ADV-2609-001"
  staffId: string;
  staffName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  reason?: string;
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  status: AdvanceStatus;
  amountRepaid: number;
  remainingAmount: number;
  repayments?: StaffAdvanceRepayment[];
  notes?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Staff Salary & Payroll Types ──
export type SalaryPaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL';

export interface StaffSalarySlip {
  id: string; // e.g. "sal_<staffId>_<YYYY-MM>"
  staffId: string;
  staffName: string;
  month: string; // YYYY-MM (e.g. "2026-09")
  baseSalary: number;
  salaryType: 'MONTHLY' | 'DAILY';
  dailyRate: number;
  totalWorkingDays: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  payableDays: number;
  earnedSalary: number;
  bonusOrIncentive: number;
  allowances: number;
  advanceDeducted: number;
  otherDeductions: number;
  deductionNotes?: string;
  netPayableSalary: number;
  paidAmount: number;
  status: SalaryPaymentStatus;
  paymentMode?: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  paymentDate?: string; // YYYY-MM-DD
  transactionRef?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Staff Daily Delivery Vehicle Stock Types ──
export type StockSessionStatus = 'ACTIVE' | 'RETURNED' | 'DISCREPANCY';

export interface StaffStockItem {
  productId: string;
  productName: string;
  unit: string;
  sku?: string;
  price?: number;
  preOrderedQty: number; // Pre-booked quantities from assigned orders (already decremented at order placement)
  extraLoadedQty: number; // Extra quantities taken from warehouse stock (decremented on morning load)
  loadedQty: number;     // Total loaded in vehicle = preOrderedQty + extraLoadedQty
  deliveredQty: number;  // Total delivered to vendors
  returnedQty?: number;  // Evening returned quantity to inventory (ADDED back to stock)
  damagedQty?: number;   // Damaged / broken items (NOT added to stock)
  missingQty?: number;   // Missing / lost items (NOT added to stock)
  varianceQty?: number;  // Discrepancy = loadedQty - (deliveredQty + (returnedQty || 0) + (damagedQty || 0) + (missingQty || 0))
  currentStock: number;  // Current on-hand in vehicle
}

export interface StaffDailyStockSession {
  id: string; // e.g. "stock_<staffId>_<YYYY-MM-DD>"
  sessionId?: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  status: StockSessionStatus;
  items: StaffStockItem[];
  totalPreOrderedUnits: number;
  totalExtraLoadedUnits: number;
  totalLoadedUnits: number;
  totalDeliveredUnits: number;
  totalReturnedUnits: number;
  totalDamagedUnits?: number;
  totalMissingUnits?: number;
  totalVarianceUnits?: number;
  notes?: string;
  loadedAt: string;     // ISO String timestamp
  returnedAt?: string;  // ISO String timestamp
  approvedByAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

