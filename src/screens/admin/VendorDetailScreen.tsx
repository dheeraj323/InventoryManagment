import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorStore } from '../../store/useVendorStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { invoiceService } from '../../services/invoiceService';
import { paymentService } from '../../services/paymentService';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LedgerSummaryCard } from '../../components/ledger/LedgerSummaryCard';
import { LedgerRow } from '../../components/ledger/LedgerRow';
import { TransactionDetailModal } from '../../components/ledger/TransactionDetailModal';
import { formatTransaction } from '../../utils/transactionFormatter';
import { RecordPaymentModal } from '../../components/vendor/RecordPaymentModal';
import {
  Vendor,
  VendorStatus,
  LedgerEntry,
  Invoice,
  Payment,
  Order,
  OrderStatus,
} from '../../types';
import { colors, typography, spacing } from '../../theme';

type DetailTab =
  | 'OVERVIEW'
  | 'LEDGER'
  | 'ORDERS'
  | 'INVOICES'
  | 'PAYMENTS';

const TABS: { label: string; value: DetailTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Overview', value: 'OVERVIEW', icon: 'pie-chart-outline' },
  { label: 'Khata', value: 'LEDGER', icon: 'book-outline' },
  { label: 'Orders', value: 'ORDERS', icon: 'receipt-outline' },
  { label: 'Invoices', value: 'INVOICES', icon: 'document-text-outline' },
  { label: 'Payments', value: 'PAYMENTS', icon: 'cash-outline' },
];

export const VendorDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { vendorId, initialTab } = route.params || {};
  const {
    getVendorById,
    recordDirectPayment,
  } = useVendorStore();
  const { getLedgerForParty, getVendorAccountSummary } =
    useLedgerStore();
  const { orders } = useOrderStore();
  const { currentUser } = useAuthStore();

  const vendor = getVendorById(vendorId) || {
    id: vendorId,
    name: 'Retailer',
    ownerName: 'Retailer',
    shopName: 'Vendor Shop',
    phone: '',
    address: '',
    currentBalance: 0,
    creditLimit: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'CASH' as const,
    status: 'ACTIVE' as VendorStatus,
  };

  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab || 'OVERVIEW');

  // Sync activeTab when navigating with a different initialTab param (e.g. from Finance screen)
  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Live Async Data (Invoices & Payments)
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Sub-tab filters
  type LedgerCategoryFilter = 'ALL' | 'INVOICES' | 'PAYMENTS' | 'CREDITS' | 'ADJUSTMENTS';
  type LedgerDateFilter = 'ALL_TIME' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<LedgerCategoryFilter>('ALL');
  const [ledgerDateFilter, setLedgerDateFilter] = useState<LedgerDateFilter>('ALL_TIME');
  const [selectedTransaction, setSelectedTransaction] = useState<LedgerEntry | null>(null);
  const [orderFilter, setOrderFilter] = useState<'ALL' | OrderStatus>('ALL');

  // Fetch Invoices & Payments for this vendor
  useEffect(() => {
    if (vendorId) {
      setLoadingInvoices(true);
      const unsubInvoices = invoiceService.subscribeVendorInvoices(vendorId, (invs) => {
        setInvoices(invs);
        setLoadingInvoices(false);
      });

      const unsubPayments = paymentService.subscribeVendorPayments(vendorId, (pmts) => {
        setPayments(pmts);
      });

      return () => {
        unsubInvoices();
        unsubPayments();
      };
    }
  }, [vendorId]);

  // Derived Financials & Summaries
  const summary = useMemo(() => {
    return getVendorAccountSummary(vendor.id, vendor);
  }, [getVendorAccountSummary, vendor]);

  const ledgerEntries = useMemo(() => {
    return getLedgerForParty(vendor.id);
  }, [getLedgerForParty, vendor.id]);

  const totalInvoiced = useMemo(() => {
    return ledgerEntries
      .filter((e) => e.type === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [ledgerEntries]);

  const totalPaid = useMemo(() => {
    return ledgerEntries
      .filter((e) => e.type === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [ledgerEntries]);

  const runningBalance = summary.currentOutstanding;

  // Vendor's Orders
  const vendorOrders = useMemo(() => {
    return orders.filter((o) => o.vendorId === vendor.id);
  }, [orders, vendor.id]);

  // Filtered Ledger Entries with Category & Date Filters
  const filteredLedgerEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      const formatted = formatTransaction(entry, 'ADMIN');

      // Category filter
      if (ledgerCategoryFilter === 'INVOICES') {
        if (formatted.category !== 'invoice') return false;
      } else if (ledgerCategoryFilter === 'PAYMENTS') {
        if (formatted.category !== 'payment') return false;
      } else if (ledgerCategoryFilter === 'CREDITS') {
        if (formatted.category !== 'credit_note' && formatted.category !== 'refund') return false;
      } else if (ledgerCategoryFilter === 'ADJUSTMENTS') {
        if (formatted.category !== 'adjustment' && formatted.category !== 'opening_balance') return false;
      }

      // Date filter
      if (ledgerDateFilter !== 'ALL_TIME') {
        const entryTime = new Date(entry.date || entry.createdAt || 0).getTime();
        const now = new Date();

        if (ledgerDateFilter === 'TODAY') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (entryTime < startOfToday) return false;
        } else if (ledgerDateFilter === 'THIS_WEEK') {
          const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
          if (entryTime < sevenDaysAgo) return false;
        } else if (ledgerDateFilter === 'THIS_MONTH') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          if (entryTime < startOfMonth) return false;
        }
      }

      return true;
    });
  }, [ledgerEntries, ledgerCategoryFilter, ledgerDateFilter]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'ALL') return vendorOrders;
    return vendorOrders.filter((o) => o.status === orderFilter);
  }, [vendorOrders, orderFilter]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call');
    });
  };

  const handleWhatsApp = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    const url = `whatsapp://send?phone=${clean}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) Linking.openURL(url);
        else Linking.openURL(`https://wa.me/${clean}`);
      })
      .catch(() => Linking.openURL(`https://wa.me/${clean}`));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <Header
        title={vendor.shopName}
        subtitle={vendor.name || vendor.ownerName || 'Retail Partner'}
        showBack
        onBackPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('VendorList');
          }
        }}
        rightAction={
          <View style={styles.headerRightRow}>
            {Boolean(vendor.phone) && (
              <>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => handleCall(vendor.phone)}
                >
                  <Ionicons name="call-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => handleWhatsApp(vendor.phone)}
                >
                  <Ionicons name="logo-whatsapp" size={17} color={colors.brandGreen} />
                </TouchableOpacity>
              </>
            )}
          </View>
        }
      />

      {/* ── Tab Selector Bar ──────────────────────────────────────── */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isSelected ? colors.textInverse : colors.textMuted}
                />
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'OVERVIEW' && (
          <View>
            {/* Balance Overview Card */}
            <View style={styles.balanceHeroCard}>
              <View style={styles.heroTop}>
                <Text style={styles.heroSubtitle}>Outstanding Receivable</Text>
              </View>

              <Text
                style={[
                  styles.heroBalanceAmount,
                  runningBalance > 0 ? { color: colors.brandGreen } : { color: colors.textSecondary },
                ]}
              >
                ₹{fmt(runningBalance)}
              </Text>

              <Text style={styles.heroHelperText}>
                {runningBalance > 0
                  ? 'Net amount to be collected from retailer'
                  : runningBalance < 0
                  ? 'Advance payment on account'
                  : 'Account fully settled (Zero pending dues)'}
              </Text>

              <TouchableOpacity
                style={styles.heroPayBtn}
                onPress={() => setShowPaymentModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="cash-outline" size={17} color={colors.textInverse} />
                <Text style={styles.heroPayBtnText}>Record Payment</Text>
              </TouchableOpacity>
            </View>

            {/* Financial & Activity Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricTile}>
                <Text style={styles.metricTileLabel}>Total Purchases</Text>
                <Text style={styles.metricTileVal}>₹{fmt(totalInvoiced)}</Text>
              </View>

              <View style={styles.metricTile}>
                <Text style={styles.metricTileLabel}>Total Collected</Text>
                <Text style={[styles.metricTileVal, { color: colors.brandGreen }]}>
                  ₹{fmt(totalPaid)}
                </Text>
              </View>

              <View style={styles.metricTile}>
                <Text style={styles.metricTileLabel}>Orders Placed</Text>
                <Text style={styles.metricTileVal}>{vendorOrders.length}</Text>
              </View>
            </View>

            {/* Business Contact Card */}
            <Card style={styles.infoCard} outlined elevation="sm">
              <Text style={styles.infoCardTitle}>Business Details</Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Proprietor</Text>
                <Text style={styles.infoVal}>{vendor.name || vendor.ownerName || 'Not specified'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoVal}>{vendor.phone || 'Not provided'}</Text>
              </View>

              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="map-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoVal}>{vendor.address || 'Not provided'}</Text>
              </View>
            </Card>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 2: LEDGER (KHATA)                                       */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'LEDGER' && (
          <View>
            <LedgerSummaryCard
              currentOutstanding={summary.currentOutstanding}
              advanceBalance={summary.advanceBalance}
              currentBalance={summary.lastLedgerBalance}
              totalInvoiced={summary.totalDebits}
              paymentsReceived={summary.totalCredits}
              overdueAmount={summary.overdueAmount}
              partyName={`${vendor.shopName} Khata`}
              perspective="ADMIN"
            />

            {/* Category Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryFilterScroll}
              style={{ marginBottom: spacing.sm }}
            >
              {(
                [
                  { key: 'ALL', label: 'All' },
                  { key: 'INVOICES', label: 'Invoices' },
                  { key: 'PAYMENTS', label: 'Payments' },
                  { key: 'CREDITS', label: 'Credits' },
                  { key: 'ADJUSTMENTS', label: 'Adjustments' },
                ] as const
              ).map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.subFilterChip,
                    ledgerCategoryFilter === f.key && styles.subFilterChipActive,
                  ]}
                  onPress={() => setLedgerCategoryFilter(f.key)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.subFilterText,
                      ledgerCategoryFilter === f.key && styles.subFilterTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Transactions Section */}
            {filteredLedgerEntries.length > 0 ? (
              <View style={styles.transactionsContainer}>
                <View style={styles.transactionsHeader}>
                  <Text style={styles.transactionsTitle}>
                    TRANSACTIONS ({filteredLedgerEntries.length})
                  </Text>
                  <TouchableOpacity
                    style={styles.dateCycleBtn}
                    onPress={() => {
                      const dates: LedgerDateFilter[] = [
                        'ALL_TIME',
                        'TODAY',
                        'THIS_WEEK',
                        'THIS_MONTH',
                      ];
                      const nextIdx = (dates.indexOf(ledgerDateFilter) + 1) % dates.length;
                      setLedgerDateFilter(dates[nextIdx]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.dateCycleText}>
                      {ledgerDateFilter === 'ALL_TIME'
                        ? 'All Time'
                        : ledgerDateFilter === 'TODAY'
                        ? 'Today'
                        : ledgerDateFilter === 'THIS_WEEK'
                        ? 'This Week'
                        : 'This Month'}
                    </Text>
                    <Ionicons name="chevron-down" size={10} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.transactionCardGroup}>
                  {filteredLedgerEntries.map((entry) => (
                    <LedgerRow
                      key={entry.id}
                      entry={entry}
                      perspective="ADMIN"
                      onPress={() => setSelectedTransaction(entry)}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <EmptyState
                iconName="book-outline"
                title="No matching transactions"
                description="No transactions found for the selected filter."
              />
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 3: ORDERS                                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'ORDERS' && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryFilterScroll}
              style={{ marginBottom: spacing.sm }}
            >
              {(['ALL', 'PENDING', 'APPROVED', 'DELIVERED', 'CANCELLED'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.subFilterChip, orderFilter === st && styles.subFilterChipActive]}
                  onPress={() => setOrderFilter(st)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.subFilterText, orderFilter === st && styles.subFilterTextActive]}
                  >
                    {st === 'ALL'
                      ? 'All'
                      : st === 'PENDING'
                      ? 'Pending'
                      : st === 'APPROVED'
                      ? 'Confirmed'
                      : st === 'DELIVERED'
                      ? 'Delivered'
                      : 'Cancelled'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredOrders.length > 0 ? (
              <View style={styles.transactionCardGroup}>
                {filteredOrders.map((ord) => {
                  let orderTitle = 'General Order';
                  if (ord.items && ord.items.length > 0) {
                    const firstItem = ord.items[0].productName;
                    if (ord.items.length === 1) {
                      orderTitle = `${firstItem} (${ord.items[0].orderedQty || ord.items[0].deliveredQty || 1} units)`;
                    } else if (ord.items.length === 2) {
                      orderTitle = `${firstItem} & ${ord.items[1].productName}`;
                    } else {
                      orderTitle = `${firstItem} + ${ord.items.length - 1} more`;
                    }
                  }

                  const dateFormatted = new Date(
                    ord.orderDate || ord.createdAt || Date.now()
                  ).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  const isDelivered = ord.status === 'DELIVERED';
                  const isPending = ord.status === 'PENDING';
                  const isCancelled = ord.status === 'CANCELLED';

                  const statusLabel = isDelivered
                    ? 'Delivered'
                    : isPending
                    ? 'Pending'
                    : ord.status === 'APPROVED'
                    ? 'Confirmed'
                    : isCancelled
                    ? 'Cancelled'
                    : ord.status;

                  const statusColor = isDelivered
                    ? colors.brandGreen
                    : isPending
                    ? '#B45309'
                    : isCancelled
                    ? colors.debit
                    : colors.primary;

                  const statusBg = isDelivered
                    ? colors.brandGreenLight
                    : isPending
                    ? '#FEF3C7'
                    : isCancelled
                    ? colors.debitLight
                    : colors.surfaceSubtle;

                  const statusIcon = isDelivered
                    ? 'checkmark-circle-outline'
                    : isPending
                    ? 'time-outline'
                    : isCancelled
                    ? 'close-circle-outline'
                    : 'cube-outline';

                  return (
                    <TouchableOpacity
                      key={ord.id}
                      style={styles.orderListItem}
                      onPress={() =>
                        navigation.navigate('AdminOrderDetail', {
                          orderId: ord.id,
                          hideVendorProfile: true,
                        })
                      }
                      activeOpacity={0.65}
                    >
                      <View style={[styles.orderIconBox, { backgroundColor: statusBg }]}>
                        <Ionicons name={statusIcon as any} size={17} color={statusColor} />
                      </View>

                      <View style={styles.orderItemContent}>
                        <View style={styles.orderItemRowTop}>
                          <Text style={styles.orderItemTitle} numberOfLines={1}>
                            {orderTitle}
                          </Text>
                          <Text style={styles.orderItemAmount}>₹{fmt(ord.totalAmount)}</Text>
                        </View>

                        <View style={styles.orderItemRowBottom}>
                          <Text style={styles.orderItemMeta} numberOfLines={1}>
                            {dateFormatted}  •  {ord.items?.length || 0} item
                            {ord.items?.length !== 1 ? 's' : ''}
                          </Text>
                          <Text style={[styles.orderStatusBadge, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                iconName="receipt-outline"
                title="No orders found"
                description="This vendor has not placed any orders matching the filter."
              />
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 4: INVOICES                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'INVOICES' && (
          <View>
            {loadingInvoices ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            ) : invoices.length > 0 ? (
              <View style={styles.transactionCardGroup}>
                {invoices.map((inv) => {
                  const dateFormatted = new Date(
                    inv.invoiceDate || inv.createdAt || Date.now()
                  ).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  const isPaid = inv.status === 'PAID';
                  const isPartial = inv.status === 'PARTIALLY_PAID';

                  const statusLabel = isPaid
                    ? 'Paid'
                    : isPartial
                    ? 'Partially Paid'
                    : 'Balance Due';

                  const statusColor = isPaid
                    ? colors.brandGreen
                    : isPartial
                    ? '#B45309'
                    : colors.debit;

                  const statusBg = isPaid
                    ? colors.brandGreenLight
                    : isPartial
                    ? '#FEF3C7'
                    : colors.debitLight;

                  return (
                    <View key={inv.id} style={styles.orderListItem}>
                      <View style={[styles.orderIconBox, { backgroundColor: statusBg }]}>
                        <Ionicons
                          name={isPaid ? 'document-text' : 'receipt-outline'}
                          size={17}
                          color={statusColor}
                        />
                      </View>

                      <View style={styles.orderItemContent}>
                        <View style={styles.orderItemRowTop}>
                          <Text style={styles.orderItemTitle} numberOfLines={1}>
                            Tax Invoice ({inv.lineItems?.length || 1} item{inv.lineItems?.length !== 1 ? 's' : ''})
                          </Text>
                          <Text style={styles.orderItemAmount}>₹{fmt(inv.totalAmount)}</Text>
                        </View>

                        <View style={styles.orderItemRowBottom}>
                          <Text style={styles.orderItemMeta} numberOfLines={1}>
                            {dateFormatted}  •  {isPaid ? 'Fully Settled' : `Due: ₹${fmt(inv.balanceDue)}`}
                          </Text>
                          <Text style={[styles.orderStatusBadge, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                iconName="document-text-outline"
                title="No formal invoices"
                description="Invoices are generated upon successful order deliveries."
              />
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 5: PAYMENTS                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'PAYMENTS' && (
          <View>
            <TouchableOpacity
              style={styles.recordPaymentBtn}
              onPress={() => setShowPaymentModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={styles.recordPaymentBtnText}>Record Offline Payment</Text>
            </TouchableOpacity>

            {payments.map((pmt) => (
              <Card key={pmt.id} style={styles.paymentCard} outlined elevation="sm">
                <View style={styles.pmtHeader}>
                  <View style={styles.pmtIconWrap}>
                    <Ionicons name="cash-outline" size={17} color={colors.brandGreen} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.pmtAmount}>₹{fmt(pmt.amount)}</Text>
                    <Text style={styles.pmtMode}>
                      {pmt.paymentMode} {pmt.referenceNumber ? `· Ref: ${pmt.referenceNumber}` : ''}
                    </Text>
                  </View>
                  <View style={styles.pmtVerifiedBadge}>
                    <Text style={styles.pmtVerifiedText}>
                      {pmt.verificationStatus || 'VERIFIED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.pmtFooter}>
                  <Text style={styles.pmtDate}>
                    {new Date(pmt.paymentDate || pmt.createdAt || 0).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.pmtCollector}>By: {pmt.collectedBy || 'Admin'}</Text>
                </View>
              </Card>
            ))}

            {payments.length === 0 && (
              <EmptyState
                iconName="cash-outline"
                title="No payments recorded"
                description="Record cash, UPI, or bank transfer payments directly here."
              />
            )}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Record Payment Modal ───────────────────────────────────── */}
      <RecordPaymentModal
        visible={showPaymentModal}
        vendor={vendor}
        dueAmount={runningBalance}
        onClose={() => setShowPaymentModal(false)}
        onSave={async (params) => {
          await recordDirectPayment({
            ...params,
            adminName: currentUser?.name || 'Administrator',
          });
        }}
      />

      {/* ── Transaction Details Modal ─────────────────────────────── */}
      <TransactionDetailModal
        visible={Boolean(selectedTransaction)}
        entry={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        perspective="ADMIN"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBarContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabScroll: {
    paddingHorizontal: spacing.screenPadding,
    gap: 6,
    paddingVertical: spacing.xs,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Overview Tab
  balanceHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroSubtitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusFull,
  },
  badgeActive: {
    backgroundColor: colors.brandGreenLight,
  },
  badgeHold: {
    backgroundColor: '#F3E8FF',
  },
  badgeSuspended: {
    backgroundColor: colors.debitLight,
  },
  statusBadgeText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  heroBalanceAmount: {
    ...typography.h1,
    fontSize: 28,
    marginTop: 4,
  },
  heroHelperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  heroPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandGreen,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    gap: 6,
  },
  heroPayBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  metricTile: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricTileLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  metricTileVal: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoCardTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 90,
  },
  infoVal: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },

  // Sub-filter Row
  subFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  subFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subFilterText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  subFilterTextActive: {
    color: colors.textInverse,
  },

  // Khata Styles
  categoryFilterScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  transactionsContainer: {
    marginTop: spacing.xs,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
    paddingHorizontal: 2,
  },
  transactionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  dateCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusFull,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateCycleText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textSecondary,
  },
  transactionCardGroup: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  // Orders Tab
  orderListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  orderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  orderItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  orderItemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  orderItemTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    flex: 1,
    marginRight: spacing.sm,
  },
  orderItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  orderItemRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderItemMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
    marginRight: spacing.sm,
  },
  orderStatusBadge: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },

  // Payments Tab
  recordPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandGreen,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    gap: 6,
    marginBottom: spacing.md,
  },
  recordPaymentBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 13,
  },
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pmtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pmtIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pmtAmount: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pmtMode: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  pmtVerifiedBadge: {
    backgroundColor: colors.brandGreenLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusFull,
  },
  pmtVerifiedText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 10,
  },
  pmtFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  pmtDate: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  pmtCollector: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },

  // Settings Tab
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsCardTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  formMsgText: {
    ...typography.captionBold,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.sm,
  },
  formMsgSuccess: {
    color: colors.brandGreen,
    backgroundColor: colors.brandGreenLight,
  },
  formMsgError: {
    color: colors.debit,
    backgroundColor: colors.debitLight,
  },
  statusActionCol: {
    gap: 8,
    marginTop: spacing.xs,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm + 2,
    borderRadius: spacing.borderRadiusMd,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBtnActive: {
    borderColor: colors.primary,
  },
  statusBtnLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
});
