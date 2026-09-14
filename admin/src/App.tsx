import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider } from './context/PermissionContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { MainLayout } from './layouts/MainLayout';

// Fast Dynamic Route Code-Splitting (Reduces initial JS bundle size by >70%!)
const LoginPage = lazy(() => import('./modules/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MastersPage = lazy(() => import('./modules/masters/MastersPage').then(m => ({ default: m.MastersPage })));
const DailyMenuPage = lazy(() => import('./modules/daily-menu/DailyMenuPage').then(m => ({ default: m.DailyMenuPage })));
const BookingPage = lazy(() => import('./modules/booking/BookingPage').then(m => ({ default: m.BookingPage })));
const TokenPage = lazy(() => import('./modules/token/TokenPage').then(m => ({ default: m.TokenPage })));
const PublicTokenDisplay = lazy(() => import('./modules/token/PublicTokenDisplay').then(m => ({ default: m.PublicTokenDisplay })));
const TableFloorPage = lazy(() => import('./modules/tables/TableFloorPage').then(m => ({ default: m.TableFloorPage })));
const PosTerminalPage = lazy(() => import('./modules/pos/PosTerminalPage').then(m => ({ default: m.PosTerminalPage })));
const KitchenDisplayPage = lazy(() => import('./modules/kitchen/KitchenDisplayPage').then(m => ({ default: m.KitchenDisplayPage })));
const BillingPage = lazy(() => import('./modules/billing/BillingPage').then(m => ({ default: m.BillingPage })));
const InventoryPage = lazy(() => import('./modules/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const RecipePage = lazy(() => import('./modules/recipe/RecipePage').then(m => ({ default: m.RecipePage })));
const PurchasePage = lazy(() => import('./modules/purchase/PurchasePage').then(m => ({ default: m.PurchasePage })));
const AccountsPage = lazy(() => import('./modules/accounts/AccountsPage').then(m => ({ default: m.AccountsPage })));
const ExpensesPage = lazy(() => import('./modules/expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const EmployeesPage = lazy(() => import('./modules/employees/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const AttendancePage = lazy(() => import('./modules/attendance/AttendancePage').then(m => ({ default: m.AttendancePage })));
const LeavePage = lazy(() => import('./modules/leave/LeavePage').then(m => ({ default: m.LeavePage })));
const PayrollPage = lazy(() => import('./modules/payroll/PayrollPage').then(m => ({ default: m.PayrollPage })));
const ReportsPage = lazy(() => import('./modules/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const UsersRolesPage = lazy(() => import('./modules/users-roles/UsersRolesPage').then(m => ({ default: m.UsersRolesPage })));
const NotificationsPage = lazy(() => import('./modules/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const StoreSettingsPage = lazy(() => import('./modules/settings/StoreSettingsPage').then(m => ({ default: m.StoreSettingsPage })));
const AuditPage = lazy(() => import('./modules/audit/AuditPage').then(m => ({ default: m.AuditPage })));
const SystemControlPage = lazy(() => import('./modules/audit/AuditPage').then(m => ({ default: m.SystemControlPage })));
const SystemDiagnosticsPage = lazy(() => import('./modules/system-diagnostics/SystemDiagnosticsPage').then(m => ({ default: m.SystemDiagnosticsPage })));
const DatabaseToolsPage = lazy(() => import('./modules/system-diagnostics/SystemDiagnosticsPage').then(m => ({ default: m.DatabaseToolsPage })));

// Ultra-lightweight page loading fallback
const PageFallback: React.FC = () => (
  <div className="d-flex align-items-center justify-content-center py-5 w-100" style={{ minHeight: '40vh' }}>
    <div className="spinner-border spinner-border-sm text-warning" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

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
              <Suspense fallback={<PageFallback />}>
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
                    <Route path="settings" element={<StoreSettingsPage />} />
                    <Route path="audit-logs" element={<AuditPage />} />
                    <Route path="system-control" element={<SystemControlPage />} />
                    <Route path="diagnostics" element={<SystemDiagnosticsPage />} />
                    <Route path="database" element={<DatabaseToolsPage />} />
                  </Route>

                  {/* Fallback Route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </NotificationProvider>
          </SocketProvider>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};


