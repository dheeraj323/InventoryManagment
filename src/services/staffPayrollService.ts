import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Staff,
  StaffAttendance,
  AttendanceStatus,
  MonthlyAttendanceSummary,
  StaffAdvance,
  StaffAdvanceRepayment,
  AdvanceStatus,
  StaffSalarySlip,
  SalaryPaymentStatus,
} from '../types';

const ATTENDANCE_COLLECTION = 'staffAttendance';
const ADVANCES_COLLECTION = 'staffAdvances';
const SALARIES_COLLECTION = 'staffSalaries';
const STAFF_COLLECTION = 'staff';
const USERS_COLLECTION = 'users';

/** Strips `undefined` values from objects before Firestore writes */
function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        cleaned[key] = cleanFirestoreData(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item
        );
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export const staffPayrollService = {
  // ─────────────────────────────────────────────────────────────
  // 1. ATTENDANCE MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Real-time subscription to attendance for a specific date (YYYY-MM-DD)
   */
  subscribeAttendanceByDate: (
    date: string,
    callback: (records: StaffAttendance[]) => void
  ): Unsubscribe => {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('date', '==', date)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as StaffAttendance[];
        callback(records);
      },
      (error) => {
        console.error('Error subscribing to daily attendance:', error);
        callback([]);
      }
    );
  },

  /**
   * Real-time subscription to monthly attendance records for a staff member
   */
  subscribeAttendanceByStaffAndMonth: (
    staffId: string,
    month: string, // YYYY-MM
    callback: (records: StaffAttendance[]) => void
  ): Unsubscribe => {
    // Queries docs where staffId == staffId and date >= "YYYY-MM-01" and date <= "YYYY-MM-31"
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('staffId', '==', staffId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as StaffAttendance[];
        callback(records);
      },
      (error) => {
        console.error('Error subscribing to staff monthly attendance:', error);
        callback([]);
      }
    );
  },

  /**
   * Real-time subscription to monthly attendance records for all staff in a given month (YYYY-MM)
   */
  subscribeMonthlyAttendance: (
    month: string, // YYYY-MM
    callback: (records: StaffAttendance[]) => void
  ): Unsubscribe => {
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as StaffAttendance[];
        callback(records);
      },
      (error) => {
        console.error('Error subscribing to monthly attendance:', error);
        callback([]);
      }
    );
  },

  /**
   * Mark attendance for a single staff member on a date
   */
  markAttendance: async (params: {
    staffId: string;
    staffName: string;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    notes?: string;
    markedBy?: string;
  }): Promise<void> => {
    const docId = `att_${params.staffId}_${params.date}`;
    const docRef = doc(db, ATTENDANCE_COLLECTION, docId);

    const data: Partial<StaffAttendance> = {
      id: docId,
      staffId: params.staffId,
      staffName: params.staffName,
      date: params.date,
      status: params.status,
      checkInTime: params.checkInTime || (params.status === 'PRESENT' || params.status === 'HALF_DAY' ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : undefined),
      checkOutTime: params.checkOutTime || undefined,
      notes: params.notes || '',
      markedBy: params.markedBy || 'ADMIN',
      updatedAt: new Date().toISOString(),
    };

    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      data.createdAt = new Date().toISOString();
    }

    await setDoc(docRef, cleanFirestoreData({
      ...data,
      serverUpdatedAt: serverTimestamp(),
    }), { merge: true });
  },

  /**
   * Batch mark attendance for multiple staff members (e.g. Mark All Present)
   */
  batchMarkAttendance: async (
    date: string,
    staffList: Staff[],
    status: AttendanceStatus,
    markedBy?: string
  ): Promise<void> => {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    const timeStr = status === 'PRESENT' || status === 'HALF_DAY' 
      ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
      : undefined;

    staffList.forEach((s) => {
      const staffKey = s.staffId || s.id;
      const docId = `att_${staffKey}_${date}`;
      const docRef = doc(db, ATTENDANCE_COLLECTION, docId);
      batch.set(
        docRef,
        cleanFirestoreData({
          id: docId,
          staffId: staffKey,
          staffName: s.name,
          date,
          status,
          checkInTime: timeStr,
          markedBy: markedBy || 'ADMIN',
          updatedAt: now,
          serverUpdatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    });

    await batch.commit();
  },

  /**
   * Calculate monthly attendance breakdown for a staff member
   */
  getMonthlyAttendanceSummary: async (
    staffId: string,
    month: string // YYYY-MM
  ): Promise<MonthlyAttendanceSummary> => {
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const [year, m] = month.split('-').map((x) => parseInt(x, 10));
    // Number of days in the specific month
    const totalDaysInMonth = new Date(year, m, 0).getDate();

    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('staffId', '==', staffId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    const snapshot = await getDocs(q);
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let leaveDays = 0;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as StaffAttendance;
      if (data.status === 'PRESENT') presentDays++;
      else if (data.status === 'HALF_DAY') halfDays++;
      else if (data.status === 'ABSENT') absentDays++;
      else if (data.status === 'LEAVE') leaveDays++;
    });

    const recordedDays = presentDays + halfDays + absentDays + leaveDays;
    const unmarkedDays = Math.max(0, totalDaysInMonth - recordedDays);
    const payableDays = presentDays + halfDays * 0.5;

    return {
      totalDaysInMonth,
      presentDays,
      halfDays,
      absentDays,
      leaveDays,
      unmarkedDays,
      payableDays,
    };
  },

  // ─────────────────────────────────────────────────────────────
  // 2. ADVANCES MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Real-time subscription to all staff advances
   */
  subscribeAllAdvances: (callback: (advances: StaffAdvance[]) => void): Unsubscribe => {
    const q = collection(db, ADVANCES_COLLECTION);
    return onSnapshot(
      q,
      (snapshot) => {
        const advances = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as StaffAdvance[];

        advances.sort((a, b) => {
          const timeA = new Date(a.date || a.createdAt || 0).getTime();
          const timeB = new Date(b.date || b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        callback(advances);
      },
      (error) => {
        console.error('Error subscribing to staff advances:', error);
        callback([]);
      }
    );
  },

  /**
   * Record a new advance given to staff member
   */
  recordAdvance: async (params: {
    staffId: string;
    staffName: string;
    amount: number;
    date: string; // YYYY-MM-DD
    reason?: string;
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
    notes?: string;
    approvedBy?: string;
  }): Promise<StaffAdvance> => {
    const timestamp = Date.now();
    const dateCode = params.date.replace(/-/g, '').slice(2);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const advanceNumber = `ADV-${dateCode}-${randomSuffix}`;
    const advanceId = `adv_${params.staffId}_${timestamp}`;

    const newAdvance: StaffAdvance = {
      id: advanceId,
      advanceNumber,
      staffId: params.staffId,
      staffName: params.staffName,
      amount: Number(params.amount),
      date: params.date,
      reason: params.reason || 'Personal / Emergency',
      paymentMode: params.paymentMode,
      status: 'ACTIVE',
      amountRepaid: 0,
      remainingAmount: Number(params.amount),
      repayments: [],
      notes: params.notes || '',
      approvedBy: params.approvedBy || 'ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = doc(db, ADVANCES_COLLECTION, advanceId);
    await setDoc(docRef, cleanFirestoreData({
      ...newAdvance,
      serverCreatedAt: serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    }));

    // Update staff doc cache for total outstanding advance
    await staffPayrollService.recalculateStaffAdvanceTotal(params.staffId);

    return newAdvance;
  },

  /**
   * Record a repayment or deduction against an advance
   */
  recordAdvanceRepayment: async (params: {
    advanceId: string;
    amount: number;
    date: string; // YYYY-MM-DD
    type: 'CASH_RETURN' | 'SALARY_DEDUCTION' | 'ONLINE_RETURN';
    salarySlipId?: string;
    notes?: string;
  }): Promise<void> => {
    const docRef = doc(db, ADVANCES_COLLECTION, params.advanceId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Advance record not found.');
    }

    const advance = snap.data() as StaffAdvance;
    const currentRepaid = Number(advance.amountRepaid || 0);
    const totalAmount = Number(advance.amount || 0);
    const newRepaymentAmount = Number(params.amount);

    if (newRepaymentAmount <= 0) {
      throw new Error('Repayment amount must be greater than zero.');
    }

    const updatedRepaid = currentRepaid + newRepaymentAmount;
    const remaining = Math.max(0, totalAmount - updatedRepaid);
    let newStatus: AdvanceStatus = 'ACTIVE';

    if (remaining === 0) {
      newStatus = params.type === 'SALARY_DEDUCTION' ? 'DEDUCTED_FROM_SALARY' : 'REPAID';
    } else if (updatedRepaid > 0) {
      newStatus = 'PARTIALLY_REPAID';
    }

    const repaymentEntry: StaffAdvanceRepayment = {
      id: `rep_${Date.now()}`,
      amount: newRepaymentAmount,
      date: params.date,
      type: params.type,
      salarySlipId: params.salarySlipId,
      notes: params.notes || '',
      createdAt: new Date().toISOString(),
    };

    const existingRepayments = advance.repayments || [];
    const updatedRepayments = [repaymentEntry, ...existingRepayments];

    await updateDoc(docRef, cleanFirestoreData({
      amountRepaid: updatedRepaid,
      remainingAmount: remaining,
      status: newStatus,
      repayments: updatedRepayments,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    }));

    // Update staff cached total advance outstanding
    await staffPayrollService.recalculateStaffAdvanceTotal(advance.staffId);
  },

  /**
   * Recalculate total outstanding advance for a staff member and update the staff document
   */
  recalculateStaffAdvanceTotal: async (staffId: string): Promise<number> => {
    try {
      const q = query(
        collection(db, ADVANCES_COLLECTION),
        where('staffId', '==', staffId)
      );
      const snap = await getDocs(q);
      let totalRemaining = 0;

      snap.docs.forEach((d) => {
        const adv = d.data() as StaffAdvance;
        if (adv.status === 'ACTIVE' || adv.status === 'PARTIALLY_REPAID') {
          totalRemaining += Number(adv.remainingAmount || 0);
        }
      });

      const staffRef = doc(db, STAFF_COLLECTION, staffId);
      const staffSnap = await getDoc(staffRef);
      if (staffSnap.exists()) {
        await updateDoc(staffRef, {
          totalAdvanceOutstanding: totalRemaining,
          updatedAt: new Date().toISOString(),
        });
      }

      return totalRemaining;
    } catch (e) {
      console.warn('Failed to recalculate staff advance total:', e);
      return 0;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 3. SALARY & PAYROLL MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Real-time subscription to monthly salary slips for all staff
   */
  subscribeSalarySlipsByMonth: (
    month: string, // YYYY-MM
    callback: (slips: StaffSalarySlip[]) => void
  ): Unsubscribe => {
    const q = query(
      collection(db, SALARIES_COLLECTION),
      where('month', '==', month)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const slips = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as StaffSalarySlip[];
        callback(slips);
      },
      (error) => {
        console.error('Error subscribing to monthly salary slips:', error);
        callback([]);
      }
    );
  },

  /**
   * Update base salary configuration on staff profile
   */
  updateStaffSalaryConfig: async (
    staffId: string,
    userId: string | undefined,
    monthlySalary: number,
    salaryType: 'MONTHLY' | 'DAILY' = 'MONTHLY',
    dailyRate?: number
  ): Promise<void> => {
    const calculatedDaily = dailyRate || Math.round(monthlySalary / 30);
    const timestamp = serverTimestamp();
    const now = new Date().toISOString();

    const staffRef = doc(db, STAFF_COLLECTION, staffId);
    await updateDoc(staffRef, {
      monthlySalary,
      salaryType,
      dailyRate: calculatedDaily,
      updatedAt: now,
      serverUpdatedAt: timestamp,
    });

    const targetUserId = userId || staffId;
    try {
      const userRef = doc(db, USERS_COLLECTION, targetUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          monthlySalary,
          salaryType,
          dailyRate: calculatedDaily,
          updatedAt: now,
        });
      }
    } catch (e) {
      console.warn('Could not update user salary config:', e);
    }
  },

  /**
   * Save / Upsert a generated salary slip
   */
  saveSalarySlip: async (slip: StaffSalarySlip): Promise<void> => {
    const docId = slip.id || `sal_${slip.staffId}_${slip.month}`;
    const docRef = doc(db, SALARIES_COLLECTION, docId);

    const snap = await getDoc(docRef);
    const isNew = !snap.exists();

    await setDoc(
      docRef,
      cleanFirestoreData({
        ...slip,
        id: docId,
        createdAt: isNew ? new Date().toISOString() : (slip.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  },

  /**
   * Mark salary slip as Disbursed / Paid, and automatically record advance deductions if any
   */
  markSalaryDisbursed: async (params: {
    slipId: string;
    paidAmount: number;
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
    paymentDate: string; // YYYY-MM-DD
    transactionRef?: string;
    notes?: string;
  }): Promise<void> => {
    const docRef = doc(db, SALARIES_COLLECTION, params.slipId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Salary slip not found.');
    }

    const slip = snap.data() as StaffSalarySlip;
    const isFull = params.paidAmount >= slip.netPayableSalary;
    const newStatus: SalaryPaymentStatus = isFull ? 'PAID' : 'PARTIAL';

    // Update Salary Slip
    await updateDoc(docRef, cleanFirestoreData({
      status: newStatus,
      paidAmount: params.paidAmount,
      paymentMode: params.paymentMode,
      paymentDate: params.paymentDate,
      transactionRef: params.transactionRef || '',
      notes: params.notes || slip.notes || '',
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    }));

    // If advance was deducted, apply deduction to the staff's active advances
    if (slip.advanceDeducted && slip.advanceDeducted > 0) {
      try {
        let deductionToApply = slip.advanceDeducted;
        const qAdv = query(
          collection(db, ADVANCES_COLLECTION),
          where('staffId', '==', slip.staffId)
        );
        const advSnap = await getDocs(qAdv);
        const activeAdvances = advSnap.docs
          .map((d) => ({ ...d.data(), id: d.id } as StaffAdvance))
          .filter((a) => a.status === 'ACTIVE' || a.status === 'PARTIALLY_REPAID')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const adv of activeAdvances) {
          if (deductionToApply <= 0) break;
          const remainingInAdv = adv.remainingAmount || (adv.amount - adv.amountRepaid);
          const applyHere = Math.min(remainingInAdv, deductionToApply);

          if (applyHere > 0) {
            await staffPayrollService.recordAdvanceRepayment({
              advanceId: adv.id,
              amount: applyHere,
              date: params.paymentDate,
              type: 'SALARY_DEDUCTION',
              salarySlipId: slip.id,
              notes: `Deducted from Salary (${slip.month})`,
            });
            deductionToApply -= applyHere;
          }
        }
      } catch (err) {
        console.error('Error applying advance deduction to advance records:', err);
      }
    }
  },
};
