import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { InventoryItem } from '../../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  BookOpen,
  Plus,
  AlertTriangle
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { can } = usePermission();
  const [items, setItems] = useState<InventoryItem[]>([]);

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);

  // Selected item for operations
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

  // Form states
  const [itemForm, setItemForm] = useState({
    itemCode: '',
    name: '',
    category: 'RAW_MATERIAL',
    unitId: 'unit_kg',
    unitSymbol: 'kg',
    currentStock: 0,
    minimumStockLevel: 5,
    reorderQuantity: 20,
    costPerUnit: 50
  });

  const [stockOpForm, setStockOpForm] = useState({
    quantity: 1,
    unitPrice: 0,
    reason: 'PHYSICAL_COUNT',
    notes: ''
  });

  const loadItems = async () => {
    try {
      const res: any = await apiClient.get('/inventory/items');
      if (res.success) setItems(res.data);
    } catch (err) {
      console.error('Failed to load inventory items:', err);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/inventory/items', itemForm);
      setIsItemModalOpen(false);
      loadItems();
    } catch (err: any) {
      alert(err.message || 'Failed to create item.');
    }
  };

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await apiClient.post('/inventory/stock-in', {
        itemId: selectedItem.id,
        quantity: stockOpForm.quantity,
        unitPrice: stockOpForm.unitPrice,
        notes: stockOpForm.notes
      });
      setIsStockInModalOpen(false);
      loadItems();
    } catch (err: any) {
      alert(err.message || 'Stock in failed.');
    }
  };

  const handleStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await apiClient.post('/inventory/stock-out', {
        itemId: selectedItem.id,
        quantity: stockOpForm.quantity,
        notes: stockOpForm.notes
      });
      setIsStockOutModalOpen(false);
      loadItems();
    } catch (err: any) {
      alert(err.message || 'Stock out failed.');
    }
  };

  const handleStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await apiClient.post('/inventory/adjust', {
        itemId: selectedItem.id,
        type: stockOpForm.quantity >= 0 ? 'INCREASE' : 'DECREASE',
        quantity: Math.abs(stockOpForm.quantity),
        reason: stockOpForm.reason
      });
      setIsAdjustModalOpen(false);
      loadItems();
    } catch (err: any) {
      alert(err.message || 'Stock adjust failed.');
    }
  };

  const viewLedger = async (item: InventoryItem) => {
    setSelectedItem(item);
    try {
      const res: any = await apiClient.get(`/inventory/ledger?itemId=${item.id}`);
      if (res.success) {
        setLedgerEntries(res.data);
        setIsLedgerModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
    }
  };

  const totalStockValuation = items.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit), 0);
  const lowStockCount = items.filter(i => i.currentStock <= i.minimumStockLevel).length;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Raw Materials & Inventory Management</h4>
          <p className="text-muted small mb-0">Track kitchen ingredients, automated recipe consumption, stock adjustments, and reorder levels</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="badge bg-white text-dark border p-2 small shadow-sm">
            Total Valuation: <strong className="text-primary">₹{Math.round(totalStockValuation).toLocaleString()}</strong>
          </div>
          {can('inventory.item.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsItemModalOpen(true)}>
              <Plus size={16} /> New Inventory Item
            </button>
          )}
        </div>
      </div>

      {/* Low stock banner */}
      {lowStockCount > 0 && (
        <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center gap-2 py-2 px-3 small rounded mb-0">
          <AlertTriangle size={18} className="text-danger" />
          <span><strong>{lowStockCount} items</strong> are currently below their minimum safety stock threshold!</span>
        </div>
      )}

      {/* Inventory Table */}
      <DataTable<InventoryItem>
        columns={[
          { header: 'Item Code', accessor: 'itemCode', width: 120 },
          {
            header: 'Item Description',
            accessor: (row) => (
              <div>
                <span className="fw-bold text-dark">{row.name}</span>
                <span className="badge bg-light text-muted border ms-2 small">{row.category}</span>
              </div>
            )
          },
          {
            header: 'Current Stock',
            accessor: (row) => (
              <div>
                <span className={`fw-bold fs-6 ${row.currentStock <= row.minimumStockLevel ? 'text-danger' : 'text-success'}`}>
                  {row.currentStock} {row.unitSymbol || 'units'}
                </span>
                {row.currentStock <= row.minimumStockLevel && (
                  <span className="badge bg-danger ms-2" style={{ fontSize: '0.65rem' }}>LOW</span>
                )}
              </div>
            )
          },
          { header: 'Min Safety', accessor: (row) => `${row.minimumStockLevel} ${row.unitSymbol || 'units'}` },
          { header: 'Cost / Unit', accessor: (row) => `₹${row.costPerUnit}` },
          {
            header: 'Asset Value',
            accessor: (row) => <span className="fw-semibold">₹{Math.round(row.currentStock * row.costPerUnit).toLocaleString()}</span>
          }
        ]}
        data={items}
        searchPlaceholder="Search ingredient name, code..."
        actions={(row) => (
          <>
            {can('inventory.stock_in') && (
              <button
                className="btn btn-outline-success btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => { setSelectedItem(row); setIsStockInModalOpen(true); }}
                title="Stock In (Receive)"
              >
                <ArrowDownLeft size={14} /> In
              </button>
            )}
            {can('inventory.stock_out') && (
              <button
                className="btn btn-outline-danger btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => { setSelectedItem(row); setIsStockOutModalOpen(true); }}
                title="Stock Out (Issue/Waste)"
              >
                <ArrowUpRight size={14} /> Out
              </button>
            )}
            {can('inventory.adjust') && (
              <button
                className="btn btn-outline-warning btn-sm p-1 px-2 text-dark d-flex align-items-center gap-1"
                onClick={() => { setSelectedItem(row); setIsAdjustModalOpen(true); }}
                title="Adjust Stock"
              >
                <SlidersHorizontal size={14} /> Adjust
              </button>
            )}
            {can('inventory.ledger') && (
              <button
                className="btn btn-outline-secondary btn-sm p-1"
                onClick={() => viewLedger(row)}
                title="View Stock Ledger"
              >
                <BookOpen size={14} />
              </button>
            )}
          </>
        )}
      />

      {/* CREATE INVENTORY ITEM MODAL */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title="Add New Raw Material / Inventory Item"
      >
        <form onSubmit={handleCreateItem} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-8">
              <label className="form-label small fw-bold">Item Name</label>
              <input type="text" className="form-control form-control-sm" placeholder="e.g. Basmati Rice, Paneer, Chicken" required value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold">Item Code</label>
              <input type="text" className="form-control form-control-sm" placeholder="e.g. RAW-RIC-01" required value={itemForm.itemCode} onChange={e => setItemForm({ ...itemForm, itemCode: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Category</label>
              <select className="form-select form-select-sm" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>
                <option value="RAW_MATERIAL">Raw Material / Grocery</option>
                <option value="DAIRY">Dairy Products</option>
                <option value="MEAT">Meat & Poultry</option>
                <option value="VEGETABLES">Fresh Vegetables</option>
                <option value="BEVERAGE">Beverage & Bar</option>
                <option value="PACKAGING">Packaging Material</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Unit Symbol</label>
              <input type="text" className="form-control form-control-sm" placeholder="e.g. kg, ltr, g, pcs" required value={itemForm.unitSymbol} onChange={e => setItemForm({ ...itemForm, unitSymbol: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-4">
              <label className="form-label small fw-bold">Initial Stock</label>
              <input type="number" className="form-control form-control-sm" required value={itemForm.currentStock} onChange={e => setItemForm({ ...itemForm, currentStock: Number(e.target.value) })} />
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold">Min Safety Level</label>
              <input type="number" className="form-control form-control-sm" required value={itemForm.minimumStockLevel} onChange={e => setItemForm({ ...itemForm, minimumStockLevel: Number(e.target.value) })} />
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold">Cost Per Unit (₹)</label>
              <input type="number" className="form-control form-control-sm" required value={itemForm.costPerUnit} onChange={e => setItemForm({ ...itemForm, costPerUnit: Number(e.target.value) })} />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsItemModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Save Inventory Item</button>
          </div>
        </form>
      </Modal>

      {/* STOCK IN MODAL */}
      <Modal
        isOpen={isStockInModalOpen}
        onClose={() => setIsStockInModalOpen(false)}
        title={`Stock In: ${selectedItem?.name}`}
      >
        <form onSubmit={handleStockIn} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Quantity to Add ({selectedItem?.unitSymbol})</label>
            <input type="number" min="0.1" step="any" className="form-control" required value={stockOpForm.quantity} onChange={e => setStockOpForm({ ...stockOpForm, quantity: Number(e.target.value) })} />
          </div>
          <div>
            <label className="form-label small fw-bold">Notes / Invoice Ref</label>
            <input type="text" className="form-control form-control-sm" placeholder="e.g. Direct local market purchase" value={stockOpForm.notes} onChange={e => setStockOpForm({ ...stockOpForm, notes: e.target.value })} />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsStockInModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-success btn-sm">Record Stock In</button>
          </div>
        </form>
      </Modal>

      {/* STOCK OUT MODAL */}
      <Modal
        isOpen={isStockOutModalOpen}
        onClose={() => setIsStockOutModalOpen(false)}
        title={`Stock Out / Wastage: ${selectedItem?.name}`}
      >
        <form onSubmit={handleStockOut} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Quantity to Deduct ({selectedItem?.unitSymbol})</label>
            <input type="number" min="0.1" step="any" className="form-control" required value={stockOpForm.quantity} onChange={e => setStockOpForm({ ...stockOpForm, quantity: Number(e.target.value) })} />
          </div>
          <div>
            <label className="form-label small fw-bold">Reason / Notes</label>
            <input type="text" className="form-control form-control-sm" placeholder="e.g. Expired batch discarded, kitchen prep issue" required value={stockOpForm.notes} onChange={e => setStockOpForm({ ...stockOpForm, notes: e.target.value })} />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsStockOutModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-danger btn-sm">Record Stock Out</button>
          </div>
        </form>
      </Modal>

      {/* STOCK ADJUST MODAL */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Physical Stock Adjustment: ${selectedItem?.name}`}
      >
        <form onSubmit={handleStockAdjust} className="d-flex flex-column gap-3">
          <p className="small text-muted mb-1">
            Current system recorded stock: <strong>{selectedItem?.currentStock} {selectedItem?.unitSymbol}</strong>
          </p>
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Adjustment Difference (+ / -)</label>
              <input type="number" step="any" className="form-control" placeholder="+2 or -1.5" required value={stockOpForm.quantity} onChange={e => setStockOpForm({ ...stockOpForm, quantity: Number(e.target.value) })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Reason</label>
              <select className="form-select" value={stockOpForm.reason} onChange={e => setStockOpForm({ ...stockOpForm, reason: e.target.value })}>
                <option value="PHYSICAL_COUNT">Physical Stock Audit</option>
                <option value="DAMAGE">Spillage / Damage</option>
                <option value="EXPIRY">Expired Shelf Life</option>
                <option value="THEFT">Pilferage / Loss</option>
              </select>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAdjustModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-warning btn-sm fw-bold">Apply Adjustment</button>
          </div>
        </form>
      </Modal>

      {/* STOCK LEDGER MODAL */}
      <Modal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        title={`Stock Transaction Audit Ledger: ${selectedItem?.name}`}
        size="lg"
      >
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Balance After</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-4 text-muted small">No recorded ledger transactions for this item.</td>
                </tr>
              ) : (
                ledgerEntries.map((l, idx) => (
                  <tr key={idx}>
                    <td className="small">{new Date(l.createdAt).toLocaleString()}</td>
                    <td>
                      <span className={`badge bg-${
                        l.transactionType.includes('IN') || l.transactionType === 'PURCHASE_RECEIPT' ? 'success' : 'danger'
                      }`}>
                        {l.transactionType}
                      </span>
                    </td>
                    <td className="fw-bold">{l.quantity}</td>
                    <td className="fw-bold text-dark">{l.balanceAfter}</td>
                    <td className="small text-muted">{l.referenceNumber || l.notes || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};
