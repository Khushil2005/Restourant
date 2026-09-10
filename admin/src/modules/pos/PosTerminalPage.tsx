import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { MenuItem, MenuCategory, DiningTable, Order } from '../../types';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Send,
  PauseCircle,
  PlayCircle,
  Receipt,
  X,
  Search,
  Utensils,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';

interface CartItem {
  menuItemId: string;
  itemName: string;
  price: number;
  quantity: number;
  taxRate: number;
  notes: string;
}

import { appCache } from '../../api/cache';

export const PosTerminalPage: React.FC = () => {
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const cachedCategories = appCache.get('/masters/menu-categories')?.data || appCache.get('/masters/menu-categories');
  const cachedItems = appCache.get('/masters/menu-items')?.data || appCache.get('/masters/menu-items');
  const cachedTables = appCache.get('/masters/tables')?.data || appCache.get('/masters/tables');
  const cachedDaily = appCache.get('/daily-menu/today')?.data || appCache.get('/daily-menu/today');

  const [categories, setCategories] = useState<MenuCategory[]>(() => Array.isArray(cachedCategories) ? cachedCategories : []);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => Array.isArray(cachedItems) ? cachedItems : []);
  const [tables, setTables] = useState<DiningTable[]>(() => Array.isArray(cachedTables) ? cachedTables : []);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Order Details
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE'>('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState<string>(searchParams.get('tableId') || '');
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>(searchParams.get('tableNumber') || '');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(searchParams.get('orderId') || null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Line item note modal
  const [noteItemIdx, setNoteItemIdx] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>('');

  // Daily Menu state
  const [isDailyMenuStrict, setIsDailyMenuStrict] = useState<boolean>(() => cachedDaily ? cachedDaily.isStrictEnforced !== false : true);
  const [dailyMenuItemIds, setDailyMenuItemIds] = useState<string[]>(() => cachedDaily?.itemIds || []);
  const [activeDailyDay, setActiveDailyDay] = useState<string>(() => cachedDaily?.effectiveDay || 'TODAY');
  const [dailyMenuNotes, setDailyMenuNotes] = useState<string>(() => cachedDaily?.notes || '');
  const [mobileTab, setMobileTab] = useState<'MENU' | 'CART'>('MENU');

  const loadData = async () => {
    try {
      const [cRes, mRes, tRes, dRes]: any = await Promise.all([
        apiClient.get('/masters/menu-categories'),
        apiClient.get('/masters/menu-items'),
        apiClient.get('/masters/tables'),
        apiClient.get('/daily-menu/today')
      ]);
      if (cRes.success) setCategories(cRes.data);
      if (mRes.success) setMenuItems(mRes.data);
      if (tRes.success) setTables(tRes.data);
      if (dRes.success && dRes.data) {
        setIsDailyMenuStrict(dRes.data.isStrictEnforced !== false);
        setDailyMenuItemIds(dRes.data.itemIds || []);
        setActiveDailyDay(dRes.data.effectiveDay || 'TODAY');
        setDailyMenuNotes(dRes.data.notes || '');
      }

      if (activeOrderId) {
        const oRes: any = await apiClient.get(`/orders/${activeOrderId}`);
        if (oRes.success && oRes.data) {
          const ord = oRes.data;
          setActiveOrder(ord);
          setOrderType(ord.orderType);
          setSelectedTableId(ord.tableId || '');
          setSelectedTableNumber(ord.tableNumber || '');
          setCustomerName(ord.customerName || '');
          setCustomerPhone(ord.customerPhone || '');
        }
      }
    } catch (err) {
      console.error('Failed to load POS data:', err);
    }
  };

  const handleSwitchDailyDay = async (day: string) => {
    try {
      const res: any = await apiClient.get(`/daily-menu/today?day=${day}`);
      if (res.success && res.data) {
        setActiveDailyDay(day);
        setDailyMenuItemIds(res.data.itemIds || []);
        setDailyMenuNotes(res.data.notes || '');
      }
    } catch (err) {
      console.error('Failed to switch daily menu day:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrderId]);

  const handleAddToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      alert('This dish is currently marked as unavailable/sold out.');
      return;
    }

    if (isDailyMenuStrict && dailyMenuItemIds.length > 0 && !dailyMenuItemIds.includes(item.id)) {
      alert(`"${item.name}" is not scheduled in today's Daily Menu (${activeDailyDay}). Only daily fixed items are available.`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          itemName: item.name,
          price: item.price,
          quantity: 1,
          taxRate: 5.0,
          notes: ''
        }
      ];
    });
  };

  const handleUpdateQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, idx) => idx !== index);
      }
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const cartTax = Math.round((cartSubtotal * 0.05));
  const cartTotal = cartSubtotal + cartTax;

  const existingSubtotal = activeOrder?.totalAmount || 0;
  const existingTax = activeOrder?.taxAmount || 0;
  const grandTotal = (activeOrder?.netAmount || 0) + cartTotal;

  // Place Order / Send KOT
  const handleSendKOT = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Please select dishes to send to the kitchen.');
      return;
    }
    if (orderType === 'DINE_IN' && !selectedTableId) {
      alert('Please select a dining table for Dine-In order.');
      return;
    }

    try {
      if (activeOrderId) {
        // Add running items to existing order
        const res: any = await apiClient.post(`/orders/${activeOrderId}/items`, {
          items: cart.map(it => ({
            menuItemId: it.menuItemId,
            itemName: it.itemName,
            quantity: it.quantity,
            unitPrice: it.price,
            taxRate: it.taxRate,
            notes: it.notes
          }))
        });
        if (res.success) {
          alert('Running KOT ticket sent to kitchen successfully!');
          setCart([]);
          loadData();
        }
      } else {
        const orderPayload = {
          orderType,
          tableId: selectedTableId || undefined,
          tableNumber: selectedTableNumber || undefined,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          items: cart.map(it => ({
            menuItemId: it.menuItemId,
            itemName: it.itemName,
            quantity: it.quantity,
            unitPrice: it.price,
            taxRate: it.taxRate,
            notes: it.notes
          }))
        };
        const res: any = await apiClient.post('/orders', orderPayload);
        if (res.success) {
          alert(`Order ${res.data.order.orderNumber} placed and KOT dispatched!`);
          setCart([]);
          navigate('/tables');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch KOT.');
    }
  };

  // Generate Bill
  const handleGenerateBill = async () => {
    if (!activeOrderId) {
      alert('Please send KOT and place the order before generating a bill.');
      return;
    }
    try {
      const res: any = await apiClient.post('/billing/generate', { orderId: activeOrderId });
      if (res.success) {
        navigate(`/billing?billId=${res.data.id}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate bill.');
    }
  };

  const filteredItems = menuItems.filter(item => {
    // If strict daily menu is active, only show scheduled items ("no other item available")
    if (isDailyMenuStrict && dailyMenuItemIds.length > 0) {
      if (!dailyMenuItemIds.includes(item.id)) {
        return false;
      }
    }
    const matchCategory = selectedCategory === 'ALL' || item.categoryId === selectedCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div
      className="vw-100 d-flex flex-column bg-light"
      style={{ minHeight: '100dvh', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}
    >
      {/* POS Top Header */}
      <header className="navbar navbar-expand navbar-dark bg-dark px-2 px-sm-3 py-2 border-bottom border-secondary d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/tables')}>
            <ArrowLeft size={16} /> <span className="d-none d-sm-inline">Exit POS</span>
          </button>
          <img
            src="/logo.jpg"
            alt="Bhatigal Bhanu"
            className="brand-logo-img shadow-sm"
            style={{ width: 32, height: 32 }}
          />
          <span className="fw-bold text-white fs-6 fs-sm-5 text-truncate" style={{ maxWidth: 160 }}>Bhatigal Bhanu</span>
          <span className="badge bg-gold text-dark fw-bold font-monospace d-none d-sm-inline">TOUCH POS</span>
          {activeOrder && (
            <span className="badge bg-warning text-dark font-monospace small">
              Edit: {activeOrder.orderNumber}
            </span>
          )}
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
          {/* Mobile Cart View Button */}
          <button
            type="button"
            className={`btn btn-sm d-lg-none d-flex align-items-center gap-1 ${mobileTab === 'CART' ? 'btn-primary text-white fw-bold' : 'btn-outline-warning'}`}
            onClick={() => setMobileTab(mobileTab === 'CART' ? 'MENU' : 'CART')}
          >
            <ShoppingBag size={15} />
            <span>{mobileTab === 'CART' ? 'Menu' : `Cart (${cart.length})`}</span>
          </button>

          {/* Order Type Selector */}
          <div className="btn-group btn-group-sm">
            {(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ONLINE'] as const).map(type => (
              <button
                key={type}
                type="button"
                className={`btn px-2 ${orderType === type ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setOrderType(type)}
              >
                {type === 'DINE_IN' ? 'DINE' : type === 'TAKEAWAY' ? 'TAKE' : type === 'DELIVERY' ? 'DELIV' : 'ONL'}
              </button>
            ))}
          </div>

          {/* Table Selector for Dine-in */}
          {orderType === 'DINE_IN' && (
            <select
              className="form-select form-select-sm bg-dark text-white border-secondary"
              style={{ width: 120 }}
              value={selectedTableId}
              onChange={e => {
                setSelectedTableId(e.target.value);
                const t = tables.find(tbl => tbl.id === e.target.value);
                setSelectedTableNumber(t?.tableNumber || '');
              }}
            >
              <option value="">Table</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>
                  {t.tableNumber} ({t.status})
                </option>
              ))}
            </select>
          )}

          {/* Daily Menu Day Selector */}
          <div className="d-none d-md-flex align-items-center gap-1 bg-black bg-opacity-50 px-2 py-1 rounded border border-secondary">
            <span className="text-warning small d-flex align-items-center gap-1 fw-bold" style={{ fontSize: '0.75rem' }}>
              📅 Daily:
            </span>
            <select
              className="form-select form-select-sm bg-dark text-warning border-0 py-0 px-1 fw-bold"
              style={{ width: 'auto', fontSize: '0.78rem', cursor: 'pointer' }}
              value={activeDailyDay}
              onChange={(e) => handleSwitchDailyDay(e.target.value)}
              title="Select Day for Daily Menu"
            >
              <option value="MONDAY">Mon</option>
              <option value="TUESDAY">Tue</option>
              <option value="WEDNESDAY">Wed</option>
              <option value="THURSDAY">Thu</option>
              <option value="FRIDAY">Fri</option>
              <option value="SATURDAY">Sat</option>
              <option value="SUNDAY">Sun</option>
            </select>
            {isDailyMenuStrict && dailyMenuItemIds.length > 0 && (
              <span className="badge bg-danger text-white ms-1" style={{ fontSize: '0.65rem' }}>
                Strict: {dailyMenuItemIds.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Terminal Grid */}
      <div className="d-flex flex-grow-1 overflow-hidden position-relative" style={{ minHeight: 0 }}>
        {/* Left Side: Category Pills + Dishes Grid */}
        <div className={`flex-grow-1 flex-column p-2 p-sm-3 overflow-hidden ${mobileTab === 'CART' ? 'd-none d-lg-flex' : 'd-flex'}`} style={{ minHeight: 0 }}>
          {/* Category filter pills & Search bar */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2 mb-sm-3">
            <div className="scrollable-pills-container gap-1 py-1 flex-grow-1" style={{ maxWidth: 'calc(100% - 170px)' }}>
              <button
                className={`btn btn-sm text-nowrap ${selectedCategory === 'ALL' ? 'btn-primary fw-bold' : 'btn-white border'}`}
                onClick={() => setSelectedCategory('ALL')}
              >
                All Menu
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  className={`btn btn-sm text-nowrap ${selectedCategory === c.id ? 'btn-primary fw-bold' : 'btn-white border'}`}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="input-group input-group-sm ms-auto" style={{ maxWidth: 160, minWidth: 120 }}>
              <span className="input-group-text bg-white border-end-0 px-2"><Search size={14} /></span>
              <input
                type="text"
                className="form-control border-start-0 ps-1"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Daily Menu Info Banner */}
          {isDailyMenuStrict && dailyMenuItemIds.length > 0 && (
            <div className="alert alert-warning py-1 px-3 mb-2 d-flex align-items-center justify-content-between rounded-2 border-0 shadow-sm" style={{ fontSize: '0.8rem' }}>
              <div>
                <strong>📅 રોજિંદુ મેનુ ({activeDailyDay}):</strong> ફક્ત <strong>{dailyMenuItemIds.length}</strong> ફિક્સ કરેલી વાનગીઓ જ ઉપલબ્ધ છે. અન્ય કોઈ વાનગી ઓર્ડર નહીં થાય.
              </div>
              {dailyMenuNotes && <span className="badge bg-dark">{dailyMenuNotes}</span>}
            </div>
          )}

          {/* Menu Items Grid */}
          <div className="flex-grow-1 overflow-auto pe-1">
            <div className="row g-3">
              {filteredItems.map(item => (
                <div key={item.id} className="col-6 col-md-4 col-xl-3">
                  <div
                    className={`card h-100 shadow-sm border-0 rounded-3 p-3 pos-item-card ${
                      !item.isAvailable ? 'opacity-50' : 'cursor-pointer'
                    }`}
                    onClick={() => item.isAvailable && handleAddToCart(item)}
                    style={{ cursor: item.isAvailable ? 'pointer' : 'not-allowed' }}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className={`badge ${item.isVeg ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.65rem' }}>
                        {item.isVeg ? 'VEG' : 'NON-VEG'}
                      </span>
                      <span className="small text-muted font-monospace">{item.code}</span>
                    </div>

                    <h6 className="fw-bold text-dark mb-1 text-truncate">{item.name}</h6>
                    <div className="mt-auto d-flex justify-content-between align-items-center pt-2">
                      <span className="fw-bold text-primary fs-5">₹{item.price}</span>
                      <button className="btn btn-primary btn-sm rounded-circle p-1" style={{ width: 28, height: 28 }}>
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Bottom Cart Floating Bar */}
          <div className="d-lg-none mt-auto pt-2 border-top bg-white px-3 py-2 d-flex justify-content-between align-items-center shadow-sm rounded-2 flex-shrink-0">
            <div>
              <div className="fw-bold text-dark small">
                {(activeOrder?.items.length || 0) + cart.length} items • <span className="text-primary fw-bold">₹{grandTotal}</span>
              </div>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                {orderType} {selectedTableNumber ? `• T-${selectedTableNumber}` : ''}
              </small>
            </div>
            <button
              className="btn btn-primary btn-sm px-3 py-1 fw-bold d-flex align-items-center gap-1 shadow-sm"
              onClick={() => setMobileTab('CART')}
            >
              <ShoppingBag size={15} /> View Cart ({cart.length})
            </button>
          </div>
        </div>

        {/* Right Side: Cart / Order Ticket Sidebar */}
        <div
          className={`bg-white border-start flex-column shadow-sm h-100 ${mobileTab === 'MENU' ? 'd-none d-lg-flex' : 'd-flex'}`}
          style={{
            width: 380,
            maxWidth: '100%',
            flexShrink: 0,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="p-2 p-sm-3 border-bottom bg-light d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-outline-secondary btn-sm d-lg-none p-1"
                onClick={() => setMobileTab('MENU')}
                title="Back to Dishes Menu"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h6 className="fw-bold mb-0 text-dark">
                  {activeOrder ? `Order: ${activeOrder.orderNumber}` : 'Order Ticket'}
                </h6>
                <small className="text-muted">
                  {orderType} {selectedTableNumber ? `• Table ${selectedTableNumber}` : ''}
                </small>
              </div>
            </div>
            <span className="badge bg-primary rounded-pill">
              {(activeOrder?.items.length || 0) + cart.length} Items
            </span>
          </div>

          {/* Cart & Active Items List */}
          <div className="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2">
            {/* Active / Dispatched KOT Items */}
            {activeOrder && activeOrder.items.length > 0 && (
              <div className="mb-2">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <small className="fw-bold text-success text-uppercase font-monospace">Dispatched in Kitchen</small>
                  <span className="badge bg-success-subtle text-success border border-success-subtle small">
                    {activeOrder.items.length} dishes
                  </span>
                </div>
                <div className="d-flex flex-column gap-1">
                  {activeOrder.items.map((it: any, i: number) => (
                    <div key={i} className="p-2 border rounded bg-white small d-flex justify-content-between align-items-center">
                      <div>
                        <span className="fw-bold text-dark">{it.itemName}</span>
                        <div className="text-muted small">Qty: {it.quantity} • ₹{it.unitPrice} each</div>
                      </div>
                      <div className="text-end">
                        <span className="fw-bold text-dark">₹{it.totalPrice}</span>
                        <div><span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>{it.status}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Uncommitted Cart Items */}
            <div>
              {activeOrder && activeOrder.items.length > 0 && (
                <div className="d-flex justify-content-between align-items-center mb-1 mt-2">
                  <small className="fw-bold text-primary text-uppercase font-monospace">New Dishes to Send</small>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                    {cart.length} new
                  </span>
                </div>
              )}

              {cart.length === 0 && (!activeOrder || activeOrder.items.length === 0) ? (
                <div className="text-center my-auto text-muted p-4">
                  <Utensils size={40} className="mb-2 text-secondary" />
                  <p className="small mb-0">No dishes selected yet.</p>
                  <small>Tap any dish on the left to add to order.</small>
                </div>
              ) : (
                cart.map((it, idx) => (
                  <div key={idx} className="p-2 border rounded bg-light mb-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold text-dark small">{it.itemName}</span>
                      <span className="fw-bold text-primary small">₹{it.price * it.quantity}</span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-secondary py-0 px-2" onClick={() => handleUpdateQty(idx, -1)}>
                          <Minus size={12} />
                        </button>
                        <span className="btn btn-light py-0 px-2 disabled fw-bold text-dark">{it.quantity}</span>
                        <button className="btn btn-outline-secondary py-0 px-2" onClick={() => handleUpdateQty(idx, 1)}>
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-outline-info btn-sm p-1"
                          onClick={() => {
                            setNoteItemIdx(idx);
                            setNoteText(it.notes);
                          }}
                          title="Add chef instructions"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm p-1"
                          onClick={() => handleRemoveItem(idx)}
                          title="Remove dish"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {it.notes && (
                      <div className="mt-1 small text-info bg-white p-1 rounded border">
                        <em>Note: {it.notes}</em>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart Summary & Action Buttons */}
          <div
            className="p-3 border-top bg-light flex-shrink-0 mt-auto"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="d-flex justify-content-between small text-muted mb-1">
              <span>Dishes Subtotal:</span>
              <span>₹{existingSubtotal + cartSubtotal}</span>
            </div>
            <div className="d-flex justify-content-between small text-muted mb-2">
              <span>GST (5%):</span>
              <span>₹{existingTax + cartTax}</span>
            </div>
            <div className="d-flex justify-content-between fw-bold text-dark fs-5 mb-3 border-top pt-1">
              <span>Grand Total:</span>
              <span className="text-primary">₹{grandTotal}</span>
            </div>

            <div className="d-flex flex-column gap-2">
              {can('orders.send_kot') && (
                <button
                  className="btn btn-primary py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  onClick={handleSendKOT}
                  disabled={cart.length === 0}
                >
                  <Send size={18} /> {activeOrderId ? 'Send Running KOT to Kitchen' : 'Send KOT & Place Order'}
                </button>
              )}

              {activeOrderId && can('billing.create') && (
                <button
                  className="btn btn-success py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  onClick={handleGenerateBill}
                >
                  <Receipt size={18} /> Request & Generate Bill
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NOTE MODAL */}
      {noteItemIdx !== null && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content shadow">
              <div className="modal-header p-2 bg-light">
                <h6 className="modal-title fw-bold">Chef Instructions</h6>
                <button type="button" className="btn-close" onClick={() => setNoteItemIdx(null)} />
              </div>
              <div className="modal-body p-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. Extra spicy, no onions"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
              </div>
              <div className="modal-footer p-2 bg-light">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (noteItemIdx !== null) {
                      const updated = [...cart];
                      updated[noteItemIdx].notes = noteText;
                      setCart(updated);
                      setNoteItemIdx(null);
                    }
                  }}
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
