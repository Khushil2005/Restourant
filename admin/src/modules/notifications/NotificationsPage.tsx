import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { SystemNotification } from '../../types';
import { Bell, Plus, CheckCheck, Mail } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { can } = usePermission();
  const { notifications, markAsRead, markAllAsRead, fetchNotifications } = useNotification();

  // Send Broadcast Modal
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendForm, setSendForm] = useState({
    title: '',
    message: '',
    type: 'INFO'
  });

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/system/notifications', sendForm);
      alert('System notification broadcasted.');
      setIsSendModalOpen(false);
      fetchNotifications();
    } catch (err: any) {
      alert(err.message || 'Broadcast failed.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Notification Center & Broadcasts</h4>
          <p className="text-muted small mb-0">System alerts, operational notifications, and staff broadcast messages</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={markAllAsRead}>
            <CheckCheck size={16} /> Mark All as Read
          </button>
          {can('notification.send') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsSendModalOpen(true)}>
              <Plus size={16} /> Send Broadcast
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <DataTable<SystemNotification>
        columns={[
          {
            header: 'Notification Title',
            accessor: (row) => (
              <div>
                <span className={`fw-bold ${row.isRead ? 'text-secondary' : 'text-dark'}`}>{row.title}</span>
                <div className="small text-muted">{row.message}</div>
              </div>
            )
          },
          {
            header: 'Type',
            accessor: (row) => <span className="badge bg-light text-dark border">{row.type}</span>
          },
          {
            header: 'Timestamp',
            accessor: (row) => new Date(row.createdAt).toLocaleString()
          },
          {
            header: 'Status',
            accessor: (row) => (
              <span className={`badge ${row.isRead ? 'bg-secondary' : 'bg-primary'}`}>
                {row.isRead ? 'Read' : 'New'}
              </span>
            )
          }
        ]}
        data={notifications}
        searchPlaceholder="Search notifications..."
        actions={(row) => (
          <>
            {!row.isRead && (
              <button className="btn btn-outline-primary btn-sm p-1 px-2" onClick={() => markAsRead(row.id)}>
                Mark Read
              </button>
            )}
          </>
        )}
      />

      {/* SEND BROADCAST MODAL */}
      <Modal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title="Broadcast System Notification"
      >
        <form onSubmit={handleSendBroadcast} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Headline / Title</label>
            <input type="text" className="form-control" placeholder="e.g. Kitchen Maintenance Notice" required value={sendForm.title} onChange={e => setSendForm({ ...sendForm, title: e.target.value })} />
          </div>
          <div>
            <label className="form-label small fw-bold">Alert Type</label>
            <select className="form-select" value={sendForm.type} onChange={e => setSendForm({ ...sendForm, type: e.target.value })}>
              <option value="INFO">Information</option>
              <option value="WARNING">Warning</option>
              <option value="ALERT">Emergency Alert</option>
            </select>
          </div>
          <div>
            <label className="form-label small fw-bold">Detailed Message</label>
            <textarea className="form-control" rows={3} required placeholder="Enter broadcast message body..." value={sendForm.message} onChange={e => setSendForm({ ...sendForm, message: e.target.value })} />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsSendModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Send Broadcast</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { can } = usePermission();
  const [settings, setSettings] = useState<any>({
    restaurant_name: 'Bhatigal Bhanu',
    tagline: 'Traditional Kathiyawadi & Gujarati Dining',
    gst_number: '24AAAFB1234A1Z8',
    phone: '+91 98790 12345',
    email: 'contact@bhatigalbhanu.com',
    currency_symbol: '₹',
    default_tax_rate: '5',
    service_charge_rate: '0',
    auto_print_kot: 'true',
    address: 'Kothariya Ring Road, Rajkot, Gujarat - 360022'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res: any = await apiClient.get('/system/settings');
        if (res.success && res.data) {
          setSettings((prev: any) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
      await apiClient.post('/system/settings', { settings: payload });
      alert('System configuration and store profile saved successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div>
        <h4 className="fw-bold mb-1 text-dark">Store Configuration & General Settings</h4>
        <p className="text-muted small mb-0">Manage restaurant profile, tax rates, currency, billing rules, and hardware printing preferences</p>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body p-4">
          <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 border mb-4">
            <img
              src="/logo.jpg"
              alt="Bhatigal Bhanu"
              className="brand-logo-lg"
            />
            <div>
              <h5 className="fw-bold mb-0 text-dark">Bhatigal Bhanu</h5>
              <p className="text-muted small mb-1">Traditional Kathiyawadi & Gujarati Dining</p>
              <span className="badge bg-gold text-dark fw-semibold">Kathiyawadi & Gujarati Dining</span>
            </div>
          </div>

          <form onSubmit={handleSave} className="d-flex flex-column gap-3">
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Restaurant Identity & Contact</h6>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">Restaurant Brand Name</label>
                <input type="text" className="form-control" value={settings.restaurant_name} onChange={e => setSettings({ ...settings, restaurant_name: e.target.value })} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">GSTIN / Tax ID</label>
                <input type="text" className="form-control" value={settings.gst_number} onChange={e => setSettings({ ...settings, gst_number: e.target.value })} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">Phone Number</label>
                <input type="text" className="form-control" value={settings.phone} onChange={e => setSettings({ ...settings, phone: e.target.value })} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">Support Email</label>
                <input type="email" className="form-control" value={settings.email} onChange={e => setSettings({ ...settings, email: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-bold">Physical Address (Prints on Invoices)</label>
                <input type="text" className="form-control" value={settings.address} onChange={e => setSettings({ ...settings, address: e.target.value })} />
              </div>
            </div>

            <h6 className="fw-bold text-dark border-bottom pb-2 mt-4 mb-3">Billing & Tax Parameters</h6>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">Default GST Rate (%)</label>
                <input type="number" className="form-control" value={settings.default_tax_rate} onChange={e => setSettings({ ...settings, default_tax_rate: e.target.value })} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">Service Charge (%)</label>
                <input type="number" className="form-control" value={settings.service_charge_rate} onChange={e => setSettings({ ...settings, service_charge_rate: e.target.value })} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">Currency Symbol</label>
                <input type="text" className="form-control" value={settings.currency_symbol} onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })} />
              </div>
            </div>

            {can('settings.edit') && (
              <div className="d-flex justify-content-end mt-4 pt-3 border-top">
                <button type="submit" className="btn btn-primary fw-bold px-4">
                  Save Store Settings
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
