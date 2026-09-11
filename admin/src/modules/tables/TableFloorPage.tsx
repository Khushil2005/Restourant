import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { useSocket } from '../../context/SocketContext';
import { Modal } from '../../components/PermissionGate';
import { DiningTable, FloorZone, Bill } from '../../types';
import { Grid, Users, ArrowRightLeft, ShoppingBag, CheckCircle, RefreshCw, Plus, Trash2, Receipt, Download, Printer, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateInvoicePdf, printInvoiceReceipt } from '../../utils/invoicePdf';

import { appCache } from '../../api/cache';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export const TableFloorPage: React.FC = () => {
  const { can } = usePermission();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const cachedTables = appCache.get('/tables/floor-layout')?.data || appCache.get('/tables/floor-layout');
  const cachedZones = appCache.get('/masters/floor-zones')?.data || appCache.get('/masters/floor-zones');

  const [tables, setTables] = useState<DiningTable[]>(() => Array.isArray(cachedTables) ? cachedTables : []);
  const [floorZones, setFloorZones] = useState<FloorZone[]>(() => Array.isArray(cachedZones) ? cachedZones : []);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [loading, setLoading] = useState(() => !Array.isArray(cachedTables) || cachedTables.length === 0);

  // Manage / Delete Zones Modal
  const [isManageZonesModalOpen, setIsManageZonesModalOpen] = useState(false);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);

  // Add Zone Quick Modal
  const [isAddZoneModalOpen, setIsAddZoneModalOpen] = useState(false);
  const [newZoneData, setNewZoneData] = useState<any>({
    name: '',
    code: '',
    description: '',
    color: '#0d6efd',
    displayOrder: 1,
    isActive: true
  });
  const [savingZone, setSavingZone] = useState(false);

  // Transfer Modal
  const [transferSource, setTransferSource] = useState<DiningTable | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');

  // Bill Preview Modal
  const [tableBill, setTableBill] = useState<Bill | null>(null);
  const [billLoadingTableId, setBillLoadingTableId] = useState<string | null>(null);

  const loadFloor = async (showSpinner = false, forceFresh = false) => {
    if (showSpinner || tables.length === 0) {
      setLoading(true);
    }
    try {
      const config = forceFresh ? { forceFresh: true } : undefined;
      const [layoutRes, zonesRes]: any = await Promise.all([
        apiClient.get('/tables/floor-layout', config),
        apiClient.get('/masters/floor-zones', config).catch(() => null)
      ]);
      if (layoutRes?.success) {
        setTables(layoutRes.data);
      }

      if (zonesRes?.success && Array.isArray(zonesRes.data)) {
        setFloorZones(zonesRes.data);
      }
    } catch (err) {
      console.error('Failed to load table floor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloor(false, true);
  }, []);

  // Universal Auto-Refresh: Tab focus, global mutation events, and 3s periodic background sync
  useAutoRefresh(() => loadFloor(false, true), {
    entities: ['tables', 'floor-zones', 'orders', 'billing', 'masters', 'bookings'],
    intervalMs: 3000,
    refreshOnFocus: true
  });

  useEffect(() => {
    if (!socket) return;
    const refreshLive = () => loadFloor(false, true);
    socket.on('table.updated', refreshLive);
    socket.on('order.created', refreshLive);
    socket.on('order.updated', refreshLive);
    socket.on('data.changed', refreshLive);
    socket.on('master.updated', refreshLive);
    return () => {
      socket.off('table.updated', refreshLive);
      socket.off('order.created', refreshLive);
      socket.off('order.updated', refreshLive);
      socket.off('data.changed', refreshLive);
      socket.off('master.updated', refreshLive);
    };
  }, [socket]);

  const handleStatusChange = async (tableId: string, status: string) => {
    try {
      await apiClient.patch(`/tables/${tableId}/status`, { status });
      loadFloor(false, true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransfer = async () => {
    if (!transferSource || !transferTargetId) return;
    try {
      await apiClient.post('/tables/transfer', {
        sourceTableId: transferSource.id,
        destTableId: transferTargetId
      });
      setTransferSource(null);
      setTransferTargetId('');
      loadFloor(false, true);
    } catch (err: any) {
      alert(err.message || 'Transfer failed.');
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneData.name.trim()) return;
    setSavingZone(true);
    try {
      const code = (newZoneData.code || newZoneData.name).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const payload = {
        name: newZoneData.name.trim(),
        code,
        description: newZoneData.description?.trim() || '',
        color: newZoneData.color || '#0d6efd',
        displayOrder: Number(newZoneData.displayOrder || (floorZones.length + 1)),
        isActive: true
      };

      const res: any = await apiClient.post('/masters/floor-zones', payload);
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to create floor zone.');
      }

      setIsAddZoneModalOpen(false);
      setNewZoneData({
        name: '',
        code: '',
        description: '',
        color: '#0d6efd',
        displayOrder: floorZones.length + 2,
        isActive: true
      });
      setSelectedZone(code);
      await loadFloor(false, true);
    } catch (err: any) {
      alert(err.message || 'Failed to create floor zone.');
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async (zone: { id?: string; code: string; name: string }) => {
    const zoneObj = floorZones.find(z => z.code === zone.code || z.id === zone.id);
    const targetId = zoneObj?.id || zone.id || zone.code;

    if (!window.confirm(`Are you sure you want to delete Floor Zone "${zone.name}"? Any assigned tables will safely be reassigned to the default active zone.`)) {
      return;
    }

    setDeletingZoneId(targetId);
    try {
      await apiClient.delete(`/masters/floor-zones/${encodeURIComponent(targetId)}`);

      if (selectedZone === zone.code) {
        setSelectedZone('ALL');
      }
      await loadFloor(false, true);
    } catch (err: any) {
      alert(err.message || 'Failed to delete floor zone.');
    } finally {
      setDeletingZoneId(null);
    }
  };

  // Build active zone list mapping for quick label lookup
  const zoneCodeMap = new Map<string, { code: string; name: string; color: string }>();
  floorZones.forEach(z => {
    zoneCodeMap.set(z.code, { code: z.code, name: z.name, color: z.color || '#0d6efd' });
  });
  // Tabs strictly mirror actual saved floor zones in database (prevent phantom resurrected tabs)
  const activeZoneList = floorZones.map(z => ({
    code: z.code,
    name: z.name,
    color: z.color || '#0d6efd'
  }));

  const filteredTables = selectedZone === 'ALL'
    ? tables
    : tables.filter(t => t.floorZone === selectedZone);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'success';
      case 'OCCUPIED': return 'danger';
      case 'RESERVED': return 'warning';
      case 'CLEANING': return 'info';
      case 'MAINTENANCE': return 'secondary';
      default: return 'light';
    }
  };

  return (
    <div className="d-flex flex-column gap-3 gap-sm-4 pb-4" style={{ overflowX: 'hidden' }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Dining Floor Map</h4>
          <p className="text-muted small mb-0">Visual seating plan, live table statuses, order turnover, and table transfers</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {can('masters.table.create') && (
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
              onClick={() => {
                setNewZoneData({
                  name: '',
                  code: '',
                  description: '',
                  color: '#0d6efd',
                  displayOrder: floorZones.length + 1,
                  isActive: true
                });
                setIsAddZoneModalOpen(true);
              }}
              title="Add New Floor Zone"
            >
              <Plus size={15} /> Add Floor Zone
            </button>
          )}
          {can('masters.table.delete') && floorZones.length > 0 && (
            <button
              className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-xs"
              onClick={() => setIsManageZonesModalOpen(true)}
              title="Manage and Delete Floor Zones"
            >
              <Trash2 size={14} /> Manage Zones
            </button>
          )}
          <button
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-xs"
            onClick={() => loadFloor(true)}
            disabled={loading}
            title="Refresh Floor Layout"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Zone Filters & Legend */}
      <div className="card shadow-sm border-0 p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="nav nav-pills gap-1 scrollable-pills-container flex-grow-1" style={{ minWidth: 0 }}>
            <button
              className={`btn btn-sm text-nowrap d-flex align-items-center ${selectedZone === 'ALL' ? 'btn-primary fw-bold shadow-sm' : 'btn-light'}`}
              onClick={() => setSelectedZone('ALL')}
            >
              <span>All Zones</span>
              <span className="ms-2 badge rounded-pill bg-warning text-dark fw-bold px-2 py-0.5" style={{ fontSize: '0.72rem' }}>
                {tables.length}
              </span>
            </button>
            {activeZoneList.map(z => {
              const count = tables.filter(t => t.floorZone === z.code).length;
              return (
                <button
                  key={z.code}
                  className={`btn btn-sm text-nowrap d-flex align-items-center ${
                    selectedZone === z.code ? 'btn-primary fw-bold shadow-sm' : 'btn-light'
                  }`}
                  onClick={() => setSelectedZone(z.code)}
                >
                  <span>{z.name}</span>
                  <span className="ms-2 badge rounded-pill bg-warning text-dark fw-bold px-2 py-0.5" style={{ fontSize: '0.72rem' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="d-flex flex-wrap gap-2 gap-sm-3 small flex-shrink-0">
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-success" /> Available</span>
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-danger" /> Occupied</span>
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-warning" /> Reserved</span>
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-info" /> Cleaning</span>
          </div>
        </div>
      </div>

      {/* Tables Grid - 2 columns on mobile (col-6), smooth vertical scrolling */}
      <div className="row g-2 g-md-3">
        {filteredTables.map(table => {
          const color = getStatusColor(table.status);
          const isOccupied = table.status === 'OCCUPIED';

          return (
            <div key={table.id} className="col-6 col-md-4 col-xl-3">
              <div className={`card h-100 shadow-sm border-2 border-${color} position-relative`}>
                <div className={`card-header bg-${color}-subtle border-0 d-flex justify-content-between align-items-center p-2 px-sm-3`}>
                  <span className="fw-bold text-dark font-monospace fs-6 fs-sm-5">{table.tableNumber}</span>
                  <span className={`badge bg-${color} text-${color === 'warning' ? 'dark' : 'white'} text-uppercase`} style={{ fontSize: '0.62rem' }}>
                    {table.status}
                  </span>
                </div>

                <div className="card-body p-2 p-sm-3 d-flex flex-column justify-content-between" style={{ minHeight: '130px' }}>
                  <div>
                    {/* Capacity & Floor Zone Tag - NO "Capacity:" and NO "Persons" words */}
                    <div className="d-flex align-items-center gap-1 mb-2 overflow-hidden" style={{ maxWidth: '100%' }}>
                      <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 py-1 px-1.5 flex-shrink-0" style={{ fontSize: '0.72rem' }} title={`Seats ${table.capacity}`}>
                        <Users size={11} className="text-secondary flex-shrink-0" />
                        <span className="fw-bold">{table.capacity}</span>
                      </span>
                      <span
                        className="badge bg-light text-dark border py-1 px-2 scrollable-zone-tag flex-grow-1"
                        style={{
                          fontSize: '0.72rem',
                          maxWidth: 'calc(100% - 38px)',
                          overflowX: 'auto',
                          whiteSpace: 'nowrap',
                          WebkitOverflowScrolling: 'touch'
                        }}
                        title={zoneCodeMap.get(table.floorZone)?.name || table.floorZone}
                      >
                        {zoneCodeMap.get(table.floorZone)?.name || table.floorZone.replace('_', ' ')}
                      </span>
                    </div>

                    {isOccupied && table.activeOrder && (
                      <div className="bg-light p-1.5 p-sm-2 rounded border small mb-2">
                        <div className="d-flex justify-content-between fw-bold text-dark" style={{ fontSize: '0.78rem' }}>
                          <span className="text-truncate me-1">{table.activeOrder.orderNumber}</span>
                          <span className="text-nowrap">₹{table.activeOrder.netAmount}</span>
                        </div>
                        <div className="text-secondary text-truncate" style={{ fontSize: '0.7rem' }}>
                          {table.activeOrder.itemCount} items • {table.activeOrder.status}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="d-flex flex-wrap gap-1 mt-auto pt-2 border-top">
                    {table.status === 'AVAILABLE' && can('orders.create') && (
                      <button
                        className="btn btn-primary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-1 px-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => navigate(`/pos?tableId=${table.id}&tableNumber=${table.tableNumber}`)}
                      >
                        <ShoppingBag size={13} /> Take Order
                      </button>
                    )}

                    {isOccupied && (
                      <>
                        <button
                          className="btn btn-outline-primary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-1 px-1"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => navigate(`/pos?orderId=${table.activeOrder?.id}`)}
                        >
                          <ShoppingBag size={13} /> View
                        </button>
                        {table.activeOrder && can('billing.create') && (
                          <button
                            className="btn btn-primary btn-sm d-flex align-items-center justify-content-center gap-1 py-1 px-2"
                            style={{ fontSize: '0.75rem' }}
                            disabled={billLoadingTableId === table.id}
                            onClick={async () => {
                              if (!table.activeOrder?.id) return;
                              try {
                                setBillLoadingTableId(table.id);
                                const res: any = await apiClient.post('/billing/generate', { orderId: table.activeOrder?.id });
                                if (res?.success && res.data) {
                                  setTableBill(res.data);
                                }
                              } catch (err: any) {
                                alert(err.message || 'Failed to generate bill.');
                              } finally {
                                setBillLoadingTableId(null);
                              }
                            }}
                            title="Generate Tax Invoice for Table"
                          >
                            <Receipt size={13} /> {billLoadingTableId === table.id ? '...' : 'Bill'}
                          </button>
                        )}
                        {can('tables.transfer') && (
                          <button
                            className="btn btn-outline-secondary btn-sm p-1 px-1.5"
                            onClick={() => setTransferSource(table)}
                            title="Transfer Order to Table"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                        )}
                      </>
                    )}

                    {table.status === 'CLEANING' && (
                      <button
                        className="btn btn-success btn-sm flex-grow-1 py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleStatusChange(table.id, 'AVAILABLE')}
                      >
                        Cleaned
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TRANSFER MODAL */}
      <Modal
        isOpen={!!transferSource}
        onClose={() => setTransferSource(null)}
        title={`Transfer Order from Table ${transferSource?.tableNumber}`}
      >
        <div className="d-flex flex-column gap-3">
          <p className="small text-secondary">
            Select a target available table to transfer <strong>Order {transferSource?.activeOrder?.orderNumber}</strong>:
          </p>
          <div>
            <label className="form-label small fw-bold">Select Destination Table</label>
            <select
              className="form-select"
              value={transferTargetId}
              onChange={e => setTransferTargetId(e.target.value)}
            >
              <option value="">-- Choose Target Table --</option>
              {tables.filter(t => t.status === 'AVAILABLE').map(t => {
                const zone = zoneCodeMap.get(t.floorZone);
                return (
                  <option key={t.id} value={t.id}>
                    {t.tableNumber} (Seats: {t.capacity} | {zone?.name || t.floorZone})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTransferSource(null)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!transferTargetId} onClick={handleTransfer}>
              Execute Transfer
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD FLOOR ZONE QUICK MODAL */}
      <Modal
        isOpen={isAddZoneModalOpen}
        onClose={() => setIsAddZoneModalOpen(false)}
        title="Add New Floor Zone"
      >
        <form onSubmit={handleCreateZone} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-12 col-sm-8">
              <label className="form-label small fw-bold">Zone Name <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. First Floor Balcony, Poolside"
                required
                value={newZoneData.name}
                onChange={e => {
                  const name = e.target.value;
                  const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
                  setNewZoneData({ ...newZoneData, name, code });
                }}
              />
            </div>
            <div className="col-12 col-sm-4">
              <label className="form-label small fw-bold">Zone Code <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-control form-control-sm text-uppercase font-monospace"
                placeholder="e.g. BALCONY"
                required
                value={newZoneData.code}
                onChange={e => setNewZoneData({ ...newZoneData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold">Description</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. Open-air outdoor balcony seating"
                value={newZoneData.description}
                onChange={e => setNewZoneData({ ...newZoneData, description: e.target.value })}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Display Order</label>
              <input
                type="number"
                className="form-control form-control-sm"
                min={1}
                value={newZoneData.displayOrder}
                onChange={e => setNewZoneData({ ...newZoneData, displayOrder: Number(e.target.value) })}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Color Theme</label>
              <div className="d-flex align-items-center gap-2">
                <input
                  type="color"
                  className="form-control form-control-sm form-control-color"
                  value={newZoneData.color}
                  onChange={e => setNewZoneData({ ...newZoneData, color: e.target.value })}
                  style={{ width: '45px', height: '31px' }}
                />
                <span className="small font-monospace text-muted">{newZoneData.color}</span>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAddZoneModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-1" disabled={savingZone}>
              {savingZone ? 'Saving...' : 'Create Floor Zone'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MANAGE / DELETE FLOOR ZONES MODAL */}
      <Modal
        isOpen={isManageZonesModalOpen}
        onClose={() => setIsManageZonesModalOpen(false)}
        title="Manage Floor Zones"
      >
        <div className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-0">
            View or delete restaurant floor zones. If you delete a zone, any tables assigned to it will automatically be reassigned to the main hall.
          </p>

          <div className="list-group border-0">
            {floorZones.map(zone => {
              const count = tables.filter(t => t.floorZone === zone.code).length;
              return (
                <div key={zone.id} className="list-group-item d-flex justify-content-between align-items-center p-2.5 rounded border mb-2">
                  <div>
                    <div className="fw-bold text-dark d-flex align-items-center">
                      <span>{zone.name}</span>
                      <span className="ms-2 badge bg-warning text-dark fw-bold" style={{ fontSize: '0.68rem' }}>
                        {count} Tables
                      </span>
                    </div>
                    <div className="small text-muted font-monospace">{zone.code}</div>
                  </div>
                  {can('masters.table.delete') && (
                    <button
                      className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 py-1 px-2"
                      onClick={() => handleDeleteZone(zone)}
                      disabled={deletingZoneId === (zone.id || zone.code) || deletingZoneId === zone.code}
                      title={`Delete ${zone.name}`}
                    >
                      <Trash2 size={13} /> {deletingZoneId === (zone.id || zone.code) || deletingZoneId === zone.code ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="d-flex justify-content-end gap-2 pt-2 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsManageZonesModalOpen(false)}
            >
              Close
            </button>
            {can('masters.table.create') && (
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => {
                  setIsManageZonesModalOpen(false);
                  setIsAddZoneModalOpen(true);
                }}
              >
                <Plus size={14} /> Add New Zone
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* TABLE INVOICE MODAL */}
      <Modal
        isOpen={!!tableBill}
        onClose={() => setTableBill(null)}
        title={`Tax Invoice: ${tableBill?.billNumber}`}
        size="lg"
      >
        {tableBill && (
          <div className="p-3 bg-white print-area" id="printable-table-invoice">
            {/* Invoice Header */}
            <div className="text-center border-bottom pb-3 mb-3">
              <div className="d-flex justify-content-center mb-2">
                <img
                  src="/logo.jpg"
                  alt="Bhatigal Bhanu"
                  style={{ width: 68, height: 68, borderRadius: '50%', border: '2px solid #D48B28' }}
                />
              </div>
              <h4 className="fw-bold mb-0 text-dark" style={{ letterSpacing: '0.02em' }}>
                BHATIGAL BHANU
              </h4>
              <p className="small text-muted mb-1">Traditional Kathiyawadi & Gujarati Dining</p>
              <p className="small text-muted mb-0">Kothariya Ring Road, Rajkot, Gujarat - 360022</p>
              <p className="small text-muted mb-0">GSTIN: 24AAAFB1234A1Z8 | Phone: +91 98790 12345</p>
              <span className="badge bg-primary mt-2 px-3 py-1">ORIGINAL TAX INVOICE</span>
            </div>

            {/* Bill Meta */}
            <div className="d-flex justify-content-between small text-secondary mb-3">
              <div>
                <div><strong>Invoice No:</strong> {tableBill.billNumber}</div>
                <div><strong>Table:</strong> <span className="badge bg-light text-dark border ms-1">{tableBill.tableNumber || 'Dining'}</span></div>
                <div><strong>Guest:</strong> {tableBill.customerName || 'Walk-in Guest'}</div>
              </div>
              <div className="text-end">
                <div><strong>Date:</strong> {new Date(tableBill.createdAt).toLocaleDateString()}</div>
                <div><strong>Time:</strong> {new Date(tableBill.createdAt).toLocaleTimeString()}</div>
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
                  {tableBill.items?.map((it, idx) => (
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
                  <span>₹{tableBill.subtotal}</span>
                </div>
                {tableBill.discountAmount > 0 && (
                  <div className="d-flex justify-content-between small text-danger mb-1">
                    <span>Discount:</span>
                    <span>-₹{tableBill.discountAmount}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between small mb-1">
                  <span>CGST (2.5%):</span>
                  <span>₹{Math.round(tableBill.taxAmount / 2)}</span>
                </div>
                <div className="d-flex justify-content-between small mb-1">
                  <span>SGST (2.5%):</span>
                  <span>₹{Math.round(tableBill.taxAmount / 2)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold text-dark fs-5 border-top pt-2 mt-1">
                  <span>Grand Total:</span>
                  <span>₹{tableBill.totalPayable}</span>
                </div>
                <div className="d-flex justify-content-between small text-muted">
                  <span>Status:</span>
                  <span className="fw-bold">{tableBill.status}</span>
                </div>
              </div>
            </div>

            <div className="text-center border-top pt-3 mt-4 small text-muted">
              Thank you for dining with us! Please visit again.
            </div>

            <div className="d-flex flex-wrap justify-content-end gap-2 mt-4 pt-3 border-top no-print">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTableBill(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={() => generateInvoicePdf(tableBill)}
              >
                <Download size={16} /> Download PDF
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={() => printInvoiceReceipt(tableBill)}
              >
                <Printer size={16} /> Print Receipt
              </button>
              {tableBill.status !== 'PAID' && can('payment.create') && (
                <button
                  type="button"
                  className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                  onClick={() => {
                    const b = tableBill;
                    setTableBill(null);
                    navigate(`/billing?payBillId=${b.id}&amount=${b.totalPayable}`);
                  }}
                >
                  <CreditCard size={16} /> Pay ₹{tableBill.totalPayable}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
