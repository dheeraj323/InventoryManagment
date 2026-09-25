import { Order, LedgerEntry } from '../types';

export type AuthStackParamList = {
  Login: undefined;
  RoleSelect: undefined;
};

export type VendorTabParamList = {
  VendorDashboardTab: undefined;
  ProductCatalogTab: undefined;
  VendorOrdersTab: undefined;
  VendorLedgerTab: undefined;
  VendorProfileTab: undefined;
  VendorDashboard: undefined;
  ProductCatalog: undefined;
  Cart: undefined;
  CheckoutScreen: undefined;
  VendorOrders: undefined;
  VendorOrderDetail: { orderId: string };
  VendorLedger: undefined;
  VendorProfile: undefined;
};

export type StaffTabParamList = {
  StaffDashboard: undefined;
  TodayDeliveries: undefined;
  DeliveryDetail: { orderId: string };
  ActualPayment: { orderId: string };
  CashSettlement: undefined;
  StaffProfile: undefined;
};

export type AdminTabParamList = {
  AdminDashboardTab: undefined;
  AdminOrdersTab: { screen?: string; params?: { initialFilter?: string; status?: string } } | undefined;
  VendorListTab: undefined;
  AdminFinanceTab: undefined;
  AdminSettingsTab: undefined;
  AdminDashboard: undefined;
  VendorList: undefined;
  VendorDetail: {
    vendorId: string;
    initialTab?: 'OVERVIEW' | 'LEDGER' | 'ORDERS' | 'INVOICES' | 'PAYMENTS';
  };
  AdminOrders: { initialFilter?: string; status?: string } | undefined;
  AdminOrderDetail: { orderId: string; hideVendorProfile?: boolean };
  Inventory: undefined;
  AdminFinance: undefined;
  AuditHistory: undefined;
  StaffSettlements: undefined;
  StaffManagement: undefined;
  StaffApproval: undefined;
  AdminSettings: undefined;
};
