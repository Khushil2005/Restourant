import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal, ConfirmDialog } from '../../components/PermissionGate';
import { Bill } from '../../types';
import { Receipt, CreditCard, Percent, Scissors, Printer, Eye } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const BillingPage: React.FC = () => {
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  // Bill View & Print Modal
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Discount Modal
  const [discountBill, setDiscountBill] = useState<Bill | null>(null);
  const [discountCode, setDiscountCode] = useState('');

  // Split Bill Modal
  const [splitBillItem, setSplitBillItem] = useState<Bill | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);

  const loadBills = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/billing');
      if (res.success) {
        setBills(res.data);
        const qBillId = searchParams.get('billId');
        if (qBillId) {
          const found = res.data.find((b: Bill) => b.id === qBillId);
          if (found) setSelectedBill(found);
        }
      }
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  const handleApplyDiscount = async () => {
    if (!discountBill || !discountCode) return;
    try {
      const res: any = await apiClient.post(`/billing/${discountBill.id}/apply-discount`, {
        discountCode
      });
      if (res.success) {
        alert('Discount coupon applied successfully.');
        setDiscountBill(null);
        setDiscountCode('');
        loadBills();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to apply discount.');
    }
  };

  const handleSplitBill = async () => {
    if (!splitBillItem) return;
    try {
      await apiClient.post(`/billing/${splitBillItem.id}/split`, { splitCount });
      alert(`Bill split into ${splitCount} equal invoices.`);
      setSplitBillItem(null);
      loadBills();
    } catch (err: any) {
      alert(err.message || 'Failed to split bill.');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Customer Billing & Invoices</h4>
          <p className="text-muted small mb-0">Generate restaurant invoices, split tabs, apply discounts, and print receipts</p>
        </div>
      </div>

      {/* Bills Table */}
      <DataTable<Bill>
        columns={[
          { header: 'Bill No', accessor: 'billNumber', width: 140 },
          { header: 'Customer', accessor: (row) => row.customerName || 'Walk-in Guest' },
          { header: 'Subtotal', accessor: (row) => `₹${row.subtotal}` },
          { header: 'Discount', accessor: (row) => row.discountAmount > 0 ? <span className="text-danger">-₹{row.discountAmount}</span> : '₹0' },
          { header: 'Tax (5% GST)', accessor: (row) => `₹${row.taxAmount}` },
          {
            header: 'Total Payable',
            accessor: (row) => <span className="fw-bold text-dark fs-6">₹{row.totalPayable}</span>
          },
          {
            header: 'Status',
            accessor: (row) => (
              <span className={`badge bg-${
                row.status === 'PAID' ? 'success' : row.status === 'PARTIALLY_PAID' ? 'warning text-dark' : 'danger'
              }`}>
                {row.status}
              </span>
            )
          }
        ]}
        data={bills}
        searchPlaceholder="Search bills by number or customer..."
        actions={(row) => (
          <>
            <button
              className="btn btn-outline-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
              onClick={() => setSelectedBill(row)}
              title="View Invoice"
            >
              <Eye size={14} /> View
            </button>

            {row.status === 'UNPAID' && can('discount.apply') && (
              <button
                className="btn btn-outline-warning btn-sm p-1 px-2 d-flex align-items-center gap-1 text-dark"
                onClick={() => setDiscountBill(row)}
                title="Apply Promo Discount"
              >
                <Percent size={14} /> Promo
              </button>
            )}

            {row.status === 'UNPAID' && can('billing.split') && (
              <button
                className="btn btn-outline-secondary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => setSplitBillItem(row)}
                title="Split Bill"
              >
                <Scissors size={14} /> Split
              </button>
            )}

            {row.status !== 'PAID' && can('payment.create') && (
              <button
                className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => navigate(`/payments?billId=${row.id}&amount=${row.totalPayable}`)}
                title="Collect Settlement Payment"
              >
                <CreditCard size={14} /> Pay
              </button>
            )}
          </>
        )}
      />

      {/* BILL VIEW & PRINT INVOICE MODAL */}
      <Modal
        isOpen={!!selectedBill}
        onClose={() => setSelectedBill(null)}
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
              <span className="badge bg-primary mt-2 px-3 py-1">ORIGINAL TAX INVOICE</span>
            </div>

            {/* Bill Meta */}
            <div className="d-flex justify-content-between small text-secondary mb-3">
              <div>
                <div><strong>Invoice No:</strong> {selectedBill.billNumber}</div>
                <div><strong>Customer:</strong> {selectedBill.customerName || 'Walk-in Guest'}</div>
              </div>
              <div className="text-end">
                <div><strong>Date:</strong> {new Date(selectedBill.createdAt).toLocaleDateString()}</div>
                <div><strong>Time:</strong> {new Date(selectedBill.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="table-responsive">
              <table className="table table-sm table-bordered align-middle mb-3" style={{ minWidth: 420 }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 200, whiteSpace: 'nowrap' }}>Item Description</th>
                    <th className="text-center" style={{ width: 80, whiteSpace: 'nowrap' }}>Qty</th>
                    <th className="text-end" style={{ width: 110, whiteSpace: 'nowrap' }}>Unit Price</th>
                    <th className="text-end" style={{ width: 110, whiteSpace: 'nowrap' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap' }} className="fw-medium text-dark">{it.itemName}</td>
                      <td className="text-center" style={{ whiteSpace: 'nowrap' }}>{it.quantity}</td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>₹{it.unitPrice}</td>
                      <td className="text-end fw-bold" style={{ whiteSpace: 'nowrap' }}>₹{it.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="row justify-content-end">
              <div className="col-12 col-sm-8 col-md-6">
                <div className="d-flex justify-content-between small mb-1">
                  <span>Subtotal:</span>
                  <span>₹{selectedBill.subtotal}</span>
                </div>
                {selectedBill.discountAmount > 0 && (
                  <div className="d-flex justify-content-between small text-danger mb-1">
                    <span>Discount:</span>
                    <span>-₹{selectedBill.discountAmount}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between small mb-1">
                  <span>CGST (2.5%):</span>
                  <span>₹{Math.round(selectedBill.taxAmount / 2)}</span>
                </div>
                <div className="d-flex justify-content-between small mb-1">
                  <span>SGST (2.5%):</span>
                  <span>₹{Math.round(selectedBill.taxAmount / 2)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold text-dark fs-5 border-top pt-2 mt-1">
                  <span>Grand Total:</span>
                  <span>₹{selectedBill.totalPayable}</span>
                </div>
                <div className="d-flex justify-content-between small text-muted">
                  <span>Status:</span>
                  <span className="fw-bold">{selectedBill.status}</span>
                </div>
              </div>
            </div>

            <div className="text-center border-top pt-3 mt-4 small text-muted">
              Thank you for dining with us! Please visit again.
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top no-print">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedBill(null)}>Close</button>
              <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={handlePrintReceipt}>
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* APPLY DISCOUNT MODAL */}
      <Modal
        isOpen={!!discountBill}
        onClose={() => setDiscountBill(null)}
        title="Apply Promotional Discount Coupon"
      >
        <div className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-1">
            Apply discount code to <strong>Invoice {discountBill?.billNumber}</strong> (Bill Amount: ₹{discountBill?.subtotal}):
          </p>
          <div>
            <label className="form-label small fw-bold">Promo / Discount Code</label>
            <input
              type="text"
              className="form-control text-uppercase"
              placeholder="e.g. FLAT10, WELCOME20, FESTIVE15"
              value={discountCode}
              onChange={e => setDiscountCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button className="btn btn-secondary btn-sm" onClick={() => setDiscountBill(null)}>Cancel</button>
            <button className="btn btn-warning btn-sm fw-bold" disabled={!discountCode} onClick={handleApplyDiscount}>
              Apply Code
            </button>
          </div>
        </div>
      </Modal>

      {/* SPLIT BILL MODAL */}
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
              onChange={e => setSplitCount(Number(e.target.value))}
            />
          </div>
          <div className="p-3 bg-light rounded border text-center">
            <small className="text-muted d-block">Each guest pays:</small>
            <span className="fs-4 fw-bold text-primary">
              ₹{Math.round((splitBillItem?.totalPayable || 0) / splitCount)}
            </span>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button className="btn btn-secondary btn-sm" onClick={() => setSplitBillItem(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSplitBill}>
              Confirm Split
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
