import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { Modal } from '../../components/PermissionGate';
import {
  Database,
  Search,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Download,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileJson,
  ShieldAlert,
  Copy,
  Check,
  Table,
  ChevronLeft,
  ChevronRight,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';

interface CollectionItem {
  key: string;
  name: string;
  category: 'TRANSACTIONAL' | 'MASTER' | 'SYSTEM';
  dateField?: string;
  count: number;
}

export const DatabaseToolsPage: React.FC = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'EXPLORER' | 'PURGE' | 'SNAPSHOT'>('EXPLORER');

  // Collections Registry Metadata
  const [collections, setCollections] = useState<CollectionItem[]>([]);

  // -------------------------------------------------------------
  // TAB 1: DATA EXPLORER & CRUD STATES
  // -------------------------------------------------------------
  const [selectedColKey, setSelectedColKey] = useState<string>('bills');
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');

  // CRUD Modals
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRecordJson, setNewRecordJson] = useState('{\n  \n}');
  const [isCreating, setIsCreating] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editRecordJson, setEditRecordJson] = useState('{}');
  const [isUpdating, setIsUpdating] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'insert' | 'upsert'>('insert');
  const [isImporting, setIsImporting] = useState(false);

  // -------------------------------------------------------------
  // TAB 2: DATE-WISE PURGE & BATCH EXPORT STATES
  // -------------------------------------------------------------
  const [purgeDate, setPurgeDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [purgeEndDate, setPurgeEndDate] = useState<string>('');
  const [isDateRange, setIsDateRange] = useState(false);

  const [isScanningDate, setIsScanningDate] = useState(false);
  const [datePreview, setDatePreview] = useState<{
    dateRange: { startDate: string; endDate: string };
    totalRecords: number;
    breakdown: Record<string, { name: string; count: number }>;
  } | null>(null);

  // Purge Confirmation Modal
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [selectedPurgeCollections, setSelectedPurgeCollections] = useState<string[]>([]);
  const [purgeConfirmationInput, setPurgeConfirmationInput] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<any>(null);

  // -------------------------------------------------------------
  // TAB 3: SNAPSHOT & RESEED STATES
  // -------------------------------------------------------------
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // -------------------------------------------------------------
  // LOAD COLLECTIONS METADATA
  // -------------------------------------------------------------
  const loadCollections = async () => {
    try {
      const res: any = await apiClient.get('/system/database/collections');
      if (res.success && Array.isArray(res.data)) {
        setCollections(res.data);
        if (res.data.length > 0 && !selectedColKey) {
          setSelectedColKey(res.data[0].key);
        }
      }
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  // -------------------------------------------------------------
  // QUERY RECORDS FOR SELECTED COLLECTION
  // -------------------------------------------------------------
  const queryRecords = async (targetPage = page) => {
    if (!selectedColKey) return;
    setLoadingRecords(true);
    try {
      const params: any = {
        collection: selectedColKey,
        page: targetPage,
        limit
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (dateFilterStart) params.startDate = dateFilterStart;
      if (dateFilterEnd) params.endDate = dateFilterEnd;

      const res: any = await apiClient.get('/system/database/query', { params });
      if (res.success && res.data) {
        setRecords(res.data.records || []);
        setTotalRecords(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        setPage(res.data.page || targetPage);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to query collection records.');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    setPage(1);
    queryRecords(1);
  }, [selectedColKey, dateFilterStart, dateFilterEnd]);

  // Selected collection object
  const activeColMeta = useMemo(() => {
    return collections.find((c) => c.key === selectedColKey);
  }, [collections, selectedColKey]);

  // Handle Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    queryRecords(1);
  };

  // -------------------------------------------------------------
  // DIRECT RECORD CRUD HANDLERS
  // -------------------------------------------------------------
  const handleOpenAddModal = () => {
    let sample: any = {};
    if (records.length > 0) {
      const clone = { ...records[0] };
      delete clone._id;
      delete clone.id;
      delete clone.createdAt;
      delete clone.updatedAt;
      sample = clone;
    }
    setNewRecordJson(JSON.stringify(sample, null, 2));
    setIsAddModalOpen(true);
  };

  const handleCreateRecord = async () => {
    setIsCreating(true);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(newRecordJson);
      } catch (jsonErr: any) {
        throw new Error(`Invalid JSON syntax: ${jsonErr.message}`);
      }

      const res: any = await apiClient.post('/system/database/record', {
        collection: selectedColKey,
        data: parsed
      });

      if (res.success) {
        alert('Record created successfully in database!');
        setIsAddModalOpen(false);
        queryRecords(1);
        loadCollections();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create record.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditModal = (rec: any) => {
    setEditingRecord(rec);
    const clone = { ...rec };
    delete clone._id;
    setEditRecordJson(JSON.stringify(clone, null, 2));
    setIsEditModalOpen(true);
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;
    setIsUpdating(true);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(editRecordJson);
      } catch (jsonErr: any) {
        throw new Error(`Invalid JSON syntax: ${jsonErr.message}`);
      }

      const targetId = editingRecord.id || editingRecord._id;
      const res: any = await apiClient.put(`/system/database/record/${targetId}`, {
        collection: selectedColKey,
        data: parsed
      });

      if (res.success) {
        alert('Record updated successfully in database!');
        setIsEditModalOpen(false);
        queryRecords(page);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update record.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenDeleteModal = (rec: any) => {
    setDeletingRecord(rec);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);
    try {
      const targetId = deletingRecord.id || deletingRecord._id;
      const res: any = await apiClient.delete(`/system/database/record/${targetId}`, {
        params: { collection: selectedColKey }
      });

      if (res.success) {
        alert('Record permanently deleted from database!');
        setIsDeleteModalOpen(false);
        queryRecords(page);
        loadCollections();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Filtered Records from Explorer
  const handleExportFiltered = async (format: 'json' | 'csv' = 'json') => {
    try {
      const res: any = await apiClient.post('/system/database/export', {
        collections: [selectedColKey],
        startDate: dateFilterStart || undefined,
        endDate: dateFilterEnd || undefined
      });

      if (res.success && res.data) {
        const rows = res.data.data?.[selectedColKey] || [];
        if (rows.length === 0) {
          alert('No records to export for this filter.');
          return;
        }

        if (format === 'json') {
          const jsonStr = JSON.stringify(rows, null, 2);
          downloadFile(
            jsonStr,
            `${selectedColKey}_export_${new Date().toISOString().slice(0, 10)}.json`,
            'application/json'
          );
        } else {
          // Flatten into CSV
          const headers = Object.keys(rows[0]).filter((k) => k !== '_id');
          const csvLines = [headers.join(',')];
          rows.forEach((r: any) => {
            const rowVals = headers.map((h) => {
              const val = r[h];
              if (val === null || val === undefined) return '""';
              if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
              return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvLines.push(rowVals.join(','));
          });
          downloadFile(
            csvLines.join('\n'),
            `${selectedColKey}_export_${new Date().toISOString().slice(0, 10)}.csv`,
            'text/csv'
          );
        }
      }
    } catch (err: any) {
      alert(err.message || 'Export failed.');
    }
  };

  // Import Data Handler
  const handleImportData = async () => {
    setIsImporting(true);
    try {
      let parsed: any[];
      try {
        parsed = JSON.parse(importJsonText);
        if (!Array.isArray(parsed)) parsed = [parsed];
      } catch (jsonErr: any) {
        throw new Error(`Invalid JSON format: ${jsonErr.message}`);
      }

      const res: any = await apiClient.post('/system/database/import', {
        collection: selectedColKey,
        records: parsed,
        mode: importMode
      });

      if (res.success) {
        alert(`Import completed! Processed: ${res.data.processed}, Inserted: ${res.data.inserted}, Updated: ${res.data.updated}`);
        setIsImportModalOpen(false);
        setImportJsonText('');
        queryRecords(1);
        loadCollections();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to import data.');
    } finally {
      setIsImporting(false);
    }
  };

  // Helper to trigger browser file download
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // TAB 2: DATE PURGE & BATCH EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleScanDate = async () => {
    if (!purgeDate) {
      alert('Please enter a valid date to scan.');
      return;
    }
    setIsScanningDate(true);
    setDatePreview(null);
    setPurgeResult(null);
    try {
      const res: any = await apiClient.post('/system/database/date-preview', {
        startDate: purgeDate,
        endDate: isDateRange && purgeEndDate ? purgeEndDate : purgeDate
      });
      if (res.success && res.data) {
        setDatePreview(res.data);
        // Pre-select all collections that have count > 0
        const activeKeys = Object.keys(res.data.breakdown).filter(
          (k) => res.data.breakdown[k].count > 0
        );
        setSelectedPurgeCollections(activeKeys);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to scan date records.');
    } finally {
      setIsScanningDate(false);
    }
  };

  const handleDownloadDateBackup = async () => {
    if (!datePreview) return;
    try {
      const res: any = await apiClient.post('/system/database/export', {
        collections: Object.keys(datePreview.breakdown),
        startDate: datePreview.dateRange.startDate,
        endDate: datePreview.dateRange.endDate
      });
      if (res.success && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        downloadFile(
          jsonStr,
          `restaurant_erp_backup_${datePreview.dateRange.startDate}${
            datePreview.dateRange.endDate !== datePreview.dateRange.startDate
              ? `_to_${datePreview.dateRange.endDate}`
              : ''
          }.json`,
          'application/json'
        );
        alert('Date backup exported and downloaded successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to export date backup.');
    }
  };

  const expectedPurgePhrase = useMemo(() => {
    if (!datePreview) return '';
    const { startDate, endDate } = datePreview.dateRange;
    return startDate === endDate ? `DELETE ${startDate}` : `DELETE ${startDate}_TO_${endDate}`;
  }, [datePreview]);

  const handleExecutePurge = async () => {
    if (!datePreview) return;
    if (selectedPurgeCollections.length === 0) {
      alert('Please select at least one collection to purge.');
      return;
    }
    if (purgeConfirmationInput.trim().toUpperCase() !== expectedPurgePhrase.toUpperCase()) {
      alert(`Confirmation phrase mismatch! Please type exact phrase: ${expectedPurgePhrase}`);
      return;
    }

    setIsPurging(true);
    try {
      const res: any = await apiClient.post('/system/database/date-purge', {
        startDate: datePreview.dateRange.startDate,
        endDate: datePreview.dateRange.endDate,
        collections: selectedPurgeCollections,
        confirmationPhrase: purgeConfirmationInput.trim()
      });

      if (res.success) {
        setPurgeResult(res.data);
        alert(`Permanent purge completed! ${res.data.totalDeleted} records removed.`);
        setIsPurgeModalOpen(false);
        setPurgeConfirmationInput('');
        handleScanDate(); // Refresh preview
        loadCollections(); // Refresh collection counts
      }
    } catch (err: any) {
      alert(err.message || 'Purge failed.');
    } finally {
      setIsPurging(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 3: SNAPSHOT & RESEED HANDLERS
  // -------------------------------------------------------------
  const handleExportFullSnapshot = async () => {
    setIsSnapshotting(true);
    try {
      const res: any = await apiClient.post('/system/database/snapshot');
      if (res.success && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        downloadFile(
          jsonStr,
          `restaurant_erp_full_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
          'application/json'
        );
        alert('Full database snapshot downloaded successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Snapshot generation failed.');
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleReseed = async () => {
    setIsSeeding(true);
    try {
      const res: any = await apiClient.post('/system/database/reseed');
      if (res.success) {
        alert(`Seed Integrity Verified!\nPermissions: ${res.data?.counts?.permissions ?? 'OK'}\nRoles: ${res.data?.counts?.roles ?? 'OK'}\nUsers: ${res.data?.counts?.users ?? 'OK'}`);
      }
    } catch (err: any) {
      alert(err.message || 'Reseed check failed.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3 text-white">
      {/* HEADER BAR */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 border-bottom border-secondary pb-2.5">
        <div>
          <h4 className="fw-bold mb-0.5 text-white d-flex align-items-center gap-2">
            <Database size={22} className="text-info" /> Database Management & Operations Studio
          </h4>
          <p className="text-secondary small mb-0">
            Direct CRUD browser, date-range export/import, and safe date-wise permanent data purge.
          </p>
        </div>

        {/* Studio Tabs */}
        <div className="btn-group shadow-sm" style={{ minHeight: 36 }}>
          <button
            type="button"
            className={`btn btn-sm px-3 d-flex align-items-center gap-1.5 fw-semibold ${
              activeTab === 'EXPLORER' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={() => setActiveTab('EXPLORER')}
          >
            <Table size={15} /> Direct Data Explorer (CRUD)
          </button>
          <button
            type="button"
            className={`btn btn-sm px-3 d-flex align-items-center gap-1.5 fw-semibold ${
              activeTab === 'PURGE' ? 'btn-danger' : 'btn-outline-secondary'
            }`}
            onClick={() => setActiveTab('PURGE')}
          >
            <Calendar size={15} /> Date-Wise Purge & Export
          </button>
          <button
            type="button"
            className={`btn btn-sm px-3 d-flex align-items-center gap-1.5 fw-semibold ${
              activeTab === 'SNAPSHOT' ? 'btn-info text-dark' : 'btn-outline-secondary'
            }`}
            onClick={() => setActiveTab('SNAPSHOT')}
          >
            <FileJson size={15} /> Backup & Reseed
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DIRECT DATA EXPLORER & CRUD STUDIO                 */}
      {/* ========================================================= */}
      {activeTab === 'EXPLORER' && (
        <div className="d-flex flex-column gap-3">
          {/* Controls Bar: Collection Select, Date Range, Search & Actions */}
          <div className="card bg-black border border-secondary p-3 shadow-sm">
            <div className="row g-2.5 align-items-center">
              {/* Collection Selector */}
              <div className="col-12 col-md-3">
                <label className="form-label small text-secondary fw-bold mb-1 d-flex align-items-center justify-content-between">
                  <span>Target Collection</span>
                  <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                    {collections.length} Collections
                  </span>
                </label>
                <select
                  className="form-select form-select-sm bg-dark text-white border-secondary fw-bold"
                  value={selectedColKey}
                  onChange={(e) => setSelectedColKey(e.target.value)}
                >
                  <optgroup label="Transactional (Date-Filtered)">
                    {collections
                      .filter((c) => c.category === 'TRANSACTIONAL')
                      .map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name} ({c.count.toLocaleString()})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Master Data (Protected)">
                    {collections
                      .filter((c) => c.category === 'MASTER')
                      .map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name} ({c.count.toLocaleString()})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="System & Security">
                    {collections
                      .filter((c) => c.category === 'SYSTEM')
                      .map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name} ({c.count.toLocaleString()})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Date Filter Range (If collection supports it) */}
              {activeColMeta?.dateField ? (
                <div className="col-12 col-md-4">
                  <label className="form-label small text-secondary fw-bold mb-1">
                    Between Dates ({activeColMeta.dateField})
                  </label>
                  <div className="d-flex align-items-center gap-1.5">
                    <input
                      type="date"
                      className="form-control form-control-sm bg-dark text-white border-secondary"
                      value={dateFilterStart}
                      onChange={(e) => setDateFilterStart(e.target.value)}
                    />
                    <span className="text-secondary small">to</span>
                    <input
                      type="date"
                      className="form-control form-control-sm bg-dark text-white border-secondary"
                      value={dateFilterEnd}
                      onChange={(e) => setDateFilterEnd(e.target.value)}
                    />
                    {(dateFilterStart || dateFilterEnd) && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm p-1"
                        title="Clear Dates"
                        onClick={() => {
                          setDateFilterStart('');
                          setDateFilterEnd('');
                        }}
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="col-12 col-md-4">
                  <div className="text-secondary small pt-4">
                    <em>Date filtering not applicable for master records.</em>
                  </div>
                </div>
              )}

              {/* Search Box */}
              <div className="col-12 col-md-3">
                <label className="form-label small text-secondary fw-bold mb-1">Search Fields</label>
                <form onSubmit={handleSearchSubmit} className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="Search by ID, name, code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary">
                    <Search size={14} />
                  </button>
                </form>
              </div>

              {/* Action Buttons */}
              <div className="col-12 col-md-2 d-flex align-items-end justify-content-end gap-1.5 pt-md-4">
                <button
                  type="button"
                  className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm fw-bold"
                  onClick={handleOpenAddModal}
                  title="Add new document"
                >
                  <Plus size={14} /> Add Record
                </button>
                <button
                  type="button"
                  className="btn btn-outline-info btn-sm p-1.5"
                  onClick={() => handleExportFiltered('json')}
                  title="Export JSON"
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm p-1.5"
                  onClick={() => handleExportFiltered('csv')}
                  title="Export CSV"
                >
                  <FileSpreadsheet size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline-warning btn-sm p-1.5"
                  onClick={() => setIsImportModalOpen(true)}
                  title="Import JSON Records"
                >
                  <Upload size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="card bg-black border border-secondary shadow-sm">
            <div className="card-header bg-dark border-secondary d-flex justify-content-between align-items-center py-2 px-3">
              <span className="small text-secondary fw-bold">
                Showing {records.length} of {totalRecords} records in{' '}
                <strong className="text-white">{activeColMeta?.name}</strong>
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm py-0.5 px-2 d-flex align-items-center gap-1"
                style={{ fontSize: '0.75rem' }}
                onClick={() => queryRecords(page)}
              >
                <RefreshCw size={12} className={loadingRecords ? 'spin' : ''} /> Refresh
              </button>
            </div>

            <div className="table-responsive" style={{ maxHeight: '60vh' }}>
              <table className="table table-dark table-hover align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                <thead className="table-secondary text-dark sticky-top">
                  <tr>
                    <th style={{ width: 140 }}>Record ID</th>
                    {activeColMeta?.dateField && <th style={{ width: 130 }}>Date / Timestamp</th>}
                    <th>Key Details Preview</th>
                    <th className="text-end" style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRecords ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted">
                        <span className="spinner-border spinner-border-sm me-2" /> Loading records...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted">
                        No records match the current filter or date range.
                      </td>
                    </tr>
                  ) : (
                    records.map((row, idx) => {
                      const idVal = row.id || row._id || `row-${idx}`;
                      const dateVal = activeColMeta?.dateField ? row[activeColMeta.dateField] : null;

                      // Display key preview fields (excluding internal ids)
                      const previewFields = Object.keys(row)
                        .filter((k) => !['_id', '__v', 'id', 'createdAt', 'updatedAt'].includes(k))
                        .slice(0, 4);

                      return (
                        <tr key={idVal}>
                          <td>
                            <code className="text-info fw-bold text-truncate d-block" style={{ maxWidth: 130 }} title={idVal}>
                              {idVal}
                            </code>
                          </td>
                          {activeColMeta?.dateField && (
                            <td className="text-secondary small">
                              {dateVal ? new Date(dateVal).toLocaleString() : '-'}
                            </td>
                          )}
                          <td>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                              {previewFields.map((f) => {
                                const v = row[f];
                                if (v === null || v === undefined) return null;
                                const rendered = typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v);
                                return (
                                  <span key={f} className="badge bg-secondary text-light fw-normal" style={{ fontSize: '0.72rem' }}>
                                    <strong>{f}:</strong> {rendered}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              <button
                                type="button"
                                className="btn btn-outline-info btn-sm py-0.5 px-1.5"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => {
                                  setViewingRecord(row);
                                  setIsViewModalOpen(true);
                                }}
                                title="View Raw JSON"
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-warning btn-sm py-0.5 px-1.5"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => handleOpenEditModal(row)}
                                title="Edit Record"
                              >
                                <Edit3 size={12} /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm py-0.5 px-1.5"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => handleOpenDeleteModal(row)}
                                title="Delete Record"
                              >
                                <Trash2 size={12} /> Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="card-footer bg-dark border-secondary d-flex justify-content-between align-items-center py-2 px-3">
              <span className="small text-secondary">
                Page {page} of {totalPages} ({totalRecords} total items)
              </span>
              <div className="d-flex align-items-center gap-1.5">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm py-0.5 px-2"
                  disabled={page <= 1}
                  onClick={() => queryRecords(page - 1)}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="badge bg-primary px-2">{page}</span>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm py-0.5 px-2"
                  disabled={page >= totalPages}
                  onClick={() => queryRecords(page + 1)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DATE-WISE PURGE & BATCH EXPORT                     */}
      {/* ========================================================= */}
      {activeTab === 'PURGE' && (
        <div className="d-flex flex-column gap-3">
          {/* Date Selector & Scan Box */}
          <div className="card bg-black border border-secondary p-3 shadow-sm">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-3">
                <label className="form-label small text-secondary fw-bold mb-1">Target Date (ચોક્કસ તારીખ)</label>
                <input
                  type="date"
                  className="form-control form-control-sm bg-dark text-white border-secondary fw-bold"
                  value={purgeDate}
                  onChange={(e) => setPurgeDate(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-3">
                <div className="form-check mb-1">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="enableDateRangeCheck"
                    checked={isDateRange}
                    onChange={(e) => setIsDateRange(e.target.checked)}
                  />
                  <label className="form-check-label small text-secondary fw-bold" htmlFor="enableDateRangeCheck">
                    Date Range (તારીખ ગાળો)
                  </label>
                </div>
                {isDateRange ? (
                  <input
                    type="date"
                    className="form-control form-control-sm bg-dark text-white border-secondary fw-bold"
                    value={purgeEndDate}
                    placeholder="End Date"
                    onChange={(e) => setPurgeEndDate(e.target.value)}
                  />
                ) : (
                  <div className="text-secondary small pt-1">
                    <em>Single Day purge (ex: 01/09/2026)</em>
                  </div>
                )}
              </div>

              <div className="col-12 col-md-3">
                <button
                  type="button"
                  className="btn btn-primary btn-sm w-100 py-1.5 fw-bold d-flex align-items-center justify-content-center gap-1.5 shadow-sm"
                  disabled={isScanningDate}
                  onClick={handleScanDate}
                >
                  <Search size={15} />
                  {isScanningDate ? 'Scanning Records...' : 'Scan & Analyze Date Data'}
                </button>
              </div>

              {datePreview && (
                <div className="col-12 col-md-3 d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-outline-info btn-sm w-100 py-1.5 fw-bold d-flex align-items-center justify-content-center gap-1.5"
                    onClick={handleDownloadDateBackup}
                  >
                    <Download size={15} /> Export Pre-Purge Backup
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Date Preview Results */}
          {datePreview && (
            <div className="card bg-black border border-secondary p-3 shadow-sm">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 border-bottom border-secondary pb-2.5 mb-3">
                <div>
                  <h6 className="fw-bold text-white mb-0 d-flex align-items-center gap-2">
                    <Calendar size={18} className="text-warning" />
                    Data Analysis for{' '}
                    <span className="text-info">{datePreview.dateRange.startDate}</span>
                    {datePreview.dateRange.endDate !== datePreview.dateRange.startDate && (
                      <> to <span className="text-info">{datePreview.dateRange.endDate}</span></>
                    )}
                  </h6>
                  <small className="text-secondary">
                    Total Found: <strong>{datePreview.totalRecords} transactional records</strong>
                  </small>
                </div>

                {/* Permanent Purge Trigger Button */}
                {datePreview.totalRecords > 0 ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm px-3 py-1.5 fw-bold shadow-sm d-flex align-items-center gap-1.5"
                    onClick={() => {
                      setPurgeConfirmationInput('');
                      setIsPurgeModalOpen(true);
                    }}
                  >
                    <ShieldAlert size={16} /> Permanently Delete Date Data
                  </button>
                ) : (
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                    <CheckCircle2 size={13} className="me-1" /> Clean: 0 records found
                  </span>
                )}
              </div>

              {/* Breakdown Cards Grid */}
              <div className="row g-2.5">
                {Object.entries(datePreview.breakdown).map(([key, item]) => (
                  <div key={key} className="col-6 col-md-3 col-lg-2">
                    <div className={`p-2.5 rounded border h-100 ${item.count > 0 ? 'bg-dark border-danger-subtle' : 'bg-black border-secondary'}`}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small text-secondary fw-semibold text-truncate" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="fs-5 fw-bold text-white">
                        {item.count.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purge Result Notification Banner */}
          {purgeResult && (
            <div className="alert alert-success d-flex align-items-center justify-content-between shadow-sm">
              <div className="d-flex align-items-center gap-2">
                <CheckCircle2 size={20} className="text-success flex-shrink-0" />
                <div>
                  <strong className="d-block">{purgeResult.message}</strong>
                  <small className="text-muted">Total records wiped: {purgeResult.totalDeleted}</small>
                </div>
              </div>
              <span className="badge bg-success text-white">SUCCESS</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: BACKUP & RESEED                                    */}
      {/* ========================================================= */}
      {activeTab === 'SNAPSHOT' && (
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="card bg-black border border-secondary p-4 h-100">
              <h5 className="fw-bold text-white mb-2 d-flex align-items-center gap-2">
                <FileJson size={20} className="text-info" /> Full Database JSON Dump
              </h5>
              <p className="small text-secondary mb-4">
                Generate an immediate full JSON snapshot of all collections (Bills, Orders, Payments, Inventory, Accounts, and Masters) with timestamps.
              </p>
              <button
                className="btn btn-outline-info btn-sm mt-auto fw-bold"
                disabled={isSnapshotting}
                onClick={handleExportFullSnapshot}
              >
                {isSnapshotting ? 'Generating Snapshot...' : 'Generate & Download Snapshot'}
              </button>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card bg-black border border-secondary p-4 h-100">
              <h5 className="fw-bold text-white mb-2 d-flex align-items-center gap-2">
                <RefreshCw size={20} className={`text-warning ${isSeeding ? 'spin' : ''}`} /> Verify Roles & Permissions
              </h5>
              <p className="small text-secondary mb-4">
                Re-verify and ensure all permission definitions and default role templates are up-to-date in MongoDB.
              </p>
              <button
                className="btn btn-warning btn-sm fw-bold text-dark mt-auto"
                disabled={isSeeding}
                onClick={handleReseed}
              >
                {isSeeding ? 'Verifying Seed...' : 'Verify Seed Integrity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: VIEW RAW JSON MODAL                              */}
      {/* ========================================================= */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Raw Record JSON [${selectedColKey}]`}
        size="lg"
      >
        {viewingRecord && (
          <div className="d-flex flex-column gap-2">
            <div className="d-flex justify-content-between align-items-center bg-dark p-2 rounded border border-secondary">
              <span className="small text-secondary">
                ID: <strong className="text-white">{viewingRecord.id || viewingRecord._id}</strong>
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm py-0.5 px-2 d-flex align-items-center gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(viewingRecord, null, 2));
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
              >
                {isCopied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                {isCopied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>

            <pre className="bg-dark text-light p-3 rounded border border-secondary mb-0" style={{ maxHeight: '60vh', overflow: 'auto', fontSize: '0.8rem' }}>
              {JSON.stringify(viewingRecord, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: ADD RECORD MODAL                                 */}
      {/* ========================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={`Add Record to [${activeColMeta?.name}]`}
        size="lg"
      >
        <div className="d-flex flex-column gap-2.5">
          <p className="small text-secondary mb-0">
            Define record payload as JSON. Schema validation and unique ID assignment are handled automatically.
          </p>
          <textarea
            className="form-control font-monospace bg-dark text-white border-secondary"
            rows={12}
            value={newRecordJson}
            onChange={(e) => setNewRecordJson(e.target.value)}
            style={{ fontSize: '0.82rem' }}
          />
          <div className="d-flex justify-content-end gap-2 pt-2 border-top border-secondary">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm fw-bold px-3 shadow-sm"
              disabled={isCreating}
              onClick={handleCreateRecord}
            >
              {isCreating ? 'Creating...' : 'Insert Record'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: EDIT RECORD MODAL                                */}
      {/* ========================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Record in [${activeColMeta?.name}]`}
        size="lg"
      >
        <div className="d-flex flex-column gap-2.5">
          <p className="small text-secondary mb-0">
            Edit fields for record ID: <code className="text-info">{editingRecord?.id || editingRecord?._id}</code>
          </p>
          <textarea
            className="form-control font-monospace bg-dark text-white border-secondary"
            rows={12}
            value={editRecordJson}
            onChange={(e) => setEditRecordJson(e.target.value)}
            style={{ fontSize: '0.82rem' }}
          />
          <div className="d-flex justify-content-end gap-2 pt-2 border-top border-secondary">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm fw-bold px-3 shadow-sm"
              disabled={isUpdating}
              onClick={handleUpdateRecord}
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: DELETE SINGLE RECORD CONFIRMATION                */}
      {/* ========================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Record Deletion"
        size="sm"
      >
        <div className="d-flex flex-column gap-3 text-center py-2">
          <Trash2 size={36} className="text-danger mx-auto" />
          <div>
            <h6 className="fw-bold text-white mb-1">Delete from {activeColMeta?.name}?</h6>
            <p className="small text-secondary mb-0">
              Are you sure you want to permanently delete record{' '}
              <code className="text-info">{deletingRecord?.id || deletingRecord?._id}</code>?
              This action cannot be undone.
            </p>
          </div>
          <div className="d-flex justify-content-center gap-2 pt-2 border-top border-secondary">
            <button
              type="button"
              className="btn btn-secondary btn-sm px-3"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm fw-bold px-3 shadow-sm"
              disabled={isDeleting}
              onClick={handleDeleteRecord}
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 5: IMPORT RECORDS MODAL                             */}
      {/* ========================================================= */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={`Import Records into [${activeColMeta?.name}]`}
        size="lg"
      >
        <div className="d-flex flex-column gap-2.5">
          <div className="d-flex justify-content-between align-items-center">
            <label className="form-label small text-secondary fw-bold mb-0">Import Mode</label>
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className={`btn btn-sm ${importMode === 'insert' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setImportMode('insert')}
              >
                Insert Only
              </button>
              <button
                type="button"
                className={`btn btn-sm ${importMode === 'upsert' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setImportMode('upsert')}
              >
                Upsert (Update if ID exists)
              </button>
            </div>
          </div>

          <div>
            <label className="form-label small text-secondary mb-1">Paste JSON Array of Objects</label>
            <textarea
              className="form-control font-monospace bg-dark text-white border-secondary"
              rows={10}
              placeholder={'[\n  { "name": "Example", ... }\n]'}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-2 border-top border-secondary">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-warning btn-sm fw-bold text-dark px-3 shadow-sm"
              disabled={isImporting || !importJsonText.trim()}
              onClick={handleImportData}
            >
              {isImporting ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 6: PERMANENT DATE PURGE CONFIRMATION MODAL          */}
      {/* ========================================================= */}
      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        title="🚨 PERMANENT DATE DATA PURGE"
        size="md"
      >
        {datePreview && (
          <div className="d-flex flex-column gap-3 py-1">
            <div className="p-3 bg-danger-subtle text-danger-emphasis border border-danger-subtle rounded">
              <h6 className="fw-bold mb-1 d-flex align-items-center gap-1.5">
                <AlertTriangle size={18} className="text-danger flex-shrink-0" />
                Permanent Irreversible Data Loss Warning
              </h6>
              <p className="small mb-0">
                You are about to permanently wipe <strong>{datePreview.totalRecords} records</strong> created on{' '}
                <strong>{datePreview.dateRange.startDate}</strong>
                {datePreview.dateRange.endDate !== datePreview.dateRange.startDate && (
                  <> to <strong>{datePreview.dateRange.endDate}</strong></>
                )}.
                This action is IRREVERSIBLE and cannot be undone!
              </p>
            </div>

            {/* Checkbox collection selection */}
            <div>
              <label className="form-label small text-secondary fw-bold mb-1.5">
                Select Collections to Wipe:
              </label>
              <div className="d-flex flex-column gap-1 bg-dark p-2.5 rounded border border-secondary" style={{ maxHeight: 160, overflowY: 'auto' }}>
                {Object.entries(datePreview.breakdown).map(([k, item]) => {
                  if (item.count === 0) return null;
                  const isChecked = selectedPurgeCollections.includes(k);
                  return (
                    <div key={k} className="form-check form-check-sm">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`purge-col-${k}`}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPurgeCollections([...selectedPurgeCollections, k]);
                          } else {
                            setSelectedPurgeCollections(selectedPurgeCollections.filter((c) => c !== k));
                          }
                        }}
                      />
                      <label className="form-check-label text-white small" htmlFor={`purge-col-${k}`}>
                        {item.name} (<strong>{item.count} records</strong>)
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmation input */}
            <div>
              <label className="form-label small text-secondary fw-bold mb-1">
                Type exact confirmation phrase to proceed:
              </label>
              <div className="p-2 bg-black border border-danger rounded mb-1 text-center font-monospace fw-bold text-danger">
                {expectedPurgePhrase}
              </div>
              <input
                type="text"
                className="form-control form-control-sm bg-dark text-white border-secondary text-center font-monospace fw-bold"
                placeholder={`Type "${expectedPurgePhrase}"`}
                value={purgeConfirmationInput}
                onChange={(e) => setPurgeConfirmationInput(e.target.value)}
              />
            </div>

            <div className="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
              <button
                type="button"
                className="btn btn-outline-info btn-sm"
                onClick={handleDownloadDateBackup}
              >
                <Download size={14} className="me-1" /> Backup First
              </button>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsPurgeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm fw-bold px-3 shadow-sm"
                  disabled={
                    isPurging ||
                    purgeConfirmationInput.trim().toUpperCase() !== expectedPurgePhrase.toUpperCase() ||
                    selectedPurgeCollections.length === 0
                  }
                  onClick={handleExecutePurge}
                >
                  {isPurging ? 'Purging...' : 'Confirm & Wipe Records'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
