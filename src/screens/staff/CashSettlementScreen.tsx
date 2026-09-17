import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
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
        title="Staff Cash Settlement"
        subtitle={`Staff: ${staff.name}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Unsettled Cash Form Card */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>SUBMIT END-OF-DAY CASH HANDOVER</Text>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Expected Cash in Hand (from orders)</Text>
            <Text style={styles.statVal}>${expectedCash.toFixed(2)}</Text>
          </View>

          <Input
            label="Actual Cash Handed Over to Admin ($)"
            value={handedOverStr}
            onChangeText={setHandedOverStr}
            keyboardType="numeric"
            prefix="$"
          />

          <View style={styles.varianceRow}>
            <Text style={styles.varianceLabel}>Calculated Variance</Text>
            <Text
              style={[
                styles.varianceVal,
                variance === 0
                  ? styles.varianceMatch
                  : variance > 0
                  ? styles.varianceExcess
                  : styles.varianceShortage,
              ]}
            >
              {variance === 0
                ? 'Exact Match ($0.00)'
                : variance > 0
                ? `+$${variance.toFixed(2)} (Excess)`
                : `-$${Math.abs(variance).toFixed(2)} (Shortage)`}
            </Text>
          </View>

          <Input
            label="Handover Notes / Bag Number"
            placeholder="e.g. Handed cash bag #4 to Admin Desk"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          <Button
            title="SUBMIT SETTLEMENT FOR ADMIN VERIFICATION"
            onPress={handleSubmit}
            loading={loading}
            size="md"
            style={styles.submitBtn}
          />
        </Card>

        {/* Settlement History List */}
        <Text style={styles.sectionTitle}>Recent Cash Settlement Records</Text>

        {staffSettlements.map((item) => (
          <Card key={item.id} style={styles.settlementRowCard} outlined elevation="sm">
            <View style={styles.settlementHeader}>
              <View>
                <Text style={styles.settlementNum}>{item.settlementNumber}</Text>
                <Text style={styles.settlementDate}>{item.date}</Text>
              </View>
              <StatusBadge
                customLabel={
                  item.status === 'VERIFIED'
                    ? 'Verified by Admin'
                    : 'Pending Verification'
                }
                customBg={
                  item.status === 'VERIFIED'
                    ? colors.statusDeliveredBg
                    : colors.statusPendingBg
                }
                customColor={
                  item.status === 'VERIFIED'
                    ? colors.statusDeliveredText
                    : colors.statusPendingText
                }
                size="sm"
              />
            </View>

            <View style={styles.settlementDetails}>
              <Text style={styles.detailText}>
                Handed Over: ${(item.handedOverCash || item.amountHandedOver || 0).toFixed(2)} (Expected:${' '}
                ${(item.totalCashCollected || item.amountCollected || 0).toFixed(2)})
              </Text>
              <Text
                style={[
                  styles.detailText,
                  (item.variance || item.difference || 0) !== 0 ? { color: colors.danger } : null,
                ]}
              >
                Variance: ${(item.variance || item.difference || 0).toFixed(2)}
              </Text>
              {item.notes && <Text style={styles.notesText}>Note: {item.notes}</Text>}
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
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
  },
  statLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  statVal: {
    ...typography.currency,
    color: colors.primary,
  },
  varianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  varianceLabel: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  varianceVal: {
    ...typography.bodyBold,
  },
  varianceMatch: {
    color: colors.success,
  },
  varianceExcess: {
    color: colors.accent,
  },
  varianceShortage: {
    color: colors.danger,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  settlementRowCard: {
    marginBottom: spacing.md,
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  settlementNum: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  settlementDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  settlementDetails: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginTop: 4,
  },
  detailText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  notesText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
