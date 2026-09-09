import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { useSocket } from '../../context/SocketContext';
import { Modal } from '../../components/PermissionGate';
import { DiningTable } from '../../types';
import { Grid, Users, ArrowRightLeft, ShoppingBag, CheckCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TableFloorPage: React.FC = () => {
  const { can } = usePermission();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Transfer Modal
  const [transferSource, setTransferSource] = useState<DiningTable | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');

  const loadFloor = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/tables/floor-layout');
      if (res.success) {
        setTables(res.data);
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

  const zones = ['ALL', 'MAIN_HALL', 'AC_HALL', 'ROOFTOP', 'GARDEN', 'VIP'];
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
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Dining Floor Map</h4>
          <p className="text-muted small mb-0">Visual seating plan, live table statuses, order turnover, and table transfers</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={loadFloor}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Zone Filters & Legend */}
      <div className="card shadow-sm border-0 p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="nav nav-pills gap-1 scrollable-pills-container">
            {zones.map(z => (
              <button
                key={z}
                className={`btn btn-sm text-nowrap ${selectedZone === z ? 'btn-primary fw-bold' : 'btn-light'}`}
                onClick={() => setSelectedZone(z)}
              >
                {z.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="d-flex flex-wrap gap-2 gap-sm-3 small">
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-success" /> Available</span>
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-danger" /> Occupied</span>
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-warning" /> Reserved</span>
            <span className="d-flex align-items-center gap-1"><span className="p-1 rounded-circle bg-info" /> Cleaning</span>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="row g-3">
        {filteredTables.map(table => {
          const color = getStatusColor(table.status);
          const isOccupied = table.status === 'OCCUPIED';

          return (
            <div key={table.id} className="col-12 col-sm-6 col-md-4 col-xl-3">
              <div className={`card h-100 shadow-sm border-2 border-${color} position-relative`}>
                <div className={`card-header bg-${color}-subtle border-0 d-flex justify-content-between align-items-center py-2`}>
                  <span className="fw-bold text-dark font-monospace fs-5">{table.tableNumber}</span>
                  <span className={`badge bg-${color} text-${color === 'warning' ? 'dark' : 'white'} small`}>
                    {table.status}
                  </span>
                </div>

                <div className="card-body p-3 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-1 text-muted small mb-2">
                      <Users size={14} /> Capacity: <strong>{table.capacity} Persons</strong> ({table.floorZone})
                    </div>

                    {isOccupied && table.activeOrder && (
                      <div className="bg-light p-2 rounded border small mb-2">
                        <div className="d-flex justify-content-between fw-bold text-dark">
                          <span>{table.activeOrder.orderNumber}</span>
                          <span>₹{table.activeOrder.netAmount}</span>
                        </div>
                        <div className="text-secondary">{table.activeOrder.itemCount} Items • {table.activeOrder.status}</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="d-flex flex-wrap gap-1 mt-2 pt-2 border-top">
                    {table.status === 'AVAILABLE' && can('orders.create') && (
                      <button
                        className="btn btn-primary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                        onClick={() => navigate(`/pos?tableId=${table.id}&tableNumber=${table.tableNumber}`)}
                      >
                        <ShoppingBag size={14} /> Take Order
                      </button>
                    )}

                    {isOccupied && (
                      <>
                        <button
                          className="btn btn-outline-primary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                          onClick={() => navigate(`/pos?orderId=${table.activeOrder?.id}`)}
                        >
                          <ShoppingBag size={14} /> View Order
                        </button>
                        {can('tables.transfer') && (
                          <button
                            className="btn btn-outline-secondary btn-sm p-1 px-2"
                            onClick={() => setTransferSource(table)}
                            title="Transfer Order to Table"
                          >
                            <ArrowRightLeft size={14} />
                          </button>
                        )}
                      </>
                    )}

                    {table.status === 'CLEANING' && (
                      <button
                        className="btn btn-success btn-sm flex-grow-1"
                        onClick={() => handleStatusChange(table.id, 'AVAILABLE')}
                      >
                        Mark Cleaned
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
              {tables.filter(t => t.status === 'AVAILABLE').map(t => (
                <option key={t.id} value={t.id}>
                  {t.tableNumber} (Capacity: {t.capacity} | {t.floorZone})
                </option>
              ))}
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
    </div>
  );
};
