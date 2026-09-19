import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCashStore } from '../../store/useCashStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { colors, typography, spacing } from '../../theme';

export const CashSettlementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settlements, submitSettlement } = useCashStore();
  const { activeStaffId, currentUser } = useAuthStore();
  const staff = {
    id: activeStaffId || 'staff-1',
    name: currentUser?.name || 'Suresh Kumar',
    cashInHand: 4200,
  };

  const staffSettlements = settlements.filter((s) => s.staffId === staff.id);

  const [handedOverStr, setHandedOverStr] = useState(staff.cashInHand.toString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const expectedCash = staff.cashInHand;
  const handedOverNum = parseFloat(handedOverStr) || 0;
  const variance = handedOverNum - expectedCash;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await submitSettlement(
        staff.id,
        staff.name,
        expectedCash,
        handedOverNum,
        notes.trim() || undefined
      );
      setLoading(false);
      navigation.goBack();
    } catch (err) {
      console.error('Error submitting cash settlement:', err);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Cash Handover"
        subtitle={`Staff: ${staff.name}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Hero Expected Cash Card */}
        <Card variant="flat" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconContainer}>
              <Ionicons name="wallet-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.heroTextGroup}>
              <Text style={styles.heroLabel}>EXPECTED CASH IN HAND</Text>
              <Text style={styles.heroSubtext}>Calculated from today's order collections</Text>
            </View>
          </View>
          <Text style={styles.heroAmount}>
            ₹{expectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </Card>

        {/* 2. Handover Form Card */}
        <Card variant="flat" style={styles.formCard}>
          <Text style={styles.sectionHeaderTitle}>End of Day Handover</Text>
          <Text style={styles.sectionSubTitle}>
            Count your physical cash and enter the total amount to hand over to the admin.
          </Text>

          <View style={styles.inputSpacing}>
            <Input
              label="Actual Cash Handed Over (₹)"
              value={handedOverStr}
              onChangeText={setHandedOverStr}
              keyboardType="numeric"
              prefix="₹"
            />
          </View>

          {/* Dynamic Variance Status Banner */}
          <View
            style={[
              styles.varianceBanner,
              variance === 0
                ? styles.varianceMatchBanner
                : variance > 0
                ? styles.varianceExcessBanner
                : styles.varianceShortageBanner,
            ]}
          >
            <Ionicons
              name={
                variance === 0
                  ? 'checkmark-circle'
                  : variance > 0
                  ? 'alert-circle'
                  : 'warning'
              }
              size={20}
              color={
                variance === 0
                  ? colors.brandGreen
                  : variance > 0
                  ? '#D97706'
                  : colors.danger
              }
            />
            <View style={styles.varianceTextGroup}>
              <Text
                style={[
                  styles.varianceBannerTitle,
                  variance === 0
                    ? { color: colors.brandGreen }
                    : variance > 0
                    ? { color: '#D97706' }
                    : { color: colors.danger },
                ]}
              >
                {variance === 0
                  ? 'Exact Match (₹0.00)'
                  : variance > 0
                  ? `Excess Cash: +₹${variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : `Shortage: -₹${Math.abs(variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </Text>
              <Text style={styles.varianceBannerSub}>
                {variance === 0
                  ? 'Physical cash matches the expected order collection exactly.'
                  : variance > 0
                  ? 'Handed over amount is higher than expected collections.'
                  : 'Handed over amount is less than expected collections.'}
              </Text>
            </View>
          </View>

          <Input
            label="Notes / Bag Identifier (Optional)"
            placeholder="e.g. Handed cash bag #4 to Admin Desk"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          <Button
            title="Submit Cash Handover"
            onPress={handleSubmit}
            loading={loading}
            size="lg"
            style={styles.submitBtn}
          />
        </Card>

        {/* 3. Settlement History Section */}
        <Text style={styles.historyTitle}>Recent Cash Settlement Records</Text>

        <Card variant="flat" style={styles.historyCard}>
          {staffSettlements.map((item, index) => {
            const isVerified = item.status === 'VERIFIED';
            const itemHanded = item.handedOverCash || item.amountHandedOver || 0;
            const itemExpected = item.totalCashCollected || item.amountCollected || 0;
            const itemVariance = item.variance || item.difference || 0;

            return (
              <View
                key={item.id}
                style={[
                  styles.historyRow,
                  index < staffSettlements.length - 1 && styles.historyDivider,
                ]}
              >
                <View style={styles.historyTopRow}>
                  <View style={styles.historyNumGroup}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isVerified ? colors.brandGreen : colors.amber },
                      ]}
                    />
                    <Text style={styles.historyNum}>{item.settlementNumber}</Text>
                    <Text style={styles.historyDate}>• {item.date}</Text>
                  </View>
                  <StatusBadge
                    customLabel={isVerified ? 'Verified' : 'Pending Audit'}
                    customBg={isVerified ? colors.brandGreenLight : '#FEF3C7'}
                    customColor={isVerified ? colors.brandGreen : '#D97706'}
                    size="sm"
                  />
                </View>

                <View style={styles.historyAmountRow}>
                  <View>
                    <Text style={styles.historyAmountLabel}>Handed Over</Text>
                    <Text style={styles.historyAmountVal}>
                      ₹{itemHanded.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.historyRightCol}>
                    <Text style={styles.historyExpectedLabel}>
                      Expected: ₹{itemExpected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text
                      style={[
                        styles.historyVarianceVal,
                        itemVariance === 0
                          ? { color: colors.textMuted }
                          : itemVariance > 0
                          ? { color: colors.brandGreen }
                          : { color: colors.danger },
                      ]}
                    >
                      {itemVariance === 0
                        ? 'Exact Match'
                        : itemVariance > 0
                        ? `+₹${itemVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Excess`
                        : `-₹${Math.abs(itemVariance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Shortage`}
                    </Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={styles.notesPill}>
                    <Ionicons name="document-text-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
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
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandGreen,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  heroTextGroup: {
    flex: 1,
  },
  heroLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  heroSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  heroAmount: {
    ...typography.hero,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeaderTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sectionSubTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  inputSpacing: {
    marginBottom: spacing.xs,
  },
  varianceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginVertical: spacing.md,
    borderWidth: 1,
  },
  varianceMatchBanner: {
    backgroundColor: colors.brandGreenLight,
    borderColor: '#A7F3D0',
  },
  varianceExcessBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  varianceShortageBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  varianceTextGroup: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  varianceBannerTitle: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  varianceBannerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: spacing.md,
    borderRadius: spacing.borderRadiusXl,
  },
  historyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  historyCard: {
    padding: 0,
    overflow: 'hidden',
  },
  historyRow: {
    padding: spacing.lg,
  },
  historyDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  historyNumGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  historyNum: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  historyDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  historyAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyAmountLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  historyAmountVal: {
    ...typography.currency,
    color: colors.textPrimary,
    marginTop: 2,
  },
  historyRightCol: {
    alignItems: 'flex-end',
  },
  historyExpectedLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  historyVarianceVal: {
    ...typography.captionBold,
    marginTop: 2,
  },
  notesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  notesText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 4,
  },
});

