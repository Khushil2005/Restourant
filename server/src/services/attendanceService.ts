import { AttendanceRecord, Employee } from '../models/HR';
import { v4 as uuidv4 } from 'uuid';

export class AttendanceService {
  static async getAttendance(query: any = {}) {
    const filter: any = {};
    if (query.date) filter.date = query.date;
    if (query.employeeId) filter.employeeId = query.employeeId;
    return AttendanceRecord.find(filter).sort({ date: -1 });
  }

  static async recordPunch(employeeId: string, punchType: 'IN' | 'OUT') {
    const today = new Date().toISOString().split('T')[0];
    const employee = await Employee.findOne({ id: employeeId });
    if (!employee) throw { statusCode: 404, message: 'Employee not found.' };

    let record = await AttendanceRecord.findOne({ employeeId, date: today });

    if (!record) {
      record = await AttendanceRecord.create({
        id: `att_${uuidv4().slice(0, 8)}`,
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        date: today,
        checkInTime: new Date(),
        status: 'PRESENT',
        isApproved: true
      });
    } else {
      if (punchType === 'OUT') {
        record.checkOutTime = new Date();
        if (record.checkInTime) {
          const diffMs = record.checkOutTime.getTime() - record.checkInTime.getTime();
          record.totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
          if (record.totalHours < 4) record.status = 'HALF_DAY';
          else if (record.totalHours > 9) record.status = 'OVERTIME';
        }
        await record.save();
      }
    }

    return record;
  }

  static async manualAttendance(data: any, userId?: string) {
    const employee = await Employee.findOne({ id: data.employeeId });
    if (!employee) throw { statusCode: 404, message: 'Employee not found.' };

    const record = await AttendanceRecord.findOneAndUpdate(
      { employeeId: data.employeeId, date: data.date },
      {
        $set: {
          id: data.id || `att_${uuidv4().slice(0, 8)}`,
          employeeId: data.employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          date: data.date,
          status: data.status || 'PRESENT',
          totalHours: data.totalHours || 8,
          isApproved: true,
          approvedBy: userId,
          notes: data.notes
        }
      },
      { upsert: true, new: true }
    );

    return record;
  }

  static async getMonthlySummary(month: number, year: number) {
    const padMonth = String(month).padStart(2, '0');
    const regex = new RegExp(`^${year}-${padMonth}-`);
    const records = await AttendanceRecord.find({ date: { $regex: regex } });
    const employees = await Employee.find({ status: 'ACTIVE' });

    const summary = employees.map(emp => {
      const empRecords = records.filter(r => r.employeeId === emp.id);
      const presentDays = empRecords.filter(r => r.status === 'PRESENT' || r.status === 'OVERTIME').length;
      const halfDays = empRecords.filter(r => r.status === 'HALF_DAY').length;
      const totalHours = empRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
      const overtimeHours = empRecords.reduce((sum, r) => sum + Math.max(0, (r.totalHours || 0) - 8), 0);

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: emp.departmentName,
        totalPresent: presentDays + (halfDays * 0.5),
        totalHalfDays: halfDays,
        totalHours: Math.round(totalHours),
        overtimeHours: Math.round(overtimeHours)
      };
    });

    return summary;
  }
}
