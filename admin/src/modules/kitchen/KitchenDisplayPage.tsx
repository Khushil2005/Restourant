import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { useSocket } from '../../context/SocketContext';
import { KOTTicket } from '../../types';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Clock, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw, Flame } from 'lucide-react';

export const KitchenDisplayPage: React.FC = () => {
  const { can } = usePermission();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<KOTTicket[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [loading, setLoading] = useState(false);

  const loadKOTs = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/kot');
      if (res.success) {
        setTickets(res.data);
      }
    } catch (err) {
      console.error('Failed to load KOT tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKOTs();
    const interval = setInterval(loadKOTs, 15000); // 15s polling fallback
    return () => clearInterval(interval);
  }, []);

  // Socket listener for new/updated KOT tickets
  useEffect(() => {
    if (!socket) return;

    socket.on('kot.created', () => loadKOTs());
    socket.on('kot.updated', () => loadKOTs());
    socket.on('kot.ready', () => loadKOTs());

    return () => {
      socket.off('kot.created');
      socket.off('kot.updated');
      socket.off('kot.ready');
    };
  }, [socket]);

  const handleAction = async (id: string, action: 'accept' | 'prepare' | 'ready' | 'served') => {
    try {
      await apiClient.patch(`/kot/${id}/${action}`);
      loadKOTs();
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    }
  };

  const filteredTickets = filterStatus === 'ACTIVE'
    ? tickets.filter(t => t.status === 'NEW' || t.status === 'ACCEPTED' || t.status === 'PREPARING')
    : filterStatus === 'READY'
    ? tickets.filter(t => t.status === 'READY')
    : tickets;

  const getElapsedTime = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    return mins;
  };

  return (
    <div className="vh-100 vw-100 bg-dark text-white d-flex flex-column overflow-hidden">
      {/* KDS Header */}
      <header className="navbar navbar-expand navbar-dark bg-black px-2 px-sm-4 py-2 border-bottom border-secondary d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex align-items-center gap-2 gap-sm-3">
          <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> <span className="d-none d-sm-inline">Exit KDS</span>
          </button>
          <div className="d-flex align-items-center gap-2">
            <img
              src="/logo.jpg"
              alt="Bhatigal Bhanu"
              className="brand-logo-img shadow-sm"
              style={{ width: 30, height: 30 }}
            />
            <h6 className="fw-bold mb-0 text-white fs-6">Kitchen KDS</h6>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 ms-auto flex-wrap">
          {/* Status Tabs */}
          <div className="btn-group btn-group-sm">
            <button
              className={`btn px-2 ${filterStatus === 'ACTIVE' ? 'btn-warning fw-bold text-dark' : 'btn-outline-secondary'}`}
              onClick={() => setFilterStatus('ACTIVE')}
            >
              Kitchen ({tickets.filter(t => t.status === 'NEW' || t.status === 'ACCEPTED' || t.status === 'PREPARING').length})
            </button>
            <button
              className={`btn px-2 ${filterStatus === 'READY' ? 'btn-success fw-bold text-white' : 'btn-outline-secondary'}`}
              onClick={() => setFilterStatus('READY')}
            >
              Ready ({tickets.filter(t => t.status === 'READY').length})
            </button>
            <button
              className={`btn px-2 ${filterStatus === 'ALL' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
              onClick={() => setFilterStatus('ALL')}
            >
              All ({tickets.length})
            </button>
          </div>

          <button className="btn btn-outline-secondary btn-sm p-1 px-2" onClick={loadKOTs} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* Tickets Grid */}
      <div className="flex-grow-1 p-3 overflow-auto">
        {filteredTickets.length === 0 ? (
          <div className="text-center my-auto py-5 text-muted">
            <ChefHat size={64} className="mb-3 text-secondary" />
            <h3>No Orders in Kitchen Queue</h3>
            <p className="small">New orders sent from POS will automatically pop up here with live notifications.</p>
          </div>
        ) : (
          <div className="row g-3">
            {filteredTickets.map(ticket => {
              const elapsed = getElapsedTime(ticket.createdAt);
              const isUrgent = ticket.priority === 'URGENT' || ticket.priority === 'HIGH' || elapsed > 25;
              const isReady = ticket.status === 'READY';

              return (
                <div key={ticket.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                  <div
                    className={`card h-100 shadow border-2 ${
                      isUrgent
                        ? 'border-danger bg-black'
                        : isReady
                        ? 'border-success bg-black'
                        : 'border-secondary bg-dark'
                    }`}
                  >
                    {/* Ticket Header */}
                    <div
                      className={`card-header d-flex justify-content-between align-items-center py-2 px-3 ${
                        isUrgent ? 'bg-danger text-white' : isReady ? 'bg-success text-white' : 'bg-black text-warning'
                      }`}
                    >
                      <div className="fw-bold font-monospace fs-5">{ticket.kotNumber}</div>
                      <div className="badge bg-dark text-white border">
                        {ticket.tableNumber ? `Table: ${ticket.tableNumber}` : ticket.orderType}
                      </div>
                    </div>

                    {/* Timer & Meta */}
                    <div className="p-2 px-3 border-bottom border-secondary bg-black d-flex justify-content-between align-items-center small">
                      <span className="text-secondary">
                        Status: <strong className="text-white">{ticket.status}</strong>
                      </span>
                      <span className={`fw-bold d-flex align-items-center gap-1 ${elapsed > 20 ? 'text-danger' : 'text-info'}`}>
                        <Clock size={14} /> {elapsed} mins ago
                      </span>
                    </div>

                    {/* Ticket Items */}
                    <div className="card-body p-3 d-flex flex-column gap-2 overflow-auto" style={{ maxHeight: 240 }}>
                      {ticket.items.map((item, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-start border-bottom border-secondary pb-2">
                          <div>
                            <div className="fw-bold text-white fs-6">
                              <span className="badge bg-warning text-dark me-2 font-monospace">{item.quantity}x</span>
                              {item.itemName}
                            </div>
                            {item.notes && (
                              <div className="small text-warning fst-italic mt-1">
                                ↳ {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="card-footer bg-black border-top border-secondary p-2 d-flex gap-2">
                      {ticket.status === 'NEW' && can('kot.accept') && (
                        <button
                          className="btn btn-warning btn-sm w-100 fw-bold text-dark d-flex align-items-center justify-content-center gap-1"
                          onClick={() => handleAction(ticket.id, 'accept')}
                        >
                          <CheckCircle2 size={16} /> Accept Order
                        </button>
                      )}

                      {ticket.status === 'ACCEPTED' && can('kot.prepare') && (
                        <button
                          className="btn btn-primary btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                          onClick={() => handleAction(ticket.id, 'prepare')}
                        >
                          <Flame size={16} /> Start Cooking
                        </button>
                      )}

                      {ticket.status === 'PREPARING' && can('kot.ready') && (
                        <button
                          className="btn btn-success btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                          onClick={() => handleAction(ticket.id, 'ready')}
                        >
                          <CheckCircle2 size={16} /> Mark Food Ready
                        </button>
                      )}

                      {ticket.status === 'READY' && can('kot.served') && (
                        <button
                          className="btn btn-outline-success btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                          onClick={() => handleAction(ticket.id, 'served')}
                        >
                          <CheckCircle2 size={16} /> Mark Served to Table
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
