import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CashSettlement } from '../../types';
import { formatDate, formatDateTime } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

interface SettlementDetailModalProps {
  visible: boolean;
  settlement: CashSettlement | null;
  onClose: () => void;
  onVerify?: (id: string) => void;
}

export const SettlementDetailModal: React.FC<SettlementDetailModalProps> = ({
  visible,
  settlement,
  onClose,
  onVerify,
}) => {
  if (!settlement) return null;

  const isVerified = settlement.status === 'VERIFIED';
  const handedOver = settlement.handedOverCash || settlement.amountHandedOver || 0;
  const expected = settlement.totalCashCollected || settlement.amountCollected || 0;
  const variance = settlement.variance || settlement.difference || 0;

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Drag Handle */}
              <View style={styles.dragHandle} />

              {/* Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.receiptTitle}>Cash Handover Slip</Text>
                  <Text style={styles.receiptId}>{settlement.settlementNumber}</Text>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {/* Handover Amount Highlight */}
                <View style={styles.amountCard}>
                  <Text style={styles.amountLabel}>PHYSICAL CASH HANDED OVER</Text>
                  <Text style={styles.amountValue}>₹{fmt(handedOver)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isVerified ? styles.statusBadgeVerified : styles.statusBadgePending,
                    ]}
                  >
                    <Ionicons
                      name={isVerified ? 'checkmark-circle' : 'time-outline'}
                      size={13}
                      color={isVerified ? colors.brandGreen : colors.statusPendingText}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isVerified ? styles.statusTextVerified : styles.statusTextPending,
                      ]}
                    >
                      {isVerified ? 'Verified & Audited' : 'Awaiting Admin Audit'}
                    </Text>
                  </View>
                </View>

                {/* Handover Details Breakdown */}
                <View style={styles.detailsTable}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Submitted By</Text>
                    <Text style={styles.tableValueBold}>{settlement.staffName}</Text>
                  </View>

                  <View style={styles.tableDivider} />

                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Date</Text>
                    <Text style={styles.tableValue}>{formatDate(settlement.date)}</Text>
                  </View>

                  <View style={styles.tableDivider} />

                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Expected from Deliveries</Text>
                    <Text style={styles.tableValue}>₹{fmt(expected)}</Text>
                  </View>

                  <View style={styles.tableDivider} />

                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Actual Handover</Text>
                    <Text style={styles.tableValueBold}>₹{fmt(handedOver)}</Text>
                  </View>

                  <View style={styles.tableDivider} />

                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Reconciliation Variance</Text>
                    <Text
                      style={[
                        styles.tableValueBold,
                        variance === 0
                          ? { color: colors.brandGreen }
                          : variance > 0
                          ? { color: colors.statusPendingText }
                          : { color: colors.danger },
                      ]}
                    >
                      {variance === 0
                        ? '₹0.00 (Exact Match)'
                        : variance > 0
                        ? `+₹${fmt(variance)} (Excess)`
                        : `-₹${fmt(Math.abs(variance))} (Shortage)`}
                    </Text>
                  </View>
                </View>

                {/* Notes / Bag remarks */}
                {settlement.notes ? (
                  <View style={styles.notesCard}>
                    <Text style={styles.notesLabel}>BAG IDENTIFIER / REMARKS</Text>
                    <Text style={styles.notesContent}>{settlement.notes}</Text>
                  </View>
                ) : null}

                {/* Audit Stamp */}
                {isVerified && (
                  <View style={styles.auditCard}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.brandGreen} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditTitle}>Verified by {settlement.verifiedBy || 'Admin'}</Text>
                      {settlement.verifiedAt && (
                        <Text style={styles.auditSub}>
                          {formatDateTime(settlement.verifiedAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bottom Actions */}
              <View style={styles.footer}>
                {!isVerified && onVerify ? (
                  <TouchableOpacity
                    style={styles.verifyBtn}
                    onPress={() => {
                      onVerify(settlement.id);
                      onClose();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.textInverse} />
                    <Text style={styles.verifyBtnText}>Verify & Accept Handover</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.dismissBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '85%',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  receiptTitle: {
    ...typography.h2,
    fontSize: 17,
    color: colors.textPrimary,
  },
  receiptId: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginBottom: spacing.md,
  },
  amountCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusLg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountLabel: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  amountValue: {
    ...typography.h1,
    fontSize: 26,
    color: colors.textPrimary,
    marginVertical: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
    marginTop: 2,
  },
  statusBadgePending: {
    backgroundColor: colors.statusPendingBg,
  },
  statusBadgeVerified: {
    backgroundColor: colors.brandGreenLight,
  },
  statusBadgeText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  statusTextPending: {
    color: colors.statusPendingText,
  },
  statusTextVerified: {
    color: colors.brandGreen,
  },
  detailsTable: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  tableLabel: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tableValue: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  tableValueBold: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  tableDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  notesCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesLabel: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 3,
  },
  notesContent: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  auditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandGreenLight,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: spacing.sm,
  },
  auditTitle: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 12,
  },
  auditSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  footer: {
    gap: spacing.xs + 2,
    paddingTop: spacing.xs,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: spacing.borderRadiusMd,
    gap: 6,
  },
  verifyBtnText: {
    ...typography.bodyBold,
    color: colors.textInverse,
    fontSize: 14,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dismissBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 13,
  },
});
