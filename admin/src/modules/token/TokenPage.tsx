import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { QueueToken, DiningTable } from '../../types';
import { Modal } from '../../components/PermissionGate';
import { 
  Megaphone, 
  RotateCcw, 
  UserCheck, 
  Plus, 
  Search, 
  Volume2, 
  Phone,
  Users,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tv,
  Printer,
  ShoppingBag
} from 'lucide-react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

// Helper to format date as YYYY-MM-DD
const getLocalDateString = (d = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const TokenPage: React.FC = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();

  // Current system clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // Selected Calendar Date (Defaults to Today)
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

  // Tokens state
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<'ALL' | 'WAITING' | 'CALLING' | 'SERVED' | 'CANCELLED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // New Token Form State
  const [partySize, setPartySize] = useState<number>(2);
  const [guestName, setGuestName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Table Seating Modal State
  const [seatingToken, setSeatingToken] = useState<QueueToken | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [seatingSubmitting, setSeatingSubmitting] = useState(false);

  // Print Token Slip Modal State
  const [printingToken, setPrintingToken] = useState<QueueToken | null>(null);

  const todayStr = getLocalDateString();
  const isViewingToday = selectedDate === todayStr;

  // Update real-time clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
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

  // Load Queue Tokens & Tables for selected date
  const loadQueue = useCallback(async (showSpinner = false, forceFresh = false, dateToFetch = selectedDate) => {
    if (showSpinner || tokens.length === 0) {
      setLoading(true);
    }
    try {
      const config = forceFresh ? { forceFresh: true } : undefined;
      const [res, tRes]: any = await Promise.all([
        apiClient.get(`/tokens/queue?date=${dateToFetch}`, config),
        apiClient.get('/tables/floor-layout', config).catch(() => null)
      ]);
      if (res?.success) {
        setTokens(res.data || []);
      }
      if (tRes?.success && Array.isArray(tRes.data)) {
        setTables(tRes.data);
      }
    } catch (err) {
      console.error('Failed to load queue tokens:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, tokens.length]);

  // Load queue whenever selected date changes
  useEffect(() => {
    loadQueue(true, true, selectedDate);
  }, [selectedDate]);

  // Auto-refresh periodically only when viewing today's live queue
  useAutoRefresh(() => {
    if (isViewingToday) {
      loadQueue(false, true, todayStr);
    }
  }, {
    entities: ['tokens'],
    intervalMs: 3500,
    refreshOnFocus: true
  });

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    const refreshLive = () => {
      if (isViewingToday) {
        loadQueue(false, true, todayStr);
      }
    };
    socket.on('token.updated', refreshLive);
    socket.on('token.called', refreshLive);
    socket.on('data.changed', refreshLive);
    return () => {
      socket.off('token.updated', refreshLive);
      socket.off('token.called', refreshLive);
      socket.off('data.changed', refreshLive);
    };
  }, [socket, isViewingToday, todayStr, loadQueue]);

  // Quick Date Navigation
  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(getLocalDateString(current));
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  const handleSetYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    setSelectedDate(getLocalDateString(y));
  };

  // Formatted date string for UI display
  const formattedDateTitle = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [selectedDate]);

  // Handle Token Generation (Always issues under Today's date starting T-1, T-2...)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !phoneNumber.trim()) {
      alert('Please enter guest name and phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await apiClient.post('/tokens', {
        customerName: guestName.trim(),
        customerPhone: phoneNumber.trim(),
        partySize: Number(partySize),
        tokenDate: todayStr,
        estimatedWaitMinutes: partySize > 4 ? 25 : 15
      });

      if (res.success) {
        setGuestName('');
        setPhoneNumber('');
        setPartySize(2);

        // Switch to today if viewing past date so new token is seen immediately
        if (!isViewingToday) {
          setSelectedDate(todayStr);
        } else {
          loadQueue(false, true, todayStr);
        }

        // Offer print slip modal
        if (res.data) {
          setPrintingToken(res.data);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to issue waiting token.');
    } finally {
      setSubmitting(false);
    }
  };

  // Actions
  const handleCall = async (id: string) => {
    try {
      await apiClient.patch(`/tokens/${id}/call`);
      loadQueue(false, true, selectedDate);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecall = async (id: string) => {
    try {
      await apiClient.patch(`/tokens/${id}/recall`);
      loadQueue(false, true, selectedDate);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelToken = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this token?')) return;
    try {
      await apiClient.patch(`/tokens/${id}/cancel`);
      loadQueue(false, true, selectedDate);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel token.');
    }
  };

  const handleOpenSeatModal = (token: QueueToken) => {
    setSeatingToken(token);
    const suitable = tables.find(t => t.status === 'AVAILABLE' && t.capacity >= token.partySize);
    setSelectedTableId(suitable?.id || '');
  };

  const handleConfirmSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatingToken) return;
    setSeatingSubmitting(true);
    try {
      const assignedTableId = selectedTableId;
      const assignedTable = tables.find(t => t.id === assignedTableId);
      const currentToken = seatingToken;

      await apiClient.patch(`/tokens/${currentToken.id}/seat`, {
        tableId: assignedTableId || undefined
      });
      setSeatingToken(null);
      setSelectedTableId('');
      loadQueue(false, true, selectedDate);

      // If seated at a specific table, offer immediate order taking in POS with table pre-selected
      if (assignedTable) {
        const tNum = assignedTable.isMerged && assignedTable.mergedTableNumbers && assignedTable.mergedTableNumbers.length > 0
          ? assignedTable.mergedTableNumbers.join(' + ')
          : assignedTable.tableNumber;
        const shouldTakeOrder = window.confirm(
          `Guest "${currentToken.customerName}" seated at Table ${tNum}.\n\nDo you want to take an order now in POS? (ટેબલ ${tNum} માટે POS માં ઓર્ડર લેવો છે?)`
        );
        if (shouldTakeOrder) {
          navigate(
            `/pos?tableId=${assignedTable.id}&tableNumber=${encodeURIComponent(tNum)}&customerName=${encodeURIComponent(currentToken.customerName)}&customerPhone=${encodeURIComponent(currentToken.customerPhone)}&tokenCode=${encodeURIComponent(currentToken.tokenCode)}`
          );
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to seat guest.');
    } finally {
      setSeatingSubmitting(false);
    }
  };

  // Call Next Waiting Token
  const handleCallNext = async () => {
    const nextToken = tokens.find(t => t.status === 'WAITING');
    if (nextToken) {
      handleCall(nextToken.id);
    } else {
      alert('No waiting tokens in the queue for this date.');
    }
  };

  // Print 80mm Token Slip Native
  const handlePrintSlip = (token: QueueToken) => {
    const printWindow = window.open('', '_blank', 'width=380,height=500');
    if (!printWindow) {
      alert('Popup was blocked by browser. Please allow popups to print token slips.');
      return;
    }

    const tDate = token.createdAt ? new Date(token.createdAt) : new Date();
    const formattedDate = `${tDate.getDate()}/${tDate.getMonth() + 1}/${tDate.getFullYear()}`;
    const formattedTime = tDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Slip - ${token.tokenCode}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              text-align: center;
              padding: 14px;
              color: #111;
              max-width: 280px;
              margin: 0 auto;
            }
            .brand {
              font-size: 16px;
              font-weight: 800;
              color: #b8731d;
              margin-bottom: 2px;
            }
            .sub {
              font-size: 10px;
              color: #666;
              margin-bottom: 8px;
            }
            .token-box {
              border: 2px dashed #b8731d;
              border-radius: 12px;
              padding: 12px;
              margin: 10px 0;
              background: #fffcf5;
            }
            .token-num {
              font-size: 38px;
              font-weight: 900;
              color: #7A1B28;
              margin: 0;
              line-height: 1.1;
            }
            .guest-info {
              font-size: 12px;
              margin: 6px 0;
              text-align: left;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 11.5px;
            }
            .divider {
              border-top: 1px solid #e0e0e0;
              margin: 8px 0;
            }
            .footer {
              font-size: 10px;
              color: #777;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="brand">BHATIGAL BHANU</div>
          <div class="sub">Traditional Dining Token Slip</div>
          
          <div class="token-box">
            <div style="font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase;">Your Token Number</div>
            <div class="token-num">${token.tokenCode}</div>
            <div style="font-size: 11px; color: #444; margin-top: 4px;">Party of <strong>${token.partySize} Guests</strong></div>
          </div>

          <div class="divider"></div>

          <div class="guest-info">
            <div class="row">
              <span><strong>Guest:</strong></span>
              <span>${token.customerName}</span>
            </div>
            <div class="row">
              <span><strong>Phone:</strong></span>
              <span>${token.customerPhone}</span>
            </div>
            <div class="row">
              <span><strong>Date:</strong></span>
              <span>${formattedDate}</span>
            </div>
            <div class="row">
              <span><strong>Issued:</strong></span>
              <span>${formattedTime}</span>
            </div>
            <div class="row">
              <span><strong>Est. Wait:</strong></span>
              <span>~${token.estimatedWaitMinutes || 15} mins</span>
            </div>
          </div>

          <div class="divider"></div>
          
          <div class="footer">
            Please wait for your token to be announced.<br/>
            Thank you for your patience! 🙏
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Metrics summary for selected date
  const metrics = useMemo(() => {
    const total = tokens.length;
    const waiting = tokens.filter(t => t.status === 'WAITING').length;
    const calling = tokens.filter(t => t.status === 'CALLED' || t.status === 'RECALLED').length;
    const seated = tokens.filter(t => t.status === 'SEATED' || t.status === 'COMPLETED').length;
    const cancelled = tokens.filter(t => t.status === 'CANCELLED' || t.status === 'SKIPPED').length;

    let totalWaitMs = 0;
    let countWait = 0;
    tokens.forEach(t => {
      if (t.seatedAt && t.createdAt) {
        const ms = new Date(t.seatedAt).getTime() - new Date(t.createdAt).getTime();
        if (ms > 0) {
          totalWaitMs += ms;
          countWait++;
        }
      }
    });

    const avgWaitMinutes = countWait > 0 ? Math.round((totalWaitMs / countWait) / 60000) : (waiting > 0 ? 15 : 0);

    return { total, waiting, calling, seated, cancelled, avgWaitMinutes };
  }, [tokens]);

  // Filtered Tokens by Tab and Search
  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      let matchesTab = true;
      if (activeTab === 'WAITING') matchesTab = t.status === 'WAITING';
      else if (activeTab === 'CALLING') matchesTab = t.status === 'CALLED' || t.status === 'RECALLED';
      else if (activeTab === 'SERVED') matchesTab = t.status === 'SEATED' || t.status === 'COMPLETED';
      else if (activeTab === 'CANCELLED') matchesTab = t.status === 'CANCELLED' || t.status === 'SKIPPED';

      const matchesSearch = 
        t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.customerPhone?.includes(searchTerm) ||
        t.tokenCode?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [tokens, activeTab, searchTerm]);

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
            Token Counter & Queue History
          </span>
        </div>

        {/* Right Actions: Live Clock, TV Display, Call Next, + Token */}
        <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
          {/* Live Clock Pill */}
          <div 
            className="d-flex align-items-center gap-2 px-2.5 py-1 rounded-pill"
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
            <span>{currentTime || '10:50:45 pm'}</span>
          </div>

          {/* Public TV Calling Screen Link */}
          <a
            href="/display/tokens"
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-outline-dark d-flex align-items-center gap-1 fw-medium"
            style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem' }}
            title="Open Public Token Calling TV Screen"
          >
            <Tv size={14} />
            <span className="d-none d-sm-inline">TV Screen</span>
          </a>

          {/* Call Next Button */}
          <button
            onClick={handleCallNext}
            className="btn btn-sm d-flex align-items-center gap-1 fw-medium"
            style={{
              backgroundColor: '#E8F1FD',
              color: '#0D6EFD',
              border: '1px solid #C6DCFA',
              borderRadius: '8px',
              padding: '6px 12px'
            }}
          >
            <Volume2 size={15} />
            <span>Call Next</span>
          </button>

          {/* + Token Button */}
          <button
            onClick={() => {
              if (!isViewingToday) setSelectedDate(todayStr);
              setTimeout(() => {
                const nameInput = document.getElementById('token-guest-name-input');
                if (nameInput) nameInput.focus();
              }, 100);
            }}
            className="btn btn-sm text-white d-flex align-items-center gap-1 fw-semibold shadow-sm"
            style={{
              backgroundColor: 'var(--brand-maroon, #7A1B28)',
              borderColor: 'var(--brand-maroon-dark, #56101B)',
              borderRadius: '8px',
              padding: '6px 12px'
            }}
          >
            <Plus size={16} />
            <span>+ Token</span>
          </button>
        </div>
      </div>

      {/* 2. REAL CALENDAR DATE SELECTOR & DAILY HISTORY CONTROLS */}
      <div 
        className="card border-0 shadow-sm p-3"
        style={{ 
          borderRadius: '14px',
          backgroundColor: '#FFFDF9',
          border: '1px solid #F2E8DC'
        }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          {/* Left: Day Navigator & Real Date Picker */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center justify-content-center px-2"
                onClick={() => handleShiftDate(-1)}
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isViewingToday ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                onClick={handleSetToday}
              >
                Today (આજે)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedDate === getLocalDateString(new Date(Date.now() - 86400000)) ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                onClick={handleSetYesterday}
              >
                Yesterday (ગઈકાલે)
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center justify-content-center px-2"
                onClick={() => handleShiftDate(1)}
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Real HTML5 Calendar Date Input */}
            <div className="d-flex align-items-center gap-1 bg-white px-2 py-1 rounded border" style={{ borderColor: '#E8DCCF' }}>
              <Calendar size={15} className="text-secondary flex-shrink-0" />
              <input
                type="date"
                className="form-control form-control-sm border-0 p-0 fw-semibold"
                style={{ width: '135px', cursor: 'pointer', outline: 'none', background: 'transparent' }}
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                title="Select Calendar Date to view Daily Token History"
              />
            </div>
          </div>

          {/* Right: Date Badge & Live vs History Status */}
          <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
            <span className="fw-bold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '0.88rem' }}>
              <span className="text-secondary font-monospace">📅</span> {formattedDateTitle}
            </span>

            {isViewingToday ? (
              <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 d-flex align-items-center gap-1.5 fw-bold" style={{ fontSize: '0.72rem' }}>
                <span className="d-inline-block rounded-circle bg-success" style={{ width: 6, height: 6, boxShadow: '0 0 6px #198754' }} />
                LIVE QUEUE
              </span>
            ) : (
              <div className="d-flex align-items-center gap-1.5">
                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1 fw-bold" style={{ fontSize: '0.72rem' }}>
                  📜 HISTORICAL LOG
                </span>
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="btn btn-xs btn-outline-primary py-0 px-2 fw-semibold"
                  style={{ fontSize: '0.72rem' }}
                >
                  Return to Live Today
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. DAILY TOKEN METRICS SUMMARY CARDS */}
        <div className="row g-2 mt-2 pt-2 border-top">
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 bg-white rounded border text-center">
              <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>Total Tokens</span>
              <span className="fs-5 fw-bold text-dark">{metrics.total}</span>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 bg-white rounded border text-center border-warning-subtle">
              <span className="text-warning-emphasis d-block fw-semibold" style={{ fontSize: '0.68rem' }}>Waiting in Queue</span>
              <span className="fs-5 fw-bold text-warning">{metrics.waiting}</span>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 bg-white rounded border text-center border-primary-subtle">
              <span className="text-primary d-block fw-semibold" style={{ fontSize: '0.68rem' }}>Calling Reception</span>
              <span className="fs-5 fw-bold text-primary">{metrics.calling}</span>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 bg-white rounded border text-center border-success-subtle">
              <span className="text-success d-block fw-semibold" style={{ fontSize: '0.68rem' }}>Seated / Served</span>
              <span className="fs-5 fw-bold text-success">{metrics.seated}</span>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 bg-white rounded border text-center">
              <span className="text-secondary d-block" style={{ fontSize: '0.68rem' }}>Cancelled / Skipped</span>
              <span className="fs-5 fw-bold text-secondary">{metrics.cancelled}</span>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 bg-white rounded border text-center">
              <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>Avg Wait Time</span>
              <span className="fs-5 fw-bold text-dark d-flex align-items-center justify-content-center gap-1">
                <Clock size={13} className="text-muted" /> {metrics.avgWaitMinutes}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SPLIT SECTION: NEW TOKEN FORM (LEFT) & TOKENS TABLE (RIGHT) */}
      <div className="row g-3">
        {/* LEFT CARD: NEW TOKEN */}
        <div className="col-12 col-lg-4">
          <div 
            className="card h-100 shadow-sm border-0" 
            style={{ 
              borderRadius: '16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F0E6E6'
            }}
          >
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0" style={{ color: 'var(--brand-maroon, #7A1B28)', fontSize: '1.15rem' }}>
                  Issue New Token
                </h5>
                <span className="badge bg-light text-secondary border font-monospace" style={{ fontSize: '0.7rem' }}>
                  Next: T-{metrics.total + 1}
                </span>
              </div>

              {!isViewingToday && (
                <div className="alert alert-warning py-1.5 px-2.5 mb-3 small d-flex align-items-center gap-2" style={{ fontSize: '0.75rem' }}>
                  <AlertCircle size={15} className="text-warning flex-shrink-0" />
                  <span>Issuing a new token will register it for <strong>Today ({todayStr})</strong> and start from <strong>T-1</strong>.</span>
                </div>
              )}

              <form onSubmit={handleGenerate} className="d-flex flex-column gap-3">
                {/* Party Size Quick Selector */}
                <div>
                  <label className="form-label small fw-semibold text-secondary mb-2">
                    Party Size (કેટલા વ્યક્તિ?)
                  </label>
                  <div className="d-flex gap-2">
                    {[1, 2, 4, 6, 8].map(size => {
                      const isSelected = size === 8 ? partySize >= 8 : partySize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPartySize(size)}
                          className="btn flex-fill py-2 fw-bold"
                          style={{
                            borderRadius: '10px',
                            backgroundColor: isSelected ? 'var(--brand-maroon, #7A1B28)' : '#FFFFFF',
                            color: isSelected ? '#FFFFFF' : '#333333',
                            border: isSelected 
                              ? '1px solid var(--brand-maroon, #7A1B28)' 
                              : '1px solid #E8DCCF',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {size === 8 ? '8+' : size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Guest Name */}
                <div>
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Guest Name * (ગ્રાહકનું નામ)
                  </label>
                  <input
                    id="token-guest-name-input"
                    type="text"
                    className="form-control form-control-sm border rounded-3 p-2"
                    placeholder="e.g. Patel Family / Dev"
                    required
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                  />
                </div>

                {/* Phone Number (SMS will be sent) */}
                <div>
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Phone Number * <span className="text-muted fw-normal">(SMS will be sent)</span>
                  </label>
                  <input
                    type="tel"
                    className="form-control form-control-sm border rounded-3 p-2"
                    placeholder="10-digit mobile number"
                    required
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    style={{ borderColor: '#E8DCCF', fontSize: '0.9rem' }}
                  />
                </div>

                {/* Generate Token Button */}
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
                        <span>Generating Token...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={17} />
                        <span>Generate Token</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: TOKENS TABLE / DAILY QUEUE HISTORY */}
        <div className="col-12 col-lg-8">
          <div 
            className="card h-100 shadow-sm border-0" 
            style={{ 
              borderRadius: '16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F0E6E6'
            }}
          >
            <div className="card-body p-4">
              {/* Header Tabs & Search */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                {/* Filter Tabs */}
                <div className="scrollable-pills-container gap-1.5 pb-1 flex-grow-1" style={{ maxWidth: '100%' }}>
                  <button
                    onClick={() => setActiveTab('ALL')}
                    className="btn btn-sm px-2.5 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'ALL' ? 'var(--brand-maroon, #7A1B28)' : '#F5F5F5',
                      color: activeTab === 'ALL' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.8rem'
                    }}
                  >
                    All ({metrics.total})
                  </button>
                  <button
                    onClick={() => setActiveTab('WAITING')}
                    className="btn btn-sm px-2.5 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'WAITING' ? '#FFC107' : '#F5F5F5',
                      color: activeTab === 'WAITING' ? '#000000' : '#666666',
                      border: 'none',
                      fontSize: '0.8rem'
                    }}
                  >
                    Waiting ({metrics.waiting})
                  </button>
                  <button
                    onClick={() => setActiveTab('CALLING')}
                    className="btn btn-sm px-2.5 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'CALLING' ? '#0D6EFD' : '#F5F5F5',
                      color: activeTab === 'CALLING' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.8rem'
                    }}
                  >
                    Calling ({metrics.calling})
                  </button>
                  <button
                    onClick={() => setActiveTab('SERVED')}
                    className="btn btn-sm px-2.5 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'SERVED' ? '#198754' : '#F5F5F5',
                      color: activeTab === 'SERVED' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.8rem'
                    }}
                  >
                    Served ({metrics.seated})
                  </button>
                  <button
                    onClick={() => setActiveTab('CANCELLED')}
                    className="btn btn-sm px-2.5 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'CANCELLED' ? '#6C757D' : '#F5F5F5',
                      color: activeTab === 'CANCELLED' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.8rem'
                    }}
                  >
                    Cancelled ({metrics.cancelled})
                  </button>
                </div>

                {/* Search */}
                <div className="input-group input-group-sm ms-auto" style={{ width: 180, minWidth: 140 }}>
                  <span className="input-group-text bg-light border-end-0">
                    <Search size={14} className="text-muted" />
                  </span>
                  <input
                    type="text"
                    className="form-control form-control-sm border-start-0"
                    placeholder="Search guest/token..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Table */}
              <div className="table-responsive" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="table table-hover align-middle mb-0" style={{ minWidth: '620px', fontSize: '0.88rem' }}>
                  <thead style={{ backgroundColor: '#FAF5EE', color: 'var(--brand-maroon, #7A1B28)' }}>
                    <tr>
                      <th className="py-2.5 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>TOKEN</th>
                      <th className="py-2.5 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>GUEST</th>
                      <th className="py-2.5 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>PARTY</th>
                      <th className="py-2.5 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>TIME</th>
                      <th className="py-2.5 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>STATUS</th>
                      <th className="py-2.5 px-3 fw-bold border-bottom-0 text-end" style={{ letterSpacing: '0.04em' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5 text-muted">
                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                          Loading tokens for {formattedDateTitle}...
                        </td>
                      </tr>
                    ) : filteredTokens.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5 text-muted">
                          <div className="my-3">
                            <p className="mb-1 fw-semibold text-secondary">No tokens found for {formattedDateTitle}.</p>
                            <small className="text-muted">
                              {isViewingToday 
                                ? 'Use the form on the left to issue token T-1 for today.' 
                                : 'No token activity was recorded on this date.'}
                            </small>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTokens.map(token => (
                        <tr key={token.id}>
                          {/* TOKEN CODE */}
                          <td className="px-3 py-2.5">
                            <span 
                              className="badge px-2.5 py-1 fs-6 font-monospace"
                              style={{
                                backgroundColor: 'var(--brand-maroon, #7A1B28)',
                                color: '#FFFFFF'
                              }}
                            >
                              {token.tokenCode}
                            </span>
                          </td>

                          {/* GUEST */}
                          <td className="px-3 py-2.5">
                            <div>
                              <span className="fw-bold text-dark">{token.customerName}</span>
                              <div className="small text-muted d-flex align-items-center gap-1">
                                <Phone size={11} /> {token.customerPhone}
                              </div>
                            </div>
                          </td>

                          {/* PARTY */}
                          <td className="px-3 py-2.5">
                            <span className="d-inline-flex align-items-center gap-1 fw-semibold text-secondary">
                              <Users size={13} /> {token.partySize} Persons
                            </span>
                          </td>

                          {/* TIME */}
                          <td className="px-3 py-2.5">
                            <span className="small text-muted d-block">
                              {new Date(token.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                            {token.seatedAt && (
                              <small className="text-success d-block" style={{ fontSize: '0.68rem' }}>
                                Seated: {new Date(token.seatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </small>
                            )}
                          </td>

                          {/* STATUS */}
                          <td className="px-3 py-2.5">
                            <div className="d-flex align-items-center gap-1 flex-wrap">
                              <span className={`badge px-2 py-1 ${
                                token.status === 'WAITING' 
                                  ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' 
                                  : token.status === 'CALLED' || token.status === 'RECALLED'
                                    ? 'bg-primary text-white'
                                    : token.status === 'SEATED' || token.status === 'COMPLETED'
                                      ? 'bg-success text-white'
                                      : 'bg-secondary text-white'
                              }`}>
                                {token.status}
                              </span>
                              {token.tableId && (() => {
                                const seatedTbl = tables.find(t => t.id === token.tableId);
                                if (!seatedTbl) return null;
                                const tNum = seatedTbl.isMerged && seatedTbl.mergedTableNumbers && seatedTbl.mergedTableNumbers.length > 0
                                  ? seatedTbl.mergedTableNumbers.join(' + ')
                                  : seatedTbl.tableNumber;
                                return (
                                  <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '0.72rem' }} title={`Seated at Table ${tNum}`}>
                                    🪑 Table {tNum}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>

                          {/* ACTIONS */}
                          <td className="px-3 py-2.5 text-end">
                            <div className="d-flex justify-content-end align-items-center gap-1">
                              {/* Print Token Slip Button */}
                              <button
                                onClick={() => handlePrintSlip(token)}
                                className="btn btn-outline-secondary btn-sm p-1 px-1.5"
                                title="Print 80mm Token Slip"
                              >
                                <Printer size={13} />
                              </button>

                              {token.status === 'WAITING' && (
                                <button
                                  onClick={() => handleCall(token.id)}
                                  className="btn btn-warning btn-sm p-1 px-2 d-flex align-items-center gap-1 fw-semibold text-dark shadow-sm"
                                  title="Call Token to Reception"
                                >
                                  <Megaphone size={13} /> Call
                                </button>
                              )}

                              {(token.status === 'CALLED' || token.status === 'RECALLED') && (
                                <button
                                  onClick={() => handleRecall(token.id)}
                                  className="btn btn-outline-warning btn-sm p-1 px-2 d-flex align-items-center gap-1"
                                  title="Recall Token"
                                >
                                  <RotateCcw size={13} /> Recall
                                </button>
                              )}

                              {token.status !== 'SEATED' && token.status !== 'CANCELLED' && token.status !== 'COMPLETED' && (
                                <button
                                  onClick={() => handleOpenSeatModal(token)}
                                  className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1 shadow-sm"
                                  title="Seat Guest at Dining Table"
                                >
                                  <UserCheck size={13} /> Seat
                                </button>
                              )}

                              {(token.status === 'SEATED' || token.tableId) && (
                                <button
                                  onClick={() => {
                                    const seatedTbl = tables.find(t => t.id === token.tableId);
                                    const tId = seatedTbl?.id || token.tableId || '';
                                    const tNum = seatedTbl?.tableNumber || '';
                                    navigate(
                                      `/pos?tableId=${tId}&tableNumber=${encodeURIComponent(tNum)}&customerName=${encodeURIComponent(token.customerName)}&customerPhone=${encodeURIComponent(token.customerPhone)}&tokenCode=${encodeURIComponent(token.tokenCode)}`
                                    );
                                  }}
                                  className="btn btn-primary btn-sm p-1 px-2 d-flex align-items-center gap-1 shadow-sm"
                                  title="Take / View Order in POS with Auto-selected Table"
                                >
                                  <ShoppingBag size={13} /> Order
                                </button>
                              )}

                              {token.status === 'WAITING' && (
                                <button
                                  onClick={() => handleCancelToken(token.id)}
                                  className="btn btn-outline-secondary btn-sm p-1"
                                  title="Cancel Token"
                                >
                                  <X size={13} />
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
        </div>
      </div>

      {/* SEAT GUEST MODAL */}
      <Modal
        isOpen={!!seatingToken}
        onClose={() => setSeatingToken(null)}
        title={`Seat Guest: ${seatingToken?.customerName} (${seatingToken?.tokenCode})`}
      >
        {seatingToken && (
          <form onSubmit={handleConfirmSeat} className="d-flex flex-column gap-3">
            <div className="p-3 bg-light rounded border">
              <div className="d-flex justify-content-between mb-1">
                <span className="text-secondary small">Party Size:</span>
                <span className="fw-bold">{seatingToken.partySize} Persons</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-secondary small">Contact:</span>
                <span className="font-monospace">{seatingToken.customerPhone}</span>
              </div>
            </div>

            <div>
              <label className="form-label small fw-bold">Select Dining Table</label>
              <select
                className="form-select form-select-sm"
                value={selectedTableId}
                onChange={e => setSelectedTableId(e.target.value)}
              >
                <option value="">-- No Specific Table (Direct Seat) --</option>
                {tables.filter(t => t.status === 'AVAILABLE' && !t.isMergedChild).map(t => {
                  const tLabel = t.isMerged 
                    ? `${t.mergedTableNumbers?.join(' + ') || t.tableNumber} (Merged: ${t.mergedCapacity || t.capacity} Seats | Zone: ${t.floorZone?.replace('_', ' ')})`
                    : `${t.tableNumber} (Seats: ${t.capacity} | Zone: ${t.floorZone?.replace('_', ' ')})`;
                  return (
                    <option key={t.id} value={t.id}>
                      {tLabel}
                    </option>
                  );
                })}
              </select>
              <div className="form-text small mt-1 d-flex justify-content-between align-items-center">
                <span>
                  {tables.filter(t => t.status === 'AVAILABLE').length === 0
                    ? 'No tables are currently marked AVAILABLE.'
                    : 'Assigning a table will automatically mark it OCCUPIED on the Dining Floor map.'}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/tables')}
                  className="btn btn-link p-0 text-decoration-none fw-semibold"
                  style={{ fontSize: '0.75rem' }}
                >
                  🔗 Merge Tables
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSeatingToken(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                disabled={seatingSubmitting}
              >
                <UserCheck size={15} />
                {seatingSubmitting ? 'Seating...' : 'Confirm Seating'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* QUICK TOKEN ISSUED CONFIRMATION MODAL */}
      <Modal
        isOpen={!!printingToken}
        onClose={() => setPrintingToken(null)}
        title="Token Issued Successfully!"
        size="sm"
      >
        {printingToken && (
          <div className="d-flex flex-column align-items-center text-center p-2">
            <div className="badge bg-success-subtle text-success p-2 rounded-circle mb-2">
              <CheckCircle2 size={32} />
            </div>

            <h4 className="fw-bold mb-1" style={{ color: 'var(--brand-maroon, #7A1B28)' }}>
              Token #{printingToken.tokenCode}
            </h4>
            <p className="text-muted small mb-3">
              Guest: <strong>{printingToken.customerName}</strong> ({printingToken.partySize} Guests)<br/>
              Phone: {printingToken.customerPhone}
            </p>

            <div className="d-flex gap-2 w-100 pt-2 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm flex-fill"
                onClick={() => setPrintingToken(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm flex-fill d-flex align-items-center justify-content-center gap-1 shadow-sm"
                onClick={() => {
                  const t = printingToken;
                  setPrintingToken(null);
                  handlePrintSlip(t);
                }}
              >
                <Printer size={14} /> Print Slip
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

