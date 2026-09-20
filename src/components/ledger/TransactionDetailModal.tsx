import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LedgerEntry } from '../../types';
import { formatTransaction, FormattedTransaction } from '../../utils/transactionFormatter';
import { Button } from '../common/Button';
import { colors, typography, spacing } from '../../theme';

export interface TransactionDetailModalProps {
  visible: boolean;
  entry: LedgerEntry | null;
  onClose: () => void;
  perspective?: 'ADMIN' | 'VENDOR';
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  entry,
  onClose,
  perspective = 'ADMIN',
}) => {
  if (!entry) return null;

  const t: FormattedTransaction = formatTransaction(entry, perspective);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: t.iconBg }]}>
                    <Ionicons name={t.iconName as any} size={20} color={t.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={styles.subtitle}>
                      Ref: {t.referenceId}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Hero Amount Box */}
                <View style={styles.heroBox}>
                  <Text style={styles.heroLabel}>
                    {t.amountType === 'debit' ? 'AMOUNT INVOICED (OWED)' : 'AMOUNT COLLECTED (PAID)'}
                  </Text>
                  <Text style={[styles.heroAmount, { color: t.color }]}>
                    {t.amountWithSign}
                  </Text>

                  <View style={styles.balanceStatusRow}>
                    <Text style={styles.balanceStatusPrefix}>Balance After Txn: </Text>
                    <View
                      style={[
                        styles.balancePill,
                        t.balanceStatus === 'DUE'
                          ? styles.balancePillDue
                          : t.balanceStatus === 'ADVANCE'
                          ? styles.balancePillAdvance
                          : styles.balancePillSettled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.balancePillText,
                          t.balanceStatus === 'DUE'
                            ? styles.balancePillTextDue
                            : t.balanceStatus === 'ADVANCE'
                            ? styles.balancePillTextAdvance
                            : styles.balancePillTextSettled,
                        ]}
                      >
                        {t.balanceLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Details Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>TRANSACTION DETAILS</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transaction Type</Text>
                    <Text style={styles.detailValue}>{t.categoryLabel}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reference ID</Text>
                    <Text style={[styles.detailValue, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                      {t.referenceId}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                    <Text style={styles.detailValue}>{t.fullDateFormatted}</Text>
                  </View>

                  {Boolean(t.paymentMethod) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Method</Text>
                      <Text style={styles.detailValue}>{t.paymentMethod}</Text>
                    </View>
                  )}

                  {Boolean(t.relatedOrder) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Related Order</Text>
                      <Text style={styles.detailValue}>Order #{t.relatedOrder}</Text>
                    </View>
                  )}

                  {Boolean(t.relatedInvoice) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Related Invoice</Text>
                      <Text style={styles.detailValue}>{t.relatedInvoice}</Text>
                    </View>
                  )}

                  {Boolean(t.actorName) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Recorded By</Text>
                      <Text style={styles.detailValue}>{t.actorName}</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[styles.statusTag, { backgroundColor: t.statusBg }]}>
                      <Text style={[styles.statusTagText, { color: t.statusColor }]}>
                        {t.status}
                      </Text>
                    </View>
                  </View>

                  {Boolean(t.notes) && (
                    <View style={[styles.detailRow, { borderBottomWidth: 0, alignItems: 'flex-start' }]}>
                      <Text style={styles.detailLabel}>Notes / Remarks</Text>
                      <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
                        {t.notes}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Audit History (if edited) */}
                {t.auditInfo && (
                  <View style={styles.auditSection}>
                    <View style={styles.auditHeader}>
                      <Ionicons name="information-circle-outline" size={16} color="#B45309" />
                      <Text style={styles.auditTitle}>AUDIT LOG / CORRECTION HISTORY</Text>
                    </View>
                    <Text style={styles.auditText}>
                      Edited by <Text style={{ fontWeight: '700' }}>{t.auditInfo.editedBy}</Text> on{' '}
                      {new Date(t.auditInfo.editedAt || '').toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text style={styles.auditReason}>
                      Reason: "{t.auditInfo.editReason}"
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <Button
                  title="Close"
                  variant="secondary"
                  onPress={onClose}
                  style={styles.closeFullBtn}
                />
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
    fontSize: 11,
  },
  closeBtn: {
    padding: 6,
    marginLeft: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heroBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroAmount: {
    ...typography.hero,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
  },
  balanceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  balanceStatusPrefix: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  balancePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
  },
  balancePillDue: {
    backgroundColor: colors.debitLight,
  },
  balancePillAdvance: {
    backgroundColor: colors.brandGreenLight,
  },
  balancePillSettled: {
    backgroundColor: colors.surfaceSubtle,
  },
  balancePillText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  balancePillTextDue: {
    color: colors.debit,
  },
  balancePillTextAdvance: {
    color: colors.brandGreen,
  },
  balancePillTextSettled: {
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  detailValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusSm,
  },
  statusTagText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  auditSection: {
    backgroundColor: '#FEF3C7',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing.md,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  auditTitle: {
    ...typography.captionBold,
    color: '#92400E',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  auditText: {
    ...typography.caption,
    color: '#78350F',
    fontSize: 12,
  },
  auditReason: {
    ...typography.caption,
    color: '#92400E',
    fontStyle: 'italic',
    marginTop: 2,
    fontSize: 11,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  closeFullBtn: {
    width: '100%',
  },
});
