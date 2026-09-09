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
        <Link to="/" className="navbar-brand fw-bold d-flex align-items-center mb-0 text-white text-decoration-none me-1 me-sm-2">
          <img
            src="/logo.jpg"
            alt="Bhatigal Bhanu"
            className="brand-logo-img me-1 me-sm-2 shadow-sm flex-shrink-0"
            style={{ width: 32, height: 32 }}
          />
          <div className="d-flex flex-column overflow-hidden">
            <div className="d-flex align-items-center gap-1">
              <span className="fs-6 fw-bold text-white tracking-wide text-truncate" style={{ letterSpacing: '0.02em', maxWidth: 130 }}>
                BHATIGAL BHANU
              </span>
              <span className="badge bg-gold text-dark fw-semibold d-none d-sm-inline" style={{ fontSize: '0.6rem' }}>
                ERP
              </span>
            </div>
            <span className="small text-white-50 d-none d-md-block" style={{ fontSize: '0.7rem', marginTop: '-2px' }}>
              Traditional Dining & Restaurant Management
            </span>
          </div>
        </Link>
      </div>

      <div className="ms-auto d-flex align-items-center gap-1 gap-sm-2">
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
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.62rem' }}>
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

        {/* Proper Logged-in User Header Chip */}
        <div
          className="d-flex align-items-center gap-1 gap-sm-2 px-2 py-1 rounded-pill bg-white bg-opacity-10 border border-white border-opacity-20 shadow-sm"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          {/* User Initial Avatar */}
          <div
            className="rounded-circle bg-gold text-dark d-flex align-items-center justify-content-center fw-bold shadow-sm flex-shrink-0"
            style={{ width: 28, height: 28, fontSize: '0.78rem' }}
          >
            {(user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase()}
          </div>

          {/* User Name & Role */}
          <div className="d-flex flex-column text-start lh-1" style={{ maxWidth: 120 }}>
            <span
              className="fw-bold text-white text-truncate"
              style={{ fontSize: '0.8rem', letterSpacing: '0.01em' }}
              title={user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username || 'Admin'}
            >
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username || 'Admin'}
            </span>
            <span
              className="badge bg-gold text-dark fw-bold font-monospace text-truncate mt-1 px-1 py-0"
              style={{ fontSize: '0.6rem', width: 'fit-content', maxWidth: 110 }}
            >
              {user?.roleName || 'ADMIN'}
            </span>
          </div>

          {/* Logout Button */}
          <button
            className="btn btn-danger btn-sm rounded-circle p-1 ms-1 d-flex align-items-center justify-content-center shadow-sm text-white"
            onClick={logout}
            title="Sign Out"
            style={{ width: 26, height: 26 }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};
