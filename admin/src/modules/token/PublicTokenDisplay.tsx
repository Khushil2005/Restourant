import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { QueueToken } from '../../types';
import { Bell } from 'lucide-react';

export const PublicTokenDisplay: React.FC = () => {
  const { socket } = useSocket();
  const [tokens, setTokens] = useState<QueueToken[]>([]);

  const loadQueue = async (forceFresh = false) => {
    try {
      const config = forceFresh ? { forceFresh: true } : undefined;
      const res: any = await apiClient.get('/tokens/queue', config);
      if (res.success) {
        setTokens(res.data);
      }
    } catch (err) {
      console.error('Failed to load display queue:', err);
    }
  };

  useEffect(() => {
    loadQueue(true);
  }, []);

  useAutoRefresh(() => loadQueue(true), {
    entities: ['tokens'],
    intervalMs: 3000,
    refreshOnFocus: true
  });

  useEffect(() => {
    if (!socket) return;
    const refreshLive = () => loadQueue(true);

    socket.on('token.called', refreshLive);
    socket.on('token.updated', refreshLive);
    socket.on('data.changed', refreshLive);

    return () => {
      socket.off('token.called', refreshLive);
      socket.off('token.updated', refreshLive);
      socket.off('data.changed', refreshLive);
    };
  }, [socket]);

  const currentlyCalling = tokens.filter(t => t.status === 'CALLED' || t.status === 'RECALLED');
  const upcomingQueue = tokens.filter(t => t.status === 'WAITING').slice(0, 8);

  return (
    <div className="vh-100 vw-100 bg-dark text-white d-flex flex-column p-4 overflow-hidden">
      {/* Top Banner */}
      <header className="d-flex justify-content-between align-items-center border-bottom border-secondary pb-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Bhatigal Bhanu"
            className="brand-logo-lg border border-warning"
            style={{ width: 64, height: 64 }}
          />
          <div>
            <h2 className="fw-bold mb-0 text-white">BHATIGAL BHANU</h2>
            <p className="text-warning small mb-0">Guest Seating & Order Calling System</p>
          </div>
        </div>
        <div className="text-end">
          <div className="fs-3 fw-bold text-warning font-monospace">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <small className="text-secondary">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</small>
        </div>
      </header>

      {/* Main Display Grid */}
      <div className="row g-4 flex-grow-1 overflow-hidden">
        {/* Left Column: Now Calling */}
        <div className="col-12 col-lg-7 d-flex flex-column">
          <div className="card bg-black border border-warning h-100 shadow-lg p-4 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between border-bottom border-secondary pb-3">
              <span className="badge bg-warning text-dark fs-5 px-3 py-2 fw-bold d-flex align-items-center gap-2">
                <Bell size={20} /> NOW CALLING
              </span>
              <span className="text-secondary">Please proceed to the Reception Desk</span>
            </div>

            <div className="text-center my-auto py-4">
              {currentlyCalling.length > 0 ? (
                <div className="animate__animated animate__pulse animate__infinite">
                  <h1 className="display-1 fw-bold text-warning font-monospace mb-2" style={{ fontSize: '6rem' }}>
                    {currentlyCalling[0].tokenCode}
                  </h1>
                  <h3 className="fw-bold text-white mb-2">{currentlyCalling[0].customerName}</h3>
                  <div className="badge bg-secondary fs-5 px-4 py-2">
                    Party of {currentlyCalling[0].partySize} Guests
                  </div>
                </div>
              ) : (
                <div className="text-muted py-5">
                  <h3 className="fw-light">All Waiting Guests Are Currently Being Seated</h3>
                  <p className="small">Please relax in the lounge area.</p>
                </div>
              )}
            </div>

            {currentlyCalling.length > 1 && (
              <div className="border-top border-secondary pt-3">
                <small className="text-secondary d-block mb-2">Also Called:</small>
                <div className="d-flex gap-3">
                  {currentlyCalling.slice(1).map(c => (
                    <span key={c.id} className="badge bg-dark border border-warning text-warning fs-5 px-3 py-2">
                      {c.tokenCode} - {c.customerName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Upcoming Queue */}
        <div className="col-12 col-lg-5 d-flex flex-column">
          <div className="card bg-black border border-secondary h-100 shadow-lg p-4 d-flex flex-column">
            <div className="border-bottom border-secondary pb-3 mb-3 d-flex justify-content-between align-items-center">
              <h4 className="fw-bold text-info mb-0">UPCOMING IN QUEUE</h4>
              <span className="badge bg-info text-dark">{upcomingQueue.length} Waiting</span>
            </div>

            <div className="flex-grow-1 overflow-auto d-flex flex-column gap-2">
              {upcomingQueue.length === 0 ? (
                <div className="text-center my-auto text-muted small">No waiting queue at the moment.</div>
              ) : (
                upcomingQueue.map((t, idx) => (
                  <div
                    key={t.id}
                    className="p-3 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <span className="badge bg-primary fs-5 px-3 font-monospace">{t.tokenCode}</span>
                      <div>
                        <div className="fw-bold text-white">{t.customerName}</div>
                        <small className="text-secondary">Party of {t.partySize} Guests</small>
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="badge bg-secondary">Est. {t.estimatedWaitMinutes}m</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
