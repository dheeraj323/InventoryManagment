import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './Input';
import {
  fetchCurrentGPSLocation,
  parseCoordinatesFromInput,
  openGoogleMapsNavigation,
  openGoogleMapsView,
  openGoogleMapsSearch,
  isValidLatLng,
} from '../../utils/locationUtils';
import { colors, typography, spacing } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

export interface LocationData {
  address?: string;
  locationUrl?: string;
  latitude?: number;
  longitude?: number;
}

interface GoogleMapsLocationPickerProps {
  locationUrl: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  shopName?: string;
  editable?: boolean;
  onChangeLocation?: (data: { locationUrl: string; latitude?: number; longitude?: number }) => void;
  title?: string;
  subtitle?: string;
}

export const GoogleMapsLocationPicker: React.FC<GoogleMapsLocationPickerProps> = ({
  locationUrl,
  latitude,
  longitude,
  address,
  shopName,
  editable = true,
  onChangeLocation,
  title = 'Google Maps Delivery Location',
  subtitle = 'Delivery partners will navigate directly to this pin on Google Maps',
}) => {
  const [fetchingGPS, setFetchingGPS] = useState(false);
  const [showCoordsInput, setShowCoordsInput] = useState(Boolean(latitude && longitude));
  const [manualLat, setManualLat] = useState(latitude !== undefined ? String(latitude) : '');
  const [manualLng, setManualLng] = useState(longitude !== undefined ? String(longitude) : '');

  const hasPin = Boolean(
    (latitude !== undefined && longitude !== undefined && isValidLatLng(latitude, longitude)) ||
    (locationUrl && locationUrl.trim().length > 0)
  );

  const handleFetchGPS = async () => {
    setFetchingGPS(true);
    try {
      const coords = await fetchCurrentGPSLocation();
      const generatedUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
      setManualLat(String(coords.latitude));
      setManualLng(String(coords.longitude));

      if (onChangeLocation) {
        onChangeLocation({
          locationUrl: generatedUrl,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      }

      Alert.alert(
        'GPS Location Captured!',
        `Location set to: ${coords.latitude}, ${coords.longitude}${
          coords.accuracy ? ` (accuracy: ±${coords.accuracy}m)` : ''
        }`
      );
    } catch (err: any) {
      console.error('GPS fetch error:', err);
      Alert.alert(
        'GPS Location Error',
        getFriendlyErrorMessage(err, 'Could not fetch device location. You can paste a Google Maps link or enter coordinates manually.')
      );
    } finally {
      setFetchingGPS(false);
    }
  };

  const handleUrlChange = (text: string) => {
    const trimmed = text.trim();
    const parsed = parseCoordinatesFromInput(trimmed);

    if (parsed) {
      setManualLat(String(parsed.latitude));
      setManualLng(String(parsed.longitude));
      if (onChangeLocation) {
        onChangeLocation({
          locationUrl: trimmed,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        });
      }
    } else {
      if (onChangeLocation) {
        onChangeLocation({
          locationUrl: text,
          latitude,
          longitude,
        });
      }
    }
  };

  const handleApplyManualCoords = (latStr: string, lngStr: string) => {
    const latNum = parseFloat(latStr);
    const lngNum = parseFloat(lngStr);

    if (!isNaN(latNum) && !isNaN(lngNum) && isValidLatLng(latNum, lngNum)) {
      const genUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;
      if (onChangeLocation) {
        onChangeLocation({
          locationUrl: genUrl,
          latitude: latNum,
          longitude: lngNum,
        });
      }
    }
  };

  const handleOpenSearch = () => {
    const query = [shopName, address].filter(Boolean).join(' ');
    openGoogleMapsSearch(query);
  };

  const handleTestPin = () => {
    openGoogleMapsView({
      latitude,
      longitude,
      locationUrl,
      address,
      shopName,
    });
  };

  const handleTestNavigation = () => {
    openGoogleMapsNavigation({
      latitude,
      longitude,
      locationUrl,
      address,
      shopName,
    });
  };

  const handleClearLocation = () => {
    setManualLat('');
    setManualLng('');
    if (onChangeLocation) {
      onChangeLocation({
        locationUrl: '',
        latitude: undefined,
        longitude: undefined,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <View style={styles.iconTitleRow}>
            <View style={[styles.badgeIcon, hasPin ? styles.badgeIconActive : styles.badgeIconInactive]}>
              <Ionicons
                name="location"
                size={16}
                color={hasPin ? colors.brandGreen : colors.accent}
              />
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={[styles.statusPill, hasPin ? styles.statusPillActive : styles.statusPillInactive]}>
          <Ionicons
            name={hasPin ? 'checkmark-circle' : 'alert-circle-outline'}
            size={12}
            color={hasPin ? colors.brandGreen : colors.textMuted}
          />
          <Text style={[styles.statusPillText, hasPin ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
            {hasPin ? 'Pin Set' : 'No Pin'}
          </Text>
        </View>
      </View>

      {/* Pin Status & Preview Card */}
      {hasPin ? (
        <View style={styles.previewBox}>
          <View style={styles.previewInfo}>
            <Ionicons name="map" size={18} color={colors.primary} style={{ marginTop: 2 }} />
            <View style={styles.previewTextCol}>
              <Text style={styles.previewTitle}>
                {latitude !== undefined && longitude !== undefined
                  ? `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : 'Google Maps Link Attached'}
              </Text>
              <Text style={styles.previewSub} numberOfLines={1}>
                {locationUrl || `maps.google.com/?q=${latitude},${longitude}`}
              </Text>
            </View>
          </View>

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={handleTestPin}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={14} color={colors.primary} />
              <Text style={styles.previewBtnText}>View Pin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.previewBtn, styles.navPreviewBtn]}
              onPress={handleTestNavigation}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
              <Text style={styles.navPreviewBtnText}>Test Route</Text>
            </TouchableOpacity>

            {editable && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearLocation}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}

      {editable && (
        <View style={styles.actionsSection}>
          {/* Quick Action Buttons Row */}
          <View style={styles.buttonRow}>
            {/* GPS Fetch Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.gpsBtn]}
              onPress={handleFetchGPS}
              disabled={fetchingGPS}
              activeOpacity={0.8}
            >
              {fetchingGPS ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="locate-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.gpsBtnText}>
                {fetchingGPS ? 'Locating...' : 'Use Current GPS'}
              </Text>
            </TouchableOpacity>

            {/* Open Google Maps App / Search */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.searchBtn]}
              onPress={handleOpenSearch}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={16} color={colors.primary} />
              <Text style={styles.searchBtnText}>Find on Maps</Text>
            </TouchableOpacity>
          </View>

          {/* Google Maps Link / Share URL Input */}
          <View style={styles.inputWrapper}>
            <Input
              label="Google Maps Link or Pin URL"
              placeholder="Paste Google Maps link (e.g., https://maps.app.goo.gl/...)"
              value={locationUrl}
              onChangeText={handleUrlChange}
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Ionicons name="link-outline" size={18} color={colors.textMuted} />}
              helperText="Tip: In Google Maps, tap Share > Copy link and paste here, or use Current GPS."
            />
          </View>

          {/* Manual Lat/Long Toggle */}
          <TouchableOpacity
            style={styles.toggleCoordsRow}
            onPress={() => setShowCoordsInput(!showCoordsInput)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showCoordsInput ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.toggleCoordsText}>
              {showCoordsInput ? 'Hide manual GPS coordinates' : 'Enter GPS coordinates manually (Latitude / Longitude)'}
            </Text>
          </TouchableOpacity>

          {showCoordsInput && (
            <View style={styles.coordsRow}>
              <View style={styles.coordCol}>
                <Input
                  label="Latitude"
                  placeholder="e.g. 19.076090"
                  value={manualLat}
                  keyboardType="numeric"
                  onChangeText={(val) => {
                    setManualLat(val);
                    handleApplyManualCoords(val, manualLng);
                  }}
                />
              </View>
              <View style={styles.coordCol}>
                <Input
                  label="Longitude"
                  placeholder="e.g. 72.877426"
                  keyboardType="numeric"
                  value={manualLng}
                  onChangeText={(val) => {
                    setManualLng(val);
                    handleApplyManualCoords(manualLat, val);
                  }}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconActive: {
    backgroundColor: '#ECFDF5',
  },
  badgeIconInactive: {
    backgroundColor: colors.accentLight,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillActive: {
    backgroundColor: '#DEF7EC',
  },
  statusPillInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusPillText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  statusPillTextActive: {
    color: colors.brandGreen,
  },
  statusPillTextInactive: {
    color: colors.textMuted,
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: spacing.xs,
  },
  previewTextCol: {
    flex: 1,
  },
  previewTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  previewSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  previewBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  navPreviewBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  navPreviewBtnText: {
    ...typography.captionBold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  clearBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    marginLeft: 'auto',
  },
  actionsSection: {
    marginTop: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
  },
  gpsBtn: {
    backgroundColor: colors.brandGreen,
  },
  gpsBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  searchBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  searchBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
  },
  inputWrapper: {
    marginBottom: spacing.xs,
  },
  toggleCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  toggleCoordsText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  coordCol: {
    flex: 1,
  },
});
