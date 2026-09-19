export const BUSINESS_RULES = {
  TAX_RATE: 0.05, // 5% GST/Tax
};

export const PAYMENT_METHOD_LABELS = {
  CASH: 'Cash',
  ONLINE: 'Online / UPI',
  PAY_LATER: 'Pay Later',
  PARTIALLY_PAID: 'Partially Paid',
  PENDING: 'Payment Pending',
};

export const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'Pending Approval', color: '#F59E0B', bg: '#FEF3C7' },
  APPROVED: { label: 'Approved', color: '#2563EB', bg: '#DBEAFE' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: '#8B5CF6', bg: '#F3E8FF' },
  DELIVERED: { label: 'Delivered', color: '#16A34A', bg: '#DCFCE7' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered', color: '#D97706', bg: '#FFEDD5' },
  CANCELLED: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2' },
};
