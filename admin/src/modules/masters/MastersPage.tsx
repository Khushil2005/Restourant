import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal, ConfirmDialog, PermissionGate } from '../../components/PermissionGate';
import { Customer, Supplier, MenuCategory, MenuItem, DiningTable } from '../../types';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Eye } from 'lucide-react';

export const MastersPage: React.FC = () => {
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<'menu' | 'tables' | 'customers' | 'suppliers' | 'categories'>('menu');

  // State data
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Confirm delete
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; type: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'menu' && can('masters.menu.view')) {
        const [mRes, cRes]: any = await Promise.all([
          apiClient.get('/masters/menu-items').catch(() => null),
          apiClient.get('/masters/menu-categories').catch(() => null)
        ]);
        if (mRes?.success) setMenuItems(mRes.data);
        if (cRes?.success) setCategories(cRes.data);
      } else if (activeTab === 'tables' && can('masters.table.view')) {
        const res: any = await apiClient.get('/masters/tables').catch(() => null);
        if (res?.success) setTables(res.data);
      } else if (activeTab === 'customers' && can('masters.customer.view')) {
        const res: any = await apiClient.get('/masters/customers').catch(() => null);
        if (res?.success) setCustomers(res.data);
      } else if (activeTab === 'suppliers' && can('masters.supplier.view')) {
        const res: any = await apiClient.get('/masters/suppliers').catch(() => null);
        if (res?.success) setSuppliers(res.data);
      } else if (activeTab === 'categories' && can('masters.menu.view')) {
        const [cRes, mRes]: any = await Promise.all([
          apiClient.get('/masters/menu-categories').catch(() => null),
          apiClient.get('/masters/menu-items').catch(() => null)
        ]);
        if (cRes?.success) setCategories(cRes.data);
        if (mRes?.success) setMenuItems(mRes.data);
      }
    } catch (err) {
      console.error('Failed to load master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tabs: Array<{ id: 'menu' | 'categories' | 'tables' | 'customers' | 'suppliers'; perms: string[] }> = [
      { id: 'menu', perms: ['masters.menu.view'] },
      { id: 'categories', perms: ['masters.menu.view'] },
      { id: 'tables', perms: ['masters.table.view'] },
      { id: 'customers', perms: ['masters.customer.view'] },
      { id: 'suppliers', perms: ['masters.supplier.view'] }
    ];
    const isCurrentAllowed = tabs.find(t => t.id === activeTab && t.perms.some(p => can(p)));
    if (!isCurrentAllowed) {
      const firstAllowed = tabs.find(t => t.perms.some(p => can(p)));
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [can]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleOpenModal = (type: string, item: any = null) => {
    setModalType(type);
    if (item) {
      setEditingId(item.id);
      setFormData({ ...item });
    } else {
      setEditingId(null);
      if (type === 'menuItem') {
        setFormData({ name: '', code: '', price: 0, categoryId: categories[0]?.id || '', isVeg: true, isAvailable: true, preparationTimeMinutes: 15 });
      } else if (type === 'table') {
        setFormData({ tableNumber: '', capacity: 4, floorZone: 'MAIN_HALL', status: 'AVAILABLE' });
      } else if (type === 'customer') {
        setFormData({ name: '', phone: '', email: '', address: '', city: '' });
      } else if (type === 'supplier') {
        setFormData({ name: '', companyName: '', phone: '', email: '', taxId: '', paymentTerms: 'NET30' });
      } else if (type === 'category') {
        const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => Number(c.displayOrder) || 0)) + 1 : 1;
        setFormData({ name: '', code: '', description: '', displayOrder: nextOrder, isActive: true });
      }
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'menuItem') {
        if (editingId) {
          await apiClient.put(`/masters/menu-items/${editingId}`, formData);
        } else {
          await apiClient.post('/masters/menu-items', formData);
        }
      } else if (modalType === 'table') {
        if (editingId) {
          await apiClient.put(`/masters/tables/${editingId}`, formData);
        } else {
          await apiClient.post('/masters/tables', formData);
        }
      } else if (modalType === 'customer') {
        if (editingId) {
          await apiClient.put(`/masters/customers/${editingId}`, formData);
        } else {
          await apiClient.post('/masters/customers', formData);
        }
      } else if (modalType === 'supplier') {
        if (editingId) {
          await apiClient.put(`/masters/suppliers/${editingId}`, formData);
        } else {
          await apiClient.post('/masters/suppliers', formData);
        }
      } else if (modalType === 'category') {
        const payload = {
          name: formData.name?.trim(),
          code: formData.code?.trim() || undefined,
          description: formData.description?.trim() || '',
          displayOrder: Number(formData.displayOrder || 1),
          isActive: formData.isActive !== false
        };
        if (editingId) {
          await apiClient.put(`/masters/menu-categories/${editingId}`, payload);
        } else {
          await apiClient.post('/masters/menu-categories', payload);
        }
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save record.');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'menuItem') await apiClient.delete(`/masters/menu-items/${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'table') await apiClient.delete(`/masters/tables/${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'customer') await apiClient.delete(`/masters/customers/${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'supplier') await apiClient.delete(`/masters/suppliers/${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'category') await apiClient.delete(`/masters/menu-categories/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record.');
    }
  };

  const toggleItemAvailability = async (id: string, isAvailable: boolean) => {
    try {
      await apiClient.patch(`/masters/menu-items/${id}/availability`, { isAvailable });
      setMenuItems(prev => prev.map(m => m.id === id ? { ...m, isAvailable } : m));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Master Data Management</h4>
          <p className="text-muted small mb-0">Manage core restaurant catalog, dining tables, customers and vendors</p>
        </div>
        <div>
          {activeTab === 'menu' && can('masters.menu.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => handleOpenModal('menuItem')}>
              <Plus size={16} /> Add Menu Item
            </button>
          )}
          {activeTab === 'tables' && can('masters.table.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => handleOpenModal('table')}>
              <Plus size={16} /> Add Dining Table
            </button>
          )}
          {activeTab === 'customers' && can('masters.customer.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => handleOpenModal('customer')}>
              <Plus size={16} /> Add Customer
            </button>
          )}
          {activeTab === 'suppliers' && can('masters.supplier.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => handleOpenModal('supplier')}>
              <Plus size={16} /> Add Supplier
            </button>
          )}
          {activeTab === 'categories' && can('masters.menu.create') && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={() => handleOpenModal('category')}>
              <Plus size={16} /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <ul className="nav nav-pills bg-white p-2 rounded shadow-sm border gap-1 scrollable-pills-container">
        {can('masters.menu.view') && (
          <li className="nav-item">
            <button className={`nav-link btn-sm text-nowrap ${activeTab === 'menu' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('menu')}>
              Menu Dishes ({menuItems.length})
            </button>
          </li>
        )}
        {can('masters.menu.view') && (
          <li className="nav-item">
            <button className={`nav-link btn-sm text-nowrap ${activeTab === 'categories' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('categories')}>
              Menu Categories ({categories.length})
            </button>
          </li>
        )}
        {can('masters.table.view') && (
          <li className="nav-item">
            <button className={`nav-link btn-sm text-nowrap ${activeTab === 'tables' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('tables')}>
              Dining Tables ({tables.length})
            </button>
          </li>
        )}
        {can('masters.customer.view') && (
          <li className="nav-item">
            <button className={`nav-link btn-sm text-nowrap ${activeTab === 'customers' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('customers')}>
              Customers CRM ({customers.length})
            </button>
          </li>
        )}
        {can('masters.supplier.view') && (
          <li className="nav-item">
            <button className={`nav-link btn-sm text-nowrap ${activeTab === 'suppliers' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('suppliers')}>
              Suppliers / Vendors ({suppliers.length})
            </button>
          </li>
        )}
      </ul>

      {/* TAB CONTENT */}
      {activeTab === 'menu' && (
        <DataTable<MenuItem>
          columns={[
            { header: 'Code', accessor: 'code', width: 100 },
            {
              header: 'Dish Name',
              accessor: (row) => (
                <div>
                  <span className={`badge me-2 ${row.isVeg ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.65rem' }}>
                    {row.isVeg ? 'VEG' : 'NON-VEG'}
                  </span>
                  <span className="fw-bold">{row.name}</span>
                </div>
              )
            },
            {
              header: 'Category',
              accessor: (row) => categories.find(c => c.id === row.categoryId)?.name || 'General'
            },
            {
              header: 'Selling Price',
              accessor: (row) => <span className="fw-bold text-dark">₹{row.price}</span>
            },
            {
              header: 'Prep Time',
              accessor: (row) => `${row.preparationTimeMinutes || 15} mins`
            },
            {
              header: 'Status (In-Stock)',
              accessor: (row) => (
                <PermissionGate permission="masters.menu.availability" fallback={<span>{row.isAvailable ? 'Available' : 'Sold Out'}</span>}>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={row.isAvailable}
                      onChange={(e) => toggleItemAvailability(row.id, e.target.checked)}
                    />
                  </div>
                </PermissionGate>
              )
            }
          ]}
          data={menuItems}
          searchPlaceholder="Search menu dishes..."
          searchField={(row) => `${row.name} ${row.code}`}
          actions={(row) => (
            <>
              {can('masters.menu.edit') && (
                <button className="btn btn-outline-primary btn-sm p-1" onClick={() => handleOpenModal('menuItem', row)} title="Edit">
                  <Edit2 size={14} />
                </button>
              )}
              {can('masters.menu.delete') && (
                <button className="btn btn-outline-danger btn-sm p-1" onClick={() => setDeleteConfirm({ isOpen: true, id: row.id, type: 'menuItem' })} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        />
      )}

      {activeTab === 'categories' && (
        <DataTable<MenuCategory>
          columns={[
            {
              header: 'Code',
              accessor: (row) => <span className="badge bg-dark font-monospace">{row.code}</span>,
              width: 130
            },
            {
              header: 'Category Name',
              accessor: (row) => (
                <div>
                  <span className="fw-bold text-dark">{row.name}</span>
                  {row.description && <div className="text-muted small">{row.description}</div>}
                </div>
              )
            },
            {
              header: 'Display Order',
              accessor: (row) => <span className="badge bg-light text-dark border">#{row.displayOrder ?? 0}</span>,
              width: 120
            },
            {
              header: 'Dishes Linked',
              accessor: (row) => {
                const count = menuItems.filter(m => m.categoryId === row.id).length;
                return (
                  <span className={`badge ${count > 0 ? 'bg-primary' : 'bg-secondary'}`}>
                    {count} {count === 1 ? 'Dish' : 'Dishes'}
                  </span>
                );
              },
              width: 130
            },
            {
              header: 'Status',
              accessor: (row) => (
                <span className={`badge ${row.isActive !== false ? 'bg-success' : 'bg-danger'}`}>
                  {row.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              ),
              width: 100
            }
          ]}
          data={categories}
          searchPlaceholder="Search menu categories..."
          searchField={(row) => `${row.name} ${row.code} ${row.description || ''}`}
          actions={(row) => (
            <>
              {can('masters.menu.edit') && (
                <button className="btn btn-outline-primary btn-sm p-1" onClick={() => handleOpenModal('category', row)} title="Edit Category">
                  <Edit2 size={14} />
                </button>
              )}
              {can('masters.menu.delete') && (
                <button className="btn btn-outline-danger btn-sm p-1" onClick={() => setDeleteConfirm({ isOpen: true, id: row.id, type: 'category' })} title="Delete Category">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        />
      )}

      {activeTab === 'tables' && (
        <DataTable<DiningTable>
          columns={[
            { header: 'Table No', accessor: 'tableNumber', width: 120 },
            { header: 'Capacity', accessor: (row) => `${row.capacity} Persons` },
            { header: 'Floor Zone', accessor: 'floorZone' },
            {
              header: 'Status',
              accessor: (row) => (
                <span className={`badge bg-${
                  row.status === 'AVAILABLE' ? 'success' : row.status === 'OCCUPIED' ? 'danger' : row.status === 'RESERVED' ? 'warning text-dark' : 'secondary'
                }`}>
                  {row.status}
                </span>
              )
            }
          ]}
          data={tables}
          searchPlaceholder="Search tables..."
          actions={(row) => (
            <>
              {can('masters.table.edit') && (
                <button className="btn btn-outline-primary btn-sm p-1" onClick={() => handleOpenModal('table', row)} title="Edit">
                  <Edit2 size={14} />
                </button>
              )}
              {can('masters.table.delete') && (
                <button className="btn btn-outline-danger btn-sm p-1" onClick={() => setDeleteConfirm({ isOpen: true, id: row.id, type: 'table' })} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        />
      )}

      {activeTab === 'customers' && (
        <DataTable<Customer>
          columns={[
            { header: 'Customer Name', accessor: 'name' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Email', accessor: (row) => row.email || 'N/A' },
            { header: 'Loyalty Points', accessor: (row) => <span className="badge bg-info">{row.loyaltyPoints} Pts</span> },
            { header: 'Total Spent', accessor: (row) => `₹${(row.totalSpent || 0).toLocaleString()}` }
          ]}
          data={customers}
          searchPlaceholder="Search customers by name or phone..."
          actions={(row) => (
            <>
              {can('masters.customer.edit') && (
                <button className="btn btn-outline-primary btn-sm p-1" onClick={() => handleOpenModal('customer', row)} title="Edit">
                  <Edit2 size={14} />
                </button>
              )}
              {can('masters.customer.delete') && (
                <button className="btn btn-outline-danger btn-sm p-1" onClick={() => setDeleteConfirm({ isOpen: true, id: row.id, type: 'customer' })} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        />
      )}

      {activeTab === 'suppliers' && (
        <DataTable<Supplier>
          columns={[
            { header: 'Company Name', accessor: 'companyName' },
            { header: 'Contact Person', accessor: 'name' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'GST / Tax ID', accessor: (row) => row.taxId || 'N/A' },
            { header: 'Outstanding Due', accessor: (row) => <span className="fw-bold text-danger">₹{(row.outstandingBalance || 0).toLocaleString()}</span> }
          ]}
          data={suppliers}
          searchPlaceholder="Search vendors..."
          actions={(row) => (
            <>
              {can('masters.supplier.edit') && (
                <button className="btn btn-outline-primary btn-sm p-1" onClick={() => handleOpenModal('supplier', row)} title="Edit">
                  <Edit2 size={14} />
                </button>
              )}
              {can('masters.supplier.delete') && (
                <button className="btn btn-outline-danger btn-sm p-1" onClick={() => setDeleteConfirm({ isOpen: true, id: row.id, type: 'supplier' })} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        />
      )}

      {/* CRUD MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? 'Edit' : 'Create'} ${modalType.toUpperCase()}`}
      >
        <form onSubmit={handleSave} className="d-flex flex-column gap-3">
          {modalType === 'menuItem' && (
            <>
              <div className="row g-2">
                <div className="col-8">
                  <label className="form-label small fw-bold">Dish Name</label>
                  <input type="text" className="form-control form-control-sm" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-bold">Code</label>
                  <input type="text" className="form-control form-control-sm" required value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                </div>
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small fw-bold">Category</label>
                  <select className="form-select form-select-sm" value={formData.categoryId || ''} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold">Selling Price (₹)</label>
                  <input type="number" className="form-control form-control-sm" required value={formData.price || 0} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-check form-switch mt-2">
                <input className="form-check-input" type="checkbox" checked={formData.isVeg ?? true} onChange={e => setFormData({ ...formData, isVeg: e.target.checked })} />
                <label className="form-check-label small fw-bold">Vegetarian Dish</label>
              </div>
            </>
          )}

          {modalType === 'table' && (
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-bold">Table Number</label>
                <input type="text" className="form-control form-control-sm" placeholder="e.g. T-10" required value={formData.tableNumber || ''} onChange={e => setFormData({ ...formData, tableNumber: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">Capacity (Persons)</label>
                <input type="number" className="form-control form-control-sm" required value={formData.capacity || 4} onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })} />
              </div>
              <div className="col-12 mt-2">
                <label className="form-label small fw-bold">Floor Zone</label>
                <select className="form-select form-select-sm" value={formData.floorZone || 'MAIN_HALL'} onChange={e => setFormData({ ...formData, floorZone: e.target.value })}>
                  <option value="MAIN_HALL">Main Dining Hall</option>
                  <option value="AC_HALL">AC Family Section</option>
                  <option value="ROOFTOP">Rooftop Lounge</option>
                  <option value="GARDEN">Garden Patio</option>
                  <option value="VIP">VIP Private Room</option>
                </select>
              </div>
            </div>
          )}

          {modalType === 'customer' && (
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label small fw-bold">Customer Full Name</label>
                <input type="text" className="form-control form-control-sm" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">Phone Number</label>
                <input type="text" className="form-control form-control-sm" required value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">Email Address</label>
                <input type="email" className="form-control form-control-sm" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>
          )}

          {modalType === 'supplier' && (
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label small fw-bold">Company / Vendor Name</label>
                <input type="text" className="form-control form-control-sm" required value={formData.companyName || ''} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">Contact Person</label>
                <input type="text" className="form-control form-control-sm" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">Phone</label>
                <input type="text" className="form-control form-control-sm" required value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
          )}

          {modalType === 'category' && (
            <>
              <div className="row g-2">
                <div className="col-8">
                  <label className="form-label small fw-bold">Category Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Starters, Main Course, Desserts, Beverages"
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-bold">Code <span className="text-muted small">(Optional)</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm text-uppercase"
                    placeholder="e.g. STARTER"
                    value={formData.code || ''}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <div className="row g-2 mt-1">
                <div className="col-6">
                  <label className="form-label small fw-bold">Display Order</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={formData.displayOrder ?? 1}
                    min={1}
                    onChange={e => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                  />
                </div>
                <div className="col-6 d-flex align-items-end">
                  <div className="form-check form-switch mb-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="categoryActiveSwitch"
                      checked={formData.isActive !== false}
                      onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <label className="form-check-label small fw-bold" htmlFor="categoryActiveSwitch">Active Category</label>
                  </div>
                </div>
              </div>
              <div className="col-12 mt-1">
                <label className="form-label small fw-bold">Description <span className="text-muted small">(Optional)</span></label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  placeholder="Short description of items under this category..."
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="d-flex justify-content-end gap-2 mt-3 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Save Master Record</button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        message="Are you sure you want to permanently remove this record from the database?"
      />
    </div>
  );
};
