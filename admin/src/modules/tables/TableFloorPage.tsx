import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { useSocket } from '../../context/SocketContext';
import { Modal } from '../../components/PermissionGate';
import { DiningTable, FloorZone } from '../../types';
import { Grid, Users, ArrowRightLeft, ShoppingBag, CheckCircle, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LOCAL_STORAGE_ZONES_KEY = 'bb_custom_floor_zones';

const DEFAULT_FLOOR_ZONES: FloorZone[] = [
  { id: 'zone_main', name: 'Main Dining Hall', code: 'MAIN_HALL', color: '#0d6efd', displayOrder: 1, isActive: true },
  { id: 'zone_ac', name: 'AC Family Hall', code: 'AC_HALL', color: '#198754', displayOrder: 2, isActive: true },
  { id: 'zone_rooftop', name: 'Rooftop Terrace', code: 'ROOFTOP', color: '#6f42c1', displayOrder: 3, isActive: true },
  { id: 'zone_garden', name: 'Garden Lawn', code: 'GARDEN', color: '#20c997', displayOrder: 4, isActive: true },
  { id: 'zone_vip', name: 'VIP Executive Lounge', code: 'VIP', color: '#ffc107', displayOrder: 5, isActive: true }
];

const getStoredZones = (): FloorZone[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ZONES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredZones = (zones: FloorZone[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_ZONES_KEY, JSON.stringify(zones));
  } catch {}
};

export const TableFloorPage: React.FC = () => {
  const { can } = usePermission();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [floorZones, setFloorZones] = useState<FloorZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

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

  const loadFloor = async () => {
    setLoading(true);
    try {
      const [layoutRes, zonesRes]: any = await Promise.all([
        apiClient.get('/tables/floor-layout'),
        apiClient.get('/masters/floor-zones').catch(() => null)
      ]);
      if (layoutRes?.success) {
        setTables(layoutRes.data);
      }

      const stored = getStoredZones();
      if (zonesRes?.success && Array.isArray(zonesRes.data) && zonesRes.data.length > 0) {
        const backendZones: FloorZone[] = zonesRes.data;
        const merged = [...backendZones];
        stored.forEach(sz => {
          if (!merged.some(bz => bz.code === sz.code || bz.id === sz.id)) {
            merged.push(sz);
          }
        });
        setFloorZones(merged);
      } else {
        const merged = [...DEFAULT_FLOOR_ZONES];
        stored.forEach(sz => {
          if (!merged.some(dz => dz.code === sz.code || dz.id === sz.id)) {
            merged.push(sz);
          }
        });
        setFloorZones(merged);
      }
    } catch (err) {
      console.error('Failed to load table floor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloor();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('table.updated', () => loadFloor());
    socket.on('order.created', () => loadFloor());
    socket.on('order.updated', () => loadFloor());
    return () => {
      socket.off('table.updated');
      socket.off('order.created');
      socket.off('order.updated');
    };
  }, [socket]);

  const handleStatusChange = async (tableId: string, status: string) => {
    try {
      await apiClient.patch(`/tables/${tableId}/status`, { status });
      loadFloor();
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
      loadFloor();
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

      let createdZone: FloorZone | null = null;
      try {
        const res: any = await apiClient.post('/masters/floor-zones', payload);
        if (res?.success && res.data) {
          createdZone = res.data;
        }
      } catch (apiErr: any) {
        // If API route is 404 or backend unavailable, use local persistent storage
        console.warn('Backend /masters/floor-zones returned error, saving locally:', apiErr.message);
      }

      if (!createdZone) {
        createdZone = {
          id: `zone_local_${Date.now()}`,
          ...payload
        };
      }

      // Persist in localStorage so it stays across page refreshes
      const currentStored = getStoredZones();
      const updatedStored = [...currentStored.filter(z => z.code !== createdZone!.code), createdZone];
      saveStoredZones(updatedStored);

      // Instantly update state
      setFloorZones(prev => {
        const exists = prev.some(z => z.code === createdZone!.code);
        if (exists) return prev.map(z => z.code === createdZone!.code ? createdZone! : z);
        return [...prev, createdZone!];
      });

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
      await loadFloor();
    } catch (err: any) {
      alert(err.message || 'Failed to create floor zone.');
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async (zone: { id?: string; code: string; name: string }) => {
    const zoneObj = floorZones.find(z => z.code === zone.code || z.id === zone.id);
    const targetId = zoneObj?.id || zone.id;

    if (!window.confirm(`Are you sure you want to delete Floor Zone "${zone.name}"? Any assigned tables will safely be reassigned to the default active zone.`)) {
      return;
    }

    setDeletingZoneId(targetId || zone.code);
    try {
      if (targetId && !targetId.startsWith('zone_local_')) {
        await apiClient.delete(`/masters/floor-zones/${targetId}`).catch((err) => {
          console.warn('Backend delete floor zone error:', err.message);
        });
      }

      // Remove from localStorage
      const currentStored = getStoredZones();
      saveStoredZones(currentStored.filter(z => z.code !== zone.code && z.id !== targetId));

      // Remove from state
      setFloorZones(prev => prev.filter(z => z.code !== zone.code && z.id !== targetId));

      if (selectedZone === zone.code) {
        setSelectedZone('ALL');
      }
      await loadFloor();
    } catch (err: any) {
      alert(err.message || 'Failed to delete floor zone.');
    } finally {
      setDeletingZoneId(null);
    }
  };

  // Build active zone list mapping
  const zoneCodeMap = new Map<string, { code: string; name: string; color: string }>();
  floorZones.forEach(z => {
    zoneCodeMap.set(z.code, { code: z.code, name: z.name, color: z.color || '#0d6efd' });
  });
  tables.forEach(t => {
    if (!zoneCodeMap.has(t.floorZone)) {
      zoneCodeMap.set(t.floorZone, { code: t.floorZone, name: t.floorZone.replace('_', ' '), color: '#6c757d' });
    }
  });
  const activeZoneList = Array.from(zoneCodeMap.values());

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
            onClick={loadFloor}
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
                  {selectedZone === z.code && can('masters.table.delete') && floorZones.some(fz => fz.code === z.code) && (
                    <span
                      role="button"
                      className="badge bg-danger text-white rounded-circle p-1 ms-1.5"
                      title={`Delete Zone "${z.name}"`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const targetZone = floorZones.find(fz => fz.code === z.code);
                        if (targetZone) handleDeleteZone(targetZone);
                      }}
                    >
                      <Trash2 size={11} />
                    </span>
                  )}
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

                <div className="card-body p-2 p-sm-3 d-flex flex-column justify-content-between">
                  <div>
                    {/* Capacity & Floor Zone Tag - NO "Capacity:" and NO "Persons" words */}
                    <div className="d-flex flex-wrap align-items-center gap-1 mb-2">
                      <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 py-1 px-1.5" style={{ fontSize: '0.72rem' }} title={`Seats ${table.capacity}`}>
                        <Users size={11} className="text-secondary flex-shrink-0" />
                        <span className="fw-bold">{table.capacity}</span>
                      </span>
                      <span className="badge bg-light text-dark border d-inline-flex align-items-center py-1 px-1.5 text-truncate" style={{ fontSize: '0.72rem', maxWidth: 'calc(100% - 42px)' }} title={zoneCodeMap.get(table.floorZone)?.name || table.floorZone}>
                        <span className="text-truncate">{zoneCodeMap.get(table.floorZone)?.name || table.floorZone.replace('_', ' ')}</span>
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
                      disabled={deletingZoneId === zone.id}
                      title={`Delete ${zone.name}`}
                    >
                      <Trash2 size={13} /> {deletingZoneId === zone.id ? 'Deleting...' : 'Delete'}
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
    </div>
  );
};
