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
  Volume2,
  Calendar,
  Percent
} from 'lucide-react';
import {
  getPrintSettings,
  savePrintSettings,
  resetPrintSettings,
  playPaymentChime,
  PrintAndBillSettings
} from '../../utils/printSettings';
import { formatStoreDate, formatStoreTime } from '../../utils/storeSettings';

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

      setSaveSuccessMsg('તમામ મોડ્યુલ અને વર્કફ્લો સેટિંગ્સ સફળતાપૂર્વક સેવ થઈ ગયા છે! (All settings saved successfully)');
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
      { key: 'restaurant_name', value: 'Bhatigal Bhanu (ભાતીગળ ભાણું)' },
      { key: 'restaurant_name_gujarati', value: 'ભાતીગળ ભાણું' },
      { key: 'restaurant_tagline', value: '...ભાવ, ભજન અને ભોજનનો ત્રિવેણી સંગમ...' },
      { key: 'restaurant_address', value: 'Kothariya Ring Road, Near HP Petrol Pump, Rajkot, Gujarat - 360022' },
      { key: 'restaurant_phone', value: '+91 98790 12345' },
      { key: 'restaurant_email', value: 'contact@bhatigalbhanu.com' },
      { key: 'restaurant_website', value: 'https://bhatigalbhanu.com' },
      { key: 'gst_number', value: '24AAAFB1234A1Z8' },
      { key: 'fssai_license', value: '10724026000123' },
      { key: 'currency_symbol', value: '₹' },
      { key: 'currency_code', value: 'INR' },
      { key: 'system_timezone', value: 'Asia/Kolkata' },
      { key: 'date_format', value: 'DD/MM/YYYY' },
      { key: 'time_format', value: '12_HOUR' },
      { key: 'financial_year_start', value: '04-01' },
      { key: 'tax_gst_enabled', value: 'true' },
      { key: 'tax_gst_percentage', value: '5.0' },
      { key: 'tax_cgst_percentage', value: '2.5' },
      { key: 'tax_sgst_percentage', value: '2.5' },
      { key: 'tax_inclusive_pricing', value: 'false' },
      { key: 'service_charge_enabled', value: 'false' },
      { key: 'service_charge_percentage', value: '0.0' },
      { key: 'packaging_charge_takeaway', value: '20' },
      { key: 'delivery_charge_fixed', value: '40' },
      { key: 'max_discount_percentage', value: '10' },
      { key: 'bill_rounding_mode', value: 'NEAREST' },
      { key: 'bill_invoice_prefix', value: 'BB-INV-' },
      { key: 'bill_kot_prefix', value: 'KOT-' },
      { key: 'billing_require_order_served', value: 'true' },
      { key: 'billing_confirm_before_generation', value: 'true' },
      { key: 'billing_allow_custom_price', value: 'false' },
      { key: 'billing_allow_split_bill', value: 'true' },
      { key: 'billing_prevent_duplicate_invoice', value: 'true' },
      { key: 'orders_auto_send_kot', value: 'false' },
      { key: 'orders_dinein_customer_mandatory', value: 'false' },
      { key: 'orders_takeaway_customer_mandatory', value: 'true' },
      { key: 'pos_allow_quick_order', value: 'true' },
      { key: 'pos_enforce_table', value: 'false' },
      { key: 'pos_allow_modifiers', value: 'true' },
      { key: 'pos_sound_alert', value: 'true' },
      { key: 'receipt_format', value: '80MM' },
      { key: 'receipt_copies', value: '1' },
      { key: 'print_font_scale', value: 'MEDIUM' },
      { key: 'payment_auto_print_receipt', value: 'true' },
      { key: 'auto_kot_print', value: 'true' },
      { key: 'payment_auto_download_pdf', value: 'false' },
      { key: 'payment_audio_chime', value: 'true' },
      { key: 'receipt_show_logo', value: 'true' },
      { key: 'receipt_show_gstin', value: 'true' },
      { key: 'receipt_show_table', value: 'true' },
      { key: 'receipt_show_customer', value: 'true' },
      { key: 'receipt_show_tax_breakdown', value: 'true' },
      { key: 'receipt_show_service_charge', value: 'false' },
      { key: 'receipt_show_footer', value: 'true' },
      { key: 'receipt_header_note', value: 'જય શ્રી કૃષ્ણ! પધારજો...' },
      { key: 'receipt_custom_footer', value: 'મુલાકાત બદલ આભાર! ફરી પધારશો... 🙏' },
      { key: 'kds_refresh_seconds', value: '10' },
      { key: 'kds_warning_minutes', value: '15' },
      { key: 'kds_critical_minutes', value: '25' },
      { key: 'kds_audio_alert', value: 'true' },
      { key: 'kds_group_by_station', value: 'true' },
      { key: 'tables_dining_warning_minutes', value: '45' },
      { key: 'tables_auto_vacate_on_settlement', value: 'true' },
      { key: 'token_auto_clear_seconds', value: '120' },
      { key: 'token_voice_announcement', value: 'false' },
      { key: 'token_prefix', value: 'BB-T' },
      { key: 'inventory_auto_recipe_deduction', value: 'true' },
      { key: 'inventory_allow_negative_stock', value: 'false' },
      { key: 'inventory_low_stock_threshold_percentage', value: '20' },
      { key: 'purchase_po_approval_threshold', value: '10000' },
      { key: 'accounts_default_cash_account', value: 'Cash in Drawer' },
      { key: 'accounts_cash_variance_alert_threshold', value: '200' },
      { key: 'accounts_auto_journal_on_billing', value: 'true' },
      { key: 'dayclosing_require_drawer_cash_count', value: 'true' },
      { key: 'attendance_shift_duration_hours', value: '9' },
      { key: 'attendance_grace_period_minutes', value: '15' },
      { key: 'attendance_half_day_hours', value: '4.5' },
      { key: 'attendance_overtime_multiplier', value: '1.5' },
      { key: 'payroll_monthly_calculation_days', value: '30' },
      { key: 'security_manager_pin', value: '1234' },
      { key: 'security_session_timeout_minutes', value: '480' },
      { key: 'security_audit_log_retention_days', value: '365' },
      { key: 'system_status', value: 'ONLINE' }
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

  // Categories Definition with All 15 Enterprise Modules
  const CATEGORIES = [
    { id: 'profile', label: 'Store Profile & Legal', icon: <Building2 size={16} /> },
    { id: 'datetime', label: 'Date, Time & Formats', icon: <Calendar size={16} /> },
    { id: 'taxes', label: 'Taxes, GST & Charges', icon: <Percent size={16} /> },
    { id: 'pos', label: 'POS & Ordering Rules', icon: <UtensilsCrossed size={16} /> },
    { id: 'billing', label: 'Billing & Invoices', icon: <Receipt size={16} /> },
    { id: 'payments', label: 'Payment Settlement', icon: <CreditCard size={16} /> },
    { id: 'printer', label: 'Thermal Printer & Slips', icon: <Printer size={16} /> },
    { id: 'kds', label: 'Kitchen KDS & KOT', icon: <UtensilsCrossed size={16} /> },
    { id: 'tables', label: 'Tables & Floor Map', icon: <Grid size={16} /> },
    { id: 'tokens', label: 'Token Queue & Seating', icon: <Ticket size={16} /> },
    { id: 'inventory', label: 'Inventory & Recipe BOM', icon: <Boxes size={16} /> },
    { id: 'procurement', label: 'Purchases & PO Rules', icon: <Truck size={16} /> },
    { id: 'accounts', label: 'Accounts & Day Closing', icon: <BookCheck size={16} /> },
    { id: 'staff', label: 'Staff & Security', icon: <Users size={16} /> },
    { id: 'registry', label: 'Custom Registry (All Keys)', icon: <Sliders size={16} /> }
  ];

  return (
    <div className="d-flex flex-column gap-3" style={{ fontSize: '0.85rem' }}>
      {/* Top Header - Perfect Box Style with Bhatigal Maroon Accents */}
      <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #7A1B28' }}>
        <div className="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-3 shadow-sm text-white flex-shrink-0"
              style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #7A1B28 0%, #4A0E17 100%)' }}
            >
              <Sliders size={22} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h5 className="fw-bold mb-0 text-dark">Central Store & Module Settings</h5>
                <span className="badge px-2 py-0.5" style={{ background: '#FDF2E9', color: '#7A1B28', border: '1px solid #F5C6CB', fontSize: '0.72rem' }}>
                  Universal Control Engine
                </span>
              </div>
              <p className="text-muted small mb-0 mt-0.5">
                તમામ મોડ્યુલ, વર્કફ્લો, નિયમો અને ડિજિટલ સેટિંગ્સ - કોડ બદલ્યા વગર સંપૂર્ણ કંટ્રોલ
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {can('settings.reset') && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={handleResetToDefaults}
                title="Reset all settings to factory defaults"
              >
                <RotateCcw size={14} /> Reset Defaults
              </button>
            )}

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
                className="btn btn-sm text-white d-flex align-items-center gap-1 shadow-sm fw-bold px-3"
                style={{ backgroundColor: '#7A1B28', borderColor: '#7A1B28' }}
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

      {/* Main Settings Panel: Categories on Left, Form on Right */}
      <div className="row g-3">
        {/* Left Navigation Category List */}
        <div className="col-lg-3 col-md-4">
          <div className="card shadow-sm border-0 overflow-hidden">
            <div className="card-header bg-white py-2 px-3 border-bottom">
              <span className="fw-bold small text-secondary text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Module Categories (કંટ્રોલ મોડ્યુલ્સ)
              </span>
            </div>
            <div className="list-group list-group-flush" style={{ fontSize: '0.8rem' }}>
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`list-group-item list-group-item-action d-flex align-items-center gap-2 py-2.5 px-3 border-0 ${
                      isActive ? 'active fw-bold shadow-sm' : 'text-dark'
                    }`}
                    style={isActive ? { backgroundColor: '#7A1B28', borderColor: '#7A1B28' } : {}}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span className={isActive ? 'text-white' : 'text-danger'}>
                      {cat.icon}
                    </span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
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
                      <label className="form-label small fw-bold text-secondary mb-1">Restaurant Brand Name (English)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_name', 'Bhatigal Bhanu (ભાતીગળ ભાણું)')}
                        onChange={e => handleUpdate('restaurant_name', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Brand Name (Gujarati / પ્રાદેશિક)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_name_gujarati', 'ભાતીગળ ભાણું')}
                        onChange={e => handleUpdate('restaurant_name_gujarati', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Tagline / Subtitle (સ્લોગન)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_tagline', '...ભાવ, ભજન અને ભોજનનો ત્રિવેણી સંગમ...')}
                        onChange={e => handleUpdate('restaurant_tagline', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Official Website</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('restaurant_website', 'https://bhatigalbhanu.com')}
                        onChange={e => handleUpdate('restaurant_website', e.target.value)}
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
                        value={getVal('restaurant_address', 'Kothariya Ring Road, Near HP Petrol Pump, Rajkot, Gujarat - 360022')}
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
                      <label className="form-label small fw-bold text-secondary mb-1">Currency Code</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('currency_code', 'INR')}
                        onChange={e => handleUpdate('currency_code', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">System Timezone</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('system_timezone', 'Asia/Kolkata')}
                        onChange={e => handleUpdate('system_timezone', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 2. DATE, TIME & FORMATS                                   */}
              {/* ======================================================== */}
              {activeCategory === 'datetime' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Date, Time & Localization Formats</h6>
                    <small className="text-muted">તારીખ, સમય અને નાણાકીય વર્ષના ફોર્મેટ્સ જે સમગ્ર સિસ્ટમમાં પ્રદર્શિત થાય છે</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Date Display Format (તારીખ ફોર્મેટ)</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('date_format', 'DD/MM/YYYY')}
                        onChange={e => handleUpdate('date_format', e.target.value)}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (દા.ત. 12/09/2026 - Standard India)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (દા.ત. 2026-09-12 - ISO Standard)</option>
                        <option value="DD-MM-YYYY">DD-MM-YYYY (દા.ત. 12-09-2026 - Dash Separated)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Time Display Format (સમય ફોર્મેટ)</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('time_format', '12_HOUR')}
                        onChange={e => handleUpdate('time_format', e.target.value)}
                      >
                        <option value="12_HOUR">12-Hour AM/PM (દા.ત. 03:30 PM - Traditional)</option>
                        <option value="24_HOUR">24-Hour Military (દા.ત. 15:30 - Railway Time)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Financial Year Start (નાણાકીય વર્ષ પ્રારંભ)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="MM-DD"
                        value={getVal('financial_year_start', '04-01')}
                        onChange={e => handleUpdate('financial_year_start', e.target.value)}
                      />
                      <small className="text-muted">Standard Indian FY starts on 04-01 (1st April)</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Daily Opening Time</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('opening_time', '10:00 AM')}
                        onChange={e => handleUpdate('opening_time', e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Daily Closing Time</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('closing_time', '11:30 PM')}
                        onChange={e => handleUpdate('closing_time', e.target.value)}
                      />
                    </div>

                    {/* Live Preview Box */}
                    <div className="col-12 mt-2">
                      <div className="p-3 rounded-3 bg-light border d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div>
                          <span className="badge bg-secondary mb-1">Live Format Preview</span>
                          <div className="fw-bold fs-6 text-dark">
                            Current Formatted Date & Time:
                          </div>
                          <div className="text-danger font-monospace fw-bold fs-5 mt-1">
                            {formatStoreDate(new Date(), getVal('date_format', 'DD/MM/YYYY'))} {formatStoreTime(new Date(), getVal('time_format', '12_HOUR'))}
                          </div>
                        </div>
                        <div className="text-muted small">
                          Changes take effect across Billing, Invoices, KDS, and Reports upon save.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 3. TAXES, GST & CHARGES                                   */}
              {/* ======================================================== */}
              {activeCategory === 'taxes' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Taxes, GST & Additional Charges (%)</h6>
                    <small className="text-muted">જીએસટી ટકાવારી, સર્વિસ ચાર્જ, પેકિંગ ચાર્જ અને ડિસ્કાઉન્ટ લિમિટ</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="tax_gst_enabled"
                          checked={getBool('tax_gst_enabled', true)}
                          onChange={e => handleUpdate('tax_gst_enabled', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="tax_gst_enabled">
                          Enable GST Tax Calculation (GST સક્રિય કરો)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Turn off to disable GST collection on all customer invoices
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="tax_inclusive_pricing"
                          checked={getBool('tax_inclusive_pricing', false)}
                          onChange={e => handleUpdate('tax_inclusive_pricing', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="tax_inclusive_pricing">
                          Menu Prices are Tax Inclusive (મેનુ ભાવમાં ટેક્સ શામેલ છે)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        When enabled, menu price includes GST. When off, GST is added on top.
                      </small>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Total GST Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={getVal('tax_gst_percentage', '5.0')}
                        onChange={e => {
                          const v = e.target.value;
                          handleUpdate('tax_gst_percentage', v);
                          const half = (parseFloat(v) || 0) / 2;
                          handleUpdate('tax_cgst_percentage', String(half));
                          handleUpdate('tax_sgst_percentage', String(half));
                        }}
                      />
                      <small className="text-muted">Standard Restaurant GST: 5%</small>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">CGST Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={getVal('tax_cgst_percentage', '2.5')}
                        onChange={e => handleUpdate('tax_cgst_percentage', e.target.value)}
                      />
                      <small className="text-muted">Central GST portion (2.5%)</small>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">SGST Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={getVal('tax_sgst_percentage', '2.5')}
                        onChange={e => handleUpdate('tax_sgst_percentage', e.target.value)}
                      />
                      <small className="text-muted">State GST portion (2.5%)</small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="service_charge_enabled"
                          checked={getBool('service_charge_enabled', false)}
                          onChange={e => handleUpdate('service_charge_enabled', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="service_charge_enabled">
                          Enable Service Charge (સર્વિસ ચાર્જ ચાલુ કરો)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Optional restaurant dining service fee
                      </small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Service Charge Percentage (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        className="form-control form-control-sm"
                        value={getVal('service_charge_percentage', '0.0')}
                        onChange={e => handleUpdate('service_charge_percentage', e.target.value)}
                      />
                      <small className="text-muted">Applied to bill subtotal if enabled</small>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Takeaway Packaging Fee (₹)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('packaging_charge_takeaway', '20')}
                        onChange={e => handleUpdate('packaging_charge_takeaway', e.target.value)}
                      />
                      <small className="text-muted">Fixed container fee for parcel orders</small>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Home Delivery Charge (₹)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('delivery_charge_fixed', '40')}
                        onChange={e => handleUpdate('delivery_charge_fixed', e.target.value)}
                      />
                      <small className="text-muted">Standard delivery fee per order</small>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Max Cashier Discount (%)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('max_discount_percentage', '10')}
                        onChange={e => handleUpdate('max_discount_percentage', e.target.value)}
                      />
                      <small className="text-muted">Higher discounts require Manager PIN</small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 4. POS & ORDERING RULES                                  */}
              {/* ======================================================== */}
              {activeCategory === 'pos' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">POS Terminal & Order Placement Rules</h6>
                    <small className="text-muted">Control checkout cashier workflow, modifier notes, and ordering behavior</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="pos_allow_quick_order"
                          checked={getBool('pos_allow_quick_order', true)}
                          onChange={e => handleUpdate('pos_allow_quick_order', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="pos_allow_quick_order">
                          Allow Quick Counter Orders (ઝડપી કાઉન્ટર ઓર્ડર)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Allows instant billing directly without selecting a dining table
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="pos_enforce_table"
                          checked={getBool('pos_enforce_table', false)}
                          onChange={e => handleUpdate('pos_enforce_table', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="pos_enforce_table">
                          Enforce Table Selection for Dine-In (ટેબલ પસંદગી ફરજિયાત)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Cashier cannot place dine-in orders without assigning an available table
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="pos_allow_modifiers"
                          checked={getBool('pos_allow_modifiers', true)}
                          onChange={e => handleUpdate('pos_allow_modifiers', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="pos_allow_modifiers">
                          Enable Cooking Notes & Spice Modifiers (રસોઈ નોંધ / મસાલા કસ્ટમાઇઝેશન)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Enables spicy, Jain, medium, and custom chef instructions per dish
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="pos_sound_alert"
                          checked={getBool('pos_sound_alert', true)}
                          onChange={e => handleUpdate('pos_sound_alert', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="pos_sound_alert">
                          POS Audio Beep on Item Add (આઇટમ ઉમેરવા પર ઓડિયો બીપ)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Gives audible confirmation when an item is added to cart
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="orders_auto_send_kot"
                          checked={getBool('orders_auto_send_kot', false)}
                          onChange={e => handleUpdate('orders_auto_send_kot', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="orders_auto_send_kot">
                          Auto Send KOT on Order Save (ઓર્ડર સેવ થતાં આપોઆપ KOT રસોડામાં મોકલો)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Instantly dispatches ticket to kitchen KDS without manual print click
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="orders_takeaway_customer_mandatory"
                          checked={getBool('orders_takeaway_customer_mandatory', true)}
                          onChange={e => handleUpdate('orders_takeaway_customer_mandatory', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="orders_takeaway_customer_mandatory">
                          Mandatory Customer Details for Takeaway/Delivery
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Requires Customer Name and Mobile Number before parcel checkout
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="billing_allow_custom_price"
                          checked={getBool('billing_allow_custom_price', false)}
                          onChange={e => handleUpdate('billing_allow_custom_price', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="billing_allow_custom_price">
                          Allow Custom Price Overrides at Billing
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Enables cashiers or managers to modify dish prices dynamically on cart
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 5. BILLING & INVOICES                                    */}
              {/* ======================================================== */}
              {activeCategory === 'billing' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Billing Rules, Invoices & Tax Calculations</h6>
                    <small className="text-muted">બિલિંગ જનરેશન, રાઉન્ડ-ઓફ, ઇનવોઇસ પ્રિફિક્સ અને સર્વ ચકાસણી નિયમો</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="billing_require_order_served"
                          checked={getBool('billing_require_order_served', true)}
                          onChange={e => handleUpdate('billing_require_order_served', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="billing_require_order_served">
                          Enforce Order Status "SERVED" before Billing
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        બિલ બનાવતા પહેલા ઓર્ડર સર્વ થયેલો હોવો જોઈએ. જો બંધ કરો તો રસોડામાંથી ઓર્ડર બન્યા વગર પણ સીધું બિલ બની જશે (Bypass).
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="billing_confirm_before_generation"
                          checked={getBool('billing_confirm_before_generation', true)}
                          onChange={e => handleUpdate('billing_confirm_before_generation', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="billing_confirm_before_generation">
                          Show Confirmation Prompt before Creating Bill
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        બિલ બનાવતા પહેલાં કેશિયરને કન્ફર્મેશન પૂછશે કે શું બિલ બનાવવું છે?
                      </small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Invoice Number Prefix (ઇનવોઇસ પ્રિફિક્સ)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        value={getVal('bill_invoice_prefix', 'BB-INV-')}
                        onChange={e => handleUpdate('bill_invoice_prefix', e.target.value)}
                      />
                      <small className="text-muted">Example: BB-INV-0001</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Kitchen KOT Prefix (KOT પ્રિફિક્સ)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        value={getVal('bill_kot_prefix', 'KOT-')}
                        onChange={e => handleUpdate('bill_kot_prefix', e.target.value)}
                      />
                      <small className="text-muted">Example: KOT-0142</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Bill Amount Round-off Mode (રાઉન્ડિંગ)</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('bill_rounding_mode', 'NEAREST')}
                        onChange={e => handleUpdate('bill_rounding_mode', e.target.value)}
                      >
                        <option value="NEAREST">Nearest Whole Rupee (દા.ત. ₹124.40 -&gt; ₹124, ₹124.60 -&gt; ₹125)</option>
                        <option value="UP">Always Round UP (દા.ત. ₹124.10 -&gt; ₹125.00)</option>
                        <option value="DOWN">Always Round DOWN (દા.ત. ₹124.90 -&gt; ₹124.00)</option>
                        <option value="NONE">Exact Paise - No Rounding (દા.ત. ₹124.75)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="billing_allow_split_bill"
                          checked={getBool('billing_allow_split_bill', true)}
                          onChange={e => handleUpdate('billing_allow_split_bill', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="billing_allow_split_bill">
                          Allow Split Invoices (ભાગલા બિલિંગની પરવાનગી)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Allows guest parties to split invoice payment across persons
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="billing_prevent_duplicate_invoice"
                          checked={getBool('billing_prevent_duplicate_invoice', true)}
                          onChange={e => handleUpdate('billing_prevent_duplicate_invoice', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="billing_prevent_duplicate_invoice">
                          Prevent Duplicate Invoicing (ડુપ્લિકેટ બિલ રોકો)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Prevents generating multiple bills for the same table order
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 6. PAYMENT SETTLEMENT                                    */}
              {/* ======================================================== */}
              {activeCategory === 'payments' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Payment Modes, Auto Receipt & Chime Sound</h6>
                    <small className="text-muted">પેમેન્ટ સ્વીકારવાના વિકલ્પો, ઓટો પ્રિન્ટ અને પેમેન્ટ સફળતા ઓડિયો ચાઇમ</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="payment_auto_print_receipt"
                          checked={getBool('payment_auto_print_receipt', true)}
                          onChange={e => handleUpdate('payment_auto_print_receipt', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="payment_auto_print_receipt">
                          Auto Print Receipt on Payment (પેમેન્ટ થતાં આપોઆપ પ્રિન્ટ)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Automatically sends receipt slip to thermal printer immediately after payment
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="payment_auto_download_pdf"
                          checked={getBool('payment_auto_download_pdf', false)}
                          onChange={e => handleUpdate('payment_auto_download_pdf', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="payment_auto_download_pdf">
                          Auto Download PDF Invoice on Payment (ઓટો PDF ડાઉનલોડ)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Automatically downloads a clean PDF copy for computer records
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="payment_audio_chime"
                          checked={getBool('payment_audio_chime', true)}
                          onChange={e => handleUpdate('payment_audio_chime', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="payment_audio_chime">
                          Play Payment Success Sound (પેમેન્ટ સક્સેસ અવાજ)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Plays pleasant two-tone confirmation chime when payment settles
                      </small>
                    </div>

                    <div className="col-md-6 d-flex align-items-center">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 shadow-sm mt-2"
                        onClick={() => playPaymentChime()}
                      >
                        <Volume2 size={15} /> Test Payment Sound (અવાજ ચેક કરો)
                      </button>
                    </div>

                    <div className="col-md-3">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="payment_enable_cash"
                          checked={getBool('payment_enable_cash', true)}
                          onChange={e => handleUpdate('payment_enable_cash', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="payment_enable_cash">
                          Cash (રોકડ)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-3">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="payment_enable_upi"
                          checked={getBool('payment_enable_upi', true)}
                          onChange={e => handleUpdate('payment_enable_upi', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="payment_enable_upi">
                          UPI / QR Code (GPay, Paytm, PhonePe)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-3">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="payment_enable_card"
                          checked={getBool('payment_enable_card', true)}
                          onChange={e => handleUpdate('payment_enable_card', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="payment_enable_card">
                          Credit / Debit Card (કાર્ડ)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-3">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="payment_enable_split"
                          checked={getBool('payment_enable_split', true)}
                          onChange={e => handleUpdate('payment_enable_split', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="payment_enable_split">
                          Split Payments (મિક્સ પેમેન્ટ)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 7. THERMAL PRINTER & SLIPS                               */}
              {/* ======================================================== */}
              {activeCategory === 'printer' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">80mm / 58mm Thermal Printer & Bill Slips</h6>
                    <small className="text-muted">થર્મલ પ્રિન્ટર પેપર સાઈઝ, ફોન્ટ સાઇઝ, કોપીઓ અને સ્લિપ લખાણ સેટિંગ્સ</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Receipt Paper Size (પેપર સાઈઝ)</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('receipt_format', '80MM')}
                        onChange={e => handleUpdate('receipt_format', e.target.value)}
                      >
                        <option value="80MM">80mm Standard POS Thermal Roll (3 Inch - રેસ્ટોરન્ટ સ્ટાન્ડર્ડ)</option>
                        <option value="58MM">58mm Compact Thermal Roll (2 Inch - નાનું પ્રિન્ટર)</option>
                        <option value="A4">A4 Full Sheet Laser Invoice (ઓફિસ પ્રિન્ટર)</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Print Font Scale (ફોન્ટ સાઈઝ)</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('print_font_scale', 'MEDIUM')}
                        onChange={e => handleUpdate('print_font_scale', e.target.value)}
                      >
                        <option value="SMALL">Small (બારીક અને કોમ્પેક્ટ - કાગળ બચાવે)</option>
                        <option value="MEDIUM">Medium (સ્ટાન્ડર્ડ સ્પષ્ટ વાંચન)</option>
                        <option value="LARGE">Large (મોટા અને ઘટ્ટ અક્ષરો)</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Number of Receipt Copies (પ્રિન્ટ નકલો)</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('receipt_copies', '1')}
                        onChange={e => handleUpdate('receipt_copies', e.target.value)}
                      >
                        <option value="1">1 Copy (Customer Only)</option>
                        <option value="2">2 Copies (Customer + Restaurant Audit)</option>
                        <option value="3">3 Copies (Customer + Audit + Kitchen)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Receipt Header Greeting (ટોચની શુભેચ્છા)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('receipt_header_note', 'જય શ્રી કૃષ્ણ! પધારજો...')}
                        onChange={e => handleUpdate('receipt_header_note', e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Receipt Custom Footer Note (આભાર લખાણ)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('receipt_custom_footer', 'મુલાકાત બદલ આભાર! ફરી પધારશો... 🙏')}
                        onChange={e => handleUpdate('receipt_custom_footer', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="receipt_show_logo"
                          checked={getBool('receipt_show_logo', true)}
                          onChange={e => handleUpdate('receipt_show_logo', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="receipt_show_logo">
                          Show Restaurant Logo (લોગો બતાવો)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="receipt_show_gstin"
                          checked={getBool('receipt_show_gstin', true)}
                          onChange={e => handleUpdate('receipt_show_gstin', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="receipt_show_gstin">
                          Show GSTIN & FSSAI (ટેક્સ નંબર)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="receipt_show_table"
                          checked={getBool('receipt_show_table', true)}
                          onChange={e => handleUpdate('receipt_show_table', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="receipt_show_table">
                          Show Table / Token No (ટેબલ નંબર)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="receipt_show_customer"
                          checked={getBool('receipt_show_customer', true)}
                          onChange={e => handleUpdate('receipt_show_customer', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="receipt_show_customer">
                          Show Customer Name & Phone
                        </label>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="receipt_show_tax_breakdown"
                          checked={getBool('receipt_show_tax_breakdown', true)}
                          onChange={e => handleUpdate('receipt_show_tax_breakdown', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="receipt_show_tax_breakdown">
                          Show Tax Breakdown (CGST/SGST)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="auto_kot_print"
                          checked={getBool('auto_kot_print', true)}
                          onChange={e => handleUpdate('auto_kot_print', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="auto_kot_print">
                          Auto Print Kitchen KOT Slip
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 8. KITCHEN KDS & KOT                                     */}
              {/* ======================================================== */}
              {activeCategory === 'kds' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Kitchen Display System (KDS) & KOT Workflows</h6>
                    <small className="text-muted">રસોડા સ્ક્રીન રિફ્રેશ રેટ, ઓર્ડર વિલંબ ચેતવણી સમય અને ઓડિયો બીપ</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">KDS Auto-Refresh Interval (સેકન્ડ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('kds_refresh_seconds', '10')}
                        onChange={e => handleUpdate('kds_refresh_seconds', e.target.value)}
                      />
                      <small className="text-muted">Seconds between automatic poll for new kitchen orders</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Preparation Warning Threshold (મિનિટ - પીળો રંગ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('kds_warning_minutes', '15')}
                        onChange={e => handleUpdate('kds_warning_minutes', e.target.value)}
                      />
                      <small className="text-muted">Turns card yellow if food is not ready in this time</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Critical Delay Threshold (મિનિટ - લાલ રંગ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('kds_critical_minutes', '25')}
                        onChange={e => handleUpdate('kds_critical_minutes', e.target.value)}
                      />
                      <small className="text-muted">Turns card red and flashes if food is critically delayed</small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="kds_audio_alert"
                          checked={getBool('kds_audio_alert', true)}
                          onChange={e => handleUpdate('kds_audio_alert', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="kds_audio_alert">
                          Kitchen Audio Bell on New Order (નવા ઓર્ડર પર ઘંટડી વાગશે)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="kds_group_by_station"
                          checked={getBool('kds_group_by_station', true)}
                          onChange={e => handleUpdate('kds_group_by_station', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="kds_group_by_station">
                          Group KOT by Kitchen Station (સ્ટેશન મુજબ વર્ગીકરણ)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Routes items to Main Kitchen, Tandoor, Gujarati Thali counter, or Beverages
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 9. TABLES & FLOOR MAP                                    */}
              {/* ======================================================== */}
              {activeCategory === 'tables' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Tables, Floor Map & Dining Flow</h6>
                    <small className="text-muted">ડાઇનિંગ ટેબલ ખાલી કરવાના નિયમો, સમય ચેતવણી અને ટ્રાન્સફર પરવાનગી</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Dining Duration Warning (મિનિટ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('tables_dining_warning_minutes', '45')}
                        onChange={e => handleUpdate('tables_dining_warning_minutes', e.target.value)}
                      />
                      <small className="text-muted">Highlights occupied tables on floor map when duration exceeds this limit</small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="tables_auto_vacate_on_settlement"
                          checked={getBool('tables_auto_vacate_on_settlement', true)}
                          onChange={e => handleUpdate('tables_auto_vacate_on_settlement', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="tables_auto_vacate_on_settlement">
                          Auto Vacate Table upon Settlement (પેમેન્ટ થતાં આપોઆપ ખાલી કરો)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Automatically changes table status from Occupied to Available when paid
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="tables_prevent_double_booking"
                          checked={getBool('tables_prevent_double_booking', true)}
                          onChange={e => handleUpdate('tables_prevent_double_booking', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="tables_prevent_double_booking">
                          Prevent Double Table Booking (એક ટેબલ પર બે ઓર્ડર રોકો)
                        </label>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="tables_allow_table_transfer"
                          checked={getBool('tables_allow_table_transfer', true)}
                          onChange={e => handleUpdate('tables_allow_table_transfer', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="tables_allow_table_transfer">
                          Allow Live Table Transfer & Merging (ટેબલ બદલવાની પરવાનગી)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 10. TOKEN QUEUE & SEATING                                */}
              {/* ======================================================== */}
              {activeCategory === 'tokens' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Waiting Tokens, TV Screen & Queue Engine</h6>
                    <small className="text-muted">વેઇટિંગ ટોકન પ્રિફિક્સ, ટીવી સ્ક્રીન જાહેરાત અને ઓટો ક્લીનઅપ</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Token Number Prefix (ટોકન પ્રિફિક્સ)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        value={getVal('token_prefix', 'BB-T')}
                        onChange={e => handleUpdate('token_prefix', e.target.value)}
                      />
                      <small className="text-muted">Example: BB-T001, BB-T002</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">TV Display Auto-Clear Delay (સેકન્ડ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('token_auto_clear_seconds', '120')}
                        onChange={e => handleUpdate('token_auto_clear_seconds', e.target.value)}
                      />
                      <small className="text-muted">Duration served token stays visible on waiting lounge TV</small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="token_voice_announcement"
                          checked={getBool('token_voice_announcement', false)}
                          onChange={e => handleUpdate('token_voice_announcement', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="token_voice_announcement">
                          Enable Voice Announcement on TV (ટોકન બોલવાનો અવાજ)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Uses speech synthesis to announce "Token number 12, Table 4 ready"
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="token_sms_notification"
                          checked={getBool('token_sms_notification', true)}
                          onChange={e => handleUpdate('token_sms_notification', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="token_sms_notification">
                          Send SMS Notification when Table is Ready
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 11. INVENTORY & RECIPE BOM                               */}
              {/* ======================================================== */}
              {activeCategory === 'inventory' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Inventory Control, BOM Recipe Deduction & Stock Rules</h6>
                    <small className="text-muted">રેસિપી મુજબ કાચા માલનો આપોઆપ ઘટાડો અને લઘુત્તમ સ્ટોક એલર્ટ</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="inventory_auto_recipe_deduction"
                          checked={getBool('inventory_auto_recipe_deduction', true)}
                          onChange={e => handleUpdate('inventory_auto_recipe_deduction', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="inventory_auto_recipe_deduction">
                          Auto-Deduct Raw Stock via Recipe BOM (રેસિપી મુજબ માલ આપોઆપ બાદ કરો)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        When bill is settled, deducts ingredients (Flour, Oil, Ghee, Spices) automatically
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="inventory_allow_negative_stock"
                          checked={getBool('inventory_allow_negative_stock', false)}
                          onChange={e => handleUpdate('inventory_allow_negative_stock', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="inventory_allow_negative_stock">
                          Allow Negative Inventory Stock (માઈનસ સ્ટોકની પરવાનગી)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        જો ચાલુ હોય તો સ્ટોક શૂન્ય હોવા છતાં પણ બિલ બની શકશે (Negative allowed). બંધ હોય તો સ્ટોક વગર રોકશે.
                      </small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Low Stock Alert Threshold (%)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('inventory_low_stock_threshold_percentage', '20')}
                        onChange={e => handleUpdate('inventory_low_stock_threshold_percentage', e.target.value)}
                      />
                      <small className="text-muted">Sends notification when remaining stock drops below this % of reorder level</small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 12. PURCHASES & PO RULES                                 */}
              {/* ======================================================== */}
              {activeCategory === 'procurement' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Procurement, Vendor Purchase Orders & Approvals</h6>
                    <small className="text-muted">ખરીદી મંજૂરી મર્યાદા અને સપ્લાયર ઓર્ડર નિયમો</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Manager PO Approval Threshold (₹ રકમ મર્યાદા)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('purchase_po_approval_threshold', '10000')}
                        onChange={e => handleUpdate('purchase_po_approval_threshold', e.target.value)}
                      />
                      <small className="text-muted">
                        Purchase Orders above this amount require Super Admin or General Manager digital signature
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 13. ACCOUNTS & DAY CLOSING                               */}
              {/* ======================================================== */}
              {activeCategory === 'accounts' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Double-Entry Accounting & Day Closing Controls</h6>
                    <small className="text-muted">ઓટો જર્નલ એન્ટ્રી, રોકડ તફાવત એલર્ટ અને દિવસ બંધ નિયમો</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Default Cash Ledger Head (મુખ્ય રોકડ ખાતું)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={getVal('accounts_default_cash_account', 'Cash in Drawer')}
                        onChange={e => handleUpdate('accounts_default_cash_account', e.target.value)}
                      />
                      <small className="text-muted">Account head debited on cash collections</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Cash Variance Alert Threshold (₹ તફાવત એલર્ટ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('accounts_cash_variance_alert_threshold', '200')}
                        onChange={e => handleUpdate('accounts_cash_variance_alert_threshold', e.target.value)}
                      />
                      <small className="text-muted">Flag day closing if physical cash differs from system expected by more than ₹</small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="accounts_auto_journal_on_billing"
                          checked={getBool('accounts_auto_journal_on_billing', true)}
                          onChange={e => handleUpdate('accounts_auto_journal_on_billing', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="accounts_auto_journal_on_billing">
                          Auto-Post Journal Entry on Payment (ઓટો એકાઉન્ટ એન્ટ્રી)
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Creates Debit Cash/Bank and Credit Sales double-entry voucher automatically
                      </small>
                    </div>

                    <div className="col-md-6">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="dayclosing_require_drawer_cash_count"
                          checked={getBool('dayclosing_require_drawer_cash_count', true)}
                          onChange={e => handleUpdate('dayclosing_require_drawer_cash_count', e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="dayclosing_require_drawer_cash_count">
                          Require Physical Currency Denomination Count on Day Closing
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Requires cashier to enter ₹500, ₹200, ₹100, ₹50 note counts before shift end
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 14. STAFF, ATTENDANCE & SECURITY                         */}
              {/* ======================================================== */}
              {activeCategory === 'staff' && (
                <div className="d-flex flex-column gap-3">
                  <div className="border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Staff Shifts, Attendance Rules & Security PINs</h6>
                    <small className="text-muted">હાજરી સમય, ઓવરટાઇમ ગણતરી, મેનેજર પિન અને સિક્યોરિટી ટાઇમ-આઉટ</small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Standard Shift Duration (કલાક)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('attendance_shift_duration_hours', '9')}
                        onChange={e => handleUpdate('attendance_shift_duration_hours', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Late Grace Period (મિનિટ છૂટછાટ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('attendance_grace_period_minutes', '15')}
                        onChange={e => handleUpdate('attendance_grace_period_minutes', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Half-Day Minimum Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        className="form-control form-control-sm"
                        value={getVal('attendance_half_day_hours', '4.5')}
                        onChange={e => handleUpdate('attendance_half_day_hours', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Overtime Pay Rate Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={getVal('attendance_overtime_multiplier', '1.5')}
                        onChange={e => handleUpdate('attendance_overtime_multiplier', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Payroll Monthly Calculation Days</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('payroll_monthly_calculation_days', '30')}
                        onChange={e => handleUpdate('payroll_monthly_calculation_days', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Manager Override PIN (મેનેજર પિન)</label>
                      <input
                        type="password"
                        className="form-control form-control-sm font-monospace"
                        value={getVal('security_manager_pin', '1234')}
                        onChange={e => handleUpdate('security_manager_pin', e.target.value)}
                      />
                      <small className="text-muted">Required to bypass discount limits or void bills</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Session Inactivity Timeout (મિનિટ)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={getVal('security_session_timeout_minutes', '480')}
                        onChange={e => handleUpdate('security_session_timeout_minutes', e.target.value)}
                      />
                      <small className="text-muted">Auto logout user if portal is idle for minutes</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">ERP Operation Status Mode</label>
                      <select
                        className="form-select form-select-sm"
                        value={getVal('system_status', 'ONLINE')}
                        onChange={e => handleUpdate('system_status', e.target.value)}
                      >
                        <option value="ONLINE">ONLINE (સામાન્ય વ્યવસાય ચાલુ)</option>
                        <option value="MAINTENANCE">MAINTENANCE (સિસ્ટમ જાળવણી મોડ)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 15. CUSTOM REGISTRY                                      */}
              {/* ======================================================== */}
              {activeCategory === 'registry' && (
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2">
                    <div>
                      <h6 className="fw-bold text-dark mb-0">Custom ERP Registry Key-Value Store</h6>
                      <small className="text-muted">Direct database access to all configured parameters across Bhatigal Bhanu ERP</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
                        <span className="input-group-text bg-white border-end-0">
                          <Search size={14} className="text-muted" />
                        </span>
                        <input
                          type="text"
                          className="form-control border-start-0"
                          placeholder="Search key or value..."
                          value={registrySearch}
                          onChange={e => setRegistrySearch(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
                        onClick={() => setIsAddModalOpen(true)}
                      >
                        <Plus size={14} /> Add Parameter
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive border rounded-3 bg-white">
                    <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                      <thead className="table-light text-secondary text-uppercase" style={{ fontSize: '0.7rem' }}>
                        <tr>
                          <th className="ps-3" style={{ width: '25%' }}>Parameter Key</th>
                          <th style={{ width: '30%' }}>Active Value</th>
                          <th style={{ width: '15%' }}>Category</th>
                          <th style={{ width: '20%' }}>Description</th>
                          <th className="text-end pe-3" style={{ width: '10%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRegistry.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-muted">
                              No settings found matching your search.
                            </td>
                          </tr>
                        ) : (
                          filteredRegistry.map(item => (
                            <tr key={item.key}>
                              <td className="ps-3 font-monospace fw-bold text-dark">
                                {item.key}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm font-monospace"
                                  style={{ fontSize: '0.78rem' }}
                                  value={settings[item.key] !== undefined ? settings[item.key] : item.value}
                                  onChange={e => handleUpdate(item.key, e.target.value)}
                                />
                              </td>
                              <td>
                                <span className="badge bg-secondary-subtle text-secondary px-2 py-0.5">
                                  {item.category || 'CUSTOM'}
                                </span>
                              </td>
                              <td className="text-muted text-truncate" style={{ maxWidth: 200 }} title={item.description}>
                                {item.description || '-'}
                              </td>
                              <td className="text-end pe-3">
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm p-1 border-0"
                                  title="Delete setting"
                                  onClick={() => handleDeleteSetting(item.key)}
                                >
                                  <Trash2 size={15} />
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

      {/* Add Custom Setting Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          title="Add New Custom ERP Setting (નવો પેરામીટર ઉમેરો)"
          onClose={() => setIsAddModalOpen(false)}
        >
          <form onSubmit={handleAddCustomSetting} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label small fw-bold text-secondary mb-1">
                Setting Key Name (e.g. pos_max_items_per_order)
              </label>
              <input
                type="text"
                required
                className="form-control form-control-sm font-monospace"
                placeholder="lowercase_with_underscores"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
              />
              <small className="text-muted">Unique identifier used by the backend and frontend</small>
            </div>

            <div>
              <label className="form-label small fw-bold text-secondary mb-1">
                Setting Value
              </label>
              <input
                type="text"
                required
                className="form-control form-control-sm"
                placeholder="Initial value (string, number, or boolean)"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label small fw-bold text-secondary mb-1">
                Module Category
              </label>
              <select
                className="form-select form-select-sm"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                <option value="CUSTOM">CUSTOM</option>
                <option value="GENERAL">GENERAL</option>
                <option value="DATETIME">DATETIME</option>
                <option value="TAX">TAX</option>
                <option value="BILLING">BILLING</option>
                <option value="POS">POS</option>
                <option value="PRINT">PRINT</option>
                <option value="KDS">KDS</option>
                <option value="TABLES">TABLES</option>
                <option value="INVENTORY">INVENTORY</option>
                <option value="ACCOUNTS">ACCOUNTS</option>
                <option value="HR">HR</option>
                <option value="SECURITY">SECURITY</option>
              </select>
            </div>

            <div>
              <label className="form-label small fw-bold text-secondary mb-1">
                Description / Purpose
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                placeholder="What this setting controls..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
              />
            </div>

            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm fw-bold px-3"
              >
                Create Setting
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default StoreSettingsPage;
