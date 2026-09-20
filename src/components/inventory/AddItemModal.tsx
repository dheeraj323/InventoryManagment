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

export const AddItemModal: React.FC<AddItemModalProps> = ({
  visible,
  onClose,
  product,
  onSave,
}) => {
  const isEdit = !!product;

  // Form States
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
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
        setUnit(product.unit || '');
        setPriceStr(product.price ? product.price.toString() : '');
        setStockStr(product.stockQty !== undefined ? product.stockQty.toString() : '');
        setThresholdStr(
          product.lowStockThreshold !== undefined ? product.lowStockThreshold.toString() : '10'
        );
      } else {
        setName('');
        setUnit('');
        setPriceStr('');
        setStockStr('');
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
      const finalCategory = product?.category || 'General';
      const finalUnit = unit.trim() || 'units';
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
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Product Name *</Text>
                    <Input
                      value={name}
                      onChangeText={(val) => {
                        setName(val);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      error={errors.name}
                      containerStyle={styles.cleanInputContainer}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Wholesale Price (₹) *</Text>
                    <Input
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

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <Text style={styles.fieldLabel}>{isEdit ? 'Current Stock *' : 'Initial Stock Qty *'}</Text>
                      <Input
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

                    <View style={styles.col}>
                      <Text style={styles.fieldLabel}>Low Stock Alert</Text>
                      <Input
                        value={thresholdStr}
                        onChangeText={(val) => {
                          setThresholdStr(val);
                          if (errors.threshold) setErrors((prev) => ({ ...prev, threshold: '' }));
                        }}
                        keyboardType="number-pad"
                        error={errors.threshold}
                        containerStyle={styles.cleanInputContainer}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Quantity / Unit (Optional)</Text>
                    <Input
                      value={unit}
                      onChangeText={setUnit}
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
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  col: {
    flex: 1,
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
