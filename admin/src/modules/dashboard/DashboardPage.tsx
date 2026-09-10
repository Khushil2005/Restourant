import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { StatWidget } from '../../components/PermissionGate';
import {
  DollarSign,
  ShoppingBag,
  Clock,
  CalendarCheck,
  Ticket,
  Grid,
  ChefHat,
  AlertTriangle,
  Users,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { appCache } from '../../api/cache';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export const DashboardPage: React.FC = () => {
  const { can } = usePermission();
  const cachedMetrics = appCache.get('/dashboard/metrics')?.data || appCache.get('/dashboard/metrics');
  const [metrics, setMetrics] = useState<any>(() => cachedMetrics || null);
  const [loading, setLoading] = useState(!cachedMetrics);

  const fetchMetrics = async (forceFresh = false) => {
    try {
      const config = forceFresh ? { forceFresh: true } : undefined;
      const res: any = await apiClient.get('/dashboard/metrics', config);
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(true);
  }, []);

  useAutoRefresh(() => fetchMetrics(true), {
    intervalMs: 5000,
    refreshOnFocus: true
  });

  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-primary" role="status" />
        <div className="mt-2 text-muted">Loading ERP dashboard metrics...</div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-4">
      {/* Top Heritage Welcome Banner */}
      <div className="card border-0 shadow-sm overflow-hidden" style={{ background: 'linear-gradient(135deg, #7A1B28 0%, #56101B 100%)' }}>
        <div className="card-body p-3 p-sm-4 text-white d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2 gap-sm-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center bg-white shadow-sm flex-shrink-0"
              style={{
                width: '56px',
                height: '56px',
                minWidth: '56px',
                minHeight: '56px',
                border: '2.5px solid var(--brand-gold, #D48B28)',
                padding: '2px',
                boxShadow: '0 3px 10px rgba(0, 0, 0, 0.25)',
                aspectRatio: '1 / 1',
                overflow: 'hidden'
              }}
            >
              <img
                src="/logo.jpg"
                alt="ભાતીગળ ભાણું"
                className="w-100 h-100 rounded-circle flex-shrink-0"
                style={{
                  objectFit: 'cover',
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  display: 'block'
                }}
              />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h3 className="fw-bold mb-0 text-white fs-4 fs-sm-3">Bhatigal Bhanu</h3>
                <span className="badge bg-gold text-dark fw-bold">Live ERP</span>
              </div>
              <p className="mb-0 text-white-50 small" style={{ fontSize: '0.82rem' }}>
                Traditional Kathiyawadi & Gujarati Dining • Real-Time Operations Console
              </p>
            </div>
          </div>
          <div className="d-flex gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
            {can('orders.create') && (
              <Link to="/pos" className="btn btn-gold btn-sm d-flex align-items-center gap-1 shadow fw-bold px-3">
                <ShoppingBag size={16} /> Open POS
              </Link>
            )}
            {can('kot.view') && (
              <Link to="/kitchen" className="btn btn-outline-light btn-sm d-flex align-items-center gap-1 shadow px-3">
                <ChefHat size={16} /> Kitchen KDS
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI Widgets Grid */}
      <div className="row g-3">
        {/* Sales & Orders Widgets */}
        {can('dashboard.sales.view') && (
          <>
            <div className="col-12 col-sm-6 col-xl-3">
              <StatWidget
                title="Today's Sales"
                value={`₹${(metrics?.sales?.todaySales || 0).toLocaleString()}`}
                subtitle={`${metrics?.sales?.todayOrdersCount || 0} total orders today`}
                icon={<DollarSign size={24} />}
                variant="success"
              />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <StatWidget
                title="Active Orders"
                value={metrics?.sales?.pendingOrdersCount || 0}
                subtitle={`${metrics?.sales?.completedOrdersCount || 0} completed`}
                icon={<ShoppingBag size={24} />}
                variant="primary"
              />
            </div>
          </>
        )}

        {/* Table & Queue Widgets */}
        {can('dashboard.booking.view') && (
          <>
            <div className="col-12 col-sm-6 col-xl-3">
              <StatWidget
                title="Table Occupancy"
                value={`${metrics?.tables?.occupancyRate || 0}%`}
                subtitle={`${metrics?.tables?.occupiedTables || 0}/${metrics?.tables?.totalTables || 0} tables occupied`}
                icon={<Grid size={24} />}
                variant="info"
              />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <StatWidget
                title="Waiting Queue"
                value={metrics?.bookings?.waitingTokensCount || 0}
                subtitle={`${metrics?.bookings?.todayBookingsCount || 0} bookings today`}
                icon={<Ticket size={24} />}
                variant="warning"
              />
            </div>
          </>
        )}

        {/* Kitchen KDS Widgets */}
        {can('dashboard.orders.view') && (
          <>
            <div className="col-12 col-sm-6 col-xl-3">
              <StatWidget
                title="Pending KOT"
                value={metrics?.kitchen?.pendingKOT || 0}
                subtitle="In preparation queue"
                icon={<Clock size={24} />}
                variant="danger"
              />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <StatWidget
                title="Ready for Service"
                value={metrics?.kitchen?.readyKOT || 0}
                subtitle="Awaiting waiter pickup"
                icon={<ChefHat size={24} />}
                variant="success"
              />
            </div>
          </>
        )}

        {/* Inventory Widget */}
        {can('dashboard.inventory.view') && (
          <div className="col-12 col-sm-6 col-xl-3">
            <StatWidget
              title="Low Stock Items"
              value={metrics?.inventory?.lowStockCount || 0}
              subtitle="Items below safety threshold"
              icon={<AlertTriangle size={24} />}
              variant={metrics?.inventory?.lowStockCount > 0 ? 'danger' : 'success'}
            />
          </div>
        )}

        {/* HR & Accounts Widgets */}
        {can('dashboard.accounts.view') && (
          <div className="col-12 col-sm-6 col-xl-3">
            <StatWidget
              title="Cash Drawer"
              value={`₹${(metrics?.finance?.cashDrawer || 0).toLocaleString()}`}
              subtitle={`Bank: ₹${(metrics?.finance?.bankBalance || 0).toLocaleString()}`}
              icon={<CreditCard size={24} />}
              variant="primary"
            />
          </div>
        )}
      </div>

      {/* Analytics & Breakdowns */}
      <div className="row g-3">
        {/* Payment Methods Breakdown */}
        {can('dashboard.reports.view') && (
          <div className="col-12 col-lg-6">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-dark">Payment Methods Breakdown</h6>
                <TrendingUp size={18} className="text-muted" />
              </div>
              <div className="card-body p-4">
                <div className="d-flex flex-column gap-3">
                  {Object.entries(metrics?.charts?.paymentMethods || {}).map(([method, amount]: [string, any]) => {
                    const total = metrics?.sales?.todaySales || 1;
                    const pct = Math.round((amount / total) * 100) || 0;
                    return (
                      <div key={method}>
                        <div className="d-flex justify-content-between small fw-semibold mb-1">
                          <span>{method}</span>
                          <span>₹{amount.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="progress" style={{ height: 8 }}>
                          <div
                            className={`progress-bar bg-${
                              method === 'CASH' ? 'success' : method === 'UPI' ? 'primary' : 'warning'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Selling Items */}
        {can('dashboard.reports.view') && (
          <div className="col-12 col-lg-6">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-dark">Top Selling Dishes Today</h6>
                <ShoppingBag size={18} className="text-muted" />
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ fontSize: '0.85rem' }}>Dish Name</th>
                        <th style={{ fontSize: '0.85rem' }} className="text-center">Portions Sold</th>
                        <th style={{ fontSize: '0.85rem' }} className="text-end">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metrics?.charts?.topSellingItems || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center p-4 text-muted small">No orders recorded yet today.</td>
                        </tr>
                      ) : (
                        metrics?.charts?.topSellingItems.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="fw-medium small">{item.name}</td>
                            <td className="text-center">
                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                {item.count} qty
                              </span>
                            </td>
                            <td className="text-end fw-bold text-dark small">
                              ₹{item.revenue.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Low Stock Notification Section */}
      {can('dashboard.inventory.view') && metrics?.inventory?.lowStockItems?.length > 0 && (
        <div className="alert alert-warning border-0 shadow-sm d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2 p-3 rounded">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-warning rounded-circle text-dark flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="fw-bold text-dark">Low Stock Warning Alert!</div>
              <div className="small text-secondary" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {metrics.inventory.lowStockItems.map((i: any) => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')}
              </div>
            </div>
          </div>
          <Link to="/inventory" className="btn btn-warning btn-sm fw-semibold text-nowrap ms-auto ms-sm-0">
            Manage Stock
          </Link>
        </div>
      )}
    </div>
  );
};
