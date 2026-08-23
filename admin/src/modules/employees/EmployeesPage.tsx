import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal, ConfirmDialog } from '../../components/PermissionGate';
import { Employee } from '../../types';
import { Users, Plus, Edit2, Trash2, Mail, Phone, Briefcase } from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { can } = usePermission();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentName: 'KITCHEN',
    designationTitle: 'CHEF',
    baseSalary: 35000,
    hireDate: new Date().toISOString().split('T')[0]
  });

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/hr/employees');
      if (res.success) setEmployees(res.data);
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/hr/employees', formData);
      alert('Staff member registered successfully.');
      setIsModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Registration failed.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Terminate/Delete staff record?')) return;
    try {
      await apiClient.delete(`/hr/employees/${id}`);
      loadEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Staff Directory & HR Management</h4>
          <p className="text-muted small mb-0">Manage restaurant workforce, salary structures, departments, and designations</p>
        </div>
        {can('employee.create') && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Register Employee
          </button>
        )}
      </div>

      {/* Employees Table */}
      <DataTable<Employee>
        columns={[
          { header: 'Employee Code', accessor: 'employeeCode', width: 140 },
          {
            header: 'Full Name',
            accessor: (row) => (
              <div>
                <span className="fw-bold text-dark">{row.firstName} {row.lastName}</span>
                <div className="small text-muted">{row.email}</div>
              </div>
            )
          },
          { header: 'Department', accessor: 'departmentName' },
          { header: 'Designation', accessor: 'designationTitle' },
          { header: 'Phone', accessor: 'phone' },
          {
            header: 'Base Salary',
            accessor: (row) => <span className="fw-bold text-dark">₹{row.baseSalary.toLocaleString()}/mo</span>
          },
          {
            header: 'Status',
            accessor: (row) => (
              <span className={`badge ${row.status === 'ACTIVE' ? 'bg-success' : 'bg-secondary'}`}>
                {row.status}
              </span>
            )
          }
        ]}
        data={employees}
        searchPlaceholder="Search staff name, code, email..."
        actions={(row) => (
          <>
            {can('employee.delete') && (
              <button className="btn btn-outline-danger btn-sm p-1" onClick={() => handleDelete(row.id)} title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      />

      {/* REGISTER EMPLOYEE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Restaurant Staff Member"
      >
        <form onSubmit={handleCreate} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">First Name</label>
              <input type="text" className="form-control" required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Last Name</label>
              <input type="text" className="form-control" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Email</label>
              <input type="email" className="form-control" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Phone Number</label>
              <input type="text" className="form-control" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Department</label>
              <select className="form-select" value={formData.departmentName} onChange={e => setFormData({ ...formData, departmentName: e.target.value })}>
                <option value="KITCHEN">Kitchen / Culinary</option>
                <option value="SERVICE">Floor Service / Waitstaff</option>
                <option value="BAR">Bar / Beverages</option>
                <option value="FRONT_DESK">Front Desk & Reception</option>
                <option value="ACCOUNTS">Finance & Accounts</option>
                <option value="MANAGEMENT">Store Management</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Designation</label>
              <input type="text" className="form-control" placeholder="e.g. Head Chef, Captain, Bartender" required value={formData.designationTitle} onChange={e => setFormData({ ...formData, designationTitle: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Monthly Base Salary (₹)</label>
              <input type="number" className="form-control" required value={formData.baseSalary} onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Hire Date</label>
              <input type="date" className="form-control" required value={formData.hireDate} onChange={e => setFormData({ ...formData, hireDate: e.target.value })} />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Register Staff</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
