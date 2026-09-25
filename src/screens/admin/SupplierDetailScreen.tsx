import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useSupplierBillStore } from '../../store/useSupplierBillStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Supplier, SupplierBill } from '../../types';
import { colors, typography, spacing } from '../../theme';

type TabType = 'OVERVIEW' | 'BILLS';
type FilterType = 'ALL' | 'THIS_MONTH' | 'THIS_YEAR' | 'PAID' | 'PENDING';
type SortType = 'NEWEST' | 'OLDEST' | 'HIGHEST_AMOUNT' | 'LOWEST_AMOUNT';

export const SupplierDetailScreen: React.FC<{ route: any; navigation: any }> = ({ navigation, route }) => {
  const { supplierId, initialTab = 'OVERVIEW' } = route.params || {};

  const { suppliers, updateSupplier, adjustSupplierPayable, deleteSupplier } = useInventoryStore();
  const {
    bills,
    subscribeSupplierBills,
    fetchSupplierBills,
    getSupplierStats,
  } = useSupplierBillStore();


  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [sortBy, setSortBy] = useState<SortType>('NEWEST');
  const [showSortModal, setShowSortModal] = useState(false);

  // Supplier Actions Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Edit Supplier Form
  const [editName, setEditName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Current Supplier
  const supplier: Supplier | undefined = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId || s.supplierId === supplierId);
  }, [suppliers, supplierId]);

  // Real-time subscription for supplier's bills
  useEffect(() => {
    if (!supplierId) return;
    const unsubscribe = subscribeSupplierBills(supplierId);
    return () => unsubscribe();
  }, [supplierId]);

  const supplierBills = useMemo(() => {
    return (bills[supplierId] || []).filter((b) => !b.isDeleted);
  }, [bills, supplierId]);

  const stats = useMemo(() => {
    return getSupplierStats(supplierId, supplier?.balancePayable || 0);
  }, [bills, supplierId, supplier?.balancePayable]);

  const onRefresh = async () => {

    setRefreshing(true);
    try {
      await fetchSupplierBills(supplierId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call');
    });
  };

  const handleEmail = (emailAddress?: string) => {
    if (!emailAddress) return;
    Linking.openURL(`mailto:${emailAddress}`).catch(() => {
      Alert.alert('Error', 'Unable to open mail client');
    });
  };

  const openEditModal = () => {
    if (!supplier) return;
    setEditName(supplier.name);
    setEditContact(supplier.contactPerson || '');
    setEditPhone(supplier.phone || '');
    setEditEmail(supplier.email || '');
    setEditCategory(supplier.category || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Supplier name is required');
      return;
    }
    setEditLoading(true);
    try {
      await updateSupplier(supplierId, {
        name: editName.trim(),
        businessName: editName.trim(),
        contactPerson: editContact.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        category: editCategory.trim() || 'General',
      });
      setShowEditModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update supplier');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    const num = parseFloat(paymentAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }
    setPaymentLoading(true);
    try {
      await adjustSupplierPayable(
        supplierId,
        num,
        'RECORD_PAYMENT',
        paymentNotes.trim() || 'Payment made to supplier'
      );
      setPaymentAmount('');
      setPaymentNotes('');
      setShowPaymentModal(false);
      Alert.alert('Payment Recorded', `Payment of ₹${num.toLocaleString('en-IN')} recorded successfully.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteSupplier(supplierId);
      setShowDeleteModal(false);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete supplier');
    }
  };

  // Filtered and Sorted Bills
  const filteredBills = useMemo(() => {
    let list = [...supplierBills];
    const q = searchQuery.trim().toLowerCase();

    // 1. Search Query
    if (q) {
      list = list.filter((b) => {
        const invMatch = (b.invoiceNumber || '').toLowerCase().includes(q);
        const notesMatch = (b.notes || '').toLowerCase().includes(q);
        const dateMatch = (b.billDate || '').includes(q);
        const prodMatch = (b.items || []).some((item) =>
          (item.productName || '').toLowerCase().includes(q)
        );
        return invMatch || notesMatch || dateMatch || prodMatch;
      });
    }

    // 2. Preset Filter
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (activeFilter === 'THIS_MONTH') {
      list = list.filter((b) => (b.billDate || '').startsWith(currentMonth));
    } else if (activeFilter === 'THIS_YEAR') {
      list = list.filter((b) => (b.billDate || '').startsWith(currentYear));
    } else if (activeFilter === 'PAID') {
      list = list.filter((b) => b.paymentStatus === 'PAID');
    } else if (activeFilter === 'PENDING') {
      list = list.filter((b) => b.paymentStatus === 'PENDING' || b.paymentStatus === 'PARTIALLY_PAID');
    }

    // 3. Sorting
    list.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        const dateDiff = (b.billDate || '').localeCompare(a.billDate || '');
        if (dateDiff !== 0) return dateDiff;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (sortBy === 'OLDEST') {
        const dateDiff = (a.billDate || '').localeCompare(b.billDate || '');
        if (dateDiff !== 0) return dateDiff;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      }
      if (sortBy === 'HIGHEST_AMOUNT') {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (sortBy === 'LOWEST_AMOUNT') {
        return (a.totalAmount || 0) - (b.totalAmount || 0);
      }
      return 0;
    });

    return list;
  }, [supplierBills, searchQuery, activeFilter, sortBy]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!supplier) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Supplier Details" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.notFoundWrap}>
          <Ionicons name="business-outline" size={48} color={colors.textMuted} />
          <Text style={styles.notFoundText}>Supplier not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const balance = supplier.balancePayable || 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <Header
        title={supplier.name}
        subtitle={supplier.category ? `${supplier.category} Supplier` : 'Supplier Cockpit'}
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerRightRow}>
            {supplier.phone ? (
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => handleCall(supplier.phone)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="call" size={18} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={openEditModal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={19} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── Financial Cockpit Hero Card ────────────────────────────── */}
      <View style={styles.heroSection}>
        <View style={styles.heroMainRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBalanceLabel}>OUTSTANDING PAYABLE</Text>
            <Text
              style={[
                styles.heroBalanceAmount,
                balance > 0 ? { color: colors.debit } : { color: colors.brandGreen },
              ]}
            >
              ₹{fmt(balance)}
            </Text>
            <Text style={styles.heroStatusSub}>
              {balance > 0
                ? 'Pending balance owed to supplier'
                : 'Account fully settled (Zero pending dues)'}
            </Text>
          </View>

          {supplier.phone ? (
            <TouchableOpacity
              style={styles.quickCallPill}
              onPress={() => handleCall(supplier.phone)}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={14} color={colors.textInverse} />
              <Text style={styles.quickCallPillText}>Call</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 3 Metrics Strip */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Total Purchases</Text>
            <Text style={styles.metricValue}>₹{fmt(stats.totalPurchases)}</Text>
          </View>

          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Total Bills</Text>
            <Text style={styles.metricValue}>{stats.totalBills}</Text>
          </View>

          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Products</Text>
            <Text style={styles.metricValue}>{stats.totalProductsCount}</Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.heroActionRow}>
          <TouchableOpacity
            style={[styles.heroActionBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('AddSupplierBill', { supplierId })}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={17} color={colors.textInverse} />
            <Text style={styles.heroActionBtnText}>+ Add Purchase Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.heroActionBtn, { backgroundColor: colors.brandGreen }]}
            onPress={() => setShowPaymentModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="cash" size={17} color={colors.textInverse} />
            <Text style={styles.heroActionBtnText}>Record Payment</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Segmented Navigation Tabs ──────────────────────────────── */}
      <View style={styles.tabContainer}>
        {(
          [
            { key: 'OVERVIEW', label: 'Overview', icon: 'pie-chart-outline' },
            { key: 'BILLS', label: `Bills & History (${supplierBills.length})`, icon: 'receipt-outline' },
          ] as const
        ).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabButton, activeTab === t.key && styles.tabButtonActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={t.icon}
              size={15}
              color={activeTab === t.key ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB 1: OVERVIEW                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'OVERVIEW' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Purchase Performance Grid */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>PURCHASE BREAKDOWN</Text>
          </View>

          <View style={styles.overviewStatsRow}>
            <View style={styles.overviewStatCard}>
              <Text style={styles.overviewStatLabel}>THIS MONTH</Text>
              <Text style={styles.overviewStatVal}>₹{fmt(stats.currentMonthPurchases)}</Text>
              <Text style={styles.overviewStatSub}>Month to date</Text>
            </View>

            <View style={styles.overviewStatCard}>
              <Text style={styles.overviewStatLabel}>THIS YEAR</Text>
              <Text style={styles.overviewStatVal}>₹{fmt(stats.currentYearPurchases)}</Text>
              <Text style={styles.overviewStatSub}>Year to date</Text>
            </View>
          </View>

          <View style={styles.overviewStatsRow}>
            <View style={styles.overviewStatCard}>
              <Text style={styles.overviewStatLabel}>AVG BILL VALUE</Text>
              <Text style={styles.overviewStatVal}>₹{fmt(stats.averageBillValue)}</Text>
              <Text style={styles.overviewStatSub}>Per invoice average</Text>
            </View>

            <View style={styles.overviewStatCard}>
              <Text style={styles.overviewStatLabel}>LAST PURCHASE</Text>
              <Text style={styles.overviewStatVal}>
                {stats.lastPurchaseDate || 'No purchase yet'}
              </Text>
              <Text style={styles.overviewStatSub}>Latest invoice date</Text>
            </View>
          </View>

          {/* Supplier Contact Card */}
          <Card style={styles.infoCard} outlined elevation="sm">
            <Text style={styles.infoCardTitle}>Supplier Profile</Text>

            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Company</Text>
              <Text style={styles.infoVal}>{supplier.name}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Contact</Text>
              <Text style={styles.infoVal}>{supplier.contactPerson || 'Not specified'}</Text>
            </View>

            {supplier.phone ? (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Phone</Text>
                <TouchableOpacity
                  onPress={() => handleCall(supplier.phone)}
                  style={styles.phoneClickRow}
                >
                  <Text style={styles.phoneClickVal}>{supplier.phone}</Text>
                  <Ionicons name="call" size={13} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : null}

            {supplier.email ? (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Email</Text>
                <TouchableOpacity onPress={() => handleEmail(supplier.email)}>
                  <Text style={styles.emailVal}>{supplier.email}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Card>

          {/* Recent Invoices Preview */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT INVOICES</Text>
            {supplierBills.length > 0 && (
              <TouchableOpacity onPress={() => setActiveTab('BILLS')}>
                <Text style={styles.sectionLink}>View All ({supplierBills.length}) →</Text>
              </TouchableOpacity>
            )}
          </View>

          {supplierBills.slice(0, 3).map((b) => (
            <Card
              key={b.id}
              style={styles.recentBillRow}
              onPress={() =>
                navigation.navigate('SupplierBillDetail', { supplierId, billId: b.id })
              }
              outlined
              elevation="sm"
            >
              <View style={styles.billRowLeft}>
                <View style={styles.billDateBadge}>
                  <Text style={styles.billDayText}>
                    {b.billDate ? b.billDate.split('-')[2] : '--'}
                  </Text>
                  <Text style={styles.billMonthText}>
                    {b.billDate
                      ? new Date(b.billDate).toLocaleString('default', { month: 'short' })
                      : ''}
                  </Text>
                </View>

                <View style={styles.billMetaCol}>
                  <View style={styles.invoiceTitleRow}>
                    <Text style={styles.invoiceNumText}>Invoice #{b.invoiceNumber}</Text>
                    {b.cloudinaryUrl ? (
                      <View style={styles.docBadge}>
                        <Ionicons
                          name={b.fileType?.includes('pdf') ? 'document-text' : 'image'}
                          size={11}
                          color={colors.primary}
                        />
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.invoiceItemsSub} numberOfLines={1}>
                    {b.items && b.items.length > 0
                      ? b.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')
                      : 'No items recorded'}
                  </Text>
                </View>
              </View>

              <View style={styles.billRowRight}>
                <Text style={styles.billAmountVal}>₹{fmt(b.totalAmount)}</Text>
                <View
                  style={[
                    styles.statusPill,
                    b.paymentStatus === 'PAID' ? styles.statusPillPaid : styles.statusPillPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      b.paymentStatus === 'PAID'
                        ? styles.statusPillTextPaid
                        : styles.statusPillTextPending,
                    ]}
                  >
                    {b.paymentStatus}
                  </Text>
                </View>
              </View>
            </Card>
          ))}

          {supplierBills.length === 0 && (
            <View style={styles.emptyCardWrap}>
              <Ionicons name="receipt-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyCardTitle}>No bills recorded</Text>
              <Text style={styles.emptyCardSub}>Add purchases to build supplier bill history.</Text>
            </View>
          )}

          {/* Delete Supplier Danger Button */}
          <TouchableOpacity
            style={styles.deleteLinkBtn}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={styles.deleteLinkText}>Delete Supplier Record</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB 2: BILLS & PURCHASE HISTORY                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'BILLS' && (

        <View style={{ flex: 1 }}>
          {/* Search & Filter Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchRow}>
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="Search invoice #, product, notes..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  leftIcon={<Ionicons name="search-outline" size={17} color={colors.textMuted} />}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>

              <TouchableOpacity
                style={styles.sortTriggerBtn}
                onPress={() => setShowSortModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-vertical" size={19} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Filter Chips Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              {(
                [
                  { key: 'ALL', label: `All (${supplierBills.length})` },
                  { key: 'THIS_MONTH', label: 'This Month' },
                  { key: 'THIS_YEAR', label: 'This Year' },
                  { key: 'PAID', label: `Paid (${stats.paidBillsCount})` },
                  { key: 'PENDING', label: `Unpaid / Credit (${stats.pendingBillsCount})` },
                ] as const
              ).map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.filterPill, activeFilter === chip.key && styles.filterPillActive]}
                  onPress={() => setActiveFilter(chip.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      activeFilter === chip.key && styles.filterPillTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bills FlatList */}
          <FlatList
            data={filteredBills}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.billsListContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <Card
                style={styles.billCard}
                onPress={() =>
                  navigation.navigate('SupplierBillDetail', {
                    supplierId,
                    billId: item.id,
                  })
                }
                outlined
                elevation="sm"
              >
                <View style={styles.billCardContent}>
                  {/* Left Date Column */}
                  <View style={styles.billDateColumn}>
                    <Text style={styles.billDayText}>
                      {item.billDate ? item.billDate.split('-')[2] : '--'}
                    </Text>
                    <Text style={styles.billMonthText}>
                      {item.billDate
                        ? new Date(item.billDate).toLocaleString('default', { month: 'short' })
                        : ''}
                    </Text>
                    <Text style={styles.billYearText}>
                      {item.billDate ? item.billDate.split('-')[0] : ''}
                    </Text>
                  </View>

                  {/* Center Details */}
                  <View style={styles.billCenterColumn}>
                    <View style={styles.billNumberRow}>
                      <Text style={styles.billNumberText}>Invoice #{item.invoiceNumber}</Text>
                      {item.cloudinaryUrl ? (
                        <View style={styles.attachmentPill}>
                          <Ionicons
                            name={item.fileType?.includes('pdf') ? 'document-text' : 'image'}
                            size={11}
                            color={colors.primary}
                          />
                          <Text style={styles.attachmentPillText}>Attachment</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.billProductsListText} numberOfLines={2}>
                      {item.items && item.items.length > 0
                        ? item.items
                            .map((p) => `${p.productName} (${p.quantity} ${p.unit})`)
                            .join(', ')
                        : 'No item details'}
                    </Text>

                    {item.notes ? (
                      <Text style={styles.billNotesText} numberOfLines={1}>
                        Note: {item.notes}
                      </Text>
                    ) : null}
                  </View>

                  {/* Right Amount & Status */}
                  <View style={styles.billRightColumn}>
                    <Text style={styles.billTotalAmountText}>₹{fmt(item.totalAmount)}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        item.paymentStatus === 'PAID'
                          ? styles.statusPillPaid
                          : styles.statusPillPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          item.paymentStatus === 'PAID'
                            ? styles.statusPillTextPaid
                            : styles.statusPillTextPending,
                        ]}
                      >
                        {item.paymentStatus}
                      </Text>
                    </View>

                    <View style={styles.viewLinkRow}>
                      <Text style={styles.viewLinkText}>View</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No invoices found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery || activeFilter !== 'ALL'
                    ? 'Try clearing search or filter chips.'
                    : 'Tap below to add the first invoice for this supplier.'}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── RECORD PAYMENT MODAL ───────────────────────────────────── */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Supplier Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.payableSummaryBox}>
              <Text style={styles.payableSummaryLabel}>CURRENT OUTSTANDING</Text>
              <Text style={styles.payableSummaryAmount}>₹{fmt(balance)}</Text>
            </View>

            <Input
              label="Payment Amount (₹) *"
              keyboardType="numeric"
              prefix="₹"
              placeholder="0.00"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />

            <Input
              label="Payment Reference / Notes"
              placeholder="e.g. Bank Transfer, UPI Ref, Cash"
              value={paymentNotes}
              onChangeText={setPaymentNotes}
            />

            <Button
              title={`SAVE PAYMENT (−₹${paymentAmount || '0.00'})`}
              onPress={handleRecordPayment}
              loading={paymentLoading}
              style={{ backgroundColor: colors.brandGreen, marginTop: spacing.sm }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT SUPPLIER MODAL ─────────────────────────────────────── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Supplier Details</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Input
                label="Supplier Business Name *"
                value={editName}
                onChangeText={setEditName}
              />

              <Input
                label="Contact Person"
                value={editContact}
                onChangeText={setEditContact}
              />

              <Input
                label="Phone Number"
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
              />

              <Input
                label="Email Address"
                keyboardType="email-address"
                autoCapitalize="none"
                value={editEmail}
                onChangeText={setEditEmail}
              />

              <Input
                label="Category"
                placeholder="e.g. Raw Material, Packaging"
                value={editCategory}
                onChangeText={setEditCategory}
              />

              <Button
                title="SAVE CHANGES"
                onPress={handleSaveEdit}
                loading={editLoading}
                style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── SORT MODAL ─────────────────────────────────────────────── */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>Sort Invoices By</Text>

            {(
              [
                { label: 'Newest Date First', value: 'NEWEST' },
                { label: 'Oldest Date First', value: 'OLDEST' },
                { label: 'Highest Amount First', value: 'HIGHEST_AMOUNT' },
                { label: 'Lowest Amount First', value: 'LOWEST_AMOUNT' },
              ] as const
            ).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortOption, sortBy === opt.value && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy(opt.value);
                  setShowSortModal(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === opt.value && styles.sortOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {sortBy === opt.value && (
                  <Ionicons name="checkmark" size={17} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────────── */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Supplier"
        message={`Are you sure you want to delete ${supplier.name}? All historical bills and audit trails will be preserved.`}
        confirmTitle="Delete Supplier"
        cancelTitle="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
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
    gap: spacing.sm,
  },
  headerIconBtn: {
    padding: spacing.xs,
  },
  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // Hero Financial Cockpit
  heroSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroBalanceLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9.5,
    letterSpacing: 0.8,
  },
  heroBalanceAmount: {
    ...typography.currencyLarge,
    fontSize: 26,
    lineHeight: 32,
    marginTop: 2,
  },
  heroStatusSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
  },
  quickCallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  quickCallPillText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 11.5,
  },

  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  metricValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
    marginTop: 2,
  },

  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    gap: 5,
  },
  heroActionBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },

  // Segmented Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 11,
  },
  tabTextActive: {
    color: colors.primary,
  },

  // Scroll Content
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  sectionLink: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11.5,
  },

  overviewStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  overviewStatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overviewStatLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 8.5,
  },
  overviewStatVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13.5,
    marginTop: 2,
  },
  overviewStatSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9.5,
    marginTop: 2,
  },

  // Supplier Profile Info Card
  infoCard: {
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  infoCardTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 75,
    fontSize: 11.5,
  },
  infoVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12.5,
  },
  phoneClickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneClickVal: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 12.5,
  },
  emailVal: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 12.5,
  },

  // Recent Bills Preview Row
  recentBillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  billRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  billDateBadge: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    paddingVertical: 4,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billDayText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 15,
  },
  billMonthText: {
    ...typography.captionBold,
    fontSize: 8.5,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  billYearText: {
    ...typography.caption,
    fontSize: 7.5,
    color: colors.textMuted,
  },
  billMetaCol: {
    flex: 1,
  },
  invoiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  invoiceNumText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 12.5,
  },
  docBadge: {
    backgroundColor: colors.surfaceSubtle,
    padding: 2,
    borderRadius: 3,
  },
  invoiceItemsSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  billRowRight: {
    alignItems: 'flex-end',
  },
  billAmountVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  statusPillPaid: {
    backgroundColor: colors.brandGreenLight,
  },
  statusPillPending: {
    backgroundColor: colors.debitLight,
  },
  statusPillText: {
    ...typography.captionBold,
    fontSize: 8.5,
  },
  statusPillTextPaid: {
    color: colors.brandGreen,
  },
  statusPillTextPending: {
    color: colors.debit,
  },

  deleteLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    gap: 5,
  },
  deleteLinkText: {
    ...typography.captionBold,
    color: colors.danger,
    fontSize: 11.5,
  },

  // Products Tab
  listContainer: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },
  productsSummaryBanner: {
    marginBottom: spacing.sm,
  },
  productsBannerTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  productsBannerSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  productCatalogCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  productCatalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  productDetailsCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productTitleText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  productSubDetails: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  productLastRate: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  productSpendCol: {
    alignItems: 'flex-end',
  },
  productSpendLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 8,
  },
  productSpendAmount: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
    marginTop: 1,
  },

  // Bills Tab
  searchBarContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sortTriggerBtn: {
    width: 40,
    height: 40,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  filterPillsRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  filterPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.captionBold,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },

  billsListContainer: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },
  billCard: {
    marginBottom: spacing.xs + 2,
    padding: spacing.sm + 2,
  },
  billCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billDateColumn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    paddingVertical: 5,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billCenterColumn: {
    flex: 1,
    marginRight: spacing.xs,
  },
  billNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  billNumberText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  attachmentPillText: {
    ...typography.caption,
    fontSize: 8.5,
    color: colors.textSecondary,
  },
  billProductsListText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  billNotesText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9.5,
    fontStyle: 'italic',
    marginTop: 1,
  },
  billRightColumn: {
    alignItems: 'flex-end',
  },
  billTotalAmountText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  viewLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: 4,
  },
  viewLinkText: {
    ...typography.captionBold,
    fontSize: 9.5,
    color: colors.primary,
  },

  // Empty states
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySub: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 3,
  },
  emptyCardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  emptyCardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 4,
    fontSize: 12,
  },
  emptyCardSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  payableSummaryBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  payableSummaryLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  payableSummaryAmount: {
    ...typography.bodyBold,
    color: colors.debit,
    fontSize: 17,
    marginTop: 2,
  },

  // Sort Sheet
  sortSheet: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    elevation: 5,
  },
  sortTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sortOptionActive: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    paddingHorizontal: spacing.xs,
  },
  sortOptionText: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  sortOptionTextActive: {
    ...typography.captionBold,
    color: colors.primary,
  },
});
