import React from 'react';
import { usePermission } from '../context/PermissionContext';

interface PermissionGateProps {
  permission: string | string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  requireAll = false,
  children,
  fallback = null
}) => {
  const { can, canAny, canAll } = usePermission();

  const isAllowed = Array.isArray(permission)
    ? (requireAll ? canAll(permission) : canAny(permission))
    : can(permission);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// --- DATA TABLE ---
interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  width?: string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchField?: (row: T) => string;
  actions?: (row: T) => React.ReactNode;
  exportFileName?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  searchPlaceholder = 'Search records...',
  searchField,
  actions
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const filteredData = React.useMemo(() => {
    if (!search) return data;
    return data.filter(row => {
      if (searchField) {
        return searchField(row).toLowerCase().includes(search.toLowerCase());
      }
      return JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
    });
  }, [data, search, searchField]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white p-3 border-bottom d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <div className="input-group" style={{ maxWidth: 320 }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>
        <div className="text-muted small">
          Showing {filteredData.length} records
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ width: col.width, fontSize: '0.85rem' }}>
                  {col.header}
                </th>
              ))}
              {actions && <th style={{ width: 120, textAlign: 'end', fontSize: '0.85rem' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center p-5 text-muted">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => (
                <tr key={row.id || rIdx}>
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} style={{ fontSize: '0.88rem' }}>
                      {typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : (row[col.accessor as keyof T] as any)}
                    </td>
                  ))}
                  {actions && (
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="card-footer bg-white border-top p-2 d-flex justify-content-between align-items-center">
          <span className="small text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-outline-secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-outline-secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MODAL WRAPPER ---
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ isOpen, onClose, title, size, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className={`modal-dialog modal-dialog-centered ${size ? `modal-${size}` : ''}`}>
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header bg-light border-bottom">
            <h5 className="modal-title fw-bold text-dark">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {children}
          </div>
          {footer && <div className="modal-footer bg-light border-top">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

// --- CONFIRM DIALOG ---
export const ConfirmDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmVariant = 'danger' }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn btn-${confirmVariant} btn-sm`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Confirm
          </button>
        </>
      }
    >
      <p className="mb-0 text-secondary">{message}</p>
    </Modal>
  );
};

// --- STAT WIDGET ---
export const StatWidget: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'danger';
}> = ({ title, value, subtitle, icon, variant = 'primary' }) => {
  return (
    <div className="card shadow-sm border-0 h-100">
      <div className="card-body p-3 d-flex align-items-center justify-content-between">
        <div>
          <span className="small text-uppercase text-muted fw-bold" style={{ letterSpacing: '0.04em' }}>
            {title}
          </span>
          <h3 className="fw-bold mb-0 mt-1 text-dark">{value}</h3>
          {subtitle && <small className="text-muted">{subtitle}</small>}
        </div>
        <div className={`p-3 rounded-circle bg-${variant}-subtle text-${variant} d-flex align-items-center justify-content-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
