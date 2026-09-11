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
  Sparkles
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { generateInvoicePdf, printInvoiceReceipt } from '../../utils/invoicePdf';

interface BillingPageProps {
  defaultTab?: 'invoices' | 'payments';
}

export const BillingPage: React.FC<BillingPageProps> = ({ defaultTab = 'invoices' }) => {
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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

  // Filtered Bills
  const filteredBills = useMemo(() => {
    if (invoiceFilter === 'UNPAID') {
      return bills.filter(b => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID');
    }
    if (invoiceFilter === 'PAID') {
      return bills.filter(b => b.status === 'PAID');
    }
    return bills;
  }, [bills, invoiceFilter]);

  const unpaidBillsCount = useMemo(() => {
    return bills.filter(b => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID').length;
  }, [bills]);

  const paidBillsCount = useMemo(() => {
    return bills.filter(b => b.status === 'PAID').length;
  }, [bills]);

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

        // 1. Auto-print thermal receipt immediately
        printInvoiceReceipt(settledBill);

        // 2. Open confirmation modal
        setCompletedBill(settledBill);

        // 3. Refresh lists
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
        generateInvoicePdf(res.data);
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
        printInvoiceReceipt(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to print receipt.');
    }
  };

  const changeReturn = Math.max(0, tenderedCash - payAmount);

  return (
    <div className="d-flex flex-column gap-3">
      {/* Top Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <Receipt className="text-primary" size={24} />
            Billing & Payments
          </h4>
          <p className="text-muted small mb-0">
            Unified Restaurant Invoicing, Instant Payment Settlement & Thermal Receipts
          </p>
        </div>

        {can('billing.create') && (
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm px-3"
            onClick={() => {
              loadActiveTables();
              setIsBillTableModalOpen(true);
            }}
          >
            <Plus size={16} /> Bill Active Table
          </button>
        )}
      </div>

      {/* Main Navigation Tabs */}
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 gap-2 flex-wrap">
        <ul className="nav nav-pills gap-2">
          <li className="nav-item">
            <button
              className={`nav-link btn-sm d-flex align-items-center gap-2 px-3 ${
                activeTab === 'invoices' ? 'active shadow-sm fw-bold' : 'text-secondary'
              }`}
              onClick={() => setActiveTab('invoices')}
            >
              <Receipt size={16} />
              Invoices & Billing
              <span className={`badge ${activeTab === 'invoices' ? 'bg-light text-primary' : 'bg-secondary'}`}>
                {bills.length}
              </span>
              {unpaidBillsCount > 0 && (
                <span className="badge bg-danger text-white rounded-pill px-2">
                  {unpaidBillsCount} Pending
                </span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link btn-sm d-flex align-items-center gap-2 px-3 ${
                activeTab === 'payments' ? 'active shadow-sm fw-bold' : 'text-secondary'
              }`}
              onClick={() => setActiveTab('payments')}
            >
              <CreditCard size={16} />
              Payment Receipts History
              <span className={`badge ${activeTab === 'payments' ? 'bg-light text-primary' : 'bg-secondary'}`}>
                {payments.length}
              </span>
            </button>
          </li>
        </ul>

        {/* Sub-Filters for Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="btn-group btn-group-sm">
            <button
              className={`btn ${invoiceFilter === 'ALL' ? 'btn-dark fw-bold' : 'btn-outline-secondary'}`}
              onClick={() => setInvoiceFilter('ALL')}
            >
              All ({bills.length})
            </button>
            <button
              className={`btn ${invoiceFilter === 'UNPAID' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
              onClick={() => setInvoiceFilter('UNPAID')}
            >
              Pending Pay ({unpaidBillsCount})
            </button>
            <button
              className={`btn ${invoiceFilter === 'PAID' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
              onClick={() => setInvoiceFilter('PAID')}
            >
              Settled ({paidBillsCount})
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: INVOICES & BILLING */}
      {activeTab === 'invoices' && (
        <DataTable<Bill>
          columns={[
            {
              header: 'Bill No',
              accessor: (row) => <span className="fw-bold text-dark">{row.billNumber}</span>,
              width: 140
            },
            {
              header: 'Table',
              accessor: (row) => (
                <span className="badge bg-light text-dark border px-2 py-1">
                  {row.tableNumber || 'Takeaway'}
                </span>
              )
            },
            {
              header: 'Customer',
              accessor: (row) => row.customerName || 'Walk-in Guest'
            },
            {
              header: 'Subtotal',
              accessor: (row) => `₹${row.subtotal}`
            },
            {
              header: 'Tax (5% GST)',
              accessor: (row) => `₹${row.taxAmount}`
            },
            {
              header: 'Total Payable',
              accessor: (row) => (
                <span className="fw-bold text-dark fs-6">₹{row.totalPayable}</span>
              )
            },
            {
              header: 'Status',
              accessor: (row) => {
                if (row.status === 'PAID') {
                  return (
                    <span className="badge bg-success d-inline-flex align-items-center gap-1 px-2 py-1">
                      <CheckCircle2 size={12} /> PAID
                    </span>
                  );
                }
                if (row.status === 'PARTIALLY_PAID') {
                  return <span className="badge bg-warning text-dark px-2 py-1">PARTIAL</span>;
                }
                return (
                  <span className="badge bg-danger d-inline-flex align-items-center gap-1 px-2 py-1">
                    <Clock size={12} /> UNPAID
                  </span>
                );
              }
            },
            {
              header: 'Date & Time',
              accessor: (row) => new Date(row.createdAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          ]}
          data={filteredBills}
          searchPlaceholder="Search invoices by bill # or customer..."
          actions={(row) => (
            <div className="d-flex align-items-center gap-1 flex-wrap">
              {/* PAY BUTTON: Opens in-place payment modal */}
              {row.status !== 'PAID' && can('payment.create') && (
                <button
                  className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1 fw-bold shadow-sm"
                  onClick={() => openPaymentModal(row)}
                  title="Collect & Settle Payment"
                >
                  <CreditCard size={14} /> Pay
                </button>
              )}

              {/* View Slip */}
              <button
                className="btn btn-outline-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => setSelectedBill(row)}
                title="View Invoice Slip"
              >
                <Eye size={14} /> View
              </button>

              {/* Download PDF */}
              <button
                className="btn btn-outline-danger btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => generateInvoicePdf(row)}
                title="Download Tax Invoice PDF"
              >
                <Download size={14} /> PDF
              </button>

              {/* Print Receipt */}
              <button
                className="btn btn-outline-secondary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => printInvoiceReceipt(row)}
                title="Print Receipt"
              >
                <Printer size={14} /> Print
              </button>

              {/* Split Bill */}
              {row.status === 'UNPAID' && can('billing.split') && (
                <button
                  className="btn btn-outline-secondary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                  onClick={() => setSplitBillItem(row)}
                  title="Split Bill"
                >
                  <Scissors size={14} /> Split
                </button>
              )}
            </div>
          )}
        />
      )}

      {/* TAB 2: SETTLEMENT RECEIPTS HISTORY */}
      {activeTab === 'payments' && (
        <DataTable<Payment>
          columns={[
            {
              header: 'Payment #',
              accessor: (row) => <span className="fw-bold text-dark">{row.paymentNumber}</span>,
              width: 140
            },
            {
              header: 'Method',
              accessor: (row) => (
                <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1">
                  {row.paymentMethod === 'CASH' && <Banknote size={14} className="text-success" />}
                  {row.paymentMethod === 'UPI' && <QrCode size={14} className="text-primary" />}
                  {row.paymentMethod === 'CARD' && <CreditCard size={14} className="text-warning" />}
                  {row.paymentMethod}
                </span>
              )
            },
            {
              header: 'Settled Amount',
              accessor: (row) => (
                <span className="fw-bold text-success fs-6">₹{row.amount.toLocaleString()}</span>
              )
            },
            {
              header: 'Reference / UTR',
              accessor: (row) => row.referenceNumber || '-'
            },
            {
              header: 'Date & Time',
              accessor: (row) => new Date(row.createdAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            },
            {
              header: 'Status',
              accessor: () => (
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                  Settled
                </span>
              )
            }
          ]}
          data={payments}
          searchPlaceholder="Search payment # or reference..."
          actions={(row) => (
            <div className="d-flex align-items-center gap-1">
              {row.billId && (
                <>
                  <button
                    className="btn btn-outline-danger btn-sm p-1 px-2 d-flex align-items-center gap-1"
                    onClick={() => handleDownloadPaymentPdf(row.billId)}
                    title="Download Tax Invoice PDF"
                  >
                    <Download size={14} /> PDF
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                    onClick={() => handlePrintPaymentReceipt(row.billId)}
                    title="Print Receipt"
                  >
                    <Printer size={14} /> Print
                  </button>
                </>
              )}
            </div>
          )}
        />
      )}

      {/* ======================================================== */}
      {/* IN-PLACE RECORD PAYMENT SETTLEMENT MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Collect & Settle Bill Payment"
      >
        {payingBill && (
          <form onSubmit={handleProcessPayment} className="d-flex flex-column gap-3">
            {/* Bill Summary Card */}
            <div className="p-3 bg-primary-subtle text-primary-emphasis rounded border border-primary-subtle d-flex justify-content-between align-items-center">
              <div>
                <span className="fw-bold fs-6 d-block text-dark">Invoice: {payingBill.billNumber}</span>
                <span className="small text-secondary">
                  Table: <strong>{payingBill.tableNumber || 'Takeaway'}</strong> | Guest: <strong>{payingBill.customerName || 'Walk-in'}</strong>
                </span>
              </div>
              <div className="text-end">
                <span className="small text-muted d-block">Amount Due</span>
                <span className="fs-3 fw-bold text-success">₹{payAmount}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="form-label small fw-bold text-secondary">Payment Method</label>
              <div className="btn-group w-100 shadow-sm">
                {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn btn-sm ${
                      paymentMethod === m ? 'btn-primary fw-bold' : 'btn-outline-secondary'
                    }`}
                    onClick={() => {
                      setPaymentMethod(m);
                      if (m === 'CASH') {
                        setTenderedCash(payAmount);
                      }
                    }}
                  >
                    {m === 'CASH' && <Banknote size={14} className="me-1" />}
                    {m === 'UPI' && <QrCode size={14} className="me-1" />}
                    {m === 'CARD' && <CreditCard size={14} className="me-1" />}
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* CASH TENDER CALCULATOR */}
            {paymentMethod === 'CASH' && (
              <div className="p-3 bg-light rounded border">
                <label className="form-label small fw-bold text-dark">Cash Tendered by Customer (ગ્રાહકે આપેલ રોકડ)</label>
                <div className="input-group mb-2">
                  <span className="input-group-text fw-bold">₹</span>
                  <input
                    type="number"
                    className="form-control form-control-lg fw-bold text-dark"
                    value={tenderedCash}
                    onChange={(e) => setTenderedCash(Number(e.target.value))}
                    min={payAmount}
                    required
                  />
                </div>

                {/* Quick Add Buttons */}
                <div className="d-flex flex-wrap gap-1 mb-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                    onClick={() => setTenderedCash(payAmount)}
                  >
                    Exact (₹{payAmount})
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                    onClick={() => setTenderedCash((prev) => prev + 100)}
                  >
                    +₹100
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                    onClick={() => setTenderedCash((prev) => prev + 200)}
                  >
                    +₹200
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                    onClick={() => setTenderedCash((prev) => prev + 500)}
                  >
                    +₹500
                  </button>
                  {payAmount % 500 !== 0 && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2"
                      onClick={() => setTenderedCash(Math.ceil(payAmount / 500) * 500)}
                    >
                      Round ₹{Math.ceil(payAmount / 500) * 500}
                    </button>
                  )}
                </div>

                {/* Change Return */}
                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span className="fw-bold text-secondary">Change to Return (ગ્રાહકને બાકી પરત):</span>
                  <span className="fs-4 fw-bold text-success">₹{changeReturn}</span>
                </div>
              </div>
            )}

            {/* UPI REFERENCE INPUT */}
            {paymentMethod === 'UPI' && (
              <div className="p-3 bg-light rounded border">
                <label className="form-label small fw-bold">UPI Reference / UTR Number (QR સ્કેન રેફરન્સ)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 423456789012"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
                <small className="text-muted mt-1 d-block">
                  Google Pay / PhonePe / Paytm UTR નંબર અથવા ટ્રાન્ઝેક્શન આઈડી દાખલ કરો.
                </small>
              </div>
            )}

            {/* CARD AUTH CODE */}
            {paymentMethod === 'CARD' && (
              <div className="p-3 bg-light rounded border">
                <label className="form-label small fw-bold">Card Approval / Auth Code (સ્વાઇપ મશીન કોડ)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. AUTH-88219"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            )}

            {/* SPLIT TENDER INPUTS */}
            {paymentMethod === 'SPLIT' && (
              <div className="d-flex flex-column gap-2 p-3 bg-light rounded border">
                <label className="form-label small fw-bold mb-1">Multi-Tender Breakdown</label>
                <div className="row g-2">
                  <div className="col-4">
                    <label className="form-label small text-secondary">Cash (₹)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={splitCash}
                      onChange={(e) => setSplitCash(Number(e.target.value))}
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label small text-secondary">UPI (₹)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={splitUpi}
                      onChange={(e) => setSplitUpi(Number(e.target.value))}
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label small text-secondary">Card (₹)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={splitCard}
                      onChange={(e) => setSplitCard(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="d-flex justify-content-between small pt-2 border-top">
                  <span>Total Split: ₹{splitCash + splitUpi + splitCard}</span>
                  <span
                    className={
                      splitCash + splitUpi + splitCard === payAmount
                        ? 'text-success fw-bold'
                        : 'text-danger fw-bold'
                    }
                  >
                    Target: ₹{payAmount}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Actions */}
            <div className="d-flex justify-content-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsPayModalOpen(false)}
                disabled={isProcessingPayment}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success btn-sm fw-bold px-3 d-flex align-items-center gap-1 shadow-sm"
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" /> Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Record & Settle Payment
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* POST-PAYMENT SUCCESS & AUTO-PRINT CONFIRMATION MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!completedBill}
        onClose={() => setCompletedBill(null)}
        title="Payment Settled Successfully"
      >
        {completedBill && (
          <div className="d-flex flex-column align-items-center text-center p-3 gap-3">
            <div
              className="rounded-circle bg-success-subtle text-success p-3 d-flex align-items-center justify-content-center shadow-sm"
              style={{ width: 68, height: 68 }}
            >
              <CheckCircle2 size={38} />
            </div>

            <div>
              <h5 className="fw-bold text-dark mb-1">Payment Received & Completed!</h5>
              <p className="text-muted small mb-0">
                Invoice <strong>{completedBill.billNumber}</strong> has been paid. Thermal receipt auto-print was triggered.
              </p>
              {completedBill.tableNumber && (
                <div className="mt-2">
                  <span className="badge bg-primary px-3 py-1">Table: {completedBill.tableNumber}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-light rounded border w-100 d-flex justify-content-between align-items-center">
              <span className="text-secondary fw-medium">Total Paid Amount:</span>
              <span className="fw-bold text-success fs-4">₹{completedBill.totalPayable}</span>
            </div>

            <div className="d-flex flex-wrap justify-content-center gap-2 w-100 pt-3 border-top">
              <button
                type="button"
                className="btn btn-danger d-flex align-items-center gap-2 px-3 shadow-sm"
                onClick={() => generateInvoicePdf(completedBill)}
              >
                <Download size={16} /> Download PDF
              </button>

              <button
                type="button"
                className="btn btn-primary d-flex align-items-center gap-2 px-3 shadow-sm"
                onClick={() => printInvoiceReceipt(completedBill)}
              >
                <Printer size={16} /> Print Receipt Again
              </button>

              <button
                type="button"
                className="btn btn-secondary px-3"
                onClick={() => setCompletedBill(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* BILL VIEW & PRINT INVOICE MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!selectedBill}
        onClose={handleCloseBillModal}
        title={`Tax Invoice: ${selectedBill?.billNumber}`}
        size="lg"
      >
        {selectedBill && (
          <div className="p-3 bg-white print-area" id="printable-invoice">
            {/* Invoice Header */}
            <div className="text-center border-bottom pb-3 mb-3">
              <div className="d-flex justify-content-center mb-2">
                <img
                  src="/logo.jpg"
                  alt="Bhatigal Bhanu"
                  style={{ width: 68, height: 68, borderRadius: '50%', border: '2px solid #D48B28' }}
                />
              </div>
              <h3 className="fw-bold mb-0 text-dark" style={{ letterSpacing: '0.02em' }}>
                BHATIGAL BHANU
              </h3>
              <p className="small text-muted mb-1">Traditional Kathiyawadi & Gujarati Dining</p>
              <p className="small text-muted mb-0">Kothariya Ring Road, Rajkot, Gujarat - 360022</p>
              <p className="small text-muted mb-0">GSTIN: 24AAAFB1234A1Z8 | Phone: +91 98790 12345</p>
              <div className="mt-2">
                <span className="badge bg-light text-dark border px-3 py-1 fw-bold">
                  TAX INVOICE
                </span>
              </div>
            </div>

            {/* Bill Meta Data */}
            <div className="row g-2 mb-3 small">
              <div className="col-6">
                <div>
                  <strong>Invoice No:</strong> {selectedBill.billNumber}
                </div>
                <div>
                  <strong>Table:</strong> {selectedBill.tableNumber || 'Takeaway'}
                </div>
                <div>
                  <strong>Status:</strong>{' '}
                  <span
                    className={`badge bg-${
                      selectedBill.status === 'PAID'
                        ? 'success'
                        : selectedBill.status === 'PARTIALLY_PAID'
                        ? 'warning text-dark'
                        : 'danger'
                    }`}
                  >
                    {selectedBill.status}
                  </span>
                </div>
              </div>
              <div className="col-6 text-end">
                <div>
                  <strong>Date:</strong> {new Date(selectedBill.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <strong>Time:</strong> {new Date(selectedBill.createdAt).toLocaleTimeString()}
                </div>
                <div>
                  <strong>Customer:</strong> {selectedBill.customerName || 'Walk-in Guest'}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="table-responsive mb-3">
              <table className="table table-sm table-bordered mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Item Description</th>
                    <th className="text-center">Qty</th>
                    <th className="text-end">Price</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items?.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>{idx + 1}</td>
                      <td>{item.itemName}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-end">₹{item.unitPrice}</td>
                      <td className="text-end">₹{item.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="row justify-content-end">
              <div className="col-md-5 col-sm-8">
                <div className="d-flex justify-content-between text-muted mb-1 small">
                  <span>Subtotal:</span>
                  <span>₹{selectedBill.subtotal}</span>
                </div>
                <div className="d-flex justify-content-between text-muted mb-1 small">
                  <span>CGST (2.5%):</span>
                  <span>₹{(selectedBill.taxAmount / 2).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between text-muted mb-1 small">
                  <span>SGST (2.5%):</span>
                  <span>₹{(selectedBill.taxAmount / 2).toFixed(2)}</span>
                </div>
                {selectedBill.serviceCharge > 0 && (
                  <div className="d-flex justify-content-between text-muted mb-1 small">
                    <span>Service Charge:</span>
                    <span>₹{selectedBill.serviceCharge}</span>
                  </div>
                )}
                {selectedBill.roundOff !== 0 && (
                  <div className="d-flex justify-content-between text-muted mb-1 small">
                    <span>Round Off:</span>
                    <span>
                      {selectedBill.roundOff > 0 ? '+' : ''}₹{selectedBill.roundOff}
                    </span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="d-flex justify-content-between fw-bold fs-5 mb-2">
                  <span>Total Payable:</span>
                  <span className="text-dark">₹{selectedBill.totalPayable}</span>
                </div>
                {selectedBill.paidAmount > 0 && (
                  <div className="d-flex justify-content-between text-success fw-bold small">
                    <span>Paid Amount:</span>
                    <span>₹{selectedBill.paidAmount}</span>
                  </div>
                )}
                {selectedBill.balanceAmount > 0 && selectedBill.status !== 'PAID' && (
                  <div className="d-flex justify-content-between text-danger fw-bold small">
                    <span>Balance Due:</span>
                    <span>₹{selectedBill.balanceAmount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Terms */}
            <div className="text-center border-top pt-3 mt-3 text-muted small">
              <p className="mb-0 fw-bold">Thank You For Dining With Us! 🙏</p>
              <p className="mb-0 small">Please visit again | Bhatigal Bhanu Restaurant</p>
            </div>

            {/* Action Buttons */}
            <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top no-print">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                onClick={() => generateInvoicePdf(selectedBill)}
              >
                <Download size={14} /> Download PDF
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => printInvoiceReceipt(selectedBill)}
              >
                <Printer size={14} /> Print Receipt
              </button>
              {selectedBill.status !== 'PAID' && can('payment.create') && (
                <button
                  type="button"
                  className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm fw-bold"
                  onClick={() => {
                    const b = selectedBill;
                    setSelectedBill(null);
                    openPaymentModal(b);
                  }}
                >
                  <CreditCard size={14} /> Pay ₹{selectedBill.totalPayable}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* SPLIT BILL MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!splitBillItem}
        onClose={() => setSplitBillItem(null)}
        title={`Split Invoice: ${splitBillItem?.billNumber}`}
      >
        <div className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-1">
            Split Total ₹{splitBillItem?.totalPayable} into equal individual customer checks:
          </p>
          <div>
            <label className="form-label small fw-bold">Number of Checks (Split Count)</label>
            <input
              type="number"
              min="2"
              max="10"
              className="form-control"
              value={splitCount}
              onChange={(e) => setSplitCount(Number(e.target.value))}
            />
          </div>
          <div className="p-2 bg-light rounded text-center small">
            Each customer pays approx:{' '}
            <strong className="text-dark fs-6">
              ₹{splitBillItem ? Math.floor(splitBillItem.totalPayable / splitCount) : 0}
            </strong>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button className="btn btn-secondary btn-sm" onClick={() => setSplitBillItem(null)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm fw-bold" onClick={handleSplitBill}>
              Split Invoice Now
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* BILL ACTIVE TABLE MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={isBillTableModalOpen}
        onClose={() => setIsBillTableModalOpen(false)}
        title="Generate Bill for Active Table"
        size="lg"
      >
        <div className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-0">
            Select an occupied table with a running order to generate its Tax Invoice:
          </p>

          {activeTables.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Receipt size={40} className="mb-2 text-secondary opacity-50" />
              <h6>No active dine-in orders pending bill generation</h6>
              <p className="small mb-0">
                All currently seated tables are either billed or have no items ordered yet.
              </p>
            </div>
          ) : (
            <div className="row g-3">
              {activeTables.map((tbl) => {
                const order = tbl.activeOrder;
                const isGenerating = generatingForOrderId === order?.id;
                return (
                  <div key={tbl.id} className="col-md-6">
                    <div className="card border h-100 shadow-sm">
                      <div className="card-body d-flex flex-column justify-content-between p-3">
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="fw-bold mb-0 text-dark">{tbl.tableNumber}</h5>
                            <span className="badge bg-warning text-dark">
                              {order?.status || 'OCCUPIED'}
                            </span>
                          </div>
                          <div className="small text-muted mb-2">
                            Order #{order?.orderNumber || tbl.currentOrderId} •{' '}
                            {order?.items?.length || 0} items
                          </div>
                          <div className="fs-5 fw-bold text-dark mb-3">
                            ₹{order?.totalAmount || 0}{' '}
                            <span className="small text-muted fw-normal">+ 5% GST</span>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1 shadow-sm fw-bold"
                          onClick={() => handleGenerateBillForOrder(order.id)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" />{' '}
                              Generating...
                            </>
                          ) : (
                            <>
                              <Receipt size={14} /> Generate & View Bill
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

          <div className="d-flex justify-content-end pt-3 border-top">
            <button className="btn btn-secondary btn-sm" onClick={() => setIsBillTableModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
