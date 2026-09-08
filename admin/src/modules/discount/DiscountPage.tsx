import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal, ConfirmDialog } from '../../components/PermissionGate';
import { Plus, Percent, Trash2, Edit2, ShieldAlert } from 'lucide-react';

export const DiscountPage: React.FC = () => {
  const { can } = usePermission();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: 500,
    requiresApprovalAbove: 20
  });

  const loadRules = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/discounts');
      if (res.success) setRules(res.data);
    } catch (err) {
      console.error('Failed to load discounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/discounts', {
        ...formData,
        type: formData.discountType,
        value: formData.discountValue
      });
      setIsModalOpen(false);
      loadRules();
    } catch (err: any) {
      alert(err.message || 'Failed to create discount rule.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this discount rule?')) return;
    try {
      await apiClient.delete(`/discounts/${id}`);
      loadRules();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Promotional Discounts & Policies</h4>
          <p className="text-muted small mb-0">Define coupon codes, seasonal percentage discounts, and manager authorization limits</p>
        </div>
        {can('discount.create') && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> New Discount Rule
          </button>
        )}
      </div>

      {/* Rules Table */}
      <DataTable<any>
        columns={[
          {
            header: 'Coupon Code',
            accessor: (row) => <span className="badge bg-dark font-monospace fs-6">{row.code}</span>,
            width: 140
          },
          { header: 'Rule Title', accessor: 'name' },
          {
            header: 'Value',
            accessor: (row) => {
              const discType = row.type || row.discountType || 'PERCENTAGE';
              const discVal = row.value ?? row.discountValue ?? 0;
              return (
                <span className="fw-bold text-success">
                  {discType === 'PERCENTAGE' ? `${discVal}% OFF` : `₹${discVal} FLAT`}
                </span>
              );
            }
          },
          { header: 'Min Order', accessor: (row) => `₹${row.minOrderAmount || 0}` },
          { header: 'Max Cap', accessor: (row) => row.maxDiscountAmount ? `₹${row.maxDiscountAmount}` : 'No limit' },
          {
            header: 'Manager Approval Limit',
            accessor: (row) => (
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                {row.requiresApprovalAbove ? `Above ${row.requiresApprovalAbove}%` : (row.requiresApproval ? 'Requires Approval' : 'Auto Approved')}
              </span>
            )
          }
        ]}
        data={rules}
        searchPlaceholder="Search coupon code..."
        actions={(row) => (
          <>
            {can('discount.delete') && (
              <button className="btn btn-outline-danger btn-sm p-1" onClick={() => handleDelete(row.id)} title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      />

      {/* CREATE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Promotional Discount Rule"
      >
        <form onSubmit={handleCreate} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Coupon Code</label>
              <input type="text" className="form-control text-uppercase" placeholder="e.g. VIP20" required value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Title</label>
              <input type="text" className="form-control" placeholder="e.g. VIP Member Discount" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Type</label>
              <select className="form-select form-select-sm" value={formData.discountType} onChange={e => setFormData({ ...formData, discountType: e.target.value })}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Discount Value</label>
              <input type="number" className="form-control form-control-sm" required value={formData.discountValue} onChange={e => setFormData({ ...formData, discountValue: Number(e.target.value) })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Min Order (₹)</label>
              <input type="number" className="form-control form-control-sm" value={formData.minOrderAmount} onChange={e => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Max Cap (₹)</label>
              <input type="number" className="form-control form-control-sm" value={formData.maxDiscountAmount} onChange={e => setFormData({ ...formData, maxDiscountAmount: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <label className="form-label small fw-bold">Require Manager Approval Above (%)</label>
            <input type="number" className="form-control form-control-sm" value={formData.requiresApprovalAbove} onChange={e => setFormData({ ...formData, requiresApprovalAbove: Number(e.target.value) })} />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Save Discount Policy</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
