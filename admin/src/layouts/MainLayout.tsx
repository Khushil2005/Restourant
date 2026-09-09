import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="d-flex flex-column min-vh-100 bg-light position-relative" style={{ overflowX: 'hidden' }}>
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop d-lg-none"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="d-flex flex-grow-1 position-relative">
        <Sidebar isOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main
          className="flex-grow-1 p-2 p-sm-3 p-md-4 main-content"
          style={{
            marginLeft: 'var(--sidebar-width, 260px)',
            transition: 'margin-left 0.3s ease',
            minWidth: 0,
            maxWidth: '100%'
          }}
        >
          <div className="container-fluid px-0" style={{ minWidth: 0 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export const PosLayout: React.FC = () => {
  return (
    <div className="vh-100 vw-100 d-flex flex-column bg-light overflow-hidden">
      <Outlet />
    </div>
  );
};

export const KitchenLayout: React.FC = () => {
  return (
    <div className="vh-100 vw-100 d-flex flex-column bg-dark text-white overflow-hidden">
      <Outlet />
    </div>
  );
};

export const PublicDisplayLayout: React.FC = () => {
  return (
    <div className="vh-100 vw-100 d-flex flex-column bg-dark text-white overflow-hidden">
      <Outlet />
    </div>
  );
};
