import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { Activity, Database, Wifi, Cpu, RefreshCw, ShieldAlert } from 'lucide-react';

export const SystemDiagnosticsPage: React.FC = () => {
  const { can } = usePermission();
  const [latency, setLatency] = useState<number | null>(null);

  const canView = can('system.diagnostics.view') || can('system.control.view');

  const runDiagnostics = async () => {
    const start = performance.now();
    try {
      await apiClient.get('/system/system-control/status');
      const end = performance.now();
      setLatency(Math.round(end - start));
    } catch (err) {
      console.error('Diagnostics failed:', err);
    }
  };

  useEffect(() => {
    if (canView) {
      runDiagnostics();
    }
  }, [canView]);

  if (!canView) {
    return (
      <div className="card bg-black border border-danger p-4 text-center text-white my-4 shadow-sm">
        <ShieldAlert size={48} className="text-danger mx-auto mb-2" />
        <h5 className="fw-bold">Access Denied (પરવાનગી નથી)</h5>
        <p className="text-secondary small mb-0">
          You do not have permission to access System Diagnostics. Required permission: <code>system.diagnostics.view</code> or <code>system.control.view</code>
        </p>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-4 text-white">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom border-secondary pb-3">
        <div>
          <h4 className="fw-bold mb-1 text-white">Infrastructure & System Diagnostics</h4>
          <p className="text-secondary small mb-0">Live API response latency, database engine state, and process telemetry</p>
        </div>
        {(can('system.diagnostics.run') || can('system.control.view')) && (
          <button className="btn btn-outline-info btn-sm d-flex align-items-center gap-1" onClick={runDiagnostics}>
            <RefreshCw size={14} /> Run Latency Probe
          </button>
        )}
      </div>

      {/* Health Metrics Grid */}
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <div className="card bg-black border border-secondary p-3 shadow-sm h-100">
            <span className="small text-uppercase text-secondary fw-bold">API Gateway Latency</span>
            <div className="d-flex align-items-center justify-content-between mt-2">
              <h3 className="fw-bold text-success mb-0">{latency !== null ? `${latency} ms` : 'Probing...'}</h3>
              <Activity size={24} className="text-success" />
            </div>
            <small className="text-secondary mt-1">HTTP REST round-trip probe</small>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card bg-black border border-secondary p-3 shadow-sm h-100">
            <span className="small text-uppercase text-secondary fw-bold">Database Engine</span>
            <div className="d-flex align-items-center justify-content-between mt-2">
              <h3 className="fw-bold text-info mb-0">MongoDB</h3>
              <Database size={24} className="text-info" />
            </div>
            <small className="text-secondary mt-1">Mongoose ODM connected & active</small>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card bg-black border border-secondary p-3 shadow-sm h-100">
            <span className="small text-uppercase text-secondary fw-bold">Real-time WebSocket Bus</span>
            <div className="d-flex align-items-center justify-content-between mt-2">
              <h3 className="fw-bold text-warning mb-0">Socket.IO Active</h3>
              <Wifi size={24} className="text-warning" />
            </div>
            <small className="text-secondary mt-1">Bi-directional event broadcasts</small>
          </div>
        </div>
      </div>

      {/* Process Telemetry Info */}
      <div className="card bg-black border border-secondary p-4">
        <h6 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
          <Cpu size={18} className="text-info" /> Runtime Environment Specifications
        </h6>
        <div className="row g-3 small">
          <div className="col-6 col-md-3">
            <span className="text-secondary d-block">Node Engine:</span>
            <strong className="text-light">Node.js LTS (v20.x)</strong>
          </div>
          <div className="col-6 col-md-3">
            <span className="text-secondary d-block">Operating System:</span>
            <strong className="text-light">Windows NT</strong>
          </div>
          <div className="col-6 col-md-3">
            <span className="text-secondary d-block">Express Server Port:</span>
            <strong className="text-light">5000</strong>
          </div>
          <div className="col-6 col-md-3">
            <span className="text-secondary d-block">Client Port:</span>
            <strong className="text-light">{window.location.port || '3000'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export { DatabaseToolsPage } from './DatabaseToolsPage';
