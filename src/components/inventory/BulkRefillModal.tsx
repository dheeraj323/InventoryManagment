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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDebounce } from '../../hooks';
import { Button } from '../common/Button';
import { Product } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface BulkRefillModalProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  onConfirm: (updates: { productId: string; addedQty: number }[]) => Promise<void> | void;
}

type ModalStep = 'EDIT' | 'REVIEW' | 'SUCCESS';

export const BulkRefillModal: React.FC<BulkRefillModalProps> = ({
  visible,
  onClose,
  products,
  onConfirm,
}) => {
  const [step, setStep] = useState<ModalStep>('EDIT');
  const [refillMap, setRefillMap] = useState<{ [productId: string]: number }>({});
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 450);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmittedSummary, setLastSubmittedSummary] = useState({ itemsCount: 0, totalUnits: 0 });

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('EDIT');
      setRefillMap({});
      setSearch('');
      setSubmitting(false);
    }
  }, [visible]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return products;

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, debouncedSearch]);

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

  // Selected products for Review step
  const selectedProductsForReview = useMemo(() => {
    return products
      .filter((p) => (refillMap[p.id] || 0) > 0)
      .map((p) => ({
        product: p,
        addedQty: refillMap[p.id] || 0,
        newStock: (p.stockQty || 0) + (refillMap[p.id] || 0),
      }));
  }, [products, refillMap]);

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

  const handleProceedToReview = () => {
    if (summary.itemsCount === 0) return;
    setStep('REVIEW');
  };

  const handleConfirmFinal = async () => {
    const updates = Object.entries(refillMap)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, addedQty]) => ({ productId, addedQty }));

    if (updates.length === 0) return;

    setSubmitting(true);
    try {
      await onConfirm(updates);
      setLastSubmittedSummary({ itemsCount: summary.itemsCount, totalUnits: summary.totalUnits });
      setStep('SUCCESS');
    } catch (err) {
      console.error('Failed to submit bulk restock:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    onClose();
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
              <View style={styles.modalSheet}>
                {/* Drag handle */}
                <View style={styles.dragHandleRow}>
                  <View style={styles.dragHandle} />
                </View>

                {/* ──────────────────────────────────────────────────────── */}
                {/* STEP 1: COMPACT BATCH ENTRY SCREEN                       */}
                {/* ──────────────────────────────────────────────────────── */}
                {step === 'EDIT' && (
                  <>
                    {/* Header */}
                    <View style={styles.header}>
                      <View style={styles.headerTitleCol}>
                        <Text style={styles.title}>Bulk Restock</Text>
                        <Text style={styles.subtitle}>
                          Enter received quantities across multiple products
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchSection}>
                      <View style={styles.searchInputWrapper}>
                        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                        <TextInput
                          placeholder="Search product name or category..."
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

                    {/* Selected Summary Quick Strip (If any item filled) */}
                    {summary.itemsCount > 0 && (
                      <View style={styles.selectionStrip}>
                        <Text style={styles.selectionStripText}>
                          {summary.itemsCount} {summary.itemsCount === 1 ? 'item' : 'items'} selected •{' '}
                          <Text style={styles.selectionStripHighlight}>
                            +{summary.totalUnits.toLocaleString('en-IN')} units
                          </Text>
                        </Text>
                        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
                          <Text style={styles.clearBtnText}>Reset All</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Compact Product List */}
                    <FlatList
                      data={filteredProducts}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={styles.listContent}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => {
                        const currentQty = item.stockQty || 0;
                        const addedQty = refillMap[item.id] || 0;
                        const isSelected = addedQty > 0;
                        const isLow = currentQty <= item.lowStockThreshold && currentQty > 0;
                        const isOut = currentQty === 0;

                        return (
                          <View
                            style={[
                              styles.rowCard,
                              isSelected && styles.rowCardSelected,
                            ]}
                          >
                            {/* Product Info Left */}
                            <View style={styles.rowInfoLeft}>
                              <Text style={styles.rowProductName} numberOfLines={1}>
                                {item.name}
                              </Text>

                              <View style={styles.rowMetaLine}>
                                <Text style={styles.rowUnitText}>{item.unit}</Text>
                                <Text style={styles.rowMetaDot}>•</Text>

                                {/* Current Stock Pill */}
                                <View
                                  style={[
                                    styles.stockPill,
                                    isOut
                                      ? styles.stockPillOut
                                      : isLow
                                      ? styles.stockPillLow
                                      : styles.stockPillNormal,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.stockPillText,
                                      isOut
                                        ? styles.stockPillTextOut
                                        : isLow
                                        ? styles.stockPillTextLow
                                        : styles.stockPillTextNormal,
                                    ]}
                                  >
                                    {isOut ? 'Out of stock' : `${currentQty} in stock`}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Stepper Controls Right */}
                            <View style={styles.rowControlsRight}>
                              {/* Numeric Stepper Box */}
                              <View
                                style={[
                                  styles.stepperContainer,
                                  isSelected && styles.stepperContainerActive,
                                ]}
                              >
                                <TouchableOpacity
                                  style={styles.stepBtn}
                                  onPress={() => handleAddDelta(item.id, -1)}
                                  disabled={addedQty === 0}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons
                                    name="remove"
                                    size={15}
                                    color={addedQty > 0 ? colors.textPrimary : colors.textMuted}
                                  />
                                </TouchableOpacity>

                                <TextInput
                                  style={styles.stepperInput}
                                  value={addedQty > 0 ? addedQty.toString() : ''}
                                  placeholder="0"
                                  placeholderTextColor={colors.textMuted}
                                  keyboardType="number-pad"
                                  selectTextOnFocus
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
                                  <Ionicons name="add" size={15} color={colors.textPrimary} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        );
                      }}
                      ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                          <Ionicons name="cube-outline" size={32} color={colors.textMuted} />
                          <Text style={styles.emptyTitle}>No matching products</Text>
                          <Text style={styles.emptySubtitle}>
                            Try searching for another product name
                          </Text>
                        </View>
                      }
                    />

                    {/* Bottom Action Bar */}
                    <View style={styles.footer}>
                      <View style={styles.footerSummaryCol}>
                        <Text style={styles.footerSummaryText}>
                          {summary.itemsCount === 0
                            ? 'No items selected'
                            : `${summary.itemsCount} ${summary.itemsCount === 1 ? 'product' : 'products'} ready`}
                        </Text>
                        <Text style={styles.footerUnitsText}>
                          {summary.itemsCount === 0
                            ? 'Enter quantities above'
                            : `+${summary.totalUnits.toLocaleString('en-IN')} units to add`}
                        </Text>
                      </View>

                      <Button
                        title={`Review Batch (${summary.itemsCount})`}
                        variant="primary"
                        onPress={handleProceedToReview}
                        disabled={summary.itemsCount === 0}
                        style={styles.footerReviewBtn}
                        icon={
                          <Ionicons
                            name="arrow-forward"
                            size={16}
                            color={colors.textInverse}
                          />
                        }
                      />
                    </View>
                  </>
                )}

                {/* ──────────────────────────────────────────────────────── */}
                {/* STEP 2: REVIEW BATCH SCREEN                             */}
                {/* ──────────────────────────────────────────────────────── */}
                {step === 'REVIEW' && (
                  <>
                    <View style={styles.header}>
                      <View style={styles.headerTitleCol}>
                        <TouchableOpacity
                          onPress={() => setStep('EDIT')}
                          style={styles.backRow}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="arrow-back" size={16} color={colors.primary} />
                          <Text style={styles.backRowText}>Back to items</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Review Batch Restock</Text>
                      </View>
                      <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      contentContainerStyle={styles.reviewScrollContent}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.reviewBanner}>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color={colors.primary}
                        />
                        <Text style={styles.reviewBannerText}>
                          Ready to add +{summary.totalUnits.toLocaleString('en-IN')} total units across {summary.itemsCount} products into your active inventory.
                        </Text>
                      </View>

                      {selectedProductsForReview.map(({ product, addedQty, newStock }) => (
                        <View key={product.id} style={styles.reviewItemCard}>
                          <View style={styles.reviewItemLeft}>
                            <Text style={styles.reviewProductName}>{product.name}</Text>
                            <Text style={styles.reviewProductUnit}>{product.unit}</Text>
                          </View>

                          <View style={styles.reviewStockFlow}>
                            <Text style={styles.flowOldText}>{product.stockQty}</Text>
                            <View style={styles.flowBadge}>
                              <Text style={styles.flowBadgeText}>+{addedQty}</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={12} color={colors.textMuted} />
                            <Text style={styles.flowNewText}>{newStock}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Review Footer */}
                    <View style={styles.footer}>
                      <Button
                        title="Edit Batch"
                        variant="secondary"
                        onPress={() => setStep('EDIT')}
                        style={styles.footerCancelBtn}
                        disabled={submitting}
                      />

                      <Button
                        title={`Confirm Restock (+${summary.totalUnits})`}
                        variant="primary"
                        onPress={handleConfirmFinal}
                        loading={submitting}
                        style={styles.footerSubmitBtn}
                        icon={
                          !submitting ? (
                            <Ionicons
                              name="checkmark-done"
                              size={18}
                              color={colors.textInverse}
                            />
                          ) : undefined
                        }
                      />
                    </View>
                  </>
                )}

                {/* ──────────────────────────────────────────────────────── */}
                {/* STEP 3: SUCCESS SCREEN                                  */}
                {/* ──────────────────────────────────────────────────────── */}
                {step === 'SUCCESS' && (
                  <View style={styles.successContainer}>
                    <View style={styles.successIconCircle}>
                      <Ionicons name="checkmark-circle" size={64} color={colors.credit} />
                    </View>

                    <Text style={styles.successTitle}>Batch Restock Complete</Text>
                    <Text style={styles.successMessage}>
                      Updated stock for {lastSubmittedSummary.itemsCount} products.
                    </Text>

                    <View style={styles.successStatsCard}>
                      <View style={styles.successStatItem}>
                        <Text style={styles.successStatVal}>{lastSubmittedSummary.itemsCount}</Text>
                        <Text style={styles.successStatLabel}>Products</Text>
                      </View>
                      <View style={styles.successStatDivider} />
                      <View style={styles.successStatItem}>
                        <Text style={[styles.successStatVal, { color: colors.credit }]}>
                          +{lastSubmittedSummary.totalUnits}
                        </Text>
                        <Text style={styles.successStatLabel}>Units Added</Text>
                      </View>
                    </View>

                    <Button
                      title="Back to Inventory"
                      variant="primary"
                      onPress={handleDone}
                      style={styles.successDoneBtn}
                    />
                  </View>
                )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitleCol: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 18,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 16,
  },
  searchSection: {
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
    paddingHorizontal: spacing.sm,
    height: 38,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  selectionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  selectionStripText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectionStripHighlight: {
    color: colors.primary,
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  rowCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F8FAFC',
  },
  rowInfoLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowProductName: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  rowUnitText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  rowMetaDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  stockPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  stockPillNormal: {
    backgroundColor: colors.surfaceSubtle,
  },
  stockPillLow: {
    backgroundColor: colors.statusPendingBg,
  },
  stockPillOut: {
    backgroundColor: colors.statusCancelledBg,
  },
  stockPillText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  stockPillTextNormal: {
    color: colors.textSecondary,
  },
  stockPillTextLow: {
    color: '#B45309',
  },
  stockPillTextOut: {
    color: colors.danger,
  },
  rowControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    height: 34,
  },
  stepperContainerActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  stepBtn: {
    paddingHorizontal: 10,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
    padding: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: 4,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  footerSummaryCol: {
    flex: 1,
  },
  footerSummaryText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  footerUnitsText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.accent,
    marginTop: 1,
  },
  footerReviewBtn: {
    flex: 1.2,
  },
  footerCancelBtn: {
    flex: 1,
  },
  footerSubmitBtn: {
    flex: 1.8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  backRowText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.primary,
  },
  reviewScrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reviewBannerText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12,
  },
  reviewItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  reviewItemLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  reviewProductName: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  reviewProductUnit: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  reviewStockFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flowOldText: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 13,
  },
  flowBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flowBadgeText: {
    ...typography.captionBold,
    color: '#059669',
    fontSize: 11,
  },
  flowNewText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  successIconCircle: {
    marginBottom: spacing.md,
  },
  successTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  successMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  successStatsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusLg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successStatItem: {
    alignItems: 'center',
  },
  successStatVal: {
    ...typography.hero,
    fontSize: 24,
    color: colors.textPrimary,
  },
  successStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  successStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  successDoneBtn: {
    width: '100%',
  },
});
