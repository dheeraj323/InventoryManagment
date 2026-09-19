import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCashStore } from '../../store/useCashStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrderStore } from '../../store/useOrderStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  ConfirmationModal,
  SettlementSuccessView,
  SettlementDetailModal,
} from '../../components/cash';
import { CashSettlement } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const CashSettlementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settlements, submitSettlement, getStaffCashInHand } = useCashStore();
  const { activeStaffId, currentUser } = useAuthStore();
  const { orders } = useOrderStore();

  const staff = {
    id: activeStaffId || 'staff-1',
    name: currentUser?.name || 'Suresh Kumar',
  };

  const expectedCash = getStaffCashInHand(staff.id, orders);
  const staffSettlements = settlements
    .filter((s) => s.staffId === staff.id)
    .sort((a, b) => {
      const timeA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : a.id.startsWith('set-')
        ? parseInt(a.id.replace('set-', ''), 10) || 0
        : 0;
      const timeB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : b.id.startsWith('set-')
        ? parseInt(b.id.replace('set-', ''), 10) || 0
        : 0;
      return timeB - timeA;
    });

  const [handedOverStr, setHandedOverStr] = useState(expectedCash.toString());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Modals state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmittedNum, setLastSubmittedNum] = useState('');
  const [selectedSettlement, setSelectedSettlement] = useState<CashSettlement | null>(null);

  const handedOverNum = parseFloat(handedOverStr) || 0;
  const variance = handedOverNum - expectedCash;

  const handleInputChange = (val: string) => {
    setHandedOverStr(val);
    if (inputError) setInputError(null);
  };

  const handleMatchExpected = () => {
    setHandedOverStr(expectedCash.toString());
    if (inputError) setInputError(null);
  };

  const handlePressSubmit = () => {
    if (!handedOverStr.trim() || isNaN(handedOverNum) || handedOverNum <= 0) {
      setInputError('Please enter a valid cash handover amount.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    try {
      const savedDoc = await submitSettlement(
        staff.id,
        staff.name,
        expectedCash,
        handedOverNum,
        notes.trim() || undefined
      );
      setSubmitting(false);
      setShowConfirmModal(false);
      setLastSubmittedNum(savedDoc.settlementNumber || 'STL-2026-10');
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error submitting cash settlement:', err);
      setSubmitting(false);
      setShowConfirmModal(false);
      Alert.alert('Submission Error', 'Failed to submit cash handover. Please try again.');
    }
  };

  const handleDoneSuccess = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Cash Handover"
        subtitle={`Staff: ${staff.name}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Hero Expected Cash & Entry Card ────────────────────── */}
        <Card style={styles.heroCard} outlined elevation="sm">
          {/* Card Top: Expected Balance */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroLabelGroup}>
              <Text style={styles.heroLabel}>EXPECTED CASH IN HAND</Text>
              <Text style={styles.heroDate}>{formattedDate}</Text>
            </View>
            <View style={styles.walletBadge}>
              <Ionicons name="wallet-outline" size={16} color={colors.brandGreen} />
            </View>
          </View>

          <Text style={styles.heroAmount}>
            ₹{expectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>

          <View style={styles.divider} />

          {/* Handover Amount Input */}
          <View style={styles.inputHeaderRow}>
            <Text style={styles.inputSectionLabel}>ACTUAL CASH HANDED OVER</Text>
            {handedOverNum !== expectedCash && (
              <TouchableOpacity
                onPress={handleMatchExpected}
                style={styles.matchBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.matchBtnText}>Match Expected</Text>
              </TouchableOpacity>
            )}
          </View>

          <Input
            value={handedOverStr}
            onChangeText={handleInputChange}
            keyboardType="numeric"
            prefix="₹"
            placeholder="0.00"
            error={inputError || undefined}
            containerStyle={styles.amountInputContainer}
          />

          {/* Inline Live Variance Badge */}
          {handedOverStr.length > 0 && !isNaN(handedOverNum) && (
            <View
              style={[
                styles.varianceBadge,
                variance === 0
                  ? styles.varianceMatch
                  : variance > 0
                  ? styles.varianceExcess
                  : styles.varianceShortage,
              ]}
            >
              <Ionicons
                name={
                  variance === 0
                    ? 'checkmark-circle'
                    : variance > 0
                    ? 'add-circle'
                    : 'alert-circle'
                }
                size={14}
                color={
                  variance === 0
                    ? colors.brandGreen
                    : variance > 0
                    ? '#B45309'
                    : colors.danger
                }
              />
              <Text
                style={[
                  styles.varianceText,
                  variance === 0
                    ? styles.varianceTextMatch
                    : variance > 0
                    ? styles.varianceTextExcess
                    : styles.varianceTextShortage,
                ]}
              >
                {variance === 0
                  ? 'Exact match with expected cash'
                  : variance > 0
                  ? `+₹${variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Excess cash`
                  : `-₹${Math.abs(variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Shortage`}
              </Text>
            </View>
          )}

          {/* Optional Note / Bag Identifier */}
          <Input
            placeholder="Notes (e.g. Cash bag #3 to Admin Desk)"
            value={notes}
            onChangeText={setNotes}
            containerStyle={styles.notesInputContainer}
          />

          {/* Submit Action */}
          <Button
            title="Submit Cash Handover"
            onPress={handlePressSubmit}
            disabled={handedOverNum <= 0}
            size="lg"
            style={styles.submitBtn}
          />
        </Card>

        {/* ── 2. Recent Settlement Records ─────────────────────────── */}
        <View style={styles.historySectionHeader}>
          <Text style={styles.historyTitle}>Handover History</Text>
          <View style={styles.historyCountBadge}>
            <Text style={styles.historyCountText}>{staffSettlements.length}</Text>
          </View>
        </View>

        {staffSettlements.length === 0 ? (
          <Card style={styles.emptyHistoryCard} outlined>
            <Ionicons name="receipt-outline" size={24} color={colors.textMuted} />
            <Text style={styles.emptyHistoryText}>No past cash handover records found.</Text>
          </Card>
        ) : (
          <Card style={styles.historyCard} outlined elevation="sm">
            {staffSettlements.map((item, index) => {
              const isVerified = item.status === 'VERIFIED';
              const itemHanded = item.handedOverCash || item.amountHandedOver || 0;
              const itemExpected = item.totalCashCollected || item.amountCollected || 0;
              const itemVariance = item.variance || item.difference || 0;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => setSelectedSettlement(item)}
                  style={[
                    styles.historyRow,
                    index < staffSettlements.length - 1 && styles.historyDivider,
                  ]}
                >
                  <View style={styles.historyMainRow}>
                    <View style={styles.historyLeft}>
                      <View style={styles.historyTitleRow}>
                        <Text style={styles.historyNum}>{item.settlementNumber}</Text>
                        <Text style={styles.historyDate}>{item.date}</Text>
                      </View>
                      <Text style={styles.historyExpectedSubtitle}>
                        Expected: ₹{itemExpected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>

                    <View style={styles.historyRight}>
                      <Text style={styles.historyAmountVal}>
                        ₹{itemHanded.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                      <StatusBadge
                        customLabel={isVerified ? 'Verified' : 'Pending'}
                        customBg={isVerified ? colors.statusDeliveredBg : colors.statusPendingBg}
                        customColor={isVerified ? colors.brandGreen : '#B45309'}
                        size="sm"
                      />
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.textMuted}
                      style={{ marginLeft: spacing.xs }}
                    />
                  </View>

                  {itemVariance !== 0 && (
                    <View
                      style={[
                        styles.historyVarianceTag,
                        itemVariance > 0 ? styles.tagExcess : styles.tagShortage,
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyVarianceTagText,
                          itemVariance > 0 ? styles.tagTextExcess : styles.tagTextShortage,
                        ]}
                      >
                        {itemVariance > 0
                          ? `+₹${itemVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Excess`
                          : `-₹${Math.abs(itemVariance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Shortage`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </Card>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmModal}
        staffName={staff.name}
        expectedCash={expectedCash}
        handedOverCash={handedOverNum}
        notes={notes}
        loading={submitting}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Success Modal */}
      <SettlementSuccessView
        visible={showSuccessModal}
        settlementNumber={lastSubmittedNum}
        handedOverCash={handedOverNum}
        onDone={handleDoneSuccess}
        onViewHistory={() => setShowSuccessModal(false)}
      />

      {/* Item Details Inspection Modal */}
      <SettlementDetailModal
        visible={!!selectedSettlement}
        settlement={selectedSettlement}
        onClose={() => setSelectedSettlement(null)}
      />
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
    marginBottom: spacing.lg,
    borderRadius: spacing.borderRadiusLg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroLabelGroup: {
    flex: 1,
  },
  heroLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  heroDate: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  walletBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmount: {
    ...typography.hero,
    fontSize: 26,
    color: colors.textPrimary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  inputSectionLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  matchBtn: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
  },
  matchBtnText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 10,
  },
  amountInputContainer: {
    marginBottom: spacing.xs,
  },
  varianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusSm,
    gap: 6,
    marginBottom: spacing.sm,
  },
  varianceMatch: {
    backgroundColor: colors.brandGreenLight,
  },
  varianceExcess: {
    backgroundColor: colors.statusPendingBg,
  },
  varianceShortage: {
    backgroundColor: colors.statusCancelledBg,
  },
  varianceText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  varianceTextMatch: {
    color: colors.brandGreen,
  },
  varianceTextExcess: {
    color: '#B45309',
  },
  varianceTextShortage: {
    color: colors.danger,
  },
  notesInputContainer: {
    marginBottom: spacing.xs,
  },
  submitBtn: {
    backgroundColor: colors.navy,
    marginTop: spacing.xs,
    borderRadius: spacing.borderRadiusLg,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  historyTitle: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  historyCountBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
  },
  historyCountText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  historyCard: {
    padding: 0,
    borderRadius: spacing.borderRadiusLg,
    overflow: 'hidden',
  },
  historyRow: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  historyDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  historyMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLeft: {
    flex: 1,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyNum: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  historyDate: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  historyExpectedSubtitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  historyAmountVal: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  historyVarianceTag: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tagExcess: {
    backgroundColor: colors.statusPendingBg,
  },
  tagShortage: {
    backgroundColor: colors.statusCancelledBg,
  },
  historyVarianceTagText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  tagTextExcess: {
    color: '#B45309',
  },
  tagTextShortage: {
    color: colors.danger,
  },
  emptyHistoryCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyHistoryText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
