import { Linking, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationDestination {
  latitude?: number;
  longitude?: number;
  locationUrl?: string;
  address?: string;
  shopName?: string;
}

/**
 * Parses coordinates from Google Maps URLs or direct coordinate strings
 */
export function parseCoordinatesFromInput(input: string): { latitude: number; longitude: number } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Check direct lat, lng format e.g. "19.0760, 72.8777" or "19.0760,72.8777"
  const directMatch = trimmed.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // Check Google Maps URL format with @lat,lng e.g. https://www.google.com/maps/@19.0760,72.8777,15z
  const atMatch = trimmed.match(/@([-+]?\d{1,2}(?:\.\d+)?),([-+]?\d{1,3}(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // Check ?q=lat,lng or &q=lat,lng or query=lat,lng or destination=lat,lng or ll=lat,lng
  const paramMatch = trimmed.match(/[?&](?:q|query|destination|ll)=([-+]?\d{1,2}(?:\.\d+)?)[,%20]+([-+]?\d{1,3}(?:\.\d+)?)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

export function isValidLatLng(lat?: number, lng?: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

/**
 * Builds turn-by-turn navigation URL for Google Maps
 */
export function buildGoogleMapsNavUrl(dest: LocationDestination): string {
  // 1. If vendor entered an explicit Google Maps URL (e.g. shared link, pin, app link), open that exact link!
  if (dest.locationUrl && dest.locationUrl.trim()) {
    const trimmed = dest.locationUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // 2. If valid GPS coordinates are available, generate exact coordinate navigation route
  if (dest.latitude !== undefined && dest.longitude !== undefined && isValidLatLng(dest.latitude, dest.longitude)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`;
  }

  // 3. Fallback to Shop Name + Address query navigation
  const queryParts = [dest.shopName, dest.address].filter(Boolean).join(', ');
  if (queryParts) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(queryParts)}`;
  }

  return 'https://www.google.com/maps';
}

/**
 * Builds pin preview/search URL for Google Maps
 */
export function buildGoogleMapsViewUrl(dest: LocationDestination): string {
  // 1. If vendor entered an explicit Google Maps URL, open that exact link!
  if (dest.locationUrl && dest.locationUrl.trim()) {
    const trimmed = dest.locationUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // 2. If valid GPS coordinates are available, search exact coordinates
  if (dest.latitude !== undefined && dest.longitude !== undefined && isValidLatLng(dest.latitude, dest.longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${dest.latitude},${dest.longitude}`;
  }

  // 3. Fallback to Shop Name + Address query search
  const queryParts = [dest.shopName, dest.address].filter(Boolean).join(', ');
  if (queryParts) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts)}`;
  }

  return 'https://www.google.com/maps';
}

/**
 * Opens Google Maps in navigation mode
 */
export async function openGoogleMapsNavigation(dest: LocationDestination): Promise<void> {
  const url = buildGoogleMapsNavUrl(dest);
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported || Platform.OS === 'web') {
      await Linking.openURL(url);
    } else {
      // Fallback
      await Linking.openURL(url);
    }
  } catch (error) {
    console.error('Error opening Google Maps navigation:', error);
    Alert.alert('Map Navigation', 'Could not open Google Maps. Please ensure Google Maps or a browser is installed.');
  }
}

/**
 * Opens Google Maps to view / preview a pin
 */
export async function openGoogleMapsView(dest: LocationDestination): Promise<void> {
  const url = buildGoogleMapsViewUrl(dest);
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.error('Error opening Google Maps preview:', error);
    Alert.alert('Google Maps', 'Could not open Google Maps preview.');
  }
}

/**
 * Opens Google Maps search with shop / query to help vendor find & copy pin
 */
export async function openGoogleMapsSearch(query: string): Promise<void> {
  const searchUrl = query.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`
    : 'https://www.google.com/maps';
  try {
    await Linking.openURL(searchUrl);
  } catch (error) {
    console.error('Error opening Google Maps search:', error);
    Alert.alert('Google Maps', 'Could not open Google Maps.');
  }
}

/**
 * Requests device GPS location with accuracy
 */
export async function fetchCurrentGPSLocation(): Promise<GPSCoordinates> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied. Please grant location access in device settings.');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    return {
      latitude: Number(location.coords.latitude.toFixed(6)),
      longitude: Number(location.coords.longitude.toFixed(6)),
      accuracy: location.coords.accuracy ? Math.round(location.coords.accuracy) : undefined,
    };
  } catch (error: any) {
    // If expo-location fails (e.g. on web or simulator), fallback to navigator.geolocation if available
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
            });
          },
          (err) => {
            reject(new Error(err.message || 'Could not fetch current GPS location.'));
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      });
    }

    throw new Error(error.message || 'Could not fetch device location.');
  }
}
