import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/useCartStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useVendorStore } from '../../store/useVendorStore';
import { PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { GoogleMapsLocationPicker } from '../../components/common/GoogleMapsLocationPicker';
import { Order, PaymentMethod } from '../../types';
import { formatDate } from '../../utils/dateFormatter';
import { openGoogleMapsView } from '../../utils/locationUtils';
import { colors, typography, spacing } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

export const CheckoutScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { items, getSubtotal, getTax, getTotal, getItemCount, clearCart } = useCartStore();
  const { createOrder } = useOrderStore();
  const { activeVendorId, currentUser } = useAuthStore();
  const { getVendorAccountSummary } = useLedgerStore();
  const { getVendorById } = useVendorStore();

  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const effectiveVendorId = activeVendorId || currentUser?.vendorId || 'vendor-1';
  const vendor = getVendorById(effectiveVendorId) || {
    id: effectiveVendorId,
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '+91 99887 76655',
    address: 'Shop #12, Central Market, Sector 14, City',
    locationUrl: '',
    area: 'Sector 14',
    currentBalance: 3450,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };
  const runningBalance = getVendorAccountSummary(effectiveVendorId, vendor);

  const totalAmount = getTotal();
  const subtotal = getSubtotal();
  const tax = getTax();
  const totalUnits = getItemCount();

  const advanceBalance =
    runningBalance.advanceBalance ||
    (vendor.advanceBalance && vendor.advanceBalance > 0
      ? vendor.advanceBalance
      : vendor.currentBalance < 0
      ? Math.abs(vendor.currentBalance)
      : 0);

  const hasAdvance = advanceBalance > 0;
  const advanceAdjusted = hasAdvance ? Math.min(totalAmount, advanceBalance) : 0;
  const finalBillAmount = Math.max(0, totalAmount - advanceAdjusted);
  const remainingAdvance = Math.max(0, advanceBalance - advanceAdjusted);
  const isFullyCoveredByAdvance = hasAdvance && finalBillAmount === 0;

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMethod>(
    isFullyCoveredByAdvance ? 'ADVANCE' : vendor.preferredPaymentMode || 'PAY_LATER'
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    vendor.address || currentUser?.address || 'Shop Address'
  );
  const [locationUrl, setLocationUrl] = useState(
    vendor.locationUrl || currentUser?.locationUrl || ''
  );
  const [latitude, setLatitude] = useState<number | undefined>(
    vendor.latitude !== undefined ? vendor.latitude : currentUser?.latitude
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    vendor.longitude !== undefined ? vendor.longitude : currentUser?.longitude
  );
  const [showLocationEditor, setShowLocationEditor] = useState(false);

  // Synchronize state when vendor or currentUser profile is loaded or updated
  useEffect(() => {
    const currentActualAddress = vendor.address || currentUser?.address || '';
    const currentActualLocationUrl = vendor.locationUrl || currentUser?.locationUrl || '';
    const currentActualLat = vendor.latitude !== undefined ? vendor.latitude : currentUser?.latitude;
    const currentActualLng = vendor.longitude !== undefined ? vendor.longitude : currentUser?.longitude;

    if (currentActualAddress && (!deliveryAddress || deliveryAddress === 'Shop Address')) {
      setDeliveryAddress(currentActualAddress);
    }
    if (currentActualLocationUrl && !locationUrl) {
      setLocationUrl(currentActualLocationUrl);
    }
    if (currentActualLat !== undefined && latitude === undefined) {
      setLatitude(currentActualLat);
    }
    if (currentActualLng !== undefined && longitude === undefined) {
      setLongitude(currentActualLng);
    }
  }, [vendor.address, vendor.locationUrl, vendor.latitude, vendor.longitude, currentUser?.address, currentUser?.locationUrl, currentUser?.latitude, currentUser?.longitude]);

  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Warn (not block) when PAY_LATER order exceeds vendor credit limit
  const [creditWarning, setCreditWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePlaceOrder = async () => {
    if (items.length === 0 || totalAmount <= 0) return;

    setErrorMsg('');
    setCreditWarning('');
    setLoading(true);

    // Credit limit pre-flight check for PAY_LATER orders (based on remaining finalBillAmount)
    // Non-blocking: order is still created but flagged pendingAdminOverride
    let pendingAdminOverrideLocal = false;
    if (
      !isFullyCoveredByAdvance &&
      selectedPaymentMode === 'PAY_LATER' &&
      vendor.creditLimit &&
      vendor.creditLimit > 0
    ) {
      const outstanding = runningBalance.currentOutstanding;
      if (outstanding + finalBillAmount > vendor.creditLimit) {
        pendingAdminOverrideLocal = true;
        setCreditWarning(
          `⚠️ This order exceeds your credit limit. Outstanding: ₹${outstanding.toLocaleString('en-IN')}, ` +
          `Bill to Add: ₹${finalBillAmount.toLocaleString('en-IN')}, Limit: ₹${vendor.creditLimit.toLocaleString('en-IN')}. The order will require Admin approval.`
        );
      }
    }

    try {
      const finalAddress = deliveryAddress.trim() || vendor.address || currentUser?.address || '';
      const finalLocationUrl = locationUrl.trim() || vendor.locationUrl || currentUser?.locationUrl || undefined;
      const finalLat = latitude !== undefined ? latitude : vendor.latitude !== undefined ? vendor.latitude : currentUser?.latitude;
      const finalLng = longitude !== undefined ? longitude : vendor.longitude !== undefined ? vendor.longitude : currentUser?.longitude;

      const effectivePaymentMode = isFullyCoveredByAdvance ? 'ADVANCE' : selectedPaymentMode;
      const paidAmount = isFullyCoveredByAdvance
        ? 0
        : effectivePaymentMode === 'CASH' || effectivePaymentMode === 'ONLINE'
        ? finalBillAmount
        : 0;
      const balanceDue = isFullyCoveredByAdvance
        ? 0
        : effectivePaymentMode === 'PAY_LATER'
        ? finalBillAmount
        : 0;

      const newOrder = await createOrder({
        vendorId: vendor.id,
        vendorName: vendor.name,
        shopName: vendor.shopName,
        phone: vendor.phone,
        address: finalAddress,
        locationUrl: finalLocationUrl,
        latitude: finalLat,
        longitude: finalLng,
        routeId: vendor.routeId || currentUser?.routeId || undefined,
        routeName: vendor.routeName || vendor.area || currentUser?.routeName || currentUser?.area || undefined,
        items: [...items],
        subtotal,
        tax,
        discount: 0,
        totalAmount,
        advanceAdjusted,
        finalBillAmount,
        status: 'PENDING',
        preferredPaymentMode: effectivePaymentMode,
        paidAmount,
        balanceDue,
        orderDate: new Date().toISOString(),
        deliveryDate: new Date().toISOString().split('T')[0],
        notes: notes.trim() || '',
        pendingAdminOverride: pendingAdminOverrideLocal || undefined,
      });

      // Clear cart and show order placed success screen
      clearCart();
      setLoading(false);
      setPlacedOrder(newOrder);
    } catch (err: any) {
      console.error('Checkout place order error:', err);
      setErrorMsg(getFriendlyErrorMessage(err, 'Failed to place order. Please try again.'));
      setLoading(false);
    }
  };

  // ── 1. Order Success Screen View ──────────────────────────────────────────
  if (placedOrder) {
    const itemCount = placedOrder.items.reduce((s, i) => s + i.orderedQty, 0);

    const handleGoToDashboard = () => {
      try {
        navigation.popToTop();
      } catch {
        // fallback
      }
      navigation.navigate('VendorDashboardTab');
    };

    const handleViewOrderDetails = () => {
      navigation.replace('VendorOrderDetail', { orderId: placedOrder.id });
    };

    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Order Confirmed"
          subtitle={`Order #${placedOrder.orderNumber || placedOrder.id}`}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Success Banner Hero */}
          <View style={styles.successHero}>
            <View style={styles.successIconOuter}>
              <View style={styles.successIconInner}>
                <Ionicons name="checkmark-sharp" size={44} color={colors.statusDeliveredText} />
              </View>
            </View>
            <Text style={styles.successTitle}>Order Placed Successfully!</Text>
            <Text style={styles.successSubtitle}>
              Thank you for your order. We have received your wholesale request and queued it for dispatch.
            </Text>
          </View>

          {/* Order Details Summary Card */}
          <Card style={styles.card} outlined elevation="sm">
            <View style={styles.orderSummaryHeader}>
              <View>
                <Text style={styles.orderNumberLabel}>ORDER REFERENCE</Text>
                <Text style={styles.orderNumberValue}>#{placedOrder.orderNumber || placedOrder.id}</Text>
              </View>
              <View style={styles.statusBadgePending}>
                <Ionicons name="time-outline" size={13} color={colors.statusPendingText} />
                <Text style={styles.statusBadgeText}>Pending Confirmation</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Date</Text>
              <Text style={styles.infoVal}>{formatDate(placedOrder.orderDate)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expected Delivery</Text>
              <Text style={styles.infoVal}>{formatDate(placedOrder.deliveryDate)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Ordered Items</Text>
              <Text style={styles.infoVal}>{itemCount} Units ({placedOrder.items.length} SKUs)</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Mode</Text>
              <Text style={styles.infoVal}>{PAYMENT_METHOD_LABELS[placedOrder.preferredPaymentMode] || placedOrder.preferredPaymentMode}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Address</Text>
              <Text style={styles.infoVal} numberOfLines={1}>{placedOrder.address}</Text>
            </View>

            {(placedOrder.locationUrl || (placedOrder.latitude && placedOrder.longitude)) ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Google Maps Pin</Text>
                <TouchableOpacity
                  onPress={() => openGoogleMapsView({
                    latitude: placedOrder.latitude,
                    longitude: placedOrder.longitude,
                    locationUrl: placedOrder.locationUrl,
                    address: placedOrder.address,
                    shopName: placedOrder.shopName,
                  })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="location" size={14} color={colors.brandGreen} />
                  <Text style={[styles.infoVal, { color: colors.primary, fontWeight: '600' }]}>View Pin</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {placedOrder.advanceAdjusted && placedOrder.advanceAdjusted > 0 ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Order Value</Text>
                  <Text style={styles.infoVal}>
                    ₹{placedOrder.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.brandGreen, fontWeight: '700' }]}>
                    Advance Adjusted
                  </Text>
                  <Text style={[styles.infoVal, { color: colors.brandGreen, fontWeight: '700' }]}>
                    - ₹{placedOrder.advanceAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>
                  {placedOrder.advanceAdjusted ? 'Final Bill Amount' : 'Total Amount'}
                </Text>
                <Text style={styles.totalSub}>
                  {placedOrder.advanceAdjusted ? 'Remaining payable amount' : 'Final Order Amount'}
                </Text>
              </View>
              <Text style={styles.totalVal}>
                ₹{(placedOrder.finalBillAmount !== undefined ? placedOrder.finalBillAmount : Math.max(0, placedOrder.totalAmount - (placedOrder.advanceAdjusted || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>

          <View style={{ height: spacing.lg }} />
        </ScrollView>

        {/* Success Action Buttons */}
        <View style={styles.successFooterContainer}>
          <Button
            title="Go to Dashboard"
            onPress={handleGoToDashboard}
            size="lg"
            icon={<Ionicons name="home-outline" size={18} color={colors.textInverse} />}
          />
          <Button
            title="View Order Details"
            variant="outline"
            onPress={handleViewOrderDetails}
            size="lg"
            style={styles.viewOrderBtn}
            icon={<Ionicons name="receipt-outline" size={18} color={colors.primary} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── 2. Empty Cart Guard View ──────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Payment & Checkout"
          subtitle="Finalize Wholesale Order"
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="cart-outline"
            title="Your Order Cart is Empty"
            description="You do not have any items ready for checkout. Please add products from the catalog to place an order."
            actionTitle="Browse Product Catalog"
            onAction={() => navigation.navigate('ProductCatalogTab')}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── 3. Active Checkout Form View ──────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Payment & Checkout"
        subtitle={`${items.length} Items · ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Order Items Summary Card */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.orderSummaryHeader}>
            <Text style={styles.cardTitle}>ORDER ITEMS ({items.length})</Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.editCartLink}>Edit Cart</Text>
            </TouchableOpacity>
          </View>

          {items.map((item) => (
            <View key={item.productId} style={styles.cartPreviewRow}>
              <View style={styles.cartPreviewLeft}>
                <Text style={styles.cartPreviewName} numberOfLines={1}>
                  {item.productName}
                </Text>
                <Text style={styles.cartPreviewUnit}>
                  {item.orderedQty} × ₹{item.unitPrice.toLocaleString('en-IN')} / {item.unit}
                </Text>
              </View>
              <Text style={styles.cartPreviewTotal}>
                ₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </Card>

        {/* Delivery Address & Google Maps Location Card */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.orderSummaryHeader}>
            <Text style={styles.cardTitle}>DELIVERY LOCATION & MAP PIN</Text>
            <TouchableOpacity
              onPress={() => setShowLocationEditor(!showLocationEditor)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.editCartLink}>
                {showLocationEditor ? 'Done Editing' : 'Change / Pin on Map'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.locationSummaryBox}>
            <View style={styles.locationHeaderRow}>
              <Ionicons name="location-sharp" size={20} color={colors.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: spacing.xs }}>
                <Text style={styles.deliveryShopName}>{vendor.shopName}</Text>
                <Text style={styles.deliveryAddressText}>{deliveryAddress}</Text>
              </View>
            </View>

            {(latitude && longitude) || locationUrl ? (
              <View style={styles.mapPinBadgeRow}>
                <View style={styles.mapPinBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.brandGreen} />
                  <Text style={styles.mapPinBadgeText}>Google Maps Pin Linked</Text>
                </View>
                <TouchableOpacity
                  onPress={() => openGoogleMapsView({
                    latitude,
                    longitude,
                    locationUrl,
                    address: deliveryAddress,
                    shopName: vendor.shopName,
                  })}
                  style={styles.testPinLink}
                  activeOpacity={0.7}
                >
                  <Ionicons name="eye-outline" size={13} color={colors.primary} />
                  <Text style={styles.testPinLinkText}>Preview Pin</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mapPinBadgeWarn}>
                <Ionicons name="alert-circle-outline" size={14} color="#D97706" />
                <Text style={styles.mapPinBadgeWarnText}>
                  No Google Maps pin attached. Tap &quot;Change / Pin on Map&quot; to set your exact location for the delivery executive.
                </Text>
              </View>
            )}
          </View>

          {showLocationEditor && (
            <View style={{ marginTop: spacing.sm }}>
              <GoogleMapsLocationPicker
                locationUrl={locationUrl}
                latitude={latitude}
                longitude={longitude}
                address={deliveryAddress}
                shopName={vendor.shopName}
                editable={true}
                onChangeLocation={(locData) => {
                  setLocationUrl(locData.locationUrl);
                  setLatitude(locData.latitude);
                  setLongitude(locData.longitude);
                }}
              />
            </View>
          )}
        </Card>

        {/* Advance Balance Available & Applied Card */}
        {hasAdvance && (
          <Card style={[styles.card, styles.advanceCard]} outlined elevation="sm">
            <View style={styles.advanceHeaderRow}>
              <View style={styles.advanceIconCircle}>
                <Ionicons name="wallet" size={20} color={colors.brandGreen} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.advanceCardTitle}>ADVANCE BALANCE APPLIED</Text>
                <Text style={styles.advanceCardSub}>
                  Total Available: ₹{advanceBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.advanceBadge}>
                <Text style={styles.advanceBadgeText}>
                  -₹{advanceAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <View style={styles.advanceDivider} />

            <View style={styles.advanceDetailRow}>
              <Text style={styles.advanceDetailLabel}>Advance Adjusted:</Text>
              <Text style={[styles.advanceDetailVal, { color: colors.brandGreen }]}>
                -₹{advanceAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.advanceDetailRow}>
              <Text style={styles.advanceDetailLabel}>Remaining Advance after this order:</Text>
              <Text style={[styles.advanceDetailVal, { color: colors.textPrimary }]}>
                ₹{remainingAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {isFullyCoveredByAdvance && (
              <View style={styles.fullyCoveredNotice}>
                <Ionicons name="checkmark-circle" size={16} color={colors.brandGreen} />
                <Text style={styles.fullyCoveredText}>
                  This order is 100% covered by your advance balance! No extra payment required.
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Payment Preferences Section */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>
            {isFullyCoveredByAdvance
              ? 'PAYMENT STATUS'
              : hasAdvance
              ? `PAY REMAINING BILL (₹${finalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
              : 'SELECT PAYMENT METHOD'}
          </Text>

          {isFullyCoveredByAdvance ? (
            <View style={styles.advancePaidBanner}>
              <Ionicons name="shield-checkmark" size={22} color={colors.brandGreen} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.advancePaidTitle}>Pre-Paid with Advance</Text>
                <Text style={styles.advancePaidSub}>
                  The entire bill of ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} will be deducted from your advance balance upon delivery.
                </Text>
              </View>
            </View>
          ) : (
            (['PAY_LATER', 'CASH', 'ONLINE'] as PaymentMethod[]).map((mode) => {
              const isSelected = selectedPaymentMode === mode;

              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.paymentOption,
                    isSelected ? styles.paymentOptionSelected : null,
                  ]}
                  onPress={() => setSelectedPaymentMode(mode)}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioCircle}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>

                  <View style={styles.paymentCol}>
                    <Text style={styles.paymentName}>
                      {PAYMENT_METHOD_LABELS[mode]}
                    </Text>
                    {mode === 'PAY_LATER' && (
                      <Text style={styles.paymentSubtext}>
                        Add remaining ₹{finalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} to Khata balance.
                      </Text>
                    )}
                    {mode === 'CASH' && (
                      <Text style={styles.paymentSubtext}>
                        Pay remaining ₹{finalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} in cash at delivery.
                      </Text>
                    )}
                    {mode === 'ONLINE' && (
                      <Text style={styles.paymentSubtext}>
                        Pay remaining ₹{finalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} via UPI / Online.
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </Card>

        {/* Bill Summary Breakdown */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>BILL BREAKDOWN</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Units</Text>
            <Text style={styles.infoVal}>{totalUnits} Units</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subtotal</Text>
            <Text style={styles.infoVal}>
              ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {tax > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>GST / Tax</Text>
              <Text style={styles.infoVal}>
                ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Order Value</Text>
            <Text style={styles.infoVal}>
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {hasAdvance && (
            <View style={[styles.infoRow, { backgroundColor: '#F0FDF4', marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, paddingVertical: 4, marginVertical: 2 }]}>
              <Text style={[styles.infoLabel, { color: colors.brandGreen, fontWeight: '700' }]}>
                Advance Adjusted
              </Text>
              <Text style={[styles.infoVal, { color: colors.brandGreen, fontWeight: '700' }]}>
                - ₹{advanceAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Final Bill Amount</Text>
              <Text style={styles.totalSub}>
                {hasAdvance ? 'Net payable after advance adjustment' : 'Final payable amount'}
              </Text>
            </View>
            <Text style={styles.totalVal}>
              ₹{finalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </Card>

        {creditWarning ? (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.statusPendingText} />
            <Text style={styles.warningBannerText}>{creditWarning}</Text>
          </View>
        ) : null}

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={{ height: spacing.lg }} />
      </ScrollView>

      {/* Place Order CTA Button */}
      <View style={styles.footerContainer}>
        <Button
          title={
            isFullyCoveredByAdvance
              ? 'Confirm & Place Order (Paid by Advance)'
              : `Confirm & Place Order  ₹${finalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          }
          onPress={handlePlaceOrder}
          loading={loading}
          disabled={loading || items.length === 0 || totalAmount <= 0}
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    padding: spacing.screenPadding,
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.screenPadding,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  editCartLink: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  cartPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cartPreviewLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cartPreviewName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  cartPreviewUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  cartPreviewTotal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accentLight,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  paymentCol: {
    flex: 1,
  },
  paymentName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  paymentSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  totalLabel: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  totalSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  totalVal: {
    ...typography.currencyLarge,
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.captionBold,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.statusPendingBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  warningBannerText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  footerContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // ── Success View Styles ───────────────────────────────────────────
  successHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  successIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#DCFCE7', // emerald light tint
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successIconInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 320,
  },
  orderSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderNumberLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  orderNumberValue: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 16,
    marginTop: 2,
  },
  statusBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.statusPendingBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
  },
  statusBadgeText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    fontSize: 11,
  },
  deliveryShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  deliveryShopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  deliveryAddressText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  deliveryContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryPhoneText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  locationSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: spacing.xs,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  mapPinBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  mapPinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mapPinBadgeText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 11,
  },
  testPinLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  testPinLinkText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  mapPinBadgeWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 4,
  },
  mapPinBadgeWarnText: {
    ...typography.caption,
    color: '#92400E',
    fontSize: 11,
    flex: 1,
  },
  successFooterContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  viewOrderBtn: {
    marginTop: 2,
  },
  // ── Advance Card Styles ──────────────────────────────────────────
  advanceCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1.5,
  },
  advanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advanceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceCardTitle: {
    ...typography.captionBold,
    color: '#15803D',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  advanceCardSub: {
    ...typography.caption,
    color: '#166534',
    fontSize: 11,
    marginTop: 1,
  },
  advanceBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  advanceBadgeText: {
    ...typography.bodyBold,
    color: '#15803D',
    fontSize: 13,
  },
  advanceDivider: {
    height: 1,
    backgroundColor: '#DCFCE7',
    marginVertical: spacing.sm,
  },
  advanceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  advanceDetailLabel: {
    ...typography.caption,
    color: '#14532D',
    fontSize: 12,
  },
  advanceDetailVal: {
    ...typography.bodyBold,
    fontSize: 12,
  },
  fullyCoveredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.sm,
  },
  fullyCoveredText: {
    ...typography.bodyBold,
    color: '#15803D',
    fontSize: 12,
    flex: 1,
  },
  advancePaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  advancePaidTitle: {
    ...typography.bodyBold,
    color: '#15803D',
    fontSize: 13,
  },
  advancePaidSub: {
    ...typography.caption,
    color: '#166534',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});

