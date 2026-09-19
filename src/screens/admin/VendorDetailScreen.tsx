import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
} from 'react-native';
import { useVendorStore } from '../../store/useVendorStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LedgerSummaryCard } from '../../components/ledger/LedgerSummaryCard';
import { LedgerRow } from '../../components/ledger/LedgerRow';
import { LedgerAdjustmentModal } from '../../components/ledger/LedgerAdjustmentModal';
import { LedgerEntry } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const VendorDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { vendorId } = route.params || {};
  const { getVendorById, updateCreditLimit } = useVendorStore();
  const { getLedgerForParty, getPartyRunningBalance, adjustLedgerManual } = useLedgerStore();
  const { currentUser } = useAuthStore();

  const vendor = getVendorById(vendorId) || {
    id: vendorId,
    name: 'Retailer',
    shopName: 'Vendor Shop',
    phone: '',
    address: '',
    area: '',
    creditLimit: 5000,
    currentBalance: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'CASH' as const,
  };

  const [creditLimitStr, setCreditLimitStr] = useState(vendor.creditLimit.toString());
  const [payLaterEligible, setPayLaterEligible] = useState(vendor.payLaterEligible);
  const [selectedLedgerEntry, setSelectedLedgerEntry] = useState<LedgerEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const entries = getLedgerForParty(vendor.id);
  const runningBalance = getPartyRunningBalance(vendor.id);

  const handleUpdateCreditTerms = async () => {
    const newLimit = parseFloat(creditLimitStr);
    if (isNaN(newLimit) || newLimit < 0) return;

    setLoading(true);
    await updateCreditLimit(vendor.id, newLimit, payLaterEligible);
    setLoading(false);

    setUpdateMsg('Credit terms updated successfully!');
    setTimeout(() => setUpdateMsg(''), 3000);
  };

  const handleSaveManualAdjustment = (
    entryId: string,
    newAmount: number,
    reason: string
  ) => {
    adjustLedgerManual(
      entryId,
      newAmount,
      reason,
      currentUser?.name || 'Admin Rajesh'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={vendor.shopName}
        subtitle={`Proprietor: ${vendor.name}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ledger Summary */}
        <LedgerSummaryCard
          currentBalance={runningBalance}
          partyName={`${vendor.shopName} Ledger`}
          debitLabel="Total Billed"
          creditLabel="Total Collected"
        />

        {/* Credit Limit & Pay Later Controls */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>CREDIT LIMIT & PAY LATER CONTROL</Text>

          <Input
            label="Vendor Credit Limit (₹)"
            value={creditLimitStr}
            onChangeText={setCreditLimitStr}
            keyboardType="numeric"
            prefix="₹"
          />

          <View style={styles.switchRow}>
            <View style={styles.switchTextCol}>
              <Text style={styles.switchLabel}>Pay Later Eligibility</Text>
              <Text style={styles.switchSub}>
                Allow vendor to select Pay Later payment mode at checkout.
              </Text>
            </View>
            <Switch
              value={payLaterEligible}
              onValueChange={setPayLaterEligible}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          {updateMsg ? <Text style={styles.successMsg}>{updateMsg}</Text> : null}

          <Button
            title="SAVE CREDIT TERMS"
            onPress={handleUpdateCreditTerms}
            loading={loading}
            size="sm"
            style={styles.saveBtn}
          />
        </Card>

        {/* Vendor Ledger Section */}
        <Text style={styles.sectionTitle}>Ledger Transactions ({entries.length})</Text>
        <Text style={styles.instructionText}>
          Tap any ledger entry to perform manual adjustment with mandatory audit log.
        </Text>

        {entries.map((entry) => (
          <LedgerRow
            key={entry.id}
            entry={entry}
            perspective="ADMIN"
            onPress={() => {
              setSelectedLedgerEntry(entry);
              setShowModal(true);
            }}
          />
        ))}

        {/* Modal for manual ledger adjustment */}
        <LedgerAdjustmentModal
          visible={showModal}
          entry={selectedLedgerEntry}
          onClose={() => setShowModal(false)}
          onSave={handleSaveManualAdjustment}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.screenPadding,
  },
  card: {
    marginVertical: spacing.md,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  switchTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  switchSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  successMsg: {
    ...typography.captionBold,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  saveBtn: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  instructionText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
