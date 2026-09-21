import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { useOrderStore } from '../store/useOrderStore';
import { useLedgerStore } from '../store/useLedgerStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useCashStore } from '../store/useCashStore';
import { useVendorStore } from '../store/useVendorStore';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { AdminNavigator } from './AdminNavigator';
import { StaffNavigator } from './StaffNavigator';
import { VendorNavigator } from './VendorNavigator';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export const RootNavigator: React.FC = () => {
  const { currentUser, activeRole, activeVendorId, activeStaffId, isLoading, initAuth } =
    useAuthStore();
  const { subscribeToOrders } = useOrderStore();
  const { subscribeLedger } = useLedgerStore();
  const { subscribeInventory } = useInventoryStore();
  const { subscribeSettlements } = useCashStore();
  const { subscribeVendors } = useVendorStore();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.status === 'PENDING_VERIFICATION') return;

    // Scope subscriptions: Vendors only receive their own data; Staff only receive assigned data
    const vendorFilter =
      activeRole === 'VENDOR' ? activeVendorId || currentUser.vendorId : undefined;
    const staffFilter =
      activeRole === 'STAFF' ? activeStaffId || currentUser.staffId : undefined;

    const unsubOrders = subscribeToOrders(vendorFilter, staffFilter);
    const unsubLedger = subscribeLedger(vendorFilter);
    const unsubInventory = subscribeInventory();
    const unsubSettlements = activeRole === 'VENDOR' ? () => {} : subscribeSettlements(activeRole === 'STAFF' ? staffFilter : undefined);
    const unsubVendors = subscribeVendors(vendorFilter);

    return () => {
      unsubOrders();
      unsubLedger();
      unsubInventory();
      unsubSettlements();
      unsubVendors();
    };
  }, [currentUser, activeRole, activeVendorId, activeStaffId]);

  if (isLoading && !currentUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!currentUser ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : currentUser.status === 'PENDING_VERIFICATION' || currentUser.status === 'REJECTED' ? (
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        ) : activeRole === 'ADMIN' ? (
          <Stack.Screen name="AdminRoot" component={AdminNavigator} />
        ) : activeRole === 'STAFF' ? (
          <Stack.Screen name="StaffRoot" component={StaffNavigator} />
        ) : (
          <Stack.Screen name="VendorRoot" component={VendorNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
