import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { AttendanceRecord, Employee } from '../../types';
import { Clock, CheckCircle2, XCircle, Plus, Calendar, AlertCircle } from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { can } = usePermission();
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Punch Modal
  const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
  const [punchEmployeeId, setPunchEmployeeId] = useState('');
  const [punchType, setPunchType] = useState<'IN' | 'OUT'>('IN');

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, eRes]: any = await Promise.all([
        apiClient.get(`/hr/attendance?date=${selectedDate}`),
        apiClient.get('/hr/employees')
      ]);
      if (aRes.success) setAttendanceLogs(aRes.data);
      if (eRes.success) setEmployees(eRes.data);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handlePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchEmployeeId) return;
    try {
      await apiClient.post('/hr/attendance/punch', {
        employeeId: punchEmployeeId,
        type: punchType
      });
      alert(`Punch ${punchType} recorded successfully.`);
      setIsPunchModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Punch failed.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Staff Attendance & Time Clock</h4>
          <p className="text-muted small mb-0">Record shift check-ins, check-outs, overtime tracking, and manual punch adjustments</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <input
            type="date"
            className="form-control form-control-sm"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          {can('attendance.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm text-nowrap" onClick={() => setIsPunchModalOpen(true)}>
              <Clock size={16} /> Record Punch
            </button>
          )}
        </div>
      </div>

      {/* Attendance Table */}
      <DataTable<AttendanceRecord>
        columns={[
          { header: 'Employee', accessor: (row) => <span className="fw-bold text-dark">{row.employeeName}</span> },
          { header: 'Date', accessor: 'date' },
          {
            header: 'Check In',
            accessor: (row) => (
              <span className="badge bg-light text-dark border">
                {row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
            )
          },
          {
            header: 'Check Out',
            accessor: (row) => (
              <span className="badge bg-light text-dark border">
                {row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
            )
          },
          {
            header: 'Hours Worked',
            accessor: (row) => <span className="fw-bold">{row.totalHours || 0} hrs</span>
          },
          {
            header: 'Status',
            accessor: (row) => (
              <span className={`badge ${
                row.status === 'PRESENT' || row.status === 'OVERTIME' ? 'bg-success' : row.status === 'HALF_DAY' ? 'bg-warning text-dark' : 'bg-danger'
              }`}>
                {row.status}
              </span>
            )
          }
        ]}
        data={attendanceLogs}
        searchPlaceholder="Search staff attendance..."
      />

      {/* PUNCH MODAL */}
      <Modal
        isOpen={isPunchModalOpen}
        onClose={() => setIsPunchModalOpen(false)}
        title="Record Employee Shift Punch"
      >
        <form onSubmit={handlePunch} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Select Employee</label>
            <select
              className="form-select"
              required
              value={punchEmployeeId}
              onChange={e => setPunchEmployeeId(e.target.value)}
            >
              <option value="">-- Choose Staff Member --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.departmentName} - {emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label small fw-bold">Punch Action</label>
            <div className="btn-group w-100">
              <button
                type="button"
                className={`btn ${punchType === 'IN' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setPunchType('IN')}
              >
                Punch IN (Shift Start)
              </button>
              <button
                type="button"
                className={`btn ${punchType === 'OUT' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setPunchType('OUT')}
              >
                Punch OUT (Shift End)
              </button>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPunchModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Save Punch</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
