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
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { LedgerSummaryCard } from '../../components/ledger/LedgerSummaryCard';
import { LedgerRow } from '../../components/ledger/LedgerRow';
import { LedgerAdjustmentModal } from '../../components/ledger/LedgerAdjustmentModal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
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
  | 'PAYMENTS'
  | 'SETTINGS';

const TABS: { label: string; value: DetailTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Overview', value: 'OVERVIEW', icon: 'pie-chart-outline' },
  { label: 'Khata', value: 'LEDGER', icon: 'book-outline' },
  { label: 'Orders', value: 'ORDERS', icon: 'receipt-outline' },
  { label: 'Invoices', value: 'INVOICES', icon: 'document-text-outline' },
  { label: 'Payments', value: 'PAYMENTS', icon: 'cash-outline' },
  { label: 'Settings', value: 'SETTINGS', icon: 'settings-outline' },
];

export const VendorDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { vendorId } = route.params || {};
  const {
    getVendorById,
    updateVendorProfile,
    updateVendorStatus,
    recordDirectPayment,
  } = useVendorStore();
  const { getLedgerForParty, adjustLedgerManual, getVendorAccountSummary } =
    useLedgerStore();
  const { orders } = useOrderStore();
  const { currentUser } = useAuthStore();

  const vendor = getVendorById(vendorId) || {
    id: vendorId,
    name: 'Retailer',
    ownerName: 'Retailer',
    shopName: 'Vendor Shop',
    phone: '',
    email: '',
    address: '',
    area: '',
    currentBalance: 0,
    creditLimit: 0,
    paymentTerms: 'Net 15 Days',
    payLaterEligible: true,
    preferredPaymentMode: 'CASH' as const,
    status: 'ACTIVE' as VendorStatus,
  };

  const [activeTab, setActiveTab] = useState<DetailTab>('OVERVIEW');

  // Modals
  const [selectedLedgerEntry, setSelectedLedgerEntry] = useState<LedgerEntry | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<VendorStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // Live Async Data (Invoices & Payments)
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Sub-tab filters
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT' | 'ADJUSTMENT'>('ALL');
  const [orderFilter, setOrderFilter] = useState<'ALL' | OrderStatus>('ALL');

  // Settings Form
  const [editName, setEditName] = useState(vendor.name);
  const [editShopName, setEditShopName] = useState(vendor.shopName);
  const [editPhone, setEditPhone] = useState(vendor.phone);
  const [editEmail, setEditEmail] = useState(vendor.email || '');
  const [editAddress, setEditAddress] = useState(vendor.address || '');
  const [editArea, setEditArea] = useState(vendor.area || '');
  const [editPaymentTerms, setEditPaymentTerms] = useState(vendor.paymentTerms || 'Net 15 Days');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; isError: boolean } | null>(null);

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

  // Filtered Ledger Entries
  const filteredLedgerEntries = useMemo(() => {
    if (ledgerFilter === 'ALL') return ledgerEntries;
    if (ledgerFilter === 'DEBIT') return ledgerEntries.filter((e) => e.type === 'DEBIT');
    if (ledgerFilter === 'CREDIT') return ledgerEntries.filter((e) => e.type === 'CREDIT');
    if (ledgerFilter === 'ADJUSTMENT')
      return ledgerEntries.filter(
        (e) => e.sourceType === 'MANUAL_ADJUSTMENT' || !!e.editedAt
      );
    return ledgerEntries;
  }, [ledgerEntries, ledgerFilter]);

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

  const handleSaveManualAdjustment = (
    entryId: string,
    newAmount: number,
    reason: string
  ) => {
    adjustLedgerManual(
      entryId,
      newAmount,
      reason,
      currentUser?.name || 'Administrator'
    );
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await updateVendorProfile(
        vendor.id,
        {
          name: editName.trim(),
          ownerName: editName.trim(),
          shopName: editShopName.trim(),
          businessName: editShopName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          address: editAddress.trim(),
          area: editArea.trim(),
          paymentTerms: editPaymentTerms.trim(),
        },
        currentUser?.name || 'Admin'
      );
      setProfileMsg({ text: 'Vendor profile updated successfully.', isError: false });
    } catch (err: any) {
      setProfileMsg({ text: err.message || 'Failed to update profile.', isError: true });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleStatusChange = (newStatus: VendorStatus) => {
    setPendingStatusChange(newStatus);
    setStatusReason('');
    setShowStatusModal(true);
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    await updateVendorStatus(
      vendor.id,
      pendingStatusChange,
      statusReason.trim() || `Status updated to ${pendingStatusChange}`,
      currentUser?.name || 'Admin'
    );
    setShowStatusModal(false);
    setPendingStatusChange(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <Header
        title={vendor.shopName}
        subtitle={`${vendor.name || vendor.ownerName} · ${vendor.area || 'General Area'}`}
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
                  color={isSelected ? colors.primary : colors.textMuted}
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
                <View
                  style={[
                    styles.statusBadge,
                    vendor.status === 'ACTIVE'
                      ? styles.badgeActive
                      : vendor.status === 'ON_HOLD'
                      ? styles.badgeHold
                      : styles.badgeSuspended,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      vendor.status === 'ACTIVE'
                        ? { color: colors.brandGreen }
                        : vendor.status === 'ON_HOLD'
                        ? { color: '#7E22CE' }
                        : { color: colors.debit },
                    ]}
                  >
                    {vendor.status || 'ACTIVE'}
                  </Text>
                </View>
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

            {/* Financial & Activity 2x2 Grid */}
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

              <View style={styles.metricTile}>
                <Text style={styles.metricTileLabel}>Payment Terms</Text>
                <Text style={[styles.metricTileVal, { fontSize: 13 }]}>
                  {vendor.paymentTerms || 'Net 15 Days'}
                </Text>
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

              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoVal}>{vendor.email || 'Not provided'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Market Area</Text>
                <Text style={styles.infoVal}>{vendor.area || 'General Area'}</Text>
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
              currentBalance={runningBalance}
              totalGave={totalInvoiced}
              totalGot={totalPaid}
              partyName={`${vendor.shopName} Khata`}
              debitLabel="Total Invoiced"
              creditLabel="Total Collected"
            />

            {/* Filter Chips */}
            <View style={styles.subFilterRow}>
              {(['ALL', 'DEBIT', 'CREDIT', 'ADJUSTMENT'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.subFilterChip, ledgerFilter === f && styles.subFilterChipActive]}
                  onPress={() => setLedgerFilter(f)}
                >
                  <Text
                    style={[
                      styles.subFilterText,
                      ledgerFilter === f && styles.subFilterTextActive,
                    ]}
                  >
                    {f === 'ALL'
                      ? 'All'
                      : f === 'DEBIT'
                      ? 'Invoices'
                      : f === 'CREDIT'
                      ? 'Payments'
                      : 'Adjustments'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredLedgerEntries.map((entry) => (
              <LedgerRow
                key={entry.id}
                entry={entry}
                perspective="ADMIN"
                onPress={() => {
                  setSelectedLedgerEntry(entry);
                  setShowLedgerModal(true);
                }}
              />
            ))}

            {filteredLedgerEntries.length === 0 && (
              <EmptyState
                iconName="book-outline"
                title="No Khata entries"
                description="Invoices and offline payment vouchers will appear here automatically."
              />
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 3: ORDERS                                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'ORDERS' && (
          <View>
            <View style={styles.subFilterRow}>
              {(['ALL', 'PENDING', 'APPROVED', 'DELIVERED', 'CANCELLED'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.subFilterChip, orderFilter === st && styles.subFilterChipActive]}
                  onPress={() => setOrderFilter(st)}
                >
                  <Text
                    style={[styles.subFilterText, orderFilter === st && styles.subFilterTextActive]}
                  >
                    {st === 'ALL' ? 'All Orders' : st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredOrders.map((ord) => (
              <Card
                key={ord.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('AdminOrderDetail', { orderId: ord.id })}
                outlined
                elevation="sm"
              >
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNum}>{ord.orderNumber}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(ord.orderDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      ord.status === 'DELIVERED'
                        ? styles.pillDelivered
                        : ord.status === 'PENDING'
                        ? styles.pillPending
                        : styles.pillDefault,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        ord.status === 'DELIVERED'
                          ? { color: colors.brandGreen }
                          : ord.status === 'PENDING'
                          ? { color: '#B45309' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {ord.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDivider} />

                <View style={styles.orderFooter}>
                  <Text style={styles.orderItemsCount}>
                    {ord.items?.length || 0} item{ord.items?.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.orderTotal}>₹{fmt(ord.totalAmount)}</Text>
                </View>
              </Card>
            ))}

            {filteredOrders.length === 0 && (
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
              invoices.map((inv) => (
                <Card key={inv.id} style={styles.invoiceCard} outlined elevation="sm">
                  <View style={styles.invHeader}>
                    <View>
                      <Text style={styles.invNum}>{inv.invoiceNumber}</Text>
                      <Text style={styles.invDate}>
                        {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        inv.status === 'PAID'
                          ? styles.pillDelivered
                          : inv.status === 'PARTIALLY_PAID'
                          ? styles.pillPending
                          : styles.pillDanger,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          inv.status === 'PAID'
                            ? { color: colors.brandGreen }
                            : inv.status === 'PARTIALLY_PAID'
                            ? { color: '#B45309' }
                            : { color: colors.debit },
                        ]}
                      >
                        {inv.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderDivider} />

                  <View style={styles.invRow}>
                    <Text style={styles.invLabel}>Invoice Total</Text>
                    <Text style={styles.invVal}>₹{fmt(inv.totalAmount)}</Text>
                  </View>
                  <View style={styles.invRow}>
                    <Text style={styles.invLabel}>Amount Paid</Text>
                    <Text style={[styles.invVal, { color: colors.brandGreen }]}>
                      ₹{fmt(inv.paidAmount)}
                    </Text>
                  </View>
                  <View style={styles.invRow}>
                    <Text style={styles.invLabel}>Balance Due</Text>
                    <Text
                      style={[
                        styles.invVal,
                        inv.balanceDue > 0 ? { color: colors.debit } : { color: colors.textMuted },
                      ]}
                    >
                      ₹{fmt(inv.balanceDue)}
                    </Text>
                  </View>
                </Card>
              ))
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

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 6: SETTINGS & STATUS                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'SETTINGS' && (
          <View>
            {profileMsg ? (
              <Text
                style={[
                  styles.formMsgText,
                  profileMsg.isError ? styles.formMsgError : styles.formMsgSuccess,
                ]}
              >
                {profileMsg.text}
              </Text>
            ) : null}

            <Card style={styles.settingsCard} outlined elevation="sm">
              <Text style={styles.settingsCardTitle}>Edit Vendor Information</Text>

              <Input label="Shop / Business Name *" value={editShopName} onChangeText={setEditShopName} />
              <Input label="Proprietor / Owner Name *" value={editName} onChangeText={setEditName} />
              <Input label="Phone Number *" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
              <Input label="Email Address" value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
              <Input label="Market Area / Locality" value={editArea} onChangeText={setEditArea} />
              <Input label="Full Address" value={editAddress} onChangeText={setEditAddress} />
              <Input label="Payment Terms" value={editPaymentTerms} onChangeText={setEditPaymentTerms} />

              <Button
                title="Save Profile Changes"
                onPress={handleSaveProfile}
                loading={savingProfile}
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            <Card style={[styles.settingsCard, { marginTop: spacing.md }]} outlined elevation="sm">
              <Text style={styles.settingsCardTitle}>Account Status Controls</Text>
              
              <View style={styles.statusActionCol}>
                <TouchableOpacity
                  style={[styles.statusBtn, vendor.status === 'ACTIVE' && styles.statusBtnActive]}
                  onPress={() => handleStatusChange('ACTIVE')}
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.brandGreen} />
                  <Text style={styles.statusBtnLabel}>Activate Partner</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusBtn, vendor.status === 'ON_HOLD' && styles.statusBtnActive]}
                  onPress={() => handleStatusChange('ON_HOLD')}
                >
                  <Ionicons name="pause-circle" size={18} color="#B45309" />
                  <Text style={styles.statusBtnLabel}>Put Account On Hold</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusBtn, vendor.status === 'SUSPENDED' && styles.statusBtnActive]}
                  onPress={() => handleStatusChange('SUSPENDED')}
                >
                  <Ionicons name="ban" size={18} color={colors.debit} />
                  <Text style={[styles.statusBtnLabel, { color: colors.debit }]}>
                    Suspend Account
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Ledger Adjustment Modal ────────────────────────────────── */}
      <LedgerAdjustmentModal
        visible={showLedgerModal}
        entry={selectedLedgerEntry}
        onClose={() => setShowLedgerModal(false)}
        onSave={handleSaveManualAdjustment}
      />

      {/* ── Record Payment Modal ───────────────────────────────────── */}
      <RecordPaymentModal
        visible={showPaymentModal}
        vendor={vendor}
        onClose={() => setShowPaymentModal(false)}
        onSave={async (params) => {
          await recordDirectPayment({
            ...params,
            adminName: currentUser?.name || 'Administrator',
          });
        }}
      />

      {/* ── Status Change Confirmation Modal ───────────────────────── */}
      <ConfirmationModal
        visible={showStatusModal}
        title="Change Vendor Status"
        message={`Update ${vendor.shopName} account status to ${pendingStatusChange}.`}
        confirmTitle="Confirm Change"
        variant={pendingStatusChange === 'SUSPENDED' ? 'danger' : 'primary'}
        onConfirm={confirmStatusChange}
        onCancel={() => setShowStatusModal(false)}
      >
        <Input
          label="Reason for Status Change (Optional)"
          value={statusReason}
          onChangeText={setStatusReason}
          multiline
          numberOfLines={2}
          containerStyle={{ marginTop: spacing.sm }}
        />
      </ConfirmationModal>
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
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
  },
  tabBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.primary,
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
    marginBottom: spacing.sm,
  },
  subFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
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

  // Orders Tab
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderNum: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  orderDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusFull,
  },
  pillDelivered: {
    backgroundColor: colors.brandGreenLight,
  },
  pillPending: {
    backgroundColor: '#FEF3C7',
  },
  pillDanger: {
    backgroundColor: colors.debitLight,
  },
  pillDefault: {
    backgroundColor: colors.surfaceSubtle,
  },
  statusPillText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  orderDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderItemsCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  orderTotal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },

  // Invoices Tab
  invoiceCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  invHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invNum: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  invDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  invLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  invVal: {
    ...typography.captionBold,
    fontSize: 13,
    color: colors.textPrimary,
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
