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
  ExpectedCashCard,
  ReconciliationCard,
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

  // Modals state machine
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmittedNum, setLastSubmittedNum] = useState('');
  const [selectedSettlement, setSelectedSettlement] = useState<CashSettlement | null>(null);
  const handedOverNum = parseFloat(handedOverStr) || 0;

  const handleInputChange = (val: string) => {
    setHandedOverStr(val);
    if (inputError) setInputError(null);
  };

  const handlePressSubmit = () => {
    if (!handedOverStr.trim() || isNaN(handedOverNum) || handedOverNum <= 0) {
      setInputError('Cash handover amount must be greater than ₹0.00');
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
        <ExpectedCashCard amount={expectedCash} />

        {/* 2. Handover Entry Form Card */}
        <Card variant="flat" style={styles.formCard}>
          <Text style={styles.sectionHeaderTitle}>End of Day Handover</Text>
          <Text style={styles.sectionSubTitle}>
            Count your physical cash and enter the total amount to hand over to the admin.
          </Text>

          <Input
            label="Actual Cash Handed Over (₹)"
            value={handedOverStr}
            onChangeText={handleInputChange}
            keyboardType="numeric"
            prefix="₹"
            error={inputError || undefined}
          />

          {/* Real-time Reconciliation Card */}
          <ReconciliationCard expected={expectedCash} handedOver={handedOverNum} />

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
            onPress={handlePressSubmit}
            disabled={handedOverNum <= 0}
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
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => setSelectedSettlement(item)}
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
                        { backgroundColor: isVerified ? colors.brandGreen : '#D97706' },
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
              </TouchableOpacity>
            );
          })}
        </Card>
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

      {/* Success Celebration Modal */}
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
  submitBtn: {
    backgroundColor: colors.navy,
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


