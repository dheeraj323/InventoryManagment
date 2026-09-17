import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useVendorStore } from '../../store/useVendorStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { colors, typography, spacing } from '../../theme';

export const AdminFinanceScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getPartyRunningBalance } = useLedgerStore();
  const { suppliers } = useInventoryStore();
  const { vendors } = useVendorStore();

  const vendorBalances = vendors.map((v) => ({
    ...v,
    balance: getPartyRunningBalance(v.id),
  }));

  const totalVendorReceivables = vendorBalances.reduce(
    (sum, v) => sum + (v.balance > 0 ? v.balance : 0),
    0
  );

  const totalSupplierPayables = suppliers.reduce(
    (sum, s) => sum + (s.balancePayable || s.outstandingPayable || 0),
    0
  );

  const netBalance = totalVendorReceivables - totalSupplierPayables;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Finance & Ledgers"
        subtitle="Receivables & Payables Overview"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Master Net Position Card */}
        <Card style={styles.masterCard} outlined elevation="md">
          <Text style={styles.masterLabel}>NET WORKING CAPITAL BALANCE</Text>
          <Text
            style={[
              styles.masterVal,
              netBalance >= 0 ? styles.positiveVal : styles.negativeVal,
            ]}
          >
            ${netBalance.toFixed(2)}
          </Text>

          <View style={styles.masterDivider} />

          <View style={styles.masterRow}>
            <View style={styles.masterCol}>
              <Text style={styles.subLabel}>Total Vendor Receivables</Text>
              <Text style={[styles.subVal, { color: '#F87171' }]}>
                ${totalVendorReceivables.toFixed(2)}
              </Text>
            </View>
            <View style={styles.verticalLine} />
            <View style={styles.masterCol}>
              <Text style={styles.subLabel}>Total Supplier Payables</Text>
              <Text style={[styles.subVal, { color: '#4ADE80' }]}>
                ${totalSupplierPayables.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Vendor Receivables Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vendor Receivables Directory</Text>
        </View>

        {vendorBalances.map((v) => (
          <Card
            key={v.id}
            style={styles.partyCard}
            onPress={() => navigation.navigate('VendorDetail', { vendorId: v.id })}
            outlined
            elevation="sm"
          >
            <View style={styles.partyRow}>
              <View style={styles.partyInfo}>
                <Text style={styles.shopName}>{v.shopName}</Text>
                <Text style={styles.ownerName}>{v.name} • {v.area}</Text>
              </View>
              <View style={styles.partyBalanceCol}>
                <Text style={styles.balanceLabel}>Due Balance</Text>
                <Text
                  style={[
                    styles.balanceVal,
                    v.balance > 0 ? styles.dueText : styles.clearText,
                  ]}
                >
                  ${v.balance.toFixed(2)}
                </Text>
              </View>
            </View>
          </Card>
        ))}

        {/* Supplier Payables Shortcut Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Supplier Payables Directory</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Supplier')}>
            <Text style={styles.seeAllText}>View All ({suppliers.length})</Text>
          </TouchableOpacity>
        </View>

        {suppliers.map((s) => (
          <Card key={s.id} style={styles.partyCard} outlined elevation="sm">
            <View style={styles.partyRow}>
              <View style={styles.partyInfo}>
                <Text style={styles.shopName}>{s.name}</Text>
                <Text style={styles.ownerName}>{s.category}</Text>
              </View>
              <View style={styles.partyBalanceCol}>
                <Text style={styles.balanceLabel}>Payable</Text>
                <Text style={[styles.balanceVal, styles.dueText]}>
                  ${(s.balancePayable || s.outstandingPayable || 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.screenPadding,
  },
  masterCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  masterLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  masterVal: {
    ...typography.currencyLarge,
    fontSize: 26,
    marginTop: 2,
  },
  positiveVal: {
    color: '#4ADE80',
  },
  negativeVal: {
    color: '#F87171',
  },
  masterDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: spacing.md,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterCol: {
    flex: 1,
  },
  subLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  subVal: {
    ...typography.bodyBold,
    marginTop: 2,
  },
  verticalLine: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
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
  partyCard: {
    marginBottom: spacing.md,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partyInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  shopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  ownerName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  partyBalanceCol: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
  },
  balanceVal: {
    ...typography.currency,
  },
  dueText: {
    color: colors.debit,
  },
  clearText: {
    color: colors.credit,
  },
});
