import { create } from 'zustand';
import {
  Staff,
  StaffAttendance,
  AttendanceStatus,
  StaffAdvance,
  StaffSalarySlip,
  MonthlyAttendanceSummary,
} from '../types';
import { staffPayrollService } from '../services/staffPayrollService';

/** Helper to get local date in YYYY-MM-DD */
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Helper to get current month in YYYY-MM */
export const getCurrentMonthString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

interface StaffPayrollState {
  // Selected views
  selectedDate: string; // YYYY-MM-DD
  selectedMonth: string; // YYYY-MM

  // Data
  dailyAttendanceMap: Record<string, StaffAttendance>;
  monthlyAttendanceRecords: StaffAttendance[];
  advancesList: StaffAdvance[];
  salarySlipsList: StaffSalarySlip[];

  // Loading flags
  isAttendanceLoading: boolean;
  isMonthlyAttendanceLoading: boolean;
  isAdvancesLoading: boolean;
  isPayrollLoading: boolean;

  // Unsubscribers
  attendanceUnsub: (() => void) | null;
  monthlyAttendanceUnsub: (() => void) | null;
  advancesUnsub: (() => void) | null;
  payrollUnsub: (() => void) | null;

  // Subscription methods
  setSelectedDate: (date: string) => void;
  setSelectedMonth: (month: string) => void;
  subscribeAttendance: (date?: string) => void;
  subscribeMonthlyAttendance: (month?: string) => void;
  subscribeAdvances: () => void;
  subscribePayroll: (month?: string) => void;
  unsubscribeAll: () => void;

  // Actions
  markAttendance: (params: {
    staffId: string;
    staffName: string;
    date?: string;
    status: AttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    notes?: string;
    markedBy?: string;
  }) => Promise<void>;

  batchMarkAttendance: (
    staffList: Staff[],
    status: AttendanceStatus,
    date?: string,
    markedBy?: string
  ) => Promise<void>;

  getMonthlyAttendanceSummary: (
    staffId: string,
    month?: string
  ) => Promise<MonthlyAttendanceSummary>;

  giveAdvance: (params: {
    staffId: string;
    staffName: string;
    amount: number;
    date: string;
    reason?: string;
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
    notes?: string;
    approvedBy?: string;
  }) => Promise<StaffAdvance>;

  repayAdvance: (params: {
    advanceId: string;
    amount: number;
    date: string;
    type: 'CASH_RETURN' | 'SALARY_DEDUCTION' | 'ONLINE_RETURN';
    salarySlipId?: string;
    notes?: string;
  }) => Promise<void>;

  updateSalaryConfig: (
    staffId: string,
    userId: string | undefined,
    monthlySalary: number,
    salaryType?: 'MONTHLY' | 'DAILY',
    dailyRate?: number
  ) => Promise<void>;

  saveSalarySlip: (slip: StaffSalarySlip) => Promise<void>;

  disburseSalary: (params: {
    slipId: string;
    paidAmount: number;
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
    paymentDate: string;
    transactionRef?: string;
    notes?: string;
  }) => Promise<void>;
}

export const useStaffPayrollStore = create<StaffPayrollState>((set, get) => ({
  selectedDate: getTodayDateString(),
  selectedMonth: getCurrentMonthString(),

  dailyAttendanceMap: {},
  monthlyAttendanceRecords: [],
  advancesList: [],
  salarySlipsList: [],

  isAttendanceLoading: false,
  isMonthlyAttendanceLoading: false,
  isAdvancesLoading: false,
  isPayrollLoading: false,

  attendanceUnsub: null,
  monthlyAttendanceUnsub: null,
  advancesUnsub: null,
  payrollUnsub: null,

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
    get().subscribeAttendance(date);
  },

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
    get().subscribePayroll(month);
    get().subscribeMonthlyAttendance(month);
  },

  subscribeAttendance: (dateInput?: string) => {
    const targetDate = dateInput || get().selectedDate;
    const currentUnsub = get().attendanceUnsub;
    if (currentUnsub) {
      currentUnsub();
    }

    set({ isAttendanceLoading: true });
    const unsub = staffPayrollService.subscribeAttendanceByDate(targetDate, (records) => {
      const map: Record<string, StaffAttendance> = {};
      records.forEach((r) => {
        map[r.staffId] = r;
      });
      set({
        dailyAttendanceMap: map,
        isAttendanceLoading: false,
      });
    });

    set({ attendanceUnsub: unsub });
  },

  subscribeMonthlyAttendance: (monthInput?: string) => {
    const targetMonth = monthInput || get().selectedMonth;
    const currentUnsub = get().monthlyAttendanceUnsub;
    if (currentUnsub) {
      currentUnsub();
    }

    set({ isMonthlyAttendanceLoading: true });
    const unsub = staffPayrollService.subscribeMonthlyAttendance(targetMonth, (records) => {
      set({
        monthlyAttendanceRecords: records,
        isMonthlyAttendanceLoading: false,
      });
    });

    set({ monthlyAttendanceUnsub: unsub });
  },

  subscribeAdvances: () => {
    const currentUnsub = get().advancesUnsub;
    if (currentUnsub) {
      currentUnsub();
    }

    set({ isAdvancesLoading: true });
    const unsub = staffPayrollService.subscribeAllAdvances((advances) => {
      set({
        advancesList: advances,
        isAdvancesLoading: false,
      });
    });

    set({ advancesUnsub: unsub });
  },

  subscribePayroll: (monthInput?: string) => {
    const targetMonth = monthInput || get().selectedMonth;
    const currentUnsub = get().payrollUnsub;
    if (currentUnsub) {
      currentUnsub();
    }

    set({ isPayrollLoading: true });
    const unsub = staffPayrollService.subscribeSalarySlipsByMonth(targetMonth, (slips) => {
      set({
        salarySlipsList: slips,
        isPayrollLoading: false,
      });
    });

    set({ payrollUnsub: unsub });
  },

  unsubscribeAll: () => {
    const { attendanceUnsub, monthlyAttendanceUnsub, advancesUnsub, payrollUnsub } = get();
    if (attendanceUnsub) attendanceUnsub();
    if (monthlyAttendanceUnsub) monthlyAttendanceUnsub();
    if (advancesUnsub) advancesUnsub();
    if (payrollUnsub) payrollUnsub();
    set({
      attendanceUnsub: null,
      monthlyAttendanceUnsub: null,
      advancesUnsub: null,
      payrollUnsub: null,
    });
  },

  markAttendance: async (params) => {
    const date = params.date || get().selectedDate;
    await staffPayrollService.markAttendance({
      ...params,
      date,
    });
  },

  batchMarkAttendance: async (staffList, status, date, markedBy) => {
    const targetDate = date || get().selectedDate;
    await staffPayrollService.batchMarkAttendance(targetDate, staffList, status, markedBy);
  },

  getMonthlyAttendanceSummary: async (staffId, month) => {
    const targetMonth = month || get().selectedMonth;
    return await staffPayrollService.getMonthlyAttendanceSummary(staffId, targetMonth);
  },

  giveAdvance: async (params) => {
    const adv = await staffPayrollService.recordAdvance(params);
    return adv;
  },

  repayAdvance: async (params) => {
    await staffPayrollService.recordAdvanceRepayment(params);
  },

  updateSalaryConfig: async (staffId, userId, monthlySalary, salaryType, dailyRate) => {
    await staffPayrollService.updateStaffSalaryConfig(
      staffId,
      userId,
      monthlySalary,
      salaryType,
      dailyRate
    );
  },

  saveSalarySlip: async (slip) => {
    await staffPayrollService.saveSalarySlip(slip);
  },

  disburseSalary: async (params) => {
    await staffPayrollService.markSalaryDisbursed(params);
  },
}));
