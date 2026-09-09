import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSocket } from '../context/SocketContext';
import { Bell, User as UserIcon, LogOut, Shield, Wifi, WifiOff, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const { isConnected } = useSocket();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="navbar navbar-expand-lg navbar-dark bg-primary sticky-top px-2 px-sm-3 py-2 shadow-sm">
      <div className="d-flex align-items-center">
        <button
          className="btn btn-link text-white me-2 me-sm-3 p-0 d-lg-none"
          onClick={onToggleSidebar}
          type="button"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <Link to="/" className="navbar-brand fw-bold d-flex align-items-center mb-0 text-white text-decoration-none">
          <img
            src="/logo.jpg"
            alt="Bhatigal Bhanu"
            className="brand-logo-img me-2 shadow-sm"
            style={{ width: 36, height: 36 }}
          />
          <div className="d-flex flex-column">
            <div className="d-flex align-items-center">
              <span className="fs-6 fs-md-5 fw-bold text-white tracking-wide" style={{ letterSpacing: '0.02em' }}>
                BHATIGAL BHANU
              </span>
              <span className="badge bg-gold text-dark ms-1 ms-sm-2 fw-semibold" style={{ fontSize: '0.62rem' }}>
                ERP
              </span>
            </div>
            <span className="small text-white-50 d-none d-md-block" style={{ fontSize: '0.72rem', marginTop: '-2px' }}>
              Traditional Dining & Restaurant Management
            </span>
          </div>
        </Link>
      </div>

      <div className="ms-auto d-flex align-items-center gap-2 gap-sm-3">
        {/* Real-time connection badge */}
        <div className="d-none d-md-flex align-items-center gap-1 small text-white-50">
          {isConnected ? (
            <span className="badge bg-success-subtle text-success d-flex align-items-center gap-1 border border-success-subtle">
              <Wifi size={12} /> Live Sync
            </span>
          ) : (
            <span className="badge bg-danger-subtle text-danger d-flex align-items-center gap-1 border border-danger-subtle">
              <WifiOff size={12} /> Offline
            </span>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="position-relative">
          <button
            className="btn btn-outline-light btn-sm position-relative rounded-circle p-2"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              className="position-absolute end-0 mt-2 bg-white rounded shadow-lg border p-0"
              style={{ width: 'min(320px, calc(100vw - 20px))', zIndex: 1060 }}
            >
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-light">
                <h6 className="mb-0 fw-bold text-dark">Notifications</h6>
                {unreadCount > 0 && (
                  <button
                    className="btn btn-link btn-sm p-0 text-decoration-none text-primary"
                    onClick={markAllAsRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted small">No notifications yet.</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-2 px-3 border-bottom small ${!n.isRead ? 'bg-light fw-medium' : ''}`}
                      onClick={() => markAsRead(n.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex justify-content-between text-dark">
                        <span className="fw-bold">{n.title}</span>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-secondary mt-1">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 text-center border-top bg-light">
                <Link
                  to="/notifications"
                  className="btn btn-sm btn-link text-decoration-none"
                  onClick={() => setShowNotifications(false)}
                >
                  View all in Notification Center
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Info */}
        <div className="d-flex align-items-center text-white gap-1 gap-sm-2">
          <div className="text-end">
            <div className="fw-semibold text-truncate small" style={{ maxWidth: 110, fontSize: '0.78rem' }}>
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username || 'Admin'}
            </div>
            <div className="badge bg-white text-primary fw-medium text-truncate" style={{ fontSize: '0.62rem', maxWidth: 95 }}>
              {user?.roleName || 'Admin'}
            </div>
          </div>
          <button
            className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm ms-1 ms-sm-2 p-1 p-sm-2"
            onClick={logout}
            title="Sign Out"
          >
            <LogOut size={14} />
            <span className="d-none d-md-inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
