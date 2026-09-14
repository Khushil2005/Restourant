import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { Expense } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { can } = usePermission();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'UTILITIES',
    amount: 1000,
    paymentMethod: 'CASH',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const loadExpenses = async () => {
    try {
      const res: any = await apiClient.get('/expenses');
      if (res.success) setExpenses(res.data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/expenses', formData);
      alert('Expense recorded and Journal Entry posted to Accounts.');
      setIsModalOpen(false);
      loadExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense voucher?')) return;
    try {
      await apiClient.delete(`/expenses/${id}`);
      loadExpenses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Operating Expenses & Vouchers</h4>
          <p className="text-muted small mb-0">Record utility bills, rent, daily operational expenses, and auto-post journal entries</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="badge bg-white text-dark border p-2 small shadow-sm">
            Total Logged: <strong className="text-danger">₹{totalExpense.toLocaleString()}</strong>
          </div>
          {can('expense.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Record Expense
            </button>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <DataTable<Expense>
        columns={[
          { header: 'Expense #', accessor: 'expenseNumber', width: 140 },
          { header: 'Title / Purpose', accessor: (row) => <span className="fw-bold text-dark">{row.title}</span> },
          {
            header: 'Category',
            accessor: (row) => <span className="badge bg-light text-dark border">{row.category}</span>
          },
          { header: 'Date', accessor: 'expenseDate' },
          { header: 'Paid Via', accessor: 'paymentMethod' },
          {
            header: 'Amount (₹)',
            accessor: (row) => <span className="fw-bold text-danger fs-6">₹{row.amount.toLocaleString()}</span>
          }
        ]}
        data={expenses}
        searchPlaceholder="Search expense title, category..."
        actions={(row) => (
          <>
            {can('expense.delete') && (
              <button className="btn btn-outline-danger btn-sm p-1" onClick={() => handleDelete(row.id)} title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      />

      {/* CREATE EXPENSE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Operating Expense Voucher"
      >
        <form onSubmit={handleCreate} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Expense Title / Description</label>
            <input type="text" className="form-control" placeholder="e.g. Electricity bill for main kitchen" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Category</label>
              <select className="form-select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option value="UTILITIES">Electricity & Water</option>
                <option value="RENT">Store Rent</option>
                <option value="MAINTENANCE">Repairs & Maintenance</option>
                <option value="MARKETING">Marketing & Ads</option>
                <option value="SUPPLIES">Kitchen Supplies / Misc</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Amount (₹)</label>
              <input type="number" min="1" className="form-control" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Paid From</label>
              <select className="form-select" value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}>
                <option value="CASH">Cash Drawer</option>
                <option value="BANK_TRANSFER">HDFC Bank Transfer</option>
                <option value="UPI">UPI Direct</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Expense Date</label>
              <input type="date" className="form-control" required value={formData.expenseDate} onChange={e => setFormData({ ...formData, expenseDate: e.target.value })} />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Post Expense Voucher</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
