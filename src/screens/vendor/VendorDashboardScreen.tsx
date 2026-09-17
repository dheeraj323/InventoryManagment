import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useCartStore } from '../../store/useCartStore';
import { useVendorStore } from '../../store/useVendorStore';
import { BUSINESS_RULES } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { OrderCard } from '../../components/orders/OrderCard';
import { LedgerSummaryCard } from '../../components/ledger/LedgerSummaryCard';
import { colors, typography, spacing } from '../../theme';

export const VendorDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { switchRole, activeRole, activeVendorId } = useAuthStore();
  const { getOrdersByVendor } = useOrderStore();
  const { getPartyRunningBalance } = useLedgerStore();
  const { getItemCount } = useCartStore();
  const { getVendorById } = useVendorStore();

  const vendor = getVendorById(activeVendorId) || {
    id: activeVendorId || 'vendor-1',
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '',
    address: '',
    area: '',
    creditLimit: 10000,
    currentBalance: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };

  const runningBalance = getPartyRunningBalance(vendor.id);
  const remainingCredit = Math.max(0, vendor.creditLimit - runningBalance);
  const vendorOrders = getOrdersByVendor(vendor.id);
  const recentOrders = vendorOrders.slice(0, 3);
  const cartCount = getItemCount();

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={vendor.shopName}
        subtitle={`Welcome, ${vendor.name}`}
        activeRole={activeRole}
        onRoleSwitch={() => switchRole('STAFF')}
        rightAction={
          <TouchableOpacity
            style={styles.cartIconBtn}
            onPress={() => navigation.navigate('Cart')}
          >
            <Ionicons name="cart-outline" size={24} color={colors.primary} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ordering Cutoff Window Banner */}
        <View style={styles.cutoffBanner}>
          <Ionicons name="time-outline" size={18} color={colors.statusPendingText} />
          <Text style={styles.cutoffText}>{BUSINESS_RULES.ORDER_CUTOFF_LABEL}</Text>
        </View>

        {/* Ledger Balance Card (Khatabook Inspired) */}
        <TouchableOpacity
          onPress={() => navigation.navigate('VendorLedger')}
          activeOpacity={0.9}
        >
          <LedgerSummaryCard
            currentBalance={runningBalance}
            partyName={`${vendor.shopName} Ledger`}
          />
        </TouchableOpacity>

        {/* Credit Limit Gauge Bar */}
        <Card style={styles.creditCard} outlined elevation="sm">
          <View style={styles.creditRow}>
            <Text style={styles.creditLabel}>Vendor Credit Line (Pay Later)</Text>
            <Text style={styles.creditVal}>
              ${remainingCredit.toFixed(2)} Available / ${vendor.creditLimit.toFixed(2)}
            </Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View
              style={[
                styles.gaugeFill,
                { width: `${Math.min(100, (runningBalance / vendor.creditLimit) * 100)}%` },
              ]}
            />
          </View>
        </Card>

        {/* Primary Action Button */}
        <View style={styles.primaryActionContainer}>
          <Button
            title="BROWSE CATALOG & PLACE ORDER"
            onPress={() => navigation.navigate('ProductCatalog')}
            icon={<Ionicons name="cart-outline" size={20} color={colors.textInverse} />}
            size="lg"
          />
        </View>

        {/* Recent Orders Section (Zomato Inspired) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VendorOrders')}>
            <Text style={styles.seeAllText}>See All ({vendorOrders.length})</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No orders placed yet.</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cartIconBtn: {
    padding: 6,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 10,
  },
  scrollContent: {
    padding: spacing.screenPadding,
  },
  cutoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusPendingBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  cutoffText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    marginLeft: spacing.sm,
  },
  creditCard: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  creditLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  creditVal: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 11,
  },
  gaugeTrack: {
    height: 8,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  primaryActionContainer: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  seeAllText: {
    ...typography.captionBold,
    color: colors.accent,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
