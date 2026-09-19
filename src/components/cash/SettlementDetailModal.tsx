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
import { StatusBadge } from '../common/StatusBadge';
import { colors, typography, spacing } from '../../theme';

interface SettlementDetailModalProps {
  visible: boolean;
  settlement: CashSettlement | null;
  onClose: () => void;
}

export const SettlementDetailModal: React.FC<SettlementDetailModalProps> = ({
  visible,
  settlement,
  onClose,
}) => {
  if (!settlement) return null;

  const isVerified = settlement.status === 'VERIFIED';
  const handedOver = settlement.handedOverCash || settlement.amountHandedOver || 0;
  const expected = settlement.totalCashCollected || settlement.amountCollected || 0;
  const variance = settlement.variance || settlement.difference || 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.dragHandle} />

              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.title}>{settlement.settlementNumber}</Text>
                  <Text style={styles.subtitle}>
                    Submitted by {settlement.staffName} • {settlement.date}
                  </Text>
                </View>
                <StatusBadge
                  customLabel={isVerified ? 'Verified' : 'Pending Audit'}
                  customBg={isVerified ? colors.brandGreenLight : '#FEF3C7'}
                  customColor={isVerified ? colors.brandGreen : '#D97706'}
                  size="sm"
                />
              </View>

              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.metricGrid}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Expected Cash</Text>
                    <Text style={styles.metricVal}>
                      ₹{expected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Actual Handed Over</Text>
                    <Text style={styles.metricValBold}>
                      ₹{handedOver.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.varianceBanner,
                    variance === 0
                      ? styles.matchBanner
                      : variance > 0
                      ? styles.excessBanner
                      : styles.shortageBanner,
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
                        styles.varianceTitle,
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
                  </View>
                </View>

                {settlement.notes ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Notes / Bag Identifier</Text>
                    <Text style={styles.sectionValue}>{settlement.notes}</Text>
                  </View>
                ) : null}

                {isVerified ? (
                  <View style={styles.auditStamp}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.brandGreen} />
                    <Text style={styles.auditText}>
                      Audited & Verified by {settlement.verifiedBy || 'Admin'}
                      {settlement.verifiedAt
                        ? ` on ${new Date(settlement.verifiedAt).toLocaleDateString('en-IN')}`
                        : ''}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
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
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    padding: spacing.lg,
    maxHeight: '80%',
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
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  body: {
    marginBottom: spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
  },
  metricLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
  },
  metricVal: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metricValBold: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  varianceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginVertical: spacing.sm,
    borderWidth: 1,
  },
  matchBanner: {
    backgroundColor: colors.brandGreenLight,
    borderColor: '#A7F3D0',
  },
  excessBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  shortageBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  varianceTextGroup: {
    marginLeft: spacing.sm,
  },
  varianceTitle: {
    ...typography.bodyBold,
  },
  section: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
  },
  sectionValue: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: 2,
  },
  auditStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandGreenLight,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  auditText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    flex: 1,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusLg,
  },
  closeBtnText: {
    ...typography.button,
    color: colors.textPrimary,
  },
});
