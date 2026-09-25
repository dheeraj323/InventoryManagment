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
  TextInput,
  RefreshControl,
  Platform,
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

type TabType = 'OVERVIEW' | 'PRODUCTS' | 'BILLS';
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
    getSupplierProductsSummary,
  } = useSupplierBillStore();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [refreshing, setRefreshing] = useState(false);

  // Bill Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [sortBy, setSortBy] = useState<SortType>('NEWEST');
  const [showSortModal, setShowSortModal] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Supplier Actions Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Edit fields
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

  const productsSummary = useMemo(() => {
    return getSupplierProductsSummary(supplierId);
  }, [bills, supplierId]);

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
      Alert.alert('Error', 'Unable to initiate phone call');
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
      Alert.alert('Success', `Recorded payment of ₹${num.toLocaleString('en-IN')}`);
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

    // 1. Text Search
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

    // 2. Filter Presets
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

    // 3. Date Range
    if (fromDate.trim()) {
      list = list.filter((b) => (b.billDate || '') >= fromDate.trim());
    }
    if (toDate.trim()) {
      list = list.filter((b) => (b.billDate || '') <= toDate.trim());
    }

    // 4. Sorting
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
  }, [supplierBills, searchQuery, activeFilter, fromDate, toDate, sortBy]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!supplier) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Supplier Details" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.notFoundWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.notFoundText}>Supplier not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Header
        title={supplier.name}
        subtitle={supplier.category || 'Supplier Profile & History'}
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

      {/* ── Top Summary Header Card ───────────────────────────────── */}
      <View style={styles.supplierHero}>
        <View style={styles.heroRow}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>
              {supplier.name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? '')
                .join('')}
            </Text>
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {supplier.name}
            </Text>
            {supplier.contactPerson ? (
              <Text style={styles.heroContact} numberOfLines={1}>
                <Ionicons name="person-outline" size={12} color={colors.textMuted} /> {supplier.contactPerson}
              </Text>
            ) : null}
            {supplier.phone ? (
              <TouchableOpacity onPress={() => handleCall(supplier.phone)} style={styles.heroPhoneLink}>
                <Ionicons name="call-outline" size={12} color={colors.primary} />
                <Text style={styles.heroPhoneText}>{supplier.phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.heroBalanceBox}>
            <Text style={styles.heroBalanceLabel}>OUTSTANDING</Text>
            <Text
              style={[
                styles.heroBalanceValue,
                (supplier.balancePayable || 0) > 0 ? styles.balanceDue : styles.balanceClear,
              ]}
            >
              ₹{fmt(supplier.balancePayable || 0)}
            </Text>
          </View>
        </View>

        {/* Mini Quick Metrics Strip */}
        <View style={styles.metricsStrip}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>₹{fmt(stats.totalPurchases)}</Text>
            <Text style={styles.metricLabel}>Total Purchases</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{stats.totalBills}</Text>
            <Text style={styles.metricLabel}>Total Bills</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{stats.totalProductsCount}</Text>
            <Text style={styles.metricLabel}>Products</Text>
          </View>
        </View>
      </View>

      {/* ── Tab Selector ──────────────────────────────────────────── */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'OVERVIEW' && styles.tabButtonActive]}
          onPress={() => setActiveTab('OVERVIEW')}
        >
          <Ionicons
            name={activeTab === 'OVERVIEW' ? 'stats-chart' : 'stats-chart-outline'}
            size={16}
            color={activeTab === 'OVERVIEW' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'OVERVIEW' && styles.tabTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'PRODUCTS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('PRODUCTS')}
        >
          <Ionicons
            name={activeTab === 'PRODUCTS' ? 'cube' : 'cube-outline'}
            size={16}
            color={activeTab === 'PRODUCTS' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'PRODUCTS' && styles.tabTextActive]}>
            Products ({productsSummary.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'BILLS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('BILLS')}
        >
          <Ionicons
            name={activeTab === 'BILLS' ? 'receipt' : 'receipt-outline'}
            size={16}
            color={activeTab === 'BILLS' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'BILLS' && styles.tabTextActive]}>
            Bills & History ({supplierBills.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1: OVERVIEW ───────────────────────────────────────── */}
      {activeTab === 'OVERVIEW' && (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Detailed Financial Stats Grid */}
          <Text style={styles.sectionHeaderTitle}>PURCHASE & BILL STATISTICS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>CURRENT MONTH</Text>
              <Text style={styles.statBoxValue}>₹{fmt(stats.currentMonthPurchases)}</Text>
              <Text style={styles.statBoxSub}>This month's purchases</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>CURRENT YEAR</Text>
              <Text style={styles.statBoxValue}>₹{fmt(stats.currentYearPurchases)}</Text>
              <Text style={styles.statBoxSub}>Year-to-date purchases</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>AVERAGE BILL</Text>
              <Text style={styles.statBoxValue}>₹{fmt(stats.averageBillValue)}</Text>
              <Text style={styles.statBoxSub}>Per bill average spend</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>LAST PURCHASE</Text>
              <Text style={styles.statBoxValue}>
                {stats.lastPurchaseDate ? stats.lastPurchaseDate : 'No record'}
              </Text>
              <Text style={styles.statBoxSub}>Most recent invoice date</Text>
            </View>
          </View>

          {/* Bill Status Breakdown */}
          <Card style={styles.statusBreakdownCard} outlined>
            <Text style={styles.breakdownTitle}>Bill Payment Distribution</Text>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownCol}>
                <View style={[styles.statusDot, { backgroundColor: colors.brandGreen }]} />
                <Text style={styles.breakdownLabel}>Paid Bills</Text>
                <Text style={styles.breakdownValue}>{stats.paidBillsCount}</Text>
              </View>

              <View style={styles.breakdownCol}>
                <View style={[styles.statusDot, { backgroundColor: colors.debit }]} />
                <Text style={styles.breakdownLabel}>Pending / Credit</Text>
                <Text style={styles.breakdownValue}>{stats.pendingBillsCount}</Text>
              </View>

              <View style={styles.breakdownCol}>
                <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.breakdownLabel}>Total Records</Text>
                <Text style={styles.breakdownValue}>{stats.totalBills}</Text>
              </View>
            </View>
          </Card>

          {/* Quick Actions */}
          <Text style={styles.sectionHeaderTitle}>QUICK ACTIONS</Text>
          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('AddSupplierBill', { supplierId })}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color={colors.textInverse} />
              <Text style={styles.quickActionText}>Add New Bill</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: colors.brandGreen }]}
              onPress={() => setShowPaymentModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.textInverse} />
              <Text style={styles.quickActionText}>Record Payment</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Bills Snippet */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>RECENT INVOICES</Text>
            <TouchableOpacity onPress={() => setActiveTab('BILLS')}>
              <Text style={styles.viewAllLink}>View All ({supplierBills.length}) →</Text>
            </TouchableOpacity>
          </View>

          {supplierBills.slice(0, 3).map((bill) => (
            <Card
              key={bill.id}
              style={styles.recentBillCard}
              onPress={() =>
                navigation.navigate('SupplierBillDetail', { supplierId, billId: bill.id })
              }
              outlined
            >
              <View style={styles.billCardTop}>
                <View>
                  <Text style={styles.billInvoiceNumber}>#{bill.invoiceNumber}</Text>
                  <Text style={styles.billDateText}>{bill.billDate}</Text>
                </View>
                <View style={styles.billAmountCol}>
                  <Text style={styles.billAmountText}>₹{fmt(bill.totalAmount)}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      bill.paymentStatus === 'PAID' ? styles.statusPillPaid : styles.statusPillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        bill.paymentStatus === 'PAID'
                          ? styles.statusPillTextPaid
                          : styles.statusPillTextPending,
                      ]}
                    >
                      {bill.paymentStatus}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.billItemsSummaryText} numberOfLines={1}>
                {bill.items.length} Product{bill.items.length !== 1 ? 's' : ''}:{' '}
                {bill.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}
              </Text>
            </Card>
          ))}

          {supplierBills.length === 0 && (
            <View style={styles.emptyOverviewWrap}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyOverviewText}>No bills uploaded yet</Text>
              <Button
                title="+ Add First Bill"
                variant="outline"
                size="sm"
                onPress={() => navigation.navigate('AddSupplierBill', { supplierId })}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}

          {/* Supplier Contact Info */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: spacing.lg }]}>SUPPLIER DETAILS</Text>
          <Card style={styles.contactInfoCard} outlined>
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Business Name</Text>
              <Text style={styles.infoValue}>{supplier.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Contact Person</Text>
              <Text style={styles.infoValue}>{supplier.contactPerson || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{supplier.phone || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{supplier.email || '—'}</Text>
            </View>
          </Card>

          {/* Danger Zone */}
          <TouchableOpacity
            style={styles.deleteSupplierBtn}
            onPress={() => setShowDeleteModal(true)}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteSupplierText}>Delete Supplier</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── TAB 2: PRODUCTS ───────────────────────────────────────── */}
      {activeTab === 'PRODUCTS' && (
        <FlatList
          data={productsSummary}
          keyExtractor={(item) => item.productName}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.productsHeaderBar}>
              <Text style={styles.productsHeaderTitle}>
                Products Purchased ({productsSummary.length})
              </Text>
              <Text style={styles.productsHeaderSub}>
                Aggregated purchase history & pricing from all invoices
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.productCard} outlined>
              <View style={styles.productRow}>
                <View style={styles.productIconBox}>
                  <Ionicons name="cube" size={20} color={colors.primary} />
                </View>

                <View style={styles.productInfoCol}>
                  <Text style={styles.productCardName}>{item.productName}</Text>
                  <Text style={styles.productCardSub}>
                    Total: {item.totalPurchasedQty} {item.unit} · {item.billCount} Bill{item.billCount !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.productCardLastDate}>
                    Last bought: {item.lastPurchaseDate || 'N/A'} @ ₹{fmt(item.lastPrice)}/{item.unit}
                  </Text>
                </View>

                <View style={styles.productSpendCol}>
                  <Text style={styles.productSpendLabel}>Total Spend</Text>
                  <Text style={styles.productSpendValue}>₹{fmt(item.totalSpend)}</Text>
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No products recorded yet</Text>
              <Text style={styles.emptySub}>
                Products will appear here automatically when you add bills from this supplier.
              </Text>
              <Button
                title="+ Add Purchase Bill"
                onPress={() => navigation.navigate('AddSupplierBill', { supplierId })}
                style={{ marginTop: spacing.md }}
              />
            </View>
          }
        />
      )}

      {/* ── TAB 3: BILLS & PURCHASE HISTORY ──────────────────────── */}
      {activeTab === 'BILLS' && (
        <View style={{ flex: 1 }}>
          {/* Search Bar & Date Filter Trigger */}
          <View style={styles.filterSection}>
            <View style={styles.searchRow}>
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="Search invoice #, product, note..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.iconFilterBtn,
                  (fromDate || toDate) ? styles.iconFilterBtnActive : null,
                ]}
                onPress={() => setShowDateFilter(!showDateFilter)}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={fromDate || toDate ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconFilterBtn}
                onPress={() => setShowSortModal(true)}
              >
                <Ionicons name="swap-vertical" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Expandable Date Range Filter */}
            {showDateFilter && (
              <View style={styles.dateFilterContainer}>
                <View style={styles.dateInputRow}>
                  <View style={{ flex: 1, marginRight: spacing.xs }}>
                    <Text style={styles.dateFieldLabel}>From (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.dateTextInput}
                      placeholder="e.g. 2026-09-01"
                      value={fromDate}
                      onChangeText={setFromDate}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.xs }}>
                    <Text style={styles.dateFieldLabel}>To (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.dateTextInput}
                      placeholder="e.g. 2026-09-30"
                      value={toDate}
                      onChangeText={setToDate}
                    />
                  </View>
                </View>
                {(fromDate || toDate) ? (
                  <TouchableOpacity
                    onPress={() => {
                      setFromDate('');
                      setToDate('');
                    }}
                    style={styles.clearDateBtn}
                  >
                    <Text style={styles.clearDateText}>Clear Date Filter</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* Filter Chips Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              <TouchableOpacity
                style={[styles.chip, activeFilter === 'ALL' && styles.chipActive]}
                onPress={() => setActiveFilter('ALL')}
              >
                <Text style={[styles.chipText, activeFilter === 'ALL' && styles.chipTextActive]}>
                  All ({supplierBills.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, activeFilter === 'THIS_MONTH' && styles.chipActive]}
                onPress={() => setActiveFilter('THIS_MONTH')}
              >
                <Text style={[styles.chipText, activeFilter === 'THIS_MONTH' && styles.chipTextActive]}>
                  This Month
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, activeFilter === 'THIS_YEAR' && styles.chipActive]}
                onPress={() => setActiveFilter('THIS_YEAR')}
              >
                <Text style={[styles.chipText, activeFilter === 'THIS_YEAR' && styles.chipTextActive]}>
                  This Year
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, activeFilter === 'PAID' && styles.chipActive]}
                onPress={() => setActiveFilter('PAID')}
              >
                <Text style={[styles.chipText, activeFilter === 'PAID' && styles.chipTextActive]}>
                  Paid ({stats.paidBillsCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, activeFilter === 'PENDING' && styles.chipActive]}
                onPress={() => setActiveFilter('PENDING')}
              >
                <Text style={[styles.chipText, activeFilter === 'PENDING' && styles.chipTextActive]}>
                  Pending / Credit ({stats.pendingBillsCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Bills List */}
          <FlatList
            data={filteredBills}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <Card
                style={styles.historyBillCard}
                onPress={() =>
                  navigation.navigate('SupplierBillDetail', {
                    supplierId,
                    billId: item.id,
                  })
                }
                outlined
                elevation="sm"
              >
                <View style={styles.billCardRow}>
                  {/* Left Date / Icon Box */}
                  <View style={styles.billDateBox}>
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

                  {/* Center Info */}
                  <View style={styles.billCardCenter}>
                    <View style={styles.billInvoiceRow}>
                      <Text style={styles.historyInvoiceText}>Invoice #{item.invoiceNumber}</Text>
                      {item.cloudinaryUrl ? (
                        <View style={styles.attachmentBadge}>
                          <Ionicons
                            name={item.fileType?.includes('pdf') ? 'document-text' : 'image'}
                            size={12}
                            color={colors.primary}
                          />
                          <Text style={styles.attachmentBadgeText}>Bill File</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.historyProductsText} numberOfLines={2}>
                      {item.items && item.items.length > 0
                        ? item.items
                            .map((p) => `${p.productName} (${p.quantity} ${p.unit})`)
                            .join(', ')
                        : 'No item details'}
                    </Text>

                    {item.notes ? (
                      <Text style={styles.historyNotesText} numberOfLines={1}>
                        Note: {item.notes}
                      </Text>
                    ) : null}
                  </View>

                  {/* Right Financials & Action */}
                  <View style={styles.billCardRight}>
                    <Text style={styles.historyAmountText}>₹{fmt(item.totalAmount)}</Text>
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

                    <View style={styles.viewBillRow}>
                      <Text style={styles.viewBillText}>View Bill</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="receipt-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No matching bills found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery || activeFilter !== 'ALL' || fromDate || toDate
                    ? 'Try clearing search or filters to see all records'
                    : 'Tap below to add the first bill for this supplier'}
                </Text>
                <Button
                  title="+ Add Bill"
                  onPress={() => navigation.navigate('AddSupplierBill', { supplierId })}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            }
          />

          {/* Floating "+ Add Bill" Button */}
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => navigation.navigate('AddSupplierBill', { supplierId })}
            activeOpacity={0.88}
          >
            <Ionicons name="add" size={24} color={colors.textInverse} />
            <Text style={styles.fabText}>Add Bill</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── RECORD PAYMENT MODAL ───────────────────────────────────── */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Supplier Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubText}>
                Payable Balance: ₹{fmt(supplier.balancePayable || 0)}
              </Text>

              <Input
                label="Payment Amount (₹) *"
                keyboardType="numeric"
                prefix="₹"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />

              <Input
                label="Payment Notes / Reference"
                placeholder="e.g. Bank Transfer Ref / Cash"
                value={paymentNotes}
                onChangeText={setPaymentNotes}
              />

              <Button
                title={`RECORD PAYMENT (−₹${paymentAmount || '0.00'})`}
                onPress={handleRecordPayment}
                loading={paymentLoading}
                style={{ backgroundColor: colors.brandGreen, marginTop: spacing.sm }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── EDIT SUPPLIER MODAL ─────────────────────────────────────── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Supplier</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              <Input
                label="Supplier Name *"
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
                label="Email"
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
        </View>
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
            <Text style={styles.sortTitle}>Sort Bills By</Text>

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
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
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
        message={`Are you sure you want to delete ${supplier.name}? Historical bills will be preserved.`}
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

  // Hero Card
  supplierHero: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroAvatarText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 16,
  },
  heroInfo: {
    flex: 1,
  },
  heroTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
  },
  heroContact: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  heroPhoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  heroPhoneText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  heroBalanceBox: {
    alignItems: 'flex-end',
  },
  heroBalanceLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  heroBalanceValue: {
    ...typography.bodyBold,
    fontSize: 15,
    marginTop: 2,
  },
  balanceDue: {
    color: colors.debit,
  },
  balanceClear: {
    color: colors.textSecondary,
  },

  // Metrics Strip
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    ...typography.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  metricLabel: {
    ...typography.label,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
  },

  // Tabs
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
    paddingVertical: 10,
    gap: 6,
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

  // Overview Tab
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },
  sectionHeaderTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  viewAllLink: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBoxLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 8.5,
  },
  statBoxValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 2,
  },
  statBoxSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9.5,
    marginTop: 2,
  },

  statusBreakdownCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  breakdownTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  breakdownCol: {
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  breakdownLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  breakdownValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
    marginTop: 2,
  },

  quickActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: spacing.borderRadiusMd,
    gap: 6,
  },
  quickActionText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12.5,
  },

  recentBillCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm + 4,
  },
  billCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  billInvoiceNumber: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13.5,
  },
  billDateText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  billAmountCol: {
    alignItems: 'flex-end',
  },
  billAmountText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  billItemsSummaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11.5,
  },
  emptyOverviewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  emptyOverviewText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },

  contactInfoCard: {
    padding: spacing.sm + 4,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 90,
    fontSize: 11.5,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12.5,
  },
  deleteSupplierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  deleteSupplierText: {
    ...typography.captionBold,
    color: colors.danger,
    fontSize: 12,
  },

  // Products Tab
  productsHeaderBar: {
    marginBottom: spacing.sm,
  },
  productsHeaderTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  productsHeaderSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  productCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm + 4,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  productInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productCardName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13.5,
  },
  productCardSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  productCardLastDate: {
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
    fontSize: 8.5,
  },
  productSpendValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13.5,
    marginTop: 2,
  },

  // Bills & History Tab
  filterSection: {
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
  iconFilterBtn: {
    width: 40,
    height: 40,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  iconFilterBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dateFilterContainer: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateInputRow: {
    flexDirection: 'row',
  },
  dateFieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 2,
  },
  dateTextInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusSm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    fontSize: 12,
    color: colors.textPrimary,
  },
  clearDateBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  clearDateText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 10,
  },
  filterChipsRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.captionBold,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },

  listContainer: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl + 40,
  },
  historyBillCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm + 4,
  },
  billCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billDateBox: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    paddingVertical: 6,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billDayText: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 17,
  },
  billMonthText: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  billYearText: {
    ...typography.caption,
    fontSize: 8,
    color: colors.textMuted,
  },
  billCardCenter: {
    flex: 1,
    marginRight: spacing.xs,
  },
  billInvoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyInvoiceText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  attachmentBadgeText: {
    ...typography.captionBold,
    fontSize: 8.5,
    color: colors.primary,
  },
  historyProductsText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  historyNotesText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9.5,
    fontStyle: 'italic',
    marginTop: 1,
  },
  billCardRight: {
    alignItems: 'flex-end',
  },
  historyAmountText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13.5,
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
    fontSize: 9,
  },
  statusPillTextPaid: {
    color: colors.brandGreen,
  },
  statusPillTextPending: {
    color: colors.debit,
  },
  viewBillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: 4,
  },
  viewBillText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.primary,
  },

  // FAB
  fabButton: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.md + 4,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    gap: 4,
  },
  fabText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 13,
  },

  // Empty state
  emptyWrap: {
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
    maxHeight: '85%',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalBody: {
    marginBottom: spacing.sm,
  },
  modalSubText: {
    ...typography.bodyBold,
    color: colors.debit,
    marginBottom: spacing.md,
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
    fontSize: 14,
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
    paddingVertical: 12,
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
    fontSize: 13,
    color: colors.textPrimary,
  },
  sortOptionTextActive: {
    ...typography.captionBold,
    color: colors.primary,
  },
});
