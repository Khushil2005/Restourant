import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Modal } from '../../components/PermissionGate';
import { Booking } from '../../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  XCircle, 
  UserCheck, 
  Phone, 
  Users, 
  Printer, 
  Search, 
  Volume2, 
  FileText,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export const BookingPage: React.FC = () => {
  const { can } = usePermission();
  const { user } = useAuth();
  const { socket } = useSocket();

  // Current real date & system clock
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Active calendar view (month & year) - real current date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Selected date for locking form (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form Data for Lock Function Date
  const [formData, setFormData] = useState({
    bookingDate: todayStr,
    bookingTime: '19:00',
    customerName: '',
    customerPhone: '',
    guestCount: 50,
    advanceAmount: 5000,
    functionType: 'Family Dinner',
    acceptedBy: 'Bhanubhai Patel',
    notes: ''
  });

  // Slip / Receipt Modal
  const [selectedBookingForSlip, setSelectedBookingForSlip] = useState<Booking | null>(null);

  // Quick Token Modal from top bar (+ Token button)
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenFormData, setTokenFormData] = useState({
    customerName: '',
    customerPhone: '',
    partySize: 2,
    estimatedWaitMinutes: 15
  });

  // Notification / Alert message
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).toLowerCase()
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Synchronize form date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, bookingDate: selectedDate }));
    }
  }, [selectedDate]);

  // Load Bookings for active month / all
  const loadBookings = async (showSpinner = false, forceFresh = false) => {
    if (showSpinner || bookings.length === 0) {
      setLoading(true);
    }
    try {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;
      const config = forceFresh ? { forceFresh: true } : undefined;
      
      const res: any = await apiClient.get(`/bookings?month=${monthStr}`, config);
      if (res.success) {
        setBookings(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load function bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings(false, true);
  }, [currentDate]);

  useAutoRefresh(() => loadBookings(false, true), {
    entities: ['bookings'],
    intervalMs: 4000,
    refreshOnFocus: true
  });

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket) return;
    const refreshLive = () => loadBookings(false, true);
    socket.on('booking.updated', refreshLive);
    socket.on('data.changed', refreshLive);
    return () => {
      socket.off('booking.updated', refreshLive);
      socket.off('data.changed', refreshLive);
    };
  }, [socket]);

  // Handle Form Submit: Lock Date Exclusively
  const handleLockDate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.bookingDate < todayStr) {
      setAlertMessage({
        type: 'danger',
        text: 'Cannot book functions for past dates. Please select today or a future calendar date.'
      });
      return;
    }

    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      setAlertMessage({ type: 'danger', text: 'Please provide host name and mobile phone number.' });
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await apiClient.post('/bookings', {
        ...formData,
        bookingTime: formData.bookingTime || '19:00',
        isLocked: true,
        status: 'CONFIRMED'
      });

      if (res.success) {
        setAlertMessage({ 
          type: 'success', 
          text: `Date ${formData.bookingDate} locked exclusively for ${formData.customerName}!` 
        });
        
        // Reset form but keep selected date & default time
        setFormData(prev => ({
          ...prev,
          bookingTime: '19:00',
          customerName: '',
          customerPhone: '',
          guestCount: 50,
          advanceAmount: 5000,
          functionType: 'Family Dinner',
          notes: ''
        }));

        loadBookings();
      }
    } catch (err: any) {
      setAlertMessage({ 
        type: 'danger', 
        text: err.message || 'Failed to lock date. It might already be reserved.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Cancel Function
  const handleCancelBooking = async (booking: Booking) => {
    const bookingId = booking.id || (booking as any)._id;
    if (!bookingId) return;
    if (!window.confirm(`Cancel function reservation for ${booking.customerName} on ${booking.bookingDate}?`)) {
      return;
    }
    try {
      const res: any = await apiClient.patch(`/bookings/${bookingId}/cancel`, { status: 'CANCELLED' });
      if (res.success) {
        setAlertMessage({ 
          type: 'info', 
          text: `Function reservation for ${booking.customerName} on ${booking.bookingDate} has been cancelled successfully.` 
        });
        loadBookings();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel function.');
    }
  };

  // Handle Status Update (e.g. CHECKED_IN, COMPLETED)
  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/bookings/${id}/status`, { status });
      setAlertMessage({ type: 'success', text: `Function status updated to ${status}.` });
      loadBookings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Quick Issue Waiting Token
  const handleIssueToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await apiClient.post('/tokens', tokenFormData);
      if (res.success) {
        alert(`Token #${res.data.tokenCode} issued successfully!`);
        setIsTokenModalOpen(false);
        setTokenFormData({ customerName: '', customerPhone: '', partySize: 2, estimatedWaitMinutes: 15 });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to issue token.');
    }
  };

  // Call Next Token Action
  const handleCallNext = async () => {
    try {
      const qRes: any = await apiClient.get('/tokens/queue?status=WAITING');
      if (qRes.success && qRes.data?.length > 0) {
        const nextToken = qRes.data[0];
        await apiClient.patch(`/tokens/${nextToken.id}/call`);
        alert(`Calling Next Guest: Token ${nextToken.tokenCode} - ${nextToken.customerName}`);
      } else {
        alert('No waiting tokens in the queue right now.');
      }
    } catch (err: any) {
      alert(err.message || 'Unable to call next token.');
    }
  };

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is SUN
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
      booking?: Booking;
    }> = [];

    // Empty padding days before day 1
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNumber: 0,
        dateStr: '',
        isCurrentMonth: false,
        isToday: false,
        isPast: false
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const bookingForDay = bookings.find(
        b => b.bookingDate === dateStr && b.status !== 'CANCELLED'
      );

      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;

      days.push({
        dayNumber: day,
        dateStr,
        isCurrentMonth: true,
        isToday,
        isPast,
        booking: bookingForDay
      });
    }

    return days;
  }, [year, month, bookings, todayStr]);

  // Filtered bookings for registry table
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = 
        b.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customerPhone?.includes(searchTerm) ||
        b.bookingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.bookingDate?.includes(searchTerm);

      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  return (
    <div className="d-flex flex-column gap-3 pb-5">
      {/* 1. TOP HEADER BAR */}
      <div className="d-flex flex-wrap justify-content-between align-items-center py-2 px-3 border-bottom bg-white rounded-3 shadow-sm gap-2">
        {/* Breadcrumb */}
        <div className="d-flex align-items-center gap-2">
          <span className="text-secondary fw-semibold" style={{ fontSize: '0.9rem' }}>
            Bhatigal Bhanu
          </span>
          <span className="text-muted">/</span>
          <span className="fw-bold" style={{ color: 'var(--brand-maroon, #7A1B28)', fontSize: '0.95rem' }}>
            Function Locker
          </span>
        </div>

        {/* Right Actions: Live Clock, Call Next, + Token */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Live Clock Pill */}
          <div 
            className="d-flex align-items-center gap-2 px-2 px-sm-3 py-1 rounded-pill"
            style={{ 
              backgroundColor: '#FFF5F5', 
              border: '1px solid #FFD6D6',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#4A151D'
            }}
          >
            <span 
              className="d-inline-block rounded-circle bg-success" 
              style={{ width: 8, height: 8, boxShadow: '0 0 6px #198754' }} 
            />
            <span>{currentTime || '10:39:59 pm'}</span>
          </div>

          {/* Call Next Button */}
          <button
            onClick={handleCallNext}
            className="btn btn-sm d-flex align-items-center gap-1 fw-medium"
            style={{
              backgroundColor: '#E8F1FD',
              color: '#0D6EFD',
              border: '1px solid #C6DCFA',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '0.82rem'
            }}
          >
            <Volume2 size={14} />
            <span>Call Next</span>
          </button>

          {/* + Token Button */}
          <button
            onClick={() => setIsTokenModalOpen(true)}
            className="btn btn-sm text-white d-flex align-items-center gap-1 fw-semibold shadow-sm"
            style={{
              backgroundColor: 'var(--brand-maroon, #7A1B28)',
              borderColor: 'var(--brand-maroon-dark, #56101B)',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: '0.82rem'
            }}
          >
            <Plus size={15} />
            <span>+ Token</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div className={`alert alert-${alertMessage.type} alert-dismissible fade show d-flex align-items-center gap-2 py-2 mb-1 shadow-sm`} role="alert">
          {alertMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div className="small fw-medium flex-grow-1">{alertMessage.text}</div>
          <button type="button" className="btn-close p-2" onClick={() => setAlertMessage(null)} />
        </div>
      )}

      {/* 2. SPLIT SECTION: LOCK FUNCTION DATE FORM (LEFT) & INTERACTIVE CALENDAR (RIGHT) */}
      <div className="row g-3">
        {/* LEFT CARD: LOCK FUNCTION DATE */}
        <div className="col-12 col-lg-5">
          <div 
            className="card h-100 shadow-sm border-0" 
            style={{ 
              borderRadius: '16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F0E6E6'
            }}
          >
            <div className="card-body p-4 d-flex flex-column justify-content-between">
              <div>
                {/* Card Title & Subtitle */}
                <div className="d-flex justify-content-between align-items-baseline mb-3 pb-2 border-bottom">
                  <h5 className="fw-bold mb-0" style={{ color: 'var(--brand-maroon, #7A1B28)', fontSize: '1.2rem' }}>
                    Lock Function Date
                  </h5>
                  <span className="text-secondary small fw-medium" style={{ fontSize: '0.82rem' }}>
                    1 Order / Date
                  </span>
                </div>

                {/* Form */}
                <form onSubmit={handleLockDate} className="d-flex flex-column gap-3">
                  {/* Date Input with min={todayStr} to prevent booking past dates */}
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label small fw-semibold text-secondary mb-0">
                        Date
                      </label>
                      <span className="badge bg-light text-muted border" style={{ fontSize: '0.7rem' }}>
                        Min: Today ({todayStr})
                      </span>
                    </div>
                    <div className="input-group input-group-sm">
                      <input
                        type="date"
                        min={todayStr}
                        className="form-control form-control-sm border rounded-3 p-2"
                        required
                        value={formData.bookingDate}
                        onChange={e => {
                          if (e.target.value < todayStr) {
                            setAlertMessage({
                              type: 'danger',
                              text: 'Cannot select a past date. Please pick today or a future date.'
                            });
                            return;
                          }
                          setFormData({ ...formData, bookingDate: e.target.value });
                          setSelectedDate(e.target.value);
                        }}
                        style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  {/* Client Name & Phone */}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        Client Name
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm border rounded-3 p-2"
                        placeholder="Host Name"
                        required
                        value={formData.customerName}
                        onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                        style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        className="form-control form-control-sm border rounded-3 p-2"
                        placeholder="Mobile"
                        required
                        value={formData.customerPhone}
                        onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                        style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  {/* Guests & Advance (₹) */}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        Guests
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm border rounded-3 p-2"
                        placeholder="50"
                        required
                        value={formData.guestCount}
                        onChange={e => setFormData({ ...formData, guestCount: Number(e.target.value) })}
                        style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        Advance (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        className="form-control form-control-sm border rounded-3 p-2"
                        placeholder="5000"
                        required
                        value={formData.advanceAmount}
                        onChange={e => setFormData({ ...formData, advanceAmount: Number(e.target.value) })}
                        style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  {/* Type & Accepted By */}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        Type
                      </label>
                      <select
                        className="form-select form-select-sm border rounded-3 p-2"
                        value={formData.functionType}
                        onChange={e => setFormData({ ...formData, functionType: e.target.value })}
                        style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                      >
                        <option value="Family Dinner">Family Dinner</option>
                        <option value="Wedding / Reception">Wedding / Reception</option>
                        <option value="Birthday Party">Birthday Party</option>
                        <option value="Corporate Event">Corporate Event</option>
                        <option value="Catering & Banquet">Catering & Banquet</option>
                        <option value="Ring Ceremony / Engagement">Ring Ceremony / Engagement</option>
                        <option value="Traditional Feast">Traditional Feast</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary mb-1">
                        Accepted By
                      </label>
                      <select
                        className="form-select form-select-sm border rounded-3 p-2"
                        value={formData.acceptedBy}
                        onChange={e => setFormData({ ...formData, acceptedBy: e.target.value })}
                        style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                      >
                        <option value="Bhanubhai Patel">Bhanubhai Patel</option>
                        <option value="Rameshbhai Patel">Rameshbhai Patel</option>
                        <option value="Pareshbhai Vora">Pareshbhai Vora</option>
                        <option value="System Admin">System Admin</option>
                        <option value="Hostess / Desk">Hostess / Desk</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes (Optional) */}
                  <div>
                    <label className="form-label small fw-semibold text-secondary mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      rows={3}
                      className="form-control form-control-sm border rounded-3 p-2"
                      placeholder="Menu or timing notes..."
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                    />
                  </div>

                  {/* Lock Date Exclusively Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn w-100 py-2 text-white fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                      style={{
                        backgroundColor: 'var(--brand-maroon, #7A1B28)',
                        borderColor: 'var(--brand-maroon-dark, #56101B)',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" />
                          <span>Locking Date...</span>
                        </>
                      ) : (
                        <span>Lock Date Exclusively</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: INTERACTIVE CALENDAR VIEW */}
        <div className="col-12 col-lg-7">
          <div 
            className="card h-100 shadow-sm border-0" 
            style={{ 
              borderRadius: '16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F0E6E6'
            }}
          >
            <div className="card-body p-4 d-flex flex-column">
              {/* Calendar Header: Month Navigator & Legend */}
              <div className="d-flex justify-content-between align-items-center mb-4">
                {/* Month Navigator */}
                <div className="d-flex align-items-center gap-3">
                  <button 
                    onClick={prevMonth}
                    className="btn btn-sm btn-link text-dark p-1 rounded-circle"
                    title="Previous Month"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h5 
                    className="fw-bold mb-0 text-capitalize"
                    style={{ color: 'var(--brand-maroon, #7A1B28)', fontSize: '1.25rem', minWidth: '160px' }}
                  >
                    {monthNames[month]} {year}
                  </h5>
                  <button 
                    onClick={nextMonth}
                    className="btn btn-sm btn-link text-dark p-1 rounded-circle"
                    title="Next Month"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Status Legend */}
                <div className="d-flex align-items-center gap-3 small fw-semibold">
                  <div className="d-flex align-items-center gap-1">
                    <span 
                      className="d-inline-block rounded-circle" 
                      style={{ width: 9, height: 9, border: '2px solid #198754' }} 
                    />
                    <span style={{ color: '#198754', fontSize: '0.85rem' }}>Open</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span 
                      className="d-inline-block rounded-circle" 
                      style={{ width: 9, height: 9, border: '2px solid #DC3545' }} 
                    />
                    <span style={{ color: '#DC3545', fontSize: '0.85rem' }}>Locked</span>
                  </div>
                </div>
              </div>

              {/* Day-of-week headers */}
              <div className="d-grid text-center mb-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                  <div 
                    key={d} 
                    className="fw-bold small py-1"
                    style={{ color: 'var(--brand-maroon, #7A1B28)', fontSize: '0.75rem', letterSpacing: '0.05em' }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div 
                className="d-grid flex-grow-1" 
                style={{ 
                  gridTemplateColumns: 'repeat(7, 1fr)', 
                  gap: '6px',
                  minHeight: '340px'
                }}
              >
                {calendarDays.map((item, idx) => {
                  if (!item.isCurrentMonth) {
                    return (
                      <div 
                        key={`empty-${idx}`} 
                        className="rounded-3" 
                        style={{ backgroundColor: 'transparent' }} 
                      />
                    );
                  }

                  const isLocked = !!item.booking;
                  const isSelected = item.dateStr === selectedDate;

                  return (
                    <div
                      key={item.dateStr}
                      onClick={() => {
                        if (item.isPast && !item.booking) {
                          setAlertMessage({
                            type: 'info',
                            text: `Date ${item.dateStr} is in the past. Only today and future dates can be locked.`
                          });
                          return;
                        }
                        setSelectedDate(item.dateStr);
                        if (item.booking) {
                          setSelectedBookingForSlip(item.booking);
                        }
                      }}
                      className="p-1 p-sm-2 rounded-3 d-flex flex-column justify-content-between position-relative"
                      style={{
                        cursor: item.isPast && !isLocked ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease-in-out',
                        minHeight: '50px',
                        backgroundColor: isLocked 
                          ? '#FFF5F5' 
                          : item.isPast 
                            ? '#F8F9FA' 
                            : isSelected 
                              ? '#FDF8F2' 
                              : '#FAFAFA',
                        opacity: item.isPast && !isLocked ? 0.45 : 1,
                        border: item.isToday 
                          ? '2px solid var(--brand-maroon, #7A1B28)' 
                          : isSelected 
                            ? '2px solid var(--brand-gold, #D48B28)' 
                            : '1px solid #ECECEC',
                        boxShadow: isSelected ? '0 2px 6px rgba(122, 27, 40, 0.12)' : 'none'
                      }}
                      title={
                        isLocked 
                          ? `Locked for ${item.booking?.customerName} (${item.booking?.guestCount} Guests, Advance: ₹${item.booking?.advanceAmount || 0})`
                          : item.isPast 
                            ? `Date: ${item.dateStr} (Past date - not available for booking)`
                            : `Date: ${item.dateStr} (Click to select)`
                      }
                    >
                      {/* Day Number and Today Badge */}
                      <div className="d-flex justify-content-between align-items-center">
                        <span 
                          className="fw-bold" 
                          style={{ 
                            fontSize: '0.8rem',
                            color: item.isToday 
                              ? 'var(--brand-maroon, #7A1B28)' 
                              : item.isPast 
                                ? '#999999' 
                                : '#333333'
                          }}
                        >
                          {item.dayNumber}
                        </span>
                        {item.isToday && (
                          <span 
                            className="badge text-white px-1 py-0 rounded"
                            style={{ 
                              backgroundColor: 'var(--brand-maroon, #7A1B28)', 
                              fontSize: '0.55rem', 
                              letterSpacing: '0.04em' 
                            }}
                          >
                            TODAY
                          </span>
                        )}
                      </div>

                      {/* Status indicator / Text */}
                      <div className="mt-1">
                        {isLocked ? (
                          <div className="d-flex flex-column align-items-start">
                            <span 
                              className="fw-bold text-danger d-none d-sm-inline" 
                              style={{ fontSize: '0.72rem' }}
                            >
                              Locked
                            </span>
                            <span 
                              className="d-sm-none p-1 rounded-circle bg-danger d-inline-block" 
                              style={{ width: 7, height: 7 }} 
                              title="Locked"
                            />
                            <span 
                              className="text-truncate small text-secondary d-none d-md-block" 
                              style={{ fontSize: '0.65rem', maxWidth: '65px' }}
                            >
                              {item.booking?.customerName}
                            </span>
                          </div>
                        ) : item.isPast ? (
                          <span 
                            className="fw-medium text-muted" 
                            style={{ fontSize: '0.72rem' }}
                          >
                            —
                          </span>
                        ) : (
                          <div className="d-flex align-items-center">
                            <span 
                              className="fw-semibold text-success d-none d-sm-inline" 
                              style={{ fontSize: '0.72rem' }}
                            >
                              Open
                            </span>
                            <span 
                              className="d-sm-none p-1 rounded-circle bg-success d-inline-block" 
                              style={{ width: 6, height: 6 }} 
                              title="Open"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM SECTION: LOCKED FUNCTIONS REGISTRY */}
      <div 
        className="card shadow-sm border-0 mt-2" 
        style={{ 
          borderRadius: '16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #F0E6E6'
        }}
      >
        <div className="card-body p-4">
          {/* Section Header & Filters */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
            <div>
              <h5 className="fw-bold mb-1" style={{ color: 'var(--brand-maroon, #7A1B28)', fontSize: '1.15rem' }}>
                Locked Functions Registry
              </h5>
              <p className="text-muted small mb-0">
                Master record of all exclusive date function reservations and advance deposits
              </p>
            </div>

            <div className="d-flex align-items-center gap-2">
              {/* Search */}
              <div className="input-group input-group-sm" style={{ width: 220 }}>
                <span className="input-group-text bg-light border-end-0">
                  <Search size={14} className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm border-start-0"
                  placeholder="Search client, phone, date..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <select
                className="form-select form-select-sm"
                style={{ width: 140 }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="CHECKED_IN">CHECKED_IN</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="table table-hover align-middle mb-0" style={{ minWidth: '780px', fontSize: '0.88rem' }}>
              <thead style={{ backgroundColor: '#FAF5EE', color: 'var(--brand-maroon, #7A1B28)' }}>
                <tr>
                  <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>DATE</th>
                  <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>CLIENT</th>
                  <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>TYPE</th>
                  <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>GUESTS</th>
                  <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>ADVANCE</th>
                  <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>STATUS</th>
                  <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>MANAGER</th>
                  <th className="py-3 px-3 fw-bold border-bottom-0 text-end" style={{ letterSpacing: '0.04em' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                      Loading locked function records...
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      <CalendarIcon size={36} className="text-secondary opacity-50 mb-2" />
                      <div>No locked function records found for this period.</div>
                      <div className="small text-muted mt-1">Select a date above to lock a function exclusively.</div>
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map(b => (
                    <tr key={b.id}>
                      {/* DATE */}
                      <td className="px-3 py-3">
                        <div className="d-flex align-items-center gap-2">
                          <span 
                            className="badge px-2 py-1 border text-dark"
                            style={{ backgroundColor: '#FDF5E6', borderColor: '#E8DCCF' }}
                          >
                            <CalendarIcon size={12} className="me-1 text-secondary" />
                            {b.bookingDate}
                          </span>
                        </div>
                      </td>

                      {/* CLIENT */}
                      <td className="px-3 py-3">
                        <div>
                          <span className="fw-bold text-dark">{b.customerName}</span>
                          <div className="small text-muted d-flex align-items-center gap-1">
                            <Phone size={11} /> {b.customerPhone}
                          </div>
                        </div>
                      </td>

                      {/* TYPE */}
                      <td className="px-3 py-3">
                        <span 
                          className="badge px-2 py-1"
                          style={{ 
                            backgroundColor: '#FBECEE', 
                            color: 'var(--brand-maroon, #7A1B28)',
                            border: '1px solid #F5CCD2'
                          }}
                        >
                          {b.functionType || 'Family Dinner'}
                        </span>
                      </td>

                      {/* GUESTS */}
                      <td className="px-3 py-3">
                        <span className="d-inline-flex align-items-center gap-1 fw-semibold text-secondary">
                          <Users size={13} /> {b.guestCount} Guests
                        </span>
                      </td>

                      {/* ADVANCE */}
                      <td className="px-3 py-3">
                        <span className="fw-bold text-success" style={{ fontSize: '0.92rem' }}>
                          ₹{(b.advanceAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-3 py-3">
                        <span className={`badge px-2 py-1 ${
                          b.status === 'CONFIRMED' || b.status === 'LOCKED'
                            ? 'bg-success text-white'
                            : b.status === 'CHECKED_IN'
                              ? 'bg-primary text-white'
                              : b.status === 'COMPLETED'
                                ? 'bg-secondary text-white'
                                : 'bg-danger-subtle text-danger border border-danger-subtle'
                        }`}>
                          {b.status === 'CANCELLED' ? 'CANCELLED (Open)' : b.status}
                        </span>
                      </td>

                      {/* MANAGER */}
                      <td className="px-3 py-3">
                        <span className="text-dark fw-medium">
                          {b.acceptedBy || 'Bhanubhai Patel'}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="px-3 py-3 text-end">
                        <div className="d-flex justify-content-end align-items-center gap-1">
                          {/* Print / View Slip */}
                          <button
                            onClick={() => setSelectedBookingForSlip(b)}
                            className="btn btn-outline-secondary btn-sm p-1 px-2 d-flex align-items-center gap-1 shadow-sm"
                            title="View Function Slip"
                          >
                            <FileText size={13} />
                            <span className="small">Slip</span>
                          </button>

                          {/* Check-In */}
                          {b.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleStatusChange(b.id, 'CHECKED_IN')}
                              className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1 shadow-sm"
                              title="Mark Arrived / Seat"
                            >
                              <UserCheck size={13} />
                              <span className="small">Check In</span>
                            </button>
                          )}

                          {/* Complete (if Checked In) */}
                          {b.status === 'CHECKED_IN' && (
                            <button
                              onClick={() => handleStatusChange(b.id, 'COMPLETED')}
                              className="btn btn-primary btn-sm p-1 px-2 d-flex align-items-center gap-1 shadow-sm"
                              title="Mark Completed"
                            >
                              <UserCheck size={13} />
                              <span className="small">Complete</span>
                            </button>
                          )}

                          {/* Cancel Function */}
                          {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleCancelBooking(b)}
                              className="btn btn-outline-danger btn-sm p-1 px-2 d-flex align-items-center gap-1"
                              title="Cancel function reservation"
                            >
                              <XCircle size={13} />
                              <span className="small">Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. MODAL: FUNCTION SLIP / RECEIPT */}
      {selectedBookingForSlip && (
        <Modal
          isOpen={!!selectedBookingForSlip}
          onClose={() => setSelectedBookingForSlip(null)}
          title={`Function Booking Voucher: ${selectedBookingForSlip.bookingNumber || 'FN-VOUCHER'}`}
        >
          <div className="p-3 print-area">
            {/* Slip Header */}
            <div className="text-center pb-3 border-bottom mb-3">
              <h4 className="fw-bold mb-0" style={{ color: 'var(--brand-maroon, #7A1B28)' }}>
                BHATIGAL BHANU
              </h4>
              <p className="small text-muted mb-0">Traditional Dining & Catering Management</p>
              <div className="badge bg-gold text-dark mt-1">EXCLUSIVE FUNCTION VOUCHER</div>
            </div>

            {/* Slip Content Grid */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <span className="small text-muted d-block">Function Date:</span>
                <strong className="fs-6">{selectedBookingForSlip.bookingDate}</strong>
              </div>
              <div className="col-6 text-end">
                <span className="small text-muted d-block">Booking No:</span>
                <strong>{selectedBookingForSlip.bookingNumber}</strong>
              </div>
              <div className="col-6">
                <span className="small text-muted d-block">Host / Client Name:</span>
                <strong>{selectedBookingForSlip.customerName}</strong>
              </div>
              <div className="col-6 text-end">
                <span className="small text-muted d-block">Phone:</span>
                <strong>{selectedBookingForSlip.customerPhone}</strong>
              </div>
              <div className="col-6">
                <span className="small text-muted d-block">Event Type:</span>
                <span className="badge bg-primary-subtle text-primary">
                  {selectedBookingForSlip.functionType || 'Family Dinner'}
                </span>
              </div>
              <div className="col-6 text-end">
                <span className="small text-muted d-block">Guests Expected:</span>
                <strong>{selectedBookingForSlip.guestCount} Persons</strong>
              </div>
            </div>

            {/* Financials & Advance Box */}
            <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#FDF5E6', border: '1px solid #E8DCCF' }}>
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-semibold">Advance Payment Received:</span>
                <h5 className="fw-bold text-success mb-0">
                  ₹{(selectedBookingForSlip.advanceAmount || 0).toLocaleString('en-IN')}
                </h5>
              </div>
              <div className="small text-muted mt-1">
                Accepted by: {selectedBookingForSlip.acceptedBy || 'Bhanubhai Patel'}
              </div>
            </div>

            {/* Notes */}
            {selectedBookingForSlip.notes && (
              <div className="mb-3">
                <span className="small fw-semibold text-secondary d-block">Menu & Timing Instructions:</span>
                <p className="small text-dark p-2 bg-light rounded border mb-0 text-break" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {selectedBookingForSlip.notes}
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="d-flex justify-content-end gap-2 pt-3 border-top no-print">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedBookingForSlip(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print Voucher Slip
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. MODAL: QUICK ISSUE TOKEN (+ Token) */}
      <Modal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        title="Quick Issue Waiting Token"
      >
        <form onSubmit={handleIssueToken} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Customer / Host Name</label>
            <input
              type="text"
              className="form-control form-control-sm"
              required
              placeholder="e.g. Nileshbhai"
              value={tokenFormData.customerName}
              onChange={e => setTokenFormData({ ...tokenFormData, customerName: e.target.value })}
            />
          </div>
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold">Mobile Phone</label>
              <input
                type="tel"
                className="form-control form-control-sm"
                required
                placeholder="98790xxxxx"
                value={tokenFormData.customerPhone}
                onChange={e => setTokenFormData({ ...tokenFormData, customerPhone: e.target.value })}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Party Size</label>
              <input
                type="number"
                min="1"
                max="30"
                className="form-control form-control-sm"
                required
                value={tokenFormData.partySize}
                onChange={e => setTokenFormData({ ...tokenFormData, partySize: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="form-label small fw-bold">Estimated Wait (Minutes)</label>
            <input
              type="number"
              min="5"
              step="5"
              className="form-control form-control-sm"
              value={tokenFormData.estimatedWaitMinutes}
              onChange={e => setTokenFormData({ ...tokenFormData, estimatedWaitMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsTokenModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
            >
              Generate Token
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
