import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { PayrollRun, Payslip } from '../../types';
import { FileSpreadsheet, Plus, CheckCircle2, Eye, Printer, DollarSign } from 'lucide-react';

export const PayrollPage: React.FC = () => {
  const { can } = usePermission();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(false);

  // Process Modal
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [processMonth, setProcessMonth] = useState(new Date().getMonth() + 1);
  const [processYear, setProcessYear] = useState(new Date().getFullYear());

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/hr/payroll/runs');
      if (res.success) setPayrollRuns(res.data);
    } catch (err) {
      console.error('Failed to load payroll runs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await apiClient.post('/hr/payroll/process', {
        month: processMonth,
        year: processYear
      });
      if (res.success) {
        alert('Payroll processed and payslips generated for all active staff members!');
        setIsProcessModalOpen(false);
        loadRuns();
      }
    } catch (err: any) {
      alert(err.message || 'Payroll computation failed.');
    }
  };

  const handleViewPayslips = async (run: PayrollRun) => {
    setSelectedRun(run);
    try {
      const res: any = await apiClient.get(`/hr/payroll/runs/${run.id}/payslips`);
      if (res.success) {
        setPayslips(res.data);
      }
    } catch (err) {
      console.error('Failed to load payslips:', err);
    }
  };

  const handleApproveDisburse = async (runId: string) => {
    if (!window.confirm('Approve and disburse staff salaries? This will automatically post a disbursement Journal Entry in Accounts.')) return;
    try {
      await apiClient.post(`/hr/payroll/runs/${runId}/approve`);
      alert('Payroll approved, disbursed, and posted to Accounts!');
      loadRuns();
      if (selectedRun && selectedRun.id === runId) {
        handleViewPayslips({ ...selectedRun, status: 'PAID' });
      }
    } catch (err: any) {
      alert(err.message || 'Disbursement failed.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Payroll Processing & Salary Disbursement</h4>
          <p className="text-muted small mb-0">Compute gross-to-net staff payroll from attendance/overtime, issue payslips, and automate accounts posting</p>
        </div>
        {can('payroll.process') && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsProcessModalOpen(true)}>
            <Plus size={16} /> Process Monthly Payroll
          </button>
        )}
      </div>

      {/* Payroll Runs Table */}
      <DataTable<PayrollRun>
        columns={[
          { header: 'Payroll Code', accessor: 'payrollCode', width: 140 },
          { header: 'Month / Year', accessor: (row) => `${row.month} / ${row.year}` },
          { header: 'Total Gross (₹)', accessor: (row) => `₹${row.totalGrossSalary.toLocaleString()}` },
          { header: 'Deductions (₹)', accessor: (row) => `₹${row.totalDeductions.toLocaleString()}` },
          {
            header: 'Net Payable (₹)',
            accessor: (row) => <span className="fw-bold text-success fs-6">₹{row.totalNetSalary.toLocaleString()}</span>
          },
          {
            header: 'Disbursement Status',
            accessor: (row) => (
              <span className={`badge ${row.status === 'PAID' ? 'bg-success' : 'bg-warning text-dark'}`}>
                {row.status}
              </span>
            )
          }
        ]}
        data={payrollRuns}
        searchPlaceholder="Search payroll code..."
        actions={(row) => (
          <>
            <button
              className="btn btn-outline-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
              onClick={() => handleViewPayslips(row)}
              title="View Payslips"
            >
              <Eye size={14} /> Payslips
            </button>
            {row.status === 'PENDING' && can('payroll.approve') && (
              <button
                className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={() => handleApproveDisburse(row.id)}
                title="Approve & Disburse"
              >
                <CheckCircle2 size={14} /> Disburse
              </button>
            )}
          </>
        )}
      />

      {/* PAYSLIPS DRAWER / SECTION */}
      {selectedRun && (
        <div className="card shadow-sm border-0 mt-2">
          <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="fw-bold mb-0 text-dark">
              Employee Payslips for {selectedRun.payrollCode} (Net: ₹{selectedRun.totalNetSalary.toLocaleString()})
            </h6>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedRun(null)}>
              Close
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Employee Name</th>
                  <th>Present Days</th>
                  <th>Basic Salary</th>
                  <th>Allowances</th>
                  <th>Deductions (PF/PT)</th>
                  <th>Net Disbursed</th>
                  <th>Status</th>
                  <th className="text-end">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map(ps => (
                  <tr key={ps.id}>
                    <td className="fw-bold">{ps.employeeName}</td>
                    <td>{ps.presentDays} Days</td>
                    <td>₹{ps.basicSalary.toLocaleString()}</td>
                    <td>₹{ps.allowances.toLocaleString()}</td>
                    <td className="text-danger">-₹{ps.deductions.toLocaleString()}</td>
                    <td className="fw-bold text-success">₹{ps.netSalary.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${ps.paymentStatus === 'PAID' ? 'bg-success' : 'bg-secondary'}`}>
                        {ps.paymentStatus}
                      </span>
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-outline-primary btn-sm p-1"
                        onClick={() => setSelectedPayslip(ps)}
                        title="View Detailed Payslip"
                      >
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROCESS PAYROLL MODAL */}
      <Modal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        title="Execute Monthly Payroll Calculation"
      >
        <form onSubmit={handleProcessPayroll} className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-1">
            Compute gross-to-net salaries for all active restaurant staff based on monthly attendance records, leave balances, and overtime hours:
          </p>
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Month</label>
              <select className="form-select" value={processMonth} onChange={e => setProcessMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })} ({m})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Year</label>
              <input type="number" className="form-control" value={processYear} onChange={e => setProcessYear(Number(e.target.value))} />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsProcessModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Calculate Payroll</button>
          </div>
        </form>
      </Modal>

      {/* DETAILED PAYSLIP PRINT MODAL */}
      <Modal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        title={`Salary Slip: ${selectedPayslip?.employeeName}`}
      >
        {selectedPayslip && (
          <div className="p-3 bg-white border rounded print-area">
            <div className="text-center border-bottom pb-2 mb-3">
              <h5 className="fw-bold mb-0">ROYAL HERITAGE RESTAURANT</h5>
              <p className="small text-muted mb-0">Employee Monthly Pay Slip</p>
              <span className="badge bg-light text-dark border mt-1">
                Month: {selectedPayslip.month}/{selectedPayslip.year}
              </span>
            </div>

            <div className="d-flex justify-content-between small mb-3">
              <div>
                <strong>Employee:</strong> {selectedPayslip.employeeName}
              </div>
              <div className="text-end">
                <strong>Present Days:</strong> {selectedPayslip.presentDays} / 30
              </div>
            </div>

            <table className="table table-sm table-bordered small mb-3">
              <thead className="table-light">
                <tr>
                  <th>Earnings</th>
                  <th className="text-end">Amount</th>
                  <th>Deductions</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Basic Salary</td>
                  <td className="text-end">₹{selectedPayslip.basicSalary}</td>
                  <td>Provident Fund / PT</td>
                  <td className="text-end">₹{selectedPayslip.deductions}</td>
                </tr>
                <tr>
                  <td>HRA & Allowances</td>
                  <td className="text-end">₹{selectedPayslip.allowances}</td>
                  <td>Unpaid Leaves</td>
                  <td className="text-end">₹0</td>
                </tr>
                <tr className="table-light fw-bold">
                  <td>Gross Earnings</td>
                  <td className="text-end">₹{selectedPayslip.grossSalary}</td>
                  <td>Total Deductions</td>
                  <td className="text-end text-danger">-₹{selectedPayslip.deductions}</td>
                </tr>
              </tbody>
            </table>

            <div className="p-2 bg-success-subtle text-success-emphasis rounded border border-success-subtle d-flex justify-content-between align-items-center">
              <span className="fw-bold">Net Salary Paid:</span>
              <span className="fs-4 fw-bold">₹{selectedPayslip.netSalary.toLocaleString()}</span>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4 pt-2 border-top no-print">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPayslip(null)}>Close</button>
              <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => window.print()}>
                <Printer size={16} /> Print Payslip
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
