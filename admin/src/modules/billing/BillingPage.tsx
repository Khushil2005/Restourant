import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { Bill, Payment } from '../../types';
import {
  Receipt,
  CreditCard,
  Scissors,
  Printer,
  Eye,
  Download,
  Plus,
  CheckCircle2,
  QrCode,
  Banknote,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { generateInvoicePdf, printInvoiceReceipt } from '../../utils/invoicePdf';
import {
  getPrintSettings,
  playPaymentChime,
  PrintAndBillSettings
} from '../../utils/printSettings';

// Date helpers for Day-Wise List ("New Day New List")
const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const todayStr = getLocalDateString(new Date());
  const yestStr = getYesterdayDateString();
  if (dateStr === todayStr) {
    return `Today (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
  }
  if (dateStr === yestStr) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `Yesterday (${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
  }
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

interface BillingPageProps {
  defaultTab?: 'invoices' | 'payments';
}

export const BillingPage: React.FC<BillingPageProps> = ({ defaultTab = 'invoices' }) => {
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Print & Bill Settings (managed centrally in Store Settings)
  const [settings, setSettings] = useState<PrintAndBillSettings>(getPrintSettings());

  useEffect(() => {
    const handleStorage = () => setSettings(getPrintSettings());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Day-wise List Filter States ("New Day New List")
  const [dateFilterMode, setDateFilterMode] = useState<'TODAY' | 'YESTERDAY' | 'CUSTOM' | 'ALL'>('TODAY');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

  // Active Main Tab: 'invoices' or 'payments'
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>(
    searchParams.get('tab') === 'payments' || defaultTab === 'payments' ? 'payments' : 'invoices'
  );

  // Invoices Filter: 'ALL' | 'UNPAID' | 'PAID'
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  // Data lists
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Bill View & Print Modal
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const dismissedBillIdRef = useRef<string | null>(null);

  // In-Place Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Cash Tendered calculator
  const [tenderedCash, setTenderedCash] = useState<number>(0);

  // Split amounts
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [splitCard, setSplitCard] = useState<number>(0);

  // Post-payment success modal
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);

  // Split Bill Modal
  const [splitBillItem, setSplitBillItem] = useState<Bill | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);

  // Quick Bill for Active Table Modal
  const [isBillTableModalOpen, setIsBillTableModalOpen] = useState(false);
  const [activeTables, setActiveTables] = useState<any[]>([]);
  const [generatingForOrderId, setGeneratingForOrderId] = useState<string | null>(null);

  // Load Invoices
  const loadBills = async (showSpinner = false, forceFresh = false) => {
    if (showSpinner || bills.length === 0) {
      setLoading(true);
    }
    try {
      const config = forceFresh ? { forceFresh: true } : undefined;
      const res: any = await apiClient.get('/billing', config);
      if (res?.success) {
        setBills(res.data);

        // Check if query parameter requests opening bill preview
        const qBillId = searchParams.get('billId');
        if (qBillId && dismissedBillIdRef.current !== qBillId) {
          const found = res.data.find((b: Bill) => b.id === qBillId);
          if (found) {
            setSelectedBill(found);
            dismissedBillIdRef.current = qBillId;
          }
        }

        // Check if query parameter requests opening payment settlement directly
        const qPayBillId = searchParams.get('payBillId');
        if (qPayBillId && !isPayModalOpen) {
          const target = res.data.find((b: Bill) => b.id === qPayBillId);
          if (target && target.status !== 'PAID') {
            openPaymentModal(target);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Payments History
  const loadPayments = async () => {
    try {
      const res: any = await apiClient.get('/payments');
      if (res?.success) {
        setPayments(res.data);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  };

  // Initial Load
  useEffect(() => {
    loadBills(false, true);
    loadPayments();
  }, []);

  // Real-time Auto-Refresh every 4 seconds
  useAutoRefresh(
    () => {
      loadBills(false, true);
      loadPayments();
    },
    {
      entities: ['billing', 'orders', 'payment', 'tables'],
      intervalMs: 4000,
      refreshOnFocus: true
    }
  );

  // Day navigation handlers
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 1);
    const prevStr = getLocalDateString(prev);
    setSelectedDate(prevStr);
    const todayStr = getLocalDateString();
    const yestStr = getYesterdayDateString();
    setDateFilterMode(prevStr === todayStr ? 'TODAY' : prevStr === yestStr ? 'YESTERDAY' : 'CUSTOM');
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    const nextStr = getLocalDateString(next);
    setSelectedDate(nextStr);
    const todayStr = getLocalDateString();
    const yestStr = getYesterdayDateString();
    setDateFilterMode(nextStr === todayStr ? 'TODAY' : nextStr === yestStr ? 'YESTERDAY' : 'CUSTOM');
  };

  const handleSetToday = () => {
    setDateFilterMode('TODAY');
    setSelectedDate(getLocalDateString());
  };

  const handleSetYesterday = () => {
    setDateFilterMode('YESTERDAY');
    setSelectedDate(getYesterdayDateString());
  };

  const handleSetCustomDate = (val: string) => {
    if (!val) return;
    setSelectedDate(val);
    const todayStr = getLocalDateString();
    const yestStr = getYesterdayDateString();
    setDateFilterMode(val === todayStr ? 'TODAY' : val === yestStr ? 'YESTERDAY' : 'CUSTOM');
  };

  const handleSetAllTime = () => {
    setDateFilterMode('ALL');
  };

  // 1. Day-Filtered Bills ("New Day New List")
  const dayBills = useMemo(() => {
    if (dateFilterMode === 'ALL') return bills;
    return bills.filter((b) => {
      if (!b.createdAt) return false;
      const bDate = getLocalDateString(new Date(b.createdAt));
      return bDate === selectedDate;
    });
  }, [bills, dateFilterMode, selectedDate]);

  // 2. Day-Filtered Payments
  const dayPayments = useMemo(() => {
    if (dateFilterMode === 'ALL') return payments;
    return payments.filter((p) => {
      if (!p.createdAt) return false;
      const pDate = getLocalDateString(new Date(p.createdAt));
      return pDate === selectedDate;
    });
  }, [payments, dateFilterMode, selectedDate]);

  // 3. Sub-filtered Bills (ALL | UNPAID | PAID)
  const filteredBills = useMemo(() => {
    if (invoiceFilter === 'UNPAID') {
      return dayBills.filter((b) => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID');
    }
    if (invoiceFilter === 'PAID') {
      return dayBills.filter((b) => b.status === 'PAID');
    }
    return dayBills;
  }, [dayBills, invoiceFilter]);

  // Top Summary Metric Totals (Count AND Price for each card)
  const totalBillsCount = dayBills.length;
  const totalBillsValue = useMemo(() => {
    return dayBills.reduce((acc, b) => acc + (b.totalPayable || 0), 0);
  }, [dayBills]);

  const unpaidBillsCount = useMemo(() => {
    return dayBills.filter((b) => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID').length;
  }, [dayBills]);

  const totalPendingAmount = useMemo(() => {
    return dayBills
      .filter((b) => b.status !== 'PAID')
      .reduce((acc, b) => acc + (b.balanceAmount !== undefined ? b.balanceAmount : b.totalPayable || 0), 0);
  }, [dayBills]);

  const paidBillsCount = useMemo(() => {
    return dayBills.filter((b) => b.status === 'PAID').length;
  }, [dayBills]);

  const totalRevenue = useMemo(() => {
    return dayBills
      .filter((b) => b.status === 'PAID')
      .reduce((acc, b) => acc + (b.paidAmount || b.totalPayable || 0), 0);
  }, [dayBills]);

  const totalPaymentsCount = dayPayments.length;
  const totalCollectedAmount = useMemo(() => {
    return dayPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  // Detailed Invoices Breakdown (Spacious Summary Strip)
  const invoicesSubtotal = useMemo(() => {
    return dayBills.reduce((acc, b) => acc + (b.subtotal || 0), 0);
  }, [dayBills]);

  const invoicesGst = useMemo(() => {
    return dayBills.reduce((acc, b) => acc + (b.taxAmount || 0), 0);
  }, [dayBills]);

  // Detailed Receipts Breakdown (Spacious Summary Strip)
  const cashPaymentsTotal = useMemo(() => {
    return dayPayments.filter((p) => p.paymentMethod === 'CASH').reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  const upiPaymentsTotal = useMemo(() => {
    return dayPayments.filter((p) => p.paymentMethod === 'UPI').reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  const cardPaymentsTotal = useMemo(() => {
    return dayPayments.filter((p) => p.paymentMethod === 'CARD').reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  const otherPaymentsTotal = useMemo(() => {
    return dayPayments
      .filter((p) => p.paymentMethod !== 'CASH' && p.paymentMethod !== 'UPI' && p.paymentMethod !== 'CARD')
      .reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  // Open in-place payment dialog
  const openPaymentModal = (bill: Bill) => {
    const dueAmount = bill.balanceAmount !== undefined ? bill.balanceAmount : bill.totalPayable;
    setPayingBill(bill);
    setPayAmount(dueAmount);
    setPaymentMethod('CASH');
    setReferenceNumber('');
    setTenderedCash(dueAmount);
    setSplitCash(dueAmount);
    setSplitUpi(0);
    setSplitCard(0);
    setIsPayModalOpen(true);
  };

  // Handle Close Bill View Modal
  const handleCloseBillModal = () => {
    setSelectedBill(null);
    const qBillId = searchParams.get('billId');
    if (qBillId) {
      dismissedBillIdRef.current = qBillId;
      navigate('/billing', { replace: true });
    }
  };

  // Handle Payment Settlement Process
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;

    try {
      setIsProcessingPayment(true);
      let transactions = undefined;
      if (paymentMethod === 'SPLIT') {
        const totalSplit = splitCash + splitUpi + splitCard;
        if (totalSplit !== payAmount) {
          alert(`Split totals (₹${totalSplit}) must equal exact bill amount (₹${payAmount}).`);
          setIsProcessingPayment(false);
          return;
        }
        transactions = [
          { method: 'CASH', amount: splitCash },
          { method: 'UPI', amount: splitUpi },
          { method: 'CARD', amount: splitCard }
        ].filter(t => t.amount > 0);
      }

      const res: any = await apiClient.post('/payments', {
        billId: payingBill.id,
        amount: payAmount,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        transactions
      });

      if (res?.success) {
        setIsPayModalOpen(false);

        // Fetch refreshed bill to print receipt and offer PDF download
        let settledBill: Bill = { ...payingBill, status: 'PAID', paidAmount: payAmount, balanceAmount: 0 };
        try {
          const bRes: any = await apiClient.get(`/billing/${payingBill.id}`);
          if (bRes?.success && bRes.data) {
            settledBill = bRes.data;
          }
        } catch (_) {}

        // 1. Check Auto-Print on Payment Setting
        if (settings.autoPrintOnPayment) {
          printInvoiceReceipt(settledBill, settings);
        }

        // 2. Check Auto-Download PDF on Payment Setting
        if (settings.autoDownloadPdfOnPayment) {
          generateInvoicePdf(settledBill, { download: true, customSettings: settings });
        }

        // 3. Audio Chime Confirmation
        if (settings.playPaymentSound) {
          playPaymentChime();
        }

        // 4. Open confirmation modal
        setCompletedBill(settledBill);

        // 5. Refresh lists
        loadBills(false, true);
        loadPayments();

        // Clear query parameters if any
        if (searchParams.get('payBillId')) {
          navigate('/billing', { replace: true });
        }
      }
    } catch (err: any) {
      alert(err.message || 'Payment processing failed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle Splitting Bill
  const handleSplitBill = async () => {
    if (!splitBillItem) return;
    try {
      await apiClient.post(`/billing/${splitBillItem.id}/split`, { splitCount });
      alert(`Bill split into ${splitCount} equal invoices.`);
      setSplitBillItem(null);
      loadBills(false, true);
    } catch (err: any) {
      alert(err.message || 'Failed to split bill.');
    }
  };

  // Load Occupied Tables with Active Orders
  const loadActiveTables = async () => {
    try {
      const res: any = await apiClient.get('/tables/floor-layout', { forceFresh: true });
      if (res?.success && Array.isArray(res.data)) {
        setActiveTables(res.data.filter((t: any) => t.status === 'OCCUPIED' && t.activeOrder));
      }
    } catch (_) {}
  };

  // Generate Bill for an Active Table Order
  const handleGenerateBillForOrder = async (orderId: string) => {
    setGeneratingForOrderId(orderId);
    try {
      const res: any = await apiClient.post('/billing/generate', { orderId });
      setIsBillTableModalOpen(false);
      await loadBills(false, true);
      if (res?.data) {
        setSelectedBill(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate bill for table.');
    } finally {
      setGeneratingForOrderId(null);
    }
  };

  // Download PDF from payment history
  const handleDownloadPaymentPdf = async (billId: string) => {
    try {
      const res: any = await apiClient.get(`/billing/${billId}`);
      if (res?.success && res.data) {
        generateInvoicePdf(res.data, { download: true, customSettings: settings });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to download invoice PDF.');
    }
  };

  // Print Receipt from payment history
  const handlePrintPaymentReceipt = async (billId: string) => {
    try {
      const res: any = await apiClient.get(`/billing/${billId}`);
      if (res?.success && res.data) {
        printInvoiceReceipt(res.data, settings);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to print receipt.');
    }
  };

  const changeReturn = Math.max(0, tenderedCash - payAmount);

  return (
    <div className="d-flex flex-column gap-2" style={{ fontSize: '0.85rem' }}>
      {/* Top Header Bar (Responsive & Clean, without Settings button) */}
      <div className="card shadow-sm border-0">
        <div className="card-body p-2.5 px-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
          <div className="d-flex align-items-center gap-2.5">
            <div className="bg-primary-subtle text-primary p-2 rounded-2 d-flex align-items-center justify-content-center shadow-sm" style={{ width: 36, height: 36 }}>
              <Receipt size={20} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h6 className="fw-bold mb-0 text-dark">Billing & Payments</h6>
                <span className="badge bg-light text-secondary border px-1.5 py-0.5" style={{ fontSize: '0.7rem' }}>
                  Daily Register & Settlements
                </span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5" style={{ fontSize: '0.7rem' }}>
                  {dateFilterMode === 'ALL' ? 'All Time' : formatDisplayDate(selectedDate)}
                </span>
              </div>
              <div className="text-muted small mt-0.5" style={{ fontSize: '0.72rem' }}>
                Day-wise invoice register, table order settlement & thermal slip printing
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 w-100 w-sm-auto justify-content-end">
            {/* Quick Bill Active Table */}
            {can('billing.create') && (
              <button
                className="btn btn-primary btn-sm py-1.5 px-3 d-flex align-items-center justify-content-center gap-1.5 shadow-sm fw-bold w-100 w-sm-auto"
                style={{ fontSize: '0.8rem' }}
                onClick={() => {
                  loadActiveTables();
                  setIsBillTableModalOpen(true);
                }}
              >
                <Plus size={15} /> Bill Active Table
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 TOP SUMMARY METRIC CARDS: Count AND Total Price / Value for Each */}
      <div className="row g-2 g-md-3 mb-1">
        {/* Card 1: Total Invoices / Orders */}
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body p-2.5 p-sm-3 d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="text-secondary fw-semibold small" style={{ fontSize: '0.78rem' }}>
                  Total Invoices & Orders
                </span>
                <div className="p-1.5 rounded-2 bg-primary-subtle text-primary d-flex align-items-center justify-content-center" style={{ width: 28, height: 28 }}>
                  <Receipt size={16} />
                </div>
              </div>
              <div>
                <div className="fs-5 fs-sm-4 fw-bold text-dark mb-0.5">
                  ₹{totalBillsValue.toLocaleString()}
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                  <span className="badge bg-primary text-white" style={{ fontSize: '0.68rem' }}>
                    {totalBillsCount} Bills / Orders
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    Gross billing
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Unpaid Bills */}
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body p-2.5 p-sm-3 d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="text-secondary fw-semibold small" style={{ fontSize: '0.78rem' }}>
                  Pending Amount (બાકી)
                </span>
                <div className="p-1.5 rounded-2 bg-danger-subtle text-danger d-flex align-items-center justify-content-center" style={{ width: 28, height: 28 }}>
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <div className="fs-5 fs-sm-4 fw-bold text-danger mb-0.5">
                  ₹{totalPendingAmount.toLocaleString()}
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                  <span className="badge bg-danger text-white" style={{ fontSize: '0.68rem' }}>
                    {unpaidBillsCount} Pending Bills
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    Awaiting payment
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Settled Paid Revenue */}
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body p-2.5 p-sm-3 d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="text-secondary fw-semibold small" style={{ fontSize: '0.78rem' }}>
                  Settled Revenue (ચૂકવાયેલ)
                </span>
                <div className="p-1.5 rounded-2 bg-success-subtle text-success d-flex align-items-center justify-content-center" style={{ width: 28, height: 28 }}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div>
                <div className="fs-5 fs-sm-4 fw-bold text-success mb-0.5">
                  ₹{totalRevenue.toLocaleString()}
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                  <span className="badge bg-success text-white" style={{ fontSize: '0.68rem' }}>
                    {paidBillsCount} Paid Bills
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    Fully cleared
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Collections & Receipts */}
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body p-2.5 p-sm-3 d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="text-secondary fw-semibold small" style={{ fontSize: '0.78rem' }}>
                  Collections (કુલ વસૂલાત)
                </span>
                <div className="p-1.5 rounded-2 bg-warning-subtle text-warning-emphasis d-flex align-items-center justify-content-center" style={{ width: 28, height: 28 }}>
                  <Banknote size={16} />
                </div>
              </div>
              <div>
                <div className="fs-5 fs-sm-4 fw-bold text-dark mb-0.5">
                  ₹{totalCollectedAmount.toLocaleString()}
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                  <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.68rem' }}>
                    {totalPaymentsCount} Receipts
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    Cash / UPI / Card
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Day Wise Filter & Navigator Bar ("New Day New List") */}
      <div className="card shadow-sm border-0 mb-1">
        <div className="card-body p-2 px-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          {/* Quick Date Pills */}
          <div className="d-flex align-items-center gap-1.5 flex-wrap">
            <span className="text-muted small d-none d-sm-inline me-1" style={{ fontSize: '0.75rem' }}>
              <Calendar size={13} className="me-1" />
              Day Filter:
            </span>
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 ${dateFilterMode === 'TODAY' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'}`}
              style={{ fontSize: '0.75rem', borderRadius: 6 }}
              onClick={handleSetToday}
            >
              Today (આજે)
            </button>
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 ${dateFilterMode === 'YESTERDAY' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'}`}
              style={{ fontSize: '0.75rem', borderRadius: 6 }}
              onClick={handleSetYesterday}
            >
              Yesterday (ગઈકાલે)
            </button>
            <button
              type="button"
              className={`btn btn-sm py-1 px-2.5 ${dateFilterMode === 'ALL' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'}`}
              style={{ fontSize: '0.75rem', borderRadius: 6 }}
              onClick={handleSetAllTime}
            >
              All Time (તમામ દિવસો)
            </button>
          </div>

          {/* Date Picker & Day Steppers (< Prev Day | Date | Next Day >) */}
          <div className="d-flex align-items-center gap-1.5 ms-auto flex-wrap">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
              style={{ width: 28, height: 28 }}
              onClick={handlePrevDay}
              title="Previous Day"
              disabled={dateFilterMode === 'ALL'}
            >
              <ChevronLeft size={16} />
            </button>

            <div className="d-flex align-items-center gap-1 bg-light border rounded px-2 py-0.5">
              <input
                type="date"
                className="form-control form-control-sm border-0 bg-transparent p-0 fw-bold text-dark"
                style={{ width: 125, fontSize: '0.75rem', boxShadow: 'none' }}
                value={selectedDate}
                onChange={(e) => handleSetCustomDate(e.target.value)}
                disabled={dateFilterMode === 'ALL'}
              />
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
              style={{ width: 28, height: 28 }}
              onClick={handleNextDay}
              title="Next Day"
              disabled={dateFilterMode === 'ALL'}
            >
              <ChevronRight size={16} />
            </button>

            <span className="badge bg-light text-secondary border ms-1 py-1 px-2" style={{ fontSize: '0.72rem' }}>
              {dateFilterMode === 'ALL' ? 'Showing All Time Records' : formatDisplayDate(selectedDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs & Filter Bar (Compact & Space-Saving) */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-1 px-1">
        <ul className="nav nav-pills gap-1.5 mb-0">
          <li className="nav-item">
            <button
              className={`nav-link py-1 px-2.5 d-flex align-items-center gap-1.5 ${
                activeTab === 'invoices' ? 'active shadow-sm fw-bold' : 'text-secondary bg-white border'
              }`}
              style={{ fontSize: '0.78rem', borderRadius: 6 }}
              onClick={() => setActiveTab('invoices')}
            >
              <Receipt size={14} />
              Invoices & Billing
              <span className={`badge ${activeTab === 'invoices' ? 'bg-light text-primary' : 'bg-secondary'}`} style={{ fontSize: '0.68rem' }}>
                {dayBills.length}
              </span>
              {unpaidBillsCount > 0 && (
                <span className="badge bg-danger text-white rounded-pill px-1.5" style={{ fontSize: '0.68rem' }}>
                  {unpaidBillsCount} Unpaid
                </span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link py-1 px-2.5 d-flex align-items-center gap-1.5 ${
                activeTab === 'payments' ? 'active shadow-sm fw-bold' : 'text-secondary bg-white border'
              }`}
              style={{ fontSize: '0.78rem', borderRadius: 6 }}
              onClick={() => setActiveTab('payments')}
            >
              <CreditCard size={14} />
              Receipts History
              <span className={`badge ${activeTab === 'payments' ? 'bg-light text-primary' : 'bg-secondary'}`} style={{ fontSize: '0.68rem' }}>
                {dayPayments.length}
              </span>
            </button>
          </li>
        </ul>

        {/* Invoices Sub-Filter Buttons */}
        {activeTab === 'invoices' && (
          <div className="btn-group btn-group-sm shadow-sm" style={{ height: 28 }}>
            <button
              className={`btn py-0 px-2 ${invoiceFilter === 'ALL' ? 'btn-dark fw-bold' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setInvoiceFilter('ALL')}
            >
              All ({dayBills.length})
            </button>
            <button
              className={`btn py-0 px-2 ${invoiceFilter === 'UNPAID' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setInvoiceFilter('UNPAID')}
            >
              Pending ({unpaidBillsCount})
            </button>
            <button
              className={`btn py-0 px-2 ${invoiceFilter === 'PAID' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setInvoiceFilter('PAID')}
            >
              Settled ({paidBillsCount})
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: INVOICES & BILLING */}
      {activeTab === 'invoices' && (
        <>
          {/* Spacious Invoices Breakdown Summary Strip (Clear Space & Visibility) */}
          <div className="card shadow-sm border-0 mb-2 bg-white">
            <div className="card-body py-2.5 px-3">
              <div className="row g-2 align-items-center text-center text-sm-start">
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Invoices Count</span>
                  <span className="fw-bold text-dark fs-6">{totalBillsCount}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Subtotal</span>
                  <span className="fw-bold text-dark fs-6">₹{invoicesSubtotal.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>GST (5%)</span>
                  <span className="fw-bold text-dark fs-6">₹{invoicesGst.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Total Payable</span>
                  <span className="fw-bold text-primary fs-6">₹{totalBillsValue.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Paid Amount</span>
                  <span className="fw-bold text-success fs-6">₹{totalRevenue.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Balance Due</span>
                  <span className={`fw-bold fs-6 ${totalPendingAmount > 0 ? 'text-danger' : 'text-muted'}`}>
                    ₹{totalPendingAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DataTable<Bill>
          compact={true}
          columns={[
            {
              header: 'Bill #',
              accessor: (row) => <span className="fw-bold text-dark">{row.billNumber}</span>,
              width: 110
            },
            {
              header: 'Table',
              accessor: (row) => (
                <span className="badge bg-light text-dark border px-1.5 py-0.5" style={{ fontSize: '0.72rem' }}>
                  {row.tableNumber || 'Takeaway'}
                </span>
              ),
              width: 75
            },
            {
              header: 'Guest',
              accessor: (row) => (
                <span className="text-truncate d-inline-block" style={{ maxWidth: 110 }}>
                  {row.customerName || 'Walk-in'}
                </span>
              ),
              width: 110
            },
            {
              header: 'Subtotal',
              accessor: (row) => `₹${row.subtotal}`,
              width: 75
            },
            {
              header: 'GST (5%)',
              accessor: (row) => `₹${row.taxAmount}`,
              width: 75
            },
            {
              header: 'Payable',
              accessor: (row) => (
                <span className="fw-bold text-dark">₹{row.totalPayable}</span>
              ),
              width: 85
            },
            {
              header: 'Status',
              accessor: (row) => {
                if (row.status === 'PAID') {
                  return (
                    <span className="badge bg-success d-inline-flex align-items-center gap-1 px-1.5 py-0.5" style={{ fontSize: '0.7rem' }}>
                      <CheckCircle2 size={10} /> PAID
                    </span>
                  );
                }
                if (row.status === 'PARTIALLY_PAID') {
                  return <span className="badge bg-warning text-dark px-1.5 py-0.5" style={{ fontSize: '0.7rem' }}>PARTIAL</span>;
                }
                return (
                  <span className="badge bg-danger d-inline-flex align-items-center gap-1 px-1.5 py-0.5" style={{ fontSize: '0.7rem' }}>
                    <Clock size={10} /> UNPAID
                  </span>
                );
              },
              width: 80
            },
            {
              header: 'Date & Time',
              accessor: (row) => new Date(row.createdAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }),
              width: 105
            }
          ]}
          data={filteredBills}
          searchPlaceholder="Search invoices..."
          actions={(row) => (
            <div className="d-flex align-items-center gap-1 flex-nowrap">
              {/* PAY BUTTON */}
              {row.status !== 'PAID' && can('payment.create') && (
                <button
                  className="btn btn-success btn-sm py-0.5 px-1.5 d-flex align-items-center gap-0.5 fw-bold shadow-sm"
                  style={{ fontSize: '0.72rem' }}
                  onClick={() => openPaymentModal(row)}
                  title="Settle Payment"
                >
                  <CreditCard size={12} /> Pay
                </button>
              )}

              {/* View Slip */}
              <button
                className="btn btn-outline-primary btn-sm py-0.5 px-1.5 d-flex align-items-center gap-0.5"
                style={{ fontSize: '0.72rem' }}
                onClick={() => setSelectedBill(row)}
                title="View Receipt Slip"
              >
                <Eye size={12} /> View
              </button>

              {/* Download PDF */}
              <button
                className="btn btn-outline-danger btn-sm py-0.5 px-1.5 d-flex align-items-center gap-0.5"
                style={{ fontSize: '0.72rem' }}
                onClick={() => generateInvoicePdf(row, { download: true, customSettings: settings })}
                title={`Download ${settings.printReceiptFormat === 'A4' ? 'A4 Tax Invoice' : 'Thermal Slip'} PDF`}
              >
                <Download size={12} /> PDF
              </button>

              {/* Print Receipt */}
              <button
                className="btn btn-outline-secondary btn-sm py-0.5 px-1.5 d-flex align-items-center gap-0.5"
                style={{ fontSize: '0.72rem' }}
                onClick={() => printInvoiceReceipt(row, settings)}
                title="Print Thermal Receipt"
              >
                <Printer size={12} /> Print
              </button>

              {/* Split Bill */}
              {row.status === 'UNPAID' && can('billing.split') && (
                <button
                  className="btn btn-outline-secondary btn-sm py-0.5 px-1.5 d-flex align-items-center gap-0.5"
                  style={{ fontSize: '0.72rem' }}
                  onClick={() => setSplitBillItem(row)}
                  title="Split Bill into multiple checks"
                >
                  <Scissors size={12} /> Split
                </button>
              )}
            </div>
          )}
        />
        </>
      )}

      {/* TAB 2: PAYMENT RECEIPTS HISTORY */}
      {activeTab === 'payments' && (
        <>
          {/* Spacious Receipts Breakdown Summary Strip (Clear Space & Visibility) */}
          <div className="card shadow-sm border-0 mb-2 bg-white">
            <div className="card-body py-2.5 px-3">
              <div className="row g-2 align-items-center text-center text-sm-start">
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Total Receipts</span>
                  <span className="fw-bold text-dark fs-6">{totalPaymentsCount}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Cash Tendered</span>
                  <span className="fw-bold text-success fs-6">₹{cashPaymentsTotal.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>UPI QR Pay</span>
                  <span className="fw-bold text-primary fs-6">₹{upiPaymentsTotal.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Card POS</span>
                  <span className="fw-bold text-warning fs-6">₹{cardPaymentsTotal.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Split / Other</span>
                  <span className="fw-bold text-secondary fs-6">₹{otherPaymentsTotal.toLocaleString()}</span>
                </div>
                <div className="col-6 col-sm-4 col-md-2">
                  <span className="text-secondary d-block" style={{ fontSize: '0.72rem' }}>Grand Total Settled</span>
                  <span className="fw-bold text-success fs-6">₹{totalCollectedAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <DataTable<Payment>
            compact={true}
            columns={[
              {
                header: 'Payment #',
                accessor: (row) => <span className="fw-bold text-dark">{row.paymentNumber}</span>,
                width: 120
              },
              {
                header: 'Method',
                accessor: (row) => (
                  <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-1.5 py-0.5" style={{ fontSize: '0.72rem' }}>
                    {row.paymentMethod === 'CASH' && <Banknote size={12} className="text-success" />}
                    {row.paymentMethod === 'UPI' && <QrCode size={12} className="text-primary" />}
                    {row.paymentMethod === 'CARD' && <CreditCard size={12} className="text-warning" />}
                    {row.paymentMethod}
                  </span>
                ),
                width: 95
              },
              {
                header: 'Settled Amount',
                accessor: (row) => (
                  <span className="fw-bold text-success">₹{row.amount.toLocaleString()}</span>
                ),
                width: 95
              },
              {
                header: 'Reference / UTR',
                accessor: (row) => row.referenceNumber || '-',
                width: 120
              },
              {
                header: 'Date & Time',
                accessor: (row) => new Date(row.createdAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                width: 110
              },
              {
                header: 'Status',
                accessor: () => (
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-1.5 py-0.5" style={{ fontSize: '0.7rem' }}>
                    Settled
                  </span>
                ),
                width: 80
              }
            ]}
            data={dayPayments}
          searchPlaceholder="Search payments..."
          actions={(row) => (
            <div className="d-flex align-items-center gap-1">
              {row.billId && (
                <>
                  <button
                    className="btn btn-outline-danger btn-sm py-0.5 px-1.5 d-flex align-items-center gap-0.5"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => handleDownloadPaymentPdf(row.billId)}
                    title="Download PDF"
                  >
                    <Download size={12} /> PDF
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm py-0.5 px-1.5 d-flex align-items-center gap-0.5"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => handlePrintPaymentReceipt(row.billId)}
                    title="Print Receipt"
                  >
                    <Printer size={12} /> Print
                  </button>
                </>
              )}
            </div>
          )}
        />
        </>
      )}

      {/* ======================================================== */}
      {/* IN-PLACE RECORD PAYMENT SETTLEMENT MODAL (Compact)      */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Collect & Settle Bill Payment"
        size="md"
      >
        {payingBill && (
          <form onSubmit={handleProcessPayment} className="d-flex flex-column gap-2.5">
            {/* Bill Summary Card */}
            <div className="p-2.5 bg-primary-subtle text-primary-emphasis rounded border border-primary-subtle d-flex justify-content-between align-items-center">
              <div>
                <span className="fw-bold fs-6 d-block text-dark">Invoice: {payingBill.billNumber}</span>
                <span className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                  Table: <strong>{payingBill.tableNumber || 'Takeaway'}</strong> | Guest: <strong>{payingBill.customerName || 'Walk-in'}</strong>
                </span>
              </div>
              <div className="text-end">
                <span className="small text-muted d-block" style={{ fontSize: '0.72rem' }}>Due Amount</span>
                <span className="fs-4 fw-bold text-success">₹{payAmount}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="form-label small fw-bold text-secondary mb-1" style={{ fontSize: '0.75rem' }}>Payment Mode</label>
              <div className="btn-group w-100 shadow-sm" style={{ height: 32 }}>
                {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn py-0 px-2 ${
                      paymentMethod === m ? 'btn-primary fw-bold' : 'btn-outline-secondary'
                    }`}
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => {
                      setPaymentMethod(m);
                      if (m === 'CASH') {
                        setTenderedCash(payAmount);
                      }
                    }}
                  >
                    {m === 'CASH' && <Banknote size={13} className="me-1" />}
                    {m === 'UPI' && <QrCode size={13} className="me-1" />}
                    {m === 'CARD' && <CreditCard size={13} className="me-1" />}
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* CASH TENDER CALCULATOR (Compact) */}
            {paymentMethod === 'CASH' && (
              <div className="p-2.5 bg-light rounded border">
                <label className="form-label small fw-bold text-dark mb-1" style={{ fontSize: '0.75rem' }}>
                  Tendered Cash (ગ્રાહકે આપેલ રોકડ)
                </label>
                <div className="input-group input-group-sm mb-1.5">
                  <span className="input-group-text fw-bold">₹</span>
                  <input
                    type="number"
                    className="form-control fw-bold text-dark"
                    value={tenderedCash}
                    onChange={(e) => setTenderedCash(Number(e.target.value))}
                    min={payAmount}
                    required
                  />
                </div>

                {/* Quick Add Buttons */}
                <div className="d-flex flex-wrap gap-1 mb-1.5">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-1.5"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setTenderedCash(payAmount)}
                  >
                    Exact (₹{payAmount})
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-1.5"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setTenderedCash((prev) => prev + 100)}
                  >
                    +₹100
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-1.5"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setTenderedCash((prev) => prev + 200)}
                  >
                    +₹200
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-1.5"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setTenderedCash((prev) => prev + 500)}
                  >
                    +₹500
                  </button>
                  {payAmount % 500 !== 0 && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-1.5"
                      style={{ fontSize: '0.72rem' }}
                      onClick={() => setTenderedCash(Math.ceil(payAmount / 500) * 500)}
                    >
                      Round ₹{Math.ceil(payAmount / 500) * 500}
                    </button>
                  )}
                </div>

                {/* Change Return */}
                <div className="d-flex justify-content-between align-items-center pt-1.5 border-top">
                  <span className="fw-bold text-secondary" style={{ fontSize: '0.78rem' }}>Change to Return (પરત કરવાના):</span>
                  <span className="fs-5 fw-bold text-success">₹{changeReturn}</span>
                </div>
              </div>
            )}

            {/* UPI REFERENCE INPUT */}
            {paymentMethod === 'UPI' && (
              <div className="p-2.5 bg-light rounded border">
                <label className="form-label small fw-bold mb-1" style={{ fontSize: '0.75rem' }}>UPI Reference / UTR Number</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. 423456789012"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            )}

            {/* CARD AUTH CODE */}
            {paymentMethod === 'CARD' && (
              <div className="p-2.5 bg-light rounded border">
                <label className="form-label small fw-bold mb-1" style={{ fontSize: '0.75rem' }}>Card Auth / Approval Code</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. AUTH-88219"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            )}

            {/* SPLIT TENDER INPUTS */}
            {paymentMethod === 'SPLIT' && (
              <div className="d-flex flex-column gap-1.5 p-2.5 bg-light rounded border">
                <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.75rem' }}>Multi-Tender Split</label>
                <div className="row g-1.5">
                  <div className="col-4">
                    <label className="form-label text-secondary mb-0.5" style={{ fontSize: '0.7rem' }}>Cash (₹)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={splitCash}
                      onChange={(e) => setSplitCash(Number(e.target.value))}
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label text-secondary mb-0.5" style={{ fontSize: '0.7rem' }}>UPI (₹)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={splitUpi}
                      onChange={(e) => setSplitUpi(Number(e.target.value))}
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label text-secondary mb-0.5" style={{ fontSize: '0.7rem' }}>Card (₹)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={splitCard}
                      onChange={(e) => setSplitCard(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="d-flex justify-content-between pt-1 border-top" style={{ fontSize: '0.75rem' }}>
                  <span>Total Split: ₹{splitCash + splitUpi + splitCard}</span>
                  <span className={splitCash + splitUpi + splitCard === payAmount ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                    Target: ₹{payAmount}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Actions */}
            <div className="d-flex justify-content-end gap-1.5 pt-2 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2.5"
                style={{ fontSize: '0.78rem' }}
                onClick={() => setIsPayModalOpen(false)}
                disabled={isProcessingPayment}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success btn-sm fw-bold px-3 py-1 d-flex align-items-center gap-1 shadow-sm"
                style={{ fontSize: '0.78rem' }}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" /> Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Settle ₹{payAmount}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* POST-PAYMENT CONFIRMATION MODAL (Compact)                */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!completedBill}
        onClose={() => setCompletedBill(null)}
        title="Payment Settled Successfully"
        size="sm"
      >
        {completedBill && (
          <div className="d-flex flex-column align-items-center text-center p-2 gap-2">
            <div
              className="rounded-circle bg-success-subtle text-success p-2 d-flex align-items-center justify-content-center shadow-sm"
              style={{ width: 50, height: 50 }}
            >
              <CheckCircle2 size={30} />
            </div>

            <div>
              <h6 className="fw-bold text-dark mb-0.5">Payment Confirmed!</h6>
              <p className="text-muted mb-0" style={{ fontSize: '0.75rem' }}>
                Invoice <strong>{completedBill.billNumber}</strong> has been marked as PAID.
              </p>
              {settings.autoPrintOnPayment && (
                <span className="badge bg-light text-success border mt-1" style={{ fontSize: '0.68rem' }}>
                  ✓ Thermal receipt print sent
                </span>
              )}
            </div>

            <div className="p-2 bg-light rounded border w-100 d-flex justify-content-between align-items-center">
              <span className="text-secondary fw-medium" style={{ fontSize: '0.78rem' }}>Amount Paid:</span>
              <span className="fw-bold text-success fs-5">₹{completedBill.totalPayable}</span>
            </div>

            <div className="d-flex flex-wrap justify-content-center gap-1.5 w-100 pt-2 border-top">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm py-1 px-2.5 d-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={() => generateInvoicePdf(completedBill, { download: true, customSettings: settings })}
              >
                <Download size={13} /> PDF
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2.5 d-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={() => printInvoiceReceipt(completedBill, settings)}
              >
                <Printer size={13} /> Print
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2.5"
                style={{ fontSize: '0.75rem' }}
                onClick={() => setCompletedBill(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* 80MM REALISTIC THERMAL SLIP PREVIEW MODAL                */}
      {/* Matches print layout 1:1, compact, zero wasted space     */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!selectedBill}
        onClose={handleCloseBillModal}
        title={`Receipt Slip: ${selectedBill?.billNumber}`}
        size="md"
      >
        {selectedBill && (
          <div className="d-flex flex-column align-items-center">
            {/* 80mm Realistic Thermal Receipt Container */}
            <div
              className="bg-white p-3 border rounded shadow-sm"
              style={{
                width: '100%',
                maxWidth: 340,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.78rem',
                lineHeight: 1.35,
                color: '#222'
              }}
            >
              {/* Slip Header */}
              <div className="text-center">
                <h5 className="fw-bold mb-0" style={{ color: '#b8731d', letterSpacing: '0.5px' }}>
                  {settings.restaurantName || 'BHATIGAL BHANU'}
                </h5>
                <p className="text-muted mb-0" style={{ fontSize: '0.7rem' }}>
                  {settings.tagline || 'Traditional Kathiyawadi Dining'}
                </p>
                <p className="text-muted mb-0" style={{ fontSize: '0.68rem' }}>
                  {settings.address || 'Kothariya Ring Road, Rajkot - 360022'}
                </p>
                {settings.showGstin && (
                  <p className="text-muted mb-0" style={{ fontSize: '0.68rem' }}>
                    GSTIN: {settings.gstin || '24AAAFB1234A1Z8'} | {settings.phone || '+91 98790 12345'}
                  </p>
                )}
                <div className="mt-1">
                  <span
                    className={`badge ${
                      selectedBill.status === 'PAID' ? 'bg-success' : 'bg-danger'
                    } text-white px-2 py-0.5`}
                    style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}
                  >
                    {selectedBill.status === 'PAID' ? 'PAID TAX INVOICE' : 'UNPAID INVOICE'}
                  </span>
                </div>
              </div>

              {/* Dashed divider */}
              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              {/* Meta Rows */}
              <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem' }}>
                <span><strong>Bill No:</strong> {selectedBill.billNumber}</span>
                {settings.showTable && <span><strong>Table:</strong> {selectedBill.tableNumber || 'Dine-In'}</span>}
              </div>
              <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem' }}>
                <span><strong>Date:</strong> {new Date(selectedBill.createdAt).toLocaleDateString('en-IN')}</span>
                <span><strong>Time:</strong> {new Date(selectedBill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {settings.showCustomer && selectedBill.customerName && (
                <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem' }}>
                  <span><strong>Guest:</strong> {selectedBill.customerName}</span>
                  <span><strong>Status:</strong> {selectedBill.status}</span>
                </div>
              )}

              {/* Dashed divider */}
              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              {/* Items List */}
              <div className="d-flex flex-column gap-1">
                {(selectedBill.items || []).map((item, idx) => (
                  <div key={idx} className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-semibold text-dark">{item.itemName}</div>
                      <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                        {item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div className="fw-semibold text-dark">
                      ₹{Number(item.totalPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dashed divider */}
              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              {/* Subtotal & Taxes */}
              <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                <span>Subtotal:</span>
                <span>₹{Number(selectedBill.subtotal).toFixed(2)}</span>
              </div>

              {selectedBill.discountAmount > 0 && (
                <div className="d-flex justify-content-between text-danger" style={{ fontSize: '0.72rem' }}>
                  <span>Discount:</span>
                  <span>-₹{Number(selectedBill.discountAmount).toFixed(2)}</span>
                </div>
              )}

              {settings.showTaxBreakdown && (
                <>
                  <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                    <span>CGST (2.5%):</span>
                    <span>₹{((selectedBill.taxAmount || 0) / 2).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                    <span>SGST (2.5%):</span>
                    <span>₹{((selectedBill.taxAmount || 0) / 2).toFixed(2)}</span>
                  </div>
                </>
              )}

              {settings.showServiceCharge && selectedBill.serviceCharge > 0 && (
                <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                  <span>Service Charge:</span>
                  <span>₹{Number(selectedBill.serviceCharge).toFixed(2)}</span>
                </div>
              )}

              {selectedBill.roundOff !== 0 && (
                <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                  <span>Round Off:</span>
                  <span>{selectedBill.roundOff > 0 ? '+' : ''}₹{Number(selectedBill.roundOff).toFixed(2)}</span>
                </div>
              )}

              {/* Solid border Grand Total */}
              <div className="my-1.5 py-1 border-top border-bottom border-dark d-flex justify-content-between align-items-center">
                <span className="fw-bold fs-6">GRAND TOTAL:</span>
                <span className="fw-bold fs-6">₹{Number(selectedBill.totalPayable).toFixed(2)}</span>
              </div>

              {selectedBill.status === 'PAID' ? (
                <div className="d-flex justify-content-between text-success fw-bold" style={{ fontSize: '0.72rem' }}>
                  <span>Amount Paid:</span>
                  <span>₹{Number(selectedBill.paidAmount || selectedBill.totalPayable).toFixed(2)}</span>
                </div>
              ) : selectedBill.balanceAmount > 0 ? (
                <div className="d-flex justify-content-between text-danger fw-bold" style={{ fontSize: '0.72rem' }}>
                  <span>Balance Due:</span>
                  <span>₹{Number(selectedBill.balanceAmount).toFixed(2)}</span>
                </div>
              ) : null}

              {/* Dashed divider */}
              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              {/* Footer Note */}
              {settings.showFooterNote && (
                <div className="text-center text-muted mt-1" style={{ fontSize: '0.68rem' }}>
                  <p className="mb-0">{settings.customFooterText || 'Thank you for dining with us!'}</p>
                  <p className="mb-0">Please Visit Again 🙏</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="d-flex justify-content-end gap-1.5 w-100 mt-2.5 pt-2 border-top">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm py-1 px-2.5 d-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={() => generateInvoicePdf(selectedBill, { download: true, customSettings: settings })}
                title="Download PDF in exact slip format"
              >
                <Download size={13} /> Download PDF
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2.5 d-flex align-items-center gap-1 shadow-sm"
                style={{ fontSize: '0.75rem' }}
                onClick={() => printInvoiceReceipt(selectedBill, settings)}
              >
                <Printer size={13} /> Print Slip
              </button>
              {selectedBill.status !== 'PAID' && can('payment.create') && (
                <button
                  type="button"
                  className="btn btn-success btn-sm py-1 px-3 d-flex align-items-center gap-1 shadow-sm fw-bold"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    const b = selectedBill;
                    setSelectedBill(null);
                    openPaymentModal(b);
                  }}
                >
                  <CreditCard size={13} /> Pay ₹{selectedBill.totalPayable}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>


      {/* ======================================================== */}
      {/* SPLIT BILL MODAL (Compact)                               */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!splitBillItem}
        onClose={() => setSplitBillItem(null)}
        title={`Split Invoice: ${splitBillItem?.billNumber}`}
        size="sm"
      >
        <div className="d-flex flex-column gap-2.5">
          <p className="small text-secondary mb-0" style={{ fontSize: '0.75rem' }}>
            Split Total ₹{splitBillItem?.totalPayable} into equal checks:
          </p>
          <div>
            <label className="form-label small fw-bold mb-1" style={{ fontSize: '0.75rem' }}>Number of Checks (Split Count)</label>
            <input
              type="number"
              min="2"
              max="10"
              className="form-control form-control-sm"
              value={splitCount}
              onChange={(e) => setSplitCount(Number(e.target.value))}
            />
          </div>
          <div className="p-2 bg-light rounded text-center" style={{ fontSize: '0.78rem' }}>
            Each customer pays approx:{' '}
            <strong className="text-dark fs-6">
              ₹{splitBillItem ? Math.floor(splitBillItem.totalPayable / splitCount) : 0}
            </strong>
          </div>
          <div className="d-flex justify-content-end gap-1.5 pt-2 border-top">
            <button className="btn btn-secondary btn-sm py-1 px-2.5" style={{ fontSize: '0.75rem' }} onClick={() => setSplitBillItem(null)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm py-1 px-2.5 fw-bold" style={{ fontSize: '0.75rem' }} onClick={handleSplitBill}>
              Split Now
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* BILL ACTIVE TABLE MODAL (Compact)                        */}
      {/* ======================================================== */}
      <Modal
        isOpen={isBillTableModalOpen}
        onClose={() => setIsBillTableModalOpen(false)}
        title="Generate Bill for Active Table"
        size="md"
      >
        <div className="d-flex flex-column gap-2">
          <p className="text-secondary mb-1" style={{ fontSize: '0.75rem' }}>
            Select an occupied table to generate its Tax Invoice:
          </p>

          {activeTables.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <Receipt size={32} className="mb-1 text-secondary opacity-50" />
              <div className="fw-semibold small">No active orders pending bill generation</div>
            </div>
          ) : (
            <div className="row g-2">
              {activeTables.map((tbl) => {
                const order = tbl.activeOrder;
                const isGenerating = generatingForOrderId === order?.id;
                return (
                  <div key={tbl.id} className="col-sm-6">
                    <div className="card border shadow-sm h-100">
                      <div className="card-body p-2.5 d-flex flex-column justify-content-between">
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold fs-6 text-dark">{tbl.tableNumber}</span>
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.68rem' }}>
                              {order?.status || 'OCCUPIED'}
                            </span>
                          </div>
                          <div className="text-muted mb-1" style={{ fontSize: '0.72rem' }}>
                            Order #{order?.orderNumber || tbl.currentOrderId} • {order?.items?.length || 0} items
                          </div>
                          <div className="fw-bold text-dark fs-6 mb-2">
                            ₹{order?.totalAmount || 0} <span className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>+ 5% GST</span>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary btn-sm py-1 w-100 d-flex align-items-center justify-content-center gap-1 shadow-sm fw-bold"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleGenerateBillForOrder(order.id)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" /> Generating...
                            </>
                          ) : (
                            <>
                              <Receipt size={13} /> Bill Table
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="d-flex justify-content-end pt-2 border-top">
            <button className="btn btn-secondary btn-sm py-1 px-2.5" style={{ fontSize: '0.75rem' }} onClick={() => setIsBillTableModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
