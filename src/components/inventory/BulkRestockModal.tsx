import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDebounce } from '../../hooks';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Product } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface BulkRestockModalProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  onConfirm: (updates: { productId: string; addedQty: number }[]) => Promise<void> | void;
}

export const BulkRestockModal: React.FC<BulkRestockModalProps> = ({
  visible,
  onClose,
  products,
  onConfirm,
}) => {
  // Refill quantities map: { [productId]: addedQuantityNumber }
  const [refillMap, setRefillMap] = useState<{ [productId: string]: number }>({});
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 450);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setRefillMap({});
      setSearch('');
      setFilterCategory('ALL');
      setSubmitting(false);
    }
  }, [visible]);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category || 'General')));
    return ['ALL', 'LOW_STOCK', ...cats];
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    return products.filter((p) => {
      const matchesSearch =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterCategory === 'LOW_STOCK') {
        return p.stockQty <= p.lowStockThreshold;
      }
      if (filterCategory !== 'ALL') {
        return p.category === filterCategory;
      }
      return true;
    });
  }, [products, debouncedSearch, filterCategory]);

  // Summary counts
  const summary = useMemo(() => {
    let itemsCount = 0;
    let totalUnits = 0;

    for (const [_, qty] of Object.entries(refillMap)) {
      if (qty > 0) {
        itemsCount++;
        totalUnits += qty;
      }
    }

    return { itemsCount, totalUnits };
  }, [refillMap]);

  const handleSetQty = (productId: string, qty: number) => {
    const safeQty = Math.max(0, isNaN(qty) ? 0 : qty);
    setRefillMap((prev) => ({
      ...prev,
      [productId]: safeQty,
    }));
  };

  const handleAddDelta = (productId: string, delta: number) => {
    const current = refillMap[productId] || 0;
    handleSetQty(productId, current + delta);
  };

  const handleClearAll = () => {
    setRefillMap({});
  };

  const handleSubmit = async () => {
    const updates = Object.entries(refillMap)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, addedQty]) => ({ productId, addedQty }));

    if (updates.length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(updates);
      onClose();
    } catch (err) {
      console.error('Failed to submit bulk restock:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="layers-outline" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.title}>Bulk Inventory Refill</Text>
                      <Text style={styles.subtitle}>
                        Refill shipments & restock multiple items at once
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                  <View style={styles.searchInputWrapper}>
                    <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      placeholder="Filter items to restock..."
                      value={search}
                      onChangeText={setSearch}
                      style={styles.searchInput}
                      placeholderTextColor={colors.textMuted}
                    />
                    {search.length > 0 && (
                      <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Filter Categories Chips */}
                <View style={styles.filterScrollWrapper}>
                  <FlatList
                    horizontal
                    data={categories}
                    keyExtractor={(cat) => cat}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterChipsRow}
                    renderItem={({ item: cat }) => {
                      const isActive = filterCategory === cat;
                      const label =
                        cat === 'ALL'
                          ? 'All Items'
                          : cat === 'LOW_STOCK'
                          ? '⚠️ Low Stock First'
                          : cat;

                      return (
                        <TouchableOpacity
                          style={[styles.filterChip, isActive && styles.filterChipActive]}
                          onPress={() => setFilterCategory(cat)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isActive && styles.filterChipTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>

                {/* Active Refill Toolbar Banner */}
                {summary.itemsCount > 0 && (
                  <View style={styles.activeBanner}>
                    <View style={styles.activeBannerTextCol}>
                      <Text style={styles.activeBannerTitle}>
                        {summary.itemsCount} {summary.itemsCount === 1 ? 'item' : 'items'} selected
                      </Text>
                      <Text style={styles.activeBannerSubtitle}>
                        Adding +{summary.totalUnits.toLocaleString('en-IN')} total units into stock
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleClearAll}
                      style={styles.clearAllBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.clearAllText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Products List with Fast Refill Controls */}
                <FlatList
                  data={filteredProducts}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const currentQty = item.stockQty || 0;
                    const addedQty = refillMap[item.id] || 0;
                    const newTotal = currentQty + addedQty;
                    const isLowStock = currentQty <= item.lowStockThreshold;
                    const isOutOfStock = currentQty === 0;

                    return (
                      <Card style={styles.productCard} outlined elevation="sm">
                        <View style={styles.productHeaderRow}>
                          <View style={styles.productInfoCol}>
                            <Text style={styles.productCategory}>{item.category || 'General'}</Text>
                            <Text style={styles.productName}>{item.name}</Text>
                            <Text style={styles.productUnit}>{item.unit}</Text>
                          </View>

                          {/* Current Stock Tag */}
                          <View style={styles.stockBadgeCol}>
                            <View
                              style={[
                                styles.stockBadge,
                                isOutOfStock
                                  ? styles.stockBadgeOut
                                  : isLowStock
                                  ? styles.stockBadgeLow
                                  : styles.stockBadgeNormal,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.stockBadgeText,
                                  isOutOfStock
                                    ? styles.stockBadgeTextOut
                                    : isLowStock
                                    ? styles.stockBadgeTextLow
                                    : styles.stockBadgeTextNormal,
                                ]}
                              >
                                {isOutOfStock
                                  ? 'Out of Stock'
                                  : `Current: ${currentQty}`}
                              </Text>
                            </View>

                            {addedQty > 0 && (
                              <View style={styles.forecastBadge}>
                                <Ionicons name="arrow-forward" size={11} color={colors.primary} />
                                <Text style={styles.forecastText}>New: {newTotal}</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Quick Refill Controls */}
                        <View style={styles.refillControlsRow}>
                          <Text style={styles.addQtyLabel}>+ Refill Qty:</Text>

                          {/* Stepper and Number Input */}
                          <View style={styles.stepperContainer}>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => handleAddDelta(item.id, -1)}
                              disabled={addedQty === 0}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name="remove"
                                size={16}
                                color={addedQty > 0 ? colors.textPrimary : colors.textMuted}
                              />
                            </TouchableOpacity>

                            <TextInput
                              style={[
                                styles.qtyInput,
                                addedQty > 0 && styles.qtyInputActive,
                              ]}
                              value={addedQty > 0 ? addedQty.toString() : ''}
                              placeholder="0"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="number-pad"
                              onChangeText={(val) => {
                                const parsed = parseInt(val, 10);
                                handleSetQty(item.id, isNaN(parsed) ? 0 : parsed);
                              }}
                            />

                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => handleAddDelta(item.id, 1)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="add" size={16} color={colors.textPrimary} />
                            </TouchableOpacity>
                          </View>

                          {/* Quick Increment Buttons */}
                          <View style={styles.quickAddRow}>
                            <TouchableOpacity
                              style={styles.quickAddChip}
                              onPress={() => handleAddDelta(item.id, 10)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.quickAddText}>+10</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.quickAddChip}
                              onPress={() => handleAddDelta(item.id, 25)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.quickAddText}>+25</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.quickAddChip}
                              onPress={() => handleAddDelta(item.id, 50)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.quickAddText}>+50</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.quickAddChip}
                              onPress={() => handleAddDelta(item.id, 100)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.quickAddText}>+100</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Card>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
                      <Text style={styles.emptyTitle}>No matching products</Text>
                      <Text style={styles.emptySubtitle}>
                        Try adjusting your search keyword or selected category
                      </Text>
                    </View>
                  }
                />

                {/* Footer Actions */}
                <View style={styles.footer}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={onClose}
                    style={styles.footerCancelBtn}
                    disabled={submitting}
                  />

                  <Button
                    title={
                      summary.totalUnits > 0
                        ? `Restock ${summary.itemsCount} Items (+${summary.totalUnits})`
                        : 'Close'
                    }
                    variant="primary"
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={summary.totalUnits === 0 && !submitting}
                    style={styles.footerSubmitBtn}
                    icon={
                      !submitting && summary.totalUnits > 0 ? (
                        <Ionicons name="checkmark-done" size={18} color={colors.textInverse} />
                      ) : undefined
                    }
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    height: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  closeButton: {
    padding: 6,
    marginLeft: spacing.sm,
  },
  searchContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 40,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  filterScrollWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: spacing.xs,
  },
  filterChipsRow: {
    paddingHorizontal: spacing.screenPadding,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  activeBannerTextCol: {
    flex: 1,
  },
  activeBannerTitle: {
    ...typography.captionBold,
    color: '#1D4ED8',
    fontSize: 12,
  },
  activeBannerSubtitle: {
    ...typography.caption,
    color: '#2563EB',
    fontSize: 11,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  clearAllText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xl,
  },
  productCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  productInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productCategory: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  productName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 1,
  },
  productUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  stockBadgeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stockBadgeNormal: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockBadgeLow: {
    backgroundColor: colors.statusPendingBg,
  },
  stockBadgeOut: {
    backgroundColor: colors.statusCancelledBg,
  },
  stockBadgeText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  stockBadgeTextNormal: {
    color: colors.textSecondary,
  },
  stockBadgeTextLow: {
    color: '#B45309',
  },
  stockBadgeTextOut: {
    color: colors.danger,
  },
  forecastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  forecastText: {
    ...typography.captionBold,
    color: '#059669',
    fontSize: 10,
  },
  refillControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexWrap: 'wrap',
    gap: 8,
  },
  addQtyLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    minWidth: 42,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  qtyInputActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 4,
  },
  quickAddChip: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAddText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  footerCancelBtn: {
    flex: 1,
  },
  footerSubmitBtn: {
    flex: 2,
  },
});
