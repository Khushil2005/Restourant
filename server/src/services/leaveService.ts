import { LeaveRequest, Employee } from '../models/HR';
import { v4 as uuidv4 } from 'uuid';

export class LeaveService {
  static async getLeaveRequests(query: any = {}) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.employeeId) filter.employeeId = query.employeeId;
    return LeaveRequest.find(filter).sort({ createdAt: -1 });
  }

  static async submitLeaveRequest(data: any) {
    const employee = await Employee.findOne({ id: data.employeeId });
    if (!employee) throw { statusCode: 404, message: 'Employee not found.' };

    const id = `lv_${uuidv4().slice(0, 8)}`;
    return LeaveRequest.create({
      ...data,
      id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      status: 'PENDING'
    });
  }

  static async updateLeaveStatus(id: string, status: 'APPROVED' | 'REJECTED', reason?: string, userId?: string) {
    const leave = await LeaveRequest.findOneAndUpdate(
      { id },
      { $set: { status, rejectionReason: reason, approvedBy: userId } },
      { new: true }
    );
    return leave;
  }
}
