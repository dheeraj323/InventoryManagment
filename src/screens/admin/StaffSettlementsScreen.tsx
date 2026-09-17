import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useCashStore } from '../../store/useCashStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing } from '../../theme';

export const StaffSettlementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settlements, verifySettlement } = useCashStore();
  const { currentUser } = useAuthStore();

  const handleVerify = (id: string) => {
    verifySettlement(id, currentUser?.name || 'Admin Rajesh');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Staff Cash Settlements"
        subtitle={`${settlements.length} Handover Audit Logs`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <FlatList
        data={settlements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isPending = item.status === 'PENDING_VERIFICATION';

          return (
            <Card style={styles.card} outlined elevation="sm">
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.numText}>{item.settlementNumber}</Text>
                  <Text style={styles.staffText}>
                    Executive: {item.staffName} • {item.date}
                  </Text>
                </View>

                <StatusBadge
                  customLabel={isPending ? 'Pending Audit' : 'Verified'}
                  customBg={isPending ? colors.statusPendingBg : colors.statusDeliveredBg}
                  customColor={isPending ? colors.statusPendingText : colors.statusDeliveredText}
                  size="sm"
                />
              </View>

              <View style={styles.metricsBox}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Expected Cash</Text>
                  <Text style={styles.metricVal}>
                    ${item.totalCashCollected.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Actual Handed Over</Text>
                  <Text style={styles.metricVal}>
                    ${item.handedOverCash.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Variance</Text>
                  <Text
                    style={[
                      styles.metricVal,
                      item.variance === 0
                        ? { color: colors.success }
                        : { color: colors.danger },
                    ]}
                  >
                    ${item.variance.toFixed(2)}
                  </Text>
                </View>
              </View>

              {item.notes && (
                <Text style={styles.notesText}>Notes: {item.notes}</Text>
              )}

              {isPending && (
                <Button
                  title="VERIFY CASH & APPROVE SETTLEMENT"
                  onPress={() => handleVerify(item.id)}
                  size="sm"
                  style={styles.verifyBtn}
                />
              )}
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            iconName="cash-outline"
            title="No Settlements Found"
            description="No staff cash settlements have been submitted yet."
          />
        }
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
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  numText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  staffText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    marginVertical: spacing.xs,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
  },
  metricVal: {
    ...typography.bodyBold,
    marginTop: 2,
  },
  notesText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  verifyBtn: {
    marginTop: spacing.md,
  },
});
