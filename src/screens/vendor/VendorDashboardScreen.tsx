import React, { useState } from 'react';
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
import { Button } from '../../components/common/Button';
import { OrderCard } from '../../components/orders/OrderCard';
import { colors, typography, spacing } from '../../theme';

export const VendorDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { activeRole, activeVendorId, currentUser } = useAuthStore();
  const { getOrdersByVendor } = useOrderStore();
  const { getPartyRunningBalance } = useLedgerStore();
  const { getItemCount } = useCartStore();
  const { getVendorById } = useVendorStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectiveVendorId = activeVendorId || currentUser?.vendorId || '';
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

  const runningBalance = getPartyRunningBalance(effectiveVendorId);
  const vendorOrders = getOrdersByVendor(effectiveVendorId);
  const recentOrders = vendorOrders.slice(0, 3);
  const cartCount = getItemCount();

  const isDue = runningBalance > 0;
  const balanceAccentColor = isDue ? colors.debit : colors.brandGreen;
  const balanceAccentBg = isDue ? colors.statusCancelledBg : colors.statusDeliveredBg;

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate brief pull-to-refresh sync
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
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
        {/* ── 1. Net Outstanding Balance Card ─────────────────────────── */}
        <Card
          style={[styles.balanceCard, { borderLeftColor: balanceAccentColor }]}
          outlined
          elevation="sm"
          onPress={() => navigation.navigate('VendorLedgerTab')}
        >
          <View style={styles.balanceHeader}>
            <View style={styles.balanceLabelCol}>
              <Text style={styles.balanceSectionLabel}>
                {isDue ? 'NET OUTSTANDING DUE' : 'ACCOUNT STATUS'}
              </Text>
              <Text style={styles.balanceShopName} numberOfLines={1}>
                {vendor.shopName} · Khata
              </Text>
            </View>

            <View style={[styles.balanceStatusChip, { backgroundColor: balanceAccentBg }]}>
              <Text style={[styles.balanceStatusText, { color: balanceAccentColor }]}>
                {isDue ? 'Pending Due' : 'All Dues Cleared'}
              </Text>
            </View>
          </View>

          <View style={styles.amountRow}>
            <Text style={[styles.heroAmount, { color: balanceAccentColor }]}>
              ₹{fmt(Math.abs(runningBalance))}
            </Text>
            <TouchableOpacity
              style={styles.viewLedgerBtn}
              onPress={() => navigation.navigate('VendorLedgerTab')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewLedgerText}>View Khata</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── 3. Primary Order CTA ────────────────────────────────────── */}
        <View style={styles.ctaContainer}>
          <Button
            title="Browse Catalogue & Place Order"
            onPress={() => navigation.navigate('ProductCatalogTab')}
            icon={<Ionicons name="storefront-outline" size={18} color={colors.textInverse} />}
            size="lg"
            style={styles.primaryCta}
          />
        </View>

        {/* ── 5. Quick Navigation Tiles ───────────────────────────────── */}
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('VendorOrdersTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="receipt-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.quickActionTitle}>Orders</Text>
            <Text style={styles.quickActionSub}>{vendorOrders.length} placed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('VendorLedgerTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.brandGreenLight }]}>
              <Ionicons name="book-outline" size={18} color={colors.brandGreen} />
            </View>
            <Text style={styles.quickActionTitle}>Khata Ledger</Text>
            <Text style={styles.quickActionSub}>Statement & due</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('VendorProfileTab')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="business-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.quickActionTitle}>Store Profile</Text>
            <Text style={styles.quickActionSub}>Terms & address</Text>
          </TouchableOpacity>
        </View>

        {/* ── 6. Recent Orders Section ────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {vendorOrders.length > 0 && (
              <View style={styles.orderCountBadge}>
                <Text style={styles.orderCountBadgeText}>{vendorOrders.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('VendorOrdersTab')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <Card style={styles.emptyBox} outlined>
            <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Orders Placed Yet</Text>
            <Text style={styles.emptySubtitle}>
              Explore our dairy, staple, and wholesale catalog to place your first store order.
            </Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={() => navigation.navigate('ProductCatalogTab')}
            >
              <Text style={styles.emptyCtaText}>Browse Catalog</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          recentOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showVendorName={false}
              onPress={() =>
                navigation.navigate('VendorOrderDetail', { orderId: order.id })
              }
            />
          ))
        )}

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
    marginTop: spacing.xs,
  },
  heroAmount: {
    ...typography.hero,
    fontSize: 26,
    lineHeight: 32,
  },
  viewLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusSm,
  },
  viewLedgerText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },

  // 3. CTA
  ctaContainer: {
    marginBottom: spacing.md,
  },
  primaryCta: {
    backgroundColor: colors.primary,
    borderRadius: spacing.borderRadiusLg,
  },

  // 5. Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  quickActionSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },

  // 6. Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  orderCountBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
  },
  orderCountBadgeText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 10,
  },
  seeAll: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 12,
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  emptyCtaBtn: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: spacing.borderRadiusMd,
  },
  emptyCtaText: {
    ...typography.captionBold,
    color: colors.accent,
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
