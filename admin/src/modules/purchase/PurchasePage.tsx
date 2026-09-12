import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { PurchaseOrder, Supplier, InventoryItem } from '../../types';
import { Plus, CheckCircle2, PackageCheck, Trash2 } from 'lucide-react';

export const PurchasePage: React.FC = () => {
  const { can } = usePermission();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // Create PO Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<Array<{ inventoryItemId: string; quantity: number; unitPrice: number }>>([]);

  // Receive Goods Modal
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');

  const loadData = async () => {
    try {
      const [pRes, sRes, iRes]: any = await Promise.all([
        apiClient.get('/purchases/orders'),
        apiClient.get('/masters/suppliers'),
        apiClient.get('/inventory/items')
      ]);
      if (pRes.success) setOrders(pRes.data);
      if (sRes.success) setSuppliers(sRes.data);
      if (iRes.success) setInventoryItems(iRes.data);
    } catch (err) {
      console.error('Failed to load purchase data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItemRow = () => {
    if (inventoryItems.length === 0) return;
    setPoItems(prev => [...prev, { inventoryItemId: inventoryItems[0].id, quantity: 10, unitPrice: inventoryItems[0].costPerUnit || 50 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setPoItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItem = (idx: number, field: string, value: any) => {
    setPoItems(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      return updated;
    });
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || poItems.length === 0) {
      alert('Please select a supplier and at least one item.');
      return;
    }

    try {
      await apiClient.post('/purchases/orders', {
        supplierId: selectedSupplierId,
        items: poItems.map(it => {
          const raw = inventoryItems.find(i => i.id === it.inventoryItemId);
          return {
            inventoryItemId: it.inventoryItemId,
            itemName: raw?.name || 'Item',
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            totalPrice: Number(it.quantity) * Number(it.unitPrice)
          };
        })
      });

      alert('Purchase Order raised successfully.');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to raise PO.');
    }
  };

  const handleApprovePO = async (id: string) => {
    try {
      await apiClient.patch(`/purchases/orders/${id}/approve`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReceiveGoods = async () => {
    if (!receivingPo) return;
    try {
      await apiClient.post(`/purchases/orders/${receivingPo.id}/receive`, {
        vendorInvoiceNumber: vendorInvoiceNo || `INV-${Date.now()}`
      });
      alert('Goods Receipt Note (GRN) created! Stock levels have been incremented automatically in the warehouse.');
      setReceivingPo(null);
      setVendorInvoiceNo('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Receipt failed.');
    }
  };

  const totalPoAmount = poItems.reduce((sum, it) => sum + ((it.quantity || 0) * (it.unitPrice || 0)), 0);

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Procurement & Purchase Orders</h4>
          <p className="text-muted small mb-0">Create purchase orders, receive supplier shipments (GRN), and automate stock incrementation</p>
        </div>
        {can('purchase.create') && (
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={() => {
              setSelectedSupplierId(suppliers[0]?.id || '');
              setPoItems([{ inventoryItemId: inventoryItems[0]?.id || '', quantity: 10, unitPrice: inventoryItems[0]?.costPerUnit || 50 }]);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Raise Purchase Order
          </button>
        )}
      </div>

      {/* Orders Table */}
      <DataTable<PurchaseOrder>
        columns={[
          { header: 'PO Number', accessor: 'poNumber', width: 140 },
          {
            header: 'Supplier / Vendor',
            accessor: (row) => suppliers.find(s => s.id === row.supplierId)?.companyName || 'Supplier'
          },
          { header: 'Date', accessor: (row) => row.orderDate },
          { header: 'Items', accessor: (row) => `${row.items.length} line items` },
          {
            header: 'Order Total',
            accessor: (row) => <span className="fw-bold text-dark fs-6">₹{row.totalAmount.toLocaleString()}</span>
          },
          {
            header: 'Status',
            accessor: (row) => (
              <span className={`badge bg-${
                row.status === 'RECEIVED' ? 'success' : row.status === 'APPROVED' ? 'primary' : 'warning text-dark'
              }`}>
                {row.status}
              </span>
            )
          }
        ]}
        data={orders}
        searchPlaceholder="Search PO # or vendor..."
        actions={(row) => (
          <>
            {row.status === 'PENDING' && can('purchase.approve') && (
              <button
                className="btn btn-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => handleApprovePO(row.id)}
                title="Approve PO"
              >
                <CheckCircle2 size={14} /> Approve
              </button>
            )}

            {row.status === 'APPROVED' && can('purchase.receive') && (
              <button
                className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => setReceivingPo(row)}
                title="Receive Goods (GRN)"
              >
                <PackageCheck size={14} /> Receive GRN
              </button>
            )}
          </>
        )}
      />

      {/* CREATE PO MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Raise New Purchase Order (PO)"
        size="lg"
      >
        <form onSubmit={handleCreatePO} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Select Supplier / Vendor</label>
            <select
              className="form-select"
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.companyName} ({s.name})
                </option>
              ))}
            </select>
          </div>

          <div className="border rounded p-3 bg-light">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold small text-dark">Order Line Items</span>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={handleAddItemRow}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="d-flex flex-column gap-2">
              {poItems.map((it, idx) => {
                const raw = inventoryItems.find(i => i.id === it.inventoryItemId);

                return (
                  <div key={idx} className="row g-2 align-items-center">
                    <div className="col-5">
                      <select
                        className="form-select form-select-sm"
                        value={it.inventoryItemId}
                        onChange={e => {
                          const chosen = inventoryItems.find(i => i.id === e.target.value);
                          handleUpdateItem(idx, 'inventoryItemId', e.target.value);
                          if (chosen) handleUpdateItem(idx, 'unitPrice', chosen.costPerUnit || 50);
                        }}
                      >
                        {inventoryItems.map(rawItem => (
                          <option key={rawItem.id} value={rawItem.id}>
                            {rawItem.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-3">
                      <div className="input-group input-group-sm">
                        <input
                          type="number"
                          step="any"
                          min="1"
                          className="form-control"
                          value={it.quantity}
                          onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                        />
                        <span className="input-group-text bg-white">{raw?.unitSymbol || 'unit'}</span>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white">₹</span>
                        <input
                          type="number"
                          step="any"
                          className="form-control"
                          value={it.unitPrice}
                          onChange={e => handleUpdateItem(idx, 'unitPrice', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="col-1 text-end">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm p-1"
                        onClick={() => handleRemoveItemRow(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="d-flex justify-content-end align-items-center mt-3 pt-2 border-top">
              <span className="fw-bold fs-5 text-primary">PO Total: ₹{totalPoAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Issue Purchase Order</button>
          </div>
        </form>
      </Modal>

      {/* RECEIVE GOODS (GRN) MODAL */}
      <Modal
        isOpen={!!receivingPo}
        onClose={() => setReceivingPo(null)}
        title={`Receive Goods & Generate GRN: ${receivingPo?.poNumber}`}
      >
        <div className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-1">
            Receiving delivery for PO <strong>{receivingPo?.poNumber}</strong> (Total ₹{receivingPo?.totalAmount}).
            This will immediately increase current stock quantities in your warehouse inventory.
          </p>
          <div>
            <label className="form-label small fw-bold">Vendor Invoice / Delivery Challan Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. DC-9842"
              required
              value={vendorInvoiceNo}
              onChange={e => setVendorInvoiceNo(e.target.value)}
            />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReceivingPo(null)}>Cancel</button>
            <button type="button" className="btn btn-success btn-sm fw-bold" onClick={handleReceiveGoods}>
              Accept Delivery & Increase Stock
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
