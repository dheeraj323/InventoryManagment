import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { useOrderStore } from '../store/useOrderStore';
import { useLedgerStore } from '../store/useLedgerStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useCashStore } from '../store/useCashStore';
import { useVendorStore } from '../store/useVendorStore';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { AdminNavigator } from './AdminNavigator';
import { StaffNavigator } from './StaffNavigator';
import { VendorNavigator } from './VendorNavigator';

const Stack = createNativeStackNavigator();

export const RootNavigator: React.FC = () => {
  const { currentUser, activeRole, activeVendorId, activeStaffId, initAuth } = useAuthStore();
  const { subscribeToOrders } = useOrderStore();
  const { subscribeLedger } = useLedgerStore();
  const { subscribeInventory } = useInventoryStore();
  const { subscribeSettlements } = useCashStore();
  const { subscribeVendors } = useVendorStore();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Scope subscriptions: Vendors only receive their own orders & ledger entries
    const vendorFilter = activeRole === 'VENDOR' ? (activeVendorId || currentUser.vendorId) : undefined;
    const staffFilter = activeRole === 'STAFF' ? (activeStaffId || currentUser.staffId) : undefined;

    const unsubOrders = subscribeToOrders(vendorFilter, staffFilter);
    const unsubLedger = subscribeLedger(vendorFilter);
    const unsubInventory = subscribeInventory();
    const unsubSettlements = subscribeSettlements();
    const unsubVendors = subscribeVendors();

    return () => {
      unsubOrders();
      unsubLedger();
      unsubInventory();
      unsubSettlements();
      unsubVendors();
    };
  }, [currentUser, activeRole, activeVendorId, activeStaffId]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!currentUser ? (
          <Stack.Screen name="Login" component={LoginScreen} />
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
