import mongoose from 'mongoose';
import { Customer, Supplier, Department, Designation, Unit, TaxMaster, MenuCategory, MenuItem, DiningTable, FloorZone } from '../models/Master';
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
    const name = (data.name || '').trim();
    if (!name) {
      throw new Error('Category name is required');
    }
    const code = data.code && data.code.trim()
      ? data.code.trim().toUpperCase()
      : name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
    const displayOrder = Number(data.displayOrder ?? data.sortOrder ?? 0);
    const cat = await MenuCategory.create({
      ...data,
      id,
      name,
      code,
      displayOrder,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
    });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'MenuCategory',
      action: 'CREATE',
      recordId: id,
      newValue: cat
    });
    return cat;
  }

  static async updateMenuCategory(id: string, data: any, userId?: string, username?: string) {
    const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
    const old = await MenuCategory.findOne(query);
    if (!old) {
      throw new Error('Menu category not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.code !== undefined && data.code.trim()) {
      updateData.code = data.code.trim().toUpperCase();
    }
    if (data.description !== undefined) {
      updateData.description = data.description.trim();
    }
    if (data.displayOrder !== undefined) {
      updateData.displayOrder = Number(data.displayOrder);
    }
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = Boolean(data.isActive);
    }

    const updated = await MenuCategory.findOneAndUpdate(query, { $set: updateData }, { new: true });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'MenuCategory',
      action: 'EDIT',
      recordId: id,
      oldValue: old,
      newValue: updated
    });
    return updated;
  }

  static async deleteMenuCategory(id: string, userId?: string, username?: string) {
    const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
    const old = await MenuCategory.findOne(query);
    if (!old) {
      throw new Error('Menu category not found');
    }
    await MenuItem.deleteMany({ categoryId: old.id });
    await MenuCategory.deleteOne(query);
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'MenuCategory',
      action: 'DELETE',
      recordId: id,
      oldValue: old
    });
    return { success: true };
  }

  static async getMenuItems(categoryId?: string) {
    const filter = categoryId ? { categoryId } : {};
    return MenuItem.find(filter).sort({ displayOrder: 1 });
  }

  static async createMenuItem(data: any, userId?: string, username?: string) {
    const id = data.id || `item_${uuidv4().slice(0, 8)}`;
    const code = data.code || (data.name ? data.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20) : id.toUpperCase());
    const displayOrder = Number(data.displayOrder ?? data.sortOrder ?? 0);
    const item = await MenuItem.create({
      ...data,
      id,
      code,
      displayOrder
    });
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

  // --- FLOOR ZONES ---
  static async getFloorZones() {
    const zones = await FloorZone.find().sort({ displayOrder: 1, name: 1 });
    const tables = await DiningTable.find();
    return zones.map(z => {
      const count = tables.filter(t => t.floorZone === z.code).length;
      return {
        ...z.toObject(),
        tableCount: count
      };
    });
  }

  static async createFloorZone(data: any, userId?: string, username?: string) {
    let code = (data.code || data.name || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (!code) {
      code = `ZONE_${uuidv4().slice(0, 6).toUpperCase()}`;
    }
    const existing = await FloorZone.findOne({ $or: [{ code }, { name: data.name?.trim() }] });
    if (existing) {
      throw new Error(`Floor Zone with name "${data.name}" or code "${code}" already exists.`);
    }

    const id = data.id || `zone_${uuidv4().slice(0, 8)}`;
    const zone = await FloorZone.create({
      ...data,
      id,
      name: data.name?.trim(),
      code,
      description: data.description?.trim(),
      color: data.color || '#6366f1',
      displayOrder: Number(data.displayOrder || 0),
      isActive: data.isActive !== false
    });

    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'FloorZone',
      action: 'CREATE',
      recordId: id,
      newValue: zone
    });
    return zone;
  }

  static async updateFloorZone(id: string, data: any, userId?: string, username?: string) {
    const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
    const old = await FloorZone.findOne(query);
    if (!old) {
      throw new Error('Floor Zone not found.');
    }

    let updateData: any = { ...data };
    if (data.name) {
      updateData.name = data.name.trim();
    }
    if (data.code && data.code.trim().toUpperCase() !== old.code) {
      const code = data.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const conflict = await FloorZone.findOne({ code, id: { $ne: old.id } });
      if (conflict) {
        throw new Error(`Zone code "${code}" is already in use.`);
      }
      updateData.code = code;
      // Also update any tables with old code to new code!
      await DiningTable.updateMany({ floorZone: old.code }, { $set: { floorZone: code } });
    }

    if (data.displayOrder !== undefined) {
      updateData.displayOrder = Number(data.displayOrder);
    }

    const updated = await FloorZone.findOneAndUpdate(query, { $set: updateData }, { new: true });
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'FloorZone',
      action: 'EDIT',
      recordId: id,
      oldValue: old,
      newValue: updated
    });
    return updated;
  }

  static async deleteFloorZone(id: string, userId?: string, username?: string) {
    const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
    const old = await FloorZone.findOne(query);
    if (!old) {
      throw new Error('Floor Zone not found.');
    }

    // Automatically reassign any assigned tables to an active fallback zone so tables are never blocked or orphaned
    const fallbackZone = await FloorZone.findOne({ code: { $ne: old.code }, isActive: true }).sort({ displayOrder: 1 });
    const fallbackCode = fallbackZone ? fallbackZone.code : 'MAIN_HALL';

    await DiningTable.updateMany(
      { floorZone: old.code },
      { $set: { floorZone: fallbackCode } }
    );

    await FloorZone.deleteOne(query);
    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'FloorZone',
      action: 'DELETE',
      recordId: id,
      oldValue: old
    });
    return { success: true };
  }

  // --- DEPARTMENTS, DESIGNATIONS, UNITS, TAXES ---
  static async getDepartments() { return Department.find(); }
  static async getDesignations() { return Designation.find(); }
  static async getUnits() { return Unit.find(); }
  static async getTaxMasters() { return TaxMaster.find(); }
}
