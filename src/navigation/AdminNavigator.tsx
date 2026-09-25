import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { VendorListScreen } from '../screens/admin/VendorListScreen';
import { VendorDetailScreen } from '../screens/admin/VendorDetailScreen';
import { AdminOrdersScreen } from '../screens/admin/AdminOrdersScreen';
import { AdminOrderDetailScreen } from '../screens/admin/AdminOrderDetailScreen';
import { InventoryScreen } from '../screens/admin/InventoryScreen';
import { SupplierScreen } from '../screens/admin/SupplierScreen';
import { SupplierDetailScreen } from '../screens/admin/SupplierDetailScreen';
import { AddSupplierBillScreen } from '../screens/admin/AddSupplierBillScreen';
import { SupplierBillDetailScreen } from '../screens/admin/SupplierBillDetailScreen';
import { AdminFinanceScreen } from '../screens/admin/AdminFinanceScreen';
import { StaffSettlementsScreen } from '../screens/admin/StaffSettlementsScreen';
import { AuditHistoryScreen } from '../screens/admin/AuditHistoryScreen';
import { StaffApprovalScreen } from '../screens/admin/StaffApprovalScreen';
import { StaffManagementScreen } from '../screens/admin/StaffManagementScreen';
import { RouteManagementScreen } from '../screens/admin/RouteManagementScreen';
import { AdminProfileScreen } from '../screens/admin/AdminProfileScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 1. Overview Stack (Dashboard hub with deep links)
const AdminHomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    <Stack.Screen name="VendorList" component={VendorListScreen} />
    <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
    <Stack.Screen name="RouteManagement" component={RouteManagementScreen} />
    <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
    <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} />
    <Stack.Screen name="Inventory" component={InventoryScreen} />
    <Stack.Screen name="Supplier" component={SupplierScreen} />
    <Stack.Screen name="SupplierDetail" component={SupplierDetailScreen} />
    <Stack.Screen name="AddSupplierBill" component={AddSupplierBillScreen} />
    <Stack.Screen name="SupplierBillDetail" component={SupplierBillDetailScreen} />
    <Stack.Screen name="AdminFinance" component={AdminFinanceScreen} />
    <Stack.Screen name="StaffSettlements" component={StaffSettlementsScreen} />
    <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
    <Stack.Screen name="StaffApproval" component={StaffApprovalScreen} />
    <Stack.Screen name="AuditHistory" component={AuditHistoryScreen} />
  </Stack.Navigator>
);

// 2. Orders Stack (Orders list -> Order detail)
const AdminOrdersStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
    <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} />
  </Stack.Navigator>
);

// 3. Vendors Stack (Vendors list -> Vendor 360 cockpit -> Order detail)
const AdminVendorsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VendorList" component={VendorListScreen} />
    <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
    <Stack.Screen name="RouteManagement" component={RouteManagementScreen} />
    <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} />
  </Stack.Navigator>
);

// 5. Finance Stack (Finance summary -> Settlements, Audit, Supplier, Vendor Detail)
const AdminFinanceStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminFinance" component={AdminFinanceScreen} />
    <Stack.Screen name="StaffSettlements" component={StaffSettlementsScreen} />
    <Stack.Screen name="AuditHistory" component={AuditHistoryScreen} />
    <Stack.Screen name="Supplier" component={SupplierScreen} />
    <Stack.Screen name="SupplierDetail" component={SupplierDetailScreen} />
    <Stack.Screen name="AddSupplierBill" component={AddSupplierBillScreen} />
    <Stack.Screen name="SupplierBillDetail" component={SupplierBillDetailScreen} />
    <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
    <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} />
  </Stack.Navigator>
);

// 6. Admin Profile Stack
const AdminProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
    <Stack.Screen name="RouteManagement" component={RouteManagementScreen} />
    <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
    <Stack.Screen name="StaffApproval" component={StaffApprovalScreen} />
    <Stack.Screen name="AuditHistory" component={AuditHistoryScreen} />
  </Stack.Navigator>
);

export const AdminNavigator: React.FC = () => {
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
          let iconName: keyof typeof Ionicons.glyphMap = 'speedometer-outline';
          if (route.name === 'AdminDashboardTab') iconName = 'speedometer-outline';
          else if (route.name === 'AdminOrdersTab') iconName = 'receipt-outline';
          else if (route.name === 'VendorListTab') iconName = 'storefront-outline';
          else if (route.name === 'AdminFinanceTab') iconName = 'bar-chart-outline';
          else if (route.name === 'AdminProfileTab') iconName = 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="AdminDashboardTab"
        component={AdminHomeStack}
        options={{ title: 'Overview' }}
      />
      <Tab.Screen
        name="AdminOrdersTab"
        component={AdminOrdersStack}
        options={{ title: 'Orders' }}
      />
      <Tab.Screen
        name="VendorListTab"
        component={AdminVendorsStack}
        options={{ title: 'Vendors' }}
      />
      <Tab.Screen
        name="AdminFinanceTab"
        component={AdminFinanceStack}
        options={{ title: 'Finance' }}
      />
      <Tab.Screen
        name="AdminProfileTab"
        component={AdminProfileStack}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};
