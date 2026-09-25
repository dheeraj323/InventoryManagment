import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouteStore } from '../../store/useRouteStore';
import { useStaffStore } from '../../store/useStaffStore';
import { useVendorStore } from '../../store/useVendorStore';
import { useOrderStore } from '../../store/useOrderStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { DeliveryRoute, Staff } from '../../types';
import { colors, typography, spacing, shadows } from '../../theme';

type RouteFilter = 'ALL' | 'ASSIGNED' | 'UNASSIGNED';

export const RouteManagementScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
}) => {
  const { routes, isLoading, createRoute, updateRoute, deleteRoute, assignStaffToRoute } =
    useRouteStore();
  const { staffList, subscribeStaff, unsubscribeStaff } = useStaffStore();
  const { vendors } = useVendorStore();
  const { orders } = useOrderStore();

  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<RouteFilter>('ALL');

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoute, setEditingRoute] = useState<DeliveryRoute | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick Assign Modal State
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [targetRoute, setTargetRoute] = useState<DeliveryRoute | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    subscribeStaff();
    return () => {
      unsubscribeStaff();
    };
  }, []);

  // Filter only active staff members
  const activeStaffMembers = useMemo(() => {
    return staffList.filter((s) => s.status === 'ACTIVE' || !s.status);
  }, [staffList]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = routes.length;
    const assigned = routes.filter((r) => !!r.assignedStaffId).length;
    const unassigned = total - assigned;
    return { total, assigned, unassigned, staffCount: activeStaffMembers.length };
  }, [routes, activeStaffMembers]);

  // Map route IDs to vendor counts and open order counts
  const routeStats = useMemo(() => {
    const stats: Record<string, { vendorCount: number; orderCount: number }> = {};
    routes.forEach((r) => {
      stats[r.id] = { vendorCount: 0, orderCount: 0 };
    });

    vendors.forEach((v) => {
      if (v.routeId && stats[v.routeId]) {
        stats[v.routeId].vendorCount += 1;
      }
    });

    orders.forEach((o) => {
      if (
        o.routeId &&
        stats[o.routeId] &&
        o.status !== 'DELIVERED' &&
        o.status !== 'PARTIALLY_DELIVERED' &&
        o.status !== 'CANCELLED'
      ) {
        stats[o.routeId].orderCount += 1;
      }
    });

    return stats;
  }, [routes, vendors, orders]);

  // Filtered route list
  const filteredRoutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return routes.filter((r) => {
      if (selectedFilter === 'ASSIGNED' && !r.assignedStaffId) return false;
      if (selectedFilter === 'UNASSIGNED' && r.assignedStaffId) return false;

      if (q.length > 0) {
        const matchName = r.name.toLowerCase().includes(q);
        const matchCode = r.code?.toLowerCase().includes(q);
        const matchDesc = r.description?.toLowerCase().includes(q);
        const matchStaff = r.assignedStaffName?.toLowerCase().includes(q);
        return matchName || matchCode || matchDesc || matchStaff;
      }

      return true;
    });
  }, [routes, search, selectedFilter]);

  const handleOpenAddModal = () => {
    setEditingRoute(null);
    setName('');
    setDescription('');
    setSelectedStaffId(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (routeItem: DeliveryRoute) => {
    setEditingRoute(routeItem);
    setName(routeItem.name);
    setDescription(routeItem.description || '');
    setSelectedStaffId(routeItem.assignedStaffId || null);
    setModalVisible(true);
  };

  const handleSaveRoute = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a route name.');
      return;
    }

    setSaving(true);
    try {
      const assignedStaff = selectedStaffId
        ? activeStaffMembers.find(
            (s) => s.id === selectedStaffId || s.staffId === selectedStaffId
          )
        : null;

      if (editingRoute) {
        await updateRoute(editingRoute.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          assignedStaffId: assignedStaff?.id || selectedStaffId || undefined,
          assignedStaffName: assignedStaff?.name || undefined,
          assignedStaffPhone: assignedStaff?.phone || undefined,
        });

        if (assignedStaff) {
          await assignStaffToRoute(
            editingRoute.id,
            {
              id: assignedStaff.id || assignedStaff.staffId || '',
              name: assignedStaff.name,
              phone: assignedStaff.phone,
            },
            name.trim()
          );
        }
      } else {
        await createRoute({
          name: name.trim(),
          description: description.trim() || undefined,
          assignedStaffId: assignedStaff?.id || selectedStaffId || undefined,
          assignedStaffName: assignedStaff?.name || undefined,
          assignedStaffPhone: assignedStaff?.phone || undefined,
        });
      }

      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save route.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAssignModal = (routeItem: DeliveryRoute) => {
    setTargetRoute(routeItem);
    setAssigneeId(routeItem.assignedStaffId || null);
    setAssignModalVisible(true);
  };

  const handleConfirmAssign = async () => {
    if (!targetRoute) return;
    setAssigning(true);
    try {
      if (assigneeId) {
        const staff = activeStaffMembers.find(
          (s) => s.id === assigneeId || s.staffId === assigneeId
        );
        if (staff) {
          await assignStaffToRoute(
            targetRoute.id,
            {
              id: staff.id || staff.staffId || '',
              name: staff.name,
              phone: staff.phone,
            },
            targetRoute.name
          );
        }
      } else {
        await assignStaffToRoute(targetRoute.id, null, targetRoute.name);
      }
      setAssignModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update route staff assignment.');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteRoute = (routeItem: DeliveryRoute) => {
    Alert.alert(
      'Delete Route',
      `Are you sure you want to delete the route "${routeItem.name}"? Vendors assigned to this route will need to be reallocated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoute(routeItem.id);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete route.');
            }
          },
        },
      ]
    );
  };

  const renderRouteCard = ({ item }: { item: DeliveryRoute }) => {
    const isAssigned = Boolean(item.assignedStaffId);
    const stats = routeStats[item.id] || { vendorCount: 0, orderCount: 0 };

    return (
      <Card style={styles.routeCard} outlined elevation="sm">
        {/* Top Header */}
        <View style={styles.routeHeaderRow}>
          <View style={styles.routeTitleWrap}>
            <View style={styles.routeIconBox}>
              <Ionicons name="navigate-outline" size={20} color={colors.statusOutForDeliveryText} />
            </View>
            <View style={styles.routeTitleInfo}>
              <View style={styles.nameCodeRow}>
                <Text style={styles.routeNameText}>{item.name}</Text>
                {item.code ? (
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{item.code}</Text>
                  </View>
                ) : null}
              </View>
              {item.description ? (
                <Text style={styles.routeDescText} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Action Menu Buttons */}
          <View style={styles.routeActionRow}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleOpenEditModal(item)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleDeleteRoute(item)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Staff Assignment Section */}
        <View style={styles.assignmentSection}>
          <View style={styles.assignedStaffRow}>
            <View style={styles.staffInfoCol}>
              <Text style={styles.assignmentLabel}>ASSIGNED DELIVERY STAFF</Text>
              {isAssigned ? (
                <View style={styles.staffActiveBadge}>
                  <Ionicons name="bicycle" size={16} color={colors.brandGreen} />
                  <Text style={styles.staffNameText}>{item.assignedStaffName || 'Assigned Staff'}</Text>
                  {item.assignedStaffPhone ? (
                    <Text style={styles.staffPhoneText}>• {item.assignedStaffPhone}</Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.unassignedBadge}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                  <Text style={styles.unassignedText}>No Delivery Staff Assigned</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.assignBtn,
                isAssigned ? styles.reassignBtn : styles.assignBtnPrimary,
              ]}
              onPress={() => handleOpenAssignModal(item)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.assignBtnText,
                  isAssigned ? styles.reassignBtnText : styles.assignBtnTextPrimary,
                ]}
              >
                {isAssigned ? 'Reassign' : 'Assign Staff'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Stats Footer */}
        <View style={styles.statsFooter}>
          <View style={styles.statItem}>
            <Ionicons name="storefront-outline" size={14} color={colors.textMuted} />
            <Text style={styles.statText}>
              <Text style={styles.statNumber}>{stats.vendorCount}</Text> Registered Shops
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="receipt-outline" size={14} color={colors.textMuted} />
            <Text style={styles.statText}>
              <Text style={styles.statNumber}>{stats.orderCount}</Text> Active Shipments
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Header ─────────────────────────────────────────── */}
      <Header
        title="Route Management"
        subtitle={`${routes.length} Active Delivery Routes`}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        rightAction={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={handleOpenAddModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color={colors.textInverse} />
            <Text style={styles.headerAddBtnText}>Add Route</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Summary Metrics ────────────────────────────────────── */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{metrics.total}</Text>
          <Text style={styles.metricLabel}>Total Routes</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.brandGreen }]}>{metrics.assigned}</Text>
          <Text style={styles.metricLabel}>Assigned</Text>
        </View>
        <View style={styles.metricCard}>
          <Text
            style={[
              styles.metricValue,
              metrics.unassigned > 0 ? { color: colors.warning } : { color: colors.textSecondary },
            ]}
          >
            {metrics.unassigned}
          </Text>
          <Text style={styles.metricLabel}>Unassigned</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.primary }]}>{metrics.staffCount}</Text>
          <Text style={styles.metricLabel}>Delivery Staff</Text>
        </View>
      </View>

      {/* ── Search & Filter Tabs ──────────────────────────────── */}
      <View style={styles.filterWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search route name, code, staff..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterTabsRow}>
          {(['ALL', 'ASSIGNED', 'UNASSIGNED'] as RouteFilter[]).map((tab) => {
            const isActive = selectedFilter === tab;
            const count =
              tab === 'ALL'
                ? metrics.total
                : tab === 'ASSIGNED'
                ? metrics.assigned
                : metrics.unassigned;

            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab === 'ALL' ? 'All Routes' : tab === 'ASSIGNED' ? 'Assigned' : 'Unassigned'} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Route List ────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading distribution routes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          keyExtractor={(item) => item.id}
          renderItem={renderRouteCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              iconName="navigate-outline"
              title={search ? 'No Matching Routes' : 'No Routes Created Yet'}
              description={
                search
                  ? 'Try searching with a different keyword or filter.'
                  : 'Add your first distribution route to organize vendor delivery territories.'
              }
              actionTitle="Add New Route"
              onAction={handleOpenAddModal}
            />
          }
        />
      )}

      {/* ── Add / Edit Route Modal ────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="navigate-outline" size={20} color={colors.statusOutForDeliveryText} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingRoute ? 'Edit Delivery Route' : 'Create Delivery Route'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Configure territory name and assign delivery staff
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Input
                label="Route Name *"
                placeholder="e.g. North Ring Route, MG Road Sector"
                value={name}
                onChangeText={setName}
              />

              <Input
                label="Coverage Areas / Landmark Notes"
                placeholder="e.g. Main Market, Commercial Complex, Sector 1-4"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.pickerLabel}>Assign Delivery Staff (Optional)</Text>
              <View style={styles.staffPickerContainer}>
                <TouchableOpacity
                  style={[
                    styles.staffPickerOption,
                    selectedStaffId === null && styles.staffPickerOptionSelected,
                  ]}
                  onPress={() => setSelectedStaffId(null)}
                >
                  <Ionicons
                    name={selectedStaffId === null ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selectedStaffId === null ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.staffPickerText,
                      selectedStaffId === null && styles.staffPickerTextSelected,
                    ]}
                  >
                    Unassigned (Assign later)
                  </Text>
                </TouchableOpacity>

                {activeStaffMembers.map((staff) => {
                  const isSelected = selectedStaffId === staff.id || selectedStaffId === staff.staffId;
                  return (
                    <TouchableOpacity
                      key={staff.id}
                      style={[styles.staffPickerOption, isSelected && styles.staffPickerOptionSelected]}
                      onPress={() => setSelectedStaffId(staff.id || staff.staffId || '')}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                      <View style={styles.staffPickerInfo}>
                        <Text
                          style={[
                            styles.staffPickerText,
                            isSelected && styles.staffPickerTextSelected,
                          ]}
                        >
                          {staff.name}
                        </Text>
                        <Text style={styles.staffPickerSub}>{staff.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.footerBtn}
              />
              <Button
                title={saving ? 'Saving...' : editingRoute ? 'Update Route' : 'Create Route'}
                onPress={handleSaveRoute}
                disabled={saving}
                style={styles.footerBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Quick Assign Staff Modal ──────────────────────────── */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => setAssignModalVisible(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="bicycle-outline" size={20} color={colors.statusOutForDeliveryText} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Assign Delivery Executive</Text>
                  <Text style={styles.modalSubtitle}>Route: {targetRoute?.name}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setAssignModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.pickerLabel}>Select Staff Member for this Route</Text>
              <Text style={styles.helperText}>
                All upcoming orders from shops located on this route will automatically be shown to the selected staff member.
              </Text>

              <View style={styles.staffPickerContainer}>
                <TouchableOpacity
                  style={[
                    styles.staffPickerOption,
                    assigneeId === null && styles.staffPickerOptionSelected,
                  ]}
                  onPress={() => setAssigneeId(null)}
                >
                  <Ionicons
                    name={assigneeId === null ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={assigneeId === null ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.staffPickerText,
                      assigneeId === null && styles.staffPickerTextSelected,
                    ]}
                  >
                    None (Unassign Route)
                  </Text>
                </TouchableOpacity>

                {activeStaffMembers.map((staff) => {
                  const isSelected = assigneeId === staff.id || assigneeId === staff.staffId;
                  return (
                    <TouchableOpacity
                      key={staff.id}
                      style={[styles.staffPickerOption, isSelected && styles.staffPickerOptionSelected]}
                      onPress={() => setAssigneeId(staff.id || staff.staffId || '')}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                      <View style={styles.staffPickerInfo}>
                        <Text
                          style={[
                            styles.staffPickerText,
                            isSelected && styles.staffPickerTextSelected,
                          ]}
                        >
                          {staff.name}
                        </Text>
                        <Text style={styles.staffPickerSub}>{staff.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setAssignModalVisible(false)}
                style={styles.footerBtn}
              />
              <Button
                title={assigning ? 'Assigning...' : 'Confirm Assignment'}
                onPress={handleConfirmAssign}
                disabled={assigning}
                style={styles.footerBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  headerAddBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'space-between',
  },
  metricCard: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  filterWrapper: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
    paddingVertical: 0,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: 40,
    gap: spacing.md,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loaderText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  routeTitleWrap: {
    flexDirection: 'row',
    flex: 1,
    marginRight: spacing.sm,
  },
  routeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.statusOutForDeliveryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  routeTitleInfo: {
    flex: 1,
  },
  nameCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  routeNameText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  codeBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeBadgeText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 10,
  },
  routeDescText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  routeActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  assignedStaffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  assignmentLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  staffActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  staffNameText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  staffPhoneText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  unassignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unassignedText: {
    ...typography.captionBold,
    color: colors.warning,
    fontSize: 12,
  },
  assignBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
  },
  assignBtnPrimary: {
    backgroundColor: colors.primary,
  },
  reassignBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignBtnText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  assignBtnTextPrimary: {
    color: colors.textInverse,
  },
  reassignBtnText: {
    color: colors.textSecondary,
  },
  statsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    marginHorizontal: -spacing.md,
    marginBottom: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomLeftRadius: spacing.borderRadiusLg,
    borderBottomRightRadius: spacing.borderRadiusLg,
    gap: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  statNumber: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    ...shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.statusOutForDeliveryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: spacing.screenPadding,
    gap: spacing.sm,
  },
  pickerLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  staffPickerContainer: {
    gap: 6,
  },
  staffPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  staffPickerOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSubtle,
  },
  staffPickerInfo: {
    flex: 1,
  },
  staffPickerText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  staffPickerTextSelected: {
    color: colors.primary,
  },
  staffPickerSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: {
    flex: 1,
  },
});
