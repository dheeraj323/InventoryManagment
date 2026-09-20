# DMS Vendor Module Forensic Audit & Implementation Plan

**Target Application:** Distributor Management System (DMS)  
**Location:** `d:\Inventory`  
**Stack:** React Native (Expo SDK 57 / React 19), TypeScript, Cloud Firestore, Firebase Auth, Zustand  
**Date:** September 2026  

---

## 1. Forensic Audit of Existing Codebase

### 1.1 Existing Architecture & Navigation
- **Navigation Container:** `src/navigation/AdminNavigator.tsx` manages `AdminHomeStack` and `Tab.Navigator`.
- **Existing Vendor Routes:**
  - `VendorList` (`src/screens/admin/VendorListScreen.tsx`): Displays a basic list of vendors with running balance and search input.
  - `VendorDetail` (`src/screens/admin/VendorDetailScreen.tsx`): Currently only shows `LedgerSummaryCard` and ledger transactions with manual adjustment modal.
- **Other Linked Admin Routes:** `AdminOrders`, `AdminOrderDetail`, `Inventory`, `Supplier`, `AdminFinance`, `StaffSettlements`, `AuditHistory`.

### 1.2 Vendor Data Models & Types (`src/types/index.ts`)
- `Vendor` interface contains: `id`, `vendorId`, `name`, `ownerName`, `shopName`, `businessName`, `phone`, `address`, `area`, `creditLimit`, `openingBalance`, `currentBalance`, `currentOutstanding`, `payLaterEligible`, `preferredPaymentMode`, `active`, `createdAt`, `updatedAt`.
- Status field: Currently defaults to boolean `active`. To support the complete operational workflow requested, we can extend status to: `'ACTIVE' | 'PENDING_APPROVAL' | 'ON_HOLD' | 'SUSPENDED'`.
- `VendorAccountSummary`: Model for computing derived receivables, available credit, total debits, and total credits.

### 1.3 Services & Financial Data Tier
- **`vendorService.ts`**: Implements `getVendors`, `getVendorById`, `subscribeVendors`, `updatePayLaterAccess`, `updateOutstandingBalance`, `addVendor`.
- **`financialTransactionService.ts`**: Canonical idempotent financial write path for delivery finalization, debit/credit ledger writes, invoices, and inventory restoration.
- **`invoiceService.ts`**: Read-only queries for `invoices` collection (`getInvoice`, `getVendorInvoices`, `subscribeVendorInvoices`, `getOutstandingInvoices`).
- **`ledgerService.ts`**: Manages `ledgerEntries` collection with running balance computations, subscriptions, and immutable `auditLogs`.
- **`orderService.ts`**: Manages `orders` collection with atomic stock decrement, credit limit verification (`pendingAdminOverride`), and status updates.
- **`paymentService.ts`**: Currently missing as a standalone service; payments are created during delivery in `financialTransactionService` or stored in `payments`. We will introduce a formal `paymentService` to handle manual / direct vendor payment collections.

---

## 2. Reusable Components & Utilities

| Component / Utility | File Location | Purpose & Reuse in Vendor Module |
| :--- | :--- | :--- |
| `Header` | `src/components/common/Header.tsx` | Standard top app header with back button, titles, and right actions. |
| `Card` | `src/components/common/Card.tsx` | Standard container with rounded corners and subtle elevation. |
| `Button` | `src/components/common/Button.tsx` | Primary, secondary, danger, outline buttons with loading states. |
| `Input` | `src/components/common/Input.tsx` | Input with labels, prefixes (₹), error text, and icons. |
| `ConfirmationModal` | `src/components/common/ConfirmationModal.tsx` | Theme-consistent modal for status updates, deactivation, and overrides. |
| `LedgerSummaryCard` | `src/components/ledger/LedgerSummaryCard.tsx` | Financial card showing Current Balance, Invoiced, and Collected. |
| `LedgerRow` | `src/components/ledger/LedgerRow.tsx` | Itemized transaction row with debit/credit badges and audit details. |
| `LedgerAdjustmentModal` | `src/components/ledger/LedgerAdjustmentModal.tsx` | Modal for manual ledger amount adjustments with mandatory audit reasons. |
| `useDebounce` | `src/hooks/useDebounce.ts` | Debouncing search inputs to avoid UI stutter. |

---

## 3. Required Enhancements & New Components

### 3.1 Main Vendor Directory Screen (`VendorListScreen.tsx`)
1. **Header**: Title "Vendor Directory", partner count, "+ Add Vendor" action button.
2. **KPI Summary Cards**:
   - Total Vendors
   - Active Vendors
   - Pending Approval / On Hold
   - Overdue Vendors
   - Total Outstanding Receivables (aggregated sum of positive `currentOutstanding`).
3. **Filter Segment Chips**:
   - `All Vendors`
   - `Active`
   - `Pending Approval`
   - `On Hold`
   - `Overdue`
   - `Credit Limit Exceeded`
4. **Enhanced Search**: Debounced search supporting Shop Name, Proprietor, Phone, Email, Area, and Vendor ID.
5. **Vendor List Cards**:
   - Avatar badge with initials
   - Shop name & proprietor name
   - Status badge (Active / Pending / On Hold / Suspended)
   - Outstanding balance in Green (`colors.brandGreen`) or amber/red if overdue
   - Credit limit & available credit
   - Last order date indicator
   - Tap to open Vendor Details.

### 3.2 Add Vendor Modal (`AddVendorModal.tsx`)
- Clean, validated input form:
  - Shop Name * (required)
  - Proprietor / Owner Name * (required)
  - Phone Number * (validated 10-digit)
  - Email Address (optional, formatted)
  - Address & Market Area * (required)
  - Preferred Payment Mode (`CASH` | `ONLINE` | `PAY_LATER`)
  - Credit Limit (₹, non-negative)
  - Opening Balance (₹, optional initial balance with automatic `OPENING_BALANCE` ledger entry generation)
  - Initial Status (`ACTIVE` | `PENDING_APPROVAL`)
- Validations preventing negative credit limits or invalid data.

### 3.3 Complete Vendor Details Screen (`VendorDetailScreen.tsx`)
A modular tabbed B2B profile screen:
1. **Header & Profile Summary**:
   - Shop Name, Proprietor, Status badge.
   - Quick action communication triggers: 📞 Call, 💬 WhatsApp.
   - Quick status toggle: Active / Put On Hold.
2. **Tabs**:
   - **Tab 1: Overview**:
     - Financial Position: Outstanding Balance, Overdue Amount, Credit Limit, Available Credit, Credit Utilization Gauge (%), Total Invoiced, Total Paid.
     - Quick Action Grid: View Ledger, View Orders, View Invoices, Record Payment, Adjust Credit Limit, Manual Adjustment.
   - **Tab 2: Ledger (Khata)**:
     - Reuses `LedgerSummaryCard` and `LedgerRow` items.
     - Segmented filters: `All`, `Billed`, `Paid`, `Adjustments`.
     - Tap entry to open `LedgerAdjustmentModal` for audit-logged edits.
   - **Tab 3: Orders**:
     - Real-time orders list for this vendor (from `useOrderStore`).
     - Status filters: `All`, `Pending`, `Approved`, `Delivered`, `Cancelled`.
     - Order cards with total, delivery status, and tap to open `AdminOrderDetailScreen`.
   - **Tab 4: Invoices**:
     - Real-time invoices list (from `invoiceService`).
     - Shows Invoice #, Date, Status (`Finalized`, `Partially Paid`, `Paid`, `Overdue`), Total, Balance Due.
   - **Tab 5: Payments & Record Payment**:
     - List of recorded payments with payment method, reference #, and verification status.
     - **Record Payment Modal**: Allows Admin to record offline payments (Cash / UPI / Bank Transfer / Cheque), atomically creating a `CREDIT` ledger entry, updating vendor outstanding balance, and logging an audit event.
   - **Tab 6: Credit Management**:
     - Detailed credit limit metrics and utilization.
     - **Adjust Credit Limit Modal**: Allows Admin to increase or reduce credit limit with mandatory audit reason logging.
   - **Tab 7: Settings & Profile**:
     - Edit vendor contact information, address, payment terms, status (Activate / On Hold / Suspend).
     - Confirmation modal for status changes.

---

## 4. Required Service & Store Updates

1. **`src/services/vendorService.ts`**:
   - Update `addVendor` to support complete fields + status + optional opening balance ledger entry.
   - Add `updateVendorProfile` to update address, phone, email, ownerName, shopName.
   - Add `updateVendorStatus` (ACTIVE, PENDING_APPROVAL, ON_HOLD, SUSPENDED) with audit logging.
   - Add `updateCreditLimit` with audit logging.

2. **`src/services/paymentService.ts` [NEW]**:
   - Standalone payment service for recording direct vendor payments and fetching vendor payments.
   - Atomically creates `payments` record, writes `CREDIT` `ledgerEntries` document, and updates `vendor.currentBalance`.

3. **`src/store/useVendorStore.ts`**:
   - Expose `addVendor`, `updateVendor`, `updateVendorStatus`, `adjustCreditLimit`, `recordPayment`.

4. **`src/types/index.ts`**:
   - Update `Vendor` type to include `status?: 'ACTIVE' | 'PENDING_APPROVAL' | 'ON_HOLD' | 'SUSPENDED'`, `email?: string`, `notes?: string`.
   - Add `Payment` verification status fields.

---

## 5. Implementation Sequence

1. **Phase 1: Domain Models & Types**
   - Update `src/types/index.ts` with vendor status types and payment metadata.
2. **Phase 2: Backend Services & Store**
   - Create `src/services/paymentService.ts`.
   - Enhance `src/services/vendorService.ts` with complete CRUD and audit logging.
   - Update `src/store/useVendorStore.ts` to expose new vendor operations.
3. **Phase 3: Add Vendor Modal Component**
   - Create `src/components/vendor/AddVendorModal.tsx`.
   - Create `src/components/vendor/AdjustCreditLimitModal.tsx`.
   - Create `src/components/vendor/RecordPaymentModal.tsx`.
4. **Phase 4: Admin Vendor Directory (`VendorListScreen.tsx`)**
   - Implement KPI summary cards, status filter chips, debounced search, rich vendor cards, and Add Vendor trigger.
5. **Phase 5: Complete Vendor Details Screen (`VendorDetailScreen.tsx`)**
   - Implement multi-tab navigation: Overview, Ledger, Orders, Invoices, Payments, Credit Management, Settings.
6. **Phase 6: Verification & Quality Assurance**
   - Execute `npx tsc --noEmit` to verify type safety.
   - Test search, filters, payment recording, credit limit adjustment, order navigation, and ledger consistency.
7. **Phase 7: Final Documentation**
   - Generate `DMS_VENDOR_MODULE_IMPLEMENTATION_REPORT.md`, `DMS_VENDOR_DATA_MODEL.md`, and `DMS_VENDOR_TEST_REPORT.md`.
