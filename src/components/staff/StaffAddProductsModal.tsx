import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useDebounce } from '../../hooks';
import { ProductCard } from '../catalog/ProductCard';
import { QuantityModal } from '../catalog/QuantityModal';
import { Input } from '../common/Input';
import { EmptyState } from '../common/EmptyState';
import { Product, OrderItem } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface StaffAddProductsModalProps {
  visible: boolean;
  onClose: () => void;
  currentItems: OrderItem[];
  onSaveItems: (items: OrderItem[]) => void;
  vanStockMap?: Record<string, number>;
}

export const StaffAddProductsModal: React.FC<StaffAddProductsModalProps> = ({
  visible,
  onClose,
  currentItems,
  onSaveItems,
  vanStockMap,
}) => {
  const { products, fetchProducts } = useInventoryStore();

  const [localItems, setLocalItems] = useState<OrderItem[]>(currentItems);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 350);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedProductForModal, setSelectedProductForModal] = useState<{
    product: Product;
    currentQty: number;
    maxStock: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setLocalItems(currentItems);
      setSearchQuery('');
      setSelectedCategory('ALL');
      fetchProducts();
    }
  }, [visible, currentItems]);

  // Only products available in the van stock
  const vanProducts = useMemo(() => {
    if (!vanStockMap) return products;
    return products.filter((p) => (vanStockMap[p.id] || 0) > 0);
  }, [products, vanStockMap]);

  const categories = useMemo(() => {
    const uniqueCats = Array.from(new Set(vanProducts.map((p) => p.category))).filter(Boolean);
    return ['ALL', ...uniqueCats];
  }, [vanProducts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: vanProducts.length };
    vanProducts.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [vanProducts]);

  const filteredProducts = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    return vanProducts.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [vanProducts, debouncedSearchQuery, selectedCategory]);

  const getDeliveredQty = (productId: string): number => {
    const found = localItems.find((i) => i.productId === productId);
    return found ? found.deliveredQty : 0;
  };

  const getProductVanStock = (productId: string): number => {
    if (vanStockMap && vanStockMap[productId] !== undefined) {
      return vanStockMap[productId] || 0;
    }
    const found = products.find((p) => p.id === productId);
    return found ? found.stockQty || 0 : 0;
  };

  const handleUpdateProductQty = (product: Product, delta: number) => {
    const maxAllowed = getProductVanStock(product.id);

    setLocalItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const targetQty = existing.deliveredQty + delta;
        const newDelivered = Math.min(maxAllowed, Math.max(0, targetQty));
        const ordered = existing.orderedQty || 0;
        const newMissing = Math.max(0, ordered - newDelivered);

        // If product was newly added (orderedQty == 0) and delivered reaches 0, remove it
        if (newDelivered === 0 && ordered === 0) {
          return prev.filter((_, idx) => idx !== existingIndex);
        }

        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          deliveredQty: newDelivered,
          missingDamagedQty: newMissing,
          totalAmount: newDelivered * existing.unitPrice,
        };
        return updated;
      } else if (delta > 0 && maxAllowed > 0) {
        const initialQty = Math.min(maxAllowed, delta);
        const newItem: OrderItem = {
          id: `item_${product.id}_${Date.now()}`,
          productId: product.id,
          productName: product.name,
          unit: product.unit || 'unit',
          unitPrice: product.price,
          orderedQty: 0,
          deliveredQty: initialQty,
          missingDamagedQty: 0,
          damagedQty: 0,
          totalAmount: initialQty * product.price,
        };
        return [...prev, newItem];
      }
      return prev;
    });
  };

  const handleSetProductQty = (product: Product, newQty: number) => {
    const maxAllowed = getProductVanStock(product.id);
    const safeQty = Math.min(maxAllowed, Math.max(0, newQty));

    setLocalItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const ordered = existing.orderedQty || 0;
        const newMissing = Math.max(0, ordered - safeQty);

        if (safeQty === 0 && ordered === 0) {
          return prev.filter((_, idx) => idx !== existingIndex);
        }

        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          deliveredQty: safeQty,
          missingDamagedQty: newMissing,
          totalAmount: safeQty * existing.unitPrice,
        };
        return updated;
      } else if (safeQty > 0) {
        const newItem: OrderItem = {
          id: `item_${product.id}_${Date.now()}`,
          productId: product.id,
          productName: product.name,
          unit: product.unit || 'unit',
          unitPrice: product.price,
          orderedQty: 0,
          deliveredQty: safeQty,
          missingDamagedQty: 0,
          damagedQty: 0,
          totalAmount: safeQty * product.price,
        };
        return [...prev, newItem];
      }
      return prev;
    });
  };

  const totalDeliveredUnits = localItems.reduce((sum, item) => sum + item.deliveredQty, 0);
  const totalSubtotal = localItems.reduce((sum, item) => sum + item.deliveredQty * item.unitPrice, 0);

  const handleConfirmAndClose = () => {
    onSaveItems(localItems);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Add Items from Van</Text>
            <Text style={styles.headerSubtitle}>
              {vanProducts.length} Van Products Available
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchHeader}>
          <Input
            placeholder="Search van products by name or SKU..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Category Filter Chips */}
        <View style={styles.categoryFilterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryPill,
                    isSelected ? styles.categoryPillActive : null,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected ? styles.categoryPillTextActive : null,
                    ]}
                  >
                    {cat}
                  </Text>
                  <View
                    style={[
                      styles.pillCountBadge,
                      isSelected ? styles.pillCountBadgeActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillCountText,
                        isSelected ? styles.pillCountTextActive : null,
                      ]}
                    >
                      {categoryCounts[cat] || 0}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Products List */}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const qty = getDeliveredQty(item.id);
            const vanStock = getProductVanStock(item.id);
            const productWithVanStock = { ...item, stockQty: vanStock };
            return (
              <ProductCard
                product={productWithVanStock}
                quantityInCart={qty}
                onAddToCart={() => handleUpdateProductQty(item, 1)}
                onUpdateQty={(delta) => handleUpdateProductQty(item, delta)}
                onPressQuantity={() =>
                  setSelectedProductForModal({
                    product: item,
                    currentQty: qty,
                    maxStock: vanStock,
                  })
                }
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title={vanProducts.length === 0 ? 'No Products in Van' : 'No products found'}
              description={
                vanProducts.length === 0
                  ? 'There are no products currently available in your vehicle stock. Please ensure morning vehicle stock is loaded.'
                  : searchQuery
                  ? `No van products matching "${searchQuery}"`
                  : 'No van products in this category.'
              }
              actionTitle={vanProducts.length === 0 ? undefined : 'Clear Filters'}
              onAction={
                vanProducts.length === 0
                  ? undefined
                  : () => {
                      setSearchQuery('');
                      setSelectedCategory('ALL');
                    }
              }
            />
          }
        />

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarDetails}>
            <Text style={styles.bottomBarCount}>
              {totalDeliveredUnits} Units • {localItems.length} Products
            </Text>
            <Text style={styles.bottomBarTotal}>
              ₹{totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={handleConfirmAndClose}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.textInverse} />
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Quantity Modal for Quick Input */}
        {selectedProductForModal && (
          <QuantityModal
            visible={!!selectedProductForModal}
            productName={selectedProductForModal.product.name}
            unit={selectedProductForModal.product.unit || 'units'}
            unitPrice={selectedProductForModal.product.price}
            initialQty={selectedProductForModal.currentQty}
            maxStock={selectedProductForModal.maxStock}
            onConfirm={(newQty) => {
              handleSetProductQty(selectedProductForModal.product, newQty);
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHeader: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  categoryFilterWrapper: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryScroll: {
    paddingHorizontal: spacing.screenPadding,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  categoryPillTextActive: {
    color: colors.textInverse,
  },
  pillCountBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  pillCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pillCountText: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textSecondary,
  },
  pillCountTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: 90,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBarDetails: {
    flex: 1,
    marginRight: spacing.md,
  },
  bottomBarCount: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  bottomBarTotal: {
    ...typography.currency,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusLg,
    gap: 6,
  },
  doneBtnText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 13,
  },
});
