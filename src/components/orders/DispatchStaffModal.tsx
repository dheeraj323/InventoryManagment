import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { Staff } from '../../types';
import { Button } from '../common/Button';
import { colors, typography, spacing } from '../../theme';

interface DispatchStaffModalProps {
  visible: boolean;
  orderNumber: string;
  onClose: () => void;
  onConfirm: (staff: Staff) => void;
  isLoading?: boolean;
}

export const DispatchStaffModal: React.FC<DispatchStaffModalProps> = ({
  visible,
  orderNumber,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedStaff(null);
      setLoadingStaff(true);
      authService
        .getActiveStaff()
        .then((list) => {
          setStaffList(list);
          if (list.length === 1) {
            setSelectedStaff(list[0]);
          }
        })
        .catch((err) => console.error('Error loading active staff:', err))
        .finally(() => setLoadingStaff(false));
    }
  }, [visible]);

  const handleConfirm = () => {
    if (selectedStaff) {
      onConfirm(selectedStaff);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>Assign Delivery Staff</Text>
              <Text style={styles.subtitle}>Order #{orderNumber}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.instructionText}>
            Select the staff member who will deliver this order:
          </Text>

          {/* Staff List */}
          {loadingStaff ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loaderText}>Loading delivery staff...</Text>
            </View>
          ) : staffList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Active Staff Found</Text>
              <Text style={styles.emptySubtitle}>
                Please approve or register delivery staff before dispatching.
              </Text>
            </View>
          ) : (
            <FlatList
              data={staffList}
              keyExtractor={(item) => item.staffId || item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected =
                  selectedStaff?.id === item.id ||
                  selectedStaff?.staffId === item.staffId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.staffCard,
                      isSelected && styles.staffCardSelected,
                    ]}
                    onPress={() => setSelectedStaff(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.staffLeft}>
                      <View
                        style={[
                          styles.avatarCircle,
                          isSelected && styles.avatarCircleSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            isSelected && styles.avatarTextSelected,
                          ]}
                        >
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.staffInfo}>
                        <Text style={styles.staffName}>{item.name}</Text>
                        <View style={styles.metaRow}>
                          <Ionicons
                            name="call-outline"
                            size={12}
                            color="#64748B"
                          />
                          <Text style={styles.metaText}>
                            {item.phone ? `+91 ${item.phone}` : 'No phone'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              disabled={isLoading}
              style={styles.cancelBtn}
            />
            <Button
              title={isLoading ? 'Dispatching...' : 'Dispatch for Delivery'}
              onPress={handleConfirm}
              disabled={!selectedStaff || isLoading || loadingStaff}
              style={styles.confirmBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  instructionText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  list: {
    maxHeight: 260,
    marginBottom: spacing.md,
  },
  loaderContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: spacing.sm,
  },
  staffCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F7FF',
  },
  staffLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleSelected: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  avatarTextSelected: {
    color: '#FFFFFF',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 1.6,
  },
});
