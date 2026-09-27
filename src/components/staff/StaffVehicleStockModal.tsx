import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StaffDailyStockSession } from '../../types';
import { formatDateTime } from '../../utils/dateFormatter';
import { colors, typography, spacing, shadows } from '../../theme';

interface StaffVehicleStockModalProps {
  visible: boolean;
  onClose: () => void;
  session: StaffDailyStockSession | null;
  staffName: string;
}

export const StaffVehicleStockModal: React.FC<StaffVehicleStockModalProps> = ({
  visible,
  onClose,
  session,
  staffName,
}) => {
  if (!session || !session.items || session.items.length === 0) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Vehicle Stock Inventory</Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.emptyContainer}>
              <Ionicons name="bicycle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Vehicle is Empty</Text>
              <Text style={styles.emptySubtitle}>
                No morning delivery stock has been loaded yet for today.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const isReturned = session.status === 'RETURNED' || session.status === 'DISCREPANCY';
  const totalLoaded = isReturned
    ? 0
    : (session.items || []).reduce((sum, it) => sum + (it.loadedQty || 0), 0);
  const totalDelivered = isReturned
    ? 0
    : (session.items || []).reduce((sum, it) => sum + (it.deliveredQty || 0), 0);
  const totalInVehicle = isReturned
    ? 0
    : (session.items || []).reduce(
        (sum, it) => sum + Math.max(0, it.currentStock ?? ((it.loadedQty || 0) - (it.deliveredQty || 0))),
        0
      );
  const totalOutForDelivery = isReturned
    ? 0
    : (session.items || []).reduce((sum, it) => sum + (it.outForDeliveryQty || 0), 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalSheet}>
              {/* Drag Handle */}
              <View style={styles.sheetHandle}>
                <View style={styles.sheetHandleBar} />
              </View>

              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <View>
                  <View style={styles.titleBadgeRow}>
                    <View
                      style={[
                        styles.statusIconWrap,
                        isReturned ? { backgroundColor: '#DCFCE7' } : { backgroundColor: colors.accentLight },
                      ]}
                    >
                      <Ionicons
                        name={isReturned ? 'checkmark-circle' : 'bicycle-outline'}
                        size={16}
                        color={isReturned ? colors.brandGreen : colors.accent}
                      />
                    </View>
                    <Text style={styles.modalTitle}>Vehicle Stock Inventory</Text>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    Loaded on {formatDateTime(session.loadedAt)} • {staffName}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Metric Highlights */}
              <View style={styles.metricGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>LOADED</Text>
                  <Text style={styles.metricVal}>{totalLoaded}</Text>
                  <Text style={styles.metricSub}>Morning take</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={[styles.metricLabel, { color: '#B45309' }]}>ON WAY</Text>
                  <Text style={[styles.metricVal, { color: '#D97706' }]}>
                    {totalOutForDelivery}
                  </Text>
                  <Text style={styles.metricSub}>Out for delivery</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>DELIVERED</Text>
                  <Text style={[styles.metricVal, { color: colors.brandGreen }]}>
                    {totalDelivered}
                  </Text>
                  <Text style={styles.metricSub}>Fulfilled</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.metricLabel, { color: colors.accent }]}>
                    {isReturned ? 'RETURNED' : 'IN VAN'}
                  </Text>
                  <Text style={[styles.metricVal, { color: colors.accent }]}>
                    {isReturned ? (session.totalReturnedUnits || 0) : totalInVehicle}
                  </Text>
                  <Text style={styles.metricSub}>
                    {isReturned ? 'Restocked' : 'Live balance'}
                  </Text>
                </View>
              </View>

              {/* Product Items Breakdown */}
              <FlatList
                data={session.items}
                keyExtractor={(item) => item.productId}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const currentInVehicle = isReturned ? 0 : item.currentStock;

                  return (
                    <View style={styles.productCard}>
                      <View style={styles.productHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.productName} numberOfLines={1}>
                            {item.productName}
                          </Text>
                          <Text style={styles.productUnit}>{item.unit}</Text>
                        </View>
                        <View
                          style={[
                            styles.vehicleStockBadge,
                            currentInVehicle === 0 && styles.vehicleStockBadgeZero,
                          ]}
                        >
                          <Text
                            style={[
                              styles.vehicleStockBadgeText,
                              currentInVehicle === 0 && styles.vehicleStockBadgeTextZero,
                            ]}
                          >
                            {isReturned ? `Returned: ${item.returnedQty || 0}` : `In Van: ${currentInVehicle}`}
                          </Text>
                        </View>
                      </View>

                      {/* Progress Metrics Row */}
                      <View style={styles.itemProgressRow}>
                        <View style={styles.progressStat}>
                          <Text style={styles.statLabel}>Route Pre</Text>
                          <Text style={[styles.statVal, { color: colors.brandGreen }]}>
                            {item.preOrderedQty || 0}
                          </Text>
                        </View>
                        <View style={styles.progressStat}>
                          <Text style={styles.statLabel}>Extra</Text>
                          <Text style={[styles.statVal, { color: colors.accent }]}>
                            {item.extraLoadedQty || 0}
                          </Text>
                        </View>
                        <View style={styles.progressStat}>
                          <Text style={[styles.statLabel, { color: '#B45309' }]}>On Way</Text>
                          <Text
                            style={[
                              styles.statVal,
                              {
                                color: isReturned ? colors.textMuted : '#D97706',
                                fontWeight: '700',
                              },
                            ]}
                          >
                            {isReturned ? 0 : item.outForDeliveryQty || 0}
                          </Text>
                        </View>
                        <View style={styles.progressStat}>
                          <Text style={styles.statLabel}>Delivered</Text>
                          <Text style={[styles.statVal, { color: colors.primary }]}>
                            {item.deliveredQty}
                          </Text>
                        </View>
                        {item.damagedQty !== undefined && item.damagedQty > 0 && (
                          <View style={styles.progressStat}>
                            <Text style={styles.statLabel}>Damaged</Text>
                            <Text style={[styles.statVal, { color: colors.danger }]}>
                              {item.damagedQty}
                            </Text>
                          </View>
                        )}
                        {item.missingQty !== undefined && item.missingQty > 0 && (
                          <View style={styles.progressStat}>
                            <Text style={styles.statLabel}>Missing</Text>
                            <Text style={[styles.statVal, { color: '#B45309' }]}>
                              {item.missingQty}
                            </Text>
                          </View>
                        )}
                        {item.returnedQty !== undefined && item.returnedQty > 0 && (
                          <View style={styles.progressStat}>
                            <Text style={styles.statLabel}>Restocked</Text>
                            <Text style={[styles.statVal, { color: colors.brandGreen }]}>
                              {item.returnedQty}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }}
              />

              {/* Close Button Footer */}
              <View style={styles.footerContainer}>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.closeBtnText}>Done</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    maxHeight: '88%',
    minHeight: '60%',
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
  statusIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
  metricGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    gap: spacing.xs + 2,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.sm,
    alignItems: 'center',
  },
  metricLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  metricVal: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
    marginVertical: 1,
  },
  metricSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 9,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    paddingBottom: 16,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  productName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  productUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  vehicleStockBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusFull,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  vehicleStockBadgeZero: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  vehicleStockBadgeText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },
  vehicleStockBadgeTextZero: {
    color: colors.textMuted,
  },
  itemProgressRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  progressStat: {
    alignItems: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  statVal: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
    marginTop: 1,
  },
  footerContainer: {
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeBtn: {
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    borderRadius: spacing.borderRadiusXl,
    alignItems: 'center',
  },
  closeBtnText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
