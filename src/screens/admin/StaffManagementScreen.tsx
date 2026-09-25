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
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStaffStore, StaffFilter } from '../../store/useStaffStore';
import { useStaffPayrollStore } from '../../store/useStaffPayrollStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useCashStore } from '../../store/useCashStore';
import { useRouteStore } from '../../store/useRouteStore';
import { Staff, UserRole } from '../../types';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import {
  DailyAttendancePanel,
  AdvanceRegisterPanel,
  SalaryPayrollPanel,
  RecordAdvanceModal,
  SalaryConfigModal,
  StaffVehicleStockPanel,
} from '../../components/staff';
import { colors, typography, spacing, shadows } from '../../theme';

type MainTab = 'ROSTER' | 'ATTENDANCE' | 'PAYROLL' | 'ADVANCES' | 'VEHICLE_STOCK';

// Attendance status color/label helpers
const ATT_CONFIG = {
  PRESENT:   { label: 'Present',   color: colors.brandGreen,  bg: '#DCFCE7', icon: 'checkmark-circle' as const },
  HALF_DAY:  { label: 'Half Day',  color: '#D97706',          bg: '#FEF3C7', icon: 'pie-chart'        as const },
  ABSENT:    { label: 'Absent',    color: colors.danger,      bg: '#FEE2E2', icon: 'close-circle'     as const },
  LEAVE:     { label: 'Leave',     color: colors.accent,      bg: '#DBEAFE', icon: 'calendar'         as const },
  UNMARKED:  { label: 'Unmarked',  color: colors.textMuted,   bg: colors.surfaceSubtle, icon: 'ellipse-outline' as const },
};

export const StaffManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { routes } = useRouteStore();
  const availableRoutes = useMemo(() => {
    return routes.length > 0 ? routes.map((r) => r.name) : ['General Route'];
  }, [routes]);

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

  const {
    dailyAttendanceMap,
    advancesList,
    subscribeAttendance,
    subscribeAdvances,
    subscribePayroll,
    unsubscribeAll,
  } = useStaffPayrollStore();

  const { orders, subscribeToOrders } = useOrderStore();
  const { subscribeSettlements, getStaffCashInHand } = useCashStore();

  const [activeTab, setActiveTab] = useState<MainTab>('ROSTER');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);
  const [isApproveModalVisible, setIsApproveModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isGiveAdvanceModalOpen, setIsGiveAdvanceModalOpen] = useState(false);
  const [isSalaryConfigModalOpen, setIsSalaryConfigModalOpen] = useState(false);

  // Add form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newArea, setNewArea] = useState(availableRoutes[0]);
  const [newRole, setNewRole] = useState<UserRole>('STAFF');
  const [newSalary, setNewSalary] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [approveArea, setApproveArea] = useState(availableRoutes[0]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    subscribeStaff();
    subscribeAttendance();
    subscribeAdvances();
    subscribePayroll();
    const unsubOrders = subscribeToOrders();
    const unsubSettlements = subscribeSettlements();
    return () => {
      unsubscribeStaff();
      unsubscribeAll();
      unsubOrders();
      unsubSettlements();
    };
  }, []);

  const metrics = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter(
      (s) => s.status === 'ACTIVE' || (s.active && s.status !== 'PENDING_VERIFICATION' && s.status !== 'SUSPENDED')
    ).length;
    const pending = staffList.filter((s) => s.status === 'PENDING_VERIFICATION').length;
    const suspended = staffList.filter((s) => s.status === 'SUSPENDED' || s.status === 'REJECTED').length;
    const totalCashInHand = staffList.reduce((acc, s) => {
      const key = s.staffId || s.id;
      return acc + getStaffCashInHand(key, orders);
    }, 0);
    let totalAdvanceDues = 0;
    advancesList.forEach((a) => {
      if (a.status === 'ACTIVE' || a.status === 'PARTIALLY_REPAID') {
        totalAdvanceDues += a.remainingAmount ?? (a.amount - (a.amountRepaid || 0));
      }
    });
    return { total, active, pending, suspended, totalCashInHand, totalAdvanceDues };
  }, [staffList, advancesList, orders, getStaffCashInHand]);

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (selectedFilter === 'ACTIVE') {
        if (s.status !== 'ACTIVE' && !(s.active && s.status !== 'PENDING_VERIFICATION' && s.status !== 'SUSPENDED')) return false;
      } else if (selectedFilter === 'PENDING') {
        if (s.status !== 'PENDING_VERIFICATION') return false;
      } else if (selectedFilter === 'SUSPENDED') {
        if (s.status !== 'SUSPENDED' && s.status !== 'REJECTED') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          s.name?.toLowerCase().includes(q) ||
          s.phone?.includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.activeArea?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [staffList, selectedFilter, searchQuery]);

  const handleCall = (phone?: string) => {
    if (!phone) { Alert.alert('No Phone Number', 'This staff member has no registered phone.'); return; }
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => Alert.alert('Error', 'Unable to initiate call.'));
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) { Alert.alert('No Phone Number', 'This staff member has no registered phone.'); return; }
    const clean = phone.replace(/[^0-9]/g, '');
    const full = clean.startsWith('91') ? clean : `91${clean}`;
    Linking.openURL(`https://wa.me/${full}`).catch(() => Alert.alert('Error', 'Unable to open WhatsApp.'));
  };

  const handleOpenAddModal = () => {
    setNewName(''); setNewPhone(''); setNewEmail('');
    setNewArea(availableRoutes[0] || 'General Route'); setNewRole('STAFF');
    setNewSalary(''); setNewNotes('');
    setIsAddModalVisible(true);
  };

  const handleCreateStaff = async () => {
    if (!newName.trim()) { Alert.alert('Required', 'Please enter staff member name.'); return; }
    if (!newPhone.trim() || newPhone.trim().length < 10) { Alert.alert('Required', 'Please enter a valid 10-digit mobile number.'); return; }
    const numSalary = parseFloat(newSalary.replace(/,/g, '')) || 0;
    setActionLoading(true);
    try {
      await addStaff({
        name: newName.trim(), phone: newPhone.trim(),
        email: newEmail.trim() || undefined, activeArea: newArea,
        role: newRole, monthlySalary: numSalary,
        notes: newNotes.trim() || undefined,
      });
      setIsAddModalVisible(false);
      Alert.alert('Added', `${newName} has been added and activated.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add staff member.');
    } finally { setActionLoading(false); }
  };

  const handleOpenManageModal = (staff: Staff) => {
    setSelectedStaff(staff);
    setEditName(staff.name || ''); setEditPhone(staff.phone || '');
    setEditEmail(staff.email || ''); setEditArea(staff.activeArea || availableRoutes[0] || 'General Route');
    setEditSalary(staff.monthlySalary ? staff.monthlySalary.toString() : '');
    setEditNotes(staff.notes || '');
    setIsManageModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedStaff) return;
    if (!editName.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    const numSalary = parseFloat(editSalary.replace(/,/g, '')) || 0;
    setActionLoading(true);
    try {
      await updateStaff(selectedStaff.staffId || selectedStaff.id, selectedStaff.userId, {
        name: editName.trim(), phone: editPhone.trim(),
        email: editEmail.trim(), activeArea: editArea,
        monthlySalary: numSalary, notes: editNotes.trim(),
      });
      setIsManageModalVisible(false);
      Alert.alert('Saved', 'Staff profile updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally { setActionLoading(false); }
  };

  const handleToggleStatus = async (staff: Staff) => {
    const isActive = staff.status === 'ACTIVE' || (staff.active && staff.status !== 'SUSPENDED');
    const newStatus = isActive ? 'SUSPENDED' : 'ACTIVE';
    Alert.alert(
      isActive ? 'Suspend Account' : 'Reactivate Account',
      `${isActive ? 'Suspend' : 'Reactivate'} access for ${staff.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Suspend' : 'Reactivate',
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await changeStatus(staff.staffId || staff.id, staff.userId, newStatus);
              setIsManageModalVisible(false);
            } catch { Alert.alert('Error', 'Failed to update status.'); }
            finally { setActionLoading(false); }
          },
        },
      ]
    );
  };

  const handleToggleRole = (staff: Staff) => {
    const isAdmin = staff.role === 'ADMIN';
    const target: UserRole = isAdmin ? 'STAFF' : 'ADMIN';
    Alert.alert(
      isAdmin ? 'Revert to Staff' : 'Promote to Co-Admin',
      isAdmin
        ? `Remove admin access for ${staff.name}?`
        : `Grant admin permissions to ${staff.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: isAdmin ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await setRole(staff.userId || staff.id, staff.staffId || staff.id, target);
              setIsManageModalVisible(false);
            } catch { Alert.alert('Error', 'Failed to update role.'); }
            finally { setActionLoading(false); }
          },
        },
      ]
    );
  };

  const handleOpenApproveModal = (staff: Staff) => {
    setSelectedStaff(staff);
    setApproveArea(staff.activeArea || availableRoutes[0] || 'General Route');
    setIsApproveModalVisible(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedStaff) return;
    setActionLoading(true);
    try {
      await approveStaff(selectedStaff.userId || selectedStaff.id, selectedStaff.staffId || selectedStaff.id, approveArea);
      setIsApproveModalVisible(false);
      Alert.alert('Approved', `${selectedStaff.name} is now active on ${approveArea}.`);
    } catch { Alert.alert('Error', 'Failed to approve staff.'); }
    finally { setActionLoading(false); }
  };

  const handleReject = (staff: Staff) => {
    Alert.alert('Reject Registration', `Reject registration for ${staff.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await rejectStaff(staff.userId || staff.id, staff.staffId || staff.id);
          } catch { Alert.alert('Error', 'Failed to reject.'); }
          finally { setActionLoading(false); }
        },
      },
    ]);
  };

  // ─── Staff Card ──────────────────────────────────────────────────────────────
  const renderStaffCard = ({ item }: { item: Staff }) => {
    const key = item.staffId || item.id;
    const isPending = item.status === 'PENDING_VERIFICATION';
    const isSuspended = item.status === 'SUSPENDED' || item.status === 'REJECTED';
    const isActive = !isPending && !isSuspended;
    const isCoAdmin = item.role === 'ADMIN';

    const attStatus = dailyAttendanceMap[key]?.status as keyof typeof ATT_CONFIG | undefined;
    const attCfg = attStatus ? ATT_CONFIG[attStatus] : ATT_CONFIG.UNMARKED;

    const staffAdvDue = advancesList
      .filter((a) => a.staffId === key && (a.status === 'ACTIVE' || a.status === 'PARTIALLY_REPAID'))
      .reduce((acc, a) => acc + (a.remainingAmount ?? (a.amount - (a.amountRepaid || 0))), 0);

    const staffCashInHand = getStaffCashInHand(key, orders);

    const initials = item.name
      ? item.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
      : 'ST';

    return (
      <View style={[
        styles.card,
        isPending && styles.cardPending,
        isSuspended && styles.cardSuspended,
      ]}>
        {/* ── Top Row: Avatar + Info + Status ── */}
        <View style={styles.cardTop}>
          <View style={[
            styles.avatar,
            isPending && styles.avatarPending,
            isSuspended && styles.avatarSuspended,
          ]}>
            <Text style={[styles.avatarText, isSuspended && { color: colors.textMuted }]}>
              {initials}
            </Text>
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.staffName} numberOfLines={1}>{item.name}</Text>
              {isCoAdmin && (
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={9} color={colors.accent} />
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>
            <Text style={styles.staffPhone}>{item.phone || '—'}</Text>
            <View style={styles.areaRow}>
              <Ionicons name="location-outline" size={11} color={colors.textMuted} />
              <Text style={styles.areaText} numberOfLines={1}>{item.activeArea || 'No Area'}</Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={[
            styles.statusBadge,
            isPending ? styles.statusPending : isSuspended ? styles.statusSuspended : styles.statusActive,
          ]}>
            <Text style={[
              styles.statusText,
              isPending ? styles.statusTextPending : isSuspended ? styles.statusTextSuspended : styles.statusTextActive,
            ]}>
              {isPending ? 'Pending' : isSuspended ? 'Suspended' : 'Active'}
            </Text>
          </View>
        </View>

        {/* ── Stats Row (active staff only) ── */}
        {isActive && (
          <View style={styles.statsRow}>
            {/* Attendance */}
            <View style={[styles.statChip, { backgroundColor: attCfg.bg }]}>
              <Ionicons name={attCfg.icon} size={12} color={attCfg.color} />
              <Text style={[styles.statChipText, { color: attCfg.color }]}>{attCfg.label}</Text>
            </View>

            {/* Cash in Hand */}
            <View
              style={[
                styles.statChip,
                { backgroundColor: staffCashInHand > 0 ? '#DCFCE7' : colors.surfaceSubtle },
              ]}
            >
              <Ionicons
                name="cash-outline"
                size={12}
                color={staffCashInHand > 0 ? colors.brandGreen : colors.textSecondary}
              />
              <Text
                style={[
                  styles.statChipText,
                  { color: staffCashInHand > 0 ? colors.brandGreen : colors.textSecondary },
                ]}
              >
                Cash ₹{staffCashInHand.toLocaleString('en-IN')}
              </Text>
            </View>

            {/* Advance Due */}
            {staffAdvDue > 0 && (
              <View style={[styles.statChip, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="wallet-outline" size={12} color={colors.danger} />
                <Text style={[styles.statChipText, { color: colors.danger }]}>
                  Adv ₹{staffAdvDue >= 1000 ? `${Math.round(staffAdvDue / 1000)}k` : staffAdvDue}
                </Text>
              </View>
            )}

            {/* Salary */}
            {(item.monthlySalary || 0) > 0 && (
              <View style={[styles.statChip, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="card-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.statChipText, { color: colors.textSecondary }]}>
                  ₹{item.monthlySalary! >= 1000 ? `${Math.round(item.monthlySalary! / 1000)}k` : item.monthlySalary}/mo
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Action Buttons ── */}
        <View style={styles.cardActions}>
          {isPending ? (
            <>
              <TouchableOpacity style={styles.actionBtnOutlineDanger} onPress={() => handleReject(item)} activeOpacity={0.8}>
                <Ionicons name="close" size={14} color={colors.danger} />
                <Text style={[styles.actionBtnText, { color: colors.danger }]}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => handleOpenApproveModal(item)} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                <Text style={[styles.actionBtnText, { color: colors.textInverse }]}>Approve</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.actionBtnIcon} onPress={() => handleCall(item.phone)} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={16} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnIcon} onPress={() => handleWhatsApp(item.phone)} activeOpacity={0.7}>
                <Ionicons name="logo-whatsapp" size={16} color={colors.brandGreen} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnManage}
                onPress={() => handleOpenManageModal(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={14} color={colors.primary} />
                <Text style={styles.manageBtnText}>Manage</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // ─── Tabs Config ─────────────────────────────────────────────────────────────
  const TABS: { key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'ROSTER',        label: 'Roster',     icon: 'people-outline'   },
    { key: 'VEHICLE_STOCK', label: 'Van Stock',  icon: 'cube-outline'     },
    { key: 'ATTENDANCE',    label: 'Attendance', icon: 'calendar-outline' },
    { key: 'PAYROLL',       label: 'Payroll',    icon: 'cash-outline'     },
    { key: 'ADVANCES',      label: 'Advances',   icon: 'wallet-outline'   },
  ];

  // ─── Main Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Staff Management"
        subtitle="Team roster, attendance & payroll"
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          activeTab === 'ROSTER' ? (
            <TouchableOpacity style={styles.headerBtn} onPress={handleOpenAddModal} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={15} color={colors.textInverse} />
              <Text style={styles.headerBtnText}>Add</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Roster Tab ── */}
      {activeTab === 'ROSTER' && (
        <View style={{ flex: 1 }}>
          {/* KPI Container (2x2 Balanced Grid) */}
          <View style={styles.kpiContainer}>
            <View style={styles.kpiRow}>
              {/* Total Staff */}
              <View style={styles.kpiTile}>
                <View style={[styles.kpiIconWrap, { backgroundColor: colors.accentLight }]}>
                  <Ionicons name="people" size={18} color={colors.accent} />
                </View>
                <View style={styles.kpiInfo}>
                  <Text style={styles.kpiValue}>{metrics.total}</Text>
                  <Text style={styles.kpiLabel}>Total Staff</Text>
                </View>
              </View>

              {/* Active on Field */}
              <View style={styles.kpiTile}>
                <View style={[styles.kpiIconWrap, { backgroundColor: colors.brandGreenLight }]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.brandGreen} />
                </View>
                <View style={styles.kpiInfo}>
                  <Text style={[styles.kpiValue, { color: colors.brandGreen }]}>{metrics.active}</Text>
                  <Text style={styles.kpiLabel}>Active</Text>
                </View>
              </View>
            </View>

            <View style={styles.kpiRow}>
              {/* Advance Due */}
              <TouchableOpacity
                style={styles.kpiTile}
                onPress={() => setActiveTab('ADVANCES')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.kpiIconWrap,
                    {
                      backgroundColor:
                        metrics.totalAdvanceDues > 0 ? '#FEE2E2' : colors.surfaceSubtle,
                    },
                  ]}
                >
                  <Ionicons
                    name="wallet"
                    size={18}
                    color={metrics.totalAdvanceDues > 0 ? colors.danger : colors.textMuted}
                  />
                </View>
                <View style={styles.kpiInfo}>
                  <Text
                    style={[
                      styles.kpiValue,
                      metrics.totalAdvanceDues > 0 && { color: colors.danger },
                    ]}
                    numberOfLines={1}
                  >
                    ₹{metrics.totalAdvanceDues.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.kpiLabel}>Adv. Due</Text>
                </View>
              </TouchableOpacity>

              {/* Cash in Hand */}
              <View style={styles.kpiTile}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="cash" size={18} color={colors.brandGreen} />
                </View>
                <View style={styles.kpiInfo}>
                  <Text
                    style={[styles.kpiValue, { color: colors.brandGreen }]}
                    numberOfLines={1}
                  >
                    ₹{metrics.totalCashInHand.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.kpiLabel}>Cash in Hand</Text>
                </View>
              </View>
            </View>

            {/* Pending Approvals Alert Banner */}
            {metrics.pending > 0 && (
              <TouchableOpacity
                style={styles.pendingAlertBanner}
                onPress={() => setFilter('PENDING')}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle" size={16} color="#B45309" />
                <Text style={styles.pendingAlertText}>
                  <Text style={{ fontWeight: '700' }}>{metrics.pending} registration{metrics.pending > 1 ? 's' : ''}</Text> awaiting approval
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#B45309" />
              </TouchableOpacity>
            )}
          </View>

          {/* Search + Filters */}
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={17} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, phone or area..."
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

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
              {(['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED'] as StaffFilter[]).map((f) => {
                const isSelected = selectedFilter === f;
                const count = f === 'ALL' ? metrics.total : f === 'ACTIVE' ? metrics.active : f === 'PENDING' ? metrics.pending : metrics.suspended;
                const label = f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : f === 'PENDING' ? 'Pending' : 'Suspended';
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    onPress={() => setFilter(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                      {label} {count > 0 ? `(${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Staff List */}
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Loading staff directory...</Text>
            </View>
          ) : filteredStaff.length === 0 ? (
            <View style={styles.centered}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No staff found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? `No results for "${searchQuery}"` : `No ${selectedFilter.toLowerCase()} staff accounts.`}
              </Text>
              <Button title="+ Add Staff" onPress={handleOpenAddModal} variant="primary" size="sm" style={{ marginTop: 12 }} />
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
        </View>
      )}

      {activeTab === 'VEHICLE_STOCK' && <StaffVehicleStockPanel staffList={staffList} onOpenStaffProfile={handleOpenManageModal} />}
      {activeTab === 'ATTENDANCE'    && <DailyAttendancePanel staffList={staffList} onOpenStaffProfile={handleOpenManageModal} />}
      {activeTab === 'PAYROLL'       && <SalaryPayrollPanel   staffList={staffList} onOpenStaffProfile={handleOpenManageModal} />}
      {activeTab === 'ADVANCES'      && <AdvanceRegisterPanel staffList={staffList} onOpenStaffProfile={handleOpenManageModal} />}

      {/* ═══════════════════════════════════════════════════════════
          Modal: Add New Staff
      ═══════════════════════════════════════════════════════════ */}
      <Modal visible={isAddModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setIsAddModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalSheet}>
                  <View style={styles.sheetHandle}><View style={styles.sheetHandleBar} /></View>

                  <View style={styles.modalHeaderRow}>
                    <View>
                      <Text style={styles.modalTitle}>Add Staff Member</Text>
                      <Text style={styles.modalSubtitle}>Create a new direct-hire account</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsAddModalVisible(false)} style={styles.modalCloseBtn}>
                      <Ionicons name="close" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                    <Text style={styles.fieldLabel}>Full Name *</Text>
                    <TextInput style={styles.fieldInput} placeholder="e.g. Ramesh Kumar" placeholderTextColor={colors.textMuted} value={newName} onChangeText={setNewName} />

                    <Text style={styles.fieldLabel}>Mobile Number *</Text>
                    <TextInput style={styles.fieldInput} keyboardType="phone-pad" maxLength={10} placeholder="10-digit mobile" placeholderTextColor={colors.textMuted} value={newPhone} onChangeText={setNewPhone} />

                    <Text style={styles.fieldLabel}>Email (Optional)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="email-address" autoCapitalize="none" placeholder="staff@example.com" placeholderTextColor={colors.textMuted} value={newEmail} onChangeText={setNewEmail} />

                    <Text style={styles.fieldLabel}>Monthly Salary ₹ (Optional)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="numeric" placeholder="e.g. 15000" placeholderTextColor={colors.textMuted} value={newSalary} onChangeText={setNewSalary} />

                    <Text style={styles.fieldLabel}>Delivery Route</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                      {availableRoutes.map((area) => (
                        <TouchableOpacity
                          key={area}
                          style={[styles.pill, newArea === area && styles.pillActive]}
                          onPress={() => setNewArea(area)}
                        >
                          <Text style={[styles.pillText, newArea === area && styles.pillTextActive]}>{area}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.fieldLabel}>Account Role</Text>
                    <View style={styles.roleRow}>
                      {(['STAFF', 'ADMIN'] as UserRole[]).map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleCard, newRole === r && styles.roleCardActive]}
                          onPress={() => setNewRole(r)}
                        >
                          <Ionicons
                            name={r === 'STAFF' ? 'bicycle-outline' : 'shield-checkmark-outline'}
                            size={18}
                            color={newRole === r ? colors.primary : colors.textMuted}
                          />
                          <Text style={[styles.roleLabel, newRole === r && styles.roleLabelActive]}>
                            {r === 'STAFF' ? 'Delivery Staff' : 'Co-Admin'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>Notes (Optional)</Text>
                    <TextInput style={[styles.fieldInput, styles.textAreaInput]} multiline numberOfLines={2} placeholder="Vehicle number, license, emergency contact..." placeholderTextColor={colors.textMuted} value={newNotes} onChangeText={setNewNotes} />

                    <View style={styles.modalFooter}>
                      <Button title="Cancel" variant="secondary" onPress={() => setIsAddModalVisible(false)} style={{ flex: 1 }} disabled={actionLoading} />
                      <Button title={actionLoading ? 'Creating...' : 'Create & Activate'} variant="primary" onPress={handleCreateStaff} style={{ flex: 2 }} disabled={actionLoading} />
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          Modal: Manage Staff
      ═══════════════════════════════════════════════════════════ */}
      <Modal visible={isManageModalVisible} transparent animationType="slide" onRequestClose={() => setIsManageModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setIsManageModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalSheet}>
                  <View style={styles.sheetHandle}><View style={styles.sheetHandleBar} /></View>

                  <View style={styles.modalHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{selectedStaff?.name}</Text>
                      <Text style={styles.modalSubtitle}>{selectedStaff?.phone} • {selectedStaff?.activeArea}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsManageModalVisible(false)} style={styles.modalCloseBtn}>
                      <Ionicons name="close" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                    {/* Live Financial Snapshot */}
                    {selectedStaff && (() => {
                      const staffKey = selectedStaff.staffId || selectedStaff.id;
                      const selCash = getStaffCashInHand(staffKey, orders);
                      const selAdv = advancesList
                        .filter((a) => a.staffId === staffKey && (a.status === 'ACTIVE' || a.status === 'PARTIALLY_REPAID'))
                        .reduce((acc, a) => acc + (a.remainingAmount ?? (a.amount - (a.amountRepaid || 0))), 0);

                      return (
                        <View style={styles.modalBalanceStrip}>
                          <View style={styles.modalBalanceItem}>
                            <Text style={styles.modalBalanceLabel}>Cash in Hand</Text>
                            <Text style={[styles.modalBalanceVal, { color: selCash > 0 ? colors.brandGreen : colors.textPrimary }]}>
                              ₹{selCash.toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <View style={styles.modalBalanceDivider} />
                          <View style={styles.modalBalanceItem}>
                            <Text style={styles.modalBalanceLabel}>Advance Due</Text>
                            <Text style={[styles.modalBalanceVal, { color: selAdv > 0 ? colors.danger : colors.textPrimary }]}>
                              ₹{selAdv.toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <View style={styles.modalBalanceDivider} />
                          <View style={styles.modalBalanceItem}>
                            <Text style={styles.modalBalanceLabel}>Base Salary</Text>
                            <Text style={styles.modalBalanceVal}>
                              {selectedStaff.monthlySalary ? `₹${selectedStaff.monthlySalary.toLocaleString('en-IN')}` : '—'}
                            </Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Quick Actions */}
                    <Text style={styles.fieldLabel}>Quick Actions</Text>
                    <View style={styles.quickActions}>
                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => { setIsManageModalVisible(false); setIsGiveAdvanceModalOpen(true); }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.qaIcon, { backgroundColor: colors.accentLight }]}>
                          <Ionicons name="wallet-outline" size={18} color={colors.accent} />
                        </View>
                        <Text style={styles.qaLabel}>Give Advance</Text>
                        {(selectedStaff?.totalAdvanceOutstanding || 0) > 0 && (
                          <Text style={styles.qaSub}>Due: ₹{selectedStaff!.totalAdvanceOutstanding!.toLocaleString('en-IN')}</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => { setIsManageModalVisible(false); setIsSalaryConfigModalOpen(true); }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.qaIcon, { backgroundColor: colors.brandGreenLight }]}>
                          <Ionicons name="cash-outline" size={18} color={colors.brandGreen} />
                        </View>
                        <Text style={styles.qaLabel}>Salary Config</Text>
                        <Text style={styles.qaSub}>
                          {selectedStaff?.monthlySalary ? `₹${selectedStaff.monthlySalary.toLocaleString('en-IN')}/mo` : 'Not set'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => selectedStaff && handleToggleRole(selectedStaff)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.qaIcon, { backgroundColor: '#F3E8FF' }]}>
                          <Ionicons name="shield-checkmark-outline" size={18} color="#7C3AED" />
                        </View>
                        <Text style={styles.qaLabel}>
                          {selectedStaff?.role === 'ADMIN' ? 'Remove Admin' : 'Make Admin'}
                        </Text>
                        <Text style={styles.qaSub}>{selectedStaff?.role === 'ADMIN' ? 'Co-Admin' : 'Staff'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Suspend/Reactivate */}
                    {selectedStaff && (() => {
                      const isActive = selectedStaff.status === 'ACTIVE' || (selectedStaff.active && selectedStaff.status !== 'SUSPENDED');
                      return (
                        <TouchableOpacity
                          style={[styles.statusToggleBtn, isActive ? styles.statusToggleSuspend : styles.statusToggleActivate]}
                          onPress={() => handleToggleStatus(selectedStaff)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                            size={18}
                            color={isActive ? colors.danger : colors.brandGreen}
                          />
                          <Text style={[styles.statusToggleText, { color: isActive ? colors.danger : colors.brandGreen }]}>
                            {isActive ? 'Suspend Account' : 'Reactivate Account'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* Edit Profile Fields */}
                    <View style={styles.sectionDivider}>
                      <Text style={styles.sectionDividerText}>Edit Profile</Text>
                    </View>

                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} />

                    <Text style={styles.fieldLabel}>Phone Number</Text>
                    <TextInput style={styles.fieldInput} keyboardType="phone-pad" value={editPhone} onChangeText={setEditPhone} />

                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput style={styles.fieldInput} keyboardType="email-address" autoCapitalize="none" value={editEmail} onChangeText={setEditEmail} />

                    <Text style={styles.fieldLabel}>Monthly Salary ₹</Text>
                    <TextInput style={styles.fieldInput} keyboardType="numeric" value={editSalary} onChangeText={setEditSalary} placeholder="e.g. 15000" placeholderTextColor={colors.textMuted} />

                    <Text style={styles.fieldLabel}>Delivery Route</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                      {availableRoutes.map((area) => (
                        <TouchableOpacity
                          key={area}
                          style={[styles.pill, editArea === area && styles.pillActive]}
                          onPress={() => setEditArea(area)}
                        >
                          <Text style={[styles.pillText, editArea === area && styles.pillTextActive]}>{area}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.fieldLabel}>Notes</Text>
                    <TextInput style={[styles.fieldInput, styles.textAreaInput]} multiline numberOfLines={2} value={editNotes} onChangeText={setEditNotes} />

                    <View style={styles.modalFooter}>
                      <Button title="Cancel" variant="secondary" onPress={() => setIsManageModalVisible(false)} style={{ flex: 1 }} disabled={actionLoading} />
                      <Button title={actionLoading ? 'Saving...' : 'Save Changes'} variant="primary" onPress={handleSaveEdit} style={{ flex: 2 }} disabled={actionLoading} />
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          Modal: Approve Pending Staff
      ═══════════════════════════════════════════════════════════ */}
      <Modal visible={isApproveModalVisible} transparent animationType="fade" onRequestClose={() => setIsApproveModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setIsApproveModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalSheet, { maxHeight: '60%' }]}>
                <View style={styles.sheetHandle}><View style={styles.sheetHandleBar} /></View>

                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Approve Registration</Text>
                    <Text style={styles.modalSubtitle}>{selectedStaff?.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsApproveModalVisible(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.approveNotice}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                    <Text style={styles.approveNoticeText}>
                      Approving will activate <Text style={{ fontWeight: '700' }}>{selectedStaff?.name}</Text> and allow them to login and accept deliveries.
                    </Text>
                  </View>

                  <Text style={styles.fieldLabel}>Assign Delivery Route</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                    {availableRoutes.map((area) => (
                      <TouchableOpacity
                        key={area}
                        style={[styles.pill, approveArea === area && styles.pillActive]}
                        onPress={() => setApproveArea(area)}
                      >
                        <Text style={[styles.pillText, approveArea === area && styles.pillTextActive]}>{area}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.modalFooter}>
                    <Button title="Cancel" variant="secondary" onPress={() => setIsApproveModalVisible(false)} style={{ flex: 1 }} disabled={actionLoading} />
                    <Button title={actionLoading ? 'Approving...' : 'Approve & Activate'} variant="primary" onPress={handleConfirmApprove} style={{ flex: 2, backgroundColor: colors.brandGreen }} disabled={actionLoading} />
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Give Advance Modal */}
      <RecordAdvanceModal
        visible={isGiveAdvanceModalOpen}
        staffList={staffList}
        preselectedStaff={selectedStaff}
        onClose={() => setIsGiveAdvanceModalOpen(false)}
      />

      {/* Salary Config Modal */}
      <SalaryConfigModal
        visible={isSalaryConfigModalOpen}
        staff={selectedStaff}
        onClose={() => setIsSalaryConfigModalOpen(false)}
      />
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },

  // ── Header Button ──
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusMd,
    gap: 4,
  },
  headerBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  tabLabel: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.accent,
  },

  // ── KPI Grid ──
  kpiContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...shadows.sm,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  kpiValue: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  kpiLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  pendingAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginTop: 2,
  },
  pendingAlertText: {
    ...typography.caption,
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },

  // ── Search Section ──
  searchSection: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 42,
    gap: 8,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  filterChips: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },

  // ── Staff List ──
  listContent: {
    padding: spacing.screenPadding,
    paddingTop: spacing.sm,
    gap: 10,
  },

  // ── Staff Card ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardPending: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF0',
  },
  cardSuspended: {
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPending: { backgroundColor: '#FEF3C7' },
  avatarSuspended: { backgroundColor: colors.surfaceSubtle },
  avatarText: {
    ...typography.h3,
    fontSize: 16,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  staffName: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminBadgeText: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.accent,
  },
  staffPhone: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  areaText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
  },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusSuspended: { backgroundColor: '#FEE2E2' },
  statusText: { ...typography.captionBold, fontSize: 10 },
  statusTextActive: { color: '#166534' },
  statusTextPending: { color: '#92400E' },
  statusTextSuspended: { color: '#991B1B' },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
  },
  statChipText: {
    ...typography.captionBold,
    fontSize: 11,
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnManage: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  manageBtnText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.primary,
  },
  actionBtnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandGreen,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  actionBtnOutlineDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  actionBtnText: {
    ...typography.captionBold,
    fontSize: 12,
  },

  // ── Empty + Loading States ──
  centered: {
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
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceSubtle,
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
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    ...typography.h3,
    fontSize: 17,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
  },
  modalBody: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  // Modal form fields
  fieldLabel: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  fieldInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 44,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  textAreaInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  pillsRow: {
    gap: 6,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textInverse,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2F6',
  },
  roleLabel: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textMuted,
  },
  roleLabelActive: {
    color: colors.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },

  // Manage Modal extras
  modalBalanceStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalBalanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalBalanceLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  modalBalanceVal: {
    ...typography.captionBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  modalBalanceDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderDark,
    opacity: 0.5,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  qaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  qaLabel: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  qaSub: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  statusToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  statusToggleSuspend: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusToggleActivate: {
    backgroundColor: colors.brandGreenLight,
    borderColor: '#BBF7D0',
  },
  statusToggleText: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  sectionDivider: {
    marginTop: spacing.xl,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  sectionDividerText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Approve Modal
  approveNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.accentLight,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: 4,
  },
  approveNoticeText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
