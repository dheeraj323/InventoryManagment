import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStaffStore, StaffFilter } from '../../store/useStaffStore';
import { Staff, UserRole } from '../../types';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { colors, typography, spacing, shadows } from '../../theme';

const PREDEFINED_AREAS = [
  'Central Zone',
  'North Route',
  'South Suburbs',
  'East District',
  'West Belt',
  'Industrial Area',
  'Market Main',
  'All Areas',
];

export const StaffManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    staffList,
    isLoading,
    selectedFilter,
    searchQuery,
    subscribeStaff,
    unsubscribeStaff,
    setFilter,
    setSearchQuery,
    addStaff,
    updateStaff,
    changeStatus,
    approveStaff,
    rejectStaff,
    setRole,
  } = useStaffStore();

  // Modals state
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);
  const [isApproveModalVisible, setIsApproveModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  // Form states - Add Staff
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newArea, setNewArea] = useState(PREDEFINED_AREAS[0]);
  const [newRole, setNewRole] = useState<UserRole>('STAFF');
  const [newNotes, setNewNotes] = useState('');

  // Form states - Edit / Manage Staff
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Form state - Approve Route
  const [approveArea, setApproveArea] = useState(PREDEFINED_AREAS[0]);

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    subscribeStaff();
    return () => {
      unsubscribeStaff();
    };
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.status === 'ACTIVE' || (s.active && s.status !== 'PENDING_VERIFICATION' && s.status !== 'SUSPENDED')).length;
    const pending = staffList.filter((s) => s.status === 'PENDING_VERIFICATION').length;
    const suspended = staffList.filter((s) => s.status === 'SUSPENDED' || s.status === 'REJECTED').length;
    const totalCashInHand = staffList.reduce((acc, s) => acc + (s.cashInHand || 0), 0);

    return { total, active, pending, suspended, totalCashInHand };
  }, [staffList]);

  // Filter & Search
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      // 1. Status Filter
      if (selectedFilter === 'ACTIVE') {
        if (s.status !== 'ACTIVE' && !(s.active && s.status !== 'PENDING_VERIFICATION' && s.status !== 'SUSPENDED')) {
          return false;
        }
      } else if (selectedFilter === 'PENDING') {
        if (s.status !== 'PENDING_VERIFICATION') return false;
      } else if (selectedFilter === 'SUSPENDED') {
        if (s.status !== 'SUSPENDED' && s.status !== 'REJECTED') return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchPhone = s.phone?.includes(q);
        const matchEmail = s.email?.toLowerCase().includes(q);
        const matchArea = s.activeArea?.toLowerCase().includes(q);
        return matchName || matchPhone || matchEmail || matchArea;
      }

      return true;
    });
  }, [staffList, selectedFilter, searchQuery]);

  // Handle Communication
  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'This staff member does not have a registered phone number.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call on this device.');
    });
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'This staff member does not have a registered phone number.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullNumber = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const url = `https://wa.me/${fullNumber}?text=${encodeURIComponent('Hello from Panihaar DMS Admin')}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    });
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewArea(PREDEFINED_AREAS[0]);
    setNewRole('STAFF');
    setNewNotes('');
    setIsAddModalVisible(true);
  };

  // Save New Staff
  const handleCreateStaff = async () => {
    if (!newName.trim()) {
      Alert.alert('Validation Error', 'Please enter the staff member full name.');
      return;
    }
    if (!newPhone.trim() || newPhone.trim().length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setActionLoading(true);
    try {
      await addStaff({
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        activeArea: newArea,
        role: newRole,
        notes: newNotes.trim() || undefined,
      });
      setIsAddModalVisible(false);
      Alert.alert('Success', `Staff member ${newName} added and activated.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add staff member.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Manage Modal
  const handleOpenManageModal = (staff: Staff) => {
    setSelectedStaff(staff);
    setEditName(staff.name || '');
    setEditPhone(staff.phone || '');
    setEditEmail(staff.email || '');
    setEditArea(staff.activeArea || PREDEFINED_AREAS[0]);
    setEditNotes(staff.notes || '');
    setIsManageModalVisible(true);
  };

  // Save Edit Staff
  const handleSaveEdit = async () => {
    if (!selectedStaff) return;
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Please enter full name.');
      return;
    }

    setActionLoading(true);
    try {
      await updateStaff(selectedStaff.staffId || selectedStaff.id, selectedStaff.userId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        activeArea: editArea,
        notes: editNotes.trim(),
      });
      setIsManageModalVisible(false);
      Alert.alert('Updated', 'Staff profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update staff profile.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Status (Suspend / Reactivate)
  const handleToggleStatus = async (staff: Staff) => {
    const isCurrentlyActive = staff.status === 'ACTIVE' || (staff.active && staff.status !== 'SUSPENDED');
    const newStatus = isCurrentlyActive ? 'SUSPENDED' : 'ACTIVE';
    const actionText = isCurrentlyActive ? 'Suspend' : 'Reactivate';

    Alert.alert(
      `${actionText} Account`,
      `Are you sure you want to ${actionText.toLowerCase()} access for ${staff.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isCurrentlyActive ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await changeStatus(staff.staffId || staff.id, staff.userId, newStatus);
              setIsManageModalVisible(false);
              Alert.alert('Success', `Staff account is now ${newStatus.toLowerCase()}.`);
            } catch (err) {
              Alert.alert('Error', 'Failed to update account status.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Toggle Role (Co-Admin / Staff)
  const handleToggleRole = (staff: Staff) => {
    const isCoAdmin = staff.role === 'ADMIN';
    const targetRole: UserRole = isCoAdmin ? 'STAFF' : 'ADMIN';
    const promptTitle = isCoAdmin ? 'Revert to Delivery Staff' : 'Promote to Co-Admin';
    const promptMsg = isCoAdmin
      ? `Remove Administrator privileges for ${staff.name}? They will only have Delivery Staff access.`
      : `Grant full Administrator permissions to ${staff.name}? They will be able to manage orders, inventory, and finances.`;

    Alert.alert(promptTitle, promptMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: isCoAdmin ? 'destructive' : 'default',
        onPress: async () => {
          if (!staff.userId && !staff.staffId) return;
          setActionLoading(true);
          try {
            await setRole(staff.userId || staff.id, staff.staffId || staff.id, targetRole);
            setIsManageModalVisible(false);
            Alert.alert('Role Updated', `${staff.name} is now ${targetRole === 'ADMIN' ? 'a Co-Admin' : 'Delivery Staff'}.`);
          } catch (err) {
            Alert.alert('Error', 'Failed to update role.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // Open Approve Modal
  const handleOpenApproveModal = (staff: Staff) => {
    setSelectedStaff(staff);
    setApproveArea(staff.activeArea || PREDEFINED_AREAS[0]);
    setIsApproveModalVisible(true);
  };

  // Confirm Approve
  const handleConfirmApprove = async () => {
    if (!selectedStaff) return;
    setActionLoading(true);
    try {
      await approveStaff(
        selectedStaff.userId || selectedStaff.id,
        selectedStaff.staffId || selectedStaff.id,
        approveArea
      );
      setIsApproveModalVisible(false);
      Alert.alert('Verified & Approved', `${selectedStaff.name} is now active and assigned to ${approveArea}.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to approve staff account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Pending Staff
  const handleReject = (staff: Staff) => {
    Alert.alert(
      'Reject Registration',
      `Are you sure you want to reject registration for ${staff.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await rejectStaff(staff.userId || staff.id, staff.staffId || staff.id);
              Alert.alert('Rejected', 'Staff registration request rejected.');
            } catch (err) {
              Alert.alert('Error', 'Failed to reject registration.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Render Staff Card
  const renderStaffCard = ({ item }: { item: Staff }) => {
    const isPending = item.status === 'PENDING_VERIFICATION';
    const isSuspended = item.status === 'SUSPENDED' || item.status === 'REJECTED';
    const isCoAdmin = item.role === 'ADMIN';

    return (
      <View style={[styles.card, isPending && styles.cardPending]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.avatar,
              isPending ? styles.avatarPending : isSuspended ? styles.avatarSuspended : styles.avatarActive,
            ]}
          >
            <Text style={styles.avatarText}>
              {item.name ? item.name.charAt(0).toUpperCase() : 'S'}
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.staffName} numberOfLines={1}>
                {item.name}
              </Text>
              {isCoAdmin && (
                <View style={styles.coAdminBadge}>
                  <Ionicons name="shield-checkmark" size={10} color={colors.accent} />
                  <Text style={styles.coAdminBadgeText}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={styles.staffPhone}>{item.phone || 'No Phone'}</Text>
            {item.email ? <Text style={styles.staffEmail}>{item.email}</Text> : null}
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isPending
                ? styles.statusBadgePending
                : isSuspended
                ? styles.statusBadgeSuspended
                : styles.statusBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isPending
                  ? styles.statusTextPending
                  : isSuspended
                  ? styles.statusTextSuspended
                  : styles.statusTextActive,
              ]}
            >
              {isPending ? 'PENDING' : isSuspended ? 'SUSPENDED' : 'ACTIVE'}
            </Text>
          </View>
        </View>

        {/* Operating Area & Stats */}
        <View style={styles.detailsRow}>
          <View style={styles.areaBadge}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.areaText}>{item.activeArea || 'Central Zone'}</Text>
          </View>

          {!isPending && (
            <View style={styles.statsContainer}>
              <View style={styles.statPill}>
                <Ionicons name="cube-outline" size={12} color={colors.accent} />
                <Text style={styles.statPillText}>
                  {item.todayAssignedDeliveries || 0} Orders
                </Text>
              </View>
              <View style={[styles.statPill, styles.cashPill]}>
                <Ionicons name="cash-outline" size={12} color={colors.brandGreen} />
                <Text style={styles.cashPillText}>
                  ₹{(item.cashInHand || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Card Actions */}
        <View style={styles.cardActions}>
          {isPending ? (
            <>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleReject(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => handleOpenApproveModal(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.textInverse} />
                <Text style={styles.approveBtnText}>Verify & Assign Route</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => handleCall(item.phone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={15} color={colors.accent} />
                <Text style={styles.contactBtnText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => handleWhatsApp(item.phone)}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-whatsapp" size={15} color={colors.brandGreen} />
                <Text style={[styles.contactBtnText, { color: colors.brandGreen }]}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => handleOpenManageModal(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={15} color={colors.primary} />
                <Text style={styles.manageBtnText}>Manage</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Staff Management"
        subtitle="Team roster, route assignments & verification"
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.addStaffHeaderBtn}
            onPress={handleOpenAddModal}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={16} color={colors.textInverse} />
            <Text style={styles.addStaffHeaderBtnText}>Add Staff</Text>
          </TouchableOpacity>
        }
      />

      {/* Summary KPI Cards */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL TEAM</Text>
          <Text style={styles.kpiValue}>{metrics.total}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>ON FIELD</Text>
          <Text style={[styles.kpiValue, { color: colors.brandGreen }]}>{metrics.active}</Text>
        </View>
        <TouchableOpacity
          style={[styles.kpiCard, metrics.pending > 0 && styles.kpiCardAlert]}
          onPress={() => setFilter('PENDING')}
          activeOpacity={0.8}
        >
          <Text style={[styles.kpiLabel, metrics.pending > 0 && { color: colors.statusPendingText }]}>
            PENDING
          </Text>
          <Text style={[styles.kpiValue, metrics.pending > 0 && { color: colors.warning }]}>
            {metrics.pending}
          </Text>
        </TouchableOpacity>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>CASH IN HAND</Text>
          <Text style={[styles.kpiValue, { color: colors.accent }]} numberOfLines={1}>
            ₹{metrics.totalCashInHand.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, area..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsContainer}>
        {(['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED'] as StaffFilter[]).map((tab) => {
          const isSelected = selectedFilter === tab;
          const count =
            tab === 'ALL'
              ? metrics.total
              : tab === 'ACTIVE'
              ? metrics.active
              : tab === 'PENDING'
              ? metrics.pending
              : metrics.suspended;

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, isSelected && styles.filterTabActive]}
              onPress={() => setFilter(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
                {tab === 'ALL' ? 'All' : tab === 'ACTIVE' ? 'Active' : tab === 'PENDING' ? 'Pending' : 'Suspended'} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Staff List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading staff directory...</Text>
        </View>
      ) : filteredStaff.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={44} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Staff Members Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? `No staff matching "${searchQuery}" in ${selectedFilter.toLowerCase()} tab.`
              : `There are no ${selectedFilter.toLowerCase()} staff accounts.`}
          </Text>
          <Button
            title="+ Add Staff Member"
            onPress={handleOpenAddModal}
            variant="primary"
            size="sm"
            style={styles.emptyBtn}
          />
        </View>
      ) : (
        <FlatList
          data={filteredStaff}
          keyExtractor={(item) => item.staffId || item.id}
          renderItem={renderStaffCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Modal 1: Add New Staff ── */}
      <Modal visible={isAddModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Staff Member</Text>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.inputLabel}>Mobile Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="phone-pad"
                maxLength={10}
                value={newPhone}
                onChangeText={setNewPhone}
              />

              <Text style={styles.inputLabel}>Email Address (Optional)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="email-address"
                autoCapitalize="none"
                value={newEmail}
                onChangeText={setNewEmail}
              />

              <Text style={styles.inputLabel}>Assigned Delivery Route / Area</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaPillsRow}>
                {PREDEFINED_AREAS.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[styles.areaPill, newArea === area && styles.areaPillActive]}
                    onPress={() => setNewArea(area)}
                  >
                    <Text style={[styles.areaPillText, newArea === area && styles.areaPillTextActive]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Account Role</Text>
              <View style={styles.roleToggleRow}>
                <TouchableOpacity
                  style={[styles.roleOption, newRole === 'STAFF' && styles.roleOptionActive]}
                  onPress={() => setNewRole('STAFF')}
                >
                  <Ionicons
                    name="bicycle-outline"
                    size={16}
                    color={newRole === 'STAFF' ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.roleOptionText, newRole === 'STAFF' && styles.roleOptionTextActive]}>
                    Delivery Staff
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleOption, newRole === 'ADMIN' && styles.roleOptionActive]}
                  onPress={() => setNewRole('ADMIN')}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={newRole === 'ADMIN' ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.roleOptionText, newRole === 'ADMIN' && styles.roleOptionTextActive]}>
                    Co-Admin
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Notes / Vehicle Info (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                multiline
                numberOfLines={2}
                value={newNotes}
                onChangeText={setNewNotes}
              />

              <View style={styles.modalActionButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsAddModalVisible(false)}
                  style={styles.modalCancelBtn}
                  disabled={actionLoading}
                />
                <Button
                  title={actionLoading ? 'Creating...' : 'Create & Activate'}
                  variant="primary"
                  onPress={handleCreateStaff}
                  style={styles.modalSubmitBtn}
                  disabled={actionLoading}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 2: Manage & Edit Staff ── */}
      <Modal visible={isManageModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Staff Member</Text>
                <Text style={styles.modalSub}>{selectedStaff?.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsManageModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="email-address"
                autoCapitalize="none"
                value={editEmail}
                onChangeText={setEditEmail}
              />

              <Text style={styles.inputLabel}>Delivery Route / Operating Area</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaPillsRow}>
                {PREDEFINED_AREAS.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[styles.areaPill, editArea === area && styles.areaPillActive]}
                    onPress={() => setEditArea(area)}
                  >
                    <Text style={[styles.areaPillText, editArea === area && styles.areaPillTextActive]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Notes / Notes</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                multiline
                numberOfLines={2}
                value={editNotes}
                onChangeText={setEditNotes}
              />

              {/* Action Rows: Role & Status toggles */}
              <View style={styles.managementControls}>
                <TouchableOpacity
                  style={styles.controlRow}
                  onPress={() => selectedStaff && handleToggleRole(selectedStaff)}
                  activeOpacity={0.7}
                >
                  <View style={styles.controlInfo}>
                    <Ionicons
                      name={selectedStaff?.role === 'ADMIN' ? 'shield' : 'shield-outline'}
                      size={20}
                      color={colors.accent}
                    />
                    <View style={styles.controlTexts}>
                      <Text style={styles.controlTitle}>
                        {selectedStaff?.role === 'ADMIN' ? 'Co-Admin Privileges' : 'Delivery Staff'}
                      </Text>
                      <Text style={styles.controlSub}>
                        {selectedStaff?.role === 'ADMIN'
                          ? 'Tap to revert back to standard delivery staff'
                          : 'Tap to promote to co-administrator'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlRow, { borderBottomWidth: 0 }]}
                  onPress={() => selectedStaff && handleToggleStatus(selectedStaff)}
                  activeOpacity={0.7}
                >
                  <View style={styles.controlInfo}>
                    <Ionicons
                      name={
                        selectedStaff?.status === 'ACTIVE' || (selectedStaff?.active && selectedStaff?.status !== 'SUSPENDED')
                          ? 'pause-circle-outline'
                          : 'play-circle-outline'
                      }
                      size={20}
                      color={
                        selectedStaff?.status === 'ACTIVE' || (selectedStaff?.active && selectedStaff?.status !== 'SUSPENDED')
                          ? colors.danger
                          : colors.brandGreen
                      }
                    />
                    <View style={styles.controlTexts}>
                      <Text
                        style={[
                          styles.controlTitle,
                          {
                            color:
                              selectedStaff?.status === 'ACTIVE' || (selectedStaff?.active && selectedStaff?.status !== 'SUSPENDED')
                                ? colors.danger
                                : colors.brandGreen,
                          },
                        ]}
                      >
                        {selectedStaff?.status === 'ACTIVE' || (selectedStaff?.active && selectedStaff?.status !== 'SUSPENDED')
                          ? 'Suspend Staff Account'
                          : 'Reactivate Account'}
                      </Text>
                      <Text style={styles.controlSub}>
                        {selectedStaff?.status === 'ACTIVE' || (selectedStaff?.active && selectedStaff?.status !== 'SUSPENDED')
                          ? 'Temporarily block app login and order dispatch'
                          : 'Restore full delivery and login access'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActionButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsManageModalVisible(false)}
                  style={styles.modalCancelBtn}
                  disabled={actionLoading}
                />
                <Button
                  title={actionLoading ? 'Saving...' : 'Save Changes'}
                  variant="primary"
                  onPress={handleSaveEdit}
                  style={styles.modalSubmitBtn}
                  disabled={actionLoading}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 3: Approve Pending Staff & Assign Route ── */}
      <Modal visible={isApproveModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Verify & Assign Route</Text>
                <Text style={styles.modalSub}>{selectedStaff?.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsApproveModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: spacing.md }}>
              <Text style={styles.approveNotice}>
                Approving this registration will activate <Text style={{ fontWeight: '700' }}>{selectedStaff?.name}</Text> as Delivery Staff and enable them to login and deliver orders.
              </Text>

              <Text style={styles.inputLabel}>Assign Primary Delivery Area</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaPillsRow}>
                {PREDEFINED_AREAS.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[styles.areaPill, approveArea === area && styles.areaPillActive]}
                    onPress={() => setApproveArea(area)}
                  >
                    <Text style={[styles.areaPillText, approveArea === area && styles.areaPillTextActive]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalActionButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsApproveModalVisible(false)}
                style={styles.modalCancelBtn}
                disabled={actionLoading}
              />
              <Button
                title={actionLoading ? 'Approving...' : 'Approve & Activate'}
                variant="primary"
                onPress={handleConfirmApprove}
                style={styles.modalSubmitBtn}
                disabled={actionLoading}
              />
            </View>
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
  addStaffHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  addStaffHeaderBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.sm,
  },
  kpiCardAlert: {
    borderColor: colors.statusPendingText,
    backgroundColor: colors.statusPendingBg,
  },
  kpiLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 2,
  },
  kpiValue: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  searchBarContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: 6,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.md,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  cardPending: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFDF5',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: colors.accentLight,
  },
  avatarPending: {
    backgroundColor: colors.statusPendingBg,
  },
  avatarSuspended: {
    backgroundColor: colors.debitLight,
  },
  avatarText: {
    ...typography.h3,
    fontSize: 18,
    color: colors.primary,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  coAdminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  coAdminBadgeText: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.accent,
  },
  staffPhone: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  staffEmail: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: colors.statusDeliveredBg,
  },
  statusBadgePending: {
    backgroundColor: colors.statusPendingBg,
  },
  statusBadgeSuspended: {
    backgroundColor: colors.statusCancelledBg,
  },
  statusBadgeText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  statusTextActive: {
    color: colors.statusDeliveredText,
  },
  statusTextPending: {
    color: colors.statusPendingText,
  },
  statusTextSuspended: {
    color: colors.statusCancelledText,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  areaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  areaText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statPillText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.accent,
  },
  cashPill: {
    backgroundColor: colors.brandGreenLight,
  },
  cashPillText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.brandGreen,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  contactBtnText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.accent,
  },
  manageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  manageBtnText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.primary,
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandGreen,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  approveBtnText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textInverse,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
  },
  rejectBtnText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.danger,
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
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    minWidth: 180,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 18,
    color: colors.textPrimary,
  },
  modalSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalScroll: {
    marginTop: spacing.sm,
  },
  inputLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 50,
    textAlignVertical: 'top',
  },
  areaPillsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  areaPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  areaPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  areaPillText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  areaPillTextActive: {
    color: colors.textInverse,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: 6,
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2F6',
  },
  roleOptionText: {
    ...typography.captionBold,
    color: colors.textMuted,
  },
  roleOptionTextActive: {
    color: colors.primary,
  },
  managementControls: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  controlInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  controlTexts: {
    flex: 1,
  },
  controlTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  controlSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  approveNotice: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: colors.accentLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 1,
  },
});
