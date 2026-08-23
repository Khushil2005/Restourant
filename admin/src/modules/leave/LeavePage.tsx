import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { LeaveRequest, Employee } from '../../types';
import { Calendar, Plus, CheckCircle2, XCircle } from 'lucide-react';

export const LeavePage: React.FC = () => {
  const { can } = usePermission();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    leaveType: 'CASUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    totalDays: 1,
    reason: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [lRes, eRes]: any = await Promise.all([
        apiClient.get('/hr/leaves'),
        apiClient.get('/hr/employees')
      ]);
      if (lRes.success) setLeaves(lRes.data);
      if (eRes.success) setEmployees(eRes.data);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/hr/leaves', formData);
      alert('Leave application submitted for approval.');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Leave submission failed.');
    }
  };

  const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.patch(`/hr/leaves/${id}/status`, { status });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Leave Management & Approvals</h4>
          <p className="text-muted small mb-0">Apply for staff leaves, manage absence records, and approval workflows</p>
        </div>
        {can('leave.create') && (
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={() => {
              setFormData({ ...formData, employeeId: employees[0]?.id || '' });
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Apply Leave Request
          </button>
        )}
      </div>

      {/* Leaves Table */}
      <DataTable<LeaveRequest>
        columns={[
          { header: 'Employee', accessor: (row) => <span className="fw-bold text-dark">{row.employeeName}</span> },
          {
            header: 'Leave Type',
            accessor: (row) => <span className="badge bg-light text-dark border">{row.leaveType}</span>
          },
          { header: 'Duration', accessor: (row) => `${row.startDate} to ${row.endDate}` },
          { header: 'Days', accessor: (row) => `${row.totalDays} Days` },
          { header: 'Reason', accessor: 'reason' },
          {
            header: 'Status',
            accessor: (row) => (
              <span className={`badge bg-${
                row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning text-dark'
              }`}>
                {row.status}
              </span>
            )
          }
        ]}
        data={leaves}
        searchPlaceholder="Search leave requests..."
        actions={(row) => (
          <>
            {row.status === 'PENDING' && can('leave.approve') && (
              <button
                className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => handleStatusUpdate(row.id, 'APPROVED')}
                title="Approve Leave"
              >
                <CheckCircle2 size={14} /> Approve
              </button>
            )}
            {row.status === 'PENDING' && can('leave.reject') && (
              <button
                className="btn btn-outline-danger btn-sm p-1"
                onClick={() => handleStatusUpdate(row.id, 'REJECTED')}
                title="Reject"
              >
                <XCircle size={14} />
              </button>
            )}
          </>
        )}
      />

      {/* APPLY LEAVE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Apply Staff Leave Request"
      >
        <form onSubmit={handleApply} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Select Employee</label>
            <select
              className="form-select"
              required
              value={formData.employeeId}
              onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.departmentName})
                </option>
              ))}
            </select>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Leave Type</label>
              <select className="form-select" value={formData.leaveType} onChange={e => setFormData({ ...formData, leaveType: e.target.value })}>
                <option value="CASUAL">Casual Leave (CL)</option>
                <option value="SICK">Medical / Sick Leave (SL)</option>
                <option value="EARNED">Earned Privilege (PL)</option>
                <option value="UNPAID">Leave Without Pay (LWP)</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Total Days</label>
              <input type="number" min="1" className="form-control" required value={formData.totalDays} onChange={e => setFormData({ ...formData, totalDays: Number(e.target.value) })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Start Date</label>
              <input type="date" className="form-control" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">End Date</label>
              <input type="date" className="form-control" required value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="form-label small fw-bold">Reason for Absence</label>
            <textarea className="form-control form-control-sm" rows={2} required placeholder="e.g. Family medical emergency" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Submit Leave</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
