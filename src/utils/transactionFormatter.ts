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
  balanceStatus: 'DUE' | 'ADVANCE' | 'SETTLED';
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
 * @param entry       - The raw LedgerEntry from Firestore / store
 * @param perspective - 'ADMIN' (Distributor view) or 'VENDOR' (Retailer view)
 */
export function formatTransaction(
  entry: LedgerEntry,
  perspective: 'ADMIN' | 'VENDOR' = 'ADMIN'
): FormattedTransaction {
  const isDebit = entry.type === 'DEBIT'; // Invoice / Amount billed
  const isCredit = entry.type === 'CREDIT'; // Payment / Credit received

  const noteLower = (entry.note || '').toLowerCase();
  const reasonLower = (entry.reason || entry.editReason || '').toLowerCase();
  const refNo = entry.referenceNo || entry.referenceId || entry.id || '';
  const refNoUpper = refNo.toUpperCase();

  // 1. Determine Category & Title
  let category: FormattedTransaction['category'] = isDebit ? 'invoice' : 'payment';
  let categoryLabel = isDebit ? 'Invoice' : 'Payment';
  let title = isDebit ? 'Invoice Generated' : 'Payment Received';
  let paymentMethod: string | undefined = undefined;
  let status = isDebit ? 'Billed' : 'Verified';
  let statusColor = isDebit ? '#B45309' : colors.brandGreen;
  let statusBg = isDebit ? '#FEF3C7' : colors.brandGreenLight;
  let iconName = isDebit ? 'document-text-outline' : 'cash-outline';
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
    title = 'Opening Balance Added';
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
    categoryLabel = 'Credit Note';
    title = 'Return Credit Applied';
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
    categoryLabel = 'Refund';
    title = 'Refund Issued';
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
    categoryLabel = 'Payment';

    const pMethod = entry.paymentMethod || '';
    if (pMethod === 'CASH' || noteLower.includes('cash')) {
      paymentMethod = 'Cash';
      title = 'Cash Payment Received';
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
      title = 'Online Payment Received';
      iconName = 'qr-code-outline';
    } else {
      paymentMethod = pMethod || 'Direct Payment';
      title = 'Payment Received';
      iconName = 'card-outline';
    }
  }
  // Invoice / Bill
  else if (isDebit || entry.sourceType === 'INVOICE' || refNoUpper.startsWith('INV-') || refNoUpper.startsWith('ORD-')) {
    category = 'invoice';
    categoryLabel = 'Invoice';
    title = 'Invoice Generated';
    iconName = 'receipt-outline';
  }

  // 2. Compute Description
  let description = entry.note || '';
  if (category === 'payment') {
    if (entry.createdBy && entry.createdBy !== 'System' && entry.createdBy !== 'Admin') {
      description = `Collected by ${entry.createdBy}`;
    } else if (entry.paymentMethod) {
      description = `Settled via ${entry.paymentMethod}`;
    } else if (!description) {
      description = 'Direct settlement on account';
    }
  } else if (category === 'invoice') {
    if (entry.orderId) {
      description = `Order #${entry.orderId}`;
    } else if (!description) {
      description = 'Goods billed on credit';
    }
  } else if (category === 'opening_balance' && !description) {
    description = 'Initial balance brought forward';
  } else if (category === 'credit_note' && !description) {
    description = 'Goods return credit adjustment';
  } else if (category === 'adjustment' && !description) {
    description = entry.reason || entry.editReason || 'Manual ledger adjustment';
  }

  // 3. Amount & Signs
  // For money received/collected (Credits: payments, credit notes), show + sign in green (#16A34A).
  // For invoices/charges billed (Debits), show − sign in debit/red (#DC2626).
  const amountWithSign = isCredit ? `+₹${fmt(entry.amount)}` : `−₹${fmt(entry.amount)}`;
  const color = isCredit ? colors.brandGreen : colors.debit;

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

  // 5. Running Balance Status
  const runningBal = entry.runningBalance ?? 0;
  let balanceStatus: FormattedTransaction['balanceStatus'] = 'SETTLED';
  let balanceLabel = 'Settled (₹0.00)';

  if (runningBal > 0) {
    balanceStatus = 'DUE';
    balanceLabel = `Due: ₹${fmt(runningBal)}`;
  } else if (runningBal < 0) {
    balanceStatus = 'ADVANCE';
    balanceLabel = `Advance: ₹${fmt(Math.abs(runningBal))}`;
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
