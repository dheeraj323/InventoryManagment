import { LedgerEntry, PaymentMethod } from '../types';
import { formatDate } from './dateFormatter';
import { colors } from '../theme';

export interface FormattedTransaction {
  title: string;
  category: 'payment' | 'invoice' | 'credit_note' | 'adjustment' | 'refund' | 'opening_balance';
  categoryLabel: string;
  description: string;
  referenceId: string;
  amount: number;
  amountType: 'debit' | 'credit';
  amountFormatted: string;
  amountWithSign: string;
  color: string;
  iconName: string;
  iconColor: string;
  iconBg: string;
  paymentMethod?: string;
  status: string;
  statusColor: string;
  statusBg: string;
  relatedOrder?: string;
  relatedInvoice?: string;
  actorName?: string;
  dateFormatted: string;
  timeFormatted: string;
  fullDateFormatted: string;
  runningBalance: number;
  runningBalanceFormatted: string;
  balanceLabel: string;
  balanceStatus: 'DUE' | 'SETTLED';
  notes?: string;
  auditInfo?: {
    editedAt?: string;
    editedBy?: string;
    editReason?: string;
  };
}

const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Centralized transaction formatter that turns a raw LedgerEntry into a rich,
 * human-readable financial presentation object.
 *
 * Handles perspective differences:
 * - ADMIN: Payments are money received (+ Green), Invoices are bills issued (− Red).
 * - VENDOR: Payments are money paid out (− Red), Invoices are purchases received (+ Green).
 *
 * @param entry       - The raw LedgerEntry from Firestore / store
 * @param perspective - 'ADMIN' (Distributor view) or 'VENDOR' (Retailer view)
 */
export function formatTransaction(
  entry: LedgerEntry,
  perspective: 'ADMIN' | 'VENDOR' = 'ADMIN'
): FormattedTransaction {
  const isDebit = entry.type === 'DEBIT'; // Invoice / Amount billed
  const isCredit = entry.type === 'CREDIT'; // Payment / Credit received
  const isVendor = perspective === 'VENDOR';

  const noteLower = (entry.note || '').toLowerCase();
  const reasonLower = (entry.reason || entry.editReason || '').toLowerCase();
  const refNo = entry.referenceNo || entry.referenceId || entry.id || '';
  const refNoUpper = refNo.toUpperCase();

  // 1. Determine Category & Title
  let category: FormattedTransaction['category'] = isDebit ? 'invoice' : 'payment';
  let categoryLabel = isDebit
    ? isVendor
      ? 'Purchase Invoice'
      : 'Invoice'
    : isVendor
    ? 'Payment Made'
    : 'Payment Received';
  let title = isDebit
    ? isVendor
      ? 'Invoice Received'
      : 'Invoice Generated'
    : isVendor
    ? 'Payment Made'
    : 'Payment Received';
  let paymentMethod: string | undefined = undefined;
  let status = isDebit ? 'Billed' : 'Verified';
  let statusColor = isDebit ? '#B45309' : colors.brandGreen;
  let statusBg = isDebit ? '#FEF3C7' : colors.brandGreenLight;
  let iconName = isDebit ? 'receipt-outline' : 'cash-outline';
  let iconColor = isDebit ? colors.debit : colors.brandGreen;
  let iconBg = isDebit ? colors.debitLight : colors.brandGreenLight;

  // Opening balance check
  if (
    entry.sourceType === 'OPENING_BALANCE' ||
    refNoUpper.startsWith('OPEN-') ||
    noteLower.includes('opening balance') ||
    noteLower.includes('initial balance')
  ) {
    category = 'opening_balance';
    categoryLabel = 'Opening Balance';
    title = isVendor ? 'Opening Balance' : 'Opening Balance Added';
    status = 'Verified';
    statusColor = colors.textSecondary;
    statusBg = colors.surfaceSubtle;
    iconName = 'bookmark-outline';
    iconColor = colors.accent;
    iconBg = colors.accentLight;
  }
  // Return / Credit note check
  else if (
    entry.sourceType === 'CREDIT_NOTE' ||
    refNoUpper.startsWith('CN-') ||
    refNoUpper.startsWith('RET-') ||
    noteLower.includes('return credit') ||
    noteLower.includes('credit note') ||
    noteLower.includes('return')
  ) {
    category = 'credit_note';
    categoryLabel = isVendor ? 'Return Credit' : 'Credit Note';
    title = isVendor ? 'Return Credit Received' : 'Return Credit Applied';
    status = 'Credit Applied';
    statusColor = '#7E22CE';
    statusBg = '#F3E8FF';
    iconName = 'arrow-undo-outline';
    iconColor = '#7E22CE';
    iconBg = '#F3E8FF';
  }
  // Refund check
  else if (noteLower.includes('refund') || reasonLower.includes('refund')) {
    category = 'refund';
    categoryLabel = isVendor ? 'Refund Received' : 'Refund';
    title = isVendor ? 'Refund Received' : 'Refund Issued';
    status = 'Processed';
    statusColor = colors.info;
    statusBg = colors.accentLight;
    iconName = 'refresh-outline';
    iconColor = colors.info;
    iconBg = colors.accentLight;
  }
  // Manual Adjustment check
  else if (
    entry.sourceType === 'MANUAL_ADJUSTMENT' ||
    refNoUpper.startsWith('ADJ-') ||
    Boolean(entry.editedAt) ||
    noteLower.includes('adjustment') ||
    reasonLower.includes('adjustment')
  ) {
    category = 'adjustment';
    categoryLabel = 'Adjustment';
    title = 'Account Adjustment';
    status = entry.editedAt ? 'Edited' : 'Adjusted';
    statusColor = '#B45309';
    statusBg = '#FEF3C7';
    iconName = 'create-outline';
    iconColor = '#B45309';
    iconBg = '#FEF3C7';
  }
  // Payment Breakdown
  else if (isCredit || entry.sourceType === 'PAYMENT' || refNoUpper.startsWith('PAY-') || refNoUpper.startsWith('RCPT-')) {
    category = 'payment';
    categoryLabel = isVendor ? 'Payment Made' : 'Payment Received';

    const pMethod = entry.paymentMethod || '';
    if (pMethod === 'CASH' || noteLower.includes('cash')) {
      paymentMethod = 'Cash';
      title = isVendor ? 'Cash Payment Made' : 'Cash Payment Received';
      iconName = 'cash-outline';
    } else if (
      pMethod === 'ONLINE' ||
      noteLower.includes('online') ||
      noteLower.includes('upi') ||
      noteLower.includes('gpay') ||
      noteLower.includes('phonepe') ||
      noteLower.includes('bank')
    ) {
      paymentMethod = 'Online (UPI/Bank)';
      title = isVendor ? 'Online Payment Made' : 'Online Payment Received';
      iconName = 'qr-code-outline';
    } else {
      paymentMethod = pMethod || 'Direct Payment';
      title = isVendor ? 'Payment Made' : 'Payment Received';
      iconName = 'card-outline';
    }
  }
  // Invoice / Bill
  else if (isDebit || entry.sourceType === 'INVOICE' || refNoUpper.startsWith('INV-') || refNoUpper.startsWith('ORD-')) {
    category = 'invoice';
    categoryLabel = isVendor ? 'Purchase Invoice' : 'Invoice';
    title = isVendor ? 'Invoice Received' : 'Invoice Generated';
    iconName = 'receipt-outline';
  }

  // 2. Compute Description
  let description = entry.note || '';
  if (category === 'payment') {
    if (isVendor) {
      if (entry.paymentMethod) {
        description = `Paid via ${entry.paymentMethod}`;
      } else if (entry.createdBy && entry.createdBy !== 'System' && entry.createdBy !== 'Admin') {
        description = `Handed over to ${entry.createdBy}`;
      } else if (!description) {
        description = 'Payment towards account balance';
      }
    } else {
      if (entry.createdBy && entry.createdBy !== 'System' && entry.createdBy !== 'Admin') {
        description = `Collected by ${entry.createdBy}`;
      } else if (entry.paymentMethod) {
        description = `Settled via ${entry.paymentMethod}`;
      } else if (!description) {
        description = 'Direct settlement on account';
      }
    }
  } else if (category === 'invoice') {
    if (entry.orderId) {
      description = `Order #${entry.orderId}`;
    } else if (!description) {
      description = isVendor ? 'Goods purchased on credit' : 'Goods billed on credit';
    }
  } else if (category === 'opening_balance' && !description) {
    description = 'Initial balance brought forward';
  } else if (category === 'credit_note' && !description) {
    description = isVendor ? 'Goods return credit note' : 'Goods return credit adjustment';
  } else if (category === 'adjustment' && !description) {
    description = entry.reason || entry.editReason || 'Manual ledger adjustment';
  }

  // 3. Amount, Signs & Colors (Reversed for Vendor vs Admin)
  let amountWithSign: string;
  let color: string;

  if (isVendor) {
    // For Vendor:
    // When vendor pays money (Credit in ledger) -> Money Out from vendor (− Red)
    // When vendor receives an invoice (Debit in ledger) -> Goods In / Bill Added (+ Green)
    if (isCredit) {
      amountWithSign = `−₹${fmt(entry.amount)}`;
      color = colors.debit; // Red for cash paid out
      iconColor = colors.debit;
      iconBg = colors.debitLight;
    } else {
      amountWithSign = `+₹${fmt(entry.amount)}`;
      color = colors.brandGreen; // Green for purchases received
      iconColor = colors.brandGreen;
      iconBg = colors.brandGreenLight;
    }
  } else {
    // For Admin:
    // When admin receives payment (Credit) -> Money In to distributor (+ Green)
    // When admin bills invoice (Debit) -> Goods Out / Bill Given (− Red)
    if (isCredit) {
      amountWithSign = `+₹${fmt(entry.amount)}`;
      color = colors.brandGreen;
      iconColor = colors.brandGreen;
      iconBg = colors.brandGreenLight;
    } else {
      amountWithSign = `−₹${fmt(entry.amount)}`;
      color = colors.debit;
      iconColor = colors.debit;
      iconBg = colors.debitLight;
    }
  }

  // Special category color overrides
  if (category === 'credit_note') {
    iconColor = '#7E22CE';
    iconBg = '#F3E8FF';
  } else if (category === 'opening_balance') {
    iconColor = colors.accent;
    iconBg = colors.accentLight;
  } else if (category === 'refund') {
    iconColor = colors.info;
    iconBg = colors.accentLight;
  } else if (category === 'adjustment') {
    iconColor = '#B45309';
    iconBg = '#FEF3C7';
  }

  // 4. Date & Time formatting
  const dateObj = new Date(entry.date || entry.createdAt || Date.now());
  const isValidDate = !isNaN(dateObj.getTime());
  const safeDate = isValidDate ? dateObj : new Date();

  const dateFormatted = formatDate(safeDate);

  const timeFormatted = safeDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const fullDateFormatted = `${dateFormatted}, ${timeFormatted}`;

  // 5. Running Balance Status & Nomenclature
  const runningBal = entry.runningBalance ?? 0;
  let balanceStatus: FormattedTransaction['balanceStatus'] = 'SETTLED';
  let balanceLabel = 'Settled (₹0.00)';

  if (runningBal > 0) {
    balanceStatus = 'DUE';
    balanceLabel = isVendor ? `Payable: ₹${fmt(runningBal)}` : `Due: ₹${fmt(runningBal)}`;
  }

  // 6. Audit Info
  const auditInfo = entry.editedAt
    ? {
        editedAt: entry.editedAt,
        editedBy: entry.editedBy || 'Administrator',
        editReason: entry.editReason || entry.reason || 'Manual correction',
      }
    : undefined;

  return {
    title,
    category,
    categoryLabel,
    description,
    referenceId: refNo,
    amount: entry.amount,
    amountType: isDebit ? 'debit' : 'credit',
    amountFormatted: `₹${fmt(entry.amount)}`,
    amountWithSign,
    color,
    iconName,
    iconColor,
    iconBg,
    paymentMethod,
    status,
    statusColor,
    statusBg,
    relatedOrder: entry.orderId,
    relatedInvoice: entry.invoiceId || (refNoUpper.startsWith('INV-') ? refNo : undefined),
    actorName: entry.createdBy,
    dateFormatted,
    timeFormatted,
    fullDateFormatted,
    runningBalance: runningBal,
    runningBalanceFormatted: `₹${fmt(Math.abs(runningBal))}`,
    balanceLabel,
    balanceStatus,
    notes: entry.note,
    auditInfo,
  };
}
