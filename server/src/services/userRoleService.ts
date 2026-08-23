import { User, IUserPermissionOverride } from '../models/User';
import { Role, Permission } from '../models/Role';
import { hashPassword } from '../utils/password';
import { calculateEffectivePermissions } from '../middleware/permissionMiddleware';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class UserRoleService {
  // --- USERS ---
  static async getUsers() {
    const users = await User.find().sort({ username: 1 });
    const roles = await Role.find();

    return users.map(u => {
      const role = roles.find(r => r.id === u.roleId);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        roleId: u.roleId,
        roleName: role?.name || 'Unknown',
        status: u.status,
        lastLogin: u.lastLogin,
        permissionOverridesCount: u.permissionOverrides?.length || 0,
        createdAt: u.createdAt
      };
    });
  }

  static async getUserById(id: string) {
    const user = await User.findOne({ id });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const role = await Role.findOne({ id: user.roleId });
    const permMap = await calculateEffectivePermissions(user.id, user.roleId);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        roleId: user.roleId,
        roleName: role?.name || 'Unknown',
        status: user.status,
        avatarUrl: user.avatarUrl,
        permissionOverrides: user.permissionOverrides || []
      },
      effectivePermissions: Array.from(permMap.values())
    };
  }

  static async createUser(data: any, adminUserId?: string, adminUsername?: string) {
    const id = `usr_${uuidv4().slice(0, 8)}`;
    const passwordHash = await hashPassword(data.password || 'User@12345');

    const user = await User.create({
      id,
      username: data.username,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      roleId: data.roleId,
      status: data.status || 'ACTIVE',
      permissionOverrides: []
    });

    await createAuditLog({
      userId: adminUserId,
      username: adminUsername,
      module: 'Users & Roles',
      submodule: 'Users',
      action: 'CREATE_USER',
      recordId: id,
      newValue: { username: user.username, roleId: user.roleId }
    });

    return user;
  }

  static async updateUser(id: string, data: any, adminUserId?: string, adminUsername?: string) {
    const user = await User.findOne({ id });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const oldData = { ...user.toObject() };

    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.email) user.email = data.email;
    if (data.phone) user.phone = data.phone;
    if (data.roleId) user.roleId = data.roleId;
    if (data.status) user.status = data.status;
    if (data.password) user.passwordHash = await hashPassword(data.password);

    await user.save();

    await createAuditLog({
      userId: adminUserId,
      username: adminUsername,
      module: 'Users & Roles',
      submodule: 'Users',
      action: 'EDIT_USER',
      recordId: id,
      oldValue: oldData,
      newValue: user
    });

    return user;
  }

  static async deleteUser(id: string, adminUserId?: string, adminUsername?: string) {
    const user = await User.findOne({ id });
    if (!user) throw { statusCode: 404, message: 'User not found.' };
    if (user.username === 'superadmin') {
      throw { statusCode: 403, message: 'Cannot delete primary superadmin account.' };
    }

    await User.deleteOne({ id });
    await createAuditLog({
      userId: adminUserId,
      username: adminUsername,
      module: 'Users & Roles',
      submodule: 'Users',
      action: 'DELETE_USER',
      recordId: id,
      oldValue: { username: user.username }
    });

    return { success: true };
  }

  /**
   * Set User-Specific Permission Overrides (ALLOW, DENY, INHERIT)
   */
  static async setUserPermissionOverrides(
    userId: string, 
    overrides: Array<{ permissionId: string; overrideType: 'ALLOW' | 'DENY' | 'INHERIT' }>,
    adminUserId?: string,
    adminUsername?: string
  ) {
    const user = await User.findOne({ id: userId });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const cleanOverrides: IUserPermissionOverride[] = overrides
      .filter(o => o.overrideType === 'ALLOW' || o.overrideType === 'DENY')
      .map(o => ({
        permissionId: o.permissionId,
        overrideType: o.overrideType,
        updatedAt: new Date()
      }));

    user.permissionOverrides = cleanOverrides;
    await user.save();

    const permMap = await calculateEffectivePermissions(user.id, user.roleId);

    await createAuditLog({
      userId: adminUserId,
      username: adminUsername,
      module: 'Users & Roles',
      submodule: 'User Permissions',
      action: 'UPDATE_USER_OVERRIDES',
      recordId: userId,
      newValue: cleanOverrides
    });

    return {
      message: 'User permission overrides updated successfully.',
      overrides: cleanOverrides,
      effectivePermissions: Array.from(permMap.values())
    };
  }

  // --- ROLES ---
  static async getRoles() {
    return Role.find().sort({ isSystem: -1, name: 1 });
  }

  static async getRoleById(id: string) {
    const role = await Role.findOne({ id });
    if (!role) throw { statusCode: 404, message: 'Role not found.' };
    return role;
  }

  static async createRole(data: any, adminUserId?: string, adminUsername?: string) {
    const id = `role_${uuidv4().slice(0, 8)}`;
    const role = await Role.create({
      id,
      name: data.name,
      description: data.description,
      isSystem: false,
      permissions: data.permissions || []
    });

    await createAuditLog({
      userId: adminUserId,
      username: adminUsername,
      module: 'Users & Roles',
      submodule: 'Roles',
      action: 'CREATE_ROLE',
      recordId: id,
      newValue: role
    });

    return role;
  }

  static async updateRolePermissions(id: string, permissions: string[], adminUserId?: string, adminUsername?: string) {
    const role = await Role.findOne({ id });
    if (!role) throw { statusCode: 404, message: 'Role not found.' };

    role.permissions = permissions;
    await role.save();

    await createAuditLog({
      userId: adminUserId,
      username: adminUsername,
      module: 'Users & Roles',
      submodule: 'Role Permissions',
      action: 'UPDATE_ROLE_PERMISSIONS',
      recordId: id,
      newValue: { permissionCount: permissions.length }
    });

    return role;
  }

  static async deleteRole(id: string, adminUserId?: string, adminUsername?: string) {
    const role = await Role.findOne({ id });
    if (!role) throw { statusCode: 404, message: 'Role not found.' };
    if (role.isSystem) {
      throw { statusCode: 403, message: 'Cannot delete built-in system role.' };
    }

    const assignedUsers = await User.countDocuments({ roleId: id });
    if (assignedUsers > 0) {
      throw { statusCode: 400, message: `Cannot delete role with ${assignedUsers} assigned active users. Reassign them first.` };
    }

    await Role.deleteOne({ id });
    await createAuditLog({
      userId: adminUserId,
      username: adminUsername,
      module: 'Users & Roles',
      submodule: 'Roles',
      action: 'DELETE_ROLE',
      recordId: id,
      oldValue: { name: role.name }
    });

    return { success: true };
  }

  // --- PERMISSIONS TREE ---
  static async getPermissionsTree() {
    const permissions = await Permission.find().sort({ module: 1, submodule: 1, action: 1 });
    
    // Group into hierarchy: Module -> Submodule -> Actions
    const tree: Record<string, Record<string, any[]>> = {};

    permissions.forEach(p => {
      if (!tree[p.module]) tree[p.module] = {};
      if (!tree[p.module][p.submodule]) tree[p.module][p.submodule] = [];
      tree[p.module][p.submodule].push({
        id: p.id,
        action: p.action,
        name: p.name,
        description: p.description
      });
    });

    return { total: permissions.length, modules: tree, rawList: permissions };
  }
}
