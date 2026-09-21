import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useVendorStore } from '../../store/useVendorStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { colors, typography, spacing } from '../../theme';

export const ProfileScreen: React.FC = () => {
  const { currentUser, activeVendorId, logout } = useAuthStore();
  const { getVendorById } = useVendorStore();

  const effectiveVendorId = activeVendorId || currentUser?.vendorId || '';
  const vendor = getVendorById(effectiveVendorId) || {
    id: effectiveVendorId,
    name: currentUser?.name || 'Account User',
    shopName: currentUser?.businessName || currentUser?.name || 'Store',
    phone: currentUser?.phone || 'Not provided',
    address: currentUser?.address || 'Not provided',
    area: currentUser?.area || 'General',
    currentBalance: 0,
    payLaterEligible: false,
    preferredPaymentMode: 'CASH' as const,
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Shop & Account Profile" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{vendor.name.charAt(0)}</Text>
            </View>
            <View style={styles.nameCol}>
              <Text style={styles.vendorName}>{vendor.shopName}</Text>
              <Text style={styles.ownerName}>Proprietor: {vendor.name}</Text>
              <Text style={styles.roleBadgeText}>ROLE: {currentUser?.role || 'VENDOR'}</Text>
            </View>
          </View>
        </Card>

        {/* Business Info */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>SHOP DETAILS</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={colors.accent} />
            <Text style={styles.infoText}>{vendor.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colors.accent} />
            <Text style={styles.infoText}>{vendor.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="map-outline" size={16} color={colors.accent} />
            <Text style={styles.infoText}>Assigned Market Area: {vendor.area}</Text>
          </View>
        </Card>

        {/* Payment & Khata Terms */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>PAYMENT & KHATA TERMS</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Pay Later / Khata Option</Text>
            <Text
              style={[
                styles.statVal,
                { color: colors.success },
              ]}
            >
              {vendor.payLaterEligible ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Default Payment Mode</Text>
            <Text style={styles.statVal}>{vendor.preferredPaymentMode}</Text>
          </View>
        </Card>

        {/* Logout Button */}
        <Button
          title="LOGOUT FROM APP"
          onPress={logout}
          variant="danger"
          size="md"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.screenPadding,
  },
  card: {
    marginBottom: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h2,
    color: colors.textInverse,
  },
  nameCol: {
    marginLeft: spacing.md,
    flex: 1,
  },
  vendorName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  ownerName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleBadgeText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.accent,
    marginTop: 4,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  roleBtn: {
    marginBottom: spacing.xs,
  },
  logoutBtn: {
    marginTop: spacing.sm,
  },
});
