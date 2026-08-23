import { Router, Response } from 'express';
import { EmployeeService } from '../services/employeeService';
import { AttendanceService } from '../services/attendanceService';
import { LeaveService } from '../services/leaveService';
import { PayrollService } from '../services/payrollService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const hrRouter = Router();

// --- EMPLOYEES ---
hrRouter.get('/employees', authenticate, authorize('employee.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await EmployeeService.getEmployees();
    return ApiResponse.success(res, employees, 'Employees retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

hrRouter.get('/employees/:id', authenticate, authorize('employee.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await EmployeeService.getEmployeeById(req.params.id);
    return ApiResponse.success(res, data, 'Employee details loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 404);
  }
});

hrRouter.post('/employees', authenticate, authorize('employee.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await EmployeeService.createEmployee(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Employee registered.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

hrRouter.put('/employees/:id', authenticate, authorize('employee.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emp = await EmployeeService.updateEmployee(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, emp, 'Employee updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

hrRouter.delete('/employees/:id', authenticate, authorize('employee.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await EmployeeService.deleteEmployee(req.params.id);
    return ApiResponse.success(res, null, 'Employee deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- ATTENDANCE ---
hrRouter.get('/attendance', authenticate, authorize('attendance.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await AttendanceService.getAttendance(req.query);
    return ApiResponse.success(res, logs, 'Attendance logs loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

hrRouter.post('/attendance/punch', authenticate, authorize('attendance.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const punch = await AttendanceService.recordPunch(req.body.employeeId, req.body.type || 'IN');
    return ApiResponse.success(res, punch, 'Punch recorded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

hrRouter.post('/attendance/manual', authenticate, authorize('attendance.correction'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await AttendanceService.manualAttendance(req.body, req.user!.userId);
    return ApiResponse.success(res, record, 'Attendance updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

hrRouter.get('/attendance/monthly-summary', authenticate, authorize('attendance.report'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const year = Number(req.query.year) || new Date().getFullYear();
    const summary = await AttendanceService.getMonthlySummary(month, year);
    return ApiResponse.success(res, summary, 'Monthly attendance summary loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- LEAVES ---
hrRouter.get('/leaves', authenticate, authorize('leave.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const leaves = await LeaveService.getLeaveRequests(req.query);
    return ApiResponse.success(res, leaves, 'Leaves retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

hrRouter.post('/leaves', authenticate, authorize('leave.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqLeave = await LeaveService.submitLeaveRequest(req.body);
    return ApiResponse.success(res, reqLeave, 'Leave application submitted.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

hrRouter.patch('/leaves/:id/status', authenticate, authorize(['leave.approve', 'leave.reject']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const leave = await LeaveService.updateLeaveStatus(req.params.id, req.body.status, req.body.rejectionReason, req.user!.userId);
    return ApiResponse.success(res, leave, `Leave marked as ${req.body.status}.`);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// --- PAYROLL ---
hrRouter.get('/payroll/runs', authenticate, authorize('payroll.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const runs = await PayrollService.getPayrollRuns();
    return ApiResponse.success(res, runs, 'Payroll runs loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

hrRouter.get('/payroll/runs/:id/payslips', authenticate, authorize('payroll.payslip'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const slips = await PayrollService.getPayslips(req.params.id);
    return ApiResponse.success(res, slips, 'Payslips loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

hrRouter.post('/payroll/process', authenticate, authorize('payroll.process'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { month, year } = req.body;
    const result = await PayrollService.processPayroll(Number(month), Number(year), req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Payroll calculated and payslips generated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

hrRouter.post('/payroll/runs/:id/approve', authenticate, authorize('payroll.approve'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const run = await PayrollService.approveAndDisburse(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, run, 'Payroll approved, disbursed and posted to Accounts.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});
