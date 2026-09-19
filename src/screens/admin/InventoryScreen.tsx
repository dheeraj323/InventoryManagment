import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { QuantitySelector } from '../../components/catalog/QuantitySelector';
import { colors, typography, spacing } from '../../theme';

export const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    products,
    isLoading,
    subscribeInventory,
    updateStock,
    fetchProducts,
  } = useInventoryStore();

  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync real-time inventory on mount
  useEffect(() => {
    const unsubscribe = subscribeInventory();
    return () => {
      unsubscribe();
    };
  }, [subscribeInventory]);

  // Counts for filter chips
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
    const q = search.trim().toLowerCase();

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
  }, [products, search, selectedFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchProducts();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUpdateStock = (productId: string, newStock: number) => {
    updateStock(productId, newStock);
  };

  const filters = [
    { key: 'ALL' as const, label: 'All Items', count: counts.all },
    { key: 'LOW_STOCK' as const, label: 'Low Stock', count: counts.low },
    { key: 'OUT_OF_STOCK' as const, label: 'Out of Stock', count: counts.out },
    { key: 'IN_STOCK' as const, label: 'In Stock', count: counts.in },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Stock & Inventory"
        subtitle={`${products.length} SKUs Monitored`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {/* Search Input Box */}
      <View style={styles.searchBox}>
        <Input
          placeholder="Search products by name or SKU..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
          rightIcon={
            search.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null
          }
          containerStyle={styles.searchInput}
        />
      </View>

      {/* Horizontal Filter Chips */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((filter) => {
            const isActive = selectedFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {filter.label} ({filter.count})
                </Text>
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const isOutOfStock = item.stockQty === 0;
          const isLowStock = !isOutOfStock && item.stockQty <= item.lowStockThreshold;

          return (
            <Card style={styles.card} outlined elevation="sm">
              <View style={styles.row}>
                {/* Product Info */}
                <View style={styles.infoCol}>
                  <Text style={styles.category}>{item.category || 'GENERAL'}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.skuText}>
                    {item.unit}
                  </Text>
                  <Text style={styles.priceText}>
                    ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Stock Controls & Status */}
                <View style={styles.stockCol}>
                  <Text style={styles.stockLabel}>Stock On Hand</Text>
                  <QuantitySelector
                    quantity={item.stockQty}
                    onIncrease={() => handleUpdateStock(item.id, item.stockQty + 1)}
                    onDecrease={() => handleUpdateStock(item.id, item.stockQty - 1)}
                    size="sm"
                  />

                  {isOutOfStock ? (
                    <View style={styles.outOfStockBadge}>
                      <Text style={styles.outOfStockText}>Out of Stock</Text>
                    </View>
                  ) : isLowStock ? (
                    <View style={styles.lowStockBadge}>
                      <Text style={styles.lowStockText}>Low Stock ({item.stockQty}/{item.lowStockThreshold})</Text>
                    </View>
                  ) : (
                    <Text style={styles.normalStockText}>Threshold: {item.lowStockThreshold}</Text>
                  )}
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            iconName="cube-outline"
            title="No Products Found"
            description={
              search.length > 0
                ? `No items match "${search}". Try searching with another keyword.`
                : 'There are no products matching the selected filter.'
            }
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBox: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
  },
  searchInput: {
    marginBottom: spacing.xs,
  },
  filterWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
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
    color: colors.textSecondary,
    fontSize: 11,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  category: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  skuText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceText: {
    ...typography.captionBold,
    color: colors.primary,
    marginTop: 2,
  },
  stockCol: {
    alignItems: 'flex-end',
  },
  stockLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
  },
  lowStockBadge: {
    backgroundColor: colors.statusPendingBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  lowStockText: {
    ...typography.captionBold,
    fontSize: 10,
    color: '#B45309',
  },
  outOfStockBadge: {
    backgroundColor: colors.statusCancelledBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  outOfStockText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.danger,
  },
  normalStockText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
  },
});
