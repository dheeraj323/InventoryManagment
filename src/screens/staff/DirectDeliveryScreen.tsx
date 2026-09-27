import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useVendorStore } from '../../store/useVendorStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useStaffStockStore } from '../../store/useStaffStockStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Vendor, Product, PaymentMethod, Order } from '../../types';
import { BUSINESS_RULES, PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { colors, typography, spacing, shadows } from '../../theme';

interface SelectedProductItem {
  product: Product;
  quantity: number;
}

export const DirectDeliveryScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const initialVendorId = route?.params?.vendorId;
  const { currentUser, activeStaffId } = useAuthStore();
  const { vendors, fetchVendors } = useVendorStore();
  const { products, fetchProducts } = useInventoryStore();
  const { todaySession, subscribeTodaySession } = useStaffStockStore();
  const { recordDirectSpotDelivery } = useOrderStore();
  const { getVendorAccountSummary } = useLedgerStore();

  const effectiveStaffId =
    activeStaffId || currentUser?.staffId || currentUser?.uid || currentUser?.id || '';
  const staffName = currentUser?.name || 'Delivery Executive';

  // Vendor selection state
  const [selectedVendorId, setSelectedVendorId] = useState<string>(initialVendorId || '');
  const [vendorSearch, setVendorSearch] = useState('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(!initialVendorId);

  // Products selection state
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = useState('');

  // Payment state
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('CASH');
  const [paidAmountStr, setPaidAmountStr] = useState<string>('0');
  const [isPaidAmountManuallyEdited, setIsPaidAmountManuallyEdited] = useState(false);
  const [notes, setNotes] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchVendors();
    fetchProducts();
    if (effectiveStaffId) {
      const unsub = subscribeTodaySession(effectiveStaffId);
      return () => {
        if (unsub) unsub();
      };
    }
  }, [effectiveStaffId]);

  // Van stock mapping for current staff
  const vanStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (todaySession && (todaySession.status === 'ACTIVE' || !todaySession.status)) {
      (todaySession.items || []).forEach((it) => {
        const available = Math.max(0, it.currentStock ?? (it.loadedQty - (it.deliveredQty || 0)));
        map[it.productId] = available;
      });
    }
    return map;
  }, [todaySession]);

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === selectedVendorId || v.vendorId === selectedVendorId);
  }, [vendors, selectedVendorId]);

  // Filtered vendors for picker
  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    const list = vendors.filter((v) => v.active !== false && v.status !== 'SUSPENDED');
    if (!q) return list;
    return list.filter(
      (v) =>
        (v.shopName || '').toLowerCase().includes(q) ||
        (v.name || '').toLowerCase().includes(q) ||
        (v.phone || '').includes(q) ||
        (v.area || v.routeName || '').toLowerCase().includes(q)
    );
  }, [vendors, vendorSearch]);

  // Filtered products list (priority to items carried in van)
  const availableProductsList = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    let list = products.filter((p) => p.active !== false);

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      );
    }

    // Sort products: items in van first, then by name
    return list.sort((a, b) => {
      const stockA = vanStockMap[a.id] || 0;
      const stockB = vanStockMap[b.id] || 0;
      if (stockA > 0 && stockB === 0) return -1;
      if (stockA === 0 && stockB > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [products, vanStockMap, productSearch]);

  // Selected items array with calculations
  const selectedItemsArray: SelectedProductItem[] = useMemo(() => {
    const res: SelectedProductItem[] = [];
    for (const [prodId, qty] of Object.entries(selectedItemsMap)) {
      if (qty > 0) {
        const prod = products.find((p) => p.id === prodId);
        if (prod) {
          res.push({ product: prod, quantity: qty });
        }
      }
    }
    return res;
  }, [selectedItemsMap, products]);

  const subtotal = useMemo(() => {
    return selectedItemsArray.reduce((sum, item) => {
      const price = item.product.price || item.product.sellingPrice || 0;
      return sum + price * item.quantity;
    }, 0);
  }, [selectedItemsArray]);

  const TAX_RATE = BUSINESS_RULES.TAX_RATE || 0;
  const tax = subtotal * TAX_RATE;
  const grandTotal = subtotal + tax;

  // Auto-sync paidAmount when total changes (unless user manually typed a custom amount)
  useEffect(() => {
    if (!isPaidAmountManuallyEdited) {
      if (paymentMode === 'PAY_LATER') {
        setPaidAmountStr('0');
      } else {
        setPaidAmountStr(grandTotal > 0 ? grandTotal.toString() : '0');
      }
    }
  }, [grandTotal, paymentMode, isPaidAmountManuallyEdited]);

  const handleUpdateItemQty = (productId: string, delta: number) => {
    const cur = selectedItemsMap[productId] || 0;
    const next = Math.max(0, cur + delta);
    const vanStock = vanStockMap[productId] ?? 0;

    if (delta > 0 && vanStock > 0 && next > vanStock) {
      Alert.alert(
        'Van Stock Limit',
        `You currently have only ${vanStock} units of this product available in your van stock.`
      );
      return;
    }

    setSelectedItemsMap((prev) => {
      const copy = { ...prev };
      if (next === 0) {
        delete copy[productId];
      } else {
        copy[productId] = next;
      }
      return copy;
    });
  };

  const handleSelectPaymentMode = (mode: PaymentMethod) => {
    setPaymentMode(mode);
    setIsPaidAmountManuallyEdited(false);
    if (mode === 'PAY_LATER') {
      setPaidAmountStr('0');
    } else {
      setPaidAmountStr(grandTotal > 0 ? grandTotal.toString() : '0');
    }
  };

  const handleConfirmAndRecord = async () => {
    if (!selectedVendorId || !selectedVendor) {
      Alert.alert('Vendor Required', 'Please select the vendor who received the products.');
      return;
    }

    if (selectedItemsArray.length === 0) {
      Alert.alert(
        'Products Required',
        'Please add at least one product quantity delivered from your van.'
      );
      return;
    }

    const paidNum = parseFloat(paidAmountStr);
    if (isNaN(paidNum) || paidNum < 0) {
      Alert.alert('Invalid Payment', 'Please enter a valid positive payment amount or 0.');
      return;
    }

    const balanceAddedToKhata = Math.max(0, grandTotal - paidNum);

    Alert.alert(
      'Confirm Direct Delivery',
      `Record spot delivery of ${selectedItemsArray.length} product(s) to "${selectedVendor.shopName}"?\n\n` +
        `• Total Bill: ₹${grandTotal.toFixed(2)}\n` +
        `• Paid Now: ₹${paidNum.toFixed(2)} (${PAYMENT_METHOD_LABELS[paymentMode] || paymentMode})\n` +
        `• Added to Khata Due: ₹${balanceAddedToKhata.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Post to Khata',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const payloadItems = selectedItemsArray.map((it) => ({
                productId: it.product.id,
                productName: it.product.name,
                unit: it.product.unit || 'pcs',
                unitPrice: it.product.price || it.product.sellingPrice || 0,
                quantity: it.quantity,
              }));

              const resultOrder = await recordDirectSpotDelivery({
                vendorId: selectedVendor.id,
                staffId: effectiveStaffId,
                staffName: staffName,
                staffPhone: currentUser?.phone,
                items: payloadItems,
                paymentMode,
                paidAmount: paidNum,
                notes: notes.trim() || 'Direct spot delivery from vehicle stock',
              });

              setIsSubmitting(false);
              setCompletedOrder(resultOrder);
            } catch (err: any) {
              setIsSubmitting(false);
              console.error('Error recording direct delivery:', err);
              Alert.alert('Delivery Error', err.message || 'Failed to record spot delivery.');
            }
          },
        },
      ]
    );
  };

  const handleResetForNext = () => {
    setCompletedOrder(null);
    setSelectedItemsMap({});
    setPaidAmountStr('0');
    setIsPaidAmountManuallyEdited(false);
    setNotes('');
    setIsVendorDropdownOpen(true);
  };

  const vendorKhataSummary = selectedVendor ? getVendorAccountSummary(selectedVendor.id) : null;
  const currentOutstanding = vendorKhataSummary?.currentOutstanding ?? selectedVendor?.currentBalance ?? 0;
  const advanceBal = vendorKhataSummary?.advanceBalance ?? selectedVendor?.advanceBalance ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Direct Spot Delivery"
        subtitle="Deliver extra van stock on the spot"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="flash-outline" size={18} color="#0284C7" />
            <Text style={styles.infoBannerText}>
              For on-the-spot delivery when vendor didn't order in advance. Automatically records in
              Vendor & Admin Khata, decrements van stock, and tracks cash collected.
            </Text>
          </View>

          {/* ── STEP 1: SELECT VENDOR ── */}
          <Card style={styles.card} outlined elevation="sm">
            <View style={styles.cardHeaderRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>SELECT VENDOR</Text>
                <Text style={styles.cardSubtitle}>Choose shop receiving the products</Text>
              </View>
              {selectedVendor && !isVendorDropdownOpen && (
                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => setIsVendorDropdownOpen(true)}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedVendor && !isVendorDropdownOpen ? (
              <View style={styles.selectedVendorCard}>
                <View style={styles.vendorIconWrap}>
                  <Ionicons name="storefront" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedVendorName}>{selectedVendor.shopName}</Text>
                  <Text style={styles.selectedVendorSub}>
                    Owner: {selectedVendor.name || selectedVendor.ownerName || 'Vendor'} •{' '}
                    {selectedVendor.phone || 'No phone'}
                  </Text>
                  {selectedVendor.area ? (
                    <Text style={styles.selectedVendorArea}>Area: {selectedVendor.area}</Text>
                  ) : null}

                  {/* Khata Balance Pill */}
                  <View style={styles.khataPillRow}>
                    {advanceBal > 0 ? (
                      <View style={styles.advanceBadge}>
                        <Ionicons name="wallet-outline" size={12} color={colors.brandGreen} />
                        <Text style={styles.advanceBadgeText}>
                          Advance in Khata: ₹{advanceBal.toFixed(2)}
                        </Text>
                      </View>
                    ) : currentOutstanding > 0 ? (
                      <View style={styles.dueBadge}>
                        <Ionicons name="alert-circle-outline" size={12} color="#D97706" />
                        <Text style={styles.dueBadgeText}>
                          Current Khata Due: ₹{currentOutstanding.toFixed(2)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.settledBadge}>
                        <Ionicons name="checkmark-circle-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.settledBadgeText}>Khata Balance: ₹0 (Settled)</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.vendorPickerSection}>
                <View style={styles.searchBarWrap}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search vendor by shop name, area, phone..."
                    placeholderTextColor={colors.textMuted}
                    value={vendorSearch}
                    onChangeText={setVendorSearch}
                  />
                  {vendorSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setVendorSearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.vendorListContainer}>
                  {filteredVendors.slice(0, 10).map((v) => {
                    const isSelected = selectedVendorId === v.id;
                    const due = v.currentBalance || 0;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.vendorOptionRow, isSelected ? styles.vendorOptionRowActive : null]}
                        onPress={() => {
                          setSelectedVendorId(v.id);
                          setIsVendorDropdownOpen(false);
                          setVendorSearch('');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.vendorOptionIcon}>
                          <Ionicons
                            name="storefront-outline"
                            size={16}
                            color={isSelected ? colors.primary : colors.textSecondary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.vendorOptionName, isSelected ? styles.vendorOptionNameActive : null]}>
                            {v.shopName}
                          </Text>
                          <Text style={styles.vendorOptionSub} numberOfLines={1}>
                            {v.name} • {v.area || v.routeName || 'No Area'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={[
                              styles.vendorOptionBalance,
                              due > 0 ? { color: '#D97706' } : { color: colors.brandGreen },
                            ]}
                          >
                            {due > 0 ? `₹${due.toFixed(0)} Due` : 'No Due'}
                          </Text>
                          <Ionicons
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                            size={16}
                            color={isSelected ? colors.primary : colors.border}
                            style={{ marginTop: 2 }}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {filteredVendors.length === 0 && (
                    <Text style={styles.emptySearchText}>No matching vendors found.</Text>
                  )}
                </View>
              </View>
            )}
          </Card>

          {/* ── STEP 2: SELECT DELIVERED PRODUCTS ── */}
          <Card style={styles.card} outlined elevation="sm">
            <View style={styles.cardHeaderRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>SELECT DELIVERED PRODUCTS</Text>
                <Text style={styles.cardSubtitle}>
                  Delivered from van stock ({selectedItemsArray.length} items selected)
                </Text>
              </View>
            </View>

            {/* Product search */}
            <View style={[styles.searchBarWrap, { marginBottom: spacing.md }]}>
              <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products in van..."
                placeholderTextColor={colors.textMuted}
                value={productSearch}
                onChangeText={setProductSearch}
              />
              {productSearch.length > 0 && (
                <TouchableOpacity onPress={() => setProductSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Product items list */}
            <View style={styles.productsList}>
              {availableProductsList.map((prod) => {
                const qty = selectedItemsMap[prod.id] || 0;
                const vanStock = vanStockMap[prod.id] ?? 0;
                const price = prod.price || prod.sellingPrice || 0;
                const isSelected = qty > 0;

                return (
                  <View
                    key={prod.id}
                    style={[styles.productItemCard, isSelected ? styles.productItemCardActive : null]}
                  >
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={styles.productItemName} numberOfLines={1}>
                        {prod.name}
                      </Text>
                      <View style={styles.productMetaRow}>
                        <Text style={styles.productItemPrice}>₹{price.toFixed(2)}</Text>
                        <Text style={styles.productItemUnit}>/ {prod.unit || 'unit'}</Text>
                        <View
                          style={[
                            styles.vanStockPill,
                            vanStock > 0 ? styles.vanStockPillAvail : styles.vanStockPillEmpty,
                          ]}
                        >
                          <Ionicons
                            name="bicycle-outline"
                            size={10}
                            color={vanStock > 0 ? colors.accent : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.vanStockPillText,
                              vanStock > 0 ? { color: colors.accent } : { color: '#94A3B8' },
                            ]}
                          >
                            In Van: {vanStock}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Quantity Selector */}
                    <View style={styles.qtyControlWrap}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, qty === 0 ? styles.qtyBtnDisabled : null]}
                        onPress={() => handleUpdateItemQty(prod.id, -1)}
                        disabled={qty === 0}
                      >
                        <Ionicons
                          name="remove"
                          size={16}
                          color={qty === 0 ? colors.textMuted : colors.primary}
                        />
                      </TouchableOpacity>

                      <View style={styles.qtyDisplay}>
                        <Text style={[styles.qtyDisplayText, isSelected ? styles.qtyDisplayTextActive : null]}>
                          {qty}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleUpdateItemQty(prod.id, 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* ── STEP 3: PAYMENT & SETTLEMENT ── */}
          {selectedItemsArray.length > 0 && (
            <Card style={styles.card} outlined elevation="sm">
              <View style={styles.cardHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>PAYMENT COLLECTION</Text>
                  <Text style={styles.cardSubtitle}>
                    Choose payment mode received at counter
                  </Text>
                </View>
              </View>

              {/* Payment Mode Options */}
              <View style={styles.paymentModesGrid}>
                {[
                  { mode: 'CASH' as PaymentMethod, label: 'Cash Paid', icon: 'cash-outline', color: '#16A34A' },
                  { mode: 'ONLINE' as PaymentMethod, label: 'Online / UPI', icon: 'qr-code-outline', color: '#0284C7' },
                  { mode: 'PAY_LATER' as PaymentMethod, label: 'Pay Later (Khata)', icon: 'book-outline', color: '#D97706' },
                ].map((item) => {
                  const isSelected = paymentMode === item.mode;
                  return (
                    <TouchableOpacity
                      key={item.mode}
                      style={[
                        styles.paymentModeBtn,
                        isSelected ? { borderColor: item.color, backgroundColor: `${item.color}15` } : null,
                      ]}
                      onPress={() => handleSelectPaymentMode(item.mode)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={isSelected ? item.color : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.paymentModeLabel,
                          isSelected ? { color: item.color, fontWeight: '700' } : null,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Amount Collected Input */}
              <View style={styles.amountInputRow}>
                <Text style={styles.amountInputLabel}>Amount Collected Now (₹)</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="numeric"
                  value={paidAmountStr}
                  onChangeText={(val) => {
                    setPaidAmountStr(val);
                    setIsPaidAmountManuallyEdited(true);
                  }}
                  placeholder="0.00"
                />
              </View>

              {/* Khata Effect Explanation Box */}
              <View style={styles.khataExplainerBox}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 6 }}>
                  {(() => {
                    const paid = parseFloat(paidAmountStr) || 0;
                    const bal = Math.max(0, grandTotal - paid);
                    if (bal === 0) {
                      return (
                        <Text style={styles.khataExplainerText}>
                          Full amount of ₹{grandTotal.toFixed(2)} collected. Invoice marked PAID. Khata balance remains unaffected.
                        </Text>
                      );
                    } else if (paid === 0) {
                      return (
                        <Text style={styles.khataExplainerText}>
                          ₹{grandTotal.toFixed(2)} will be added as DEBIT (Receivable Due) to {selectedVendor?.shopName}'s Khata.
                        </Text>
                      );
                    } else {
                      return (
                        <Text style={styles.khataExplainerText}>
                          ₹{paid.toFixed(2)} collected now. Remaining ₹{bal.toFixed(2)} will be added to {selectedVendor?.shopName}'s Khata.
                        </Text>
                      );
                    }
                  })()}
                </View>
              </View>

              {/* Notes */}
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.notesLabel}>Delivery Remarks / Counter Note (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="e.g. Extra stock request fulfilled on spot"
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </Card>
          )}

          {/* ── STEP 4: BILL & KHATA SUMMARY ── */}
          {selectedItemsArray.length > 0 && (
            <Card style={styles.summaryCard} outlined elevation="md">
              <Text style={styles.summaryTitle}>FINAL BILL & KHATA BREAKDOWN</Text>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Total Items</Text>
                <Text style={styles.summaryVal}>
                  {selectedItemsArray.reduce((s, it) => s + it.quantity, 0)} units
                </Text>
              </View>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryVal}>₹{subtotal.toFixed(2)}</Text>
              </View>

              {tax > 0 && (
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>GST / Tax</Text>
                  <Text style={styles.summaryVal}>₹{tax.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.summaryLine}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalVal}>₹{grandTotal.toFixed(2)}</Text>
              </View>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Paid Amount</Text>
                <Text style={[styles.summaryVal, { color: colors.brandGreen }]}>
                  ₹{(parseFloat(paidAmountStr) || 0).toFixed(2)}
                </Text>
              </View>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Added to Vendor Khata</Text>
                <Text style={[styles.summaryVal, { color: '#D97706', fontWeight: '700' }]}>
                  ₹{Math.max(0, grandTotal - (parseFloat(paidAmountStr) || 0)).toFixed(2)}
                </Text>
              </View>

              <Button
                title={isSubmitting ? 'Recording Delivery...' : 'Record Direct Delivery & Post to Khata'}
                onPress={handleConfirmAndRecord}
                loading={isSubmitting}
                disabled={isSubmitting || selectedItemsArray.length === 0 || !selectedVendor}
                size="lg"
                icon={<Ionicons name="checkmark-done-circle" size={20} color={colors.textInverse} />}
                style={styles.submitBtn}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── SUCCESS RECEIPT MODAL ── */}
      <Modal visible={!!completedOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color={colors.brandGreen} />
            </View>

            <Text style={styles.successModalTitle}>Delivery Recorded Successfully!</Text>
            <Text style={styles.successModalSub}>
              Entry posted to Vendor Khata, Admin Ledger, and Van Stock decremented.
            </Text>

            {completedOrder && (
              <View style={styles.receiptDetailsBox}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Order Number:</Text>
                  <Text style={styles.receiptVal}>{completedOrder.orderNumber}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Vendor Shop:</Text>
                  <Text style={styles.receiptVal}>{completedOrder.shopName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Total Bill:</Text>
                  <Text style={styles.receiptVal}>₹{completedOrder.totalAmount?.toFixed(2)}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment Mode:</Text>
                  <Text style={styles.receiptVal}>
                    {PAYMENT_METHOD_LABELS[completedOrder.actualPaymentMode || completedOrder.preferredPaymentMode] || completedOrder.actualPaymentMode}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Amount Collected:</Text>
                  <Text style={[styles.receiptVal, { color: colors.brandGreen }]}>
                    ₹{(completedOrder.paidAmount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Khata Balance Due:</Text>
                  <Text style={[styles.receiptVal, { color: '#D97706' }]}>
                    ₹{(completedOrder.balanceDue || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.successModalActionRow}>
              <Button
                title="Done (Dashboard)"
                onPress={() => {
                  setCompletedOrder(null);
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'StaffDashboard' }],
                  });
                }}
                style={{ flex: 1, marginRight: spacing.xs }}
              />
              <Button
                title="New Spot Delivery"
                variant="outline"
                onPress={handleResetForNext}
                style={{ flex: 1, marginLeft: spacing.xs }}
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
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    ...typography.caption,
    color: '#0369A1',
    lineHeight: 16,
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 8,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
  cardTitle: {
    ...typography.label,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  changeBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  selectedVendorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  vendorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedVendorName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  selectedVendorSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedVendorArea: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  khataPillRow: {
    marginTop: 6,
    flexDirection: 'row',
  },
  advanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandGreenLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  advanceBadgeText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 11,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  dueBadgeText: {
    ...typography.captionBold,
    color: '#D97706',
    fontSize: 11,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  settledBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  vendorPickerSection: {
    marginTop: 4,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  vendorListContainer: {
    maxHeight: 240,
    marginTop: spacing.sm,
  },
  vendorOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 10,
  },
  vendorOptionRowActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: spacing.borderRadiusSm,
  },
  vendorOptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorOptionName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  vendorOptionNameActive: {
    color: colors.primary,
  },
  vendorOptionSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  vendorOptionBalance: {
    ...typography.captionBold,
    fontSize: 11,
  },
  emptySearchText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  productsList: {
    gap: spacing.sm,
  },
  productItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productItemCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  productItemName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  productItemPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 12,
  },
  productItemUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginRight: 6,
  },
  vanStockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  vanStockPillAvail: {
    backgroundColor: colors.accentLight,
  },
  vanStockPillEmpty: {
    backgroundColor: '#F1F5F9',
  },
  vanStockPillText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  qtyControlWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.3,
  },
  qtyDisplay: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyDisplayText: {
    ...typography.bodyBold,
    color: colors.textMuted,
    fontSize: 13,
  },
  qtyDisplayTextActive: {
    color: colors.primary,
  },
  paymentModesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  paymentModeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: 4,
  },
  paymentModeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
  amountInputRow: {
    marginBottom: spacing.sm,
  },
  amountInputLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  amountInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.h3,
    color: colors.textPrimary,
  },
  khataExplainerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: spacing.borderRadiusSm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    marginTop: spacing.xs,
  },
  khataExplainerText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  notesLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notesInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  summaryCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: '#FAFAFA',
  },
  summaryTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  grandTotalLabel: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  grandTotalVal: {
    ...typography.hero,
    fontSize: 22,
    color: colors.primary,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenPadding,
  },
  successModalCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusXl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    ...shadows.md,
  },
  successIconCircle: {
    marginBottom: spacing.sm,
  },
  successModalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  successModalSub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  receiptDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: 6,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  receiptVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  successModalActionRow: {
    flexDirection: 'row',
    width: '100%',
  },
});
