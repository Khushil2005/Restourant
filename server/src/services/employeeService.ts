import { Employee, SalaryStructure } from '../models/HR';
import { Department, Designation } from '../models/Master';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class EmployeeService {
  static async getEmployees() {
    return Employee.find().sort({ firstName: 1 });
  }

  static async getEmployeeById(id: string) {
    const [employee, salaryStructure] = await Promise.all([
      Employee.findOne({ id }),
      SalaryStructure.findOne({ employeeId: id })
    ]);
    if (!employee) throw { statusCode: 404, message: 'Employee not found.' };
    return { employee, salaryStructure };
  }

  static async createEmployee(data: any, userId?: string, username?: string) {
    const id = `emp_${uuidv4().slice(0, 8)}`;
    const count = await Employee.countDocuments();
    const employeeCode = `EMP-${String(count + 1).padStart(3, '0')}`;

    const dept = data.departmentId
      ? await Department.findOne({ $or: [{ id: data.departmentId }, { name: data.departmentId }, { code: data.departmentId }] })
      : (data.departmentName ? await Department.findOne({ $or: [{ id: data.departmentName }, { name: data.departmentName }, { code: data.departmentName }] }) : null);

    const desig = data.designationId
      ? await Designation.findOne({ $or: [{ id: data.designationId }, { title: data.designationId }] })
      : (data.designationTitle ? await Designation.findOne({ $or: [{ id: data.designationTitle }, { title: data.designationTitle }] }) : null);

    const departmentName = dept?.name || data.departmentName || 'General';
    const designationTitle = desig?.title || data.designationTitle || 'Staff';
    const departmentId = dept?.id || data.departmentId || undefined;
    const designationId = desig?.id || data.designationId || undefined;
    const joiningDate = data.joiningDate || data.hireDate || new Date().toISOString().split('T')[0];

    const employee = await Employee.create({
      ...data,
      id,
      employeeCode,
      departmentId,
      departmentName,
      designationId,
      designationTitle,
      joiningDate,
      status: data.status || 'ACTIVE'
    });

    const baseSalary = Number(data.baseSalary || 25000);
    const salaryStructure = await SalaryStructure.create({
      id: uuidv4(),
      employeeId: id,
      baseSalary: baseSalary * 0.5,
      hra: baseSalary * 0.2,
      conveyance: 2000,
      medicalAllowance: 1500,
      specialAllowance: baseSalary * 0.15,
      providentFund: baseSalary * 0.06,
      professionalTax: 200,
      tds: 0
    });

    await createAuditLog({
      userId,
      username,
      module: 'Employees',
      submodule: 'Staff',
      action: 'ONBOARD_EMPLOYEE',
      recordId: id,
      newValue: employee
    });

    return { employee, salaryStructure };
  }

  static async updateEmployee(id: string, data: any, userId?: string, username?: string) {
    const old = await Employee.findOne({ id });
    const dept = data.departmentId
      ? await Department.findOne({ $or: [{ id: data.departmentId }, { name: data.departmentId }, { code: data.departmentId }] })
      : (data.departmentName ? await Department.findOne({ $or: [{ id: data.departmentName }, { name: data.departmentName }, { code: data.departmentName }] }) : null);

    const desig = data.designationId
      ? await Designation.findOne({ $or: [{ id: data.designationId }, { title: data.designationId }] })
      : (data.designationTitle ? await Designation.findOne({ $or: [{ id: data.designationTitle }, { title: data.designationTitle }] }) : null);

    const updateSet: any = { ...data };
    if (dept?.name || data.departmentName) {
      updateSet.departmentName = dept?.name || data.departmentName;
      if (dept?.id) updateSet.departmentId = dept.id;
    }
    if (desig?.title || data.designationTitle) {
      updateSet.designationTitle = desig?.title || data.designationTitle;
      if (desig?.id) updateSet.designationId = desig.id;
    }
    if (data.hireDate && !data.joiningDate) {
      updateSet.joiningDate = data.hireDate;
    }

    const updated = await Employee.findOneAndUpdate(
      { id },
      { $set: updateSet },
      { new: true }
    );

    if (data.salaryStructure) {
      await SalaryStructure.findOneAndUpdate(
        { employeeId: id },
        { $set: data.salaryStructure },
        { upsert: true }
      );
    }

    await createAuditLog({
      userId,
      username,
      module: 'Employees',
      submodule: 'Staff',
      action: 'EDIT_EMPLOYEE',
      recordId: id,
      oldValue: old,
      newValue: updated
    });

    return updated;
  }

  static async deleteEmployee(id: string) {
    await SalaryStructure.deleteOne({ employeeId: id });
    return Employee.deleteOne({ id });
  }
}
