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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { GoogleMapsLocationPicker } from '../common/GoogleMapsLocationPicker';
import { Vendor, VendorStatus } from '../../types';
import { useRouteStore } from '../../store/useRouteStore';
import { colors, typography, spacing } from '../../theme';

export interface AddVendorModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (vendorData: Partial<Vendor> & { password?: string }) => Promise<void> | void;
}

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { routes, createRoute } = useRouteStore();

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [isCreatingNewRoute, setIsCreatingNewRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanUser) {
      errs.username = 'Username is required for vendor login.';
    } else if (cleanUser.length < 3) {
      errs.username = 'Username must be at least 3 characters.';
    } else if (!/^[a-z0-9_]+$/.test(cleanUser)) {
      errs.username = 'Username can only contain letters, numbers, and underscores.';
    }

    if (!password) {
      errs.password = 'Password is required for vendor login.';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      let finalRouteId = selectedRouteId;
      let finalRouteName = '';

      if (isCreatingNewRoute && newRouteName.trim()) {
        const created = await createRoute({ name: newRouteName.trim() });
        finalRouteId = created.id;
        finalRouteName = created.name;
      } else if (finalRouteId) {
        const rObj = routes.find((r) => r.id === finalRouteId);
        finalRouteName = rObj?.name || '';
      }

      await onSave({
        shopName: shopName.trim(),
        name: ownerName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        routeId: finalRouteId || undefined,
        routeName: finalRouteName || undefined,
        area: finalRouteName || undefined,
        locationUrl: locationUrl.trim() || undefined,
        latitude,
        longitude,
        username: username.trim().toLowerCase().replace(/\s+/g, '_'),
        password: password,
        openingBalance: 0,
        currentBalance: 0,
        currentOutstanding: 0,
        status: 'ACTIVE',
        active: true,
        payLaterEligible: true,
        preferredPaymentMode: 'CASH',
        passwordManagedByAdmin: true,
      });

      // Reset form
      setShopName('');
      setOwnerName('');
      setPhone('');
      setAddress('');
      setSelectedRouteId('');
      setIsCreatingNewRoute(false);
      setNewRouteName('');
      setLocationUrl('');
      setLatitude(undefined);
      setLongitude(undefined);
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setErrors({});
      onClose();
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to create vendor record.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
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
                    label="Address / Shop Location"
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. Shop #4, Market Complex"
                  />

                  {/* Route Selection */}
                  <View style={styles.inputGroup}>
                    <View style={styles.routeHeaderRow}>
                      <Text style={styles.fieldLabel}>Distribution Route</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsCreatingNewRoute(!isCreatingNewRoute);
                          if (!isCreatingNewRoute) setSelectedRouteId('');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.toggleNewRouteText}>
                          {isCreatingNewRoute ? '← Choose Existing' : '+ New Route'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {isCreatingNewRoute ? (
                      <View style={styles.newRouteInputWrap}>
                        <Input
                          placeholder="Enter new route name (e.g. North Hub)"
                          value={newRouteName}
                          onChangeText={setNewRouteName}
                          style={styles.newRouteInput}
                        />
                      </View>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipRow}
                      >
                        <TouchableOpacity
                          style={[
                            styles.chip,
                            !selectedRouteId ? styles.chipActive : null,
                          ]}
                          onPress={() => setSelectedRouteId('')}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              !selectedRouteId ? styles.chipTextActive : null,
                            ]}
                          >
                            No Route
                          </Text>
                        </TouchableOpacity>
                        {routes.map((r) => {
                          const isSelected = selectedRouteId === r.id;
                          return (
                            <TouchableOpacity
                              key={r.id}
                              style={[
                                styles.chip,
                                isSelected ? styles.chipActive : null,
                              ]}
                              onPress={() => setSelectedRouteId(r.id)}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="navigate-outline"
                                size={12}
                                color={isSelected ? colors.textInverse : colors.primary}
                                style={{ marginRight: 4 }}
                              />
                              <Text
                                style={[
                                  styles.chipText,
                                  isSelected ? styles.chipTextActive : null,
                                ]}
                              >
                                {r.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>

                  <GoogleMapsLocationPicker
                    locationUrl={locationUrl}
                    latitude={latitude}
                    longitude={longitude}
                    address={address}
                    shopName={shopName}
                    editable={true}
                    onChangeLocation={(locData) => {
                      setLocationUrl(locData.locationUrl);
                      setLatitude(locData.latitude);
                      setLongitude(locData.longitude);
                    }}
                  />

                  {/* Section 2: Login Credentials */}
                  <View style={[styles.sectionHeading, { marginTop: spacing.md }]}>
                    <Text style={styles.sectionTitle}>2. Vendor Login Credentials (Admin Set)</Text>
                  </View>

                  <Input
                    label="Username *"
                    value={username}
                    placeholder="e.g. kirana_store or rajesh99"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(v) => {
                      setUsername(v);
                      if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
                    }}
                    error={errors.username}
                  />

                  <Input
                    label="Password *"
                    value={password}
                    placeholder="Min 6 characters"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    error={errors.password}
                    rightIcon={
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    }
                  />
                  <Text style={styles.credentialHint}>
                    Note: The vendor will sign in using this Username and Password. Only Admins will be able to change or reset their password.
                  </Text>
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
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  toggleNewRouteText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  newRouteInputWrap: {
    marginTop: 4,
  },
  newRouteInput: {
    marginBottom: 0,
  },
  fieldLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
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
  credentialHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
});
