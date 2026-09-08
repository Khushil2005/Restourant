import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { MenuItem, MenuCategory, DayOfWeek, DailyMenu } from '../../types';
import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Utensils,
  ArrowRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const DAYS_LIST: Array<{ key: DayOfWeek; label: string; short: string }> = [
  { key: 'MONDAY', label: 'Monday (સોમવાર)', short: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday (મંગળવાર)', short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday (બુધવાર)', short: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday (ગુરુવાર)', short: 'Thu' },
  { key: 'FRIDAY', label: 'Friday (શુક્રવાર)', short: 'Fri' },
  { key: 'SATURDAY', label: 'Saturday (શનિવાર)', short: 'Sat' },
  { key: 'SUNDAY', label: 'Sunday (રવિવાર)', short: 'Sun' }
];

export const DailyMenuPage: React.FC = () => {
  const { can } = usePermission();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [dailyMenus, setDailyMenus] = useState<DailyMenu[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('MONDAY');
  const [systemToday, setSystemToday] = useState<DayOfWeek>('MONDAY');
  const [isStrictEnforced, setIsStrictEnforced] = useState(true);
  const [activeOverrideDay, setActiveOverrideDay] = useState<DayOfWeek | null>(null);

  // Selected Day's active item IDs (editable state)
  const [activeItemIds, setActiveItemIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Filtering states for Master Catalog (Left column)
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');

  // Copy modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<DayOfWeek[]>([]);

  // UI status
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [catRes, itemRes, dailyRes]: any = await Promise.all([
        apiClient.get('/masters/menu-categories'),
        apiClient.get('/masters/menu-items'),
        apiClient.get('/daily-menu')
      ]);

      if (catRes.success) setCategories(catRes.data);
      if (itemRes.success) setAllMenuItems(itemRes.data);

      if (dailyRes.success && dailyRes.data) {
        setDailyMenus(dailyRes.data.menus || []);
        setSystemToday(dailyRes.data.currentDay || 'MONDAY');
        setIsStrictEnforced(dailyRes.data.isStrictEnforced !== false);
        setActiveOverrideDay(dailyRes.data.activeOverrideDay || null);

        // Default active day to today on initial load
        const todayKey = dailyRes.data.currentDay || 'MONDAY';
        setSelectedDay(prev => prev === 'MONDAY' ? todayKey : prev);
      }
    } catch (err) {
      console.error('Failed to load Daily Menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // When selectedDay changes or dailyMenus is reloaded, sync activeItemIds and notes
  useEffect(() => {
    const currentMenu = dailyMenus.find(m => m.dayOfWeek === selectedDay);
    if (currentMenu) {
      setActiveItemIds(currentMenu.itemIds || []);
      setNotes(currentMenu.notes || '');
    } else {
      setActiveItemIds([]);
      setNotes('');
    }
    setSaveSuccessMsg(null);
  }, [selectedDay, dailyMenus]);

  // Toggle single item in today's menu
  const handleToggleItem = (itemId: string) => {
    setActiveItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  // Add all dishes of a category
  const handleAddCategoryItems = (catId: string) => {
    const itemsInCat = allMenuItems.filter(m => m.categoryId === catId).map(m => m.id);
    setActiveItemIds(prev => Array.from(new Set([...prev, ...itemsInCat])));
  };

  // Remove all dishes of a category
  const handleRemoveCategoryItems = (catId: string) => {
    const itemsInCat = new Set(allMenuItems.filter(m => m.categoryId === catId).map(m => m.id));
    setActiveItemIds(prev => prev.filter(id => !itemsInCat.has(id)));
  };

  // Clear all items for selected day
  const handleClearDay = () => {
    if (window.confirm(`Are you sure you want to clear all dishes scheduled for ${selectedDay}?`)) {
      setActiveItemIds([]);
    }
  };

  // Save current day's menu
  const handleSaveMenu = async () => {
    setSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res: any = await apiClient.post('/daily-menu', {
        dayOfWeek: selectedDay,
        itemIds: activeItemIds,
        notes,
        isActive: true
      });

      if (res.success) {
        setSaveSuccessMsg(`✓ ${selectedDay} Daily Menu saved with ${activeItemIds.length} items.`);
        // Update local dailyMenus list
        setDailyMenus(prev =>
          prev.map(m => m.dayOfWeek === selectedDay ? { ...m, itemIds: activeItemIds, notes, itemCount: activeItemIds.length } : m)
        );
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save daily menu.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Strict Daily Menu Enforcement
  const handleToggleStrict = async () => {
    const nextStrict = !isStrictEnforced;
    try {
      const res: any = await apiClient.post('/daily-menu/toggle-strict', {
        isStrictEnforced: nextStrict
      });
      if (res.success) {
        setIsStrictEnforced(nextStrict);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to toggle strict mode.');
    }
  };

  // Copy Menu to target days
  const handleExecuteCopy = async () => {
    if (copyTargetDays.length === 0) {
      alert('Please select at least one day to copy to.');
      return;
    }
    setSaving(true);
    try {
      const res: any = await apiClient.post('/daily-menu/copy', {
        fromDay: selectedDay,
        toDays: copyTargetDays
      });
      if (res.success) {
        setIsCopyModalOpen(false);
        setCopyTargetDays([]);
        alert(`Successfully copied ${selectedDay} menu to ${copyTargetDays.join(', ')}!`);
        await loadAllData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to copy menu.');
    } finally {
      setSaving(false);
    }
  };

  // Filter master catalog
  const filteredCatalog = allMenuItems.filter(item => {
    const matchCat = selectedCategoryId === 'ALL' || item.categoryId === selectedCategoryId;
    const matchSearch =
      item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.code.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // Selected dishes details
  const selectedDishes = activeItemIds
    .map(id => allMenuItems.find(m => m.id === id))
    .filter(Boolean) as MenuItem[];

  return (
    <div className="d-flex flex-column gap-3">
      {/* Top Banner & Header */}
      <div className="card shadow-sm border-0 bg-white">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Calendar className="text-primary" size={26} />
                <h4 className="fw-bold mb-0 text-dark">Daily Menu Scheduler (રોજિંદુ મેનુ)</h4>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                  Day-Wise Rotating Catalog
                </span>
              </div>
              <p className="text-muted small mb-0">
                Configure fixed dish availability per day of the week. In <strong>Strict Mode</strong>, only these selected dishes will be available in POS for order taking; all other dishes will be hidden.
              </p>
            </div>

            {/* Strict Enforcement Mode Switch */}
            <div className="d-flex align-items-center gap-3 bg-light p-2 px-3 rounded-3 border">
              <div>
                <div className="d-flex align-items-center gap-1">
                  {isStrictEnforced ? (
                    <ShieldCheck size={18} className="text-success" />
                  ) : (
                    <ShieldAlert size={18} className="text-warning" />
                  )}
                  <span className="fw-bold small text-dark">Strict Daily Menu Mode</span>
                </div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                  {isStrictEnforced ? 'Only day-wise dishes available in POS' : 'All master dishes browsable in POS'}
                </div>
              </div>
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="strictMenuSwitch"
                  checked={isStrictEnforced}
                  onChange={handleToggleStrict}
                  style={{ width: '2.5em', height: '1.3em', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* 7-Days Navigation Tabs */}
          <div className="mt-4 pt-3 border-top">
            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <div className="d-flex flex-wrap gap-1">
                {DAYS_LIST.map(day => {
                  const menuObj = dailyMenus.find(m => m.dayOfWeek === day.key);
                  const count = menuObj?.itemIds?.length || 0;
                  const isToday = day.key === systemToday;
                  const isSelected = day.key === selectedDay;

                  return (
                    <button
                      key={day.key}
                      className={`btn btn-sm px-3 py-2 rounded-3 d-flex align-items-center gap-2 transition-all ${
                        isSelected
                          ? 'btn-primary shadow-sm fw-bold'
                          : 'btn-white border text-dark hover-bg-light'
                      }`}
                      onClick={() => setSelectedDay(day.key)}
                    >
                      <span>{day.label}</span>
                      <span
                        className={`badge rounded-pill ${
                          isSelected
                            ? 'bg-white text-primary'
                            : count > 0
                            ? 'bg-primary-subtle text-primary border'
                            : 'bg-secondary-subtle text-muted'
                        }`}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {count} Items
                      </span>
                      {isToday && (
                        <span className={`badge ${isSelected ? 'bg-warning text-dark' : 'bg-warning text-dark'} small`}>
                          ★ TODAY
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={loadAllData}
                disabled={loading}
                title="Refresh Menu Data"
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Alert Message */}
      {saveSuccessMsg && (
        <div className="alert alert-success d-flex align-items-center justify-content-between py-2 px-3 shadow-sm border-0 mb-0">
          <div className="d-flex align-items-center gap-2">
            <CheckCircle2 size={18} className="text-success" />
            <span className="fw-bold small">{saveSuccessMsg}</span>
          </div>
          <span className="badge bg-success">Live in POS</span>
        </div>
      )}

      {/* Main Dual-Panel Section */}
      <div className="row g-3">
        {/* LEFT PANEL: Master Menu Catalog */}
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-header bg-white py-3 border-bottom">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <h6 className="fw-bold mb-0 text-dark">Master Restaurant Catalog</h6>
                  <span className="text-muted small">Select dishes to include in <strong>{selectedDay}</strong></span>
                </div>
                {/* Search Bar */}
                <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
                  <span className="input-group-text bg-light border-end-0"><Search size={14} /></span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search dish or code..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="d-flex flex-wrap gap-1 mt-3">
                <button
                  className={`btn btn-xs btn-sm py-1 px-2 rounded-2 ${
                    selectedCategoryId === 'ALL' ? 'btn-dark' : 'btn-outline-secondary'
                  }`}
                  onClick={() => setSelectedCategoryId('ALL')}
                >
                  All Categories ({allMenuItems.length})
                </button>
                {categories.map(cat => {
                  const catItemsCount = allMenuItems.filter(m => m.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      className={`btn btn-xs btn-sm py-1 px-2 rounded-2 ${
                        selectedCategoryId === cat.id ? 'btn-dark' : 'btn-outline-secondary'
                      }`}
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      {cat.name} ({catItemsCount})
                    </button>
                  );
                })}
              </div>

              {/* Category Quick Actions */}
              {selectedCategoryId !== 'ALL' && (
                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                  <span className="text-muted small">Quick Category Action:</span>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-primary btn-xs btn-sm py-0 px-2"
                      onClick={() => handleAddCategoryItems(selectedCategoryId)}
                    >
                      + Add All in Category
                    </button>
                    <button
                      className="btn btn-outline-danger btn-xs btn-sm py-0 px-2"
                      onClick={() => handleRemoveCategoryItems(selectedCategoryId)}
                    >
                      - Remove All in Category
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Catalog Items List */}
            <div className="card-body p-2 overflow-auto" style={{ maxHeight: '550px' }}>
              {filteredCatalog.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <Utensils size={32} className="opacity-25 mb-2" />
                  <div>No dishes found matching search criteria.</div>
                </div>
              ) : (
                <div className="row g-2">
                  {filteredCatalog.map(item => {
                    const isAdded = activeItemIds.includes(item.id);
                    const catName = categories.find(c => c.id === item.categoryId)?.name || 'General';

                    return (
                      <div key={item.id} className="col-12 col-md-6">
                        <div
                          className={`p-2 rounded-3 border d-flex align-items-center justify-content-between gap-2 transition-all ${
                            isAdded
                              ? 'bg-primary-subtle border-primary'
                              : 'bg-white hover-bg-light'
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleToggleItem(item.id)}
                        >
                          <div className="d-flex align-items-center gap-2 overflow-hidden">
                            <span className={`badge p-1 ${item.isVeg ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.6rem' }}>
                              {item.isVeg ? 'VEG' : 'NON'}
                            </span>
                            <div className="overflow-hidden">
                              <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>
                                {item.name}
                              </div>
                              <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                <span className="badge bg-light text-secondary border me-1 font-monospace">{item.code}</span>
                                <span>{catName}</span>
                              </div>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
                              ₹{item.price}
                            </span>
                            <div
                              className={`rounded-circle d-flex align-items-center justify-content-center ${
                                isAdded ? 'bg-primary text-white' : 'border text-muted bg-light'
                              }`}
                              style={{ width: 24, height: 24 }}
                            >
                              {isAdded ? <Check size={14} /> : <Plus size={14} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Scheduled Dishes for Selected Day */}
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm border-0 h-100 bg-white d-flex flex-column">
            <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <div>
                <h6 className="fw-bold mb-0 text-dark">
                  Scheduled for {selectedDay} ({activeItemIds.length})
                </h6>
                <span className="text-muted small">
                  {selectedDay === systemToday ? '★ Active Today in POS' : 'Scheduled for future service'}
                </span>
              </div>
              <div className="d-flex gap-1">
                <button
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                  onClick={() => setIsCopyModalOpen(true)}
                  disabled={activeItemIds.length === 0}
                  title="Copy this day's menu to other days"
                >
                  <Copy size={14} /> Copy
                </button>
                <button
                  className="btn btn-outline-danger btn-sm p-1 px-2"
                  onClick={handleClearDay}
                  disabled={activeItemIds.length === 0}
                  title="Clear all items"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* List of Scheduled Items */}
            <div className="card-body p-2 flex-grow-1 overflow-auto" style={{ maxHeight: '420px' }}>
              {selectedDishes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <AlertCircle size={32} className="text-warning opacity-50 mb-2" />
                  <div className="fw-bold">No dishes selected for {selectedDay}</div>
                  <p className="small text-muted mb-0">
                    Click items from the catalog on the left to add dishes for this day.
                  </p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-1">
                  {selectedDishes.map((dish, idx) => {
                    const catName = categories.find(c => c.id === dish.categoryId)?.name || 'General';
                    return (
                      <div
                        key={dish.id}
                        className="p-2 px-3 rounded-2 bg-light border d-flex align-items-center justify-content-between gap-2"
                      >
                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                          <span className="text-muted small fw-bold font-monospace" style={{ width: 20 }}>
                            {idx + 1}.
                          </span>
                          <span className={`badge p-1 ${dish.isVeg ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.6rem' }}>
                            {dish.isVeg ? 'VEG' : 'NON'}
                          </span>
                          <div className="overflow-hidden">
                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>
                              {dish.name}
                            </div>
                            <div className="text-muted small" style={{ fontSize: '0.7rem' }}>
                              {catName} • ₹{dish.price}
                            </div>
                          </div>
                        </div>

                        <button
                          className="btn btn-outline-danger btn-sm p-1 rounded-circle flex-shrink-0"
                          onClick={() => handleToggleItem(dish.id)}
                          title="Remove item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Day Notes & Save Footer */}
            <div className="card-footer bg-light p-3 border-top">
              <div className="mb-2">
                <label className="form-label small fw-bold mb-1">
                  Day Menu Notes / Chef Specials (Optional):
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. Tuesday Kathiyawadi Thali Special, Ringan No Olo"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-between align-items-center pt-2">
                <div className="small text-muted">
                  Total <strong>{activeItemIds.length}</strong> items fixed
                </div>
                <button
                  className="btn btn-primary btn-sm px-4 fw-bold d-flex align-items-center gap-2 shadow-sm"
                  onClick={handleSaveMenu}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Save {selectedDay} Menu
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COPY MENU MODAL */}
      {isCopyModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <Copy size={18} /> Copy Menu from {selectedDay}
                </h5>
                <button type="button" className="btn-close" onClick={() => setIsCopyModalOpen(false)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-3">
                  Select which other days should have the exact same <strong>{activeItemIds.length} dishes</strong> as {selectedDay}:
                </p>

                <div className="d-flex flex-column gap-2">
                  {DAYS_LIST.filter(d => d.key !== selectedDay).map(day => {
                    const isChecked = copyTargetDays.includes(day.key);
                    return (
                      <label
                        key={day.key}
                        className={`p-2 rounded border d-flex align-items-center justify-content-between cursor-pointer ${
                          isChecked ? 'bg-primary-subtle border-primary' : 'bg-light'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="fw-bold small">{day.label}</span>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setCopyTargetDays(prev => [...prev, day.key]);
                            } else {
                              setCopyTargetDays(prev => prev.filter(k => k !== day.key));
                            }
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsCopyModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                  onClick={handleExecuteCopy}
                  disabled={saving || copyTargetDays.length === 0}
                >
                  <Check size={14} /> Copy to {copyTargetDays.length} Days
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
