import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { useSocket } from '../../context/SocketContext';
import { QueueToken } from '../../types';
import { 
  Megaphone, 
  RotateCcw, 
  FastForward, 
  UserCheck, 
  Plus, 
  Search, 
  Volume2, 
  CheckCircle2, 
  Clock, 
  Phone,
  Users,
  X
} from 'lucide-react';

export const TokenPage: React.FC = () => {
  const { can } = usePermission();
  const { socket } = useSocket();

  // Current system clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // Tokens state
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<'ALL' | 'WAITING' | 'CALLING' | 'SERVED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // New Token Form State
  const [partySize, setPartySize] = useState<number>(2);
  const [guestName, setGuestName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Update real-time clock every second
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

  // Load Queue Tokens
  const loadQueue = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/tokens/queue');
      if (res.success) {
        setTokens(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load queue tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    socket.on('token.updated', () => loadQueue());
    return () => {
      socket.off('token.updated');
    };
  }, [socket]);

  // Handle Token Generation
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
        estimatedWaitMinutes: partySize > 4 ? 25 : 15
      });

      if (res.success) {
        setGuestName('');
        setPhoneNumber('');
        setPartySize(2);
        loadQueue();
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
      loadQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecall = async (id: string) => {
    try {
      await apiClient.patch(`/tokens/${id}/recall`);
      loadQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSkip = async (id: string) => {
    try {
      await apiClient.patch(`/tokens/${id}/skip`);
      loadQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSeatDirect = async (id: string) => {
    try {
      await apiClient.patch(`/tokens/${id}/seat`, {});
      loadQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Call Next Waiting Token
  const handleCallNext = async () => {
    const nextToken = tokens.find(t => t.status === 'WAITING');
    if (nextToken) {
      handleCall(nextToken.id);
    } else {
      alert('No waiting tokens in the queue right now.');
    }
  };

  // Counts
  const waitingCount = tokens.filter(t => t.status === 'WAITING').length;
  const callingCount = tokens.filter(t => t.status === 'CALLED' || t.status === 'RECALLED').length;
  const servedCount = tokens.filter(t => t.status === 'SEATED').length;

  // Filtered Tokens
  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      let matchesTab = true;
      if (activeTab === 'WAITING') matchesTab = t.status === 'WAITING';
      else if (activeTab === 'CALLING') matchesTab = t.status === 'CALLED' || t.status === 'RECALLED';
      else if (activeTab === 'SERVED') matchesTab = t.status === 'SEATED';

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
            Token Counter
          </span>
        </div>

        {/* Right Actions: Live Clock, Call Next, + Token */}
        <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
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
            <span>{currentTime || '10:50:45 pm'}</span>
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
              padding: '6px 12px'
            }}
          >
            <Volume2 size={15} />
            <span>Call Next</span>
          </button>

          {/* + Token Button */}
          <button
            onClick={() => {
              const nameInput = document.getElementById('token-guest-name-input');
              if (nameInput) nameInput.focus();
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

      {/* 2. SPLIT SECTION: NEW TOKEN FORM (LEFT) & TOKENS TABLE (RIGHT) */}
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
              <h5 className="fw-bold mb-4" style={{ color: 'var(--brand-maroon, #7A1B28)', fontSize: '1.2rem' }}>
                New Token
              </h5>

              <form onSubmit={handleGenerate} className="d-flex flex-column gap-3">
                {/* Party Size Quick Selector */}
                <div>
                  <label className="form-label small fw-semibold text-secondary mb-2">
                    Party Size
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
                    Guest Name *
                  </label>
                  <input
                    id="token-guest-name-input"
                    type="text"
                    className="form-control form-control-sm border rounded-3 p-2"
                    placeholder="e.g. Patel Family"
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
                        <span>Generating...</span>
                      </>
                    ) : (
                      <span>Generate Token</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: TOKENS TABLE / COUNTER */}
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
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                {/* Filter Tabs */}
                <div className="scrollable-pills-container gap-2 pb-1 flex-grow-1" style={{ maxWidth: '100%' }}>
                  <button
                    onClick={() => setActiveTab('ALL')}
                    className="btn btn-sm px-3 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'ALL' ? 'var(--brand-maroon, #7A1B28)' : '#F5F5F5',
                      color: activeTab === 'ALL' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.85rem'
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveTab('WAITING')}
                    className="btn btn-sm px-3 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'WAITING' ? 'var(--brand-maroon, #7A1B28)' : '#F5F5F5',
                      color: activeTab === 'WAITING' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.85rem'
                    }}
                  >
                    Waiting ({waitingCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('CALLING')}
                    className="btn btn-sm px-3 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'CALLING' ? 'var(--brand-maroon, #7A1B28)' : '#F5F5F5',
                      color: activeTab === 'CALLING' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.85rem'
                    }}
                  >
                    Calling
                  </button>
                  <button
                    onClick={() => setActiveTab('SERVED')}
                    className="btn btn-sm px-3 py-1 fw-semibold rounded-pill text-nowrap"
                    style={{
                      backgroundColor: activeTab === 'SERVED' ? 'var(--brand-maroon, #7A1B28)' : '#F5F5F5',
                      color: activeTab === 'SERVED' ? '#FFFFFF' : '#666666',
                      border: 'none',
                      fontSize: '0.85rem'
                    }}
                  >
                    Served
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
                    placeholder="Search..."
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
                      <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>TOKEN</th>
                      <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>GUEST</th>
                      <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>PARTY</th>
                      <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>TIME</th>
                      <th className="py-3 px-3 fw-bold border-bottom-0" style={{ letterSpacing: '0.04em' }}>STATUS</th>
                      <th className="py-3 px-3 fw-bold border-bottom-0 text-end" style={{ letterSpacing: '0.04em' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5 text-muted">
                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                          Loading tokens...
                        </td>
                      </tr>
                    ) : filteredTokens.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5 text-muted">
                          <div className="my-3">No tokens found.</div>
                        </td>
                      </tr>
                    ) : (
                      filteredTokens.map(token => (
                        <tr key={token.id}>
                          {/* TOKEN */}
                          <td className="px-3 py-3">
                            <span 
                              className="badge px-3 py-1 fs-6 font-monospace"
                              style={{
                                backgroundColor: 'var(--brand-maroon, #7A1B28)',
                                color: '#FFFFFF'
                              }}
                            >
                              {token.tokenCode}
                            </span>
                          </td>

                          {/* GUEST */}
                          <td className="px-3 py-3">
                            <div>
                              <span className="fw-bold text-dark">{token.customerName}</span>
                              <div className="small text-muted d-flex align-items-center gap-1">
                                <Phone size={11} /> {token.customerPhone}
                              </div>
                            </div>
                          </td>

                          {/* PARTY */}
                          <td className="px-3 py-3">
                            <span className="d-inline-flex align-items-center gap-1 fw-semibold text-secondary">
                              <Users size={13} /> {token.partySize} Persons
                            </span>
                          </td>

                          {/* TIME */}
                          <td className="px-3 py-3">
                            <span className="small text-muted">
                              {new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td className="px-3 py-3">
                            <span className={`badge px-2 py-1 ${
                              token.status === 'WAITING' 
                                ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' 
                                : token.status === 'CALLED' || token.status === 'RECALLED'
                                  ? 'bg-primary text-white'
                                  : token.status === 'SEATED'
                                    ? 'bg-success text-white'
                                    : 'bg-secondary text-white'
                            }`}>
                              {token.status}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td className="px-3 py-3 text-end">
                            <div className="d-flex justify-content-end align-items-center gap-1">
                              {token.status === 'WAITING' && (
                                <button
                                  onClick={() => handleCall(token.id)}
                                  className="btn btn-warning btn-sm p-1 px-2 d-flex align-items-center gap-1 fw-semibold text-dark shadow-sm"
                                  title="Call Token"
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

                              {token.status !== 'SEATED' && token.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => handleSeatDirect(token.id)}
                                  className="btn btn-success btn-sm p-1 px-2 d-flex align-items-center gap-1 shadow-sm"
                                  title="Mark Seated / Served"
                                >
                                  <UserCheck size={13} /> Seat
                                </button>
                              )}

                              {token.status === 'WAITING' && (
                                <button
                                  onClick={() => handleSkip(token.id)}
                                  className="btn btn-outline-secondary btn-sm p-1"
                                  title="Skip / Cancel"
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
    </div>
  );
};

