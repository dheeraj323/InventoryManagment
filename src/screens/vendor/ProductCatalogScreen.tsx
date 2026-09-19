import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useCartStore } from '../../store/useCartStore';
import { ProductCard } from '../../components/catalog/ProductCard';
import { Input } from '../../components/common/Input';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { colors, typography, spacing } from '../../theme';

export const ProductCatalogScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { products } = useInventoryStore();
  const { items, addItem, updateQty, getTotal, getItemCount } = useCartStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getQtyInCart = (productId: string) => {
    const found = items.find((i) => i.productId === productId);
    return found ? found.orderedQty : 0;
  };

  const totalCartCount = getItemCount();
  const totalCartPrice = getTotal();

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Wholesale Catalog"
        subtitle={`${products.length} Items Available`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search products by name or SKU..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
          containerStyle={styles.searchInput}
        />

        {/* Category Pills Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, isActive ? styles.categoryPillActive : null]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isActive ? styles.categoryPillTextActive : null,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            quantityInCart={getQtyInCart(item.id)}
            onAddToCart={() => addItem(item, 1)}
            onUpdateQty={(delta) => updateQty(item.id, delta)}
          />
        )}
      />

      {/* Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartBarCount}>
              {totalCartCount} Item{totalCartCount > 1 ? 's' : ''} in Cart
            </Text>
            <Text style={styles.cartBarTotal}>₹{totalCartPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <Button
            title="View Cart & Checkout"
            onPress={() => navigation.navigate('Cart')}
            size="md"
            fullWidth={false}
            style={styles.cartBarBtn}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    marginBottom: spacing.xs,
  },
  categoriesScroll: {
    paddingBottom: spacing.md,
  },
  categoryPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
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
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: 80,
  },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopLeftRadius: spacing.borderRadiusLg,
    borderTopRightRadius: spacing.borderRadiusLg,
  },
  cartBarCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cartBarTotal: {
    ...typography.currency,
    color: colors.textInverse,
    fontSize: 18,
  },
  cartBarBtn: {
    backgroundColor: colors.accent,
  },
});
