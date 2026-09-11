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
  ChevronRight,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { generateInvoicePdf, printInvoiceReceipt } from '../../utils/invoicePdf';
import {
  getPrintSettings,
  playPaymentChime,
  PrintAndBillSettings
} from '../../utils/printSettings';

// Helper: Dates for "New Day New List"
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
    return `આજે (${new Date().toLocaleDateString('gu-IN', { day: 'numeric', month: 'short' })})`;
  }
  if (dateStr === yestStr) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `ગઈકાલે (${d.toLocaleDateString('gu-IN', { day: 'numeric', month: 'short' })})`;
  }
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface BillingPageProps {
  defaultTab?: 'payments' | 'invoices' | 'unpaid' | 'paid' | 'all' | string;
}

export const BillingPage: React.FC<BillingPageProps> = () => {
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Print & Bill Settings (Managed centrally in Store Settings)
  const [settings, setSettings] = useState<PrintAndBillSettings>(getPrintSettings());

  useEffect(() => {
    const handleStorage = () => setSettings(getPrintSettings());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Day filter states
  const [dateFilterMode, setDateFilterMode] = useState<'TODAY' | 'YESTERDAY' | 'CUSTOM' | 'ALL'>('TODAY');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [customStartDate, setCustomStartDate] = useState<string>(getLocalDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getLocalDateString());
  const [customFilterType, setCustomFilterType] = useState<'SINGLE' | 'RANGE'>('SINGLE');

  // Simple 3 Workflow Tabs: 'UNPAID' (બાકી) | 'PAID' (ચૂકવાયેલ) | 'ALL' (બધા)
  const [activeTab, setActiveTab] = useState<'UNPAID' | 'PAID' | 'ALL'>('UNPAID');

  // Data lists
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Bill View Modal & Just Settled Alert
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [justSettledBillId, setJustSettledBillId] = useState<string | null>(null);
  const dismissedBillIdRef = useRef<string | null>(null);

  // In-Place Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [tenderedCash, setTenderedCash] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Split amounts
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [splitCard, setSplitCard] = useState<number>(0);

  // Split Bill Modal
  const [splitBillItem, setSplitBillItem] = useState<Bill | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);

  // Quick Bill Active Table Modal
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

        // Check query param for billId
        const qBillId = searchParams.get('billId');
        if (qBillId && dismissedBillIdRef.current !== qBillId) {
          const found = res.data.find((b: Bill) => b.id === qBillId);
          if (found) {
            setSelectedBill(found);
            dismissedBillIdRef.current = qBillId;
          }
        }

        // Check query param for payBillId
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

  // Load Payments
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

  useEffect(() => {
    loadBills(false, true);
    loadPayments();
  }, []);

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

  // Map billId -> Payment
  const paymentsByBillId = useMemo(() => {
    const map = new Map<string, Payment>();
    payments.forEach((p) => {
      if (p.billId && !map.has(p.billId)) {
        map.set(p.billId, p);
      }
    });
    return map;
  }, [payments]);

  // Day navigation
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

  // Day Filtered Bills
  const dayBills = useMemo(() => {
    if (dateFilterMode === 'ALL') return bills;
    if (dateFilterMode === 'TODAY') {
      const today = getLocalDateString();
      return bills.filter((b) => b.createdAt && getLocalDateString(new Date(b.createdAt)) === today);
    }
    if (dateFilterMode === 'YESTERDAY') {
      const yest = getYesterdayDateString();
      return bills.filter((b) => b.createdAt && getLocalDateString(new Date(b.createdAt)) === yest);
    }
    if (customFilterType === 'RANGE') {
      return bills.filter((b) => {
        if (!b.createdAt) return false;
        const bDate = getLocalDateString(new Date(b.createdAt));
        return bDate >= customStartDate && bDate <= customEndDate;
      });
    }
    return bills.filter((b) => {
      if (!b.createdAt) return false;
      const bDate = getLocalDateString(new Date(b.createdAt));
      return bDate === selectedDate;
    });
  }, [bills, dateFilterMode, selectedDate, customStartDate, customEndDate, customFilterType]);

  // Filtered Payments
  const dayPayments = useMemo(() => {
    if (dateFilterMode === 'ALL') return payments;
    if (dateFilterMode === 'TODAY') {
      const today = getLocalDateString();
      return payments.filter((p) => p.createdAt && getLocalDateString(new Date(p.createdAt)) === today);
    }
    if (dateFilterMode === 'YESTERDAY') {
      const yest = getYesterdayDateString();
      return payments.filter((p) => p.createdAt && getLocalDateString(new Date(p.createdAt)) === yest);
    }
    if (customFilterType === 'RANGE') {
      return payments.filter((p) => {
        if (!p.createdAt) return false;
        const pDate = getLocalDateString(new Date(p.createdAt));
        return pDate >= customStartDate && pDate <= customEndDate;
      });
    }
    return payments.filter((p) => {
      if (!p.createdAt) return false;
      const pDate = getLocalDateString(new Date(p.createdAt));
      return pDate === selectedDate;
    });
  }, [payments, dateFilterMode, selectedDate, customStartDate, customEndDate, customFilterType]);

  // Unpaid & Paid lists
  const unpaidBills = useMemo(() => {
    return dayBills.filter((b) => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID');
  }, [dayBills]);

  const paidBills = useMemo(() => {
    return dayBills.filter((b) => b.status === 'PAID');
  }, [dayBills]);

  // 3 Core Metric Totals
  const totalBillsValue = useMemo(() => {
    return dayBills.reduce((acc, b) => acc + (b.totalPayable || 0), 0);
  }, [dayBills]);

  const totalPendingAmount = useMemo(() => {
    return unpaidBills.reduce((acc, b) => acc + (b.balanceAmount !== undefined ? b.balanceAmount : b.totalPayable || 0), 0);
  }, [unpaidBills]);

  const totalRevenue = useMemo(() => {
    return paidBills.reduce((acc, b) => acc + (b.paidAmount || b.totalPayable || 0), 0);
  }, [paidBills]);

  const cashPaymentsTotal = useMemo(() => {
    return dayPayments.filter((p) => p.paymentMethod === 'CASH').reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  const upiPaymentsTotal = useMemo(() => {
    return dayPayments.filter((p) => p.paymentMethod === 'UPI').reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  const cardPaymentsTotal = useMemo(() => {
    return dayPayments.filter((p) => p.paymentMethod === 'CARD').reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [dayPayments]);

  // Open Payment modal
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

  // Close Bill modal
  const handleCloseBillModal = () => {
    setSelectedBill(null);
    setJustSettledBillId(null);
    const qBillId = searchParams.get('billId');
    if (qBillId) {
      dismissedBillIdRef.current = qBillId;
      navigate('/billing', { replace: true });
    }
  };

  // Process payment
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;

    try {
      setIsProcessingPayment(true);
      let transactions = undefined;
      if (paymentMethod === 'SPLIT') {
        const totalSplit = splitCash + splitUpi + splitCard;
        if (totalSplit !== payAmount) {
          alert(`સ્પ્લિટ રકમનો સરવાળો (₹${totalSplit}) બિલ રકમ (₹${payAmount}) જેટલો જ હોવો જોઈએ.`);
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

        let settledBill: Bill = { ...payingBill, status: 'PAID', paidAmount: payAmount, balanceAmount: 0 };
        try {
          const bRes: any = await apiClient.get(`/billing/${payingBill.id}`);
          if (bRes?.success && bRes.data) {
            settledBill = bRes.data;
          }
        } catch (_) {}

        if (settings.autoPrintOnPayment) {
          printInvoiceReceipt(settledBill, settings);
        }

        if (settings.autoDownloadPdfOnPayment) {
          generateInvoicePdf(settledBill, { download: true, customSettings: settings });
        }

        if (settings.playPaymentSound) {
          playPaymentChime();
        }

        setJustSettledBillId(settledBill.id);
        setSelectedBill(settledBill);

        loadBills(false, true);
        loadPayments();

        if (searchParams.get('payBillId')) {
          navigate('/billing', { replace: true });
        }
      }
    } catch (err: any) {
      alert(err.message || 'પેમેન્ટ સ્વીકારવામાં ભૂલ આવી.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Split bill
  const handleSplitBill = async () => {
    if (!splitBillItem) return;
    try {
      await apiClient.post(`/billing/${splitBillItem.id}/split`, { splitCount });
      alert(`બિલ સફળતાપૂર્વક ${splitCount} સરખા ભાગમાં વહેંચાઈ ગયું છે.`);
      setSplitBillItem(null);
      loadBills(false, true);
    } catch (err: any) {
      alert(err.message || 'બિલ સ્પ્લિટ કરવામાં સમસ્યા આવી.');
    }
  };

  // Load Occupied Tables
  const loadActiveTables = async () => {
    try {
      const res: any = await apiClient.get('/tables/floor-layout', { forceFresh: true });
      if (res?.success && Array.isArray(res.data)) {
        setActiveTables(res.data.filter((t: any) => t.status === 'OCCUPIED' && t.activeOrder));
      }
    } catch (_) {}
  };

  // Generate Bill for table
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
      alert(err.message || 'ટેબલનું બિલ બનાવવામાં સમસ્યા આવી.');
    } finally {
      setGeneratingForOrderId(null);
    }
  };

  const changeReturn = Math.max(0, tenderedCash - payAmount);

  // Active filter label
  const getFilterText = () => {
    if (dateFilterMode === 'ALL') return 'બધા દિવસો (All Time)';
    if (dateFilterMode === 'TODAY') return 'આજનું કાઉન્ટર (Today)';
    if (dateFilterMode === 'YESTERDAY') return 'ગઈકાલનું કાઉન્ટર (Yesterday)';
    if (customFilterType === 'RANGE') return `${customStartDate} થી ${customEndDate}`;
    return formatDisplayDate(selectedDate);
  };

  return (
    <div className="d-flex flex-column gap-3 p-1 p-md-2" style={{ fontSize: '0.88rem' }}>
      {/* 1. TOP FRIENDLY COUNTER BAR */}
      <div className="card shadow-sm border-0 bg-white">
        <div className="card-body p-3 px-sm-4 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
          <div className="d-flex align-items-center gap-2.5">
            <div className="bg-primary-subtle text-primary p-2.5 rounded-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: 42, height: 42 }}>
              <Receipt size={24} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="fw-bold mb-0 text-dark">બિલિંગ & પેમેન્ટ્સ કાઉન્ટર</h5>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.75rem' }}>
                  {getFilterText()}
                </span>
              </div>
              <div className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem' }}>
                ટેબલના બાકી રૂપિયા જમા કરો, બિલ બનાવો અને 80mm થર્મલ સ્લિપ પ્રિન્ટ કરો
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 w-100 w-sm-auto justify-content-end">
            {can('billing.create') && (
              <button
                className="btn btn-primary py-2 px-3.5 d-flex align-items-center justify-content-center gap-2 shadow-sm fw-bold w-100 w-sm-auto"
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  loadActiveTables();
                  setIsBillTableModalOpen(true);
                }}
              >
                <Plus size={18} /> + ટેબલનું નવું બિલ બનાવો
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. THREE BIG, CLEAR, SIMPLE METRIC CARDS */}
      <div className="row g-2 g-md-3">
        {/* Card 1: Total Billing */}
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 h-100 bg-white border-start border-primary border-4">
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="text-muted fw-bold small" style={{ fontSize: '0.82rem' }}>
                  🔵 આજના કુલ બિલ (Total Billing)
                </span>
                <div className="p-1.5 rounded-circle bg-primary-subtle text-primary">
                  <Receipt size={18} />
                </div>
              </div>
              <div>
                <div className="fs-3 fw-bold text-dark mb-0.5">
                  ₹{totalBillsValue.toLocaleString()}
                </div>
                <div className="d-flex align-items-center gap-2 text-muted small" style={{ fontSize: '0.75rem' }}>
                  <span className="badge bg-primary text-white">{dayBills.length} બિલો</span>
                  <span>(કુલ વેચાણ)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pending to Collect (Prominent RED) */}
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 h-100 bg-white border-start border-danger border-4">
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="text-danger fw-bold small" style={{ fontSize: '0.82rem' }}>
                  🔴 બાકી લેવાના પૈસા (Pending to Collect)
                </span>
                <div className="p-1.5 rounded-circle bg-danger-subtle text-danger">
                  <Clock size={18} />
                </div>
              </div>
              <div>
                <div className="fs-3 fw-bold text-danger mb-0.5">
                  ₹{totalPendingAmount.toLocaleString()}
                </div>
                <div className="d-flex align-items-center gap-2 text-muted small" style={{ fontSize: '0.75rem' }}>
                  <span className="badge bg-danger text-white">{unpaidBills.length} ટેબલ બાકી</span>
                  <span>(ગ્રાહક પાસેથી લેવાના)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Total Received (Prominent GREEN) */}
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 h-100 bg-white border-start border-success border-4">
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="text-success fw-bold small" style={{ fontSize: '0.82rem' }}>
                  🟢 જમા થયેલ રકમ (Total Received)
                </span>
                <div className="p-1.5 rounded-circle bg-success-subtle text-success">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div>
                <div className="fs-3 fw-bold text-success mb-0.5">
                  ₹{totalRevenue.toLocaleString()}
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap text-muted small" style={{ fontSize: '0.75rem' }}>
                  <span className="badge bg-success text-white">{paidBills.length} બિલ ક્લિયર</span>
                  <span className="text-dark fw-medium">💵 રોકડ: ₹{cashPaymentsTotal}</span>
                  <span className="text-dark fw-medium">📱 UPI: ₹{upiPaymentsTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SIMPLE DATE FILTER BAR */}
      <div className="card shadow-sm border-0 bg-white">
        <div className="card-body p-2.5 px-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            {/* Quick Pills */}
            <div className="d-flex align-items-center gap-1.5 flex-wrap">
              <span className="text-secondary small fw-bold me-1">
                <Calendar size={15} className="me-1 text-primary" /> તારીખ:
              </span>
              <button
                type="button"
                className={`btn btn-sm py-1 px-3 ${dateFilterMode === 'TODAY' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'}`}
                style={{ fontSize: '0.82rem', borderRadius: 6 }}
                onClick={handleSetToday}
              >
                આજે (Today)
              </button>
              <button
                type="button"
                className={`btn btn-sm py-1 px-3 ${dateFilterMode === 'YESTERDAY' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'}`}
                style={{ fontSize: '0.82rem', borderRadius: 6 }}
                onClick={handleSetYesterday}
              >
                ગઈકાલે (Yesterday)
              </button>
              <button
                type="button"
                className={`btn btn-sm py-1 px-3 ${dateFilterMode === 'CUSTOM' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'}`}
                style={{ fontSize: '0.82rem', borderRadius: 6 }}
                onClick={() => setDateFilterMode('CUSTOM')}
              >
                <SlidersHorizontal size={13} className="me-1" />
                તારીખ પસંદ કરો (Custom Date)
              </button>
              <button
                type="button"
                className={`btn btn-sm py-1 px-3 ${dateFilterMode === 'ALL' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'}`}
                style={{ fontSize: '0.82rem', borderRadius: 6 }}
                onClick={() => setDateFilterMode('ALL')}
              >
                બધા દિવસો (All Time)
              </button>
            </div>

            {/* Stepper only when NOT custom */}
            {dateFilterMode !== 'CUSTOM' && dateFilterMode !== 'ALL' && (
              <div className="d-flex align-items-center gap-1.5 ms-auto">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                  style={{ width: 30, height: 30 }}
                  onClick={handlePrevDay}
                  title="ગત દિવસ"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="small fw-bold text-dark px-2 bg-light border rounded py-1">
                  {formatDisplayDate(selectedDate)}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                  style={{ width: 30, height: 30 }}
                  onClick={handleNextDay}
                  title="આગામી દિવસ"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Simple Custom Date Picker Panel */}
          {dateFilterMode === 'CUSTOM' && (
            <div className="mt-2.5 pt-2.5 border-top bg-light p-2.5 rounded border">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="small fw-bold text-dark">તારીખ સિલેક્શન:</span>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className={`btn ${customFilterType === 'SINGLE' ? 'btn-primary fw-bold' : 'btn-outline-secondary bg-white'}`}
                      onClick={() => setCustomFilterType('SINGLE')}
                    >
                      એક તારીખ (Single Date)
                    </button>
                    <button
                      type="button"
                      className={`btn ${customFilterType === 'RANGE' ? 'btn-primary fw-bold' : 'btn-outline-secondary bg-white'}`}
                      onClick={() => setCustomFilterType('RANGE')}
                    >
                      તારીખ ગાળો (From - To)
                    </button>
                  </div>
                </div>

                {customFilterType === 'SINGLE' ? (
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      className="form-control form-control-sm fw-bold bg-white"
                      style={{ width: 160 }}
                      value={selectedDate}
                      onChange={(e) => handleSetCustomDate(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm py-1"
                      onClick={handleSetToday}
                    >
                      આજની તારીખ
                    </button>
                  </div>
                ) : (
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <div className="d-flex align-items-center gap-1">
                      <span className="small text-muted fw-bold">From:</span>
                      <input
                        type="date"
                        className="form-control form-control-sm fw-bold bg-white"
                        style={{ width: 140 }}
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <span className="small text-muted fw-bold">To:</span>
                      <input
                        type="date"
                        className="form-control form-control-sm fw-bold bg-white"
                        style={{ width: 140 }}
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-1 bg-white"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setCustomStartDate(getLocalDateString(d));
                        setCustomEndDate(getLocalDateString());
                      }}
                    >
                      છેલ્લા ૭ દિવસ
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. THREE WORKFLOW-CENTRIC TABS */}
      <div className="d-flex align-items-center gap-2 border-bottom pb-2 pt-1">
        {/* TAB 1: UNPAID (બાકી બિલ) */}
        <button
          type="button"
          className={`btn py-2 px-3 d-flex align-items-center gap-2 ${
            activeTab === 'UNPAID' ? 'btn-danger fw-bold shadow-sm' : 'btn-outline-secondary bg-white'
          }`}
          style={{ fontSize: '0.85rem', borderRadius: 8 }}
          onClick={() => setActiveTab('UNPAID')}
        >
          <Clock size={16} />
          🔴 બાકી બિલો (પૈસા લેવાના છે)
          <span className={`badge ${activeTab === 'UNPAID' ? 'bg-white text-danger' : 'bg-danger text-white'}`}>
            {unpaidBills.length}
          </span>
        </button>

        {/* TAB 2: PAID (ચૂકવાયેલ બિલો) */}
        <button
          type="button"
          className={`btn py-2 px-3 d-flex align-items-center gap-2 ${
            activeTab === 'PAID' ? 'btn-success fw-bold shadow-sm' : 'btn-outline-secondary bg-white'
          }`}
          style={{ fontSize: '0.85rem', borderRadius: 8 }}
          onClick={() => setActiveTab('PAID')}
        >
          <CheckCircle2 size={16} />
          🟢 ચૂકવાયેલ બિલો (ક્લિયર હિસાબ)
          <span className={`badge ${activeTab === 'PAID' ? 'bg-white text-success' : 'bg-success text-white'}`}>
            {paidBills.length}
          </span>
        </button>

        {/* TAB 3: ALL (બધા બિલો) */}
        <button
          type="button"
          className={`btn py-2 px-3 d-flex align-items-center gap-2 ${
            activeTab === 'ALL' ? 'btn-dark fw-bold shadow-sm' : 'btn-outline-secondary bg-white'
          }`}
          style={{ fontSize: '0.85rem', borderRadius: 8 }}
          onClick={() => setActiveTab('ALL')}
        >
          <Receipt size={16} />
          📋 બધા બિલો ({dayBills.length})
        </button>
      </div>

      {/* TAB 1 CONTENT: UNPAID BILLS (સરળ બાકી બિલ લિસ્ટ) */}
      {activeTab === 'UNPAID' && (
        <>
          {unpaidBills.length === 0 ? (
            <div className="card shadow-sm border-0 bg-white text-center py-5">
              <div className="card-body">
                <CheckCircle2 size={48} className="text-success mb-2" />
                <h5 className="fw-bold text-success mb-1">શાબાશ! કોઈ પણ બિલ બાકી નથી 🎉</h5>
                <p className="text-muted small mb-0">આજના તમામ ટેબલોનો હિસાબ પૂર્ણ રીતે ચૂકવાઈ ગયો છે.</p>
              </div>
            </div>
          ) : (
            <DataTable<Bill>
              compact={false}
              columns={[
                {
                  header: 'ટેબલ નં. (Table)',
                  accessor: (row) => (
                    <span className="badge bg-light text-dark border px-2 py-1 fs-6 fw-bold">
                      {row.tableNumber || 'Takeaway'}
                    </span>
                  ),
                  width: 110
                },
                {
                  header: 'બિલ નં. (Bill #)',
                  accessor: (row) => <span className="fw-bold text-dark">{row.billNumber}</span>,
                  width: 130
                },
                {
                  header: 'ગ્રાહક (Customer)',
                  accessor: (row) => (
                    <span className="text-truncate d-inline-block" style={{ maxWidth: 120 }}>
                      {row.customerName || 'Walk-in'}
                    </span>
                  ),
                  width: 120
                },
                {
                  header: 'કુલ બિલ (Total Bill)',
                  accessor: (row) => `₹${row.totalPayable}`,
                  width: 100
                },
                {
                  header: 'બાકી રકમ (Due Amount)',
                  accessor: (row) => (
                    <span className="fs-6 fw-bold text-danger">
                      ₹{row.balanceAmount !== undefined ? row.balanceAmount : row.totalPayable}
                    </span>
                  ),
                  width: 120
                },
                {
                  header: 'સમય (Time)',
                  accessor: (row) => new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  width: 90
                }
              ]}
              data={unpaidBills}
              searchPlaceholder="ટેબલ નં. કે બિલ નં. થી શોધો..."
              actions={(row) => (
                <div className="d-flex align-items-center gap-1.5 flex-nowrap">
                  {/* BIG PROMINENT PAY BUTTON */}
                  {can('payment.create') && (
                    <button
                      className="btn btn-success btn-sm py-1.5 px-3 d-flex align-items-center gap-1 fw-bold shadow-sm"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => openPaymentModal(row)}
                      title="પૈસા જમા કરો"
                    >
                      <CreditCard size={14} /> ₹ પૈસા જમા કરો
                    </button>
                  )}

                  {/* View Slip */}
                  <button
                    className="btn btn-outline-primary btn-sm py-1.5 px-2 d-flex align-items-center gap-1"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => setSelectedBill(row)}
                    title="બિલ સ્લિપ જુઓ"
                  >
                    <Eye size={14} /> બિલ જુઓ
                  </button>
                </div>
              )}
            />
          )}
        </>
      )}

      {/* TAB 2 CONTENT: PAID BILLS (સરળ ચૂકવાયેલ બિલ લિસ્ટ) */}
      {activeTab === 'PAID' && (
        <DataTable<Bill>
          compact={false}
          columns={[
            {
              header: 'ટેબલ નં. (Table)',
              accessor: (row) => (
                <span className="badge bg-light text-dark border px-2 py-1 fs-6 fw-bold">
                  {row.tableNumber || 'Takeaway'}
                </span>
              ),
              width: 110
            },
            {
              header: 'બિલ નં. (Bill #)',
              accessor: (row) => <span className="fw-bold text-dark">{row.billNumber}</span>,
              width: 130
            },
            {
              header: 'ગ્રાહક (Customer)',
              accessor: (row) => row.customerName || 'Walk-in',
              width: 120
            },
            {
              header: 'ચૂકવેલ રકમ (Paid Amount)',
              accessor: (row) => (
                <span className="fs-6 fw-bold text-success">
                  ₹{row.paidAmount || row.totalPayable}
                </span>
              ),
              width: 120
            },
            {
              header: 'પેમેન્ટ મોડ (Payment Mode)',
              accessor: (row) => {
                const payment = paymentsByBillId.get(row.id);
                const method = payment?.paymentMethod || 'CASH';
                return (
                  <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1.5 px-2 py-1" style={{ fontSize: '0.78rem' }}>
                    {method === 'CASH' && <><Banknote size={14} className="text-success" /> રોકડ (Cash)</>}
                    {method === 'UPI' && <><QrCode size={14} className="text-primary" /> UPI / QR</>}
                    {method === 'CARD' && <><CreditCard size={14} className="text-warning" /> કાર્ડ (Card)</>}
                    {method === 'SPLIT' && <><Scissors size={14} className="text-secondary" /> સ્પ્લિટ</>}
                  </span>
                );
              },
              width: 130
            },
            {
              header: 'સમય (Time)',
              accessor: (row) => new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              width: 90
            }
          ]}
          data={paidBills}
          searchPlaceholder="ચૂકવાયેલ બિલો શોધો..."
          actions={(row) => (
            <div className="d-flex align-items-center gap-1.5 flex-nowrap">
              {/* DIRECT PRINT BUTTON */}
              <button
                className="btn btn-primary btn-sm py-1.5 px-2.5 d-flex align-items-center gap-1 shadow-sm fw-bold"
                style={{ fontSize: '0.78rem' }}
                onClick={() => printInvoiceReceipt(row, settings)}
                title="80mm પ્રિન્ટ સ્લિપ કાઢો"
              >
                <Printer size={14} /> 🖨️ સ્લિપ પ્રિન્ટ
              </button>

              {/* View Slip */}
              <button
                className="btn btn-outline-secondary btn-sm py-1.5 px-2 d-flex align-items-center gap-1"
                style={{ fontSize: '0.78rem' }}
                onClick={() => setSelectedBill(row)}
                title="બિલ જુઓ"
              >
                <Eye size={14} /> જુઓ
              </button>

              {/* PDF */}
              <button
                className="btn btn-outline-danger btn-sm py-1.5 px-2 d-flex align-items-center gap-1"
                style={{ fontSize: '0.78rem' }}
                onClick={() => generateInvoicePdf(row, { download: true, customSettings: settings })}
                title="PDF ડાઉનલોડ કરો"
              >
                <Download size={14} /> PDF
              </button>
            </div>
          )}
        />
      )}

      {/* TAB 3 CONTENT: ALL BILLS (બધા બિલો) */}
      {activeTab === 'ALL' && (
        <DataTable<Bill>
          compact={false}
          columns={[
            {
              header: 'ટેબલ નં. (Table)',
              accessor: (row) => (
                <span className="badge bg-light text-dark border px-2 py-1 fs-6 fw-bold">
                  {row.tableNumber || 'Takeaway'}
                </span>
              ),
              width: 100
            },
            {
              header: 'બિલ નં. (Bill #)',
              accessor: (row) => <span className="fw-bold text-dark">{row.billNumber}</span>,
              width: 130
            },
            {
              header: 'ગ્રાહક (Customer)',
              accessor: (row) => row.customerName || 'Walk-in',
              width: 110
            },
            {
              header: 'કુલ રકમ (Total)',
              accessor: (row) => <span className="fw-bold text-dark">₹{row.totalPayable}</span>,
              width: 90
            },
            {
              header: 'સ્થિતિ (Status)',
              accessor: (row) => {
                if (row.status === 'PAID') {
                  return <span className="badge bg-success px-2 py-1">✓ ચૂકવેલ (PAID)</span>;
                }
                return <span className="badge bg-danger px-2 py-1">⏳ બાકી (UNPAID)</span>;
              },
              width: 110
            },
            {
              header: 'સમય (Time)',
              accessor: (row) => new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              width: 90
            }
          ]}
          data={dayBills}
          searchPlaceholder="બધા બિલો શોધો..."
          actions={(row) => {
            const isPaid = row.status === 'PAID';
            return (
              <div className="d-flex align-items-center gap-1.5 flex-nowrap">
                {!isPaid && can('payment.create') && (
                  <button
                    className="btn btn-success btn-sm py-1.5 px-2.5 d-flex align-items-center gap-1 fw-bold shadow-sm"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => openPaymentModal(row)}
                  >
                    <CreditCard size={13} /> પૈસા જમા કરો
                  </button>
                )}

                <button
                  className="btn btn-outline-primary btn-sm py-1.5 px-2 d-flex align-items-center gap-1"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setSelectedBill(row)}
                >
                  <Eye size={13} /> સ્લિપ જુઓ
                </button>

                {isPaid && (
                  <button
                    className="btn btn-outline-secondary btn-sm py-1.5 px-2 d-flex align-items-center gap-1"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => printInvoiceReceipt(row, settings)}
                  >
                    <Printer size={13} /> પ્રિન્ટ
                  </button>
                )}
              </div>
            );
          }}
        />
      )}

      {/* ======================================================== */}
      {/* SIMPLE, LARGE, INTUITIVE PAYMENT MODAL (પૈસા જમા કરવાની બારી) */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="પૈસા જમા કરો (Collect Payment)"
        size="md"
      >
        {payingBill && (
          <form onSubmit={handleProcessPayment} className="d-flex flex-column gap-3">
            {/* Top Table & Bill Banner */}
            <div className="p-3 bg-light rounded-3 border d-flex justify-content-between align-items-center">
              <div>
                <span className="badge bg-primary text-white fs-6 px-2.5 py-1 mb-1">
                  ટેબલ: {payingBill.tableNumber || 'Takeaway'}
                </span>
                <div className="text-secondary small">
                  બિલ નં: <strong>{payingBill.billNumber}</strong> • ગ્રાહક: <strong>{payingBill.customerName || 'Walk-in'}</strong>
                </div>
              </div>
              <div className="text-end">
                <span className="small text-muted d-block fw-bold">કુલ લેવાની રકમ</span>
                <span className="fs-2 fw-bold text-success">₹{payAmount}</span>
              </div>
            </div>

            {/* Payment Mode Selection */}
            <div>
              <label className="form-label small fw-bold text-dark mb-1.5">પેમેન્ટ કઈ રીતે આવ્યું? (Payment Mode):</label>
              <div className="row g-2">
                <div className="col-4">
                  <button
                    type="button"
                    className={`btn w-100 py-2.5 d-flex flex-column align-items-center justify-content-center gap-1 border-2 ${
                      paymentMethod === 'CASH' ? 'btn-success fw-bold shadow-sm' : 'btn-outline-secondary bg-white'
                    }`}
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setTenderedCash(payAmount);
                    }}
                  >
                    <Banknote size={22} />
                    <span>💵 રોકડ (Cash)</span>
                  </button>
                </div>
                <div className="col-4">
                  <button
                    type="button"
                    className={`btn w-100 py-2.5 d-flex flex-column align-items-center justify-content-center gap-1 border-2 ${
                      paymentMethod === 'UPI' ? 'btn-primary fw-bold shadow-sm' : 'btn-outline-secondary bg-white'
                    }`}
                    onClick={() => setPaymentMethod('UPI')}
                  >
                    <QrCode size={22} />
                    <span>📱 UPI / QR</span>
                  </button>
                </div>
                <div className="col-4">
                  <button
                    type="button"
                    className={`btn w-100 py-2.5 d-flex flex-column align-items-center justify-content-center gap-1 border-2 ${
                      paymentMethod === 'CARD' ? 'btn-warning-emphasis fw-bold shadow-sm' : 'btn-outline-secondary bg-white'
                    }`}
                    onClick={() => setPaymentMethod('CARD')}
                  >
                    <CreditCard size={22} />
                    <span>💳 કાર્ડ (Card)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cash Calculator */}
            {paymentMethod === 'CASH' && (
              <div className="p-3 bg-light rounded-3 border">
                <label className="form-label fw-bold text-dark mb-1">
                  ગ્રાહકે આપેલી નોટ / રોકડ (Tendered Cash):
                </label>
                <div className="input-group input-group-lg mb-2">
                  <span className="input-group-text fw-bold">₹</span>
                  <input
                    type="number"
                    className="form-control fw-bold text-dark fs-4"
                    value={tenderedCash}
                    onChange={(e) => setTenderedCash(Number(e.target.value))}
                    min={payAmount}
                    required
                  />
                </div>

                {/* Quick Add Buttons */}
                <div className="d-flex flex-wrap gap-1.5 mb-2.5">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-1 px-2.5"
                    onClick={() => setTenderedCash(payAmount)}
                  >
                    પૂરેપૂરા (Exact ₹{payAmount})
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-1 px-2.5"
                    onClick={() => setTenderedCash((prev) => prev + 100)}
                  >
                    +₹100
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-1 px-2.5"
                    onClick={() => setTenderedCash((prev) => prev + 200)}
                  >
                    +₹200
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-1 px-2.5"
                    onClick={() => setTenderedCash((prev) => prev + 500)}
                  >
                    +₹500
                  </button>
                </div>

                {/* Big Return Change Display */}
                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span className="fw-bold text-dark fs-6">ગ્રાહકને પરત આપવાના રૂપિયા (Change):</span>
                  <span className="fs-3 fw-bold text-success">₹{changeReturn}</span>
                </div>
              </div>
            )}

            {/* UPI Reference */}
            {paymentMethod === 'UPI' && (
              <div className="p-3 bg-light rounded-3 border">
                <label className="form-label small fw-bold mb-1">UPI UTR / ટ્રાન્ઝેક્શન નંબર (ઓપ્શનલ):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="દા.ત. 423456789012"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            )}

            {/* Card Auth Code */}
            {paymentMethod === 'CARD' && (
              <div className="p-3 bg-light rounded-3 border">
                <label className="form-label small fw-bold mb-1">કાર્ડ મશીન Approval / Auth Code (ઓપ્શનલ):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="દા.ત. AUTH-88219"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <button
                type="button"
                className="btn btn-secondary py-2 px-3"
                onClick={() => setIsPayModalOpen(false)}
                disabled={isProcessingPayment}
              >
                રદ કરો (Cancel)
              </button>
              <button
                type="submit"
                className="btn btn-success btn-lg fw-bold px-4 py-2 d-flex align-items-center gap-2 shadow-sm"
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" /> પ્રોસેસિંગ...
                  </>
                ) : (
                  <>
                    <Check size={20} /> ✓ ₹{payAmount} જમા કરો & સ્લિપ કાઢો
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* 80MM REALISTIC THERMAL SLIP PREVIEW MODAL                */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!selectedBill}
        onClose={handleCloseBillModal}
        title={`બિલ સ્લિપ (Invoice Slip): ${selectedBill?.billNumber}`}
        size="md"
      >
        {selectedBill && (
          <div className="d-flex flex-column align-items-center">
            {/* Payment success alert banner */}
            {justSettledBillId === selectedBill.id && (
              <div
                className="alert alert-success py-2 px-3 mb-2.5 d-flex align-items-center justify-content-between shadow-sm w-100"
                style={{ maxWidth: 340 }}
              >
                <div className="d-flex align-items-center gap-2">
                  <CheckCircle2 size={20} className="text-success flex-shrink-0" />
                  <span className="fw-bold small">પેમેન્ટ સફળતાપૂર્વક જમા થઈ ગયું છે!</span>
                </div>
                <span className="badge bg-success text-white">PAID</span>
              </div>
            )}

            {/* 80mm Realistic Thermal Receipt */}
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
              <div className="text-center">
                {settings.showLogo && (
                  <img
                    src="/logo.jpg"
                    alt="Logo"
                    className="rounded-circle mx-auto d-block mb-1.5 shadow-sm border border-warning"
                    style={{ width: 52, height: 52, objectFit: 'contain' }}
                  />
                )}
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

              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem' }}>
                <span><strong>બિલ નં:</strong> {selectedBill.billNumber}</span>
                {settings.showTable && <span><strong>ટેબલ:</strong> {selectedBill.tableNumber || 'Dine-In'}</span>}
              </div>
              <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem' }}>
                <span><strong>તારીખ:</strong> {new Date(selectedBill.createdAt).toLocaleDateString('en-IN')}</span>
                <span><strong>સમય:</strong> {new Date(selectedBill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {settings.showCustomer && selectedBill.customerName && (
                <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem' }}>
                  <span><strong>ગ્રાહક:</strong> {selectedBill.customerName}</span>
                  <span><strong>સ્થિતિ:</strong> {selectedBill.status}</span>
                </div>
              )}

              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              {/* Items */}
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

              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              {/* Subtotal & Taxes */}
              <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                <span>સબ-ટોટલ:</span>
                <span>₹{Number(selectedBill.subtotal).toFixed(2)}</span>
              </div>

              {selectedBill.discountAmount > 0 && (
                <div className="d-flex justify-content-between text-danger" style={{ fontSize: '0.72rem' }}>
                  <span>ડિસ્કાઉન્ટ:</span>
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

              {selectedBill.roundOff !== 0 && (
                <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                  <span>રાઉન્ડ ઓફ:</span>
                  <span>{selectedBill.roundOff > 0 ? '+' : ''}₹{Number(selectedBill.roundOff).toFixed(2)}</span>
                </div>
              )}

              <div className="my-1.5 py-1 border-top border-bottom border-dark d-flex justify-content-between align-items-center">
                <span className="fw-bold fs-6">કુલ રકમ (GRAND TOTAL):</span>
                <span className="fw-bold fs-6">₹{Number(selectedBill.totalPayable).toFixed(2)}</span>
              </div>

              {selectedBill.status === 'PAID' ? (
                <div className="d-flex justify-content-between text-success fw-bold" style={{ fontSize: '0.72rem' }}>
                  <span>ચૂકવેલ રકમ:</span>
                  <span>₹{Number(selectedBill.paidAmount || selectedBill.totalPayable).toFixed(2)}</span>
                </div>
              ) : selectedBill.balanceAmount > 0 ? (
                <div className="d-flex justify-content-between text-danger fw-bold" style={{ fontSize: '0.72rem' }}>
                  <span>બાકી રકમ:</span>
                  <span>₹{Number(selectedBill.balanceAmount).toFixed(2)}</span>
                </div>
              ) : null}

              <div className="my-2 border-top" style={{ borderStyle: 'dashed !important', borderColor: '#777' }}></div>

              {settings.showFooterNote && (
                <div className="text-center text-muted mt-1" style={{ fontSize: '0.68rem' }}>
                  <p className="mb-0">{settings.customFooterText || 'Thank you for dining with us!'}</p>
                  <p className="mb-0">ફરી પધારશો 🙏</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="d-flex flex-wrap justify-content-end align-items-center gap-1.5 w-100 mt-2.5 pt-2 border-top">
              {selectedBill.status === 'UNPAID' && can('billing.split') && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm py-1 px-2.5 d-flex align-items-center gap-1 me-auto"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    const b = selectedBill;
                    setSelectedBill(null);
                    setSplitBillItem(b);
                  }}
                >
                  <Scissors size={13} /> સ્પ્લિટ બિલ
                </button>
              )}

              <button
                type="button"
                className="btn btn-outline-danger btn-sm py-1 px-2.5 d-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={() => generateInvoicePdf(selectedBill, { download: true, customSettings: settings })}
              >
                <Download size={13} /> PDF
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm py-1.5 px-3 d-flex align-items-center gap-1.5 shadow-sm fw-bold"
                style={{ fontSize: '0.78rem' }}
                onClick={() => printInvoiceReceipt(selectedBill, settings)}
              >
                <Printer size={14} /> 🖨️ સ્લિપ પ્રિન્ટ
              </button>

              {selectedBill.status !== 'PAID' && can('payment.create') ? (
                <button
                  type="button"
                  className="btn btn-success btn-sm py-1.5 px-3 d-flex align-items-center gap-1.5 shadow-sm fw-bold"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => {
                    const b = selectedBill;
                    setSelectedBill(null);
                    openPaymentModal(b);
                  }}
                >
                  <CreditCard size={14} /> ₹ પૈસા જમા કરો
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm py-1 px-2.5"
                  style={{ fontSize: '0.75rem' }}
                  onClick={handleCloseBillModal}
                >
                  પૂર્ણ (Done)
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* SPLIT BILL MODAL                                         */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!splitBillItem}
        onClose={() => setSplitBillItem(null)}
        title={`સ્પ્લિટ બિલ: ${splitBillItem?.billNumber}`}
        size="sm"
      >
        <div className="d-flex flex-column gap-2.5">
          <p className="small text-secondary mb-0" style={{ fontSize: '0.78rem' }}>
            કુલ રકમ ₹{splitBillItem?.totalPayable} ને સરખા ભાગમાં વહેંચો:
          </p>
          <div>
            <label className="form-label small fw-bold mb-1">કેટલા ભાગ કરવા છે? (Split Count)</label>
            <input
              type="number"
              min="2"
              max="10"
              className="form-control form-control-sm"
              value={splitCount}
              onChange={(e) => setSplitCount(Number(e.target.value))}
            />
          </div>
          <div className="p-2 bg-light rounded text-center" style={{ fontSize: '0.82rem' }}>
            દરેક ગ્રાહકના ભાગે આવશે:{' '}
            <strong className="text-dark fs-6">
              ₹{splitBillItem ? Math.floor(splitBillItem.totalPayable / splitCount) : 0}
            </strong>
          </div>
          <div className="d-flex justify-content-end gap-1.5 pt-2 border-top">
            <button className="btn btn-secondary btn-sm py-1 px-2.5" onClick={() => setSplitBillItem(null)}>
              રદ કરો
            </button>
            <button className="btn btn-primary btn-sm py-1 px-2.5 fw-bold" onClick={handleSplitBill}>
              સ્પ્લિટ કરો
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* BILL ACTIVE TABLE MODAL (ટેબલનું નવું બિલ બનાવો)          */}
      {/* ======================================================== */}
      <Modal
        isOpen={isBillTableModalOpen}
        onClose={() => setIsBillTableModalOpen(false)}
        title="ઓક્યુપાઇડ ટેબલનું બિલ બનાવો (Generate Bill)"
        size="md"
      >
        <div className="d-flex flex-column gap-2">
          <p className="text-secondary mb-1" style={{ fontSize: '0.78rem' }}>
            જે ટેબલનું બિલ બનાવવું હોય તે ટેબલ પસંદ કરો:
          </p>

          {activeTables.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <Receipt size={36} className="mb-1 text-secondary opacity-50" />
              <div className="fw-semibold small">હાલમાં કોઈ ઓર્ડર બિલિંગ માટે પેન્ડિંગ નથી</div>
            </div>
          ) : (
            <div className="row g-2">
              {activeTables.map((tbl) => {
                const order = tbl.activeOrder;
                const isGenerating = generatingForOrderId === order?.id;
                return (
                  <div key={tbl.id} className="col-sm-6">
                    <div className="card border shadow-sm h-100">
                      <div className="card-body p-3 d-flex flex-column justify-content-between">
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold fs-5 text-dark">{tbl.tableNumber}</span>
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.7rem' }}>
                              ઓક્યુપાઇડ
                            </span>
                          </div>
                          <div className="text-muted mb-1 small">
                            ઓર્ડર #{order?.orderNumber || tbl.currentOrderId} • {order?.items?.length || 0} વાનગીઓ
                          </div>
                          <div className="fw-bold text-dark fs-5 mb-2">
                            ₹{order?.totalAmount || 0} <span className="text-muted fw-normal small">+ 5% GST</span>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary btn-sm py-1.5 w-100 d-flex align-items-center justify-content-center gap-1 shadow-sm fw-bold"
                          style={{ fontSize: '0.82rem' }}
                          onClick={() => handleGenerateBillForOrder(order.id)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" /> બિલ બની રહ્યું છે...
                            </>
                          ) : (
                            <>
                              <Receipt size={14} /> ટેબલ બિલ બનાવો
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
            <button className="btn btn-secondary btn-sm py-1 px-3" onClick={() => setIsBillTableModalOpen(false)}>
              બંધ કરો
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
