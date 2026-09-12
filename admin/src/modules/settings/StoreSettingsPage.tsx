import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { Modal } from '../../components/PermissionGate';
import {
  Building2,
  Receipt,
  UtensilsCrossed,
  Grid,
  Ticket,
  CreditCard,
  Printer,
  Boxes,
  Truck,
  BookCheck,
  Users,
  Sliders,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Search,
  CheckCircle2,
  Volume2
} from 'lucide-react';
import {
  getPrintSettings,
  savePrintSettings,
  resetPrintSettings,
  playPaymentChime,
  PrintAndBillSettings
} from '../../utils/printSettings';

interface CustomSettingItem {
  id?: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedAt?: string;
}

export const StoreSettingsPage: React.FC = () => {
  const { can } = usePermission();

  // Active Category Tab
  const [activeCategory, setActiveCategory] = useState<string>('profile');

  // All Settings Dictionary (key -> string value)
  const [settings, setSettings] = useState<Record<string, string>>({});
  // All Detailed Settings for Custom Registry
  const [detailedSettings, setDetailedSettings] = useState<CustomSettingItem[]>([]);
  // Local Print Settings
  const [printConfig, setPrintConfig] = useState<PrintAndBillSettings>(getPrintSettings());

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Search in Custom Registry
  const [registrySearch, setRegistrySearch] = useState<string>('');

  // Add Custom Setting Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newKey, setNewKey] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('CUSTOM');
  const [newDescription, setNewDescription] = useState<string>('');

  // Fetch Settings from backend
  const loadSettings = async () => {
    try {
      const [resMap, resDetailed]: any = await Promise.all([
        apiClient.get('/system/settings'),
        apiClient.get('/system/settings/detailed')
      ]);

      if (resMap?.success && resMap.data) {
        setSettings(resMap.data);
      }
      if (resDetailed?.success && Array.isArray(resDetailed.data)) {
        setDetailedSettings(resDetailed.data);
      }
    } catch (err) {
      console.error('Failed to load store settings:', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Helper to get or fallback setting value
  const getVal = (key: string, defaultVal: string = '') => {
    return settings[key] !== undefined ? settings[key] : defaultVal;
  };

  const getBool = (key: string, defaultVal: boolean = false) => {
    const v = settings[key];
    if (v === undefined) return defaultVal;
    return v === 'true' || v === '1';
  };

  // Helper to update a setting in local state
  const handleUpdate = (key: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: String(value)
    }));
  };

  // Save All Settings
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value)
      }));

      // Sync print configuration with local storage
      const updatedPrint = savePrintSettings({
        restaurantName: settings['restaurant_name'] || printConfig.restaurantName,
        tagline: settings['restaurant_tagline'] || printConfig.tagline,
        address: settings['restaurant_address'] || printConfig.address,
        phone: settings['restaurant_phone'] || printConfig.phone,
        gstin: settings['gst_number'] || printConfig.gstin,
        fssai: settings['fssai_license'] || printConfig.fssai,
        autoPrintOnPayment: getBool('payment_auto_print_receipt', printConfig.autoPrintOnPayment),
        autoDownloadPdfOnPayment: getBool('payment_auto_download_pdf', printConfig.autoDownloadPdfOnPayment),
        printReceiptFormat: (settings['receipt_format'] as any) || printConfig.printReceiptFormat,
        copiesCount: Number(settings['receipt_copies'] || printConfig.copiesCount) as any,
        showLogo: getBool('receipt_show_logo', printConfig.showLogo),
        showGstin: getBool('receipt_show_gstin', printConfig.showGstin),
        showTable: getBool('receipt_show_table', printConfig.showTable),
        showCustomer: getBool('receipt_show_customer', printConfig.showCustomer),
        showTaxBreakdown: getBool('receipt_show_tax_breakdown', printConfig.showTaxBreakdown),
        showServiceCharge: getBool('receipt_show_service_charge', printConfig.showServiceCharge),
        showFooterNote: getBool('receipt_show_footer', printConfig.showFooterNote),
        customFooterText: settings['receipt_custom_footer'] || printConfig.customFooterText,
        playPaymentSound: getBool('payment_audio_chime', printConfig.playPaymentSound)
      });
      setPrintConfig(updatedPrint);

      await apiClient.post('/system/settings', { settings: payload });
      await loadSettings();

      setSaveSuccessMsg('All module settings and store rules saved successfully! (તમામ સેટિંગ્સ સેવ થઈ ગયા છે)');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save store settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Add New Custom Setting
  const handleAddCustomSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;

    try {
      await apiClient.post('/system/settings/single', {
        key: newKey.trim().toLowerCase().replace(/\s+/g, '_'),
        value: newValue,
        category: newCategory,
        description: newDescription
      });

      setIsAddModalOpen(false);
      setNewKey('');
      setNewValue('');
      setNewDescription('');
      await loadSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to add custom setting.');
    }
  };

  // Delete Setting
  const handleDeleteSetting = async (key: string) => {
    if (!confirm(`Are you sure you want to permanently delete setting "${key}"?`)) return;

    try {
      await apiClient.delete(`/system/settings/${key}`);
      await loadSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to delete setting.');
    }
  };

  // Reset to Defaults
  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to restore all ERP and printer settings to default values?')) return;

    const resetPrint = resetPrintSettings();
    setPrintConfig(resetPrint);

    // Default System Settings
    const defaultPairs = [
      { key: 'restaurant_name', value: 'Bhatigal Bhanu' },
      { key: 'restaurant_tagline', value: 'Traditional Kathiyawadi & Gujarati Dining' },
      { key: 'restaurant_address', value: 'Kothariya Ring Road, Rajkot, Gujarat - 360022' },
      { key: 'restaurant_phone', value: '+91 98790 12345' },
      { key: 'restaurant_email', value: 'contact@bhatigalbhanu.com' },
      { key: 'currency_symbol', value: '₹' },
      { key: 'currency_code', value: 'INR' },
      { key: 'gst_number', value: '24AAAFB1234A1Z8' },
      { key: 'fssai_license', value: '10724026000123' },
      { key: 'billing_default_gst_rate', value: '5' },
      { key: 'service_charge_percentage', value: '0' },
      { key: 'billing_enable_roundoff', value: 'true' },
      { key: 'billing_allow_split_bill', value: 'true' },
      { key: 'billing_prevent_duplicate_invoice', value: 'true' },
      { key: 'pos_allow_quick_order', value: 'true' },
      { key: 'pos_enforce_table', value: 'false' },
      { key: 'pos_allow_modifiers', value: 'true' },
      { key: 'pos_sound_alert', value: 'true' },
      { key: 'kds_auto_refresh_seconds', value: '4' },
      { key: 'kds_audio_beep_new_kot', value: 'true' },
      { key: 'kds_prep_warning_minutes', value: '15' },
      { key: 'tables_auto_vacate_on_payment', value: 'true' },
      { key: 'tables_prevent_double_booking', value: 'true' },
      { key: 'tables_allow_table_transfer', value: 'true' },
      { key: 'token_sms_notification', value: 'true' },
      { key: 'token_auto_reset_midnight', value: 'true' },
      { key: 'payment_enable_cash', value: 'true' },
      { key: 'payment_enable_upi', value: 'true' },
      { key: 'payment_enable_card', value: 'true' },
      { key: 'payment_enable_split', value: 'true' },
      { key: 'payment_auto_print_receipt', value: 'true' },
      { key: 'payment_auto_download_pdf', value: 'false' },
      { key: 'payment_audio_chime', value: 'true' },
      { key: 'receipt_format', value: '80MM' },
      { key: 'receipt_copies', value: '1' },
      { key: 'receipt_show_logo', value: 'true' },
      { key: 'receipt_show_gstin', value: 'true' },
      { key: 'receipt_show_table', value: 'true' },
      { key: 'receipt_show_customer', value: 'true' },
      { key: 'receipt_show_tax_breakdown', value: 'true' },
      { key: 'receipt_show_footer', value: 'true' },
      { key: 'receipt_custom_footer', value: 'Thank you for dining with us! Please Visit Again 🙏' },
      { key: 'inventory_auto_recipe_deduction', value: 'true' },
      { key: 'inventory_low_stock_threshold_percent', value: '20' },
      { key: 'po_approval_threshold', value: '10000' },
      { key: 'accounts_auto_journal_on_payment', value: 'true' },
      { key: 'dayclosing_require_drawer_cash_count', value: 'true' }
    ];

    try {
      await apiClient.post('/system/settings', { settings: defaultPairs });
      await loadSettings();
      alert('System configuration reset to factory defaults.');
    } catch (err: any) {
      alert(err.message || 'Failed to reset settings.');
    }
  };

  // Filtered Registry Items
  const filteredRegistry = useMemo(() => {
    if (!registrySearch.trim()) return detailedSettings;
    const q = registrySearch.toLowerCase();
    return detailedSettings.filter(
      item =>
        item.key.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
    );
  }, [detailedSettings, registrySearch]);

  // Categories Definition
  const CATEGORIES = [
    { id: 'profile', label: 'Store Profile & Legal', icon: <Building2 size={16} /> },
    { id: 'pos', label: 'POS & Ordering', icon: <UtensilsCrossed size={16} /> },
    { id: 'kds', label: 'Kitchen KDS & KOT', icon: <UtensilsCrossed size={16} /> },
    { id: 'tables', label: 'Tables & Floor Map', icon: <Grid size={16} /> },
    { id: 'tokens', label: 'Token Queue & Seating', icon: <Ticket size={16} /> },
    { id: 'billing', label: 'Billing & GST Invoices', icon: <Receipt size={16} /> },
    { id: 'payments', label: 'Payment Settlement', icon: <CreditCard size={16} /> },
    { id: 'printer', label: '80mm Thermal Printer', icon: <Printer size={16} /> },
    { id: 'inventory', label: 'Inventory & Recipe BOM', icon: <Boxes size={16} /> },
    { id: 'procurement', label: 'Purchases & PO Rules', icon: <Truck size={16} /> },
    { id: 'accounts', label: 'Accounts & Day Closing', icon: <BookCheck size={16} /> },
    { id: 'staff', label: 'Staff & Security', icon: <Users size={16} /> },
    { id: 'registry', label: 'Custom Settings Registry (Add/Delete)', icon: <Sliders size={16} /> }
  ];

  return (
    <div className="d-flex flex-column gap-3" style={{ fontSize: '0.85rem' }}>
      {/* Top Header */}
      <div className="card shadow-sm border-0">
        <div className="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h5 className="fw-bold mb-0 text-dark">Central Store & Module Settings</h5>
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5" style={{ fontSize: '0.72rem' }}>
                Universal Control Engine
              </span>
            </div>
            <p className="text-muted small mb-0 mt-0.5">
              Point-to-point configuration, rules, automation, and custom parameters for all restaurant ERP modules
            </p>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
              onClick={handleResetToDefaults}
              title="Reset all settings to factory defaults"
            >
              <RotateCcw size={14} /> Reset Defaults
            </button>

            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={14} /> Add Custom Setting
            </button>

            {can('settings.edit') && (
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm fw-bold px-3"
                onClick={handleSaveAll}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save All Settings
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {saveSuccessMsg && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 shadow-sm mb-0">
          <CheckCircle2 size={18} className="text-success" />
          <span className="small fw-semibold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* Settings Container: Sidebar Navigation Tabs + Category Content */}
      <div className="row g-3">
        {/* Left Navigation Category List */}
        <div className="col-lg-3 col-md-4">
          <div className="card shadow-sm border-0 overflow-hidden">
            <div className="card-header bg-white py-2 px-3 border-bottom">
              <span className="fw-bold small text-secondary text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Module Categories
              </span>
            </div>
            <div className="list-group list-group-flush" style={{ fontSize: '0.8rem' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`list-group-item list-group-item-action d-flex align-items-center gap-2 py-2.5 px-3 border-0 ${
                    activeCategory === cat.id ? 'active fw-bold shadow-sm' : 'text-dark'
                  }`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span className={activeCategory === cat.id ? 'text-white' : 'text-primary'}>
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Settings Configuration Form */}
        <div className="col-lg-9 col-md-8">
          <div className="card shadow-sm border-0">
            <div className="card-body p-3 p-sm-4">
              {/* ======================================================== */}
              {/* 1. STORE PROFILE & CONTACT                               */}
              {/* ======================================================== */}
              {activeCategory === 'profile' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Restaurant Identity & Legal Details</h6>
                    <small className="text-muted">Information printed on bills, tax invoices, and displayed on headers</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Restaurant Brand Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_name', 'Bhatigal Bhanu')}
                        onChange={e => handleUpdate('restaurant_name', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Tagline / Subtitle</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_tagline', 'Traditional Kathiyawadi & Gujarati Dining')}
                        onChange={e => handleUpdate('restaurant_tagline', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">GSTIN Number (ટેક્સ નંબર)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('gst_number', '24AAAFB1234A1Z8')}
                        onChange={e => handleUpdate('gst_number', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">FSSAI License Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('fssai_license', '10724026000123')}
                        onChange={e => handleUpdate('fssai_license', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Official Contact Phone</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_phone', '+91 98790 12345')}
                        onChange={e => handleUpdate('restaurant_phone', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Official Email Address</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_email', 'contact@bhatigalbhanu.com')}
                        onChange={e => handleUpdate('restaurant_email', e.target.value)}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">Physical Restaurant Address</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_address', 'Kothariya Ring Road, Rajkot, Gujarat - 360022')}
                        onChange={e => handleUpdate('restaurant_address', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Currency Symbol</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('currency_symbol', '₹')}
                        onChange={e => handleUpdate('currency_symbol', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Daily Opening Time</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('opening_time', '10:00 AM')}
                        onChange={e => handleUpdate('opening_time', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Daily Closing Time</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('closing_time', '11:30 PM')}
                        onChange={e => handleUpdate('closing_time', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 2. POS & ORDERING RULES                                  */}
              {/* ======================================================== */}
              {activeCategory === 'pos' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">POS Terminal & Order Placement Rules</h6>
                    <small className="text-muted">Control checkout cashier workflow, modifier notes, and ordering behavior</small>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Allow Quick Direct Ordering (ઝડપી ઓર્ડર)</div>
                        <small className="text-muted">Allows counter takeaway orders without assigning a dining table</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('pos_allow_quick_order', true)}
                          onChange={e => handleUpdate('pos_allow_quick_order', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Enforce Dining Table Selection</div>
                        <small className="text-muted">Strictly forces selecting an active table before adding food items</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('pos_enforce_table', false)}
                          onChange={e => handleUpdate('pos_enforce_table', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Allow Dish Modifiers & Cooking Notes</div>
                        <small className="text-muted">Enable spice levels (Mild, Medium, Spicy) and special preparation instructions</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('pos_allow_modifiers', true)}
                          onChange={e => handleUpdate('pos_allow_modifiers', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">POS Terminal Sound Alerts</div>
                        <small className="text-muted">Audio sound on item click and KOT dispatch</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('pos_sound_alert', true)}
                          onChange={e => handleUpdate('pos_sound_alert', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 3. KITCHEN KDS & KOT TIMERS                              */}
              {/* ======================================================== */}
              {activeCategory === 'kds' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Kitchen Display System (KDS) & KOT Workflows</h6>
                    <small className="text-muted">Configure real-time chef screens, delay timers, and audio alerts</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">KDS Auto-Refresh Rate (Seconds)</label>
                      <input
                        type="number"
                        min="2"
                        max="30"
                        className="form-control form-control-sm"
                        value={getVal('kds_auto_refresh_seconds', '4')}
                        onChange={e => handleUpdate('kds_auto_refresh_seconds', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Preparation Delay Warning (Minutes)</label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        className="form-control form-control-sm"
                        value={getVal('kds_prep_warning_minutes', '15')}
                        onChange={e => handleUpdate('kds_prep_warning_minutes', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2 mt-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Audio Buzzer on New KOT Arrival</div>
                        <small className="text-muted">Sounds kitchen buzzer when a new order ticket arrives</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('kds_audio_beep_new_kot', true)}
                          onChange={e => handleUpdate('kds_audio_beep_new_kot', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Allow Partial Dish Dispatch</div>
                        <small className="text-muted">Chefs can mark individual items as READY rather than waiting for whole order</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('kds_allow_partial_dispatch', true)}
                          onChange={e => handleUpdate('kds_allow_partial_dispatch', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 4. TABLES & FLOOR PLANS                                  */}
              {/* ======================================================== */}
              {activeCategory === 'tables' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Dining Tables & Floor Zones Automation</h6>
                    <small className="text-muted">Table seating states, auto-release, and floor layouts</small>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Auto-Vacate Table on Payment (ઓટો ટેબલ રિલીઝ)</div>
                        <small className="text-muted">Automatically marks table as AVAILABLE as soon as customer bill is settled</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('tables_auto_vacate_on_payment', true)}
                          onChange={e => handleUpdate('tables_auto_vacate_on_payment', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Prevent Double Booking</div>
                        <small className="text-muted">Blocks seating new guests on a table while an active order is running</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('tables_prevent_double_booking', true)}
                          onChange={e => handleUpdate('tables_prevent_double_booking', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Allow Table Transfer & Merging</div>
                        <small className="text-muted">Permits shifting orders between tables or merging multiple tables</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('tables_allow_table_transfer', true)}
                          onChange={e => handleUpdate('tables_allow_table_transfer', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 5. TOKEN QUEUE & SEATING                                 */}
              {/* ======================================================== */}
              {activeCategory === 'tokens' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Token Waiting Queue & Guest Calling</h6>
                    <small className="text-muted">Queue sequence resets, SMS alerts, and fast table assignment</small>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Auto-Reset Token Sequence at Midnight</div>
                        <small className="text-muted">Resets token numbers back to #001 every night at 12:00 AM</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('token_auto_reset_midnight', true)}
                          onChange={e => handleUpdate('token_auto_reset_midnight', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Direct Seat Guest to Table Button</div>
                        <small className="text-muted">Displays 1-click "Seat Guest" button directly on waiting token cards</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('token_allow_direct_seating', true)}
                          onChange={e => handleUpdate('token_allow_direct_seating', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">SMS Call Notification to Guest Mobile</div>
                        <small className="text-muted">Triggers SMS notification when token is called for dining</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('token_sms_notification', true)}
                          onChange={e => handleUpdate('token_sms_notification', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 6. BILLING & GST INVOICES                                */}
              {/* ======================================================== */}
              {activeCategory === 'billing' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Billing, Taxes (GST) & Invoicing Rules</h6>
                    <small className="text-muted">GST tax rates, service charges, rounding, and split checks</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Standard GST Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={getVal('billing_default_gst_rate', '5')}
                        onChange={e => handleUpdate('billing_default_gst_rate', e.target.value)}
                      />
                      <small className="text-muted">5% GST is split equally into 2.5% CGST and 2.5% SGST</small>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Service Charge Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={getVal('service_charge_percentage', '0')}
                        onChange={e => handleUpdate('service_charge_percentage', e.target.value)}
                      />
                      <small className="text-muted">Optional service charge added to food bill</small>
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2 mt-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Enable Cash Round-Off to Nearest Rupee</div>
                        <small className="text-muted">Automatically rounds paise to nearest whole rupee (+/- ₹0.50)</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('billing_enable_roundoff', true)}
                          onChange={e => handleUpdate('billing_enable_roundoff', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Allow Bill Splitting (સ્પ્લિટ બિલ)</div>
                        <small className="text-muted">Allows cashiers to split an invoice into multiple equal checks</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('billing_allow_split_bill', true)}
                          onChange={e => handleUpdate('billing_allow_split_bill', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Duplicate Invoice Protection (ડુપ્લિકેટ બિલ પ્રોટેક્શન)</div>
                        <small className="text-muted">Blocks generating duplicate unpaid bills for the same running table</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('billing_prevent_duplicate_invoice', true)}
                          onChange={e => handleUpdate('billing_prevent_duplicate_invoice', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 7. PAYMENT SETTLEMENT & TENDER                           */}
              {/* ======================================================== */}
              {activeCategory === 'payments' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Payment Settlement & Cash Register Settings</h6>
                    <small className="text-muted">Tender methods, audio cash chime, and auto-print triggers</small>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Auto-Print Thermal Receipt on Payment</div>
                        <small className="text-muted">Opens print slip dialog immediately upon payment confirmation</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('payment_auto_print_receipt', true)}
                          onChange={e => handleUpdate('payment_auto_print_receipt', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Auto-Download PDF Invoice on Payment</div>
                        <small className="text-muted">Automatically triggers PDF download when payment is settled</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('payment_auto_download_pdf', false)}
                          onChange={e => handleUpdate('payment_auto_download_pdf', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Cash Register Audio Chime (સાઉન્ડ ઇફેક્ટ)</div>
                        <small className="text-muted">Plays pleasant confirmation tone on bill payment settlement</small>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-2"
                          style={{ fontSize: '0.72rem' }}
                          onClick={() => playPaymentChime()}
                        >
                          <Volume2 size={12} className="me-1" /> Test Sound
                        </button>
                        <div className="form-check form-switch fs-5">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={getBool('payment_audio_chime', true)}
                            onChange={e => handleUpdate('payment_audio_chime', e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 8. THERMAL PRINTER & 80MM SLIP                           */}
              {/* ======================================================== */}
              {activeCategory === 'printer' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Thermal POS Printer & 80mm Slip Format</h6>
                    <small className="text-muted">Customize receipt slip content, number of copies, and layout</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Receipt & PDF Paper Format</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('receipt_format', '80MM')}
                        onChange={e => handleUpdate('receipt_format', e.target.value)}
                      >
                        <option value="80MM">80mm Thermal POS Slip (Exact match of print)</option>
                        <option value="A4">Full-page A4 Tax Invoice Document</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Print Copies</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('receipt_copies', '1')}
                        onChange={e => handleUpdate('receipt_copies', e.target.value)}
                      >
                        <option value="1">1 Copy (Customer Receipt)</option>
                        <option value="2">2 Copies (Customer Copy + Merchant Copy)</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">Custom Footer Note (પ્રિન્ટ ફૂટર સંદેશ)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('receipt_custom_footer', 'Thank you for dining with us! Please Visit Again 🙏')}
                        onChange={e => handleUpdate('receipt_custom_footer', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded border mt-2">
                    <div className="fw-bold text-dark mb-2">Point-to-Point Slip Content Visibility:</div>
                    <div className="row g-2">
                      <div className="col-md-6">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="p_gstin"
                            checked={getBool('receipt_show_gstin', true)}
                            onChange={e => handleUpdate('receipt_show_gstin', e.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="p_gstin">Show GSTIN & Phone</label>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="p_tbl"
                            checked={getBool('receipt_show_table', true)}
                            onChange={e => handleUpdate('receipt_show_table', e.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="p_tbl">Show Table Number</label>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="p_cust"
                            checked={getBool('receipt_show_customer', true)}
                            onChange={e => handleUpdate('receipt_show_customer', e.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="p_cust">Show Customer Name</label>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="p_tax"
                            checked={getBool('receipt_show_tax_breakdown', true)}
                            onChange={e => handleUpdate('receipt_show_tax_breakdown', e.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="p_tax">Show CGST & SGST Breakdown</label>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="p_foot"
                            checked={getBool('receipt_show_footer', true)}
                            onChange={e => handleUpdate('receipt_show_footer', e.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="p_foot">Show Thank You Footer Note</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 9. INVENTORY & RECIPE BOM                                */}
              {/* ======================================================== */}
              {activeCategory === 'inventory' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Inventory Stock & Recipe BOM Consumption</h6>
                    <small className="text-muted">Automated ingredient deductions and stock control thresholds</small>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Auto-Recipe BOM Deductions on Bill Settlement</div>
                        <small className="text-muted">Automatically deducts recipe raw materials from inventory stock when paid</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('inventory_auto_recipe_deduction', true)}
                          onChange={e => handleUpdate('inventory_auto_recipe_deduction', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Track Kitchen Wastage & Spoilage</div>
                        <small className="text-muted">Enables wastage logging and scrap reconciliation in inventory</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('inventory_track_waste', true)}
                          onChange={e => handleUpdate('inventory_track_waste', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 mt-1">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Low Stock Warning Threshold (%)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('inventory_low_stock_threshold_percent', '20')}
                        onChange={e => handleUpdate('inventory_low_stock_threshold_percent', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 10. PROCUREMENT & PURCHASES                              */}
              {/* ======================================================== */}
              {activeCategory === 'procurement' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Procurement & Purchase Orders (PO)</h6>
                    <small className="text-muted">Approval limits, supplier invoices, and GRN verification</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">PO Approval Limit (₹)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('po_approval_threshold', '10000')}
                        onChange={e => handleUpdate('po_approval_threshold', e.target.value)}
                      />
                      <small className="text-muted">Purchase orders exceeding this amount require manager approval</small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 11. ACCOUNTS & DAY CLOSING                               */}
              {/* ======================================================== */}
              {activeCategory === 'accounts' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Accounts, Ledger & Day Closing Register</h6>
                    <small className="text-muted">Double-entry journal automation and register closing rules</small>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Auto Double-Entry Sales Journal on Payment</div>
                        <small className="text-muted">Automatically generates debits/credits in the general ledger</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('accounts_auto_journal_on_payment', true)}
                          onChange={e => handleUpdate('accounts_auto_journal_on_payment', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-light rounded border d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">Require Physical Cash Drawer Count on Day Closing</div>
                        <small className="text-muted">Enforces counting cash drawer before completing shift closing</small>
                      </div>
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={getBool('dayclosing_require_drawer_cash_count', true)}
                          onChange={e => handleUpdate('dayclosing_require_drawer_cash_count', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 12. STAFF & SECURITY                                     */}
              {/* ======================================================== */}
              {activeCategory === 'staff' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Staff, Attendance & Access Security</h6>
                    <small className="text-muted">Employee punch rules, session expiration, and audit logs</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Session Inactivity Timeout (Minutes)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('security_session_timeout_minutes', '60')}
                        onChange={e => handleUpdate('security_session_timeout_minutes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 13. CUSTOM SETTINGS REGISTRY (Full CRUD: Add, Edit, Del) */}
              {/* ======================================================== */}
              {activeCategory === 'registry' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <h6 className="fw-bold text-dark mb-0">Custom Settings Registry (તમામ સેટિંગ્સ લિસ્ટ)</h6>
                      <small className="text-muted">Live database parameters stored in MongoDB Atlas with Add, Edit, and Delete actions</small>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm d-flex align-items-center gap-1 fw-medium"
                      onClick={() => setIsAddModalOpen(true)}
                    >
                      <Plus size={14} /> Add Parameter
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0">
                      <Search size={14} className="text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Search parameter by key, value, or description..."
                      value={registrySearch}
                      onChange={e => setRegistrySearch(e.target.value)}
                    />
                  </div>

                  {/* Table of All Settings */}
                  <div className="table-responsive border rounded">
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '25%' }}>Parameter Key</th>
                          <th style={{ width: '25%' }}>Current Value</th>
                          <th style={{ width: '15%' }}>Category</th>
                          <th style={{ width: '25%' }}>Description</th>
                          <th style={{ width: '10%', textAlign: 'end' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRegistry.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-muted">
                              No setting parameters matching search filter.
                            </td>
                          </tr>
                        ) : (
                          filteredRegistry.map(item => (
                            <tr key={item.key}>
                              <td>
                                <code className="text-primary fw-bold">{item.key}</code>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm py-0.5 px-1.5"
                                  style={{ fontSize: '0.75rem', height: 26 }}
                                  value={getVal(item.key, item.value)}
                                  onChange={e => handleUpdate(item.key, e.target.value)}
                                />
                              </td>
                              <td>
                                <span className="badge bg-light text-secondary border px-1.5 py-0.5" style={{ fontSize: '0.68rem' }}>
                                  {item.category || 'CUSTOM'}
                                </span>
                              </td>
                              <td className="text-muted small">
                                {item.description || '-'}
                              </td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm py-0.5 px-1.5"
                                  title="Delete custom setting"
                                  onClick={() => handleDeleteSetting(item.key)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ADD CUSTOM SETTING MODAL                                 */}
      {/* ======================================================== */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New System Parameter / Rule"
        size="md"
      >
        <form onSubmit={handleAddCustomSetting} className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-0">
            Define a new configuration key-value pair to store in the central settings database:
          </p>

          <div>
            <label className="form-label small fw-bold text-secondary mb-1">Parameter Key (કાયમી કી)</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g. delivery_charge_amount or valet_service"
              required
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
            />
            <small className="text-muted">Use lowercase with underscores (e.g. custom_feature_name)</small>
          </div>

          <div>
            <label className="form-label small fw-bold text-secondary mb-1">Parameter Value (કિંમત / વેલ્યુ)</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g. true, 50, or Active"
              required
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label small fw-bold text-secondary mb-1">Module Category</label>
            <select
              className="form-select form-select-sm"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
            >
              <option value="GENERAL">General & Brand</option>
              <option value="POS">POS & Ordering</option>
              <option value="KITCHEN">Kitchen KDS</option>
              <option value="TABLES">Dining Tables</option>
              <option value="BILLING">Billing & Tax</option>
              <option value="PAYMENT">Payment Settlement</option>
              <option value="PRINTER">Thermal Printer</option>
              <option value="INVENTORY">Inventory & Stock</option>
              <option value="ACCOUNTS">Accounts & Ledger</option>
              <option value="CUSTOM">Custom Rule</option>
            </select>
          </div>

          <div>
            <label className="form-label small fw-bold text-secondary mb-1">Description (સમજૂતી)</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              placeholder="Explains what this setting or rule controls in the restaurant..."
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-2 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold px-3">
              Add Parameter
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
