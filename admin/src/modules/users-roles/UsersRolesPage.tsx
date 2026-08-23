import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal, ConfirmDialog } from '../../components/PermissionGate';
import { User, Role } from '../../types';
import {
  UserCog,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Key,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Copy,
  Sliders,
  CheckCircle2,
  XCircle,
  RotateCcw
} from 'lucide-react';

export const UsersRolesPage: React.FC = () => {
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permTree, setPermTree] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<any>({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    roleId: '',
    status: 'ACTIVE'
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Role Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState({ name: '', description: '' });

  // Role Permissions Tree Editor Modal
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRolePerms, setSelectedRolePerms] = useState<Set<string>>(new Set());
  const [cloneSourceRoleId, setCloneSourceRoleId] = useState<string>('');

  // User Overrides Modal
  const [overrideUser, setOverrideUser] = useState<any | null>(null);
  const [userOverridesMap, setUserOverridesMap] = useState<Map<string, 'ALLOW' | 'DENY' | 'INHERIT'>>(new Map());

  // Expand/collapse tree tracking
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, pRes]: any = await Promise.all([
        apiClient.get('/access-control/users'),
        apiClient.get('/access-control/roles'),
        apiClient.get('/access-control/permissions-tree')
      ]);
      if (uRes.success) setUsers(uRes.data);
      if (rRes.success) setRoles(rRes.data);
      if (pRes.success) {
        setPermTree(pRes.data);
        // Expand all modules by default
        setExpandedModules(new Set(Object.keys(pRes.data.modules || {})));
      }
    } catch (err) {
      console.error('Failed to load RBAC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenUserModal = (user: User | null = null) => {
    if (user) {
      setEditingUserId(user.id);
      setUserFormData({
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        roleId: user.roleId,
        status: user.status
      });
    } else {
      setEditingUserId(null);
      setUserFormData({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        roleId: roles[0]?.id || '',
        status: 'ACTIVE'
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await apiClient.put(`/access-control/users/${editingUserId}`, userFormData);
      } else {
        await apiClient.post('/access-control/users', userFormData);
      }
      alert('User account saved successfully.');
      setIsUserModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save user.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await apiClient.delete(`/access-control/users/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- ROLE PERMISSIONS MATRIX ---
  const handleOpenRolePerms = (role: Role) => {
    setEditingRole(role);
    setSelectedRolePerms(new Set(role.permissions || []));
  };

  const toggleRolePerm = (permId: string) => {
    setSelectedRolePerms(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleToggleSubmoduleAll = (actions: any[]) => {
    const allChecked = actions.every(a => selectedRolePerms.has(a.id));
    setSelectedRolePerms(prev => {
      const next = new Set(prev);
      actions.forEach(a => {
        if (allChecked) next.delete(a.id);
        else next.add(a.id);
      });
      return next;
    });
  };

  const handleCloneRolePerms = () => {
    const src = roles.find(r => r.id === cloneSourceRoleId);
    if (src) {
      setSelectedRolePerms(new Set(src.permissions || []));
    }
  };

  const handleSaveRolePerms = async () => {
    if (!editingRole) return;
    try {
      await apiClient.put(`/access-control/roles/${editingRole.id}/permissions`, {
        permissions: Array.from(selectedRolePerms)
      });
      alert(`Permissions updated for role ${editingRole.name} (${selectedRolePerms.size} actions granted).`);
      setEditingRole(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update permissions.');
    }
  };

  // --- USER PERMISSION OVERRIDES ---
  const handleOpenUserOverrides = async (user: User) => {
    try {
      const res: any = await apiClient.get(`/access-control/users/${user.id}`);
      if (res.success && res.data) {
        setOverrideUser(res.data);
        const map = new Map<string, 'ALLOW' | 'DENY' | 'INHERIT'>();
        (res.data.user.permissionOverrides || []).forEach((o: any) => {
          map.set(o.permissionId, o.overrideType);
        });
        setUserOverridesMap(map);
      }
    } catch (err) {
      alert('Failed to load user details.');
    }
  };

  const handleSetUserOverride = (permId: string, type: 'ALLOW' | 'DENY' | 'INHERIT') => {
    setUserOverridesMap(prev => {
      const next = new Map(prev);
      if (type === 'INHERIT') next.delete(permId);
      else next.set(permId, type);
      return next;
    });
  };

  const handleSaveUserOverrides = async () => {
    if (!overrideUser) return;
    try {
      const overridesArray = Array.from(userOverridesMap.entries()).map(([permissionId, overrideType]) => ({
        permissionId,
        overrideType
      }));

      await apiClient.post(`/access-control/users/${overrideUser.user.id}/overrides`, {
        overrides: overridesArray
      });

      alert('User permission overrides applied successfully.');
      setOverrideUser(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save overrides.');
    }
  };

  const toggleModuleExpand = (mod: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Access Control: Users, Roles & Granular Permissions</h4>
          <p className="text-muted small mb-0">Role-Based Access Control (RBAC), Tree-view matrix editor, and per-user ALLOW/DENY overrides</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {activeTab === 'users' && can('users.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => handleOpenUserModal(null)}>
              <Plus size={16} /> Create User Account
            </button>
          )}
          {activeTab === 'roles' && can('roles.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsRoleModalOpen(true)}>
              <Plus size={16} /> Create Custom Role
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills bg-white p-2 rounded shadow-sm border gap-1">
        <li className="nav-item">
          <button className={`nav-link btn-sm ${activeTab === 'users' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('users')}>
            User Accounts ({users.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link btn-sm ${activeTab === 'roles' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('roles')}>
            Roles & Permission Matrix ({roles.length})
          </button>
        </li>
      </ul>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <DataTable<User>
          columns={[
            {
              header: 'User / Identity',
              accessor: (row) => (
                <div>
                  <span className="fw-bold text-dark">{row.firstName} {row.lastName}</span>
                  <div className="small text-muted font-monospace">@{row.username} • {row.email}</div>
                </div>
              )
            },
            {
              header: 'Assigned Role',
              accessor: (row) => (
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle fs-6">
                  <Shield size={12} className="me-1" /> {row.roleName}
                </span>
              )
            },
            {
              header: 'Custom Overrides',
              accessor: (row) => (
                row.permissionOverrides && row.permissionOverrides.length > 0 ? (
                  <span className="badge bg-warning text-dark">
                    {row.permissionOverrides.length} Overrides
                  </span>
                ) : (
                  <span className="text-muted small">None (Role Default)</span>
                )
              )
            },
            {
              header: 'Account Status',
              accessor: (row) => (
                <span className={`badge ${row.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}`}>
                  {row.status}
                </span>
              )
            }
          ]}
          data={users}
          searchPlaceholder="Search users by name, username, role..."
          actions={(row) => (
            <>
              {can('users.permissions') && (
                <button
                  className="btn btn-outline-warning btn-sm p-1 px-2 d-flex align-items-center gap-1 text-dark"
                  onClick={() => handleOpenUserOverrides(row)}
                  title="Configure Individual User Overrides"
                >
                  <Sliders size={14} /> Overrides
                </button>
              )}
              {can('users.edit') && (
                <button className="btn btn-outline-primary btn-sm p-1" onClick={() => handleOpenUserModal(row)} title="Edit User">
                  <Edit2 size={14} />
                </button>
              )}
              {can('users.delete') && row.username !== 'superadmin' && (
                <button className="btn btn-outline-danger btn-sm p-1" onClick={() => handleDeleteUser(row.id)} title="Delete User">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        />
      )}

      {/* ROLES TAB */}
      {activeTab === 'roles' && (
        <DataTable<Role>
          columns={[
            {
              header: 'Role Name',
              accessor: (row) => (
                <div>
                  <span className="fw-bold text-dark fs-6">{row.name}</span>
                  {row.isSystem && <span className="badge bg-secondary ms-2 small">System Built-in</span>}
                </div>
              )
            },
            { header: 'Description', accessor: 'description' },
            {
              header: 'Granted Permissions',
              accessor: (row) => (
                <span className="badge bg-info-subtle text-info border border-info-subtle fs-6">
                  {row.permissions?.length || 0} / {permTree?.total || 264} Permissions
                </span>
              )
            }
          ]}
          data={roles}
          searchPlaceholder="Search roles..."
          actions={(row) => (
            <>
              {can('roles.permissions') && (
                <button
                  className="btn btn-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                  onClick={() => handleOpenRolePerms(row)}
                  title="Edit Permission Matrix Tree"
                >
                  <Key size={14} /> Permission Tree
                </button>
              )}
            </>
          )}
        />
      )}

      {/* CREATE/EDIT USER MODAL */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUserId ? 'Edit User Account' : 'Create New User Account'}
      >
        <form onSubmit={handleSaveUser} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">First Name</label>
              <input type="text" className="form-control" required value={userFormData.firstName} onChange={e => setUserFormData({ ...userFormData, firstName: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Last Name</label>
              <input type="text" className="form-control" required value={userFormData.lastName} onChange={e => setUserFormData({ ...userFormData, lastName: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Username</label>
              <input type="text" className="form-control" required disabled={!!editingUserId} value={userFormData.username} onChange={e => setUserFormData({ ...userFormData, username: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Email</label>
              <input type="email" className="form-control" required value={userFormData.email} onChange={e => setUserFormData({ ...userFormData, email: e.target.value })} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">{editingUserId ? 'New Password (Optional)' : 'Password'}</label>
              <input type="password" className="form-control" placeholder={editingUserId ? 'Leave blank to keep current' : 'Enter strong password'} required={!editingUserId} value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Assign Role</label>
              <select className="form-select" required value={userFormData.roleId} onChange={e => setUserFormData({ ...userFormData, roleId: e.target.value })}>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsUserModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Save User Account</button>
          </div>
        </form>
      </Modal>

      {/* ROLE PERMISSION TREE MATRIX MODAL */}
      <Modal
        isOpen={!!editingRole}
        onClose={() => setEditingRole(null)}
        title={`Edit Permission Tree Matrix: ${editingRole?.name}`}
        size="xl"
      >
        <div className="d-flex flex-column gap-3">
          {/* Action toolbar */}
          <div className="p-3 bg-light rounded border d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted">Clone permissions from role:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 180 }}
                value={cloneSourceRoleId}
                onChange={e => setCloneSourceRoleId(e.target.value)}
              >
                <option value="">Select Role</option>
                {roles.filter(r => r.id !== editingRole?.id).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                disabled={!cloneSourceRoleId}
                onClick={handleCloneRolePerms}
              >
                <Copy size={14} /> Copy
              </button>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  const all = permTree?.rawList?.map((p: any) => p.id) || [];
                  setSelectedRolePerms(new Set(all));
                }}
              >
                Grant All ({permTree?.total || 264})
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setSelectedRolePerms(new Set())}
              >
                Revoke All
              </button>
            </div>
          </div>

          {/* Hierarchy Tree Viewer */}
          <div className="border rounded p-3 overflow-auto" style={{ maxHeight: '60vh' }}>
            {permTree && Object.entries(permTree.modules || {}).map(([moduleName, submodules]: [string, any]) => {
              const isExpanded = expandedModules.has(moduleName);

              return (
                <div key={moduleName} className="mb-3 border rounded">
                  {/* Module Header */}
                  <div
                    className="p-2 px-3 bg-light d-flex justify-content-between align-items-center cursor-pointer"
                    onClick={() => toggleModuleExpand(moduleName)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <span className="fw-bold text-dark fs-6">{moduleName} Module</span>
                    </div>
                  </div>

                  {/* Submodules & Actions */}
                  {isExpanded && (
                    <div className="p-3 bg-white d-flex flex-column gap-3">
                      {Object.entries(submodules).map(([subName, actions]: [string, any]) => {
                        const allChecked = actions.every((a: any) => selectedRolePerms.has(a.id));

                        return (
                          <div key={subName} className="border-bottom pb-2">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="fw-semibold text-secondary small text-uppercase">
                                {subName}
                              </span>
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-decoration-none small"
                                onClick={() => handleToggleSubmoduleAll(actions)}
                              >
                                {allChecked ? 'Deselect All' : 'Select All in Submodule'}
                              </button>
                            </div>

                            <div className="row g-2">
                              {actions.map((act: any) => {
                                const isChecked = selectedRolePerms.has(act.id);
                                return (
                                  <div key={act.id} className="col-12 col-md-6 col-xl-4">
                                    <div
                                      className={`p-2 rounded border d-flex align-items-center gap-2 cursor-pointer ${
                                        isChecked ? 'bg-primary-subtle border-primary-subtle' : 'bg-light'
                                      }`}
                                      onClick={() => toggleRolePerm(act.id)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <input
                                        type="checkbox"
                                        className="form-check-input mt-0"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by parent div
                                      />
                                      <div>
                                        <div className="fw-bold small text-dark">{act.name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                          {act.id}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="d-flex justify-content-between align-items-center pt-2 border-top">
            <span className="small text-muted">
              Total Selected: <strong>{selectedRolePerms.size}</strong> Permissions
            </span>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingRole(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm fw-bold" onClick={handleSaveRolePerms}>
                Save Permissions Matrix
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* USER SPECIFIC PERMISSION OVERRIDES MODAL */}
      <Modal
        isOpen={!!overrideUser}
        onClose={() => setOverrideUser(null)}
        title={`Custom Permission Overrides: ${overrideUser?.user?.firstName} ${overrideUser?.user?.lastName} (@${overrideUser?.user?.username})`}
        size="xl"
      >
        <div className="d-flex flex-column gap-3">
          <div className="p-3 bg-light rounded border">
            <p className="small text-secondary mb-0">
              Assigned Role: <strong>{overrideUser?.user?.roleName}</strong>. You can explicitly <strong>ALLOW</strong> or <strong>DENY</strong> individual permissions for this specific user account regardless of their assigned role permissions.
            </p>
          </div>

          <div className="border rounded p-3 overflow-auto" style={{ maxHeight: '60vh' }}>
            {permTree && Object.entries(permTree.modules || {}).map(([moduleName, submodules]: [string, any]) => (
              <div key={moduleName} className="mb-3 border rounded">
                <div className="p-2 px-3 bg-light fw-bold text-dark">
                  {moduleName} Module
                </div>
                <div className="p-3 bg-white d-flex flex-column gap-3">
                  {Object.entries(submodules).map(([subName, actions]: [string, any]) => (
                    <div key={subName} className="border-bottom pb-2">
                      <span className="fw-semibold text-secondary small text-uppercase d-block mb-2">
                        {subName}
                      </span>
                      <div className="row g-2">
                        {actions.map((act: any) => {
                          const currentOverride = userOverridesMap.get(act.id) || 'INHERIT';

                          return (
                            <div key={act.id} className="col-12 col-md-6 col-xl-4">
                              <div className="p-2 rounded border bg-light d-flex flex-column gap-1">
                                <div className="fw-bold small text-dark">{act.name}</div>
                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>{act.id}</div>
                                <div className="btn-group btn-group-sm w-100 mt-1">
                                  <button
                                    type="button"
                                    className={`btn ${currentOverride === 'INHERIT' ? 'btn-secondary fw-bold' : 'btn-outline-secondary'}`}
                                    style={{ fontSize: '0.7rem' }}
                                    onClick={() => handleSetUserOverride(act.id, 'INHERIT')}
                                  >
                                    Inherit
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn ${currentOverride === 'ALLOW' ? 'btn-success fw-bold' : 'btn-outline-success'}`}
                                    style={{ fontSize: '0.7rem' }}
                                    onClick={() => handleSetUserOverride(act.id, 'ALLOW')}
                                  >
                                    ALLOW
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn ${currentOverride === 'DENY' ? 'btn-danger fw-bold' : 'btn-outline-danger'}`}
                                    style={{ fontSize: '0.7rem' }}
                                    onClick={() => handleSetUserOverride(act.id, 'DENY')}
                                  >
                                    DENY
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-end gap-2 pt-2 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOverrideUser(null)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm fw-bold" onClick={handleSaveUserOverrides}>
              Save User Overrides
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
