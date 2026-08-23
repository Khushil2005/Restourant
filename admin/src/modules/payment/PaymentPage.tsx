import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal, ConfirmDialog } from '../../components/PermissionGate';
import { Payment } from '../../types';
import { CreditCard, CheckCircle2, RotateCcw, DollarSign, QrCode, Banknote } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const PaymentPage: React.FC = () => {
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Settlement Form State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payBillId, setPayBillId] = useState<string>(searchParams.get('billId') || '');
  const [payAmount, setPayAmount] = useState<number>(Number(searchParams.get('amount') || 0));
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  
  // Cash Tendered calculator
  const [tenderedCash, setTenderedCash] = useState<number>(0);

  // Split amounts
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [splitCard, setSplitCard] = useState<number>(0);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/payments');
      if (res.success) {
        setPayments(res.data);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    if (searchParams.get('billId')) {
      setIsPayModalOpen(true);
      setTenderedCash(Number(searchParams.get('amount') || 0));
      setSplitCash(Number(searchParams.get('amount') || 0));
    }
  }, []);

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let transactions = undefined;
      if (paymentMethod === 'SPLIT') {
        const totalSplit = splitCash + splitUpi + splitCard;
        if (totalSplit !== payAmount) {
          alert(`Split totals (₹${totalSplit}) must equal exact bill amount (₹${payAmount}).`);
          return;
        }
        transactions = [
          { method: 'CASH', amount: splitCash },
          { method: 'UPI', amount: splitUpi },
          { method: 'CARD', amount: splitCard }
        ].filter(t => t.amount > 0);
      }

      const res: any = await apiClient.post('/payments', {
        billId: payBillId,
        amount: payAmount,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        transactions
      });

      if (res.success) {
        alert('Payment collected successfully! Order completed, recipe inventory reduced, and Journal Entry posted to Accounts.');
        setIsPayModalOpen(false);
        navigate('/payments');
        loadPayments();
      }
    } catch (err: any) {
      alert(err.message || 'Payment processing failed.');
    }
  };

  const handleReconcile = async (id: string) => {
    try {
      await apiClient.patch(`/payments/${id}/reconcile`);
      loadPayments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const changeReturn = Math.max(0, tenderedCash - payAmount);

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Payment Settlements & Reconciliation</h4>
          <p className="text-muted small mb-0">Record multi-tender collections, UPI UTR verification, and automated double-entry ledger posting</p>
        </div>
      </div>

      {/* Payments Table */}
      <DataTable<Payment>
        columns={[
          { header: 'Payment #', accessor: 'paymentNumber', width: 140 },
          {
            header: 'Method',
            accessor: (row) => (
              <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1">
                {row.paymentMethod === 'CASH' && <Banknote size={14} className="text-success" />}
                {row.paymentMethod === 'UPI' && <QrCode size={14} className="text-primary" />}
                {row.paymentMethod === 'CARD' && <CreditCard size={14} className="text-warning" />}
                {row.paymentMethod}
              </span>
            )
          },
          {
            header: 'Settled Amount',
            accessor: (row) => <span className="fw-bold text-success fs-6">₹{row.amount.toLocaleString()}</span>
          },
          {
            header: 'Reference / UTR',
            accessor: (row) => row.referenceNumber || 'N/A'
          },
          {
            header: 'Date & Time',
            accessor: (row) => new Date(row.createdAt).toLocaleString()
          },
          {
            header: 'Accounts Reconciliation',
            accessor: (row) => (
              <span className={`badge ${row.isReconciled ? 'bg-success' : 'bg-secondary'}`}>
                {row.isReconciled ? 'Reconciled' : 'Pending'}
              </span>
            )
          }
        ]}
        data={payments}
        searchPlaceholder="Search payment # or reference..."
        actions={(row) => (
          <>
            {!row.isReconciled && can('payment.reconcile') && (
              <button
                className="btn btn-outline-success btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => handleReconcile(row.id)}
                title="Mark Reconciled in Bank"
              >
                <CheckCircle2 size={14} /> Reconcile
              </button>
            )}
          </>
        )}
      />

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Collect & Settle Bill Payment"
      >
        <form onSubmit={handleProcessPayment} className="d-flex flex-column gap-3">
          <div className="p-3 bg-primary-subtle text-primary rounded border border-primary-subtle d-flex justify-content-between align-items-center">
            <span className="fw-bold">Total Amount Due:</span>
            <span className="fs-4 fw-bold">₹{payAmount}</span>
          </div>

          <div>
            <label className="form-label small fw-bold">Payment Method</label>
            <div className="btn-group w-100">
              {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  className={`btn btn-sm ${paymentMethod === m ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => setPaymentMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'CASH' && (
            <div className="p-3 bg-light rounded border">
              <label className="form-label small fw-bold">Cash Tendered by Customer</label>
              <input
                type="number"
                className="form-control"
                value={tenderedCash}
                onChange={e => setTenderedCash(Number(e.target.value))}
                min={payAmount}
              />
              <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                <span className="small text-muted">Change to Return:</span>
                <span className="fs-5 fw-bold text-success">₹{changeReturn}</span>
              </div>
            </div>
          )}

          {paymentMethod === 'UPI' && (
            <div>
              <label className="form-label small fw-bold">UPI Reference / UTR Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 423456789012"
                required
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
              />
            </div>
          )}

          {paymentMethod === 'CARD' && (
            <div>
              <label className="form-label small fw-bold">Card Approval / Auth Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. AUTH-88219"
                required
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
              />
            </div>
          )}

          {paymentMethod === 'SPLIT' && (
            <div className="d-flex flex-column gap-2 p-3 bg-light rounded border">
              <div className="row g-2">
                <div className="col-4">
                  <label className="form-label small fw-bold">Cash (₹)</label>
                  <input type="number" className="form-control form-control-sm" value={splitCash} onChange={e => setSplitCash(Number(e.target.value))} />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-bold">UPI (₹)</label>
                  <input type="number" className="form-control form-control-sm" value={splitUpi} onChange={e => setSplitUpi(Number(e.target.value))} />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-bold">Card (₹)</label>
                  <input type="number" className="form-control form-control-sm" value={splitCard} onChange={e => setSplitCard(Number(e.target.value))} />
                </div>
              </div>
              <div className="d-flex justify-content-between small text-muted pt-1">
                <span>Sum of Split: ₹{splitCash + splitUpi + splitCard}</span>
                <span className={splitCash + splitUpi + splitCard === payAmount ? 'text-success fw-bold' : 'text-danger'}>
                  Target: ₹{payAmount}
                </span>
              </div>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPayModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-success btn-sm fw-bold">
              Record & Finalize Settlement
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
