import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useDebounce } from '../../hooks';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { StockAdjustmentModal } from '../../components/inventory/StockAdjustmentModal';
import { AddItemModal } from '../../components/inventory/AddItemModal';
import { BulkRefillModal } from '../../components/inventory/BulkRefillModal';
import { Product } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    products,
    isLoading,
    updateStock,
    bulkUpdateStock,
    addProduct,
    updateProduct,
    deleteProduct,
    refreshCatalog,
  } = useInventoryStore();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 450);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modal states
  const [isAddItemVisible, setIsAddItemVisible] = useState(false);
  const [isBulkRefillVisible, setIsBulkRefillVisible] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [actionMenuProduct, setActionMenuProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Counts for summary filter chips
  const counts = useMemo(() => {
    let lowCount = 0;
    let outCount = 0;
    let inCount = 0;

    for (const p of products) {
      if (p.stockQty === 0) {
        outCount++;
      } else if (p.stockQty <= p.lowStockThreshold) {
        lowCount++;
      } else {
        inCount++;
      }
    }

    return {
      all: products.length,
      low: lowCount,
      out: outCount,
      in: inCount,
    };
  }, [products]);

  // Filtered list
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    return products.filter((p) => {
      const matchesSearch =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedFilter === 'LOW_STOCK') {
        return p.stockQty <= p.lowStockThreshold && p.stockQty > 0;
      }
      if (selectedFilter === 'OUT_OF_STOCK') {
        return p.stockQty === 0;
      }
      if (selectedFilter === 'IN_STOCK') {
        return p.stockQty > p.lowStockThreshold;
      }
      return true;
    });
  }, [products, debouncedSearch, selectedFilter]);

  // Chunked pagination state (loads 15 products per chunk on scroll)
  const CHUNK_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  // Reset pagination whenever search query or category filter changes
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [debouncedSearch, selectedFilter]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleLoadMore = () => {
    if (visibleCount < filteredProducts.length) {
      setVisibleCount((prev) => Math.min(prev + CHUNK_SIZE, filteredProducts.length));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      await refreshCatalog(true);
    } catch (err) {
      setFetchError('Failed to refresh inventory. Pull down to retry.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenAdd = () => {
    setProductToEdit(null);
    setIsAddItemVisible(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setActionMenuProduct(null);
    setProductToEdit(prod);
    setIsAddItemVisible(true);
  };

  const handleSaveItem = async (productData: any) => {
    if (productToEdit) {
      await updateProduct(productToEdit.id, productData);
    } else {
      await addProduct(productData);
    }
  };

  const handleAdjustStockConfirm = async (productId: string, newStock: number) => {
    await updateStock(productId, newStock);
  };

  const handleBulkRefillConfirm = async (updates: { productId: string; addedQty: number }[]) => {
    await bulkUpdateStock(updates);
  };

  const handleDeletePrompt = (prod: Product) => {
    setActionMenuProduct(null);
    setProductToDelete(prod);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProduct(productToDelete.id);
      setProductToDelete(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
      Alert.alert('Delete Error', 'Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filterChips = [
    { key: 'ALL' as const, label: 'All Items', count: counts.all, dotColor: undefined },
    { key: 'LOW_STOCK' as const, label: 'Low Stock', count: counts.low, dotColor: colors.warning },
    { key: 'OUT_OF_STOCK' as const, label: 'Out of Stock', count: counts.out, dotColor: colors.danger },
    { key: 'IN_STOCK' as const, label: 'In Stock', count: counts.in, dotColor: colors.credit },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Screen Header ───────────────────────────────────────── */}
      <Header
        title="Inventory"
        subtitle={`${products.length} Products Monitored`}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        rightAction={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={handleOpenAdd}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add New Item"
          >
            <Ionicons name="add" size={16} color={colors.textInverse} />
            <Text style={styles.headerAddBtnText}>Add Item</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Search & Filter Controls ────────────────────────────── */}
      <View style={styles.topControlSection}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={colors.textMuted} />
          <TextInput
            placeholder="Search products or SKU..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {filterChips.map((f) => {
            const isActive = selectedFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  f.key === 'LOW_STOCK' && counts.low > 0 && !isActive ? styles.chipWarning : null,
                  f.key === 'OUT_OF_STOCK' && counts.out > 0 && !isActive ? styles.chipDanger : null,
                ]}
                onPress={() => setSelectedFilter(f.key)}
                activeOpacity={0.7}
              >
                {f.dotColor && (
                  <View style={[styles.filterDot, { backgroundColor: f.dotColor }]} />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {f.label} ({f.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Product List ────────────────────────────────────────── */}
      {isLoading && products.length === 0 ? (
        <LoadingState message="Loading inventory items..." />
      ) : fetchError && products.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.danger} />
          <Text style={styles.errorTitle}>Failed to Load Inventory</Text>
          <Text style={styles.errorSubtitle}>{fetchError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={paginatedProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={CHUNK_SIZE}
          maxToRenderPerBatch={CHUNK_SIZE}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const currentStock = item.stockQty || 0;
            const threshold = item.lowStockThreshold || 10;
            const isOutOfStock = currentStock === 0;
            const isLowStock = !isOutOfStock && currentStock <= threshold;
            const unitLabel = item.unit || 'units';

            return (
              <Card style={styles.productCard} outlined elevation="sm">
                {/* Top Row: Overflow Menu */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.moreOptionsBtn}
                    onPress={() => setActionMenuProduct(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="More options"
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Main Row: Product Details & Stock Badge */}
                <View style={styles.cardBodyRow}>
                  <View style={styles.productInfoCol}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {Boolean(item.unit && item.unit.trim()) && (
                      <Text style={styles.packagingText}>{item.unit}</Text>
                    )}
                    <Text style={styles.priceText}>
                      ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>

                  {/* Stock Quantity Column */}
                  <View style={styles.stockStatusCol}>
                    <Text
                      style={[
                        styles.stockNumber,
                        isOutOfStock
                          ? styles.stockOut
                          : isLowStock
                          ? styles.stockLow
                          : styles.stockIn,
                      ]}
                    >
                      {currentStock}
                    </Text>
                    <Text style={styles.stockUnitLabel}>in stock</Text>

                    {/* Stock Status Pill */}
                    {isOutOfStock ? (
                      <View style={[styles.statusPill, styles.statusPillOut]}>
                        <Text style={styles.statusTextOut}>Out of Stock</Text>
                      </View>
                    ) : isLowStock ? (
                      <View style={[styles.statusPill, styles.statusPillLow]}>
                        <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
                        <Text style={styles.statusTextLow}>Low ({currentStock}/{threshold})</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusPill, styles.statusPillIn]}>
                        <View style={[styles.statusDot, { backgroundColor: colors.brandGreen }]} />
                        <Text style={styles.statusTextIn}>In Stock</Text>
                      </View>
                    )}
                  </View>
                </View>

              </Card>
            );
          }}
          ListFooterComponent={
            visibleCount < filteredProducts.length ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.footerLoaderText}>
                  Loading more products ({visibleCount} of {filteredProducts.length})...
                </Text>
              </View>
            ) : filteredProducts.length > 0 ? (
              <View style={styles.footerEnd}>
                <Text style={styles.footerEndText}>
                  Showing all {filteredProducts.length} items
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              iconName="cube-outline"
              title={
                search.length > 0 || selectedFilter !== 'ALL'
                  ? 'No Matching Products'
                  : 'No Inventory Products Yet'
              }
              description={
                search.length > 0
                  ? `No items match "${search}". Try resetting the search.`
                  : selectedFilter !== 'ALL'
                  ? 'There are no products under the selected filter.'
                  : 'Add your first product to start managing catalog and stock.'
              }
              actionTitle={
                search.length > 0 || selectedFilter !== 'ALL' ? 'Reset Filters' : '+ Add Item'
              }
              onAction={
                search.length > 0 || selectedFilter !== 'ALL'
                  ? () => {
                      setSearch('');
                      setSelectedFilter('ALL');
                    }
                  : handleOpenAdd
              }
            />
          }
        />
      )}

      {/* ── Modern Floating Action Bar (Bulk Refill) ─────────────── */}
      <View style={styles.floatingActionContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.bulkRefillFloatingBtn}
          onPress={() => setIsBulkRefillVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.bulkIconCircle}>
            <Ionicons name="layers" size={17} color={colors.primary} />
          </View>
          <Text style={styles.bulkRefillFloatingText}>Bulk Refill Stock</Text>
          {counts.low > 0 && (
            <View style={styles.lowAlertPill}>
              <Text style={styles.lowAlertText}>{counts.low} Low</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Product Action Menu Modal (Edit / Delete / Adjust) ────── */}
      {actionMenuProduct && (
        <Modal
          visible={!!actionMenuProduct}
          transparent
          animationType="fade"
          onRequestClose={() => setActionMenuProduct(null)}
        >
          <TouchableWithoutFeedback onPress={() => setActionMenuProduct(null)}>
            <View style={styles.menuModalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.menuModalCard}>
                  {/* Header */}
                  <View style={styles.menuHeaderRow}>
                    <View style={styles.menuHeaderInfo}>
                      <Text style={styles.menuProductTitle} numberOfLines={1}>
                        {actionMenuProduct.name}
                      </Text>
                      <Text style={styles.menuProductUnit}>
                        {actionMenuProduct.unit} • ₹{actionMenuProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setActionMenuProduct(null)}
                      style={styles.menuCloseBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.menuDivider} />

                  {/* Option 1: Adjust Stock */}
                  <TouchableOpacity
                    style={styles.menuOptionRow}
                    onPress={() => {
                      const prod = actionMenuProduct;
                      setActionMenuProduct(null);
                      setAdjustingProduct(prod);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuOptionIconCircle, { backgroundColor: colors.accentLight }]}>
                      <Ionicons name="swap-vertical" size={18} color={colors.accent} />
                    </View>
                    <View style={styles.menuOptionTextCol}>
                      <Text style={styles.menuOptionTitle}>Adjust Stock</Text>
                      <Text style={styles.menuOptionSub}>Quickly add or remove units</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  {/* Option 2: Edit Product Details */}
                  <TouchableOpacity
                    style={styles.menuOptionRow}
                    onPress={() => {
                      const prod = actionMenuProduct;
                      setActionMenuProduct(null);
                      setProductToEdit(prod);
                      setIsAddItemVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuOptionIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
                      <Ionicons name="create-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.menuOptionTextCol}>
                      <Text style={styles.menuOptionTitle}>Edit Product</Text>
                      <Text style={styles.menuOptionSub}>Change name, price, category or packaging</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  {/* Option 3: Delete Product */}
                  <TouchableOpacity
                    style={[styles.menuOptionRow, styles.menuDeleteRow]}
                    onPress={() => {
                      const prod = actionMenuProduct;
                      setActionMenuProduct(null);
                      setProductToDelete(prod);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuOptionIconCircle, { backgroundColor: colors.debitLight }]}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </View>
                    <View style={styles.menuOptionTextCol}>
                      <Text style={[styles.menuOptionTitle, { color: colors.danger }]}>Delete Product</Text>
                      <Text style={styles.menuOptionSub}>Permanently remove from inventory</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* ── Single Product Stock Adjustment Modal ─────────────────── */}
      {adjustingProduct && (
        <StockAdjustmentModal
          visible={!!adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          product={adjustingProduct}
          onConfirm={handleAdjustStockConfirm}
        />
      )}

      {/* ── Add / Edit Item Modal ─────────────────────────────────── */}
      <AddItemModal
        visible={isAddItemVisible}
        onClose={() => setIsAddItemVisible(false)}
        product={productToEdit}
        onSave={handleSaveItem}
      />

      {/* ── Bulk Refill Modal with Review Changes Step ────────────── */}
      <BulkRefillModal
        visible={isBulkRefillVisible}
        onClose={() => setIsBulkRefillVisible(false)}
        products={products}
        onConfirm={handleBulkRefillConfirm}
      />

      {/* ── Delete Item Confirmation Modal ────────────────────────── */}
      {productToDelete && (
        <ConfirmationModal
          visible={!!productToDelete}
          title="Delete Product"
          message={`Are you sure you want to delete "${productToDelete.name}"? This action permanently removes the item from your inventory.`}
          confirmTitle="Delete"
          cancelTitle="Keep"
          variant="danger"
          loading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setProductToDelete(null)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  headerAddBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
  topControlSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    marginHorizontal: spacing.screenPadding,
    paddingHorizontal: spacing.md,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  filterChipsRow: {
    paddingHorizontal: spacing.screenPadding,
    gap: 6,
    paddingTop: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  chipDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterChipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 90, // Leave room for floating bulk refill button
  },
  productCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusLg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  moreOptionsBtn: {
    padding: 4,
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  productInfoCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  productName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  packagingText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceText: {
    ...typography.captionBold,
    color: colors.primary,
    marginTop: 3,
    fontSize: 13,
  },
  priceUnitText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
  },
  stockStatusCol: {
    alignItems: 'flex-end',
    minWidth: 90,
  },
  stockNumber: {
    ...typography.hero,
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  stockIn: {
    color: colors.textPrimary,
  },
  stockLow: {
    color: '#B45309',
  },
  stockOut: {
    color: colors.danger,
  },
  stockUnitLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  statusPillIn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  statusPillLow: {
    backgroundColor: colors.statusPendingBg,
  },
  statusPillOut: {
    backgroundColor: colors.statusCancelledBg,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusTextIn: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.credit,
  },
  statusTextLow: {
    ...typography.captionBold,
    fontSize: 10,
    color: '#B45309',
  },
  statusTextOut: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.danger,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  adjustStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: spacing.borderRadiusSm,
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjustStockBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  floatingActionContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkRefillFloatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: spacing.borderRadiusFull,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  bulkIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkRefillFloatingText: {
    ...typography.bodyBold,
    color: colors.textInverse,
    fontSize: 13,
  },
  lowAlertPill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
  },
  lowAlertText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 10,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.xs,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  errorSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  retryBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  menuModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  menuHeaderInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  menuProductCategory: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  menuProductTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: 1,
  },
  menuProductUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuCloseBtn: {
    padding: 4,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  menuOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: 6,
  },
  menuDeleteRow: {
    marginTop: 4,
  },
  menuOptionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuOptionTextCol: {
    flex: 1,
  },
  menuOptionTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  menuOptionSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  footerLoaderText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  footerEnd: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerEndText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
});
