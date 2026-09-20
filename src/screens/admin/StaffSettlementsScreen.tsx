import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCashStore } from '../../store/useCashStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SettlementDetailModal } from '../../components/cash';
import { CashSettlement } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const StaffSettlementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settlements, verifySettlement } = useCashStore();
  const { currentUser } = useAuthStore();
  const [selectedSettlement, setSelectedSettlement] = useState<CashSettlement | null>(null);

  const pendingCount = settlements.filter((s) => s.status === 'PENDING_VERIFICATION').length;

  const handleVerify = (id: string) => {
    verifySettlement(id, currentUser?.name || 'Admin Rajesh');
  };

  const sortedSettlements = [...settlements].sort((a, b) => {
    const timeA = a.createdAt
      ? new Date(a.createdAt).getTime()
      : a.id.startsWith('set-')
      ? parseInt(a.id.replace('set-', ''), 10) || 0
      : 0;
    const timeB = b.createdAt
      ? new Date(b.createdAt).getTime()
      : b.id.startsWith('set-')
      ? parseInt(b.id.replace('set-', ''), 10) || 0
      : 0;
    return timeB - timeA;
  });

  const renderHeader = () => (
    <View style={styles.summaryBar}>
      <View style={styles.summaryPill}>
        <Ionicons name="documents-outline" size={16} color={colors.primary} />
        <Text style={styles.summaryText}>{sortedSettlements.length} Total Handovers</Text>
      </View>
      {pendingCount > 0 ? (
        <View style={[styles.summaryPill, styles.pendingPill]}>
          <Ionicons name="time-outline" size={16} color="#D97706" />
          <Text style={[styles.summaryText, { color: '#D97706' }]}>
            {pendingCount} Pending Audit
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Staff Cash Settlements"
        subtitle="Audit & verify end-of-day cash handovers"
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      <FlatList
        data={sortedSettlements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => {
          const isPending = item.status === 'PENDING_VERIFICATION';
          const handedOver = item.handedOverCash || item.amountHandedOver || 0;
          const expected = item.totalCashCollected || item.amountCollected || 0;
          const variance = item.variance || item.difference || 0;
          const initial = item.staffName ? item.staffName.charAt(0).toUpperCase() : 'S';

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedSettlement(item)}
            >
              <Card variant="flat" style={styles.card}>
                <View style={styles.headerRow}>
                  <View style={styles.staffInfoGroup}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                    <View>
                      <Text style={styles.staffNameText}>{item.staffName}</Text>
                      <Text style={styles.metaText}>
                        {item.settlementNumber} • {item.date}
                      </Text>
                    </View>
                  </View>

                  <StatusBadge
                    customLabel={isPending ? 'Pending Audit' : 'Verified'}
                    customBg={isPending ? '#FEF3C7' : colors.brandGreenLight}
                    customColor={isPending ? '#D97706' : colors.brandGreen}
                    size="sm"
                  />
                </View>

                <View style={styles.metricsGrid}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>EXPECTED</Text>
                    <Text style={styles.metricVal}>
                      ₹{expected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>HANDED OVER</Text>
                    <Text style={styles.metricValBold}>
                      ₹{handedOver.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>VARIANCE</Text>
                    <Text
                      style={[
                        styles.metricValBold,
                        variance === 0
                          ? { color: colors.brandGreen }
                          : variance > 0
                          ? { color: '#D97706' }
                          : { color: colors.danger },
                      ]}
                    >
                      {variance === 0
                        ? '₹0.00'
                        : variance > 0
                        ? `+₹${variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : `-₹${Math.abs(variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    </Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}

                {isPending && (
                  <Button
                    title="Verify & Approve Settlement"
                    onPress={() => handleVerify(item.id)}
                    size="md"
                    style={styles.verifyBtn}
                  />
                )}
              </Card>
            </TouchableOpacity>
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

      <SettlementDetailModal
        visible={!!selectedSettlement}
        settlement={selectedSettlement}
        onClose={() => setSelectedSettlement(null)}
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
    paddingBottom: spacing.xxl,
  },
  summaryBar: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 6,
  },
  pendingPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  summaryText: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  staffInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  avatarText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  staffNameText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  metaText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
  },
  metricLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
  },
  metricVal: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metricValBold: {
    ...typography.bodyBold,
    marginTop: 2,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.sm,
    gap: 6,
  },
  notesText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  verifyBtn: {
    backgroundColor: colors.navy,
    marginTop: spacing.md,
    borderRadius: spacing.borderRadiusLg,
  },
});

