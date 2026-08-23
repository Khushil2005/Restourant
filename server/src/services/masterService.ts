import { Customer, Supplier, Department, Designation, Unit, TaxMaster, MenuCategory, MenuItem, DiningTable } from '../models/Master';
import { Order } from '../models/Order';
import { Booking } from '../models/Booking';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class MasterService {
  // --- CUSTOMERS ---
  static async getCustomers(query: any = {}) {
    const filter: any = {};
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } }
      ];
    }
    return Customer.find(filter).sort({ name: 1 });
  }

  static async createCustomer(data: any, userId?: string, username?: string) {
    const id = data.id || `cust_${uuidv4().slice(0, 8)}`;
    const customer = await Customer.create({ ...data, id });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Customer',
      action: 'CREATE',
      recordId: id,
      newValue: customer
    });
    return customer;
  }

  static async updateCustomer(id: string, data: any, userId?: string, username?: string) {
    const old = await Customer.findOne({ id });
    const updated = await Customer.findOneAndUpdate({ id }, { $set: data }, { new: true });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Customer',
      action: 'EDIT',
      recordId: id,
      oldValue: old,
      newValue: updated
    });
    return updated;
  }

  static async deleteCustomer(id: string, userId?: string, username?: string) {
    const old = await Customer.findOne({ id });
    await Customer.deleteOne({ id });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Customer',
      action: 'DELETE',
      recordId: id,
      oldValue: old
    });
    return { success: true };
  }

  static async getCustomerHistory(id: string) {
    const [customer, orders, bookings] = await Promise.all([
      Customer.findOne({ id }),
      Order.find({ customerId: id }).sort({ createdAt: -1 }),
      Booking.find({ customerId: id }).sort({ bookingDate: -1 })
    ]);
    return { customer, orders, bookings };
  }

  // --- SUPPLIERS ---
  static async getSuppliers() {
    return Supplier.find().sort({ companyName: 1 });
  }

  static async createSupplier(data: any, userId?: string, username?: string) {
    const id = data.id || `sup_${uuidv4().slice(0, 8)}`;
    const supplier = await Supplier.create({ ...data, id });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Supplier',
      action: 'CREATE',
      recordId: id,
      newValue: supplier
    });
    return supplier;
  }

  static async updateSupplier(id: string, data: any, userId?: string, username?: string) {
    const old = await Supplier.findOne({ id });
    const updated = await Supplier.findOneAndUpdate({ id }, { $set: data }, { new: true });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Supplier',
      action: 'EDIT',
      recordId: id,
      oldValue: old,
      newValue: updated
    });
    return updated;
  }

  static async deleteSupplier(id: string, userId?: string, username?: string) {
    const old = await Supplier.findOne({ id });
    await Supplier.deleteOne({ id });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Supplier',
      action: 'DELETE',
      recordId: id,
      oldValue: old
    });
    return { success: true };
  }

  // --- MENU CATEGORIES & ITEMS ---
  static async getMenuCategories() {
    return MenuCategory.find().sort({ displayOrder: 1 });
  }

  static async createMenuCategory(data: any, userId?: string, username?: string) {
    const id = data.id || `cat_${uuidv4().slice(0, 8)}`;
    const cat = await MenuCategory.create({ ...data, id });
    return cat;
  }

  static async updateMenuCategory(id: string, data: any) {
    return MenuCategory.findOneAndUpdate({ id }, { $set: data }, { new: true });
  }

  static async deleteMenuCategory(id: string) {
    await MenuItem.deleteMany({ categoryId: id });
    return MenuCategory.deleteOne({ id });
  }

  static async getMenuItems(categoryId?: string) {
    const filter = categoryId ? { categoryId } : {};
    return MenuItem.find(filter).sort({ displayOrder: 1 });
  }

  static async createMenuItem(data: any, userId?: string, username?: string) {
    const id = data.id || `item_${uuidv4().slice(0, 8)}`;
    const item = await MenuItem.create({ ...data, id });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Menu',
      action: 'CREATE',
      recordId: id,
      newValue: item
    });
    return item;
  }

  static async updateMenuItem(id: string, data: any, userId?: string, username?: string) {
    const old = await MenuItem.findOne({ id });
    const updated = await MenuItem.findOneAndUpdate({ id }, { $set: data }, { new: true });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Menu',
      action: 'EDIT',
      recordId: id,
      oldValue: old,
      newValue: updated
    });
    return updated;
  }

  static async toggleMenuItemAvailability(id: string, isAvailable: boolean) {
    return MenuItem.findOneAndUpdate({ id }, { $set: { isAvailable } }, { new: true });
  }

  static async deleteMenuItem(id: string, userId?: string, username?: string) {
    const old = await MenuItem.findOne({ id });
    await MenuItem.deleteOne({ id });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Menu',
      action: 'DELETE',
      recordId: id,
      oldValue: old
    });
    return { success: true };
  }

  // --- TABLES ---
  static async getTables() {
    return DiningTable.find().sort({ tableNumber: 1 });
  }

  static async createTable(data: any, userId?: string, username?: string) {
    const id = data.id || `tbl_${uuidv4().slice(0, 8)}`;
    const table = await DiningTable.create({ ...data, id });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Table',
      action: 'CREATE',
      recordId: id,
      newValue: table
    });
    return table;
  }

  static async updateTable(id: string, data: any, userId?: string, username?: string) {
    const old = await DiningTable.findOne({ id });
    const updated = await DiningTable.findOneAndUpdate({ id }, { $set: data }, { new: true });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'Table',
      action: 'EDIT',
      recordId: id,
      oldValue: old,
      newValue: updated
    });
    return updated;
  }

  static async updateTableStatus(id: string, status: string) {
    return DiningTable.findOneAndUpdate({ id }, { $set: { status } }, { new: true });
  }

  static async deleteTable(id: string) {
    return DiningTable.deleteOne({ id });
  }

  // --- DEPARTMENTS, DESIGNATIONS, UNITS, TAXES ---
  static async getDepartments() { return Department.find(); }
  static async getDesignations() { return Designation.find(); }
  static async getUnits() { return Unit.find(); }
  static async getTaxMasters() { return TaxMaster.find(); }
}
