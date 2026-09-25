import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import {
  openGoogleMapsNavigation,
  openGoogleMapsView,
  isValidLatLng,
} from '../../utils/locationUtils';
import { colors, typography, spacing } from '../../theme';

interface DeliveryAddressCardProps {
  shopName: string;
  address: string;
  phone: string;
  locationUrl?: string;
  latitude?: number;
  longitude?: number;
}

export const DeliveryAddressCard: React.FC<DeliveryAddressCardProps> = ({
  shopName,
  address,
  phone,
  locationUrl,
  latitude,
  longitude,
}) => {
  const hasExactCoords = Boolean(
    latitude !== undefined &&
    longitude !== undefined &&
    isValidLatLng(latitude, longitude)
  );
  const hasLocationUrl = Boolean(locationUrl && locationUrl.trim().length > 0);
  const hasMapPin = hasExactCoords || hasLocationUrl;

  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch((err) =>
        console.error('Error opening dialer:', err)
      );
    }
  };

  const handleNavigateGoogleMaps = () => {
    openGoogleMapsNavigation({
      latitude,
      longitude,
      locationUrl,
      address,
      shopName,
    });
  };

  const handleViewPin = () => {
    openGoogleMapsView({
      latitude,
      longitude,
      locationUrl,
      address,
      shopName,
    });
  };

  return (
    <Card variant="flat" style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeaderTitle}>DELIVERY LOCATION</Text>
        {hasMapPin ? (
          <View style={styles.mapBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.brandGreen} />
            <Text style={styles.mapBadgeText}>
              {hasExactCoords ? 'GPS Pin Linked' : 'Google Maps Linked'}
            </Text>
          </View>
        ) : (
          <View style={styles.mapBadgeNeutral}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={styles.mapBadgeNeutralText}>Street Address</Text>
          </View>
        )}
      </View>

      <View style={styles.contentRow}>
        <View style={[styles.iconCircle, hasMapPin && styles.iconCircleActive]}>
          <Ionicons
            name="location"
            size={20}
            color={hasMapPin ? colors.brandGreen : colors.accent}
          />
        </View>
        <View style={styles.addressCol}>
          <Text style={styles.shopName}>{shopName}</Text>
          <Text style={styles.addressText}>{address || 'No street address provided'}</Text>
          {phone ? <Text style={styles.phoneText}>Phone: {phone}</Text> : null}
          {hasExactCoords && (
            <Text style={styles.coordsText}>
              GPS: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
            </Text>
          )}
        </View>

        {phone ? (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={handleCall}
            activeOpacity={0.8}
            accessibilityLabel={`Call ${shopName}`}
          >
            <Ionicons name="call" size={18} color={colors.accent} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Prominent Google Maps Action Buttons for Delivery Executive */}
      <View style={styles.actionButtonRow}>
        <TouchableOpacity
          style={styles.navigateBtn}
          onPress={handleNavigateGoogleMaps}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={17} color="#FFFFFF" />
          <Text style={styles.navigateBtnText}>Navigate on Google Maps</Text>
        </TouchableOpacity>

        {hasMapPin && (
          <TouchableOpacity
            style={styles.viewPinBtn}
            onPress={handleViewPin}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionHeaderTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  mapBadgeText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 11,
  },
  mapBadgeNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  mapBadgeNeutralText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  iconCircleActive: {
    backgroundColor: '#ECFDF5',
  },
  addressCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  shopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
    fontSize: 12,
  },
  phoneText: {
    ...typography.captionBold,
    color: colors.accent,
    marginTop: 4,
    fontSize: 12,
  },
  coordsText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 11,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  navigateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
  },
  navigateBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  viewPinBtn: {
    width: 40,
    height: 40,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
