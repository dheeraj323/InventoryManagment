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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSupplierBillStore } from '../../store/useSupplierBillStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { SupplierBillItem, BillPaymentStatus } from '../../types';
import { colors, typography, spacing } from '../../theme';

import { compressBillImage, formatFileSize } from '../../utils/compressImage';

interface AttachmentState {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  originalSize?: number;
  savedPercentage?: number;
  wasCompressed?: boolean;
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
  const [invoiceNumber, setInvoiceNumber] = useState(
    `INV-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<BillPaymentStatus>('PAID');
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');

  // Items State
  const [items, setItems] = useState<SupplierBillItem[]>([
    {
      productName: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
      amount: 0,
    },
  ]);

  // Attachment & Compression State
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressMessage, setCompressMessage] = useState('');

  // Modals & Progress
  const [showProductSelectModal, setShowProductSelectModal] = useState<number | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStepText, setSaveStepText] = useState('');

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const taxAmount = useMemo(() => {
    const val = parseFloat(tax);
    return isNaN(val) ? 0 : val;
  }, [tax]);

  const discountAmount = useMemo(() => {
    const val = parseFloat(discount);
    return isNaN(val) ? 0 : val;
  }, [discount]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal + taxAmount - discountAmount);
  }, [subtotal, taxAmount, discountAmount]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Line item manipulation
  const updateItem = (index: number, updates: Partial<SupplierBillItem>) => {
    setItems((prev) => {
      const next = [...prev];
      const curr = { ...next[index], ...updates };
      const q = Number(curr.quantity) || 0;
      const r = Number(curr.unitPrice) || 0;
      curr.amount = Math.round(q * r * 100) / 100;
      next[index] = curr;
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productName: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      Alert.alert('Notice', 'A bill must have at least one product item');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const selectCatalogProduct = (index: number, prod: any) => {
    updateItem(index, {
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit || 'pcs',
      unitPrice: prod.price || 0,
      amount: (Number(items[index].quantity) || 1) * (prod.price || 0),
    });
    setShowProductSelectModal(null);
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

  // Attachment Pickers
  const pickFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera access is required to capture bill photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1.0, // Capture at full quality then optimize adaptively
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

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const doc = result.assets[0];
        await processAndSetAttachment(
          doc.uri,
          doc.name || `bill_doc_${Date.now()}.pdf`,
          doc.mimeType || 'application/pdf',
          doc.size
        );
      }
    } catch (err: any) {
      Alert.alert('Document Error', err.message || 'Unable to pick document');
    }
  };


  const validateForm = () => {
    if (!invoiceNumber.trim()) {
      Alert.alert('Validation', 'Invoice number is required');
      return false;
    }
    if (!billDate.trim()) {
      Alert.alert('Validation', 'Bill date is required');
      return false;
    }
    if (items.length === 0) {
      Alert.alert('Validation', 'Please add at least one product item');
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productName.trim()) {
        Alert.alert('Validation', `Please enter a name for product #${i + 1}`);
        return false;
      }
      if (Number(it.quantity) <= 0) {
        Alert.alert('Validation', `Quantity for "${it.productName}" must be greater than 0`);
        return false;
      }
      if (Number(it.unitPrice) < 0) {
        Alert.alert('Validation', `Price for "${it.productName}" cannot be negative`);
        return false;
      }
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

      // 2. Save bill record to Firestore
      setSaveStepText('Saving bill and recording audit trail in Firestore...');
      const createdBill = await createBill(
        supplierId,
        {
          supplierId,
          supplierName: supplier.name,
          userId: currentUser?.id || currentUser?.uid || 'admin',
          createdByName: currentUser?.name || 'Admin',
          invoiceNumber: invoiceNumber.trim(),
          billDate: billDate.trim(),
          subtotal,
          tax: taxAmount,
          discount: discountAmount,
          totalAmount,
          paymentStatus,
          paidAmount: paymentStatus === 'PAID' ? totalAmount : 0,
          cloudinaryUrl,
          cloudinaryPublicId,
          fileName,
          fileType,
          fileSize,
          notes: notes.trim(),
          items,
        },
        {
          uid: currentUser?.id || currentUser?.uid || 'admin',
          name: currentUser?.name || 'Admin',
        }
      );

      setShowSummaryModal(false);
      Alert.alert(
        'Bill Recorded Successfully',
        `Invoice #${createdBill.invoiceNumber} (₹${fmt(createdBill.totalAmount)}) has been saved to ${supplier.name}'s purchase history.`,
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

          {/* ── 1. Basic Bill Metadata ──────────────────────────────── */}
          <Text style={styles.sectionTitle}>INVOICE DETAILS</Text>
          <View style={styles.metaRow}>
            <View style={{ flex: 1, marginRight: spacing.xs }}>
              <Input
                label="Invoice Number *"
                placeholder="e.g. INV-1025"
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
              />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.xs }}>
              <Input
                label="Bill Date (YYYY-MM-DD) *"
                placeholder="YYYY-MM-DD"
                value={billDate}
                onChangeText={setBillDate}
              />
            </View>
          </View>

          {/* ── 2. Products Line Items ──────────────────────────────── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>PURCHASED PRODUCTS ({items.length})</Text>
            <TouchableOpacity onPress={addItemRow} style={styles.addItemBtn}>
              <Ionicons name="add-circle" size={16} color={colors.primary} />
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, idx) => (
            <Card key={idx} style={styles.itemCard} outlined>
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemIndexLabel}>Item #{idx + 1}</Text>
                <View style={styles.itemHeaderActions}>
                  <TouchableOpacity
                    style={styles.catalogSelectBtn}
                    onPress={() => setShowProductSelectModal(idx)}
                  >
                    <Ionicons name="list-outline" size={14} color={colors.primary} />
                    <Text style={styles.catalogSelectText}>Select From Catalog</Text>
                  </TouchableOpacity>

                  {items.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeItemRow(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginLeft: spacing.sm }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Input
                label="Product Name *"
                placeholder="e.g. Cement, Steel, Bricks..."
                value={item.productName}
                onChangeText={(text) => updateItem(idx, { productName: text })}
                containerStyle={{ marginBottom: spacing.xs }}
              />

              <View style={styles.itemInputsRow}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <Input
                    label="Qty *"
                    keyboardType="numeric"
                    placeholder="1"
                    value={item.quantity.toString()}
                    onChangeText={(val) => updateItem(idx, { quantity: parseFloat(val) || 0 })}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>

                <View style={{ flex: 1, marginHorizontal: spacing.xs }}>
                  <Input
                    label="Unit"
                    placeholder="bags/kg/box"
                    value={item.unit}
                    onChangeText={(val) => updateItem(idx, { unit: val })}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>

                <View style={{ flex: 1.2, marginLeft: spacing.xs }}>
                  <Input
                    label="Rate (₹) *"
                    keyboardType="numeric"
                    prefix="₹"
                    placeholder="0"
                    value={item.unitPrice.toString()}
                    onChangeText={(val) => updateItem(idx, { unitPrice: parseFloat(val) || 0 })}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              </View>

              <View style={styles.itemTotalRow}>
                <Text style={styles.itemTotalLabel}>Line Total:</Text>
                <Text style={styles.itemTotalValue}>₹{fmt(item.amount)}</Text>
              </View>
            </Card>
          ))}

          {/* ── 3. Financial Totals ──────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>BILL TOTALS & TAX</Text>
          <Card style={styles.calcCard} outlined>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Subtotal ({items.length} items)</Text>
              <Text style={styles.calcValue}>₹{fmt(subtotal)}</Text>
            </View>

            <View style={styles.calcInputRow}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <Input
                  label="Tax Amount (₹)"
                  keyboardType="numeric"
                  prefix="₹"
                  value={tax}
                  onChangeText={setTax}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.xs }}>
                <Input
                  label="Discount (₹)"
                  keyboardType="numeric"
                  prefix="₹"
                  value={discount}
                  onChangeText={setDiscount}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
            </View>

            <View style={[styles.calcRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>TOTAL AMOUNT</Text>
              <Text style={styles.grandTotalValue}>₹{fmt(totalAmount)}</Text>
            </View>
          </Card>

          {/* ── 4. Payment Status Selection ─────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>PAYMENT STATUS</Text>
          <View style={styles.paymentStatusToggleRow}>
            <TouchableOpacity
              style={[
                styles.statusOptionBtn,
                paymentStatus === 'PAID' && styles.statusOptionPaidActive,
              ]}
              onPress={() => setPaymentStatus('PAID')}
            >
              <Ionicons
                name={paymentStatus === 'PAID' ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={paymentStatus === 'PAID' ? colors.brandGreen : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.statusOptionTitle,
                    paymentStatus === 'PAID' && { color: colors.brandGreen },
                  ]}
                >
                  Fully Paid
                </Text>
                <Text style={styles.statusOptionSub}>
                  Paid at purchase (No payable added)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusOptionBtn,
                paymentStatus === 'PENDING' && styles.statusOptionPendingActive,
              ]}
              onPress={() => setPaymentStatus('PENDING')}
            >
              <Ionicons
                name={paymentStatus === 'PENDING' ? 'alert-circle' : 'ellipse-outline'}
                size={18}
                color={paymentStatus === 'PENDING' ? colors.debit : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.statusOptionTitle,
                    paymentStatus === 'PENDING' && { color: colors.debit },
                  ]}
                >
                  Unpaid (On Credit)
                </Text>
                <Text style={styles.statusOptionSub}>
                  Increases supplier payable balance by ₹{fmt(totalAmount)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── 5. Bill Attachment ──────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
            BILL ATTACHMENT (CLOUDINARY)
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
                {attachment.mimeType.startsWith('image') ? (
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />
                ) : (
                  <View style={styles.attachmentPdfIcon}>
                    <Ionicons name="document-text" size={24} color={colors.primary} />
                  </View>
                )}

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

              <TouchableOpacity
                style={styles.pickerTile}
                onPress={pickDocument}
                activeOpacity={0.7}
              >
                <Ionicons name="document-attach-outline" size={24} color={colors.primary} />
                <Text style={styles.pickerTileText}>PDF / Document</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── 6. Notes ────────────────────────────────────────────── */}
          <Input
            label="Notes / Purchase Remarks (Optional)"
            placeholder="e.g. September monthly material purchase"
            value={notes}
            onChangeText={setNotes}
            containerStyle={{ marginTop: spacing.md }}
          />

          {/* Save Button */}
          <Button
            title={`REVIEW & SAVE BILL (₹${fmt(totalAmount)})`}
            onPress={handleReviewBill}
            style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── PRODUCT SELECT MODAL (FROM CATALOG) ────────────────────── */}
      <Modal
        visible={showProductSelectModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductSelectModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Catalog Product</Text>
              <TouchableOpacity onPress={() => setShowProductSelectModal(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              {products.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.productOptionRow}
                  onPress={() => {
                    if (showProductSelectModal !== null) {
                      selectCatalogProduct(showProductSelectModal, p);
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productOptionName}>{p.name}</Text>
                    <Text style={styles.productOptionSub}>
                      Unit: {p.unit} · Stock: {p.stockQty}
                    </Text>
                  </View>
                  <Text style={styles.productOptionPrice}>₹{fmt(p.price)}</Text>
                </TouchableOpacity>
              ))}

              {products.length === 0 && (
                <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>
                    No products in catalog
                  </Text>
                </View>
              )}
            </ScrollView>
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

            <View style={styles.summaryInfoBox}>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Supplier:</Text>
                <Text style={styles.summaryDetailValue}>{supplier?.name}</Text>
              </View>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Invoice Number:</Text>
                <Text style={styles.summaryDetailValue}>#{invoiceNumber}</Text>
              </View>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Date:</Text>
                <Text style={styles.summaryDetailValue}>{billDate}</Text>
              </View>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Payment Status:</Text>
                <Text
                  style={[
                    styles.summaryDetailValue,
                    {
                      color:
                        paymentStatus === 'PAID' ? colors.brandGreen : colors.debit,
                    },
                  ]}
                >
                  {paymentStatus === 'PAID' ? 'Fully Paid' : 'Unpaid (On Credit)'}
                </Text>
              </View>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Products Count:</Text>
                <Text style={styles.summaryDetailValue}>{items.length} line items</Text>
              </View>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Attachment:</Text>
                <Text style={styles.summaryDetailValue}>
                  {attachment ? attachment.name : 'No file attached'}
                </Text>
              </View>

              <View style={styles.summaryTotalRow}>
                <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
                <Text style={styles.summaryTotalValue}>₹{fmt(totalAmount)}</Text>
              </View>
            </View>

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
  metaRow: {
    flexDirection: 'row',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },

  // Line item card
  itemCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  itemIndexLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  itemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catalogSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
  },
  catalogSelectText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 10.5,
  },
  itemInputsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  itemTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 6,
  },
  itemTotalLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  itemTotalValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },

  // Calculations
  calcCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  calcLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12.5,
  },
  calcValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13.5,
  },
  calcInputRow: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
  },
  grandTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grandTotalLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  grandTotalValue: {
    ...typography.hero,
    fontSize: 18,
    color: colors.primary,
  },

  // Payment Status Toggle
  paymentStatusToggleRow: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statusOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: spacing.sm,
  },
  statusOptionPaidActive: {
    backgroundColor: colors.brandGreenLight,
    borderColor: colors.brandGreen,
  },
  statusOptionPendingActive: {
    backgroundColor: colors.debitLight,
    borderColor: colors.debit,
  },
  statusOptionTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  statusOptionSub: {
    ...typography.caption,
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Attachment
  attachmentPickerGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  pickerTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 4,
  },
  pickerTileText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
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
  attachmentPdfIcon: {
    width: 44,
    height: 44,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  productOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  productOptionName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  productOptionSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  productOptionPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
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
