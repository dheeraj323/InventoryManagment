import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorStore } from '../../store/useVendorStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { colors, typography, spacing } from '../../theme';

export const VendorListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { vendors } = useVendorStore();
  const { getPartyRunningBalance } = useLedgerStore();
  const [search, setSearch] = useState('');

  const filteredVendors = vendors.filter(
    (v) =>
      v.shopName.toLowerCase().includes(search.toLowerCase()) ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.area.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Vendor Directory"
        subtitle={`${vendors.length} Registered Retailers`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search by shop name, proprietor, or market area..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
        />
      </View>

      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const balance = getPartyRunningBalance(item.id);
          return (
            <Card
              style={styles.card}
              onPress={() =>
                navigation.navigate('VendorDetail', { vendorId: item.id })
              }
              outlined
              elevation="sm"
            >
              <View style={styles.cardRow}>
                <View style={styles.shopCol}>
                  <Text style={styles.shopName}>{item.shopName}</Text>
                  <Text style={styles.ownerName}>Prop: {item.name}</Text>
                  <Text style={styles.areaText}>Area: {item.area}</Text>
                </View>

                <View style={styles.balanceCol}>
                  <Text style={styles.balanceLabel}>Running Balance</Text>
                  <Text
                    style={[
                      styles.balanceVal,
                      balance > 0 ? styles.balanceDue : styles.balanceClear,
                    ]}
                  >
                    ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                  <View style={styles.creditPill}>
                    <Text style={styles.creditPillText}>
                      Limit: ₹{item.creditLimit.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBox: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listContent: {
    padding: spacing.screenPadding,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopCol: {
    flex: 1,
  },
  shopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  ownerName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  areaText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  balanceCol: {
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  balanceLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
  },
  balanceVal: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  balanceDue: {
    color: colors.debit,
  },
  balanceClear: {
    color: colors.credit,
  },
  creditPill: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  creditPillText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
