import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Auto-close navigation menu whenever the route/page changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Auto-close navigation menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 992 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Close navigation menu with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  return (
    <div className="d-flex flex-column min-vh-100 bg-light position-relative" style={{ overflowX: 'hidden' }}>
      <Navbar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />
      {/* Backdrop for auto-closing on outside click (Mobile & Desktop) */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="d-flex flex-grow-1 position-relative">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onCloseMobile={() => setSidebarOpen(false)}
        />
        <main
          className="flex-grow-1 p-2 p-sm-3 p-md-4 main-content"
          style={{
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
