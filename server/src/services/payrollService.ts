import { PayrollRun, Payslip, Employee, SalaryStructure, AttendanceRecord, LeaveRequest } from '../models/HR';
import { ChartOfAccount, JournalEntry } from '../models/Account';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class PayrollService {
  static async getPayrollRuns() {
    return PayrollRun.find().sort({ year: -1, month: -1 });
  }

  static async getPayslips(payrollRunId: string) {
    return Payslip.find({ payrollRunId }).sort({ employeeName: 1 });
  }

  static async processPayroll(month: number, year: number, userId?: string, username?: string) {
    const padMonth = String(month).padStart(2, '0');
    const payrollCode = `PR-${year}-${padMonth}`;

    const employees = await Employee.find({ status: 'ACTIVE' });
    const salaryStructures = await SalaryStructure.find();
    
    const attRegex = new RegExp(`^${year}-${padMonth}-`);
    const attendanceRecords = await AttendanceRecord.find({ date: { $regex: attRegex } });

    let totalGrossSalary = 0;
    let totalDeductions = 0;
    let totalNetSalary = 0;

    const payrollRunId = `prun_${uuidv4().slice(0, 8)}`;
    const payslipsData = [];

    for (const emp of employees) {
      const salStruct = salaryStructures.find(s => s.employeeId === emp.id);
      const empAtt = attendanceRecords.filter(a => a.employeeId === emp.id);
      
      const presentCount = empAtt.filter(a => a.status === 'PRESENT' || a.status === 'OVERTIME').length;
      const halfDays = empAtt.filter(a => a.status === 'HALF_DAY').length;
      const effectiveDays = presentCount + (halfDays * 0.5);
      const presentDays = effectiveDays > 0 ? effectiveDays : 30; // fallback standard 30

      const overtimeHours = empAtt.reduce((sum, a) => sum + Math.max(0, (a.totalHours || 0) - 8), 0);
      const hourlyRate = (emp.baseSalary || 30000) / (30 * 8);
      const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);

      const basicSalary = salStruct ? salStruct.baseSalary : (emp.baseSalary * 0.5);
      const allowances = salStruct 
        ? (salStruct.hra + salStruct.conveyance + salStruct.medicalAllowance + salStruct.specialAllowance)
        : (emp.baseSalary * 0.5);

      const deductions = salStruct 
        ? (salStruct.providentFund + salStruct.professionalTax + salStruct.tds)
        : (emp.baseSalary * 0.08);

      const grossSalary = Math.round(((basicSalary + allowances) / 30) * presentDays + overtimePay);
      const netSalary = Math.max(0, grossSalary - Math.round(deductions));

      totalGrossSalary += grossSalary;
      totalDeductions += deductions;
      totalNetSalary += netSalary;

      payslipsData.push({
        id: `pslip_${uuidv4().slice(0, 8)}`,
        payrollRunId,
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        month,
        year,
        presentDays,
        paidLeaves: 0,
        unpaidLeaves: Math.max(0, 30 - presentDays),
        overtimeHours,
        overtimePay,
        bonus: 0,
        basicSalary,
        allowances,
        grossSalary,
        deductions,
        netSalary,
        paymentStatus: 'UNPAID'
      });
    }

    const payrollRun = await PayrollRun.findOneAndUpdate(
      { payrollCode },
      {
        $set: {
          id: payrollRunId,
          payrollCode,
          month,
          year,
          totalGrossSalary,
          totalDeductions,
          totalNetSalary,
          status: 'PENDING',
          processedBy: userId
        }
      },
      { upsert: true, new: true }
    );

    // Save payslips
    await Payslip.deleteMany({ payrollRunId: payrollRun.id });
    await Payslip.insertMany(payslipsData.map(p => ({ ...p, payrollRunId: payrollRun.id })));

    await createAuditLog({
      userId,
      username,
      module: 'Payroll',
      submodule: 'Processing',
      action: 'PROCESS_PAYROLL',
      recordId: payrollRun.id,
      newValue: { month, year, totalNetSalary, employeeCount: employees.length }
    });

    return { payrollRun, payslips: payslipsData };
  }

  static async approveAndDisburse(payrollRunId: string, userId?: string, username?: string) {
    const payrollRun = await PayrollRun.findOne({ id: payrollRunId });
    if (!payrollRun) throw { statusCode: 404, message: 'Payroll run not found.' };

    payrollRun.status = 'PAID';
    payrollRun.approvedBy = userId;
    await payrollRun.save();

    await Payslip.updateMany(
      { payrollRunId: payrollRun.id },
      { $set: { paymentStatus: 'PAID', paymentDate: new Date().toISOString().split('T')[0] } }
    );

    // AUTOMATIC JOURNAL POSTING TO ACCOUNTS
    try {
      const jrnCount = await JournalEntry.countDocuments();
      const entryNumber = `JRN-${new Date().getFullYear()}-${String(jrnCount + 1).padStart(4, '0')}`;
      
      const salaryExpAcc = await ChartOfAccount.findOne({ $or: [{ id: 'acc_exp_salaries' }, { subType: 'INDIRECT_EXPENSE' }] });
      const bankAcc = await ChartOfAccount.findOne({ $or: [{ id: 'acc_bank_sbi' }, { id: 'acc_bank_hdfc' }, { subType: 'BANK' }] });

      if (salaryExpAcc && bankAcc) {
        salaryExpAcc.currentBalance += payrollRun.totalNetSalary;
        bankAcc.currentBalance -= payrollRun.totalNetSalary;
        await Promise.all([salaryExpAcc.save(), bankAcc.save()]);

        await JournalEntry.create({
          id: `jrn_${uuidv4().slice(0, 8)}`,
          entryNumber,
          entryDate: new Date().toISOString().split('T')[0],
          referenceType: 'PAYROLL',
          referenceId: payrollRun.payrollCode,
          narration: `Monthly staff salary disbursement for ${payrollRun.payrollCode}`,
          totalDebit: payrollRun.totalNetSalary,
          totalCredit: payrollRun.totalNetSalary,
          status: 'POSTED',
          createdBy: userId,
          items: [
            {
              id: uuidv4(),
              accountId: salaryExpAcc.id,
              accountName: salaryExpAcc.accountName,
              debit: payrollRun.totalNetSalary,
              credit: 0,
              description: `Staff wage expense for ${payrollRun.payrollCode}`
            },
            {
              id: uuidv4(),
              accountId: bankAcc.id,
              accountName: bankAcc.accountName,
              debit: 0,
              credit: payrollRun.totalNetSalary,
              description: `Direct bank salary transfer from ${bankAcc.accountName}`
            }
          ]
        });
      }
    } catch (jErr) {
      console.error('[Payroll Auto Journal Error]:', jErr);
    }

    await createAuditLog({
      userId,
      username,
      module: 'Payroll',
      submodule: 'Processing',
      action: 'APPROVE_PAYROLL',
      recordId: payrollRun.id,
      newValue: { status: 'PAID' }
    });

    return payrollRun;
  }
}
