import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSupplierBillStore } from '../../store/useSupplierBillStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { colors, typography, spacing } from '../../theme';
import { compressBillImage, formatFileSize } from '../../utils/compressImage';
import { SupplierBillItem } from '../../types';

interface AttachmentState {
  uri: string;
  name: string;
  mimeType: string;
  base64?: string;
  size?: number;
  originalSize?: number;
  savedPercentage?: number;
  wasCompressed?: boolean;
}

interface SelectedProduct {
  productId: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

export const AddSupplierBillScreen: React.FC<{ route: any; navigation: any }> = ({ navigation, route }) => {
  const { supplierId } = route.params || {};

  const { suppliers, products } = useInventoryStore();
  const { currentUser } = useAuthStore();
  const { createBill, uploadToCloudinary } = useSupplierBillStore();

  const supplier = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId || s.supplierId === supplierId);
  }, [suppliers, supplierId]);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalBillAmount, setTotalBillAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING'>('PAID');

  // Selected products
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Attachment & Compression State
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressMessage, setCompressMessage] = useState('');

  // Modals & Progress
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStepText, setSaveStepText] = useState('');

  const parsedTotalAmount = useMemo(() => {
    const val = parseFloat(totalBillAmount);
    return isNaN(val) ? 0 : val;
  }, [totalBillAmount]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered products for the selection modal
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const alreadySelectedIds = new Set(selectedProducts.map((sp) => sp.productId));
    let list = products.filter((p) => !alreadySelectedIds.has(p.id));
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, productSearch, selectedProducts]);

  // Add product to selected list
  const handleSelectProduct = (product: { id: string; name: string; unit: string; purchasePrice?: number; price?: number }) => {
    setSelectedProducts((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        unit: product.unit || 'unit',
        quantity: '1',
        unitPrice: String(product.purchasePrice || product.price || 0),
      },
    ]);
    setShowProductModal(false);
    setProductSearch('');
  };

  // Remove product from selected list
  const handleRemoveProduct = (index: number) => {
    setSelectedProducts((prev) => prev.filter((_, i) => i !== index));
  };

  // Update product quantity
  const handleUpdateProductQty = (index: number, qty: string) => {
    setSelectedProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, quantity: qty } : p))
    );
  };

  // Update product unit price
  const handleUpdateProductPrice = (index: number, price: string) => {
    setSelectedProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, unitPrice: price } : p))
    );
  };

  /**
   * Processes chosen attachment with client-side compression before staging
   */
  const processAndSetAttachment = async (
    rawUri: string,
    rawName: string,
    rawMimeType: string,
    rawSize?: number
  ) => {
    setIsCompressing(true);
    setCompressMessage('Compressing & optimizing bill image...');

    try {
      const compressed = await compressBillImage(rawUri, rawName, rawMimeType, rawSize);
      setAttachment({
        uri: compressed.uri,
        name: compressed.name,
        mimeType: compressed.mimeType,
        base64: compressed.base64,
        size: compressed.compressedSize,
        originalSize: compressed.originalSize,
        savedPercentage: compressed.savedPercentage,
        wasCompressed: compressed.wasCompressed,
      });
    } catch (err: any) {
      console.warn('Compression error, falling back to original:', err);
      setAttachment({
        uri: rawUri,
        name: rawName,
        mimeType: rawMimeType,
        size: rawSize,
        wasCompressed: false,
      });
    } finally {
      setIsCompressing(false);
      setCompressMessage('');
    }
  };

  // Attachment Pickers (Images Only - Camera and Gallery)
  const pickFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera access is required to capture bill photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1.0,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processAndSetAttachment(
          asset.uri,
          asset.fileName || `bill_cam_${Date.now()}.jpg`,
          asset.mimeType || 'image/jpeg',
          asset.fileSize
        );
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Unable to open camera');
    }
  };

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Gallery access is required to select bill photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1.0,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processAndSetAttachment(
          asset.uri,
          asset.fileName || `bill_gallery_${Date.now()}.jpg`,
          asset.mimeType || 'image/jpeg',
          asset.fileSize
        );
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Unable to select photo');
    }
  };

  const validateForm = () => {
    if (!billDate.trim()) {
      Alert.alert('Validation', 'Bill date is required');
      return false;
    }
    if (!totalBillAmount.trim() || isNaN(parseFloat(totalBillAmount)) || parseFloat(totalBillAmount) <= 0) {
      Alert.alert('Validation', 'Please enter a valid total bill amount greater than 0');
      return false;
    }
    return true;
  };

  const handleReviewBill = () => {
    if (validateForm()) {
      setShowSummaryModal(true);
    }
  };

  const handleSaveBill = async () => {
    if (!supplier) return;
    setIsSaving(true);
    setSaveStepText('Preparing bill...');

    try {
      let cloudinaryUrl = '';
      let cloudinaryPublicId = '';
      let fileName = '';
      let fileType = '';
      let fileSize = 0;

      // 1. Upload attachment to Cloudinary if selected
      if (attachment) {
        setSaveStepText('Uploading bill attachment to Cloudinary...');
        const tempBillId = `bill_${Date.now()}`;
        const uploadResult = await uploadToCloudinary({
          uri: attachment.uri,
          base64: attachment.base64,
          fileName: attachment.name,
          fileType: attachment.mimeType,
          fileSize: attachment.size,
          userId: currentUser?.id || currentUser?.uid || 'admin',
          supplierId,
          billId: tempBillId,
        });

        cloudinaryUrl = uploadResult.secureUrl || uploadResult.url;
        cloudinaryPublicId = uploadResult.publicId;
        fileName = uploadResult.fileName;
        fileType = uploadResult.fileType;
        fileSize = uploadResult.fileSize;
      }

      // 2. Build items array from selected products
      const billItems: SupplierBillItem[] = selectedProducts.map((sp) => {
        const qty = parseFloat(sp.quantity) || 0;
        const price = parseFloat(sp.unitPrice) || 0;
        return {
          productId: sp.productId,
          productName: sp.productName,
          quantity: qty,
          unit: sp.unit,
          unitPrice: price,
          amount: qty * price,
        };
      });

      // 3. Save bill record to Firestore
      setSaveStepText('Saving bill and recording audit trail in Firestore...');
      const finalInvoiceNumber = invoiceNumber.trim() || `BILL-${Date.now().toString().slice(-6)}`;
      const createdBill = await createBill(
        supplierId,
        {
          supplierId,
          supplierName: supplier.name,
          userId: currentUser?.id || currentUser?.uid || 'admin',
          createdByName: currentUser?.name || 'Admin',
          invoiceNumber: finalInvoiceNumber,
          billDate: billDate.trim(),
          subtotal: parsedTotalAmount,
          tax: 0,
          discount: 0,
          totalAmount: parsedTotalAmount,
          paymentStatus,
          paidAmount: paymentStatus === 'PAID' ? parsedTotalAmount : 0,
          cloudinaryUrl,
          cloudinaryPublicId,
          fileName,
          fileType,
          fileSize,
          notes: '',
          items: billItems,
        },
        {
          uid: currentUser?.id || currentUser?.uid || 'admin',
          name: currentUser?.name || 'Admin',
        }
      );

      setShowSummaryModal(false);

      const statusMsg = paymentStatus === 'PAID'
        ? 'Payment status: PAID'
        : `Payment status: UNPAID — ₹${fmt(parsedTotalAmount)} added to outstanding payable.`;

      Alert.alert(
        'Bill Recorded Successfully',
        `Invoice #${createdBill.invoiceNumber} (₹${fmt(createdBill.totalAmount)}) has been saved to ${supplier.name}'s purchase history.\n\n${statusMsg}`,
        [
          {
            text: 'View Bill',
            onPress: () =>
              navigation.replace('SupplierBillDetail', {
                supplierId,
                billId: createdBill.id,
              }),
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      console.error('Save bill error:', err);
      Alert.alert('Save Failed', err.message || 'An error occurred while saving the bill');
    } finally {
      setIsSaving(false);
      setSaveStepText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Add Purchase Bill"
        subtitle={supplier?.name || 'New Supplier Invoice'}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Supplier Info Strip */}
          <Card style={styles.supplierCard} outlined>
            <View style={styles.supplierRow}>
              <View style={styles.supAvatar}>
                <Ionicons name="business" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supName}>{supplier?.name}</Text>
                <Text style={styles.supSub}>
                  {supplier?.contactPerson || 'Contact'} {supplier?.phone ? `· ${supplier?.phone}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.supPayableLabel}>Payable</Text>
                <Text style={styles.supPayableValue}>₹{fmt(supplier?.balancePayable || 0)}</Text>
              </View>
            </View>
          </Card>

          {/* ── Bill Details ────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>BILL DETAILS</Text>
          <Card style={styles.formCard} outlined>
            <Input
              label="Invoice Number (Optional)"
              placeholder="e.g. INV-1025"
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              containerStyle={{ marginBottom: spacing.sm }}
            />

            <Input
              label="Bill Date (YYYY-MM-DD) *"
              placeholder="YYYY-MM-DD"
              value={billDate}
              onChangeText={setBillDate}
              containerStyle={{ marginBottom: spacing.sm }}
            />

            <Input
              label="Total Bill Amount (₹) *"
              placeholder="0.00"
              keyboardType="numeric"
              prefix="₹"
              value={totalBillAmount}
              onChangeText={setTotalBillAmount}
              containerStyle={{ marginBottom: 0 }}
            />
          </Card>

          {/* ── Payment Status Toggle ──────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>PAYMENT STATUS</Text>
          <Card style={styles.formCard} outlined>
            <View style={styles.paymentToggleRow}>
              <TouchableOpacity
                style={[
                  styles.paymentToggleBtn,
                  paymentStatus === 'PAID' && styles.paymentToggleBtnActive,
                ]}
                onPress={() => setPaymentStatus('PAID')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={paymentStatus === 'PAID' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={paymentStatus === 'PAID' ? colors.brandGreen : colors.textMuted}
                />
                <Text
                  style={[
                    styles.paymentToggleText,
                    paymentStatus === 'PAID' && styles.paymentToggleTextActive,
                  ]}
                >
                  Paid
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentToggleBtn,
                  paymentStatus === 'PENDING' && styles.paymentToggleBtnUnpaid,
                ]}
                onPress={() => setPaymentStatus('PENDING')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={paymentStatus === 'PENDING' ? 'alert-circle' : 'ellipse-outline'}
                  size={18}
                  color={paymentStatus === 'PENDING' ? colors.debit : colors.textMuted}
                />
                <Text
                  style={[
                    styles.paymentToggleText,
                    paymentStatus === 'PENDING' && styles.paymentToggleTextUnpaid,
                  ]}
                >
                  Unpaid
                </Text>
              </TouchableOpacity>
            </View>

            {paymentStatus === 'PENDING' && parsedTotalAmount > 0 && (
              <View style={styles.unpaidWarningBox}>
                <Ionicons name="information-circle" size={15} color={colors.debit} />
                <Text style={styles.unpaidWarningText}>
                  ₹{fmt(parsedTotalAmount)} will be added to {supplier?.name}'s outstanding payable balance.
                </Text>
              </View>
            )}
          </Card>

          {/* ── Products Purchased ──────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
            PRODUCTS PURCHASED (Optional)
          </Text>

          {selectedProducts.map((sp, idx) => (
            <Card key={`selected-product-${sp.productId}-${idx}`} style={styles.selectedProductCard} outlined>
              <View style={styles.selectedProductHeader}>
                <View style={styles.selectedProductNameRow}>
                  <View style={styles.prodIconCircle}>
                    <Ionicons name="cube" size={14} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedProductName} numberOfLines={1}>
                      {sp.productName}
                    </Text>
                    <Text style={styles.selectedProductUnit}>{sp.unit}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveProduct(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.selectedProductFields}>
                <View style={styles.productFieldCol}>
                  <Text style={styles.productFieldLabel}>Quantity</Text>
                  <TextInput
                    style={styles.productFieldInput}
                    keyboardType="numeric"
                    value={sp.quantity}
                    onChangeText={(val) => handleUpdateProductQty(idx, val)}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.productFieldCol}>
                  <Text style={styles.productFieldLabel}>Unit Price (₹)</Text>
                  <TextInput
                    style={styles.productFieldInput}
                    keyboardType="numeric"
                    value={sp.unitPrice}
                    onChangeText={(val) => handleUpdateProductPrice(idx, val)}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.productFieldCol}>
                  <Text style={styles.productFieldLabel}>Amount</Text>
                  <Text style={styles.productAmountText}>
                    ₹{fmt((parseFloat(sp.quantity) || 0) * (parseFloat(sp.unitPrice) || 0))}
                  </Text>
                </View>
              </View>
            </Card>
          ))}

          <TouchableOpacity
            style={styles.addProductBtn}
            onPress={() => setShowProductModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addProductBtnText}>Add Product</Text>
          </TouchableOpacity>

          {/* ── Bill Attachment (Photos Only) ──────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
            ATTACH BILL PHOTO
          </Text>

          {isCompressing ? (
            <Card style={styles.compressingCard} outlined>
              <ActivityIndicator size="small" color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.compressingTitle}>{compressMessage}</Text>
                <Text style={styles.compressingSub}>
                  Optimizing file size while preserving razor-sharp text clarity
                </Text>
              </View>
            </Card>
          ) : attachment ? (
            <Card style={styles.attachmentPreviewCard} outlined>
              <View style={styles.attachmentPreviewRow}>
                <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />

                <View style={styles.attachmentMetaCol}>
                  <Text style={styles.attachmentFileName} numberOfLines={1}>
                    {attachment.name}
                  </Text>

                  {attachment.wasCompressed && attachment.originalSize ? (
                    <View>
                      <Text style={styles.compressionStatsText}>
                        Size: {formatFileSize(attachment.size)} (Original:{' '}
                        {formatFileSize(attachment.originalSize)} · Saved{' '}
                        {attachment.savedPercentage}%)
                      </Text>
                      <View style={styles.optimizedBadgeRow}>
                        <Ionicons name="checkmark-circle" size={11} color={colors.brandGreen} />
                        <Text style={styles.optimizedBadgeText}>
                          Optimized for clear invoice readability
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.attachmentFileSize}>
                      {formatFileSize(attachment.size)} · {attachment.mimeType}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setAttachment(null)}
                  style={styles.removeAttachmentBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          ) : (
            <View style={styles.attachmentPickerGrid}>
              <TouchableOpacity
                style={styles.pickerTile}
                onPress={pickFromCamera}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.pickerTileText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerTile}
                onPress={pickFromGallery}
                activeOpacity={0.7}
              >
                <Ionicons name="images-outline" size={24} color={colors.primary} />
                <Text style={styles.pickerTileText}>Photo Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Save Button */}
          <Button
            title={
              parsedTotalAmount > 0
                ? `REVIEW & SAVE BILL (₹${fmt(parsedTotalAmount)})`
                : 'REVIEW & SAVE BILL'
            }
            onPress={handleReviewBill}
            style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── PRODUCT SELECTION MODAL ─────────────────────────────────── */}
      <Modal
        visible={showProductModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.productModalOverlay}>
          <View style={styles.productModalSheet}>
            <View style={styles.productModalHeader}>
              <Text style={styles.productModalTitle}>Select Product</Text>
              <TouchableOpacity onPress={() => { setShowProductModal(false); setProductSearch(''); }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.productSearchBox}>
              <Ionicons name="search-outline" size={17} color={colors.textMuted} />
              <TextInput
                style={styles.productSearchInput}
                placeholder="Search products by name, SKU, category..."
                placeholderTextColor={colors.textMuted}
                value={productSearch}
                onChangeText={setProductSearch}
                autoFocus
              />
              {productSearch.length > 0 && (
                <TouchableOpacity onPress={() => setProductSearch('')}>
                  <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productListItem}
                  onPress={() => handleSelectProduct(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.prodIconCircle}>
                    <Ionicons name="cube" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productListName}>{item.name}</Text>
                    <Text style={styles.productListSub}>
                      {item.category} · {item.unit} · ₹{item.purchasePrice || item.price || 0}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.productListEmpty}>
                  <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.productListEmptyText}>
                    {productSearch ? 'No matching products found' : 'No products available'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ── BILL SUMMARY CONFIRMATION MODAL ───────────────────────── */}
      <Modal
        visible={showSummaryModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isSaving && setShowSummaryModal(false)}
      >
        <View style={styles.summaryModalOverlay}>
          <View style={styles.summaryModalCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="receipt" size={28} color={colors.primary} />
              <Text style={styles.summaryTitle}>Bill Summary</Text>
            </View>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryInfoBox}>
                <View style={styles.summaryDetailRow}>
                  <Text style={styles.summaryDetailLabel}>Supplier:</Text>
                  <Text style={styles.summaryDetailValue}>{supplier?.name}</Text>
                </View>
                <View style={styles.summaryDetailRow}>
                  <Text style={styles.summaryDetailLabel}>Invoice Number:</Text>
                  <Text style={styles.summaryDetailValue}>
                    {invoiceNumber.trim() ? `#${invoiceNumber.trim()}` : 'Auto-generated'}
                  </Text>
                </View>
                <View style={styles.summaryDetailRow}>
                  <Text style={styles.summaryDetailLabel}>Date:</Text>
                  <Text style={styles.summaryDetailValue}>{billDate}</Text>
                </View>
                <View style={styles.summaryDetailRow}>
                  <Text style={styles.summaryDetailLabel}>Payment Status:</Text>
                  <View
                    style={[
                      styles.summaryStatusPill,
                      paymentStatus === 'PAID'
                        ? { backgroundColor: '#E8F5E9' }
                        : { backgroundColor: '#FFF3E0' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.summaryStatusText,
                        paymentStatus === 'PAID'
                          ? { color: colors.brandGreen }
                          : { color: colors.debit },
                      ]}
                    >
                      {paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'}
                    </Text>
                  </View>
                </View>

                {selectedProducts.length > 0 && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={[styles.summaryDetailLabel, { marginBottom: 4 }]}>
                      Products ({selectedProducts.length}):
                    </Text>
                    {selectedProducts.map((sp, idx) => {
                      const qty = parseFloat(sp.quantity) || 0;
                      const price = parseFloat(sp.unitPrice) || 0;
                      return (
                        <Text key={`summary-prod-${idx}`} style={styles.summaryProductLine}>
                          • {sp.productName} — {qty} {sp.unit} × ₹{price} = ₹{fmt(qty * price)}
                        </Text>
                      );
                    })}
                  </View>
                )}

                <View style={styles.summaryDetailRow}>
                  <Text style={styles.summaryDetailLabel}>Attachment:</Text>
                  <Text style={styles.summaryDetailValue}>
                    {attachment ? attachment.name : 'No file attached'}
                  </Text>
                </View>

                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Total Bill Amount:</Text>
                  <Text style={styles.summaryTotalValue}>₹{fmt(parsedTotalAmount)}</Text>
                </View>

                {paymentStatus === 'PENDING' && (
                  <View style={[styles.unpaidWarningBox, { marginTop: spacing.sm }]}>
                    <Ionicons name="information-circle" size={14} color={colors.debit} />
                    <Text style={[styles.unpaidWarningText, { fontSize: 10.5 }]}>
                      This amount will be added to supplier's outstanding payable.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {isSaving ? (
              <View style={styles.savingProgressBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.savingProgressText}>{saveStepText}</Text>
              </View>
            ) : (
              <View style={styles.summaryActionsRow}>
                <Button
                  title="CANCEL"
                  variant="secondary"
                  onPress={() => setShowSummaryModal(false)}
                  style={{ flex: 1, marginRight: spacing.xs }}
                />
                <Button
                  title="SAVE BILL"
                  onPress={handleSaveBill}
                  style={{ flex: 1, marginLeft: spacing.xs }}
                />
              </View>
            )}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },
  supplierCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  supName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  supSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  supPayableLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 8.5,
  },
  supPayableValue: {
    ...typography.bodyBold,
    color: colors.debit,
    fontSize: 13,
  },

  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },

  formCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  // Payment Status Toggle
  paymentToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paymentToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  paymentToggleBtnActive: {
    borderColor: colors.brandGreen,
    backgroundColor: '#E8F5E9',
  },
  paymentToggleBtnUnpaid: {
    borderColor: colors.debit,
    backgroundColor: '#FFF3E0',
  },
  paymentToggleText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  paymentToggleTextActive: {
    color: colors.brandGreen,
  },
  paymentToggleTextUnpaid: {
    color: colors.debit,
  },
  unpaidWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: spacing.borderRadiusSm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 6,
  },
  unpaidWarningText: {
    ...typography.caption,
    color: colors.debit,
    fontSize: 11,
    flex: 1,
  },

  // Products
  selectedProductCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectedProductHeader: {
    marginBottom: spacing.xs,
  },
  selectedProductNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  prodIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedProductName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  selectedProductUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  selectedProductFields: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  productFieldCol: {
    flex: 1,
  },
  productFieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  productFieldInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusSm,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  productAmountText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    overflow: 'hidden',
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    gap: 6,
    marginBottom: spacing.sm,
  },
  addProductBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
  },

  // Product Selection Modal
  productModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  productModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusLg,
    borderTopRightRadius: spacing.borderRadiusLg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screenPadding,
    maxHeight: '75%',
  },
  productModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  productModalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  productSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  productSearchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    fontSize: 13,
    color: colors.textPrimary,
  },
  productListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  productListName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  productListSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  productListEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  productListEmptyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },

  // Attachment
  attachmentPickerGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickerTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 6,
  },
  pickerTileText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  attachmentPreviewCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  attachmentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentThumb: {
    width: 44,
    height: 44,
    borderRadius: spacing.borderRadiusSm,
    marginRight: spacing.sm,
  },
  attachmentMetaCol: {
    flex: 1,
  },
  attachmentFileName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 12.5,
  },
  attachmentFileSize: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  compressionStatsText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 10.5,
    marginTop: 1,
  },
  optimizedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  optimizedBadgeText: {
    ...typography.caption,
    color: colors.brandGreen,
    fontSize: 9.5,
    fontWeight: '600',
  },
  compressingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.primary,
  },
  compressingTitle: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  compressingSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  removeAttachmentBtn: {
    padding: spacing.xs,
  },

  // Summary Modal
  summaryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  summaryModalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    elevation: 6,
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 4,
  },
  summaryTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  summaryInfoBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryDetailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11.5,
  },
  summaryDetailValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 12,
    maxWidth: '60%',
    textAlign: 'right',
  },
  summaryStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  summaryStatusText: {
    ...typography.captionBold,
    fontSize: 10.5,
  },
  summaryProductLine: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryTotalLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  summaryTotalValue: {
    ...typography.hero,
    fontSize: 16,
    color: colors.primary,
  },
  savingProgressBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  savingProgressText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  summaryActionsRow: {
    flexDirection: 'row',
  },
});
