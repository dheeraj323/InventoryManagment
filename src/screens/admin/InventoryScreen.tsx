import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { QuantitySelector } from '../../components/catalog/QuantitySelector';
import { colors, typography, spacing } from '../../theme';

export const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { products, updateStock } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesLowStock = showLowStockOnly ? p.stockQty <= p.lowStockThreshold : true;
    return matchesSearch && matchesLowStock;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Stock & Inventory"
        subtitle={`${products.length} SKUs Monitored`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search products by name or SKU..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
        />

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              showLowStockOnly ? styles.filterPillActive : null,
            ]}
            onPress={() => setShowLowStockOnly(!showLowStockOnly)}
          >
            <Ionicons
              name="alert-circle-outline"
              size={14}
              color={showLowStockOnly ? colors.textInverse : colors.danger}
            />
            <Text
              style={[
                styles.filterPillText,
                showLowStockOnly ? styles.filterPillTextActive : null,
              ]}
            >
              Show Low Stock Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isLowStock = item.stockQty <= item.lowStockThreshold;

          return (
            <Card style={styles.card} outlined elevation="sm">
              <View style={styles.row}>
                <View style={styles.infoCol}>
                  <Text style={styles.category}>{item.category}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.skuText}>
                    SKU: {item.sku} • {item.unit}
                  </Text>
                  <Text style={styles.priceText}>₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>

                <View style={styles.stockCol}>
                  <Text style={styles.stockLabel}>Stock On Hand</Text>
                  <QuantitySelector
                    quantity={item.stockQty}
                    onIncrease={() => updateStock(item.id, item.stockQty + 5)}
                    onDecrease={() => updateStock(item.id, item.stockQty - 5)}
                    size="sm"
                  />
                  {isLowStock ? (
                    <View style={styles.lowStockBadge}>
                      <Text style={styles.lowStockText}>Low Stock ({item.stockQty})</Text>
                    </View>
                  ) : (
                    <Text style={styles.normalStockText}>Threshold: {item.lowStockThreshold}</Text>
                  )}
                </View>
              </View>
            </Card>
          );
        }}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: {
    paddingBottom: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.statusCancelledBg,
    alignSelf: 'flex-start',
  },
  filterPillActive: {
    backgroundColor: colors.danger,
  },
  filterPillText: {
    ...typography.captionBold,
    color: colors.danger,
    marginLeft: 4,
    fontSize: 11,
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
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
    backgroundColor: colors.statusCancelledBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  lowStockText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.danger,
  },
  normalStockText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
});
