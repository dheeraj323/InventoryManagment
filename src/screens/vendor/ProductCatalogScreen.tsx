import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useCartStore } from '../../store/useCartStore';
import { useDebounce } from '../../hooks';
import { ProductCard } from '../../components/catalog/ProductCard';
import { QuantityModal } from '../../components/catalog/QuantityModal';
import { Input } from '../../components/common/Input';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { Product } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const ProductCatalogScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { products, refreshCatalog } = useInventoryStore();
  const { items, addItem, updateQty, setQty, getTotal, getSubtotal, getItemCount } = useCartStore();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 450);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<{
    product: Product;
    currentQty: number;
  } | null>(null);

  const categories = useMemo(() => {
    const uniqueCats = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    return ['ALL', ...uniqueCats];
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: products.length };
    products.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, debouncedSearchQuery, selectedCategory]);

  // Chunked pagination state (loads 15 products per chunk on scroll)
  const CHUNK_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [debouncedSearchQuery, selectedCategory]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleLoadMore = () => {
    if (visibleCount < filteredProducts.length) {
      setVisibleCount((prev) => Math.min(prev + CHUNK_SIZE, filteredProducts.length));
    }
  };

  const getQtyInCart = (productId: string) => {
    const found = items.find((i) => i.productId === productId);
    return found ? found.orderedQty : 0;
  };

  const totalCartUnits = getItemCount();
  const totalCartTypes = items.length;
  const totalCartPrice = getTotal();
  const totalCartSubtotal = getSubtotal();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshCatalog(true);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleModalConfirm = (newQty: number) => {
    if (!selectedProductForModal) return;
    const { product } = selectedProductForModal;
    if (newQty <= 0) {
      setQty(product.id, 0);
    } else {
      setQty(product.id, newQty);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Screen Header ───────────────────────────────────────── */}
      <Header
        title="Wholesale Catalog"
        subtitle={`${products.length} Products Monitored`}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        rightAction={
          <TouchableOpacity
            style={styles.cartIconBtn}
            onPress={() => navigation.navigate('Cart')}
            accessibilityLabel={`Order Cart with ${totalCartUnits} items`}
            accessibilityRole="button"
          >
            <Ionicons name="cart-outline" size={22} color={colors.primary} />
            {totalCartUnits > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartUnits}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      {/* ── Search Bar & Category Filter Chips ──────────────────── */}
      <View style={styles.searchHeader}>
        <Input
          placeholder="Search products by name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
          rightIcon={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
          containerStyle={styles.searchInput}
        />

        {/* Category Horizontal Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const count = categoryCounts[cat] || 0;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isActive && styles.categoryPillTextActive,
                  ]}
                >
                  {cat === 'ALL' ? 'All Items' : cat}
                </Text>
                <View
                  style={[
                    styles.pillCountBadge,
                    isActive && styles.pillCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillCountText,
                      isActive && styles.pillCountTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Product FlatList (Chunked pagination with scroll loading) ──── */}
      <FlatList
        data={paginatedProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          totalCartUnits > 0 ? styles.listContentWithBar : null,
        ]}
        showsVerticalScrollIndicator={false}
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
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            quantityInCart={getQtyInCart(item.id)}
            onAddToCart={() => addItem(item, 1)}
            onUpdateQty={(delta) => updateQty(item.id, delta)}
            onPressQuantity={() =>
              setSelectedProductForModal({
                product: item,
                currentQty: getQtyInCart(item.id),
              })
            }
          />
        )}
        ListFooterComponent={
          visibleCount < filteredProducts.length ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.footerLoaderText}>
                Loading more items ({visibleCount} of {filteredProducts.length})...
              </Text>
            </View>
          ) : filteredProducts.length > 0 ? (
            <View style={styles.footerEnd}>
              <Text style={styles.footerEndText}>
                Showing all {filteredProducts.length} wholesale products
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState
              iconName="search-outline"
              title="No Products Found"
              description={
                searchQuery
                  ? `No wholesale items matched "${searchQuery}". Check the spelling or clear the filter.`
                  : `No products available under category "${selectedCategory}".`
              }
              actionTitle={searchQuery || selectedCategory !== 'ALL' ? 'Reset Filters' : undefined}
              onAction={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
            />
          </View>
        }
      />

      {/* ── Sticky Order Cart / Cart Bar ───────────────────────── */}
      {totalCartUnits > 0 && (
        <View style={styles.cartBar}>
          <View style={styles.cartBarDetails}>
            <View style={styles.cartMetaRow}>
              <Ionicons name="cube-outline" size={14} color={colors.accent} />
              <Text style={styles.cartBarCount}>
                {totalCartTypes} Item{totalCartTypes > 1 ? 's' : ''} ({totalCartUnits} unit{totalCartUnits > 1 ? 's' : ''})
              </Text>
            </View>
            <Text style={styles.cartBarTotal}>
              ₹{totalCartPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cartBarBtn}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.85}
            accessibilityLabel="View Order Cart and Checkout"
            accessibilityRole="button"
          >
            <Text style={styles.cartBarBtnText}>View Order Cart</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Fast Bulk Quantity Keypad Modal ──────────────────────── */}
      {selectedProductForModal && (
        <QuantityModal
          visible={!!selectedProductForModal}
          productName={selectedProductForModal.product.name}
          unit={selectedProductForModal.product.unit}
          unitPrice={selectedProductForModal.product.price}
          initialQty={selectedProductForModal.currentQty}
          maxStock={selectedProductForModal.product.stockQty}
          onConfirm={handleModalConfirm}
          onClose={() => setSelectedProductForModal(null)}
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
  cartIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 9,
  },
  searchHeader: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    marginBottom: spacing.xs,
  },
  categoriesScroll: {
    paddingBottom: spacing.sm + 2,
    gap: 6,
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
    paddingBottom: spacing.xxl,
  },
  listContentWithBar: {
    paddingBottom: 96,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  cartBar: {
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
  cartBarDetails: {
    flex: 1,
    marginRight: spacing.md,
  },
  cartMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  cartBarCount: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  cartBarTotal: {
    ...typography.currency,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  cartBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusLg,
    gap: 6,
  },
  cartBarBtnText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 13,
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

