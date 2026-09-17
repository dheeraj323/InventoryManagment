import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '../../store/useLedgerStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing } from '../../theme';

export const AuditHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { auditLogs } = useLedgerStore();

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Immutable Audit Trail"
        subtitle={`${auditLogs.length} Security & Adjustment Logs`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <FlatList
        data={auditLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const dateFormatted = new Date(item.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <Card style={styles.card} outlined elevation="sm">
              <View style={styles.headerRow}>
                <View style={styles.actionPill}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
                  <Text style={styles.actionText}>{item.action}</Text>
                </View>
                <Text style={styles.dateText}>{dateFormatted}</Text>
              </View>

              <Text style={styles.detailsText}>{item.details}</Text>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Mandatory Audit Reason:</Text>
                <Text style={styles.reasonText}>{item.reason}</Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.userText}>
                  Performed by: {item.performedBy} ({item.userRole})
                </Text>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            iconName="shield-outline"
            title="No Audit Logs"
            description="No manual ledger edits or credit limit changes have been logged yet."
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
    marginBottom: spacing.xs,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
  },
  actionText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 10,
    marginLeft: 4,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailsText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  reasonBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginVertical: spacing.xs,
  },
  reasonLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textMuted,
  },
  reasonText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footerRow: {
    marginTop: 4,
  },
  userText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
});
