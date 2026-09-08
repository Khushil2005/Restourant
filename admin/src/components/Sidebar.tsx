import React from 'react';
import { NavLink } from 'react-router-dom';
import { usePermission } from '../context/PermissionContext';
import {
  LayoutDashboard,
  Database,
  CalendarCheck,
  Ticket,
  Grid,
  ShoppingBag,
  ChefHat,
  Receipt,
  CreditCard,
  Percent,
  Boxes,
  BookOpen,
  Truck,
  BookCheck,
  DollarSign,
  Users,
  Clock,
  Calendar,
  FileSpreadsheet,
  BarChart3,
  UserCog,
  Bell,
  Settings,
  ShieldAlert,
  Server,
  Activity,
  Shield,
  Terminal,
  Tv
} from 'lucide-react';

interface MenuItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  permission: string | string[];
  badge?: string;
  section?: string;
}

export const Sidebar: React.FC<{ isOpen: boolean; onCloseMobile?: () => void }> = ({ isOpen, onCloseMobile }) => {
  const { can, canAny } = usePermission();

  const menuItems: MenuItem[] = [
    { title: 'Overview', path: '/', icon: <LayoutDashboard size={18} />, permission: 'dashboard.view' },
    { title: 'Tokens', path: '/tokens', icon: <Ticket size={18} />, permission: 'token.view', badge: '0' },
    { title: 'Menu', path: '/pos', icon: <ShoppingBag size={18} />, permission: 'orders.view' },
    { title: 'Daily Menu (Day-Wise)', path: '/daily-menu', icon: <Calendar size={18} />, permission: ['daily_menu.view', 'masters.menu.view'], badge: 'Day-Wise' },
    { title: 'Functions', path: '/bookings', icon: <CalendarCheck size={18} />, permission: 'booking.view', badge: '1 Date / Order' },
    { title: 'KDS Screen', path: '/kitchen', icon: <ChefHat size={18} />, permission: 'kot.view' },
    { title: 'Table Floor Map', path: '/tables', icon: <Grid size={18} />, permission: 'tables.view' },
    { title: 'Billing & Invoices', path: '/billing', icon: <Receipt size={18} />, permission: 'billing.view' },
    { title: 'Payments & Receipts', path: '/payments', icon: <CreditCard size={18} />, permission: 'payment.view' },
    { title: 'Discount Rules', path: '/discounts', icon: <Percent size={18} />, permission: 'discount.view' },
    { title: 'Inventory Stock', path: '/inventory', icon: <Boxes size={18} />, permission: 'inventory.view' },
    { title: 'Recipe Formulas (BOM)', path: '/recipes', icon: <BookOpen size={18} />, permission: 'inventory.recipe.view' },
    { title: 'Procurement (PO/GRN)', path: '/purchases', icon: <Truck size={18} />, permission: 'purchase.view' },
    { title: 'Catalog Masters', path: '/masters', icon: <Database size={18} />, permission: ['masters.customer.view', 'masters.menu.view', 'masters.supplier.view', 'masters.table.view'] },
    { title: 'Accounts & Ledger', path: '/accounts', icon: <BookCheck size={18} />, permission: 'accounts.dashboard.view' },
    { title: 'Operating Expenses', path: '/expenses', icon: <DollarSign size={18} />, permission: 'expense.view' },
    { title: 'Staff Directory', path: '/employees', icon: <Users size={18} />, permission: 'employee.view' },
    { title: 'Attendance Punches', path: '/attendance', icon: <Clock size={18} />, permission: 'attendance.view' },
    { title: 'Leave Approvals', path: '/leaves', icon: <Calendar size={18} />, permission: 'leave.view' },
    { title: 'Payroll Processing', path: '/payroll', icon: <FileSpreadsheet size={18} />, permission: 'payroll.view' },
    { title: 'Central Reports', path: '/reports', icon: <BarChart3 size={18} />, permission: 'reports.sales.view' },
    { title: 'User Roles Matrix', path: '/users-roles', icon: <UserCog size={18} />, permission: 'users.view' },
    { title: 'Notifications', path: '/notifications', icon: <Bell size={18} />, permission: 'notification.view' },
    { title: 'Store Settings', path: '/settings', icon: <Settings size={18} />, permission: 'settings.view' },
    { title: 'Audit Trail Logs', path: '/audit-logs', icon: <ShieldAlert size={18} />, permission: 'audit.view' },
    { title: 'Emergency Control', path: '/system-control', icon: <Server size={18} />, permission: 'system.control.view' },
    { title: 'System Diagnostics', path: '/diagnostics', icon: <Activity size={18} />, permission: 'system.control.view' },
    { title: 'Database Tools', path: '/database', icon: <Database size={18} />, permission: 'system.control.view' }
  ];

  // Dynamically filter menu items based on user's granted permissions
  const visibleItems = menuItems.filter(item => 
    Array.isArray(item.permission) ? canAny(item.permission) : can(item.permission)
  );

  return (
    <aside
      className={`sidebar bg-white border-end position-fixed top-0 bottom-0 start-0 z-3 ${
        isOpen ? 'd-block' : 'd-none d-lg-block'
      }`}
      style={{
        width: 260,
        paddingTop: 62,
        overflowY: 'auto',
        transition: 'transform 0.3s ease-in-out'
      }}
    >
      <div className="p-3 border-bottom bg-light d-flex align-items-center justify-content-between">
        <span className="small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em' }}>
          Navigation Menu
        </span>
        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
          {visibleItems.length} Modules
        </span>
      </div>

      <nav className="nav flex-column p-2 gap-1">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `nav-link d-flex align-items-center justify-content-between px-3 py-2 rounded text-dark text-decoration-none ${
                isActive ? 'bg-primary text-white active fw-semibold shadow-sm' : 'hover-bg-light'
              }`
            }
          >
            <div className="d-flex align-items-center gap-2">
              <span className="d-flex align-items-center">{item.icon}</span>
              <span style={{ fontSize: '0.9rem' }}>{item.title}</span>
            </div>
            {item.badge && (
              <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
