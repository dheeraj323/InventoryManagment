import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Linking,
  Platform,
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
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { SupplierBill, BillAuditRecord, BillPaymentStatus } from '../../types';
import { colors, typography, spacing } from '../../theme';
import { compressBillImage, formatFileSize } from '../../utils/compressImage';

export const SupplierBillDetailScreen: React.FC<{ route: any; navigation: any }> = ({ navigation, route }) => {
  const { supplierId, billId } = route.params || {};

  const { suppliers } = useInventoryStore();
  const { currentUser } = useAuthStore();
  const {
    bills,
    billHistory,
    subscribeSupplierBills,
    subscribeBillHistory,
    fetchBillDetails,
    updateBill,
    replaceAttachment,
    softDeleteBill,
    uploadToCloudinary,
  } = useSupplierBillStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceStepText, setReplaceStepText] = useState('Compressing & optimizing image...');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);


  // Edit Bill State
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editBillDate, setEditBillDate] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<BillPaymentStatus>('PAID');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Current Supplier & Bill
  const supplier = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId || s.supplierId === supplierId);
  }, [suppliers, supplierId]);

  const bill: SupplierBill | undefined = useMemo(() => {
    const list = bills[supplierId] || [];
    return list.find((b) => b.id === billId || b.billId === billId);
  }, [bills, supplierId, billId]);

  const history: BillAuditRecord[] = useMemo(() => {
    return billHistory[billId] || [];
  }, [billHistory, billId]);

  useEffect(() => {
    const unsubBills = subscribeSupplierBills(supplierId);
    const unsubHistory = subscribeBillHistory(supplierId, billId);

    fetchBillDetails(supplierId, billId);

    return () => {
      unsubBills();
      unsubHistory();
    };
  }, [supplierId, billId]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const openEditModal = () => {
    if (!bill) return;
    setEditInvoiceNumber(bill.invoiceNumber);
    setEditBillDate(bill.billDate);
    setEditPaymentStatus(bill.paymentStatus);
    setEditNotes(bill.notes || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!bill) return;
    if (!editInvoiceNumber.trim()) {
      Alert.alert('Validation', 'Invoice number cannot be empty');
      return;
    }
    setEditLoading(true);

    try {
      const changes: string[] = [];
      if (editInvoiceNumber.trim() !== bill.invoiceNumber) {
        changes.push(`Invoice #${bill.invoiceNumber} → #${editInvoiceNumber.trim()}`);
      }
      if (editBillDate !== bill.billDate) {
        changes.push(`Date ${bill.billDate} → ${editBillDate}`);
      }
      if (editPaymentStatus !== bill.paymentStatus) {
        changes.push(`Payment Status: ${bill.paymentStatus} → ${editPaymentStatus}`);
      }
      if (editNotes.trim() !== (bill.notes || '')) {
        changes.push('Notes updated');
      }

      const description = changes.length > 0 ? changes.join('; ') : 'Bill details updated';

      await updateBill(
        supplierId,
        billId,
        {
          invoiceNumber: editInvoiceNumber.trim(),
          billDate: editBillDate.trim(),
          paymentStatus: editPaymentStatus,
          notes: editNotes.trim(),
        },
        {
          action: editPaymentStatus !== bill.paymentStatus ? 'PAYMENT_UPDATED' : 'UPDATED',
          description,
          oldValue: {
            invoiceNumber: bill.invoiceNumber,
            paymentStatus: bill.paymentStatus,
          },
          newValue: {
            invoiceNumber: editInvoiceNumber.trim(),
            paymentStatus: editPaymentStatus,
          },
          changedBy: currentUser?.id || currentUser?.uid || 'admin',
          changedByName: currentUser?.name || 'Admin',
        }
      );

      setShowEditModal(false);
      Alert.alert('Success', 'Bill updated and audit history recorded');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update bill');
    } finally {
      setEditLoading(false);
    }
  };

  const handleTogglePaymentStatus = async () => {
    if (!bill) return;
    const nextStatus: BillPaymentStatus = bill.paymentStatus === 'PAID' ? 'PENDING' : 'PAID';
    const description = `Payment status updated: ${bill.paymentStatus} → ${nextStatus}`;

    try {
      await updateBill(
        supplierId,
        billId,
        {
          paymentStatus: nextStatus,
          paidAmount: nextStatus === 'PAID' ? bill.totalAmount : 0,
        },
        {
          action: 'PAYMENT_UPDATED',
          field: 'paymentStatus',
          oldValue: bill.paymentStatus,
          newValue: nextStatus,
          description,
          changedBy: currentUser?.id || currentUser?.uid || 'admin',
          changedByName: currentUser?.name || 'Admin',
        }
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update payment status');
    }
  };

  // Attachment Replacement
  const handleUploadReplacement = async (rawUri: string, rawName: string, rawMimeType: string, rawSize?: number) => {
    if (!bill) return;
    setIsReplacing(true);
    setShowReplaceModal(false);
    setReplaceStepText('Compressing and optimizing attachment...');

    try {
      // 1. Client-side compression
      const compressed = await compressBillImage(rawUri, rawName, rawMimeType, rawSize);

      setReplaceStepText('Uploading optimized file to Cloudinary...');
      const uploadResult = await uploadToCloudinary({
        uri: compressed.uri,
        fileName: compressed.name,
        fileType: compressed.mimeType,
        fileSize: compressed.compressedSize,
        userId: currentUser?.id || currentUser?.uid || 'admin',
        supplierId,
        billId,
      });

      const sizeNote = compressed.wasCompressed && compressed.originalSize
        ? ` (${formatFileSize(compressed.compressedSize)}, saved ${compressed.savedPercentage}%)`
        : ` (${formatFileSize(compressed.compressedSize)})`;

      await replaceAttachment(
        supplierId,
        billId,
        {
          cloudinaryUrl: uploadResult.secureUrl || uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          fileName: uploadResult.fileName,
          fileType: uploadResult.fileType,
          fileSize: uploadResult.fileSize,
        },
        {
          uid: currentUser?.id || currentUser?.uid || 'admin',
          name: currentUser?.name || 'Admin',
          oldFileName: bill.fileName ? `${bill.fileName}` : 'Previous Attachment',
        }
      );

      Alert.alert(
        'Attachment Replaced',
        `New file (${formatFileSize(uploadResult.fileSize)}) optimized and uploaded to Cloudinary successfully.`
      );
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload replacement attachment');
    } finally {
      setIsReplacing(false);
      setReplaceStepText('Optimizing & uploading attachment...');
    }
  };


  const pickCameraForReplace = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission', 'Camera permission required');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const a = res.assets[0];
        handleUploadReplacement(
          a.uri,
          a.fileName || `bill_replace_${Date.now()}.jpg`,
          a.mimeType || 'image/jpeg',
          a.fileSize
        );
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message);
    }
  };

  const pickGalleryForReplace = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission', 'Gallery permission required');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const a = res.assets[0];
        handleUploadReplacement(
          a.uri,
          a.fileName || `bill_replace_${Date.now()}.jpg`,
          a.mimeType || 'image/jpeg',
          a.fileSize
        );
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message);
    }
  };

  const pickDocForReplace = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const d = res.assets[0];
        handleUploadReplacement(
          d.uri,
          d.name || `bill_replace_${Date.now()}.pdf`,
          d.mimeType || 'application/pdf',
          d.size
        );
      }
    } catch (err: any) {
      Alert.alert('Document Error', err.message);
    }
  };

  // Open Fullscreen or In Browser
  const handleOpenFullBill = () => {
    if (!bill?.cloudinaryUrl) {
      Alert.alert('No Attachment', 'There is no file attached to this bill');
      return;
    }
    const isImage =
      bill.fileType?.includes('image') ||
      bill.fileName?.endsWith('.jpg') ||
      bill.fileName?.endsWith('.png') ||
      bill.fileName?.endsWith('.jpeg');

    if (isImage) {
      setShowFullImageModal(true);
    } else {
      Linking.openURL(bill.cloudinaryUrl).catch(() => {
        Alert.alert('Error', 'Unable to open file in browser');
      });
    }
  };

  // Soft Delete
  const handleConfirmDelete = async () => {
    if (!bill) return;
    try {
      await softDeleteBill(supplierId, billId, {
        uid: currentUser?.id || currentUser?.uid || 'admin',
        name: currentUser?.name || 'Admin',
        invoiceNumber: bill.invoiceNumber,
      });
      setShowDeleteModal(false);
      Alert.alert(
        'Bill Deleted',
        'This bill was removed from active records. Its historical audit record has been retained.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete bill');
    }
  };

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Bill Details" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.notFoundWrap}>
          <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
          <Text style={styles.notFoundText}>Bill record not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const isImageAttachment =
    bill.cloudinaryUrl &&
    (bill.fileType?.includes('image') ||
      bill.fileName?.endsWith('.jpg') ||
      bill.fileName?.endsWith('.jpeg') ||
      bill.fileName?.endsWith('.png'));

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Invoice #${bill.invoiceNumber}`}
        subtitle={supplier?.name || bill.supplierName || 'Bill Details'}
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={openEditModal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={19} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowDeleteModal(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={19} color={colors.danger} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Replacing Progress Banner */}
        {isReplacing && (
          <View style={styles.replacingBanner}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.replacingText}>{replaceStepText}</Text>
          </View>
        )}


        {/* ── Bill Top Overview Card ──────────────────────────────── */}
        <Card style={styles.topCard} outlined elevation="sm">
          <View style={styles.topCardHeader}>
            <View>
              <Text style={styles.invoiceTitle}>Invoice #{bill.invoiceNumber}</Text>
              <Text style={styles.invoiceDateText}>Bill Date: {bill.billDate}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.statusBadgeBtn,
                bill.paymentStatus === 'PAID' ? styles.statusBadgePaid : styles.statusBadgePending,
              ]}
              onPress={handleTogglePaymentStatus}
              activeOpacity={0.8}
            >
              <Ionicons
                name={bill.paymentStatus === 'PAID' ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={bill.paymentStatus === 'PAID' ? colors.brandGreen : colors.debit}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  bill.paymentStatus === 'PAID'
                    ? styles.statusBadgeTextPaid
                    : styles.statusBadgeTextPending,
                ]}
              >
                {bill.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid / Credit'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.supplierSubRow}>
            <Ionicons name="business-outline" size={14} color={colors.textMuted} />
            <Text style={styles.supplierSubText}>
              {supplier?.name || bill.supplierName}
              {supplier?.contactPerson ? ` · ${supplier.contactPerson}` : ''}
              {supplier?.phone ? ` · ${supplier.phone}` : ''}
            </Text>
          </View>
        </Card>

        {/* ── Products Line Items Table ───────────────────────────── */}
        <Text style={styles.sectionTitle}>PURCHASED PRODUCTS</Text>
        <Card style={styles.itemsCard} outlined>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableColHeader, { flex: 2 }]}>PRODUCT</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'center' }]}>QTY × RATE</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>AMOUNT</Text>
          </View>

          {bill.items && bill.items.length > 0 ? (
            bill.items.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.tableRow,
                  index === bill.items.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ flex: 2 }}>
                  <Text style={styles.itemProductName}>{item.productName}</Text>
                  <Text style={styles.itemProductUnit}>{item.unit || 'unit'}</Text>
                </View>

                <View style={{ flex: 1.2, alignItems: 'center' }}>
                  <Text style={styles.itemQtyRate}>
                    {item.quantity} × ₹{fmt(item.unitPrice)}
                  </Text>
                </View>

                <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                  <Text style={styles.itemAmount}>₹{fmt(item.amount)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={{ padding: spacing.sm, alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>No item lines</Text>
            </View>
          )}
        </Card>

        {/* ── Financial Summary ───────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>FINANCIAL SUMMARY</Text>
        <Card style={styles.summaryCard} outlined>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₹{fmt(bill.subtotal || 0)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>+₹{fmt(bill.tax || 0)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <Text style={styles.summaryValue}>−₹{fmt(bill.discount || 0)}</Text>
          </View>

          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>TOTAL AMOUNT</Text>
            <Text style={styles.summaryTotalValue}>₹{fmt(bill.totalAmount || 0)}</Text>
          </View>
        </Card>

        {/* ── Attachment Section ──────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
          BILL ATTACHMENT (CLOUDINARY)
        </Text>
        <Card style={styles.attachmentCard} outlined>
          {bill.cloudinaryUrl ? (
            <View>
              <View style={styles.attachmentRow}>
                {isImageAttachment ? (
                  <TouchableOpacity onPress={handleOpenFullBill} activeOpacity={0.8}>
                    <Image source={{ uri: bill.cloudinaryUrl }} style={styles.thumbImage} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.thumbPdfBox}>
                    <Ionicons name="document-text" size={28} color={colors.primary} />
                  </View>
                )}

                <View style={styles.attachmentInfoCol}>
                  <Text style={styles.attachmentTitle} numberOfLines={1}>
                    {bill.fileName || 'Invoice Attachment'}
                  </Text>
                  <Text style={styles.attachmentMeta}>
                    {bill.fileSize ? `${(bill.fileSize / 1024).toFixed(1)} KB · ` : ''}
                    {bill.fileType || 'Document'}
                  </Text>
                  <Text style={styles.attachmentCloudinaryTag}>
                    <Ionicons name="cloud-done" size={11} color={colors.brandGreen} /> Stored on Cloudinary
                  </Text>
                </View>
              </View>

              <View style={styles.attachmentActionButtonsRow}>
                <TouchableOpacity
                  style={styles.attachmentActionBtn}
                  onPress={handleOpenFullBill}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-outline" size={16} color={colors.primary} />
                  <Text style={styles.attachmentActionBtnText}>Open Full Bill</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentActionBtn}
                  onPress={() => setShowReplaceModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="repeat-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.attachmentActionBtnTextSec}>Replace File</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noAttachmentBox}>
              <Ionicons name="document-outline" size={32} color={colors.textMuted} />
              <Text style={styles.noAttachmentText}>No bill file attached yet</Text>
              <Button
                title="+ Upload Attachment"
                variant="outline"
                size="sm"
                onPress={() => setShowReplaceModal(true)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}
        </Card>

        {/* ── Notes ───────────────────────────────────────────────── */}
        {bill.notes ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>PURCHASE NOTES</Text>
            <Card style={styles.notesCard} outlined>
              <Text style={styles.notesText}>{bill.notes}</Text>
            </Card>
          </>
        ) : null}

        {/* ── Audit Trail / Change History ────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          AUDIT TRAIL & HISTORY ({history.length})
        </Text>
        <Card style={styles.historyCard} outlined>
          {history.map((record, idx) => (
            <View
              key={record.id || idx}
              style={[
                styles.historyItemRow,
                idx === history.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.historyDotCol}>
                <View
                  style={[
                    styles.historyDot,
                    record.action === 'CREATED' && { backgroundColor: colors.primary },
                    record.action === 'PAYMENT_UPDATED' && { backgroundColor: colors.brandGreen },
                    record.action === 'ATTACHMENT_REPLACED' && { backgroundColor: '#8B5CF6' },
                    record.action === 'DELETED' && { backgroundColor: colors.danger },
                  ]}
                />
                {idx !== history.length - 1 && <View style={styles.historyLine} />}
              </View>

              <View style={styles.historyContentCol}>
                <View style={styles.historyTopRow}>
                  <Text style={styles.historyActionBadge}>{record.action}</Text>
                  <Text style={styles.historyDateText}>{formatDate(record.changedAt)}</Text>
                </View>

                <Text style={styles.historyDescText}>{record.description}</Text>

                <Text style={styles.historyUserText}>
                  By: {record.changedByName || record.changedBy || 'Admin'}
                </Text>
              </View>
            </View>
          ))}

          {history.length === 0 && (
            <View style={{ padding: spacing.md, alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                No audit trail records
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* ── FULL IMAGE VIEWER MODAL ────────────────────────────────── */}
      <Modal
        visible={showFullImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullImageModal(false)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            style={styles.closeFullImageBtn}
            onPress={() => setShowFullImageModal(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {bill.cloudinaryUrl && (
            <Image
              source={{ uri: bill.cloudinaryUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}

          <TouchableOpacity
            style={styles.openBrowserLinkBtn}
            onPress={() => {
              if (bill.cloudinaryUrl) Linking.openURL(bill.cloudinaryUrl);
            }}
          >
            <Ionicons name="open-outline" size={16} color="#FFFFFF" />
            <Text style={styles.openBrowserLinkText}>Open Full Quality in Browser</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── REPLACE ATTACHMENT MODAL ───────────────────────────────── */}
      <Modal
        visible={showReplaceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReplaceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Replace Attachment</Text>
              <TouchableOpacity onPress={() => setShowReplaceModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.replaceSubtitle}>
              Select a new file. The replacement will be saved to Cloudinary and tracked in the audit trail.
            </Text>

            <View style={styles.replaceOptionsGrid}>
              <TouchableOpacity style={styles.replaceTile} onPress={pickCameraForReplace}>
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.replaceTileText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.replaceTile} onPress={pickGalleryForReplace}>
                <Ionicons name="images-outline" size={24} color={colors.primary} />
                <Text style={styles.replaceTileText}>Photo Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.replaceTile} onPress={pickDocForReplace}>
                <Ionicons name="document-attach-outline" size={24} color={colors.primary} />
                <Text style={styles.replaceTileText}>PDF / Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── EDIT BILL MODAL ─────────────────────────────────────────── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Bill Details</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <Input
                label="Invoice Number *"
                value={editInvoiceNumber}
                onChangeText={setEditInvoiceNumber}
              />

              <Input
                label="Bill Date (YYYY-MM-DD) *"
                value={editBillDate}
                onChangeText={setEditBillDate}
              />

              <Text style={styles.editLabel}>Payment Status</Text>
              <View style={styles.editPaymentToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.editPaymentBtn,
                    editPaymentStatus === 'PAID' && styles.editPaymentBtnPaid,
                  ]}
                  onPress={() => setEditPaymentStatus('PAID')}
                >
                  <Text
                    style={[
                      styles.editPaymentText,
                      editPaymentStatus === 'PAID' && styles.editPaymentTextPaid,
                    ]}
                  >
                    Fully Paid
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.editPaymentBtn,
                    editPaymentStatus === 'PENDING' && styles.editPaymentBtnPending,
                  ]}
                  onPress={() => setEditPaymentStatus('PENDING')}
                >
                  <Text
                    style={[
                      styles.editPaymentText,
                      editPaymentStatus === 'PENDING' && styles.editPaymentTextPending,
                    ]}
                  >
                    Unpaid / Credit
                  </Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Notes"
                value={editNotes}
                onChangeText={setEditNotes}
                containerStyle={{ marginTop: spacing.sm }}
              />

              <Button
                title="SAVE CHANGES & LOG AUDIT"
                onPress={handleSaveEdit}
                loading={editLoading}
                style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── DELETE BILL CONFIRMATION MODAL ─────────────────────────── */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Bill"
        message="Deleting this bill will remove it from the active records. The historical audit record will be retained."
        confirmTitle="Delete Bill"
        cancelTitle="Cancel"
        variant="danger"
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
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    padding: spacing.xs,
  },
  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  replacingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  replacingText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },

  // Top Card
  topCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  topCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  invoiceTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  invoiceDateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgePaid: {
    backgroundColor: colors.brandGreenLight,
  },
  statusBadgePending: {
    backgroundColor: colors.debitLight,
  },
  statusBadgeText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  statusBadgeTextPaid: {
    color: colors.brandGreen,
  },
  statusBadgeTextPending: {
    color: colors.debit,
  },
  supplierSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 4,
  },
  supplierSubText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11.5,
  },

  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },

  // Table
  itemsCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableColHeader: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemProductName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  itemProductUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  itemQtyRate: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11.5,
  },
  itemAmount: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },

  // Summary
  summaryCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  summaryTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
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
    fontSize: 17,
    color: colors.primary,
  },

  // Attachment Card
  attachmentCard: {
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  thumbImage: {
    width: 50,
    height: 50,
    borderRadius: spacing.borderRadiusSm,
    marginRight: spacing.sm,
  },
  thumbPdfBox: {
    width: 50,
    height: 50,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  attachmentInfoCol: {
    flex: 1,
  },
  attachmentTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  attachmentMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  attachmentCloudinaryTag: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 10,
    marginTop: 2,
  },
  attachmentActionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  attachmentActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.surfaceSubtle,
    gap: 4,
  },
  attachmentActionBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11.5,
  },
  attachmentActionBtnTextSec: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11.5,
  },
  noAttachmentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  noAttachmentText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },

  notesCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  notesText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 12,
  },

  // Audit History
  historyCard: {
    padding: spacing.sm + 4,
    marginBottom: spacing.lg,
  },
  historyItemRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  historyDotCol: {
    width: 20,
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  historyLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  historyContentCol: {
    flex: 1,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  historyActionBadge: {
    ...typography.label,
    color: colors.primary,
    fontSize: 9.5,
  },
  historyDateText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  historyDescText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 12,
    marginTop: 1,
  },
  historyUserText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },

  // Fullscreen Image Modal
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  fullscreenImage: {
    width: '100%',
    height: '75%',
  },
  openBrowserLinkBtn: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    gap: 6,
  },
  openBrowserLinkText: {
    ...typography.captionBold,
    color: '#FFFFFF',
    fontSize: 12,
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
  replaceSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  replaceOptionsGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  replaceTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  replaceTileText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  editLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  editPaymentToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  editPaymentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  editPaymentBtnPaid: {
    backgroundColor: colors.brandGreenLight,
    borderColor: colors.brandGreen,
  },
  editPaymentBtnPending: {
    backgroundColor: colors.debitLight,
    borderColor: colors.debit,
  },
  editPaymentText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  editPaymentTextPaid: {
    color: colors.brandGreen,
  },
  editPaymentTextPending: {
    color: colors.debit,
  },
});
