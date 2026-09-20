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

export interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  product?: Product | null; // If provided -> EDIT mode, else -> ADD mode
  onSave: (productData: any) => Promise<void> | void;
}

const CATEGORY_OPTIONS = [
  'Staples & Flour',
  'Edible Oil',
  'Snacks & Instant',
  'Beverages',
  'Spices & Masala',
  'Dairy & Bakery',
  'Detergents & Home',
  'Personal Care',
];

const UNIT_TYPES = [
  'Bag',
  'Box',
  'Bottle',
  'Pouch',
  'Piece',
  'Carton',
  'Case',
  'Tin',
  'Custom',
];

export const AddItemModal: React.FC<AddItemModalProps> = ({
  visible,
  onClose,
  product,
  onSave,
}) => {
  const isEdit = !!product;

  // Form States
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [unitType, setUnitType] = useState('Bag');
  const [unitSpec, setUnitSpec] = useState('10 kg');
  const [customUnit, setCustomUnit] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [stockStr, setStockStr] = useState('');
  const [thresholdStr, setThresholdStr] = useState('10');
  const [submitting, setSubmitting] = useState(false);

  // Errors state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (visible) {
      if (product) {
        setName(product.name || '');
        if (CATEGORY_OPTIONS.includes(product.category)) {
          setCategory(product.category);
          setCustomCategory('');
        } else {
          setCategory('CUSTOM');
          setCustomCategory(product.category || '');
        }

        // Parse unit if existing (e.g. "Bag (10 kg)")
        const matchingUnit = UNIT_TYPES.find((u) =>
          product.unit.toLowerCase().startsWith(u.toLowerCase())
        );
        if (matchingUnit) {
          setUnitType(matchingUnit);
          const specMatch = product.unit.match(/\((.*?)\)/);
          setUnitSpec(specMatch ? specMatch[1] : '');
          setCustomUnit('');
        } else {
          setUnitType('Custom');
          setCustomUnit(product.unit || '');
          setUnitSpec('');
        }

        setPriceStr(product.price ? product.price.toString() : '');
        setStockStr(product.stockQty !== undefined ? product.stockQty.toString() : '');
        setThresholdStr(
          product.lowStockThreshold !== undefined ? product.lowStockThreshold.toString() : '10'
        );
      } else {
        // Reset for new item (Initial stock starts empty per requirements)
        setName('');
        setCategory(CATEGORY_OPTIONS[0]);
        setCustomCategory('');
        setUnitType('Bag');
        setUnitSpec('10 kg');
        setCustomUnit('');
        setPriceStr('');
        setStockStr('');
        setThresholdStr('10');
      }
      setErrors({});
      setSubmitting(false);
    }
  }, [visible, product]);

  const computeFinalUnit = () => {
    if (unitType === 'Custom') {
      return customUnit.trim() || 'Piece';
    }
    return unitSpec.trim() ? `${unitType} (${unitSpec.trim()})` : unitType;
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Product name is required.';
    }

    if (!isEdit) {
      const finalCat = category === 'CUSTOM' ? customCategory.trim() : category;
      if (!finalCat) {
        newErrors.category = 'Please select or specify a category.';
      }

      if (unitType === 'Custom' && !customUnit.trim()) {
        newErrors.unit = 'Please specify the custom unit format.';
      }
    }

    const parsedPrice = parseFloat(priceStr);
    if (priceStr.trim() === '' || isNaN(parsedPrice) || parsedPrice <= 0) {
      newErrors.price = 'Please enter a valid wholesale price greater than 0.';
    }

    const parsedStock = parseInt(stockStr, 10);
    if (stockStr.trim() === '' || isNaN(parsedStock) || parsedStock < 0) {
      newErrors.stock = 'Please enter a valid initial stock quantity (0 or more).';
    }

    const parsedThreshold = parseInt(thresholdStr, 10);
    if (thresholdStr.trim() === '' || isNaN(parsedThreshold) || parsedThreshold < 0) {
      newErrors.threshold = 'Please enter a valid low stock alert threshold.';
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
        ? customUnit.trim()
        : computeFinalUnit();
      const parsedPrice = parseFloat(priceStr);
      const parsedStock = parseInt(stockStr, 10);
      const parsedThreshold = parseInt(thresholdStr, 10);

      const payload = {
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
      console.error('Error saving item:', err);
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
                        {isEdit ? 'Edit Product' : 'Add Item'}
                      </Text>
                      <Text style={styles.subtitle}>
                        {isEdit
                          ? 'Modify product name, price, and stock levels'
                          : 'Add a product to your inventory'}
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

                {/* Form Sections */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SECTION 1: PRODUCT INFORMATION                          */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {isEdit ? '1. Product Details' : '1. Product Information'}
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Product Name *</Text>
                    <Input
                      placeholder="e.g. Aashirvaad Shuddh Chakki Atta"
                      value={name}
                      onChangeText={(val) => {
                        setName(val);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      error={errors.name}
                      containerStyle={styles.cleanInputContainer}
                    />
                  </View>

                  {/* Category Selection (Only when Adding a new item) */}
                  {!isEdit && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Category *</Text>
                      <View style={styles.chipGrid}>
                        {CATEGORY_OPTIONS.map((cat) => {
                          const isSelected = category === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              style={[styles.chip, isSelected && styles.chipSelected]}
                              onPress={() => {
                                setCategory(cat);
                                if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[styles.chipText, isSelected && styles.chipTextSelected]}
                              >
                                {cat}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          style={[styles.chip, category === 'CUSTOM' && styles.chipSelected]}
                          onPress={() => setCategory('CUSTOM')}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[styles.chipText, category === 'CUSTOM' && styles.chipTextSelected]}
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
                      {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
                    </View>
                  )}

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SECTION 2: PACKAGING AND PRICE                          */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
                    <Text style={styles.sectionTitle}>
                      {isEdit ? '2. Packaging Quantity & Price' : '2. Packaging & Wholesale Price'}
                    </Text>
                  </View>

                  {/* Quantity / Unit Spec Field (In Edit mode, keep direct quantity input) */}
                  {isEdit ? (
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Quantity / Packaging Unit (Optional)</Text>
                      <Input
                        placeholder="e.g. 500 ml, 1 Ltr, 200 gm, 10 kg, Box of 12"
                        value={customUnit}
                        onChangeText={(val) => {
                          setCustomUnit(val);
                          setUnitSpec(val);
                        }}
                        containerStyle={styles.cleanInputContainer}
                      />
                    </View>
                  ) : (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={styles.fieldLabel}>Packaging / Unit Type *</Text>
                        <View style={styles.chipGrid}>
                          {UNIT_TYPES.map((u) => {
                            const isSelected = unitType === u;
                            return (
                              <TouchableOpacity
                                key={u}
                                style={[styles.chip, isSelected && styles.chipSelected]}
                                onPress={() => {
                                  setUnitType(u);
                                  if (errors.unit) setErrors((prev) => ({ ...prev, unit: '' }));
                                }}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[styles.chipText, isSelected && styles.chipTextSelected]}
                                >
                                  {u}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {unitType !== 'Custom' ? (
                        <View style={styles.inputGroup}>
                          <Text style={styles.fieldLabel}>Weight / Pack Size (Optional)</Text>
                          <Input
                            placeholder="e.g. 10 kg, 12 x 1L, 24 units, 500g"
                            value={unitSpec}
                            onChangeText={setUnitSpec}
                            helperText={`Complete unit label: ${computeFinalUnit()}`}
                            containerStyle={styles.cleanInputContainer}
                          />
                        </View>
                      ) : (
                        <View style={styles.inputGroup}>
                          <Text style={styles.fieldLabel}>Custom Unit Format *</Text>
                          <Input
                            placeholder="e.g. Tin (15 kg), Bundle of 5"
                            value={customUnit}
                            onChangeText={setCustomUnit}
                            error={errors.unit}
                            containerStyle={styles.cleanInputContainer}
                          />
                        </View>
                      )}
                    </>
                  )}

                  <View style={styles.inputGroup}>
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

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SECTION 3: INITIAL / CURRENT STOCK                      */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
                    <Text style={styles.sectionTitle}>
                      {isEdit ? '3. Stock & Alert Threshold' : '3. Initial Stock & Alert Threshold'}
                    </Text>
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <Text style={styles.fieldLabel}>{isEdit ? 'Current Stock *' : 'Initial Stock Qty *'}</Text>
                      <Input
                        placeholder="e.g. 25"
                        value={stockStr}
                        onChangeText={(val) => {
                          setStockStr(val);
                          if (errors.stock) setErrors((prev) => ({ ...prev, stock: '' }));
                        }}
                        keyboardType="number-pad"
                        suffix={
                          isEdit && product?.unit
                            ? product.unit
                            : unitType !== 'Custom'
                            ? unitType.toLowerCase() + 's'
                            : 'units'
                        }
                        error={errors.stock}
                        containerStyle={styles.cleanInputContainer}
                      />
                    </View>

                    <View style={styles.col}>
                      <Text style={styles.fieldLabel}>Low Stock Alert</Text>
                      <Input
                        placeholder="10"
                        value={thresholdStr}
                        onChangeText={(val) => {
                          setThresholdStr(val);
                          if (errors.threshold) setErrors((prev) => ({ ...prev, threshold: '' }));
                        }}
                        keyboardType="number-pad"
                        suffix="threshold"
                        error={errors.threshold}
                        containerStyle={styles.cleanInputContainer}
                      />
                    </View>
                  </View>

                  <Text style={styles.thresholdHelper}>
                    You'll receive a warning when stock reaches this level or below.
                  </Text>
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
    maxHeight: '94%',
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
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: 6,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    paddingHorizontal: 11,
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
  },
  col: {
    flex: 1,
  },
  thresholdHelper: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    marginBottom: spacing.md,
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
