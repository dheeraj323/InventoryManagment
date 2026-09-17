import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { colors, typography, spacing } from '../../theme';

export const SupplierScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { suppliers } = useInventoryStore();

  const totalPayables = suppliers.reduce((sum, s) => sum + s.balancePayable, 0);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Suppliers & Payables"
        subtitle={`${suppliers.length} Active Distributors`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <FlatList
        data={suppliers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Card style={styles.headerCard} outlined elevation="md">
            <Text style={styles.headerLabel}>TOTAL SUPPLIER PAYABLES</Text>
            <Text style={styles.headerVal}>${totalPayables.toFixed(2)}</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} outlined elevation="sm">
            <View style={styles.row}>
              <View style={styles.infoCol}>
                <Text style={styles.supplierName}>{item.name}</Text>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.contact}>Contact: {item.contactPerson} ({item.phone})</Text>
              </View>

              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Payable Balance</Text>
                <Text style={styles.balanceVal}>${item.balancePayable.toFixed(2)}</Text>
              </View>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.screenPadding,
  },
  headerCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  headerLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  headerVal: {
    ...typography.currencyLarge,
    color: '#F87171', // Bright Red for Dark Card
    marginTop: 2,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  supplierName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  category: {
    ...typography.captionBold,
    color: colors.accent,
    marginTop: 2,
  },
  contact: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
  },
  balanceVal: {
    ...typography.currency,
    color: colors.debit,
  },
});
