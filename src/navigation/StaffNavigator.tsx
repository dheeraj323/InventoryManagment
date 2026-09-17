import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StaffDashboardScreen } from '../screens/staff/StaffDashboardScreen';
import { TodayDeliveriesScreen } from '../screens/staff/TodayDeliveriesScreen';
import { DeliveryDetailScreen } from '../screens/staff/DeliveryDetailScreen';
import { ActualPaymentScreen } from '../screens/staff/ActualPaymentScreen';
import { CashSettlementScreen } from '../screens/staff/CashSettlementScreen';
import { ProfileScreen } from '../screens/vendor/ProfileScreen';
import { colors, typography } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const StaffHomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="StaffDashboard" component={StaffDashboardScreen} />
    <Stack.Screen name="TodayDeliveries" component={TodayDeliveriesScreen} />
    <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} />
    <Stack.Screen name="ActualPayment" component={ActualPaymentScreen} />
    <Stack.Screen name="CashSettlement" component={CashSettlementScreen} />
  </Stack.Navigator>
);

export const StaffNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...typography.captionBold,
          fontSize: 10,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'StaffDashboardTab') iconName = 'bicycle-outline';
          else if (route.name === 'TodayDeliveriesTab') iconName = 'map-outline';
          else if (route.name === 'CashSettlementTab') iconName = 'cash-outline';
          else if (route.name === 'StaffProfileTab') iconName = 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="StaffDashboardTab"
        component={StaffHomeStack}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="TodayDeliveriesTab"
        component={TodayDeliveriesScreen}
        options={{ title: 'Deliveries' }}
      />
      <Tab.Screen
        name="CashSettlementTab"
        component={CashSettlementScreen}
        options={{ title: 'Cash Settlement' }}
      />
      <Tab.Screen
        name="StaffProfileTab"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};
