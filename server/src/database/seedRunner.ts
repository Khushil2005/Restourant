import { connectDatabase, disconnectDatabase } from '../config/database';
import { Permission, Role } from '../models/Role';
import { User } from '../models/User';
import { Department, Designation, Unit, TaxMaster, MenuCategory, MenuItem, DiningTable, Supplier, Customer } from '../models/Master';
import { InventoryItem, Recipe } from '../models/Inventory';
import { DiscountRule } from '../models/Discount';
import { ChartOfAccount } from '../models/Account';
import { Employee, SalaryStructure } from '../models/HR';
import { SystemSetting } from '../models/System';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '../constants/permissions';
import { hashPassword } from '../utils/password';
import { v4 as uuidv4 } from 'uuid';

export async function runDatabaseMigrationsAndSeeds(): Promise<void> {
  console.log('[MongoDB Seed] Initializing connection for seeding...');
  await connectDatabase();

  // 1. Seed Permissions (Instant bulkWrite)
  const permCount = await Permission.countDocuments();
  if (permCount < ALL_PERMISSIONS.length) {
    console.log(`[MongoDB Seed] Seeding ${ALL_PERMISSIONS.length} permissions in bulk...`);
    const permOps = ALL_PERMISSIONS.map(p => ({
      updateOne: { filter: { id: p.id }, update: { $set: p }, upsert: true }
    }));
    await Permission.bulkWrite(permOps);
  }

  // 2. Seed Roles and Role Permissions
  console.log(`[MongoDB Seed] Seeding ${DEFAULT_ROLES.length} role definitions...`);
  const roleOps = DEFAULT_ROLES.map(role => ({
    updateOne: {
      filter: { id: role.id },
      update: {
        $set: {
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.is_system,
          permissions: role.permissions
        }
      },
      upsert: true
    }
  }));
  await Role.bulkWrite(roleOps);

  // 3. Seed Demo Users
  const defaultUsers = [
    { id: 'usr_superadmin', username: 'superadmin', email: 'superadmin@erp.com', pass: 'Admin@12345', firstName: 'Super', lastName: 'Administrator', phone: '9999999991', roleId: 'role_super_admin' },
    { id: 'usr_admin', username: 'admin', email: 'admin@erp.com', pass: 'Admin@12345', firstName: 'System', lastName: 'Admin', phone: '9999999992', roleId: 'role_admin' },
    { id: 'usr_manager', username: 'manager', email: 'manager@erp.com', pass: 'Manager@12345', firstName: 'Restaurant', lastName: 'Manager', phone: '9999999993', roleId: 'role_manager' },
    { id: 'usr_cashier', username: 'cashier', email: 'cashier@erp.com', pass: 'Cashier@12345', firstName: 'Head', lastName: 'Cashier', phone: '9999999994', roleId: 'role_cashier' },
    { id: 'usr_waiter', username: 'waiter', email: 'waiter@erp.com', pass: 'Waiter@12345', firstName: 'Lead', lastName: 'Server', phone: '9999999995', roleId: 'role_waiter' },
    { id: 'usr_chef', username: 'chef', email: 'chef@erp.com', pass: 'Chef@12345', firstName: 'Executive', lastName: 'Chef', phone: '9999999996', roleId: 'role_kitchen' },
    { id: 'usr_inventory', username: 'inventory', email: 'inventory@erp.com', pass: 'Inventory@12345', firstName: 'Stores', lastName: 'Incharge', phone: '9999999997', roleId: 'role_inventory' },
    { id: 'usr_accountant', username: 'accountant', email: 'accountant@erp.com', pass: 'Accountant@12345', firstName: 'Chief', lastName: 'Accountant', phone: '9999999998', roleId: 'role_accountant' },
    { id: 'usr_hr', username: 'hr', email: 'hr@erp.com', pass: 'Hr@12345', firstName: 'HR', lastName: 'Specialist', phone: '9999999999', roleId: 'role_hr' },
    { id: 'usr_receptionist', username: 'receptionist', email: 'reception@erp.com', pass: 'Receptionist@12345', firstName: 'Hostess', lastName: 'Receptionist', phone: '9999999990', roleId: 'role_receptionist' }
  ];

  console.log(`[MongoDB Seed] Seeding demo users with hashed credentials...`);
  const userOps = [];
  for (const u of defaultUsers) {
    const passwordHash = await hashPassword(u.pass);
    userOps.push({
      updateOne: {
        filter: { $or: [{ id: u.id }, { username: u.username }] },
        update: {
          $set: {
            id: u.id,
            username: u.username,
            email: u.email,
            passwordHash,
            firstName: u.firstName,
            lastName: u.lastName,
            phone: u.phone,
            roleId: u.roleId,
            status: 'ACTIVE',
            permissionOverrides: []
          }
        },
        upsert: true
      }
    });
  }
  await User.bulkWrite(userOps as any);

  // 4. Seed Departments & Designations
  const departments = [
    { id: 'dept_mgmt', name: 'Management', code: 'MGMT', description: 'Executive & Restaurant Management' },
    { id: 'dept_service', name: 'Service & Front of House', code: 'FOH', description: 'Waiters, Captains & Hosts' },
    { id: 'dept_kitchen', name: 'Kitchen & Culinary', code: 'BOH', description: 'Chefs, Cooks & Kitchen Crew' },
    { id: 'dept_inventory', name: 'Inventory & Stores', code: 'INV', description: 'Storekeepers & Material Handling' },
    { id: 'dept_accounts', name: 'Accounts & Finance', code: 'ACC', description: 'Accountants & Cashiers' },
    { id: 'dept_hr', name: 'Human Resources', code: 'HR', description: 'HR & People Operations' }
  ];
  await Department.bulkWrite(departments.map(d => ({ updateOne: { filter: { id: d.id }, update: { $set: d }, upsert: true } })) as any);

  const designations = [
    { id: 'desig_gm', departmentId: 'dept_mgmt', title: 'General Manager' },
    { id: 'desig_rest_mgr', departmentId: 'dept_mgmt', title: 'Restaurant Manager' },
    { id: 'desig_head_chef', departmentId: 'dept_kitchen', title: 'Executive Chef' },
    { id: 'desig_line_cook', departmentId: 'dept_kitchen', title: 'Line Cook' },
    { id: 'desig_captain', departmentId: 'dept_service', title: 'Captain / Supervisor' },
    { id: 'desig_waiter', departmentId: 'dept_service', title: 'Senior Waiter' },
    { id: 'desig_hostess', departmentId: 'dept_service', title: 'Hostess / Receptionist' },
    { id: 'desig_cashier', departmentId: 'dept_accounts', title: 'Lead Cashier' },
    { id: 'desig_accountant', departmentId: 'dept_accounts', title: 'Senior Accountant' },
    { id: 'desig_inv_mgr', departmentId: 'dept_inventory', title: 'Inventory Incharge' },
    { id: 'desig_hr_exec', departmentId: 'dept_hr', title: 'HR Executive' }
  ];
  await Designation.bulkWrite(designations.map(des => ({ updateOne: { filter: { id: des.id }, update: { $set: des }, upsert: true } })) as any);

  // 5. Seed Units
  const units = [
    { id: 'unit_kg', name: 'Kilogram', symbol: 'kg' },
    { id: 'unit_gm', name: 'Gram', symbol: 'g' },
    { id: 'unit_ltr', name: 'Litre', symbol: 'L' },
    { id: 'unit_ml', name: 'Millilitre', symbol: 'ml' },
    { id: 'unit_pcs', name: 'Pieces', symbol: 'pcs' },
    { id: 'unit_portion', name: 'Portion', symbol: 'portion' },
    { id: 'unit_can', name: 'Can', symbol: 'can' }
  ];
  await Unit.bulkWrite(units.map(u => ({ updateOne: { filter: { id: u.id }, update: { $set: u }, upsert: true } })) as any);

  // 6. Seed Tax Masters
  const taxes = [
    { id: 'tax_zero', name: 'Zero GST (0%)', rate: 0.0, type: 'PERCENTAGE' },
    { id: 'tax_gst_5', name: 'Restaurant GST (5%)', rate: 5.0, type: 'PERCENTAGE' },
    { id: 'tax_gst_18', name: 'Standard GST (18%)', rate: 18.0, type: 'PERCENTAGE' }
  ];
  await TaxMaster.bulkWrite(taxes.map(t => ({ updateOne: { filter: { id: t.id }, update: { $set: t }, upsert: true } })) as any);

  // 7. Seed Menu Categories & Items (Clean Standard English Menu)
  const categories = [
    { id: 'cat_kathiyawadi', name: 'Kathiyawadi Curries', code: 'KATHI', displayOrder: 1 },
    { id: 'cat_rotla', name: 'Rotla & Traditional Breads', code: 'ROTLA', displayOrder: 2 },
    { id: 'cat_thali', name: 'Special Thali & Combos', code: 'THALI', displayOrder: 3 },
    { id: 'cat_farsan', name: 'Farsan & Starters', code: 'FARSAN', displayOrder: 4 },
    { id: 'cat_mithai', name: 'Traditional Sweets & Desserts', code: 'SWEETS', displayOrder: 5 },
    { id: 'cat_chaas_bev', name: 'Beverages & Chaas', code: 'BEV', displayOrder: 6 }
  ];
  await MenuCategory.bulkWrite(categories.map(c => ({ updateOne: { filter: { id: c.id }, update: { $set: c }, upsert: true } })) as any);

  const menuItems = [
    // 1. Kathiyawadi Curries
    { id: 'item_ringna_olo', categoryId: 'cat_kathiyawadi', name: 'Ringna No Olo with White Butter', code: 'KATHI-01', price: 220, costPrice: 75, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 15, displayOrder: 1 },
    { id: 'item_kaju_gathiya', categoryId: 'cat_kathiyawadi', name: 'Kaju Gathiya Nu Shaak', code: 'KATHI-02', price: 240, costPrice: 90, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 12, displayOrder: 2 },
    { id: 'item_sev_tameta', categoryId: 'cat_kathiyawadi', name: 'Kathiyawadi Sev Tameta Nu Shaak', code: 'KATHI-03', price: 180, costPrice: 55, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 10, displayOrder: 3 },
    { id: 'item_lasaniya_bataka', categoryId: 'cat_kathiyawadi', name: 'Lasaniya Bataka Spiced Curry', code: 'KATHI-04', price: 170, costPrice: 50, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 12, displayOrder: 4 },
    { id: 'item_bharela_bhinda', categoryId: 'cat_kathiyawadi', name: 'Kathiyawadi Bharela Bhinda', code: 'KATHI-05', price: 190, costPrice: 65, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 14, displayOrder: 5 },
    { id: 'item_dahi_tikhari', categoryId: 'cat_kathiyawadi', name: 'Rajwadi Dahi Tikhari', code: 'KATHI-06', price: 160, costPrice: 45, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 6 },
    { id: 'item_sev_dungri', categoryId: 'cat_kathiyawadi', name: 'Sev Dungri Nu Shaak', code: 'KATHI-07', price: 175, costPrice: 55, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 10, displayOrder: 7 },
    { id: 'item_sukhi_bhaji', categoryId: 'cat_kathiyawadi', name: 'Sukhi Bhaji (Batata Vagharela)', code: 'KATHI-08', price: 150, costPrice: 40, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 8 },
    { id: 'item_bharela_ringna', categoryId: 'cat_kathiyawadi', name: 'Bharela Ringna Bataka', code: 'KATHI-09', price: 195, costPrice: 60, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 15, displayOrder: 9 },

    // 2. Rotla & Traditional Breads
    { id: 'item_bajri_rotlo', categoryId: 'cat_rotla', name: 'Deshi Bajri No Rotlo (with Ghee & Makhan)', code: 'ROT-01', price: 60, costPrice: 18, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 10 },
    { id: 'item_jowar_rotlo', categoryId: 'cat_rotla', name: 'Jowar No Rotlo with Ghee', code: 'ROT-02', price: 60, costPrice: 18, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 11 },
    { id: 'item_phulka_roti', categoryId: 'cat_rotla', name: 'Hot Phulka Roti with Ghee (3 Pcs)', code: 'ROT-03', price: 45, costPrice: 12, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 6, displayOrder: 12 },
    { id: 'item_thepla', categoryId: 'cat_rotla', name: 'Deshi Masala Methi Thepla (2 Pcs)', code: 'ROT-04', price: 50, costPrice: 15, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 13 },
    { id: 'item_puri_basket', categoryId: 'cat_rotla', name: 'Puri Basket (4 Pcs)', code: 'ROT-05', price: 40, costPrice: 12, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 14 },
    { id: 'item_garlic_paratha', categoryId: 'cat_rotla', name: 'Garlic Butter Paratha', code: 'ROT-06', price: 65, costPrice: 20, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 15 },

    // 3. Special Thali & Combos
    { id: 'item_bhatigal_thali', categoryId: 'cat_thali', name: 'Bhatigal Rajwadi Special Thali (Unlimited)', code: 'THALI-01', price: 350, costPrice: 125, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 16 },
    { id: 'item_executive_thali', categoryId: 'cat_thali', name: 'Kathiyawadi Executive Thali', code: 'THALI-02', price: 260, costPrice: 90, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 17 },
    { id: 'item_khichdi_kadhi', categoryId: 'cat_thali', name: 'Vaghareli Khichdi & Kathiyawadi Kadhi Bowl', code: 'THALI-03', price: 190, costPrice: 55, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 10, displayOrder: 18 },
    { id: 'item_dal_dhokli', categoryId: 'cat_thali', name: 'Dal Dhokli Traditional Bowl', code: 'THALI-04', price: 180, costPrice: 50, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 12, displayOrder: 19 },

    // 4. Farsan & Starters
    { id: 'item_nylon_khaman', categoryId: 'cat_farsan', name: 'Surti Nylon Khaman Plate', code: 'FARSAN-01', price: 120, costPrice: 35, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 20 },
    { id: 'item_patra', categoryId: 'cat_farsan', name: 'Steamed Patra with Mustard Tadka', code: 'FARSAN-02', price: 130, costPrice: 40, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 21 },
    { id: 'item_bharela_marcha', categoryId: 'cat_farsan', name: 'Fried Bharela Marcha Sambharo', code: 'FARSAN-03', price: 90, costPrice: 25, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 6, displayOrder: 22 },
    { id: 'item_vanela_gathiya', categoryId: 'cat_farsan', name: 'Live Vanela Gathiya Plate', code: 'FARSAN-04', price: 110, costPrice: 30, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 6, displayOrder: 23 },
    { id: 'item_methi_gota', categoryId: 'cat_farsan', name: 'Methi Na Gota Plate (6 Pcs)', code: 'FARSAN-05', price: 100, costPrice: 28, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 24 },
    { id: 'item_khandvi', categoryId: 'cat_farsan', name: 'Khandvi Rolls Plate', code: 'FARSAN-06', price: 125, costPrice: 35, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 25 },

    // 5. Traditional Sweets & Desserts
    { id: 'item_churma_ladoo', categoryId: 'cat_mithai', name: 'Deshi Ghee Churma Ladoo', code: 'SWEET-01', price: 120, costPrice: 40, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 26 },
    { id: 'item_shrikhand', categoryId: 'cat_mithai', name: 'Kesar Pista Shrikhand / Matho', code: 'SWEET-02', price: 110, costPrice: 35, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 4, displayOrder: 27 },
    { id: 'item_mohanthal', categoryId: 'cat_mithai', name: 'Kathiyawadi Deshi Mohanthal', code: 'SWEET-03', price: 130, costPrice: 42, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 28 },
    { id: 'item_jalebi', categoryId: 'cat_mithai', name: 'Garam Deshi Ghee Jalebi (150g)', code: 'SWEET-04', price: 110, costPrice: 32, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 8, displayOrder: 29 },
    { id: 'item_malpua', categoryId: 'cat_mithai', name: 'Malpua with Rabdi (2 Pcs)', code: 'SWEET-05', price: 140, costPrice: 45, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 10, displayOrder: 30 },

    // 6. Beverages & Chaas
    { id: 'item_valona_chaas', categoryId: 'cat_chaas_bev', name: 'Deshi Valona Masala Chaas', code: 'BEV-01', price: 40, costPrice: 12, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 3, displayOrder: 31 },
    { id: 'item_gol_makhan', categoryId: 'cat_chaas_bev', name: 'Deshi Gol & White Makhan Bowl', code: 'BEV-02', price: 50, costPrice: 15, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 3, displayOrder: 32 },
    { id: 'item_rajwadi_chai', categoryId: 'cat_chaas_bev', name: 'Rajwadi Masala Kadak Chai', code: 'BEV-03', price: 35, costPrice: 10, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 5, displayOrder: 33 },
    { id: 'item_lemon_soda', categoryId: 'cat_chaas_bev', name: 'Fresh Lemon Mint Soda', code: 'BEV-04', price: 60, costPrice: 15, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 4, displayOrder: 34 },
    { id: 'item_kesar_milk', categoryId: 'cat_chaas_bev', name: 'Kesar Badam Milk (Cold)', code: 'BEV-05', price: 80, costPrice: 25, taxId: 'tax_gst_5', isVeg: true, preparationTimeMinutes: 3, displayOrder: 35 }
  ];
  await MenuItem.bulkWrite(menuItems.map(m => ({ updateOne: { filter: { id: m.id }, update: { $set: m }, upsert: true } })) as any);

  // 8. Seed Tables (Previous Standard Table Numbers)
  const tables = [
    { id: 'tbl_t1', tableNumber: 'T-01', capacity: 2, floorZone: 'MAIN_HALL', status: 'AVAILABLE' },
    { id: 'tbl_t2', tableNumber: 'T-02', capacity: 4, floorZone: 'MAIN_HALL', status: 'AVAILABLE' },
    { id: 'tbl_t3', tableNumber: 'T-03', capacity: 4, floorZone: 'MAIN_HALL', status: 'AVAILABLE' },
    { id: 'tbl_t4', tableNumber: 'T-04', capacity: 6, floorZone: 'MAIN_HALL', status: 'AVAILABLE' },
    { id: 'tbl_ac1', tableNumber: 'AC-01', capacity: 4, floorZone: 'AC_HALL', status: 'AVAILABLE' },
    { id: 'tbl_ac2', tableNumber: 'AC-02', capacity: 4, floorZone: 'AC_HALL', status: 'AVAILABLE' },
    { id: 'tbl_roof1', tableNumber: 'ROOF-01', capacity: 4, floorZone: 'ROOFTOP', status: 'AVAILABLE' },
    { id: 'tbl_roof2', tableNumber: 'ROOF-02', capacity: 6, floorZone: 'ROOFTOP', status: 'AVAILABLE' },
    { id: 'tbl_vip1', tableNumber: 'VIP-01', capacity: 10, floorZone: 'VIP', status: 'AVAILABLE' }
  ];
  await DiningTable.bulkWrite(tables.map(tbl => ({ updateOne: { filter: { id: tbl.id }, update: { $set: tbl }, upsert: true } })) as any);

  // 9. Seed Inventory Items (Authentic Ingredients)
  const inventoryItems = [
    { id: 'inv_bajri_flour', itemCode: 'RAW-001', name: 'Organic Bajri Flour', category: 'RAW_MATERIAL', unitId: 'unit_kg', currentStock: 120.0, minimumStockLevel: 30.0, reorderQuantity: 80.0, costPerUnit: 40.0 },
    { id: 'inv_ringna', itemCode: 'RAW-002', name: 'Fresh Purple Brinjal / Eggplant', category: 'RAW_MATERIAL', unitId: 'unit_kg', currentStock: 65.0, minimumStockLevel: 20.0, reorderQuantity: 50.0, costPerUnit: 38.0 },
    { id: 'inv_deshi_ghee', itemCode: 'RAW-003', name: 'Pure Deshi Cow Ghee', category: 'DAIRY', unitId: 'unit_kg', currentStock: 45.0, minimumStockLevel: 15.0, reorderQuantity: 30.0, costPerUnit: 650.0 },
    { id: 'inv_white_makhan', itemCode: 'RAW-004', name: 'Fresh White Deshi Makhan', category: 'DAIRY', unitId: 'unit_kg', currentStock: 35.0, minimumStockLevel: 10.0, reorderQuantity: 25.0, costPerUnit: 380.0 },
    { id: 'inv_curd_dahi', itemCode: 'RAW-005', name: 'Fresh Whole Milk Curd / Dahi', category: 'DAIRY', unitId: 'unit_kg', currentStock: 60.0, minimumStockLevel: 20.0, reorderQuantity: 40.0, costPerUnit: 65.0 },
    { id: 'inv_gathiya', itemCode: 'RAW-006', name: 'Special Bhavnagri Gathiya', category: 'RAW_MATERIAL', unitId: 'unit_kg', currentStock: 40.0, minimumStockLevel: 10.0, reorderQuantity: 25.0, costPerUnit: 180.0 },
    { id: 'inv_kaju', itemCode: 'RAW-007', name: 'Whole Premium Cashews W320', category: 'RAW_MATERIAL', unitId: 'unit_kg', currentStock: 25.0, minimumStockLevel: 5.0, reorderQuantity: 15.0, costPerUnit: 780.0 },
    { id: 'inv_tomatoes', itemCode: 'RAW-008', name: 'Deshi Country Tomatoes', category: 'RAW_MATERIAL', unitId: 'unit_kg', currentStock: 75.0, minimumStockLevel: 20.0, reorderQuantity: 50.0, costPerUnit: 32.0 },
    { id: 'inv_garlic', itemCode: 'RAW-009', name: 'Jamnagari Fresh Garlic', category: 'RAW_MATERIAL', unitId: 'unit_kg', currentStock: 30.0, minimumStockLevel: 10.0, reorderQuantity: 20.0, costPerUnit: 140.0 },
    { id: 'inv_gol', itemCode: 'RAW-010', name: 'Organic Deshi Jaggery / Gol', category: 'RAW_MATERIAL', unitId: 'unit_kg', currentStock: 80.0, minimumStockLevel: 25.0, reorderQuantity: 50.0, costPerUnit: 55.0 }
  ];
  await InventoryItem.bulkWrite(inventoryItems.map(inv => ({ updateOne: { filter: { id: inv.id }, update: { $set: inv }, upsert: true } })) as any);

  // 10. Seed Recipes
  const recipes = [
    {
      id: 'rec_ringna_olo',
      menuItemId: 'item_ringna_olo',
      menuItemName: 'Ringna No Olo with White Butter',
      yieldQuantity: 1,
      totalCost: 75.0,
      foodCostPercentage: 34.0,
      instructions: 'Roast 400g brinjal on charcoal flame, mash with garlic paste, saute in mustard oil and fresh ginger, serve with 30g white butter',
      ingredients: [
        { id: uuidv4(), inventoryItemId: 'inv_ringna', itemName: 'Fresh Purple Brinjal', quantity: 0.40, unitId: 'unit_kg', unitSymbol: 'kg', cost: 15.20 },
        { id: uuidv4(), inventoryItemId: 'inv_white_makhan', itemName: 'Fresh White Deshi Makhan', quantity: 0.05, unitId: 'unit_kg', unitSymbol: 'kg', cost: 19.00 },
        { id: uuidv4(), inventoryItemId: 'inv_garlic', itemName: 'Jamnagari Fresh Garlic', quantity: 0.05, unitId: 'unit_kg', unitSymbol: 'kg', cost: 7.00 },
        { id: uuidv4(), inventoryItemId: 'inv_tomatoes', itemName: 'Deshi Country Tomatoes', quantity: 0.15, unitId: 'unit_kg', unitSymbol: 'kg', cost: 4.80 }
      ]
    },
    {
      id: 'rec_kaju_gathiya',
      menuItemId: 'item_kaju_gathiya',
      menuItemName: 'Kaju Gathiya Nu Shaak',
      yieldQuantity: 1,
      totalCost: 90.0,
      foodCostPercentage: 37.5,
      instructions: 'Saute 50g whole cashews in deshi ghee with tomato-garlic gravy, mix with fresh gathiya right before plating',
      ingredients: [
        { id: uuidv4(), inventoryItemId: 'inv_kaju', itemName: 'Whole Premium Cashews', quantity: 0.05, unitId: 'unit_kg', unitSymbol: 'kg', cost: 39.00 },
        { id: uuidv4(), inventoryItemId: 'inv_gathiya', itemName: 'Special Bhavnagri Gathiya', quantity: 0.10, unitId: 'unit_kg', unitSymbol: 'kg', cost: 18.00 },
        { id: uuidv4(), inventoryItemId: 'inv_deshi_ghee', itemName: 'Pure Deshi Cow Ghee', quantity: 0.03, unitId: 'unit_kg', unitSymbol: 'kg', cost: 19.50 },
        { id: uuidv4(), inventoryItemId: 'inv_tomatoes', itemName: 'Deshi Country Tomatoes', quantity: 0.15, unitId: 'unit_kg', unitSymbol: 'kg', cost: 4.80 }
      ]
    },
    {
      id: 'rec_bajri_rotlo',
      menuItemId: 'item_bajri_rotlo',
      menuItemName: 'Deshi Bajri No Rotlo (with Ghee & Makhan)',
      yieldQuantity: 1,
      totalCost: 18.0,
      foodCostPercentage: 30.0,
      instructions: 'Hand-pat 180g bajri flour dough on clay tavadio, cook on wood flame, glaze generously with deshi cow ghee and dollop of white makhan',
      ingredients: [
        { id: uuidv4(), inventoryItemId: 'inv_bajri_flour', itemName: 'Organic Bajri Flour', quantity: 0.18, unitId: 'unit_kg', unitSymbol: 'kg', cost: 7.20 },
        { id: uuidv4(), inventoryItemId: 'inv_deshi_ghee', itemName: 'Pure Deshi Cow Ghee', quantity: 0.015, unitId: 'unit_kg', unitSymbol: 'kg', cost: 9.75 }
      ]
    }
  ];
  await Recipe.bulkWrite(recipes.map(r => ({ updateOne: { filter: { id: r.id }, update: { $set: r }, upsert: true } })) as any);

  // 11. Seed Suppliers & Customers
  const suppliers = [
    { id: 'sup_saurashtra', name: 'Manishbhai Patel', companyName: 'Saurashtra Deshi Krushi & Ghee Kendra', email: 'saurashtra.krushi@example.com', phone: '9879011223', taxId: '24AAAAA0000A1Z5', address: 'Grain Market Yard, Rajkot', paymentTerms: 'NET30', outstandingBalance: 12500.0 },
    { id: 'sup_farsan', name: 'Hiteshbhai Dave', companyName: 'Bhavnagar Farsan & Spices Suppliers', email: 'dave.farsan@example.com', phone: '9879011224', taxId: '24BBBBB1111B2Z6', address: 'Danapith, Bhavnagar', paymentTerms: 'NET15', outstandingBalance: 6800.0 }
  ];
  await Supplier.bulkWrite(suppliers.map(s => ({ updateOne: { filter: { id: s.id }, update: { $set: s }, upsert: true } })) as any);

  const customers = [
    { id: 'cust_vip1', name: 'Jayeshbhai Radadiya', phone: '9898011223', email: 'jayesh.r@example.com', address: '102 Kalawad Road', city: 'Rajkot', loyaltyPoints: 520, totalSpent: 24500.0 },
    { id: 'cust_vip2', name: 'Bhavnaben Chovatia', phone: '9898022334', email: 'bhavna.c@example.com', address: '45 Amin Marg', city: 'Rajkot', loyaltyPoints: 340, totalSpent: 16800.0 }
  ];
  await Customer.bulkWrite(customers.map(c => ({ updateOne: { filter: { id: c.id }, update: { $set: c }, upsert: true } })) as any);

  // 12. Seed Discount Rules
  const discountRules = [
    { id: 'disc_family10', code: 'FAMILY10', name: 'Family Group 10% Off', type: 'PERCENTAGE', value: 10.0, maxDiscountAmount: 500.0, minOrderAmount: 800.0, requiresApproval: false, isActive: true },
    { id: 'disc_vip20', code: 'RAJwadi20', name: 'Rajwadi VIP 20% Off', type: 'PERCENTAGE', value: 20.0, maxDiscountAmount: 1500.0, minOrderAmount: 1200.0, requiresApproval: true, isActive: true },
    { id: 'disc_welcome50', code: 'BHATIGAL50', name: 'Flat ₹50 Welcome Discount', type: 'FIXED_AMOUNT', value: 50.0, maxDiscountAmount: 50.0, minOrderAmount: 400.0, requiresApproval: false, isActive: true }
  ];
  await DiscountRule.bulkWrite(discountRules.map(d => ({ updateOne: { filter: { id: d.id }, update: { $set: d }, upsert: true } })) as any);

  // 13. Seed Chart of Accounts
  const chartOfAccounts = [
    { id: 'acc_cash_drawer', accountCode: '1010', accountName: 'Cash in Counter Drawer', accountType: 'ASSET', subType: 'CASH', currentBalance: 35000.0 },
    { id: 'acc_bank_sbi', accountCode: '1020', accountName: 'SBI Current Account (Rajkot Main)', accountType: 'ASSET', subType: 'BANK', currentBalance: 620000.0 },
    { id: 'acc_pos_receivable', accountCode: '1030', accountName: 'Accounts Receivable (Customers)', accountType: 'ASSET', subType: 'CURRENT_ASSET', currentBalance: 0.0 },
    { id: 'acc_inventory_asset', accountCode: '1040', accountName: 'Food & Kathiyawadi Provision Inventory Asset', accountType: 'ASSET', subType: 'CURRENT_ASSET', currentBalance: 185000.0 },
    { id: 'acc_supplier_payable', accountCode: '2010', accountName: 'Accounts Payable (Farm & Spice Suppliers)', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', currentBalance: 19300.0 },
    { id: 'acc_gst_payable', accountCode: '2020', accountName: 'GST Output Tax Payable (5%)', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', currentBalance: 11400.0 },
    { id: 'acc_owner_equity', accountCode: '3010', accountName: 'Owner Capital / Equity', accountType: 'EQUITY', subType: 'EQUITY', currentBalance: 750000.0 },
    { id: 'acc_food_sales', accountCode: '4010', accountName: 'Kathiyawadi Food & Thali Sales Revenue', accountType: 'REVENUE', subType: 'OPERATING_REVENUE', currentBalance: 0.0 },
    { id: 'acc_bev_sales', accountCode: '4020', accountName: 'Chaas & Beverage Sales Revenue', accountType: 'REVENUE', subType: 'OPERATING_REVENUE', currentBalance: 0.0 },
    { id: 'acc_cogs_food', accountCode: '5010', accountName: 'Cost of Goods Sold - Deshi Provisions', accountType: 'EXPENSE', subType: 'DIRECT_EXPENSE', currentBalance: 0.0 },
    { id: 'acc_exp_rent', accountCode: '6010', accountName: 'Dining Hall Premises Rent', accountType: 'EXPENSE', subType: 'INDIRECT_EXPENSE', currentBalance: 0.0 },
    { id: 'acc_exp_utilities', accountCode: '6020', accountName: 'Electricity & Gas Utilities', accountType: 'EXPENSE', subType: 'INDIRECT_EXPENSE', currentBalance: 0.0 },
    { id: 'acc_exp_salaries', accountCode: '6030', accountName: 'Cook & Staff Salaries', accountType: 'EXPENSE', subType: 'INDIRECT_EXPENSE', currentBalance: 0.0 }
  ];
  await ChartOfAccount.bulkWrite(chartOfAccounts.map(a => ({ updateOne: { filter: { id: a.id }, update: { $set: a }, upsert: true } })) as any);

  // 14. Seed Employees & Salary Structures
  const employees = [
    { id: 'emp_001', employeeCode: 'EMP-001', firstName: 'Rameshbhai', lastName: 'Patel', email: 'ramesh.p@bhatigalbhanu.com', phone: '9879001100', departmentId: 'dept_mgmt', departmentName: 'Management', designationId: 'desig_gm', designationTitle: 'General Manager', userId: 'usr_manager', joiningDate: '2025-01-15', baseSalary: 65000 },
    { id: 'emp_002', employeeCode: 'EMP-002', firstName: 'Dineshbhai', lastName: 'Maharaj', email: 'dinesh.m@bhatigalbhanu.com', phone: '9879001101', departmentId: 'dept_kitchen', departmentName: 'Kitchen & Culinary', designationId: 'desig_head_chef', designationTitle: 'Head Maharaj / Chef', userId: 'usr_chef', joiningDate: '2025-01-15', baseSalary: 55000 },
    { id: 'emp_003', employeeCode: 'EMP-003', firstName: 'Pareshbhai', lastName: 'Vora', email: 'paresh.v@bhatigalbhanu.com', phone: '9879001102', departmentId: 'dept_accounts', departmentName: 'Accounts & Finance', designationId: 'desig_cashier', designationTitle: 'Head Cashier', userId: 'usr_cashier', joiningDate: '2025-02-01', baseSalary: 32000 },
    { id: 'emp_004', employeeCode: 'EMP-004', firstName: 'Kishorbhai', lastName: 'Chavda', email: 'kishor.c@bhatigalbhanu.com', phone: '9879001103', departmentId: 'dept_service', departmentName: 'Service & Front of House', designationId: 'desig_waiter', designationTitle: 'Head Captain', userId: 'usr_waiter', joiningDate: '2025-02-10', baseSalary: 26000 },
    { id: 'emp_005', employeeCode: 'EMP-005', firstName: 'Mukeshbhai', lastName: 'Gohil', email: 'mukesh.g@bhatigalbhanu.com', phone: '9879001104', departmentId: 'dept_inventory', departmentName: 'Inventory & Stores', designationId: 'desig_inv_mgr', designationTitle: 'Bhandar Incharge', userId: 'usr_inventory', joiningDate: '2025-02-15', baseSalary: 38000 }
  ];
  await Employee.bulkWrite(employees.map(emp => ({ updateOne: { filter: { id: emp.id }, update: { $set: emp }, upsert: true } })) as any);

  const salaryOps = employees.map(emp => ({
    updateOne: {
      filter: { employeeId: emp.id },
      update: {
        $set: {
          id: uuidv4(),
          employeeId: emp.id,
          baseSalary: emp.baseSalary * 0.5,
          hra: emp.baseSalary * 0.2,
          conveyance: 2000,
          medicalAllowance: 1500,
          specialAllowance: emp.baseSalary * 0.15,
          providentFund: emp.baseSalary * 0.06,
          professionalTax: 200,
          tds: 0
        }
      },
      upsert: true
    }
  }));
  await SalaryStructure.bulkWrite(salaryOps as any);

  // 15. Seed System Settings (Bhatigal Bhanu)
  const settings = [
    { key: 'restaurant_name', value: 'Bhatigal Bhanu', category: 'GENERAL', description: 'Business Name' },
    { key: 'restaurant_tagline', value: 'Traditional Kathiyawadi & Gujarati Dining', category: 'GENERAL', description: 'Brand Tagline' },
    { key: 'restaurant_address', value: 'Kothariya Ring Road, Rajkot, Gujarat - 360022', category: 'GENERAL', description: 'Physical Address' },
    { key: 'restaurant_phone', value: '+91 98790 12345', category: 'GENERAL', description: 'Contact Phone' },
    { key: 'restaurant_email', value: 'contact@bhatigalbhanu.com', category: 'GENERAL', description: 'Support Email' },
    { key: 'currency_symbol', value: '₹', category: 'BILLING', description: 'Currency Display Symbol' },
    { key: 'currency_code', value: 'INR', category: 'BILLING', description: 'ISO Currency Code' },
    { key: 'gst_number', value: '24AAAFB1234A1Z8', category: 'TAX', description: 'GST Identification Number' },
    { key: 'service_charge_percentage', value: '0.0', category: 'BILLING', description: 'Default Service Charge %' },
    { key: 'auto_kot_print', value: 'true', category: 'KITCHEN', description: 'Automatically trigger KOT print on order' },
    { key: 'system_status', value: 'ONLINE', category: 'SYSTEM', description: 'System operational status' }
  ];
  await SystemSetting.bulkWrite(settings.map(s => ({ updateOne: { filter: { key: s.key }, update: { $set: s }, upsert: true } })) as any);

  console.log('[MongoDB Seed] Database initialized and seeded successfully.');
}

if (require.main === module) {
  runDatabaseMigrationsAndSeeds()
    .then(async () => {
      console.log('Seed process completed.');
      await disconnectDatabase();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed process failed:', err);
      process.exit(1);
    });
}
