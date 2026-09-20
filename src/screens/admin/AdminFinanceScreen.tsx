import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  SectionList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useVendorStore } from '../../store/useVendorStore';
import { Header } from '../../components/common/Header';
import { colors, typography, spacing } from '../../theme';

export const AdminFinanceScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getVendorAccountSummary } = useLedgerStore();
  const { suppliers } = useInventoryStore();
  const { vendors } = useVendorStore();

  // Build enriched vendor rows using VendorAccountSummary for consistent calculation
  const vendorBalances = vendors.map((v) => {
    const summary = getVendorAccountSummary(v.id, v);
    return {
      ...v,
      balance: summary.currentOutstanding,
    };
  });

  const totalVendorReceivables = vendorBalances.reduce(
    (sum, v) => sum + (v.balance > 0 ? v.balance : 0),
    0
  );

  const totalSupplierPayables = suppliers.reduce(
    (sum, s) => sum + (s.balancePayable || s.outstandingPayable || 0),
    0
  );

  const netBalance = totalVendorReceivables - totalSupplierPayables;
  const isNetPositive = netBalance >= 0;

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Get initials for avatar
  const getInitials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

  // SectionList data
  const sections: {
    title: string;
    count: number;
    data: any[];
    type: 'vendor' | 'supplier';
  }[] = [
    {
      title: 'Vendor Receivables',
      count: vendorBalances.length,
      data: vendorBalances,
      type: 'vendor',
    },
    {
      title: 'Supplier Payables',
      count: suppliers.length,
      data: suppliers,
      type: 'supplier',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Finance"
        subtitle="Receivables & Payables"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          /* ── Hero net position card ──────────────────────────────── */
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Net Working Capital</Text>
            <Text style={[styles.heroAmount, { color: isNetPositive ? colors.brandGreen : colors.debit }]}>
              {isNetPositive ? '+' : '−'}₹{fmt(Math.abs(netBalance))}
            </Text>

            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <View style={[styles.heroDot, { backgroundColor: colors.brandGreen }]} />
                <View>
                  <Text style={styles.heroStatLabel}>Vendor Receivables</Text>
                  <Text style={[styles.heroStatValue, { color: colors.brandGreen }]}>
                    ₹{fmt(totalVendorReceivables)}
                  </Text>
                </View>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <View style={[styles.heroDot, { backgroundColor: colors.debit }]} />
                <View>
                  <Text style={styles.heroStatLabel}>Supplier Payables</Text>
                  <Text style={[styles.heroStatValue, { color: colors.debit }]}>
                    ₹{fmt(totalSupplierPayables)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.count}</Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          if (section.type === 'vendor') {
            const v = item as typeof vendorBalances[0];
            const isPositive = v.balance > 0;
            return (
              <TouchableOpacity
                style={styles.partyRow}
                onPress={() => navigation.navigate('VendorDetail', { vendorId: v.id })}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: colors.brandGreenLight }]}>
                  <Text style={[styles.avatarText, { color: colors.brandGreen }]}>
                    {getInitials(v.shopName)}
                  </Text>
                </View>
                <View style={styles.partyInfo}>
                  <Text style={styles.partyName} numberOfLines={1}>{v.shopName}</Text>
                  <Text style={styles.partyMeta}>{v.name} · {v.area}</Text>
                </View>
                <View style={styles.partyBalance}>
                  <Text style={styles.balanceLabel}>Due Balance</Text>
                  <Text style={[styles.balanceValue, { color: isPositive ? colors.brandGreen : colors.textSecondary }]}>
                    ₹{fmt(v.balance)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          } else {
            const s = item as typeof suppliers[0];
            const payable = s.balancePayable || s.outstandingPayable || 0;
            return (
              <View style={styles.partyRow}>
                <View style={[styles.avatar, { backgroundColor: colors.debitLight }]}>
                  <Text style={[styles.avatarText, { color: colors.debit }]}>
                    {getInitials(s.name)}
                  </Text>
                </View>
                <View style={styles.partyInfo}>
                  <Text style={styles.partyName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.partyMeta}>{s.category}</Text>
                </View>
                <View style={styles.partyBalance}>
                  <Text style={styles.balanceLabel}>Payable</Text>
                  <Text style={[styles.balanceValue, { color: colors.debit }]}>
                    ₹{fmt(payable)}
                  </Text>
                </View>
              </View>
            );
          }
        }}
        ItemSeparatorComponent={() => <View style={styles.itemDivider} />}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },

  // Hero card — white, clean, no dark background
  heroCard: {
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.lg,
    marginBottom: spacing.sectionGap,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusXl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  heroAmount: {
    ...typography.hero,
    marginBottom: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  heroStatLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 3,
  },
  heroStatValue: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 11,
  },
  sectionCount: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 11,
  },

  // Party rows (vendor / supplier)
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  avatarText: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  partyInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  partyName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  partyMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  partyBalance: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 2,
  },
  balanceValue: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  itemDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing.screenPadding + 40 + spacing.md, // past avatar
  },
});
