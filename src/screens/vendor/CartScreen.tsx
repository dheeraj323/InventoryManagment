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
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useVendorStore } from '../../store/useVendorStore';
import { BUSINESS_RULES } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { CartItemRow } from '../../components/catalog/CartItemRow';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing } from '../../theme';

export const CartScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { items, updateQty, getSubtotal, getTax, getTotal, clearCart } = useCartStore();
  const { activeVendorId } = useAuthStore();
  const { getPartyRunningBalance } = useLedgerStore();
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

  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();

  const exceedsCredit = total > remainingCredit;

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Your Order Cart" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="cart-outline"
            title="Your Cart is Empty"
            description="Add wholesale products from our catalog to start building your order."
            actionTitle="Browse Catalogue"
            onAction={() => navigation.navigate('ProductCatalog')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Review Cart Items"
        subtitle={`${items.length} Product Types`}
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={clearCart}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ordering Window Cutoff Reminder */}
        <View style={styles.cutoffBanner}>
          <Ionicons name="time-outline" size={16} color={colors.statusPendingText} />
          <Text style={styles.cutoffText}>{BUSINESS_RULES.ORDER_CUTOFF_LABEL}</Text>
        </View>

        {/* Cart Itemized List */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>ORDERED ITEMS</Text>
          {items.map((item) => (
            <CartItemRow
              key={item.productId}
              item={item}
              onUpdateQty={(delta) => updateQty(item.productId, delta)}
            />
          ))}
        </Card>

        {/* Bill Summary Breakdown */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>BILL SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax / GST (5%)</Text>
            <Text style={styles.summaryVal}>₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalVal}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </Card>

        {/* Vendor Credit Status Warning */}
        <Card
          style={[styles.card, exceedsCredit ? styles.exceedsCard : null]}
          outlined
          elevation="sm"
        >
          <View style={styles.creditHeader}>
            <Ionicons
              name={exceedsCredit ? 'alert-circle' : 'shield-checkmark-outline'}
              size={18}
              color={exceedsCredit ? colors.danger : colors.success}
            />
            <Text
              style={[
                styles.creditTitle,
                exceedsCredit ? styles.creditTitleDanger : null,
              ]}
            >
              Vendor Pay Later Credit Check
            </Text>
          </View>
          <Text style={styles.creditDesc}>
            Available Line of Credit: ₹{remainingCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Limit: ₹{vendor.creditLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
          </Text>
          {exceedsCredit && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                 Order total (₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) exceeds your available credit line (₹{remainingCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}). Pay Later will be blocked at checkout — settle via cash or online.
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Checkout Button */}
      <View style={styles.footerContainer}>
        <Button
          title="Proceed to Checkout"
          onPress={() => navigation.navigate('CheckoutScreen')}
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    padding: spacing.screenPadding,
    justifyContent: 'center',
  },
  clearText: {
    ...typography.captionBold,
    color: colors.danger,
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
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  totalVal: {
    ...typography.currencyLarge,
    color: colors.primary,
  },
  exceedsCard: {
    borderColor: colors.danger,
    backgroundColor: colors.debitLight,
  },
  creditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  creditTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  creditTitleDanger: {
    color: colors.danger,
  },
  creditDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontSize: 11,
  },
  footerContainer: {
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
