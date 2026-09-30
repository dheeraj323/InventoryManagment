import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StaffDailyStockSession } from '../../types';
import { useStaffStockStore } from '../../store/useStaffStockStore';
import { colors, typography, spacing, shadows } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

interface EveningStockReturnModalProps {
  visible: boolean;
  onClose: () => void;
  staffId: string;
  session: StaffDailyStockSession | null;
}

export const EveningStockReturnModal: React.FC<EveningStockReturnModalProps> = ({
  visible,
  onClose,
  staffId,
  session,
}) => {
  const { returnEveningStock, isSaving } = useStaffStockStore();

  // Return quantities: Record<productId, { returnedQty: number; damagedQty: number; missingQty: number }>
  const [returnMap, setReturnMap] = useState<
    Record<string, { returnedQty: number; damagedQty: number; missingQty: number }>
  >({});
  const [notes, setNotes] = useState('');

  // Initialize return map with expected leftovers when modal opens
  useEffect(() => {
    if (session && session.items) {
      const initial: Record<
        string,
        { returnedQty: number; damagedQty: number; missingQty: number }
      > = {};
      session.items.forEach((item) => {
        const expected = Math.max(0, item.loadedQty - item.deliveredQty);
        initial[item.productId] = {
          returnedQty:
            item.returnedQty !== undefined && item.returnedQty > 0
              ? item.returnedQty
              : expected,
          damagedQty: item.damagedQty || 0,
          missingQty: item.missingQty || 0,
        };
      });
      setReturnMap(initial);
      setNotes(session.notes || '');
    }
  }, [session, visible]);

  const handleUpdateReturned = (productId: string, val: number) => {
    setReturnMap((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        returnedQty: Math.max(0, val),
      },
    }));
  };

  const handleUpdateDamaged = (productId: string, val: number) => {
    setReturnMap((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        damagedQty: Math.max(0, val),
      },
    }));
  };

  const handleUpdateMissing = (productId: string, val: number) => {
    setReturnMap((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        missingQty: Math.max(0, val),
      },
    }));
  };

  // Calculations
  const calculatedItems = useMemo(() => {
    if (!session || !session.items) return [];

    return session.items.map((item) => {
      const entry = returnMap[item.productId] || {
        returnedQty: 0,
        damagedQty: 0,
        missingQty: 0,
      };
      const expectedLeftover = Math.max(0, item.loadedQty - item.deliveredQty);
      const variance =
        expectedLeftover - (entry.returnedQty + entry.damagedQty + entry.missingQty);

      return {
        ...item,
        expectedLeftover,
        returnedQty: entry.returnedQty,
        damagedQty: entry.damagedQty,
        missingQty: entry.missingQty,
        variance,
      };
    });
  }, [session, returnMap]);

  const summary = useMemo(() => {
    const totalLoaded = session?.totalLoadedUnits || 0;
    const totalDelivered = session?.totalDeliveredUnits || 0;
    const totalReturned = calculatedItems.reduce((sum, it) => sum + it.returnedQty, 0);
    const totalDamaged = calculatedItems.reduce((sum, it) => sum + it.damagedQty, 0);
    const totalMissing = calculatedItems.reduce((sum, it) => sum + it.missingQty, 0);
    const totalVariance = calculatedItems.reduce((sum, it) => sum + Math.abs(it.variance), 0);
    const hasDiscrepancy = calculatedItems.some((it) => it.variance !== 0);

    return {
      totalLoaded,
      totalDelivered,
      totalReturned,
      totalDamaged,
      totalMissing,
      totalVariance,
      hasDiscrepancy,
    };
  }, [session, calculatedItems]);

  const handleConfirmReturn = async () => {
    if (!session) return;

    if (summary.hasDiscrepancy) {
      Alert.alert(
        'Unaccounted Variance',
        `There is a variance of ${summary.totalVariance} unit(s) between expected vehicle stock and accounted items. Do you want to submit with discrepancy flag for Admin review?`,
        [
          { text: 'Review Quantities', style: 'cancel' },
          {
            text: 'Submit with Discrepancy',
            onPress: () => submitReturnAction(),
          },
        ]
      );
    } else {
      await submitReturnAction();
    }
  };

  const submitReturnAction = async () => {
    try {
      const payload = calculatedItems.map((it) => ({
        productId: it.productId,
        returnedQty: it.returnedQty,
        damagedQty: it.damagedQty,
        missingQty: it.missingQty,
      }));

      await returnEveningStock({
        staffId,
        items: payload,
        notes: notes.trim() || undefined,
        date: session?.date,
      });

      Alert.alert(
        'Day-End Stock Settlement Complete',
        `• ${summary.totalReturned} good condition leftover units restocked to inventory.\n• ${summary.totalDamaged} damaged & ${summary.totalMissing} missing units logged as loss (NOT added to stock).`,
        [
          {
            text: 'OK',
            onPress: () => onClose(),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Return Error', getFriendlyErrorMessage(err, 'Failed to submit evening stock return. Please try again.'));
    }
  };

  if (!session || !session.items || session.items.length === 0) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Evening Stock Return</Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Stock Session</Text>
              <Text style={styles.emptySubtitle}>
                No morning stock was recorded for today.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop Touch Dismiss */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />

          {/* Modal Sheet */}
          <View style={styles.modalSheet}>
            {/* Drag Handle */}
            <View style={styles.sheetHandle}>
              <View style={styles.sheetHandleBar} />
            </View>

            {/* Header */}
            <View style={styles.modalHeaderRow}>
                  <View>
                    <View style={styles.titleBadgeRow}>
                      <View style={styles.eveningIconWrap}>
                        <Ionicons name="moon-outline" size={16} color={colors.accent} />
                      </View>
                      <Text style={styles.modalTitle}>Day-End Stock Return</Text>
                    </View>
                    <Text style={styles.modalSubtitle}>
                      Restock good leftovers; log damaged & missing items
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Information Banner */}
                <View style={styles.infoBanner}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.brandGreen} />
                  <Text style={styles.infoBannerText}>
                    <Text style={{ fontWeight: '700' }}>Only Good Leftover Stock</Text> is returned to warehouse inventory. Damaged & Missing stock are recorded as loss without increasing inventory.
                  </Text>
                </View>

                {/* KPI Metrics Strip */}
                <View style={styles.metricStrip}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>LOADED</Text>
                    <Text style={styles.metricVal}>{summary.totalLoaded}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>DELIVERED</Text>
                    <Text style={[styles.metricVal, { color: colors.brandGreen }]}>
                      {summary.totalDelivered}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>RESTOCKING</Text>
                    <Text style={[styles.metricVal, { color: colors.accent }]}>
                      {summary.totalReturned}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>VARIANCE</Text>
                    <Text
                      style={[
                        styles.metricVal,
                        { color: summary.hasDiscrepancy ? colors.danger : colors.brandGreen },
                      ]}
                    >
                      {summary.totalVariance === 0 ? '0' : `±${summary.totalVariance}`}
                    </Text>
                  </View>
                </View>

                {/* Items List */}
                <FlatList
                  data={calculatedItems}
                  keyExtractor={(item) => item.productId}
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                  bounces={true}
                  renderItem={({ item }) => {
                    const hasItemVariance = item.variance !== 0;

                    return (
                      <View
                        style={[
                          styles.itemCard,
                          hasItemVariance && styles.itemCardDiscrepancy,
                        ]}
                      >
                        {/* Top: Product Name + Stats Badges */}
                        <View style={styles.itemTopRow}>
                          <View style={{ flex: 1, marginRight: spacing.sm }}>
                            <Text style={styles.itemProductName} numberOfLines={1}>
                              {item.productName}
                            </Text>
                            <Text style={styles.itemUnit}>{item.unit}</Text>
                          </View>

                          {/* Variance Status Pill */}
                          <View
                            style={[
                              styles.variancePill,
                              !hasItemVariance
                                ? styles.variancePillMatch
                                : item.variance > 0
                                ? styles.variancePillShortage
                                : styles.variancePillExcess,
                            ]}
                          >
                            <Ionicons
                              name={!hasItemVariance ? 'checkmark-circle' : 'alert-circle'}
                              size={12}
                              color={
                                !hasItemVariance
                                  ? colors.brandGreen
                                  : item.variance > 0
                                  ? colors.danger
                                  : '#D97706'
                              }
                            />
                            <Text
                              style={[
                                styles.variancePillText,
                                !hasItemVariance
                                  ? styles.variancePillTextMatch
                                  : item.variance > 0
                                  ? styles.variancePillTextShortage
                                  : styles.variancePillTextExcess,
                              ]}
                            >
                              {!hasItemVariance
                                ? 'Balanced'
                                : item.variance > 0
                                ? `Shortage: -${item.variance}`
                                : `Excess: +${Math.abs(item.variance)}`}
                            </Text>
                          </View>
                        </View>

                        {/* Middle: Breakdown Badges */}
                        <View style={styles.statBreakdownRow}>
                          <View style={styles.statBadge}>
                            <Text style={styles.statBadgeLabel}>Loaded:</Text>
                            <Text style={styles.statBadgeVal}>{item.loadedQty}</Text>
                          </View>
                          <View style={styles.statBadge}>
                            <Text style={styles.statBadgeLabel}>Delivered:</Text>
                            <Text style={[styles.statBadgeVal, { color: colors.brandGreen }]}>
                              {item.deliveredQty}
                            </Text>
                          </View>
                          <View style={[styles.statBadge, styles.statBadgeExpected]}>
                            <Text style={styles.statBadgeLabel}>Expected Van:</Text>
                            <Text style={[styles.statBadgeVal, { color: colors.primary }]}>
                              {item.expectedLeftover}
                            </Text>
                          </View>
                        </View>

                        {/* Bottom: 3-column input for Good Returned, Damaged, and Missing */}
                        <View style={styles.inputsRow}>
                          {/* Good Condition (Restocked) */}
                          <View style={styles.inputCol}>
                            <Text style={styles.inputColLabel}>Good Leftover (Restock)</Text>
                            <View style={[styles.inputWrap, { borderColor: colors.brandGreen }]}>
                              <TextInput
                                style={[styles.numberInput, { color: colors.brandGreen }]}
                                keyboardType="number-pad"
                                value={item.returnedQty.toString()}
                                onChangeText={(txt) => {
                                  const num = parseInt(txt, 10);
                                  handleUpdateReturned(item.productId, isNaN(num) ? 0 : num);
                                }}
                              />
                            </View>
                          </View>

                          {/* Damaged (Not restocked) */}
                          <View style={styles.inputCol}>
                            <Text style={styles.inputColLabel}>Damaged (Loss)</Text>
                            <View style={styles.inputWrap}>
                              <TextInput
                                style={[
                                  styles.numberInput,
                                  item.damagedQty > 0 && { color: colors.danger },
                                ]}
                                keyboardType="number-pad"
                                value={item.damagedQty.toString()}
                                onChangeText={(txt) => {
                                  const num = parseInt(txt, 10);
                                  handleUpdateDamaged(item.productId, isNaN(num) ? 0 : num);
                                }}
                              />
                            </View>
                          </View>

                          {/* Missing (Not restocked) */}
                          <View style={styles.inputCol}>
                            <Text style={styles.inputColLabel}>Missing (Loss)</Text>
                            <View style={styles.inputWrap}>
                              <TextInput
                                style={[
                                  styles.numberInput,
                                  item.missingQty > 0 && { color: '#B45309' },
                                ]}
                                keyboardType="number-pad"
                                value={item.missingQty.toString()}
                                onChangeText={(txt) => {
                                  const num = parseInt(txt, 10);
                                  handleUpdateMissing(item.productId, isNaN(num) ? 0 : num);
                                }}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                  ListFooterComponent={
                    <View style={styles.notesSection}>
                      <Text style={styles.notesLabel}>SETTLEMENT NOTES / REMARKS</Text>
                      <TextInput
                        style={styles.notesInput}
                        placeholder="Day-end settlement notes / damage reasons (optional)..."
                        placeholderTextColor={colors.textMuted}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  }
                />

                {/* Footer Action */}
                <View style={styles.footerContainer}>
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      isSaving && styles.submitBtnDisabled,
                      summary.hasDiscrepancy && { backgroundColor: '#B45309' },
                    ]}
                    onPress={handleConfirmReturn}
                    disabled={isSaving}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={summary.hasDiscrepancy ? 'warning-outline' : 'checkmark-done-circle'}
                      size={18}
                      color={colors.textInverse}
                    />
                    <Text style={styles.submitBtnText}>
                      {isSaving
                        ? 'Restocking Inventory...'
                        : summary.hasDiscrepancy
                        ? `Submit Return with Discrepancy (${summary.totalVariance} units)`
                        : `Confirm Return (${summary.totalReturned} units restocked to Wh)`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      );
    };

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    height: '88%',
    maxHeight: '92%',
    ...shadows.md,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eveningIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#DCFCE7',
    gap: 8,
  },
  infoBannerText: {
    ...typography.caption,
    color: '#166534',
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  metricStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.xs + 2,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  metricLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  metricVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
    marginTop: 1,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: 16,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  itemCardDiscrepancy: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemProductName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  itemUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  variancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  variancePillMatch: {
    backgroundColor: '#DCFCE7',
  },
  variancePillShortage: {
    backgroundColor: '#FEE2E2',
  },
  variancePillExcess: {
    backgroundColor: '#FEF3C7',
  },
  variancePillText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  variancePillTextMatch: {
    color: colors.brandGreen,
  },
  variancePillTextShortage: {
    color: colors.danger,
  },
  variancePillTextExcess: {
    color: '#D97706',
  },
  statBreakdownRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  statBadgeExpected: {
    backgroundColor: '#EFF6FF',
  },
  statBadgeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 9,
  },
  statBadgeVal: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 10,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  inputCol: {
    flex: 1,
  },
  inputColLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 8,
    marginBottom: 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusSm,
    paddingHorizontal: 6,
    height: 32,
  },
  numberInput: {
    flex: 1,
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'center',
    padding: 0,
  },
  notesSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  notesLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 50,
    ...typography.caption,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  footerContainer: {
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    borderRadius: spacing.borderRadiusXl,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    ...typography.bodyBold,
    color: colors.textInverse,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
});
