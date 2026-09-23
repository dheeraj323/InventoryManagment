import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { User } from '../../types';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { colors, typography, spacing } from '../../theme';

export const StaffApprovalScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { pendingStaff, fetchPendingStaff, approveStaff, rejectStaff, promoteToAdmin } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    await fetchPendingStaff();
    setLoading(false);
  };

  const handleOpenApproveModal = (staff: User) => {
    setSelectedStaff(staff);
    setIsModalVisible(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedStaff) return;
    setActionLoading(true);
    try {
      await approveStaff(selectedStaff.id, selectedStaff.staffId || '');
      setIsModalVisible(false);
      Alert.alert('Staff Approved', `${selectedStaff.name} is now verified and can log in.`);
      fetchPendingStaff();
    } catch (err) {
      Alert.alert('Error', 'Failed to approve staff. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteToAdmin = (staff: User) => {
    Alert.alert(
      'Grant Admin Privileges',
      `Are you sure you want to promote ${staff.name} (${staff.email}) to full Administrator? They will have complete control over inventory, orders, staff, and ledgers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote to Admin',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await promoteToAdmin(staff.id);
              setIsModalVisible(false);
              Alert.alert('Success', `${staff.name} has been promoted to Administrator.`);
              fetchPendingStaff();
            } catch (err) {
              Alert.alert('Error', 'Failed to promote user to Admin.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = (staff: User) => {
    Alert.alert(
      'Reject Staff Account',
      `Are you sure you want to reject the registration request for ${staff.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectStaff(staff.id, staff.staffId || '', 'Rejected by Administrator');
              Alert.alert('Success', 'Staff registration rejected.');
              fetchPendingStaff();
            } catch (err) {
              Alert.alert('Error', 'Failed to reject registration.');
            }
          },
        },
      ]
    );
  };

  const renderStaffCard = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color={colors.accent} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.staffName}>{item.name}</Text>
          <Text style={styles.staffEmail}>{item.email}</Text>
        </View>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>PENDING</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="call-outline" size={14} color={colors.textMuted} />
          <Text style={styles.detailText}>{item.phone || 'No phone'}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleReject(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={16} color={colors.danger} />
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => handleOpenApproveModal(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={16} color={colors.textInverse} />
          <Text style={styles.approveButtonText}>Verify & Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Staff Verification"
        subtitle="Review & approve staff registrations"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching pending staff accounts...</Text>
        </View>
      ) : pendingStaff.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="shield-checkmark" size={48} color={colors.brandGreen} />
          </View>
          <Text style={styles.emptyTitle}>All Staff Verified</Text>
          <Text style={styles.emptySubtitle}>
            There are no pending staff account registrations waiting for approval.
          </Text>
          <Button
            title="Refresh List"
            onPress={loadStaff}
            variant="outline"
            size="sm"
            style={styles.refreshListBtn}
          />
        </View>
      ) : (
        <FlatList
          data={pendingStaff}
          keyExtractor={(item) => item.id}
          renderItem={renderStaffCard}
          contentContainerStyle={styles.listContent}
          onRefresh={loadStaff}
          refreshing={loading}
        />
      )}

      {/* Approval Modal */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Verify Staff Account</Text>
            <Text style={styles.modalSub}>
              Approve account for{' '}
              <Text style={{ fontWeight: '700' }}>{selectedStaff?.name}</Text> as Delivery Staff.
            </Text>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsModalVisible(false)}
                style={styles.modalCancelBtn}
                disabled={actionLoading}
              />
              <Button
                title={actionLoading ? 'Approving...' : 'Approve Staff'}
                variant="primary"
                onPress={handleConfirmApprove}
                style={styles.modalConfirmBtn}
                disabled={actionLoading}
              />
            </View>

            <View style={styles.promoteAdminDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.promoteAdminBtn}
              onPress={() => selectedStaff && handlePromoteToAdmin(selectedStaff)}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
              <Text style={styles.promoteAdminBtnText}>Grant Full Co-Admin Privileges</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
  },
  listContent: {
    padding: spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  refreshListBtn: {
    minWidth: 140,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  staffName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  staffEmail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pendingBadge: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
  },
  pendingBadgeText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.accent,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: 4,
  },
  rejectButtonText: {
    ...typography.captionBold,
    color: colors.danger,
  },
  approveButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.brandGreen,
    gap: 4,
  },
  approveButtonText: {
    ...typography.captionBold,
    color: colors.textInverse,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.xl,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalConfirmBtn: {
    flex: 1.5,
  },
  promoteAdminDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
  },
  promoteAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },
  promoteAdminBtnText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 12,
  },
});
