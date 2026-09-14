import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { useSocket } from '../../context/SocketContext';
import { Modal } from '../../components/PermissionGate';
import { DiningTable, FloorZone, Bill } from '../../types';
import { Users, ArrowRightLeft, ShoppingBag, CheckCircle, RefreshCw, Plus, Trash2, Receipt, Download, Printer, CreditCard, Link2, Unlink } from 'lucide-react';
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

  // Table Merge Modal State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergePrimaryTableId, setMergePrimaryTableId] = useState('');
  const [mergeSecondaryTableIds, setMergeSecondaryTableIds] = useState<string[]>([]);
  const [savingMerge, setSavingMerge] = useState(false);
  const [unmergingTableId, setUnmergingTableId] = useState<string | null>(null);

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

  const handleMergeTables = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergePrimaryTableId || mergeSecondaryTableIds.length === 0) {
      alert('Please select a primary table and at least one secondary table to merge.');
      return;
    }

    setSavingMerge(true);
    try {
      const res: any = await apiClient.post('/tables/merge', {
        primaryTableId: mergePrimaryTableId,
        secondaryTableIds: mergeSecondaryTableIds
      });

      if (res?.success) {
        const primTable = tables.find(t => t.id === mergePrimaryTableId);
        setIsMergeModalOpen(false);
        setMergePrimaryTableId('');
        setMergeSecondaryTableIds([]);
        await loadFloor(false, true);

        if (primTable) {
          const takeOrder = window.confirm(
            `${res.message || 'Tables merged successfully!'}\n\nDo you want to open POS now to take the family order? (ટેબલ ${primTable.tableNumber} માટે POS માં ઓર્ડર લેવો છે?)`
          );
          if (takeOrder) {
            navigate(`/pos?tableId=${primTable.id}&tableNumber=${encodeURIComponent(primTable.tableNumber)}`);
          }
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to merge tables.');
    } finally {
      setSavingMerge(false);
    }
  };

  const handleUnmergeTable = async (table: DiningTable) => {
    const confirmMsg = table.parentTableId
      ? `Unmerge Table ${table.tableNumber} from Primary Table ${table.parentTableNumber}? (આ ટેબલને છૂટું પાડવું છે?)`
      : `Unmerge Primary Table ${table.tableNumber} and its linked secondary tables (${table.mergedWithTableNumbers?.join(', ')})? (બધા મર્જ થયેલા ટેબલ છૂટા પાડવા છે?)`;
    
    if (!window.confirm(confirmMsg)) return;

    setUnmergingTableId(table.id);
    try {
      const res: any = await apiClient.post('/tables/split', { tableIds: [table.id] });
      if (res?.success) {
        await loadFloor(false, true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to unmerge tables.');
    } finally {
      setUnmergingTableId(null);
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
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {can('tables.merge') && (
            <button
              className="btn btn-sm d-flex align-items-center gap-1 shadow-sm text-white fw-semibold"
              style={{ backgroundColor: '#6f42c1', borderColor: '#59359a' }}
              onClick={() => {
                setMergePrimaryTableId('');
                setMergeSecondaryTableIds([]);
                setIsMergeModalOpen(true);
              }}
              title="Merge Multiple Tables for Big Family / Group (ટેબલ મર્જ)"
            >
              <Link2 size={15} /> Merge Tables (મર્જ)
            </button>
          )}
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
              <div className={`card h-100 shadow-sm border-2 ${table.isMerged ? 'border-primary' : `border-${color}`} position-relative`}>
                {/* Card Header */}
                <div className={`card-header ${table.isMerged ? 'bg-primary-subtle' : `bg-${color}-subtle`} border-0 d-flex justify-content-between align-items-center p-2 px-sm-3`}>
                  <div className="d-flex align-items-center gap-1.5">
                    <span className="fw-bold text-dark font-monospace fs-6 fs-sm-5">{table.tableNumber}</span>
                    {table.isMerged && !table.parentTableId && (
                      <span className="badge text-white font-monospace d-inline-flex align-items-center gap-0.5" style={{ backgroundColor: '#6f42c1', fontSize: '0.62rem' }} title={`Merged with: ${table.mergedWithTableNumbers?.join(', ')}`}>
                        <Link2 size={10} /> +{table.mergedWithTableNumbers?.join(', ')}
                      </span>
                    )}
                    {table.isMerged && table.parentTableId && (
                      <span className="badge bg-warning text-dark font-monospace d-inline-flex align-items-center gap-0.5" style={{ fontSize: '0.62rem' }} title={`Linked to primary Table ${table.parentTableNumber}`}>
                        <Link2 size={10} /> ↳ T-{table.parentTableNumber}
                      </span>
                    )}
                  </div>
                  <span className={`badge ${table.isMerged && !table.parentTableId ? 'text-white' : `bg-${color} text-${color === 'warning' ? 'dark' : 'white'}`} text-uppercase`} style={{ backgroundColor: table.isMerged && !table.parentTableId ? '#6f42c1' : undefined, fontSize: '0.62rem' }}>
                    {table.isMerged ? (table.parentTableId ? 'LINKED' : 'MERGED') : table.status}
                  </span>
                </div>

                <div className="card-body p-2 p-sm-3 d-flex flex-column justify-content-between" style={{ minHeight: '130px' }}>
                  <div>
                    {/* Capacity & Floor Zone Tag */}
                    <div className="d-flex align-items-center gap-1 mb-2 overflow-hidden" style={{ maxWidth: '100%' }}>
                      {table.isMerged && !table.parentTableId ? (
                        <span className="badge text-white border d-inline-flex align-items-center gap-1 py-1 px-1.5 flex-shrink-0" style={{ backgroundColor: '#6f42c1', fontSize: '0.72rem' }} title={`Combined Merged Seats: ${table.mergedCapacity || table.capacity}`}>
                          <Users size={11} className="text-white flex-shrink-0" />
                          <span className="fw-bold">{table.mergedCapacity || table.capacity} Seats (Merged)</span>
                        </span>
                      ) : (
                        <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 py-1 px-1.5 flex-shrink-0" style={{ fontSize: '0.72rem' }} title={`Seats ${table.capacity}`}>
                          <Users size={11} className="text-secondary flex-shrink-0" />
                          <span className="fw-bold">{table.capacity}</span>
                        </span>
                      )}
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
                        <div className="d-flex justify-content-between align-items-center mt-1" style={{ fontSize: '0.7rem' }}>
                          <span className="text-secondary">{table.activeOrder.itemCount} items</span>
                          <span className={`badge ${
                            table.activeOrder.status === 'SERVED' 
                              ? 'bg-success text-white' 
                              : table.activeOrder.status === 'BILLED' 
                              ? 'bg-info text-dark' 
                              : 'bg-warning text-dark'
                          }`} style={{ fontSize: '0.65rem' }}>
                            {table.activeOrder.status === 'SERVED' ? '✓ SERVED' : table.activeOrder.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="d-flex flex-wrap gap-1 mt-auto pt-2 border-top">
                    {table.status === 'AVAILABLE' && !table.isMerged && can('orders.create') && (
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
                          onClick={() => {
                            const targetId = table.parentTableId || table.id;
                            const targetNum = table.parentTableNumber || table.tableNumber;
                            const orderParam = table.activeOrder?.id ? `&orderId=${table.activeOrder.id}` : '';
                            navigate(`/pos?tableId=${targetId}&tableNumber=${encodeURIComponent(targetNum)}${orderParam}`);
                          }}
                        >
                          <ShoppingBag size={13} /> {table.activeOrder ? 'View Order' : 'Take Order'}
                        </button>
                        {can('tables.transfer') && !table.isMerged && (
                          <button
                            className="btn btn-outline-secondary btn-sm p-1 px-1.5"
                            onClick={() => setTransferSource(table)}
                            title="Transfer Order to Table"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                        )}
                        {table.isMerged && can('tables.split') && (
                          <button
                            className="btn btn-outline-warning btn-sm p-1 px-1.5"
                            onClick={() => handleUnmergeTable(table)}
                            title="Unmerge Tables (છૂટા કરો)"
                          >
                            <Unlink size={13} />
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
            <div className="col-12">
              <label className="form-label small fw-bold">Display Order</label>
              <input
                type="number"
                className="form-control form-control-sm"
                min={1}
                value={newZoneData.displayOrder}
                onChange={e => setNewZoneData({ ...newZoneData, displayOrder: Number(e.target.value) })}
              />
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
        size="sm"
      >
        {tableBill && (
          <div className="d-flex flex-column align-items-center">
            <div
              className="p-3 bg-white text-dark w-100 border rounded shadow-sm print-area"
              style={{
                maxWidth: '340px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              {/* Header */}
              <div className="text-center">
                <img
                  src="/logo.jpg"
                  alt="Logo"
                  style={{ width: 58, height: 58, borderRadius: '50%', border: '2px solid #D48B28', margin: '0 auto 6px auto', display: 'block', objectFit: 'contain' }}
                />
                <h5 className="fw-bold mb-0" style={{ color: '#b8731d', letterSpacing: '0.5px', fontSize: '1.15rem' }}>
                  BHATIGAL BHANU
                </h5>
                <p className="text-muted mb-0" style={{ fontSize: '0.72rem' }}>
                  Traditional Kathiyawadi & Gujarati Dining
                </p>
                <p className="text-muted mb-0" style={{ fontSize: '0.68rem' }}>
                  Kothariya Ring Road, Rajkot, Gujarat - 360022
                </p>
                <p className="text-muted mb-0" style={{ fontSize: '0.68rem' }}>
                  GSTIN: 24AAAFB1234A1Z8 | +91 98790 12345
                </p>
                <div className="mt-1.5">
                  <span
                    className="text-white px-3 py-0.5 rounded-pill fw-bold"
                    style={{
                      backgroundColor: tableBill.status === 'PAID' ? '#198754' : '#dc3545',
                      fontSize: '0.68rem',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {tableBill.status === 'PAID' ? 'PAID TAX INVOICE' : 'UNPAID INVOICE'}
                  </span>
                </div>
              </div>

              {/* Solid divider */}
              <div style={{ borderTop: '1px solid #e0e0e0', margin: '8px 0' }}></div>

              {/* Meta Rows */}
              <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                <span><strong>Bill No:</strong> {tableBill.billNumber}</span>
                <span><strong>Table:</strong> {tableBill.tableNumber || 'Dining'}</span>
              </div>
              <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                <span><strong>Date:</strong> {new Date(tableBill.createdAt).getDate()}/{new Date(tableBill.createdAt).getMonth() + 1}/{new Date(tableBill.createdAt).getFullYear()}</span>
                <span><strong>Time:</strong> {new Date(tableBill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </div>
              {tableBill.customerName && (
                <div className="d-flex justify-content-between" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                  <span><strong>Guest:</strong> {tableBill.customerName}</span>
                  <span><strong>Status:</strong> {tableBill.status}</span>
                </div>
              )}

              {/* Solid divider */}
              <div style={{ borderTop: '1px solid #e0e0e0', margin: '8px 0' }}></div>

              {/* Items List */}
              <div className="d-flex flex-column gap-1.5">
                {(tableBill.items || []).map((item, idx) => (
                  <div key={idx} className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-bold text-dark" style={{ fontSize: '0.78rem' }}>{item.itemName}</div>
                      <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                        {item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.78rem' }}>
                      ₹{Number(item.totalPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Solid divider */}
              <div style={{ borderTop: '1px solid #e0e0e0', margin: '8px 0' }}></div>

              {/* Subtotal & Taxes */}
              <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                <span>Subtotal:</span>
                <span>₹{Number(tableBill.subtotal).toFixed(2)}</span>
              </div>

              {tableBill.discountAmount > 0 && (
                <div className="d-flex justify-content-between text-danger" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                  <span>Discount:</span>
                  <span>-₹{Number(tableBill.discountAmount).toFixed(2)}</span>
                </div>
              )}

              <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                <span>CGST (2.5%):</span>
                <span>₹{((tableBill.taxAmount || 0) / 2).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                <span>SGST (2.5%):</span>
                <span>₹{((tableBill.taxAmount || 0) / 2).toFixed(2)}</span>
              </div>

              {tableBill.serviceCharge > 0 && (
                <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                  <span>Service Charge:</span>
                  <span>₹{Number(tableBill.serviceCharge).toFixed(2)}</span>
                </div>
              )}

              {tableBill.roundOff !== 0 && (
                <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem', margin: '2px 0' }}>
                  <span>Round Off:</span>
                  <span>{tableBill.roundOff > 0 ? '+' : ''}₹{Number(tableBill.roundOff).toFixed(2)}</span>
                </div>
              )}

              {/* Solid border Grand Total */}
              <div
                className="my-1.5 py-1 d-flex justify-content-between align-items-center"
                style={{ borderTop: '1.5px solid #111', borderBottom: '1.5px solid #111', color: '#111' }}
              >
                <span className="fw-bold" style={{ fontSize: '0.95rem' }}>GRAND TOTAL:</span>
                <span className="fw-bold" style={{ fontSize: '0.95rem' }}>₹{Number(tableBill.totalPayable).toFixed(2)}</span>
              </div>

              {tableBill.status === 'PAID' ? (
                <div className="d-flex justify-content-between fw-bold" style={{ fontSize: '0.78rem', color: '#198754', margin: '3px 0' }}>
                  <span>Amount Paid:</span>
                  <span>₹{Number(tableBill.paidAmount || tableBill.totalPayable).toFixed(2)}</span>
                </div>
              ) : tableBill.balanceAmount > 0 ? (
                <div className="d-flex justify-content-between fw-bold" style={{ fontSize: '0.78rem', color: '#dc3545', margin: '3px 0' }}>
                  <span>Balance Due:</span>
                  <span>₹{Number(tableBill.balanceAmount).toFixed(2)}</span>
                </div>
              ) : null}

              {/* Solid divider */}
              <div style={{ borderTop: '1px solid #e0e0e0', margin: '8px 0' }}></div>

              {/* Footer Note */}
              <div className="text-center text-muted mt-1" style={{ fontSize: '0.68rem' }}>
                <p className="mb-0">Thank you for dining with us! Please Visit Again 🙏</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="d-flex flex-wrap justify-content-end align-items-center gap-1.5 w-100 mt-2.5 pt-2 border-top no-print">
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2.5"
                style={{ fontSize: '0.75rem' }}
                onClick={() => setTableBill(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm py-1 px-2.5 d-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={() => generateInvoicePdf(tableBill)}
              >
                <Download size={14} /> Download PDF
              </button>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm py-1 px-2.5 d-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={() => printInvoiceReceipt(tableBill)}
              >
                <Printer size={14} /> Print Receipt
              </button>
              {tableBill.status !== 'PAID' && can('payment.create') && (
                <button
                  type="button"
                  className="btn btn-success btn-sm py-1 px-2.5 d-flex align-items-center gap-1 fw-bold shadow-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    const b = tableBill;
                    setTableBill(null);
                    navigate(`/billing?payBillId=${b.id}&amount=${b.totalPayable}`);
                  }}
                >
                  <CreditCard size={14} /> Pay ₹{tableBill.totalPayable}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MERGE TABLES MODAL (BIG FAMILY / GROUP SEATING WITH SINGLE BILL) */}
      <Modal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        title="🔗 Merge Tables for Big Family / Group (ટેબલ મર્જ)"
      >
        <form onSubmit={handleMergeTables} className="d-flex flex-column gap-3">
          <div className="alert alert-info py-2 px-3 small mb-0 d-flex flex-column gap-1" style={{ fontSize: '0.8rem' }}>
            <span className="fw-bold">ℹ️ Big Family / Large Group Rule:</span>
            <span>All food items ordered across the merged tables will generate <strong>ONE Single Order & Single Bill</strong>. Settling payment will automatically release all merged tables.</span>
          </div>

          {/* Primary Table Selector */}
          <div>
            <label className="form-label small fw-bold text-dark mb-1">
              Select Primary (Leader) Table <span className="text-danger">*</span>
            </label>
            <select
              className="form-select form-select-sm"
              value={mergePrimaryTableId}
              onChange={e => {
                const val = e.target.value;
                setMergePrimaryTableId(val);
                setMergeSecondaryTableIds(prev => prev.filter(id => id !== val));
              }}
              required
            >
              <option value="">-- Choose Primary Table --</option>
              {tables.filter(t => !t.parentTableId).map(t => {
                const zone = zoneCodeMap.get(t.floorZone);
                return (
                  <option key={t.id} value={t.id}>
                    Table {t.tableNumber} (Seats: {t.capacity} | {zone?.name || t.floorZone} | {t.status})
                  </option>
                );
              })}
            </select>
            <div className="form-text small" style={{ fontSize: '0.72rem' }}>
              The Primary Table will hold the single unified bill and order ticket in POS.
            </div>
          </div>

          {/* Secondary Tables Multi-Select Checkboxes */}
          <div>
            <label className="form-label small fw-bold text-dark mb-1">
              Select Secondary Tables to Merge with Primary <span className="text-danger">*</span>
            </label>
            <div className="border rounded p-2 bg-light d-flex flex-column gap-1.5" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {tables.filter(t => t.id !== mergePrimaryTableId && !t.parentTableId && t.status !== 'MAINTENANCE').length === 0 ? (
                <div className="text-muted small p-2 text-center">No other tables available to merge.</div>
              ) : (
                tables
                  .filter(t => t.id !== mergePrimaryTableId && !t.parentTableId && t.status !== 'MAINTENANCE')
                  .map(t => {
                    const isChecked = mergeSecondaryTableIds.includes(t.id);
                    const zone = zoneCodeMap.get(t.floorZone);
                    return (
                      <div
                        key={t.id}
                        className={`d-flex align-items-center justify-content-between p-1.5 px-2 rounded border ${isChecked ? 'bg-white border-primary shadow-xs' : 'bg-white border-light'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setMergeSecondaryTableIds(prev =>
                            isChecked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                          );
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <input
                            type="checkbox"
                            className="form-check-input mt-0 cursor-pointer"
                            checked={isChecked}
                            onChange={() => {}}
                          />
                          <span className="fw-bold font-monospace text-dark" style={{ fontSize: '0.85rem' }}>
                            Table {t.tableNumber}
                          </span>
                          <span className="badge bg-light text-secondary border font-monospace" style={{ fontSize: '0.68rem' }}>
                            {zone?.name || t.floorZone}
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-1.5">
                          <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ fontSize: '0.68rem' }}>
                            <Users size={10} className="me-0.5" /> {t.capacity} Seats
                          </span>
                          <span className={`badge bg-${getStatusColor(t.status)} text-${getStatusColor(t.status) === 'warning' ? 'dark' : 'white'}`} style={{ fontSize: '0.62rem' }}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Combined Capacity Live Tracker */}
          {mergePrimaryTableId && (
            <div className="p-2.5 rounded border bg-purple-subtle d-flex align-items-center justify-content-between" style={{ backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' }}>
              <div>
                <span className="small fw-bold text-dark d-block">Combined Seating Capacity:</span>
                <small className="text-secondary" style={{ fontSize: '0.72rem' }}>
                  {(() => {
                    const prim = tables.find(t => t.id === mergePrimaryTableId);
                    const secs = tables.filter(t => mergeSecondaryTableIds.includes(t.id));
                    const parts = [
                      `Table ${prim?.tableNumber || ''} (${prim?.capacity || 0})`,
                      ...secs.map(s => `Table ${s.tableNumber} (${s.capacity})`)
                    ];
                    return parts.join(' + ');
                  })()}
                </small>
              </div>
              <span className="fs-5 fw-bolder" style={{ color: '#6f42c1' }}>
                {(() => {
                  const prim = tables.find(t => t.id === mergePrimaryTableId);
                  const secs = tables.filter(t => mergeSecondaryTableIds.includes(t.id));
                  return (prim?.capacity || 0) + secs.reduce((acc, s) => acc + (s.capacity || 0), 0);
                })()} Seats
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="d-flex justify-content-end gap-2 pt-2 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsMergeModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm text-white fw-bold d-flex align-items-center gap-1 shadow-sm"
              style={{ backgroundColor: '#6f42c1', borderColor: '#59359a' }}
              disabled={savingMerge || !mergePrimaryTableId || mergeSecondaryTableIds.length === 0}
            >
              <Link2 size={15} />
              {savingMerge ? 'Merging Tables...' : 'Confirm & Merge Tables'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
