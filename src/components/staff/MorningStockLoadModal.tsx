import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../../types';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useStaffStockStore } from '../../store/useStaffStockStore';
import { useOrderStore } from '../../store/useOrderStore';
import { Header } from '../common/Header';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { QuantitySelector } from '../catalog/QuantitySelector';
import { QuantityModal } from '../catalog/QuantityModal';
import { colors, typography, spacing } from '../../theme';

interface MorningStockLoadModalProps {
  visible: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
}

export const MorningStockLoadModal: React.FC<MorningStockLoadModalProps> = ({
  visible,
  onClose,
  staffId,
  staffName,
}) => {
  const { products } = useInventoryStore();
  const { loadMorningStock, todaySession, isSaving } = useStaffStockStore();
  const orders = useOrderStore((state) => state.orders);

  const [searchQuery, setSearchQuery] = useState('');
  // Total quantities in vehicle: Record<productId, number>
  const [totalQuantities, setTotalQuantities] = useState<Record<string, number>>({});
  const [selectedProductForModal, setSelectedProductForModal] = useState<{
    product: Product;
    currentQty: number;
  } | null>(null);

  // Compute pre-ordered quantities for this staff member from assigned orders
  const preOrderedMap = useMemo(() => {
    const map: Record<string, { qty: number; productName: string; unit: string; price: number }> = {};
    const assignedOrders = orders.filter(
      (o) =>
        o.assignedStaffId === staffId &&
        o.status !== 'CANCELLED' &&
        o.status !== 'DELIVERED'
    );

    assignedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = {
            qty: 0,
            productName: item.productName,
            unit: item.unit,
            price: item.unitPrice,
          };
        }
        map[item.productId].qty += item.orderedQty;
      });
    });

    return map;
  }, [orders, staffId]);

  // When modal opens, pre-fill total quantities with pre-ordered route quantities + existing extra stock
  useEffect(() => {
    if (visible) {
      const initialMap: Record<string, number> = {};

      // 1. Pre-fill route pre-orders
      const assignedOrders = orders.filter(
        (o) =>
          o.assignedStaffId === staffId &&
          o.status !== 'CANCELLED' &&
          o.status !== 'DELIVERED'
      );
      assignedOrders.forEach((order) => {
        (order.items || []).forEach((item) => {
          initialMap[item.productId] = (initialMap[item.productId] || 0) + item.orderedQty;
        });
      });

      // 2. If active session already exists today, merge previous session's total loaded
      if (todaySession && todaySession.items) {
        todaySession.items.forEach((item) => {
          initialMap[item.productId] =
            item.loadedQty !== undefined
              ? item.loadedQty
              : (item.preOrderedQty || 0) + (item.extraLoadedQty || 0);
        });
      }

      setTotalQuantities(initialMap);
      setSearchQuery('');
    }
  }, [visible, staffId]);

  // Filtered products (search by name, sku, category)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (p.active === false) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery]);

  const handleTotalQtyChange = (productId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setTotalQuantities((prev) => ({
      ...prev,
      [productId]: safeVal,
    }));
  };

  const handleStepTotalQty = (productId: string, delta: number) => {
    const current =
      totalQuantities[productId] !== undefined
        ? totalQuantities[productId]
        : preOrderedMap[productId]?.qty || 0;
    handleTotalQtyChange(productId, current + delta);
  };

  // Compile full loaded items list
  const compiledItems = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        unit: string;
        sku?: string;
        price?: number;
        preOrderedQty: number;
        extraLoadedQty: number;
      }
    >();

    // 1. Combine all products from catalog
    products.forEach((prod) => {
      const preOrdered = preOrderedMap[prod.id]?.qty || 0;
      const totalInVan =
        totalQuantities[prod.id] !== undefined ? totalQuantities[prod.id] : preOrdered;

      if (totalInVan > 0 || preOrdered > 0) {
        const effectivePreOrdered = Math.min(totalInVan, preOrdered);
        const extraLoaded = Math.max(0, totalInVan - preOrdered);

        itemMap.set(prod.id, {
          productId: prod.id,
          productName: prod.name,
          unit: prod.unit || 'Unit',
          sku: prod.sku,
          price: prod.price || prod.sellingPrice || 0,
          preOrderedQty: effectivePreOrdered,
          extraLoadedQty: extraLoaded,
        });
      }
    });

    // 2. Fallback for any pre-ordered item not explicitly in products list
    Object.entries(preOrderedMap).forEach(([productId, data]) => {
      if (!itemMap.has(productId)) {
        const totalInVan =
          totalQuantities[productId] !== undefined ? totalQuantities[productId] : data.qty;
        const effectivePreOrdered = Math.min(totalInVan, data.qty);
        const extraLoaded = Math.max(0, totalInVan - data.qty);

        itemMap.set(productId, {
          productId,
          productName: data.productName,
          unit: data.unit || 'Unit',
          price: data.price || 0,
          preOrderedQty: effectivePreOrdered,
          extraLoadedQty: extraLoaded,
        });
      }
    });

    return Array.from(itemMap.values());
  }, [products, preOrderedMap, totalQuantities]);

  const summary = useMemo(() => {
    const totalPreOrdered = compiledItems.reduce((sum, it) => sum + it.preOrderedQty, 0);
    const totalExtra = compiledItems.reduce((sum, it) => sum + it.extraLoadedQty, 0);
    const totalLoaded = totalPreOrdered + totalExtra;
    return { totalPreOrdered, totalExtra, totalLoaded };
  }, [compiledItems]);

  const handleSubmit = async () => {
    if (summary.totalLoaded === 0) {
      return;
    }

    try {
      await loadMorningStock({
        staffId,
        staffName,
        items: compiledItems,
      });

      onClose();
    } catch (err: any) {
      console.warn('Load failed:', err);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* ── Header ────────────────────────────────────────────── */}
        <Header
          title="Vehicle Stock Load"
          subtitle={`Staff: ${staffName} • ${products.length} Products`}
          showBack
          onBackPress={onClose}
        />

        {/* ── Information Notice ─────────────────────────────────── */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
          <Text style={styles.infoBannerText}>
            Route pre-orders are pre-filled. You can add extra buffer quantity to any SKU. Only extra units above route orders will deduct from warehouse inventory.
          </Text>
        </View>

        {/* ── Search Bar ─────────────────────────────────────────── */}
        <View style={styles.searchHeader}>
          <Input
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
            rightIcon={
              searchQuery ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ) : undefined
            }
            containerStyle={styles.searchInput}
          />
        </View>

        {/* ── Products List ──────────────────────────────────────── */}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const preOrdered = preOrderedMap[item.id]?.qty || 0;
            const currentTotal =
              totalQuantities[item.id] !== undefined ? totalQuantities[item.id] : preOrdered;
            const extraQty = Math.max(0, currentTotal - preOrdered);

            const warehouseStock = item.stockQty || 0;
            const isLowStock =
              warehouseStock > 0 && warehouseStock <= (item.lowStockThreshold || 10);

            return (
              <Card style={styles.productCard} outlined elevation="sm">
                {/* Product Title & Packaging Unit */}
                <View style={styles.cardHeader}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {Boolean(item.unit && item.unit.trim()) && (
                      <Text style={styles.unitDetail}>{item.unit}</Text>
                    )}
                  </View>

                  {/* Route Booked Pill */}
                  {preOrdered > 0 && (
                    <View style={styles.routeBadge}>
                      <Ionicons name="checkmark-done" size={12} color={colors.brandGreen} />
                      <Text style={styles.routeBadgeText}>
                        {preOrdered} in Route Orders
                      </Text>
                    </View>
                  )}
                </View>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* Bottom Row: Warehouse Stock, Price & Extra Stepper */}
                <View style={styles.cardBottomRow}>
                  <View style={styles.stockInfoBlock}>
                    <Text style={styles.priceAmount}>
                      ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>

                    {/* Stock Status Badge */}
                    {warehouseStock === 0 ? (
                      <View style={[styles.stockBadge, styles.stockBadgeOut]}>
                        <Text style={styles.stockTextOut}>Wh Extra: 0 left</Text>
                      </View>
                    ) : isLowStock ? (
                      <View style={[styles.stockBadge, styles.stockBadgeLow]}>
                        <View style={[styles.stockDot, { backgroundColor: colors.warning }]} />
                        <Text style={styles.stockTextLow}>Wh Extra: {warehouseStock} left</Text>
                      </View>
                    ) : (
                      <View style={[styles.stockBadge, styles.stockBadgeIn]}>
                        <View style={[styles.stockDot, { backgroundColor: colors.brandGreen }]} />
                        <Text style={styles.stockTextIn}>Wh Extra: {warehouseStock} available</Text>
                      </View>
                    )}
                  </View>

                  {/* Action Area: Vehicle Quantity Selector */}
                  <View style={styles.actionBlock}>
                    {currentTotal > 0 ? (
                      <View style={styles.qtyWithLabel}>
                        {extraQty > 0 ? (
                          <Text style={styles.extraPillText}>
                            {preOrdered > 0
                              ? `${preOrdered} route + ${extraQty} extra`
                              : `+${extraQty} extra`}
                          </Text>
                        ) : (
                          <Text style={styles.routeOnlyPillText}>Route pre-order ({preOrdered})</Text>
                        )}
                        <QuantitySelector
                          quantity={currentTotal}
                          onIncrease={() => handleStepTotalQty(item.id, 1)}
                          onDecrease={() => handleStepTotalQty(item.id, -1)}
                          onPressQuantity={() =>
                            setSelectedProductForModal({
                              product: item,
                              currentQty: currentTotal,
                            })
                          }
                          size="sm"
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleStepTotalQty(item.id, 1)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={16} color={colors.textInverse} />
                        <Text style={styles.addBtnText}>+ LOAD</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Total Van Carry Note */}
                {currentTotal > 0 && (
                  <View style={styles.totalVanRow}>
                    <Text style={styles.totalVanText}>
                      Total to carry in vehicle:{' '}
                      <Text style={{ fontWeight: '700', color: colors.primary }}>
                        {currentTotal} {item.unit || 'units'}
                      </Text>
                      {extraQty > 0 && (
                        <Text style={{ color: colors.accent, fontWeight: '600' }}>
                          {' '}
                          ({extraQty} extra buffer)
                        </Text>
                      )}
                    </Text>
                  </View>
                )}
              </Card>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? `No matches for "${searchQuery}"` : 'No inventory available.'}
              </Text>
            </View>
          }
        />

        {/* ── Bottom Floating Load Order Bar (Matching Vendor Catalog) ─ */}
        <View style={styles.floatingBar}>
          <View style={styles.barSummary}>
            <View style={styles.barTopSummary}>
              <Text style={styles.barMainCount}>{summary.totalLoaded} Units in Van</Text>
              <Text style={styles.barBreakdown}>
                {summary.totalPreOrdered} Route + {summary.totalExtra} Extra
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.confirmLoadBtn,
              (summary.totalLoaded === 0 || isSaving) && styles.confirmLoadBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={summary.totalLoaded === 0 || isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmLoadBtnText}>
              {isSaving ? 'Loading...' : 'Confirm Load'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        {/* ── Direct Keypad Input Modal ──────────────────────────── */}
        {selectedProductForModal && (
          <QuantityModal
            visible={!!selectedProductForModal}
            productName={selectedProductForModal.product.name}
            unit={selectedProductForModal.product.unit || 'Unit'}
            unitPrice={selectedProductForModal.product.price}
            initialQty={selectedProductForModal.currentQty}
            onConfirm={(newQty) => {
              handleTotalQtyChange(
                selectedProductForModal.product.id,
                newQty
              );
              setSelectedProductForModal(null);
            }}
            onClose={() => setSelectedProductForModal(null)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  infoBannerText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  searchHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    marginBottom: spacing.xs,
  },
  categoriesScroll: {
    paddingVertical: 2,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillRoute: {
    borderColor: colors.accent,
    backgroundColor: '#EFF6FF',
  },
  categoryPillText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  categoryPillTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: 90,
  },
  productCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleBlock: {
    flex: 1,
  },
  productName: {
    ...typography.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  unitDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
    fontSize: 12,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
    gap: 4,
  },
  routeBadgeText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 11,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    opacity: 0.8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockInfoBlock: {
    flex: 1,
  },
  priceAmount: {
    ...typography.currency,
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  stockBadgeIn: {
    backgroundColor: colors.brandGreenLight,
  },
  stockBadgeLow: {
    backgroundColor: '#FEF3C7',
  },
  stockBadgeOut: {
    backgroundColor: colors.surfaceSubtle,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockTextIn: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.brandGreen,
  },
  stockTextLow: {
    ...typography.captionBold,
    fontSize: 10,
    color: '#B45309',
  },
  stockTextOut: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textMuted,
  },
  actionBlock: {
    marginLeft: spacing.md,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  qtyWithLabel: {
    alignItems: 'flex-end',
  },
  extraPillText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  routeOnlyPillText: {
    ...typography.caption,
    color: colors.brandGreen,
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusMd,
    gap: 4,
    minHeight: 34,
  },
  addBtnDisabled: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
  addBtnTextDisabled: {
    color: colors.textMuted,
  },
  totalVanRow: {
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  totalVanText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  barSummary: {
    flex: 1,
  },
  barTopSummary: {},
  barMainCount: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
  },
  barBreakdown: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  confirmLoadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.borderRadiusXl,
    gap: 6,
  },
  confirmLoadBtnDisabled: {
    opacity: 0.45,
  },
  confirmLoadBtnText: {
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
    marginTop: 8,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
});
