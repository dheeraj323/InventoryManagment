import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { VendorDashboardScreen } from '../screens/vendor/VendorDashboardScreen';
import { ProductCatalogScreen } from '../screens/vendor/ProductCatalogScreen';
import { CartScreen } from '../screens/vendor/CartScreen';
import { CheckoutScreen } from '../screens/vendor/CheckoutScreen';
import { VendorOrdersScreen } from '../screens/vendor/VendorOrdersScreen';
import { VendorOrderDetailScreen } from '../screens/vendor/VendorOrderDetailScreen';
import { VendorLedgerScreen } from '../screens/vendor/VendorLedgerScreen';
import { ProfileScreen } from '../screens/vendor/ProfileScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 1. Vendor Home Stack
const VendorHomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VendorDashboard" component={VendorDashboardScreen} />
    <Stack.Screen name="ProductCatalog" component={ProductCatalogScreen} />
    <Stack.Screen name="Cart" component={CartScreen} />
    <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} />
    <Stack.Screen name="VendorOrderDetail" component={VendorOrderDetailScreen} />
    <Stack.Screen name="VendorLedger" component={VendorLedgerScreen} />
    <Stack.Screen name="VendorOrders" component={VendorOrdersScreen} />
  </Stack.Navigator>
);

// 2. Vendor Catalog Stack
const VendorCatalogStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProductCatalog" component={ProductCatalogScreen} />
    <Stack.Screen name="Cart" component={CartScreen} />
    <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} />
    <Stack.Screen name="VendorOrderDetail" component={VendorOrderDetailScreen} />
  </Stack.Navigator>
);

// 3. Vendor Orders Stack
const VendorOrdersStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VendorOrdersMain" component={VendorOrdersScreen} />
    <Stack.Screen name="VendorOrderDetail" component={VendorOrderDetailScreen} />
  </Stack.Navigator>
);

// 4. Vendor Ledger Stack
const VendorLedgerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VendorLedger" component={VendorLedgerScreen} />
  </Stack.Navigator>
);

// 5. Vendor Profile Stack
const VendorProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VendorProfile" component={ProfileScreen} />
  </Stack.Navigator>
);

export const VendorNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + Math.max(insets.bottom, 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...typography.captionBold,
          fontSize: 10,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'VendorDashboardTab') iconName = 'home-outline';
          else if (route.name === 'ProductCatalogTab') iconName = 'storefront-outline';
          else if (route.name === 'VendorOrdersTab') iconName = 'receipt-outline';
          else if (route.name === 'VendorLedgerTab') iconName = 'book-outline';
          else if (route.name === 'VendorProfileTab') iconName = 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="VendorDashboardTab"
        component={VendorHomeStack}
        options={{ title: 'Home', unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('VendorDashboardTab', { screen: 'VendorDashboard' });
          },
        })}
      />
      <Tab.Screen
        name="ProductCatalogTab"
        component={VendorCatalogStack}
        options={{ title: 'Catalog', unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('ProductCatalogTab', { screen: 'ProductCatalog' });
          },
        })}
      />
      <Tab.Screen
        name="VendorOrdersTab"
        component={VendorOrdersStack}
        options={{ title: 'Orders', unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('VendorOrdersTab', { screen: 'VendorOrdersMain' });
          },
        })}
      />
      <Tab.Screen
        name="VendorLedgerTab"
        component={VendorLedgerStack}
        options={{ title: 'Ledger', unmountOnBlur: true }}
      />
      <Tab.Screen
        name="VendorProfileTab"
        component={VendorProfileStack}
        options={{ title: 'Profile', unmountOnBlur: true }}
      />
    </Tab.Navigator>
  );
};
