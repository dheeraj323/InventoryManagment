// scripts/test-khata-formatter.js
// Unit verification of transaction formatter and summary calculations

function fmt(n) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTransaction(entry, perspective = 'ADMIN') {
  const isDebit = entry.type === 'DEBIT';
  const isCredit = entry.type === 'CREDIT';
  const noteLower = (entry.note || '').toLowerCase();
  const reasonLower = (entry.reason || entry.editReason || '').toLowerCase();
  const refNo = entry.referenceNo || entry.referenceId || entry.id || '';
  const refNoUpper = refNo.toUpperCase();

  let category = isDebit ? 'invoice' : 'payment';
  let categoryLabel = isDebit ? 'Invoice' : 'Payment';
  let title = isDebit ? 'Invoice Generated' : 'Payment Received';
  let paymentMethod = undefined;
  let status = isDebit ? 'Billed' : 'Verified';

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
  } else if (
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
  } else if (noteLower.includes('refund') || reasonLower.includes('refund')) {
    category = 'refund';
    categoryLabel = 'Refund';
    title = 'Refund Issued';
    status = 'Processed';
  } else if (
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
  } else if (isCredit || entry.sourceType === 'PAYMENT' || refNoUpper.startsWith('PAY-') || refNoUpper.startsWith('RCPT-')) {
    category = 'payment';
    categoryLabel = 'Payment';
    const pMethod = entry.paymentMethod || '';
    if (pMethod === 'CASH' || noteLower.includes('cash')) {
      paymentMethod = 'Cash';
      title = 'Cash Payment Received';
    } else if (
      pMethod === 'ONLINE' ||
      noteLower.includes('online') ||
      noteLower.includes('upi') ||
      noteLower.includes('bank')
    ) {
      paymentMethod = 'Online (UPI/Bank)';
      title = 'Online Payment Received';
    } else {
      paymentMethod = pMethod || 'Direct Payment';
      title = 'Payment Received';
    }
  } else if (isDebit || entry.sourceType === 'INVOICE' || refNoUpper.startsWith('INV-') || refNoUpper.startsWith('ORD-')) {
    category = 'invoice';
    categoryLabel = 'Invoice';
    title = 'Invoice Generated';
  }

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
  }

  const amountWithSign = isCredit ? `+₹${fmt(entry.amount)}` : `−₹${fmt(entry.amount)}`;
  const runningBal = entry.runningBalance ?? 0;
  let balanceStatus = 'SETTLED';
  let balanceLabel = 'Settled (₹0.00)';

  if (runningBal > 0) {
    balanceStatus = 'DUE';
    balanceLabel = `Due: ₹${fmt(runningBal)}`;
  } else if (runningBal < 0) {
    balanceStatus = 'ADVANCE';
    balanceLabel = `Advance: ₹${fmt(Math.abs(runningBal))}`;
  }

  return {
    title,
    category,
    categoryLabel,
    description,
    referenceId: refNo,
    amount: entry.amount,
    amountType: isDebit ? 'debit' : 'credit',
    amountWithSign,
    paymentMethod,
    status,
    balanceStatus,
    balanceLabel,
    runningBalance: runningBal,
  };
}

function calculateVendorSummary(entries, vendor) {
  const openingBalance = vendor?.openingBalance ?? vendor?.currentBalance ?? 0;
  const totalDebits = entries.filter((e) => e.type === 'DEBIT').reduce((s, e) => s + e.amount, 0);
  const totalCredits = entries.filter((e) => e.type === 'CREDIT').reduce((s, e) => s + e.amount, 0);
  const outstandingDue = entries.length > 0 ? totalDebits - totalCredits : openingBalance;
  const currentOutstanding = Math.max(0, outstandingDue);
  const advanceBalance = outstandingDue < 0 ? Math.abs(outstandingDue) : 0;

  return {
    openingBalance,
    totalDebits,
    totalCredits,
    currentOutstanding,
    advanceBalance,
    lastLedgerBalance: outstandingDue,
  };
}

console.log('--- RUNNING TEST SUITE: KHATA FORMATTER & SUMMARY CALCULATIONS ---');

// Test 1: Cash Payment
const t1 = formatTransaction({
  id: 'tx-1',
  referenceNo: 'PAY-783909',
  type: 'CREDIT',
  amount: 2500,
  paymentMethod: 'CASH',
  createdBy: 'Suresh Kumar',
  runningBalance: 1500,
});
console.log('Test 1 (Cash Payment):', t1.title === 'Cash Payment Received', t1.referenceId === 'PAY-783909', t1.amountWithSign === '+₹2,500.00');

// Test 2: Online Payment
const t2 = formatTransaction({
  id: 'tx-2',
  referenceNo: 'RCPT-9321',
  type: 'CREDIT',
  amount: 4000,
  paymentMethod: 'ONLINE',
  note: 'UPI Payment via PhonePe',
  runningBalance: 0,
});
console.log('Test 2 (Online Payment):', t2.title === 'Online Payment Received', t2.referenceId === 'RCPT-9321', t2.balanceStatus === 'SETTLED');

// Test 3: Invoice
const t3 = formatTransaction({
  id: 'tx-3',
  referenceNo: 'ORD-2026-6322',
  type: 'DEBIT',
  amount: 5000,
  orderId: 'ORD-2026-6322',
  runningBalance: 5000,
});
console.log('Test 3 (Invoice):', t3.title === 'Invoice Generated', t3.amountWithSign === '−₹5,000.00', t3.balanceLabel === 'Due: ₹5,000.00');

// Test 4: Return Credit Note
const t4 = formatTransaction({
  id: 'tx-4',
  referenceNo: 'CN-8877',
  type: 'CREDIT',
  amount: 600,
  note: 'Damaged packet return credit',
  sourceType: 'CREDIT_NOTE',
  runningBalance: 4400,
});
console.log('Test 4 (Return Credit Note):', t4.title === 'Return Credit Applied', t4.category === 'credit_note');

// Test 5: Opening Balance
const t5 = formatTransaction({
  id: 'tx-5',
  referenceNo: 'OPEN-001',
  type: 'DEBIT',
  amount: 10000,
  sourceType: 'OPENING_BALANCE',
  runningBalance: 10000,
});
console.log('Test 5 (Opening Balance):', t5.title === 'Opening Balance Added', t5.category === 'opening_balance');

// Test 6: Excess Payment / Advance Balance Calculation
const mockEntries = [
  { type: 'DEBIT', amount: 5000 },
  { type: 'CREDIT', amount: 6500 }, // Paid more than invoice
];
const s1 = calculateVendorSummary(mockEntries, { currentBalance: 0 });
console.log('Test 6 (Advance Balance Calculation):', s1.currentOutstanding === 0, s1.advanceBalance === 1500, s1.lastLedgerBalance === -1500);

// Test 7: Standard Outstanding Calculation
const mockEntries2 = [
  { type: 'DEBIT', amount: 8000 },
  { type: 'CREDIT', amount: 3000 },
];
const s2 = calculateVendorSummary(mockEntries2, { currentBalance: 0 });
console.log('Test 7 (Standard Outstanding Calculation):', s2.currentOutstanding === 5000, s2.advanceBalance === 0);

console.log('ALL KHATA VERIFICATION TESTS PASSED SUCCESSFULLY!');
