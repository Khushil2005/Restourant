import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider } from './context/PermissionContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';

import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './modules/auth/LoginPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { MastersPage } from './modules/masters/MastersPage';
import { DailyMenuPage } from './modules/daily-menu/DailyMenuPage';
import { BookingPage } from './modules/booking/BookingPage';
import { TokenPage } from './modules/token/TokenPage';
import { PublicTokenDisplay } from './modules/token/PublicTokenDisplay';
import { TableFloorPage } from './modules/tables/TableFloorPage';
import { PosTerminalPage } from './modules/pos/PosTerminalPage';
import { KitchenDisplayPage } from './modules/kitchen/KitchenDisplayPage';
import { BillingPage } from './modules/billing/BillingPage';
import { InventoryPage } from './modules/inventory/InventoryPage';
import { RecipePage } from './modules/recipe/RecipePage';
import { PurchasePage } from './modules/purchase/PurchasePage';
import { AccountsPage } from './modules/accounts/AccountsPage';
import { ExpensesPage } from './modules/expenses/ExpensesPage';
import { EmployeesPage } from './modules/employees/EmployeesPage';
import { AttendancePage } from './modules/attendance/AttendancePage';
import { LeavePage } from './modules/leave/LeavePage';
import { PayrollPage } from './modules/payroll/PayrollPage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { UsersRolesPage } from './modules/users-roles/UsersRolesPage';
import { NotificationsPage, SettingsPage } from './modules/notifications/NotificationsPage';
import { AuditPage, SystemControlPage } from './modules/audit/AuditPage';

// System Diagnostics & Maintenance
import { SystemDiagnosticsPage, DatabaseToolsPage } from './modules/system-diagnostics/SystemDiagnosticsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <SocketProvider>
            <NotificationProvider>
              <Routes>
                {/* Public Auth & Display Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/display/tokens" element={<PublicTokenDisplay />} />

                {/* Full-Screen Standalone Workspaces */}
                <Route
                  path="/pos"
                  element={
                    <ProtectedRoute>
                      <PosTerminalPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kitchen"
                  element={
                    <ProtectedRoute>
                      <KitchenDisplayPage />
                    </ProtectedRoute>
                  }
                />

                {/* Main Unified ERP Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="masters" element={<MastersPage />} />
                  <Route path="daily-menu" element={<DailyMenuPage />} />
                  <Route path="bookings" element={<BookingPage />} />
                  <Route path="functions" element={<BookingPage />} />
                  <Route path="tokens" element={<TokenPage />} />
                  <Route path="tables" element={<TableFloorPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="payments" element={<BillingPage defaultTab="payments" />} />
                  <Route path="inventory" element={<InventoryPage />} />
                  <Route path="recipes" element={<RecipePage />} />
                  <Route path="purchases" element={<PurchasePage />} />
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="employees" element={<EmployeesPage />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="leaves" element={<LeavePage />} />
                  <Route path="payroll" element={<PayrollPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="users-roles" element={<UsersRolesPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="audit-logs" element={<AuditPage />} />
                  <Route path="system-control" element={<SystemControlPage />} />
                  <Route path="diagnostics" element={<SystemDiagnosticsPage />} />
                  <Route path="database" element={<DatabaseToolsPage />} />
                </Route>

                {/* Fallback Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </NotificationProvider>
          </SocketProvider>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};


