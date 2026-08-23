import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="d-flex flex-column min-vh-100 bg-light">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="d-flex flex-grow-1">
        <Sidebar isOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main
          className="flex-grow-1 p-3 p-md-4 main-content"
          style={{
            marginLeft: 'var(--sidebar-width, 260px)',
            transition: 'margin-left 0.3s ease'
          }}
        >
          <div className="container-fluid px-0">
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
