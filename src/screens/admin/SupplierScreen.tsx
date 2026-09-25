import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useDebounce } from '../../hooks';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Supplier } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const SupplierScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    suppliers,
    addSupplier,
    updateSupplier,
    adjustSupplierPayable,
    deleteSupplier,
  } = useInventoryStore();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [modalMode, setModalMode] = useState<'DETAILS' | 'RECORD_BILL' | 'RECORD_PAYMENT' | 'EDIT'>('DETAILS');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add Supplier Form
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [initialPayable, setInitialPayable] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Transaction / Edit Form
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isBillPaid, setIsBillPaid] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Overall financial summary
  const totalPayables = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.balancePayable || 0), 0),
    [suppliers]
  );

  const filteredSuppliers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return suppliers;

    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    );
  }, [suppliers, debouncedSearch]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getInitials = (str: string) =>
    str
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call');
    });
  };

  const openSupplierDetail = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setModalMode('DETAILS');
    setAmount('');
    setReference('');
    setNotes('');
    setActionError('');
    setEditName(supplier.name);
    setEditContact(supplier.contactPerson || '');
    setEditPhone(supplier.phone || '');
    setEditEmail(supplier.email || '');
  };

  const handleAddSupplier = async () => {
    if (!name.trim()) {
      setErrorMsg('Supplier name is required');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const initBal = parseFloat(initialPayable) || 0;
      await addSupplier({
        name: name.trim(),
        businessName: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        balancePayable: Math.max(0, initBal),
        outstandingPayable: Math.max(0, initBal),
      });

      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setInitialPayable('');
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTransaction = async () => {
    if (!selectedSupplier) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setActionError('Please enter a valid amount greater than 0');
      return;
    }

    setActionError('');
    setActionLoading(true);

    try {
      if (modalMode === 'RECORD_BILL') {
        if (!isBillPaid) {
          await adjustSupplierPayable(
            selectedSupplier.id,
            numAmount,
            'ADD_BILL',
            notes.trim() || (reference.trim() ? `Bill #${reference.trim()}` : undefined)
          );
        } else {
          // Bill is already paid at purchase time, no balance payable is added
          const paidBillReason = `Paid Purchase: ${
            reference.trim() ? `Bill #${reference.trim()}` : ''
          }${notes.trim() ? ` - ${notes.trim()}` : ''}`.trim();

          await adjustSupplierPayable(
            selectedSupplier.id,
            selectedSupplier.balancePayable || 0,
            'SET_BALANCE',
            paidBillReason
          );
        }
      } else if (modalMode === 'RECORD_PAYMENT') {
        await adjustSupplierPayable(
          selectedSupplier.id,
          numAmount,
          'RECORD_PAYMENT',
          notes.trim() || (reference.trim() ? `Ref #${reference.trim()}` : undefined)
        );
      }
      setSelectedSupplier(null);
    } catch (err: any) {
      setActionError(err.message || 'Transaction failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedSupplier) return;
    if (!editName.trim()) {
      setActionError('Supplier name is required');
      return;
    }

    setActionError('');
    setActionLoading(true);

    try {
      await updateSupplier(selectedSupplier.id, {
        name: editName.trim(),
        contactPerson: editContact.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
      });
      setSelectedSupplier(null);
    } catch (err: any) {
      setActionError(err.message || 'Update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    if (!selectedSupplier) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedSupplier) return;
    setIsDeleting(true);
    try {
      await deleteSupplier(selectedSupplier.id);
      setShowDeleteModal(false);
      setSelectedSupplier(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete supplier');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Suppliers & Payables"
        subtitle={`${suppliers.length} Active Partners`}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color={colors.textInverse} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Search Bar ────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search supplier, contact, phone..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* ── Supplier List ─────────────────────────────────────────── */}
      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.summaryBar}>
            <View>
              <Text style={styles.summaryLabel}>TOTAL OUTSTANDING PAYABLES</Text>
              <Text style={styles.summaryAmount}>₹{fmt(totalPayables)}</Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>{suppliers.length} Partners</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const payable = item.balancePayable || 0;
          return (
            <Card
              style={styles.supplierCard}
              onPress={() => openSupplierDetail(item)}
              outlined
              elevation="sm"
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: payable > 0 ? colors.debitLight : colors.surfaceSubtle },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: payable > 0 ? colors.debit : colors.textSecondary },
                    ]}
                  >
                    {getInitials(item.name)}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.supplierName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.contactText} numberOfLines={1}>
                    {item.contactPerson || 'Contact'} {item.phone ? `· ${item.phone}` : ''}
                  </Text>
                </View>

                <View style={styles.balanceCol}>
                  <Text style={styles.balanceLabel}>Payable</Text>
                  <Text
                    style={[
                      styles.balanceValue,
                      payable > 0 ? styles.balanceDue : styles.balanceClear,
                    ]}
                  >
                    ₹{fmt(payable)}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                  style={{ marginLeft: 6 }}
                />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="business-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No suppliers found</Text>
            <Text style={styles.emptySub}>
              {search
                ? 'Try adjusting your search'
                : 'Add suppliers to track purchases and payables'}
            </Text>
          </View>
        }
      />

      {/* ── ADD SUPPLIER MODAL ─────────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Supplier</Text>
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.modalScroll}
                contentContainerStyle={{ paddingBottom: spacing.xl }}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              >
                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                <Input
                  label="Supplier / Business Name *"
                  value={name}
                  onChangeText={setName}
                />

                <Input
                  label="Contact Person"
                  value={contactPerson}
                  onChangeText={setContactPerson}
                />

                <Input
                  label="Phone Number"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />

                <Input
                  label="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <Input
                  label="Opening Balance Payable (₹)"
                  keyboardType="numeric"
                  prefix="₹"
                  value={initialPayable}
                  onChangeText={setInitialPayable}
                />

                <View style={styles.modalActions}>
                  <Button
                    title="CANCEL"
                    variant="secondary"
                    onPress={() => setShowAddModal(false)}
                    style={{ flex: 1, marginRight: spacing.sm }}
                  />
                  <Button
                    title="SAVE SUPPLIER"
                    onPress={handleAddSupplier}
                    loading={loading}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── SUPPLIER ACTION SHEET / DETAILS MODAL ───────────────────── */}
      <Modal
        visible={!!selectedSupplier}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedSupplier(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
            {selectedSupplier && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  {modalMode === 'DETAILS' ? (
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={styles.modalTitle} numberOfLines={1}>
                        {selectedSupplier.name}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.backRow}
                      onPress={() => {
                        setModalMode('DETAILS');
                        setActionError('');
                      }}
                    >
                      <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                      <Text style={styles.modalTitle}>
                        {modalMode === 'RECORD_BILL'
                          ? 'Record Purchase Bill'
                          : modalMode === 'RECORD_PAYMENT'
                          ? 'Record Payment'
                          : 'Edit Supplier'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => setSelectedSupplier(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.modalScroll}
                  contentContainerStyle={{ paddingBottom: spacing.xl }}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                >
                  {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

                  {/* ── 1. DEFAULT DETAILS VIEW ─────────────────────────── */}
                  {modalMode === 'DETAILS' && (
                    <View>
                      {/* Balance Card */}
                      <View style={styles.detailBalanceCard}>
                        <Text style={styles.detailBalanceLabel}>OUTSTANDING PAYABLE</Text>
                        <Text
                          style={[
                            styles.detailBalanceAmount,
                            (selectedSupplier.balancePayable || 0) > 0
                              ? { color: colors.debit }
                              : { color: colors.textSecondary },
                          ]}
                        >
                          ₹{fmt(selectedSupplier.balancePayable || 0)}
                        </Text>
                      </View>

                      {/* Contact Details List */}
                      <View style={styles.detailList}>
                        {selectedSupplier.contactPerson ? (
                          <View style={styles.detailRow}>
                            <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                            <Text style={styles.detailLabel}>Contact Person</Text>
                            <Text style={styles.detailValue}>
                              {selectedSupplier.contactPerson}
                            </Text>
                          </View>
                        ) : null}

                        {selectedSupplier.phone ? (
                          <View style={styles.detailRow}>
                            <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                            <Text style={styles.detailLabel}>Phone</Text>
                            <TouchableOpacity
                              style={styles.phoneClickable}
                              onPress={() => handleCall(selectedSupplier.phone)}
                            >
                              <Text style={styles.phoneValue}>{selectedSupplier.phone}</Text>
                              <Ionicons name="call" size={14} color={colors.primary} />
                            </TouchableOpacity>
                          </View>
                        ) : null}

                        {selectedSupplier.email ? (
                          <View style={styles.detailRow}>
                            <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                            <Text style={styles.detailLabel}>Email</Text>
                            <Text style={styles.detailValue}>{selectedSupplier.email}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Primary Action Buttons */}
                      <View style={styles.actionButtonContainer}>
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.debit }]}
                          onPress={() => {
                            setModalMode('RECORD_BILL');
                            setIsBillPaid(false);
                            setAmount('');
                            setReference('');
                            setNotes('');
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="add" size={18} color={colors.textInverse} />
                          <Text style={styles.primaryActionText}>Record Purchase Bill</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.brandGreen }]}
                          onPress={() => {
                            setModalMode('RECORD_PAYMENT');
                            setAmount('');
                            setReference('');
                            setNotes('');
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-done" size={18} color={colors.textInverse} />
                          <Text style={styles.primaryActionText}>Record Payment</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Secondary Options */}
                      <View style={styles.secondaryOptionRow}>
                        <TouchableOpacity
                          style={styles.textOptionBtn}
                          onPress={() => setModalMode('EDIT')}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                          <Text style={styles.textOptionLabel}>Edit Supplier</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.textOptionBtn}
                          onPress={handleDelete}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                          <Text style={[styles.textOptionLabel, { color: colors.danger }]}>
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* ── 2. RECORD PURCHASE BILL ─────────────────────────── */}
                  {modalMode === 'RECORD_BILL' && (
                    <View style={styles.formContainer}>
                      <Input
                        label="Bill Amount (₹) *"
                        keyboardType="numeric"
                        prefix="₹"
                        value={amount}
                        onChangeText={setAmount}
                      />
                      <Input
                        label="Bill / Invoice Reference Number"
                        value={reference}
                        onChangeText={setReference}
                      />
                      <Input
                        label="Notes (Optional)"
                        value={notes}
                        onChangeText={setNotes}
                      />

                      {/* Bill Payment Status Check Option */}
                      <TouchableOpacity
                        style={[
                          styles.paidStatusToggle,
                          isBillPaid ? styles.paidStatusTogglePaid : styles.paidStatusToggleUnpaid,
                        ]}
                        onPress={() => setIsBillPaid(!isBillPaid)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.checkboxBox,
                            isBillPaid ? styles.checkboxBoxPaid : styles.checkboxBoxUnpaid,
                          ]}
                        >
                          {isBillPaid && (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          )}
                        </View>
                        <View style={styles.paidStatusTextCol}>
                          <Text
                            style={[
                              styles.paidStatusTitle,
                              isBillPaid
                                ? { color: colors.brandGreen }
                                : { color: colors.textPrimary },
                            ]}
                          >
                            {isBillPaid ? 'Bill is Fully Paid' : 'Bill is Unpaid (On Credit)'}
                          </Text>
                          <Text style={styles.paidStatusSubtitle}>
                            {isBillPaid
                              ? 'Paid instantly (No amount added to outstanding payable)'
                              : 'Increases supplier balance payable by bill amount'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <Button
                        title={
                          isBillPaid
                            ? `RECORD PAID BILL (₹${amount || '0.00'})`
                            : `ADD UNPAID BILL (+₹${amount || '0.00'})`
                        }
                        onPress={handleSaveTransaction}
                        loading={actionLoading}
                        style={{
                          backgroundColor: isBillPaid ? colors.brandGreen : colors.debit,
                          marginTop: spacing.sm,
                          marginBottom: spacing.md,
                        }}
                      />
                    </View>
                  )}

                  {/* ── 3. RECORD PAYMENT ───────────────────────────────── */}
                  {modalMode === 'RECORD_PAYMENT' && (
                    <View style={styles.formContainer}>
                      <Input
                        label="Payment Amount (₹) *"
                        keyboardType="numeric"
                        prefix="₹"
                        value={amount}
                        onChangeText={setAmount}
                      />
                      <Input
                        label="Payment Reference / Txn ID"
                        value={reference}
                        onChangeText={setReference}
                      />
                      <Input
                        label="Notes (Optional)"
                        value={notes}
                        onChangeText={setNotes}
                      />

                      <Button
                        title={`SAVE PAYMENT (−₹${amount || '0.00'})`}
                        onPress={handleSaveTransaction}
                        loading={actionLoading}
                        style={{ backgroundColor: colors.brandGreen, marginTop: spacing.sm, marginBottom: spacing.md }}
                      />
                    </View>
                  )}

                  {/* ── 4. EDIT SUPPLIER ────────────────────────────────── */}
                  {modalMode === 'EDIT' && (
                    <View style={styles.formContainer}>
                      <Input
                        label="Supplier Name *"
                        value={editName}
                        onChangeText={setEditName}
                      />
                      <Input
                        label="Contact Person"
                        value={editContact}
                        onChangeText={setEditContact}
                      />
                      <Input
                        label="Phone"
                        value={editPhone}
                        keyboardType="phone-pad"
                        onChangeText={setEditPhone}
                      />
                      <Input
                        label="Email"
                        value={editEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onChangeText={setEditEmail}
                      />

                      <Button
                        title="SAVE CHANGES"
                        onPress={handleSaveEdit}
                        loading={actionLoading}
                        style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
                      />
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────────── */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Supplier"
        message={`Are you sure you want to delete ${selectedSupplier?.name}? This action cannot be undone.`}
        confirmTitle="Delete"
        cancelTitle="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadiusMd,
    gap: 2,
  },
  addBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
  searchContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.debit,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  summaryAmount: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.debit,
    marginTop: 2,
  },
  summaryBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
  },
  summaryBadgeText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },

  // Supplier Card
  supplierCard: {
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  supplierName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  contactText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 2,
  },
  balanceValue: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  balanceDue: {
    color: colors.debit,
  },
  balanceClear: {
    color: colors.textSecondary,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    maxHeight: '90%',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalScroll: {
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.captionBold,
    color: colors.danger,
    backgroundColor: colors.debitLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },

  // Details View in Modal
  detailBalanceCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailBalanceLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  detailBalanceAmount: {
    ...typography.hero,
    fontSize: 24,
    marginTop: 2,
  },
  detailList: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    fontSize: 12,
  },
  detailValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  phoneClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneValue: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
  },
  actionButtonContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: spacing.borderRadiusMd,
    gap: 6,
  },
  primaryActionText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 13,
  },
  secondaryOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  textOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: spacing.xs,
  },
  textOptionLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 12,
  },

  // Form Container
  formContainer: {
    paddingVertical: spacing.xs,
  },
  paidStatusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1.5,
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  paidStatusToggleUnpaid: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  paidStatusTogglePaid: {
    backgroundColor: colors.brandGreenLight,
    borderColor: '#86EFAC',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxUnpaid: {
    borderColor: colors.textMuted,
    backgroundColor: colors.surface,
  },
  checkboxBoxPaid: {
    borderColor: colors.brandGreen,
    backgroundColor: colors.brandGreen,
  },
  paidStatusTextCol: {
    flex: 1,
  },
  paidStatusTitle: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  paidStatusSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});
