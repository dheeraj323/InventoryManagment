import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../types';
import { colors, typography, spacing, shadows } from '../../theme';

export interface LoadPlanItem {
  productId: string;
  productName: string;
  unit: string;
  totalQty: number;
  orderCount: number;
  orders: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    qty: number;
  }[];
}

interface StaffLoadPlanModalProps {
  visible: boolean;
  onClose: () => void;
  orders: Order[];
  staffId: string;
  staffName: string;
  onProceedToLoadStock?: () => void;
}

export const StaffLoadPlanModal: React.FC<StaffLoadPlanModalProps> = ({
  visible,
  onClose,
  orders,
  staffId,
  staffName,
  onProceedToLoadStock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Compute required loading plan from unfulfilled assigned orders
  const { planItems, totalUnits, totalOrdersCount } = useMemo(() => {
    const unfulfilledOrders = orders.filter(
      (o) =>
        o.assignedStaffId === staffId &&
        o.status !== 'CANCELLED' &&
        o.status !== 'DELIVERED' &&
        o.status !== 'PARTIALLY_DELIVERED'
    );

    const map: Record<string, LoadPlanItem> = {};

    unfulfilledOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!item.productId) return;
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            unit: item.unit || 'units',
            totalQty: 0,
            orderCount: 0,
            orders: [],
          };
        }
        map[item.productId].totalQty += item.orderedQty || 0;
        map[item.productId].orderCount += 1;
        map[item.productId].orders.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.shopName || order.vendorName || 'Vendor',
          qty: item.orderedQty || 0,
        });
      });
    });

    const items = Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
    const sumUnits = items.reduce((sum, item) => sum + item.totalQty, 0);

    return {
      planItems: items,
      totalUnits: sumUnits,
      totalOrdersCount: unfulfilledOrders.length,
    };
  }, [orders, staffId]);

  const toggleCheck = (productId: string) => {
    setCheckedItemIds((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const toggleExpand = (productId: string) => {
    setExpandedItemId((prev) => (prev === productId ? null : productId));
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return planItems;
    return planItems.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.orders.some((o) => o.customerName.toLowerCase().includes(q) || o.orderNumber.toLowerCase().includes(q))
    );
  }, [planItems, searchQuery]);

  const checkedCount = planItems.filter((it) => checkedItemIds[it.productId]).length;

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
              <View style={styles.headerRow}>
                <View style={styles.headerTitleBlock}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Van Loading Plan</Text>
                    <Text style={styles.modalSubtitle}>
                      {staffName} • {totalOrdersCount} Assigned Deliveries
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Stats Summary Bar */}
              <View style={styles.summaryBar}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>TOTAL UNITS</Text>
                  <Text style={styles.summaryValue}>{totalUnits}</Text>

                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>PRODUCTS</Text>
                  <Text style={[styles.summaryValue, { color: colors.primary }]}>{planItems.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>PICKED</Text>
                  <Text style={[styles.summaryValue, { color: colors.brandGreen }]}>
                    {checkedCount} / {planItems.length}
                  </Text>
                </View>
              </View>

              {/* Search Bar */}
              {planItems.length > 3 && (
                <View style={styles.searchContainer}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search product or customer..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Item List */}
              {planItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={44} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Pre-Orders to Load</Text>
                  <Text style={styles.emptySubtitle}>
                    There are no unfulfilled orders assigned to your route today. Extra stock can still be loaded from the main screen.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.productId}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item, index }) => {
                    const isChecked = !!checkedItemIds[item.productId];
                    const isExpanded = expandedItemId === item.productId;

                    return (
                      <View style={[styles.itemCard, isChecked && styles.itemCardChecked]}>
                        <TouchableOpacity
                          style={styles.itemMainRow}
                          onPress={() => toggleCheck(item.productId)}
                          activeOpacity={0.7}
                        >
                          {/* Checkbox */}
                          <View
                            style={[
                              styles.checkbox,
                              isChecked && styles.checkboxChecked,
                            ]}
                          >
                            {isChecked && (
                              <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                            )}
                          </View>

                          {/* Product Info */}
                          <View style={styles.productInfo}>
                            <Text
                              style={[
                                styles.productName,
                                isChecked && styles.productNameChecked,
                              ]}
                              numberOfLines={2}
                            >
                              {item.productName}
                            </Text>
                            <Text style={styles.orderBreakdownSummary}>
                              Needed for {item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'}
                            </Text>
                          </View>

                          {/* Required Qty Badge */}
                          <View style={styles.qtyBadge}>
                            <Text style={styles.qtyBadgeNum}>{item.totalQty}</Text>
                            <Text style={styles.qtyBadgeUnit}>{item.unit}</Text>
                          </View>

                          {/* Expand Button */}
                          <TouchableOpacity
                            onPress={() => toggleExpand(item.productId)}
                            style={styles.expandBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textMuted}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Order breakdown accordion */}
                        {isExpanded && (
                          <View style={styles.expandedOrderList}>
                            <Text style={styles.breakdownHeader}>Order-wise Breakdown:</Text>
                            {item.orders.map((ord, i) => (
                              <View key={`${ord.orderId}_${i}`} style={styles.orderRow}>
                                <View style={styles.orderRowLeft}>
                                  <Text style={styles.orderCustomerName} numberOfLines={1}>
                                    {ord.customerName}
                                  </Text>
                                  <Text style={styles.orderNumText}>{ord.orderNumber}</Text>
                                </View>
                                <Text style={styles.orderQtyText}>
                                  {ord.qty} {item.unit}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  }}
                />
              )}

              {/* Bottom Footer Actions */}
              <View style={styles.footerContainer}>
                {onProceedToLoadStock && (
                  <TouchableOpacity
                    style={styles.proceedBtn}
                    onPress={() => {
                      onClose();
                      onProceedToLoadStock();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="sunny-outline" size={18} color={colors.textInverse} />
                    <Text style={styles.proceedBtnText}>
                      {totalUnits > 0
                        ? `Proceed to Load Stock (${totalUnits} Units)`
                        : 'Open Morning Stock Loading'}
                    </Text>
                  </TouchableOpacity>
                )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    minHeight: '40%',
    paddingBottom: spacing.lg,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  summaryValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: 1,
  },
  summarySub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: spacing.md,
    gap: 8,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemCardChecked: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  itemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.brandGreen,
    borderColor: colors.brandGreen,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  productNameChecked: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  orderBreakdownSummary: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  qtyBadge: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  qtyBadgeNum: {
    ...typography.bodyBold,
    color: colors.navy,
    fontSize: 14,
  },
  qtyBadgeUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  expandBtn: {
    padding: 4,
  },
  expandedOrderList: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 6,
  },
  breakdownHeader: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  orderRowLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderCustomerName: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  orderNumText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  orderQtyText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
    marginTop: 10,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  footerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingVertical: 12,
    borderRadius: spacing.borderRadiusMd,
    gap: 8,
    ...shadows.sm,
  },
  proceedBtnText: {
    ...typography.bodyBold,
    color: colors.textInverse,
    fontSize: 14,
  },
});
