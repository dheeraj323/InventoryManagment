import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Product } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface SkuModalProps {
  visible: boolean;
  onClose: () => void;
  product?: Product | null; // If provided -> EDIT mode, else -> ADD mode
  onSave: (productData: any) => Promise<void> | void;
}

const PRESET_CATEGORIES = [
  'Staples & Flour',
  'Edible Oil',
  'Snacks & Instant',
  'Beverages',
  'Spices & Masala',
  'Dairy & Bakery',
  'Detergents & Home',
  'Personal Care',
];

const PRESET_UNITS = [
  'Box (12 pcs)',
  'Bag (10 kg)',
  'Bag (25 kg)',
  'Carton (24 pcs)',
  'Case (96 pcs)',
  'Bottle (1L)',
  'Pouch',
  'Piece',
];

export const SkuModal: React.FC<SkuModalProps> = ({
  visible,
  onClose,
  product,
  onSave,
}) => {
  const isEdit = !!product;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Staples & Flour');
  const [customCategory, setCustomCategory] = useState('');
  const [unit, setUnit] = useState('Box (12 pcs)');
  const [customUnit, setCustomUnit] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [stockStr, setStockStr] = useState('0');
  const [thresholdStr, setThresholdStr] = useState('10');
  const [submitting, setSubmitting] = useState(false);

  // Errors state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (visible) {
      if (product) {
        setName(product.name || '');
        if (PRESET_CATEGORIES.includes(product.category)) {
          setCategory(product.category);
          setCustomCategory('');
        } else {
          setCategory('CUSTOM');
          setCustomCategory(product.category || '');
        }

        if (PRESET_UNITS.includes(product.unit)) {
          setUnit(product.unit);
          setCustomUnit('');
        } else {
          setUnit('CUSTOM');
          setCustomUnit(product.unit || '');
        }

        setPriceStr(product.price ? product.price.toString() : '0');
        setStockStr(product.stockQty !== undefined ? product.stockQty.toString() : '0');
        setThresholdStr(
          product.lowStockThreshold !== undefined ? product.lowStockThreshold.toString() : '10'
        );
      } else {
        // Reset for new Product SKU
        setName('');
        setCategory(PRESET_CATEGORIES[0]);
        setCustomCategory('');
        setUnit(PRESET_UNITS[0]);
        setCustomUnit('');
        setPriceStr('');
        setStockStr('50');
        setThresholdStr('10');
      }
      setErrors({});
      setSubmitting(false);
    }
  }, [visible, product]);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Product name is required.';
    }

    if (!isEdit) {
      const finalCat = category === 'CUSTOM' ? customCategory.trim() : category;
      if (!finalCat) {
        newErrors.category = 'Please select or enter a category.';
      }

      const finalUnit = unit === 'CUSTOM' ? customUnit.trim() : unit;
      if (!finalUnit) {
        newErrors.unit = 'Please select or enter a packaging unit.';
      }
    }

    const parsedPrice = parseFloat(priceStr);
    if (priceStr.trim() === '' || isNaN(parsedPrice) || parsedPrice < 0) {
      newErrors.price = 'Please enter a valid wholesale price (₹).';
    }

    const parsedStock = parseInt(stockStr, 10);
    if (stockStr.trim() === '' || isNaN(parsedStock) || parsedStock < 0) {
      newErrors.stock = 'Please enter a valid stock quantity.';
    }

    const parsedThreshold = parseInt(thresholdStr, 10);
    if (thresholdStr.trim() === '' || isNaN(parsedThreshold) || parsedThreshold < 0) {
      newErrors.threshold = 'Please enter a valid low stock threshold.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const finalCategory = isEdit
        ? product?.category || 'General'
        : category === 'CUSTOM'
        ? customCategory.trim()
        : category;
      const finalUnit = isEdit
        ? product?.unit || 'Piece'
        : unit === 'CUSTOM'
        ? customUnit.trim()
        : unit;
      const parsedPrice = parseFloat(priceStr);
      const parsedStock = parseInt(stockStr, 10);
      const parsedThreshold = parseInt(thresholdStr, 10);

      const payload: any = {
        name: name.trim(),
        category: finalCategory,
        unit: finalUnit,
        price: parsedPrice,
        sellingPrice: parsedPrice,
        stockQty: parsedStock,
        availableStock: parsedStock,
        lowStockThreshold: parsedThreshold,
        minimumStock: parsedThreshold,
        active: true,
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error saving SKU item:', err);
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
                      <Ionicons
                        name={isEdit ? 'create-outline' : 'cube-outline'}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View>
                      <Text style={styles.title}>
                        {isEdit ? 'Edit Product Details' : 'Add New Item'}
                      </Text>
                      <Text style={styles.subtitle}>
                        {isEdit
                          ? 'Modify product name, price, and stock levels'
                          : 'Register a new item in catalog & stock inventory'}
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

                {/* Form Fields */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Product Name */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Product Name *</Text>
                    <Input
                      placeholder="e.g. Fortune Sunlite Sunflower Oil"
                      value={name}
                      onChangeText={(val) => {
                        setName(val);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      error={errors.name}
                      containerStyle={styles.cleanInputContainer}
                    />
                  </View>

                  {/* Category Chips (Only when adding) */}
                  {!isEdit && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Category</Text>
                      <View style={styles.chipGrid}>
                        {PRESET_CATEGORIES.map((cat) => {
                          const isSelected = category === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              style={[
                                styles.chip,
                                isSelected && styles.chipSelected,
                              ]}
                              onPress={() => {
                                setCategory(cat);
                                if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  isSelected && styles.chipTextSelected,
                                ]}
                              >
                                {cat}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          style={[
                            styles.chip,
                            category === 'CUSTOM' && styles.chipSelected,
                          ]}
                          onPress={() => setCategory('CUSTOM')}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              category === 'CUSTOM' && styles.chipTextSelected,
                            ]}
                          >
                            + Custom
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {category === 'CUSTOM' && (
                        <Input
                          placeholder="Enter custom category name..."
                          value={customCategory}
                          onChangeText={setCustomCategory}
                          containerStyle={styles.customFieldInput}
                        />
                      )}
                      {errors.category && (
                        <Text style={styles.errorText}>{errors.category}</Text>
                      )}
                    </View>
                  )}

                  {/* Packaging Unit (In Edit mode, keep direct quantity/unit input) */}
                  {isEdit ? (
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Quantity / Packaging Unit (Optional)</Text>
                      <Input
                        placeholder="e.g. 500 ml, 1 Ltr, 200 gm, 10 kg, Box of 12"
                        value={customUnit}
                        onChangeText={setCustomUnit}
                        containerStyle={styles.cleanInputContainer}
                      />
                    </View>
                  ) : (
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Packaging / Unit Format</Text>
                      <View style={styles.chipGrid}>
                        {PRESET_UNITS.map((u) => {
                          const isSelected = unit === u;
                          return (
                            <TouchableOpacity
                              key={u}
                              style={[
                                styles.chip,
                                isSelected && styles.chipSelected,
                              ]}
                              onPress={() => {
                                setUnit(u);
                                if (errors.unit) setErrors((prev) => ({ ...prev, unit: '' }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  isSelected && styles.chipTextSelected,
                                ]}
                              >
                                {u}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          style={[
                            styles.chip,
                            unit === 'CUSTOM' && styles.chipSelected,
                          ]}
                          onPress={() => setUnit('CUSTOM')}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              unit === 'CUSTOM' && styles.chipTextSelected,
                            ]}
                          >
                            + Custom
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {unit === 'CUSTOM' && (
                        <Input
                          placeholder="e.g. Barrel (200L), 500g Tub"
                          value={customUnit}
                          onChangeText={setCustomUnit}
                          containerStyle={styles.customFieldInput}
                        />
                      )}
                      {errors.unit && <Text style={styles.errorText}>{errors.unit}</Text>}
                    </View>
                  )}

                  {/* Price & Stock in Two Columns */}
                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <Text style={styles.fieldLabel}>Wholesale Price (₹) *</Text>
                      <Input
                        placeholder="0.00"
                        value={priceStr}
                        onChangeText={(val) => {
                          setPriceStr(val);
                          if (errors.price) setErrors((prev) => ({ ...prev, price: '' }));
                        }}
                        keyboardType="decimal-pad"
                        prefix="₹"
                        error={errors.price}
                        containerStyle={styles.cleanInputContainer}
                      />
                    </View>

                    <View style={styles.col}>
                      <Text style={styles.fieldLabel}>
                        {isEdit ? 'Stock On Hand' : 'Initial Stock Qty'}
                      </Text>
                      <Input
                        placeholder="0"
                        value={stockStr}
                        onChangeText={(val) => {
                          setStockStr(val);
                          if (errors.stock) setErrors((prev) => ({ ...prev, stock: '' }));
                        }}
                        keyboardType="number-pad"
                        error={errors.stock}
                        containerStyle={styles.cleanInputContainer}
                      />
                    </View>
                  </View>

                  {/* Low Stock Alert Threshold */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Low Stock Alert Threshold</Text>
                    <Input
                      placeholder="10"
                      value={thresholdStr}
                      onChangeText={(val) => {
                        setThresholdStr(val);
                        if (errors.threshold) setErrors((prev) => ({ ...prev, threshold: '' }));
                      }}
                      keyboardType="number-pad"
                      helperText="Triggers low stock warning when inventory drops to or below this level"
                      error={errors.threshold}
                      containerStyle={styles.cleanInputContainer}
                    />
                  </View>
                </ScrollView>

                {/* Footer Buttons */}
                <View style={styles.footer}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={onClose}
                    style={styles.cancelBtn}
                    disabled={submitting}
                  />
                  <Button
                    title={isEdit ? 'Save Changes' : 'Add Item'}
                    variant="primary"
                    onPress={handleSubmit}
                    loading={submitting}
                    style={styles.submitBtn}
                    icon={
                      !submitting ? (
                        <Ionicons
                          name={isEdit ? 'checkmark-circle-outline' : 'add-circle-outline'}
                          size={18}
                          color={colors.textInverse}
                        />
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
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cleanInputContainer: {
    marginBottom: 0,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textInverse,
  },
  customFieldInput: {
    marginTop: spacing.xs,
    marginBottom: 0,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  col: {
    flex: 1,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 4,
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
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 2,
  },
});
