import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useCartStore } from '../../store/useCartStore';
import { useVendorStore } from '../../store/useVendorStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { colors, typography, spacing } from '../../theme';

export const VendorDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { activeRole, activeVendorId, currentUser } = useAuthStore();
  const { getOrdersByVendor } = useOrderStore();
  const { getPartyRunningBalance, getVendorAccountSummary, subscribeLedger, fetchLedger } = useLedgerStore();
  const { getItemCount } = useCartStore();
  const { getVendorById, fetchVendors } = useVendorStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectiveVendorId = activeVendorId || currentUser?.vendorId || '';

  useEffect(() => {
    if (effectiveVendorId) {
      const unsub = subscribeLedger(effectiveVendorId);
      return () => {
        if (unsub) unsub();
      };
    }
  }, [effectiveVendorId]);
  const vendor = getVendorById(effectiveVendorId) || {
    id: effectiveVendorId,
    name: currentUser?.name || 'Retailer',
    shopName: currentUser?.businessName || currentUser?.name || 'My Store',
    phone: currentUser?.phone || '',
    address: currentUser?.address || '',
    area: currentUser?.area || 'General',
    currentBalance: 0,
    payLaterEligible: false,
    preferredPaymentMode: 'CASH' as const,
  };

  const accountSummary = getVendorAccountSummary(effectiveVendorId, vendor);
  const vendorOrders = getOrdersByVendor(effectiveVendorId);
  const cartCount = getItemCount();

  const isDue = accountSummary.currentOutstanding > 0;
  const hasAdvance = !isDue && accountSummary.advanceBalance > 0;

  const balanceAccentColor = isDue
    ? colors.debit
    : hasAdvance
    ? colors.brandGreen
    : colors.textSecondary;

  const balanceAccentBg = isDue
    ? colors.statusCancelledBg
    : hasAdvance
    ? '#DCFCE7'
    : colors.surfaceSubtle;

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchLedger(effectiveVendorId),
        fetchVendors(),
      ]);
    } catch (err) {
      console.warn('Error refreshing dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Header
        title={vendor.shopName}
        subtitle={`Welcome, ${vendor.name}`}
        activeRole={activeRole}
        rightAction={
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => navigation.navigate('Cart')}
            accessibilityLabel={`Shopping cart with ${cartCount} items`}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="cart-outline" size={22} color={colors.primary} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── 1. Net Outstanding / Advance Balance Card ─────────────────────────── */}
        <Card
          style={[styles.balanceCard, { borderLeftColor: balanceAccentColor }]}
          outlined
          elevation="sm"
          onPress={() => navigation.navigate('VendorLedgerTab')}
        >
          <View style={styles.balanceHeader}>
            <View style={styles.balanceLabelCol}>
              <Text style={styles.balanceSectionLabel}>
                {isDue
                  ? 'NET OUTSTANDING BALANCE'
                  : hasAdvance
                  ? 'ADVANCE BALANCE AVAILABLE'
                  : 'ACCOUNT BALANCE STATUS'}
              </Text>
              <Text style={styles.balanceShopName} numberOfLines={1}>
                {vendor.shopName} · Official Khata
              </Text>
            </View>

            <View style={[styles.balanceStatusChip, { backgroundColor: balanceAccentBg }]}>
              <Text style={[styles.balanceStatusText, { color: isDue ? colors.debit : hasAdvance ? '#15803D' : colors.textSecondary }]}>
                {isDue ? 'Pending Due' : hasAdvance ? 'Advance Balance' : 'All Dues Cleared'}
              </Text>
            </View>
          </View>

          <View style={styles.amountRow}>
            <View>
              <Text style={[styles.heroAmount, { color: balanceAccentColor }]}>
                ₹{fmt(isDue ? accountSummary.currentOutstanding : hasAdvance ? accountSummary.advanceBalance : 0)}
              </Text>
              <Text style={styles.amountSubtext}>
                {isDue
                  ? 'Total outstanding payable amount'
                  : hasAdvance
                  ? 'Auto-deducted against your next order'
                  : 'No overdue balance on your account'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.viewLedgerBtn}
              onPress={() => navigation.navigate('VendorLedgerTab')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewLedgerText}>View Statement</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── 2. Primary Catalogue & Ordering Action Card ─────────────── */}
        <Card
          style={styles.orderHeroCard}
          outlined
          elevation="sm"
          onPress={() => navigation.navigate('ProductCatalogTab')}
        >
          <View style={styles.orderHeroContent}>
            <View style={styles.orderHeroIconBox}>
              <Ionicons name="storefront" size={26} color={colors.primary} />
            </View>
            <View style={styles.orderHeroTextBox}>
              <Text style={styles.orderHeroTitle}>Product Catalogue</Text>
              <Text style={styles.orderHeroSub}>
                Browse wholesale inventory, live stock availability & place store orders.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.orderHeroButton}
            onPress={() => navigation.navigate('ProductCatalogTab')}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={18} color={colors.textInverse} />
            <Text style={styles.orderHeroButtonText}>Browse & Place Order</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textInverse} />
          </TouchableOpacity>
        </Card>

        {/* ── 3. Quick Navigation & Services ─────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dashboard Services</Text>
        </View>

        <View style={styles.servicesStack}>
          {/* Tile 1: Orders */}
          <TouchableOpacity
            style={styles.serviceItemCard}
            onPress={() => navigation.navigate('VendorOrdersTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="receipt-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.serviceTextGroup}>
              <Text style={styles.serviceTitle}>My Orders</Text>
              <Text style={styles.serviceSubtitle}>
                {vendorOrders.length === 1 ? '1 total order placed' : `${vendorOrders.length} total orders placed`}
              </Text>
            </View>
            <View style={styles.serviceTrailing}>
              <View style={styles.countTag}>
                <Text style={styles.countTagText}>{vendorOrders.length}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Tile 2: Khata Ledger */}
          <TouchableOpacity
            style={styles.serviceItemCard}
            onPress={() => navigation.navigate('VendorLedgerTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: colors.brandGreenLight }]}>
              <Ionicons name="book-outline" size={22} color={colors.brandGreen} />
            </View>
            <View style={styles.serviceTextGroup}>
              <Text style={styles.serviceTitle}>Khata Ledger</Text>
              <Text style={styles.serviceSubtitle}>
                Account statement, debit/credit records & receipts
              </Text>
            </View>
            <View style={styles.serviceTrailing}>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Tile 3: Store Profile */}
          <TouchableOpacity
            style={styles.serviceItemCard}
            onPress={() => navigation.navigate('VendorProfileTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="business-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.serviceTextGroup}>
              <Text style={styles.serviceTitle}>Store Profile</Text>
              <Text style={styles.serviceSubtitle}>
                Registered contact, delivery address & account terms
              </Text>
            </View>
            <View style={styles.serviceTrailing}>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  // 1. Net Outstanding Balance Card
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  balanceLabelCol: {
    flex: 1,
  },
  balanceSectionLabel: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  balanceShopName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  balanceStatusChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusFull,
  },
  balanceStatusText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heroAmount: {
    ...typography.hero,
    fontSize: 28,
    lineHeight: 34,
  },
  amountSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  viewLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusSm,
  },
  viewLedgerText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },

  // 2. Catalogue Hero Order Card
  orderHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  orderHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  orderHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderHeroTextBox: {
    flex: 1,
  },
  orderHeroTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  orderHeroSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  orderHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.borderRadiusMd,
  },
  orderHeroButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
    fontSize: 14,
  },

  // 3. Section Header & Services Stack
  sectionHeader: {
    marginBottom: spacing.sm + 2,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  servicesStack: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  serviceItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTextGroup: {
    flex: 1,
  },
  serviceTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  serviceSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  serviceTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countTag: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
  },
  countTagText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },

  // Cart button
  cartBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 9,
  },
});
