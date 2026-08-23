import { Schema, model, Document } from 'mongoose';

// Employee
export interface IEmployee extends Document {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationTitle?: string;
  userId?: string;
  joiningDate: string;
  salaryType: 'MONTHLY' | 'HOURLY' | 'DAILY';
  baseSalary: number;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  panNo?: string;
  aadhaarNo?: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
  createdAt: Date;
  updatedAt: Date;
}
const EmployeeSchema = new Schema<IEmployee>({
  id: { type: String, required: true, unique: true },
  employeeCode: { type: String, required: true, unique: true, index: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  departmentId: { type: String, ref: 'Department' },
  departmentName: { type: String },
  designationId: { type: String, ref: 'Designation' },
  designationTitle: { type: String },
  userId: { type: String, ref: 'User' },
  joiningDate: { type: String, required: true },
  salaryType: { type: String, default: 'MONTHLY' },
  baseSalary: { type: Number, default: 0 },
  bankName: { type: String },
  bankAccountNo: { type: String },
  bankIfsc: { type: String },
  panNo: { type: String },
  aadhaarNo: { type: String },
  status: { type: String, default: 'ACTIVE' }
}, { timestamps: true });

// Attendance Record
export interface IAttendanceRecord extends Document {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string; // YYYY-MM-DD
  checkInTime?: Date;
  checkOutTime?: Date;
  totalHours: number;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'LATE' | 'OVERTIME';
  isApproved: boolean;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true, ref: 'Employee', index: true },
  employeeName: { type: String },
  date: { type: String, required: true, index: true },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  totalHours: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'LATE', 'OVERTIME'],
    default: 'PRESENT'
  },
  isApproved: { type: Boolean, default: true },
  approvedBy: { type: String, ref: 'User' },
  notes: { type: String }
}, { timestamps: true });

// Leave Request
export interface ILeaveRequest extends Document {
  id: string;
  employeeId: string;
  employeeName?: string;
  leaveType: 'CASUAL' | 'SICK' | 'PAID' | 'UNPAID' | 'EMERGENCY';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
const LeaveRequestSchema = new Schema<ILeaveRequest>({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true, ref: 'Employee' },
  employeeName: { type: String },
  leaveType: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  totalDays: { type: Number, default: 1 },
  reason: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
  approvedBy: { type: String, ref: 'User' },
  rejectionReason: { type: String }
}, { timestamps: true });

// Salary Structure
export interface ISalaryStructure extends Document {
  id: string;
  employeeId: string;
  baseSalary: number;
  hra: number;
  conveyance: number;
  medicalAllowance: number;
  specialAllowance: number;
  providentFund: number;
  professionalTax: number;
  tds: number;
  createdAt: Date;
  updatedAt: Date;
}
const SalaryStructureSchema = new Schema<ISalaryStructure>({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true, unique: true, ref: 'Employee' },
  baseSalary: { type: Number, required: true },
  hra: { type: Number, default: 0 },
  conveyance: { type: Number, default: 0 },
  medicalAllowance: { type: Number, default: 0 },
  specialAllowance: { type: Number, default: 0 },
  providentFund: { type: Number, default: 0 },
  professionalTax: { type: Number, default: 0 },
  tds: { type: Number, default: 0 }
}, { timestamps: true });

// Payroll Run & Payslip
export interface IPayrollRun extends Document {
  id: string;
  payrollCode: string;
  month: number;
  year: number;
  totalGrossSalary: number;
  totalDeductions: number;
  totalNetSalary: number;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID';
  processedBy?: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
const PayrollRunSchema = new Schema<IPayrollRun>({
  id: { type: String, required: true, unique: true },
  payrollCode: { type: String, required: true, unique: true, index: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  totalGrossSalary: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  totalNetSalary: { type: Number, default: 0 },
  status: { type: String, enum: ['DRAFT', 'PENDING', 'APPROVED', 'PAID'], default: 'PENDING' },
  processedBy: { type: String, ref: 'User' },
  approvedBy: { type: String, ref: 'User' }
}, { timestamps: true });

export interface IPayslip extends Document {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName?: string;
  month: number;
  year: number;
  presentDays: number;
  paidLeaves: number;
  unpaidLeaves: number;
  overtimeHours: number;
  overtimePay: number;
  bonus: number;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  paymentStatus: 'UNPAID' | 'PAID';
  paymentDate?: string;
  createdAt: Date;
}
const PayslipSchema = new Schema<IPayslip>({
  id: { type: String, required: true, unique: true },
  payrollRunId: { type: String, required: true, ref: 'PayrollRun' },
  employeeId: { type: String, required: true, ref: 'Employee' },
  employeeName: { type: String },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  presentDays: { type: Number, default: 30 },
  paidLeaves: { type: Number, default: 0 },
  unpaidLeaves: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  basicSalary: { type: Number, required: true },
  allowances: { type: Number, default: 0 },
  grossSalary: { type: Number, required: true },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['UNPAID', 'PAID'], default: 'UNPAID' },
  paymentDate: { type: String }
}, { timestamps: true });

export const Employee = model<IEmployee>('Employee', EmployeeSchema);
export const AttendanceRecord = model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
export const LeaveRequest = model<ILeaveRequest>('LeaveRequest', LeaveRequestSchema);
export const SalaryStructure = model<ISalaryStructure>('SalaryStructure', SalaryStructureSchema);
export const PayrollRun = model<IPayrollRun>('PayrollRun', PayrollRunSchema);
export const Payslip = model<IPayslip>('Payslip', PayslipSchema);
