import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useVendorStore } from '../../store/useVendorStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Header } from '../../components/common/Header';
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
  const { getVendorById } = useVendorStore();
  const { getLedgerForParty, getPartyRunningBalance, adjustLedgerManual } = useLedgerStore();
  const { currentUser } = useAuthStore();

  const vendor = getVendorById(vendorId) || {
    id: vendorId,
    name: 'Retailer',
    shopName: 'Vendor Shop',
    phone: '',
    address: '',
    area: '',
    currentBalance: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'CASH' as const,
  };

  const [selectedLedgerEntry, setSelectedLedgerEntry] = useState<LedgerEntry | null>(null);
  const [showModal, setShowModal] = useState(false);

  const entries = getLedgerForParty(vendor.id);
  const totalBilled = entries
    .filter((e) => e.type === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalCollected = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);
  const runningBalance = entries.length > 0 ? (totalBilled - totalCollected) : getPartyRunningBalance(vendor.id);

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
          totalGave={totalBilled}
          totalGot={totalCollected}
          partyName={`${vendor.shopName} Ledger`}
          debitLabel="Total Invoiced"
          creditLabel="Total Collected"
        />

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
