import React, { useState } from 'react';
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
import { Vendor, VendorStatus } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface AddVendorModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (vendorData: Partial<Vendor>) => Promise<void> | void;
}

const VENDOR_TYPES = ['Kirana Store', 'Supermarket', 'Wholesaler', 'Retail Shop', 'Other'];

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [vendorType, setVendorType] = useState('Kirana Store');
  const [openingBalanceStr, setOpeningBalanceStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const errs: { [key: string]: string } = {};

    if (!shopName.trim()) {
      errs.shopName = 'Shop / Business name is required.';
    }
    if (!ownerName.trim()) {
      errs.ownerName = 'Proprietor name is required.';
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errs.phone = 'Valid 10-digit phone number is required.';
    }

    const numOpenBal = parseFloat(openingBalanceStr);
    if (openingBalanceStr.trim() !== '' && (isNaN(numOpenBal) || numOpenBal < 0)) {
      errs.openingBalance = 'Opening balance cannot be negative.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const openingBalance = parseFloat(openingBalanceStr) || 0;

      await onSave({
        shopName: shopName.trim(),
        name: ownerName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        vendorType,
        openingBalance,
        currentBalance: openingBalance,
        currentOutstanding: openingBalance,
        status: 'ACTIVE',
        active: true,
        payLaterEligible: true,
        preferredPaymentMode: 'CASH',
      });

      // Reset form
      setShopName('');
      setOwnerName('');
      setPhone('');
      setAddress('');
      setVendorType('Kirana Store');
      setOpeningBalanceStr('');
      setErrors({});
      onClose();
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to create vendor record.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
                      <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.title}>Register New Vendor</Text>
                      <Text style={styles.subtitle}>Add a retail shop to your distribution network</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Form Content */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {errors.form ? <Text style={styles.formErrorText}>{errors.form}</Text> : null}

                  {/* Section 1: Business Profile */}
                  <View style={styles.sectionHeading}>
                    <Text style={styles.sectionTitle}>1. Business & Contact Info</Text>
                  </View>

                  <Input
                    label="Shop / Business Name *"
                    value={shopName}
                    onChangeText={(v) => {
                      setShopName(v);
                      if (errors.shopName) setErrors((prev) => ({ ...prev, shopName: '' }));
                    }}
                    error={errors.shopName}
                  />

                  <Input
                    label="Proprietor / Owner Name *"
                    value={ownerName}
                    onChangeText={(v) => {
                      setOwnerName(v);
                      if (errors.ownerName) setErrors((prev) => ({ ...prev, ownerName: '' }));
                    }}
                    error={errors.ownerName}
                  />

                  <Input
                    label="Phone Number *"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={(v) => {
                      setPhone(v);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    error={errors.phone}
                  />

                  <Input
                    label="Address / Location (Optional)"
                    value={address}
                    onChangeText={setAddress}
                  />

                  {/* Business Type Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Business Category</Text>
                    <View style={styles.chipRow}>
                      {VENDOR_TYPES.map((type) => {
                        const isSelected = vendorType === type;
                        return (
                          <TouchableOpacity
                            key={type}
                            style={[styles.chip, isSelected && styles.chipActive]}
                            onPress={() => setVendorType(type)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                              {type}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Section 2: Financial Terms */}
                  <View style={[styles.sectionHeading, { marginTop: spacing.md }]}>
                    <Text style={styles.sectionTitle}>2. Opening Balance</Text>
                  </View>

                  <Input
                    label="Opening Balance (₹)"
                    keyboardType="numeric"
                    prefix="₹"
                    value={openingBalanceStr}
                    onChangeText={(v) => {
                      setOpeningBalanceStr(v);
                      if (errors.openingBalance)
                        setErrors((prev) => ({ ...prev, openingBalance: '' }));
                    }}
                    error={errors.openingBalance}
                  />
                </ScrollView>

                {/* Footer Buttons */}
                <View style={styles.footer}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={onClose}
                    style={styles.cancelBtn}
                    disabled={loading}
                  />
                  <Button
                    title="Register Vendor"
                    variant="primary"
                    onPress={handleSave}
                    loading={loading}
                    style={styles.saveBtn}
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
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
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
  closeBtn: {
    padding: 6,
    marginLeft: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionHeading: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: 4,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  col: {
    flex: 1,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  formErrorText: {
    ...typography.captionBold,
    color: colors.danger,
    backgroundColor: colors.debitLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
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
  saveBtn: {
    flex: 2,
  },
});
