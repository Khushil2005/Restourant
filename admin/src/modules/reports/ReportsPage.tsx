import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import {
  BarChart3,
  Download,
  Upload,
  Calendar,
  DollarSign,
  CreditCard,
  Boxes,
  BookCheck,
  SlidersHorizontal,
  FileSpreadsheet,
  Printer,
  Search,
  CheckCircle2,
  Receipt,
  Utensils,
  TrendingUp,
  FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type ReportType = 'sales' | 'items' | 'billing' | 'payments' | 'inventory' | 'expenses' | 'financials';

// Column definitions per report type
interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

const REPORT_COLUMNS: Record<ReportType, ColumnDef[]> = {
  sales: [
    { key: 'orderNumber', label: 'Order #', defaultVisible: true },
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'time', label: 'Time', defaultVisible: true },
    { key: 'orderType', label: 'Order Type', defaultVisible: true },
    { key: 'table', label: 'Table', defaultVisible: true },
    { key: 'customer', label: 'Customer', defaultVisible: true },
    { key: 'itemsCount', label: 'Items Qty', defaultVisible: true },
    { key: 'subtotal', label: 'Subtotal (₹)', defaultVisible: true },
    { key: 'tax', label: 'GST Tax (₹)', defaultVisible: true },
    { key: 'netTotal', label: 'Net Total (₹)', defaultVisible: true }
  ],
  items: [
    { key: 'itemName', label: 'Dish / Item Name', defaultVisible: true },
    { key: 'quantity', label: 'Quantity Sold', defaultVisible: true },
    { key: 'unitPrice', label: 'Unit Price (₹)', defaultVisible: true },
    { key: 'totalRevenue', label: 'Total Revenue (₹)', defaultVisible: true },
    { key: 'orderCount', label: 'Orders Included', defaultVisible: true },
    { key: 'sharePercent', label: '% of Sales', defaultVisible: true }
  ],
  billing: [
    { key: 'billNumber', label: 'Invoice #', defaultVisible: true },
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'time', label: 'Time', defaultVisible: true },
    { key: 'table', label: 'Table', defaultVisible: true },
    { key: 'customer', label: 'Customer', defaultVisible: true },
    { key: 'subtotal', label: 'Subtotal (₹)', defaultVisible: true },
    { key: 'cgst', label: 'CGST 2.5% (₹)', defaultVisible: true },
    { key: 'sgst', label: 'SGST 2.5% (₹)', defaultVisible: true },
    { key: 'serviceCharge', label: 'Service Chg (₹)', defaultVisible: false },
    { key: 'roundOff', label: 'Round Off (₹)', defaultVisible: false },
    { key: 'totalPayable', label: 'Total Payable (₹)', defaultVisible: true },
    { key: 'status', label: 'Status', defaultVisible: true }
  ],
  payments: [
    { key: 'paymentNumber', label: 'Payment #', defaultVisible: true },
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'time', label: 'Time', defaultVisible: true },
    { key: 'method', label: 'Method', defaultVisible: true },
    { key: 'amount', label: 'Settled Amount (₹)', defaultVisible: true },
    { key: 'reference', label: 'Reference / UTR', defaultVisible: true },
    { key: 'status', label: 'Status', defaultVisible: true }
  ],
  inventory: [
    { key: 'code', label: 'Item Code', defaultVisible: true },
    { key: 'name', label: 'Ingredient Name', defaultVisible: true },
    { key: 'category', label: 'Category', defaultVisible: true },
    { key: 'currentStock', label: 'Current Stock', defaultVisible: true },
    { key: 'unit', label: 'Unit', defaultVisible: true },
    { key: 'minStock', label: 'Safety Min Stock', defaultVisible: true },
    { key: 'unitCost', label: 'Unit Cost (₹)', defaultVisible: true },
    { key: 'valuation', label: 'Asset Valuation (₹)', defaultVisible: true },
    { key: 'status', label: 'Stock Status', defaultVisible: true }
  ],
  expenses: [
    { key: 'expenseNumber', label: 'Expense #', defaultVisible: true },
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'title', label: 'Title / Purpose', defaultVisible: true },
    { key: 'category', label: 'Category', defaultVisible: true },
    { key: 'amount', label: 'Amount (₹)', defaultVisible: true },
    { key: 'paymentMethod', label: 'Payment Mode', defaultVisible: true },
    { key: 'status', label: 'Status', defaultVisible: true },
    { key: 'notes', label: 'Notes', defaultVisible: false }
  ],
  financials: [
    { key: 'metric', label: 'Financial Account / Metric', defaultVisible: true },
    { key: 'amount', label: 'Amount (₹)', defaultVisible: true },
    { key: 'share', label: 'Percentage', defaultVisible: true }
  ]
};

export const ReportsPage: React.FC = () => {
  const { can } = usePermission();

  // Active Report Type
  const [reportType, setReportType] = useState<ReportType>('sales');

  // Date Filters
  const [datePreset, setDatePreset] = useState<string>('last30');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Search Filter
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Column Customization State
  const [visibleColumns, setVisibleColumns] = useState<Record<ReportType, string[]>>(() => {
    const initial: any = {};
    (Object.keys(REPORT_COLUMNS) as ReportType[]).forEach((type) => {
      initial[type] = REPORT_COLUMNS[type].filter((c) => c.defaultVisible).map((c) => c.key);
    });
    return initial;
  });
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'inventory' | 'expenses'>('inventory');
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Data & Loading
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Apply Quick Date Presets
  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      setStartDate(y);
      setEndDate(y);
    } else if (preset === 'week') {
      const w = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      setStartDate(w);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'last30') {
      const l30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      setStartDate(l30);
      setEndDate(todayStr);
    }
  };

  // Load Report from Backend
  const loadReport = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      if (reportType === 'sales' || reportType === 'items') {
        endpoint = `/reports/sales?startDate=${startDate}&endDate=${endDate}`;
      } else if (reportType === 'billing') {
        endpoint = `/reports/bills?startDate=${startDate}&endDate=${endDate}`;
      } else if (reportType === 'payments') {
        endpoint = `/reports/payments?startDate=${startDate}&endDate=${endDate}`;
      } else if (reportType === 'inventory') {
        endpoint = `/reports/inventory`;
      } else if (reportType === 'expenses') {
        endpoint = `/reports/expenses?startDate=${startDate}&endDate=${endDate}`;
      } else if (reportType === 'financials') {
        endpoint = `/reports/financials`;
      }

      const res: any = await apiClient.get(endpoint);
      if (res?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, startDate, endDate]);

  // Compute table rows based on reportType and search term
  const currentRows = useMemo(() => {
    if (!reportData) return [];
    let rows: any[] = [];

    if (reportType === 'sales') {
      rows = reportData.orders || [];
    } else if (reportType === 'items') {
      const totalRev = reportData.summary?.totalNetSales || 1;
      rows = (reportData.itemBreakdown || []).map((it: any) => ({
        ...it,
        sharePercent: `${((it.totalRevenue / totalRev) * 100).toFixed(1)}%`
      }));
    } else if (reportType === 'billing') {
      rows = reportData.bills || [];
    } else if (reportType === 'payments') {
      rows = reportData.payments || [];
    } else if (reportType === 'inventory') {
      rows = (reportData.items || []).map((i: any) => ({
        ...i,
        status: i.isLow ? 'LOW STOCK' : 'ADEQUATE'
      }));
    } else if (reportType === 'expenses') {
      rows = reportData.expenses || [];
    } else if (reportType === 'financials') {
      const rev = reportData.revenue || 0;
      rows = [
        { metric: 'Kathiyawadi Food & Beverage Sales Revenue', amount: rev, share: '100%' },
        { metric: 'Cost of Goods Sold (Raw Provision Consumption)', amount: reportData.cogs || 0, share: rev > 0 ? `${(((reportData.cogs || 0) / rev) * 100).toFixed(1)}%` : '0%' },
        { metric: 'Gross Dining Profit', amount: reportData.grossProfit || 0, share: rev > 0 ? `${(((reportData.grossProfit || 0) / rev) * 100).toFixed(1)}%` : '0%' },
        { metric: 'Operating & Staff Expenses', amount: reportData.operatingExpenses || 0, share: rev > 0 ? `${(((reportData.operatingExpenses || 0) / rev) * 100).toFixed(1)}%` : '0%' },
        { metric: 'Net Operating Income', amount: reportData.netIncome || 0, share: rev > 0 ? `${(((reportData.netIncome || 0) / rev) * 100).toFixed(1)}%` : '0%' }
      ];
    }

    if (!searchTerm.trim()) return rows;

    const query = searchTerm.toLowerCase();
    return rows.filter((r) => {
      return Object.values(r).some((val) =>
        String(val || '').toLowerCase().includes(query)
      );
    });
  }, [reportType, reportData, searchTerm]);

  // Filter columns based on user's column customization
  const activeColumns = useMemo(() => {
    const allowedKeys = visibleColumns[reportType] || [];
    return REPORT_COLUMNS[reportType].filter((col) => allowedKeys.includes(col.key));
  }, [reportType, visibleColumns]);

  // Toggle single column visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const current = prev[reportType] || [];
      const updated = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, [reportType]: updated };
    });
  };

  // Reset columns for current report
  const resetColumns = () => {
    setVisibleColumns((prev) => ({
      ...prev,
      [reportType]: REPORT_COLUMNS[reportType].map((c) => c.key)
    }));
  };

  // 1. EXPORT TO CSV / EXCEL (.xlsx)
  const handleExportExcel = () => {
    if (currentRows.length === 0) {
      alert('No data to export.');
      return;
    }

    // Build array of objects with only visible columns
    const exportData = currentRows.map((row) => {
      const obj: any = {};
      activeColumns.forEach((col) => {
        obj[col.label] = row[col.key] !== undefined ? row[col.key] : '-';
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const fileName = `Bhatigal_Bhanu_${reportType}_report_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 2. EXPORT TO PROFESSIONAL PDF
  const handleExportPDF = () => {
    if (currentRows.length === 0) {
      alert('No data to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(212, 139, 40);
    doc.text('BHATIGAL BHANU RESTAURANT', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Traditional Kathiyawadi & Gujarati Dining • Enterprise Central Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    const title = `${reportType.toUpperCase()} AUDIT & INTELLIGENCE REPORT`;
    doc.text(title, 14, 28);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${startDate} to ${endDate} | Generated: ${new Date().toLocaleString()}`, 14, 33);

    // Table Data
    const tableHeaders = activeColumns.map((c) => c.label);
    const tableData = currentRows.map((r) =>
      activeColumns.map((c) => {
        const val = r[c.key];
        return val !== undefined && val !== null ? String(val) : '-';
      })
    );

    autoTable(doc, {
      startY: 37,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [212, 139, 40],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [40, 40, 40]
      },
      alternateRowStyles: {
        fillColor: [253, 251, 247]
      }
    });

    const fileName = `Bhatigal_Bhanu_${reportType}_report_${startDate}.pdf`;
    doc.save(fileName);
  };

  // 3. PRINT REPORT
  const handlePrint = () => {
    window.print();
  };

  // 4. CSV IMPORT TEMPLATE GENERATION & DOWNLOAD
  const handleDownloadSampleTemplate = () => {
    let sampleData: any[] = [];
    if (importType === 'inventory') {
      sampleData = [
        { itemCode: 'RAW-BAJRA', name: 'Desi Bajro Flour', category: 'GRAINS', currentStock: 120, unit: 'kg', minStock: 25, unitCost: 38 },
        { itemCode: 'RAW-SEV', name: 'Ratlami Tikha Sev', category: 'PROVISIONS', currentStock: 45, unit: 'kg', minStock: 10, unitCost: 140 },
        { itemCode: 'RAW-GARLIC', name: 'Lasun Paste Pure', category: 'VEGETABLES', currentStock: 30, unit: 'kg', minStock: 8, unitCost: 180 }
      ];
    } else {
      sampleData = [
        { expenseNumber: 'EXP-101', title: 'Fresh Dairy Curd & Milk', category: 'SUPPLIES', amount: 3500, paymentMethod: 'CASH', date: new Date().toISOString().split('T')[0] },
        { expenseNumber: 'EXP-102', title: 'Commercial LPG Cylinder', category: 'UTILITIES', amount: 2850, paymentMethod: 'UPI', date: new Date().toISOString().split('T')[0] }
      ];
    }

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${importType}_import_sample_template.csv`);
  };

  // Handle CSV/Excel File Pick for Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws);
        setImportPreview(data);
      } catch (err: any) {
        alert('Failed to parse spreadsheet file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (importPreview.length === 0) {
      alert('Please upload a spreadsheet with data rows first.');
      return;
    }

    try {
      setIsImporting(true);
      const res: any = await apiClient.post('/reports/import', {
        type: importType,
        rows: importPreview
      });
      if (res?.success) {
        alert(`Successfully imported ${res.data.importedCount} records into ${importType}!`);
        setIsImportModalOpen(false);
        setImportPreview([]);
        setImportFileName('');
        loadReport();
      }
    } catch (err: any) {
      alert(err.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      {/* Top Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <BarChart3 className="text-primary" size={24} />
            Central Intelligence & Audit Reports
          </h4>
          <p className="text-muted small mb-0">
            Export Sales, 1-to-1 Item Process, Invoices, Settlements, Stock, and P&L with Column Customization
          </p>
        </div>

        {/* Global Actions */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Column Customization Button */}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setIsColumnModalOpen(true)}
            title="Choose visible columns for viewing and export"
          >
            <SlidersHorizontal size={14} />
            Columns ({activeColumns.length})
          </button>

          {/* Import Button */}
          <button
            type="button"
            className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={() => {
              setImportPreview([]);
              setImportFileName('');
              setIsImportModalOpen(true);
            }}
            title="Import Excel or CSV Data"
          >
            <Upload size={14} />
            Import CSV / Excel
          </button>

          {/* Export Excel */}
          <button
            type="button"
            className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm fw-bold px-3"
            onClick={handleExportExcel}
            title="Export full filtered report to Excel .xlsx"
          >
            <FileSpreadsheet size={15} />
            Excel
          </button>

          {/* Export PDF */}
          <button
            type="button"
            className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm fw-bold px-3"
            onClick={handleExportPDF}
            title="Generate & Download Report PDF"
          >
            <Download size={15} />
            PDF
          </button>

          {/* Print */}
          <button
            type="button"
            className="btn btn-outline-dark btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={handlePrint}
            title="Print Report"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {/* Date Filters & Presets Bar */}
      {reportType !== 'inventory' && reportType !== 'financials' && (
        <div className="card border-0 shadow-sm p-3 bg-white">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            {/* Quick Presets */}
            <div className="d-flex align-items-center gap-1 flex-wrap">
              <span className="small text-muted fw-bold me-1">Range:</span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={`btn ${datePreset === 'today' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => applyDatePreset('today')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`btn ${datePreset === 'yesterday' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => applyDatePreset('yesterday')}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  className={`btn ${datePreset === 'week' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => applyDatePreset('week')}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  className={`btn ${datePreset === 'month' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => applyDatePreset('month')}
                >
                  This Month
                </button>
                <button
                  type="button"
                  className={`btn ${datePreset === 'last30' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => applyDatePreset('last30')}
                >
                  Last 30 Days
                </button>
              </div>
            </div>

            {/* Custom Date Inputs */}
            <div className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ width: 170 }}>
                <span className="input-group-text bg-light text-muted">From</span>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setStartDate(e.target.value);
                  }}
                />
              </div>

              <span className="small text-muted">to</span>

              <div className="input-group input-group-sm" style={{ width: 170 }}>
                <span className="input-group-text bg-light text-muted">To</span>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setEndDate(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Report Navigation Tabs */}
      <div className="card border-0 shadow-sm p-2 bg-white">
        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <ul className="nav nav-pills gap-1 flex-wrap">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm d-flex align-items-center gap-1 ${
                  reportType === 'sales' ? 'active shadow-sm fw-bold' : 'text-secondary'
                }`}
                onClick={() => setReportType('sales')}
              >
                <BarChart3 size={15} />
                Sales & Orders
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm d-flex align-items-center gap-1 ${
                  reportType === 'items' ? 'active shadow-sm fw-bold' : 'text-secondary'
                }`}
                onClick={() => setReportType('items')}
              >
                <Utensils size={15} />
                1-to-1 Item Process
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm d-flex align-items-center gap-1 ${
                  reportType === 'billing' ? 'active shadow-sm fw-bold' : 'text-secondary'
                }`}
                onClick={() => setReportType('billing')}
              >
                <Receipt size={15} />
                Tax Invoices & GST
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm d-flex align-items-center gap-1 ${
                  reportType === 'payments' ? 'active shadow-sm fw-bold' : 'text-secondary'
                }`}
                onClick={() => setReportType('payments')}
              >
                <CreditCard size={15} />
                Payment Settlements
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm d-flex align-items-center gap-1 ${
                  reportType === 'inventory' ? 'active shadow-sm fw-bold' : 'text-secondary'
                }`}
                onClick={() => setReportType('inventory')}
              >
                <Boxes size={15} />
                Stock Valuation
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm d-flex align-items-center gap-1 ${
                  reportType === 'expenses' ? 'active shadow-sm fw-bold' : 'text-secondary'
                }`}
                onClick={() => setReportType('expenses')}
              >
                <DollarSign size={15} />
                Operating Expenses
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm d-flex align-items-center gap-1 ${
                  reportType === 'financials' ? 'active shadow-sm fw-bold' : 'text-secondary'
                }`}
                onClick={() => setReportType('financials')}
              >
                <BookCheck size={15} />
                P&L Statement
              </button>
            </li>
          </ul>

          {/* Quick Search */}
          <div className="input-group input-group-sm" style={{ maxWidth: 260 }}>
            <span className="input-group-text bg-light border-end-0">
              <Search size={14} className="text-muted" />
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search current report..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      {reportData && (
        <div className="row g-2">
          {reportType === 'sales' && (
            <>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Orders</span>
                  <h4 className="fw-bold text-dark mt-1 mb-0">{reportData.summary?.totalOrders || 0}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Gross Sales</span>
                  <h4 className="fw-bold text-dark mt-1 mb-0">₹{(reportData.summary?.totalGrossSales || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">GST 5% Tax</span>
                  <h4 className="fw-bold text-muted mt-1 mb-0">₹{(reportData.summary?.totalTax || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Net Sales Revenue</span>
                  <h4 className="fw-bold text-success mt-1 mb-0">₹{(reportData.summary?.totalNetSales || 0).toLocaleString()}</h4>
                </div>
              </div>
            </>
          )}

          {reportType === 'items' && (
            <>
              <div className="col-md-4 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Distinct Dishes Sold</span>
                  <h4 className="fw-bold text-primary mt-1 mb-0">{currentRows.length} items</h4>
                </div>
              </div>
              <div className="col-md-4 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Dish Servings</span>
                  <h4 className="fw-bold text-dark mt-1 mb-0">
                    {currentRows.reduce((sum, r) => sum + (r.quantity || 0), 0)} plates
                  </h4>
                </div>
              </div>
              <div className="col-md-4 col-12">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Dish Revenue</span>
                  <h4 className="fw-bold text-success mt-1 mb-0">
                    ₹{currentRows.reduce((sum, r) => sum + (r.totalRevenue || 0), 0).toLocaleString()}
                  </h4>
                </div>
              </div>
            </>
          )}

          {reportType === 'billing' && (
            <>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Invoices</span>
                  <h4 className="fw-bold text-dark mt-1 mb-0">{reportData.summary?.totalInvoices || 0}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Tax Collected</span>
                  <h4 className="fw-bold text-muted mt-1 mb-0">₹{(reportData.summary?.totalTax || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Settled Invoices</span>
                  <h4 className="fw-bold text-success mt-1 mb-0">₹{(reportData.summary?.totalPaid || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Unpaid Balance Due</span>
                  <h4 className="fw-bold text-danger mt-1 mb-0">₹{(reportData.summary?.totalUnpaid || 0).toLocaleString()}</h4>
                </div>
              </div>
            </>
          )}

          {reportType === 'payments' && (
            <>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Collected</span>
                  <h4 className="fw-bold text-success mt-1 mb-0">₹{(reportData.totalCollected || 0).toLocaleString()}</h4>
                </div>
              </div>
              {Object.entries(reportData.methodTotals || {}).map(([m, amt]: [string, any]) => (
                <div key={m} className="col-md-3 col-6">
                  <div className="card border-0 shadow-sm p-3 bg-white">
                    <span className="small text-muted fw-bold text-uppercase">{m} Collections</span>
                    <h4 className="fw-bold text-primary mt-1 mb-0">₹{amt.toLocaleString()}</h4>
                  </div>
                </div>
              ))}
            </>
          )}

          {reportType === 'inventory' && (
            <>
              <div className="col-md-4 col-12">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Asset Valuation</span>
                  <h4 className="fw-bold text-primary mt-1 mb-0">₹{(reportData.totalStockValue || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-4 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Active Stock Items</span>
                  <h4 className="fw-bold text-dark mt-1 mb-0">{reportData.totalItems} items</h4>
                </div>
              </div>
              <div className="col-md-4 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Low Stock Alert Items</span>
                  <h4 className={`fw-bold mt-1 mb-0 ${reportData.lowStockCount > 0 ? 'text-danger' : 'text-success'}`}>
                    {reportData.lowStockCount} items
                  </h4>
                </div>
              </div>
            </>
          )}

          {reportType === 'expenses' && (
            <>
              <div className="col-md-4 col-12">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Operating Expenses</span>
                  <h4 className="fw-bold text-danger mt-1 mb-0">₹{(reportData.totalExpenses || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-4 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Expense Vouchers</span>
                  <h4 className="fw-bold text-dark mt-1 mb-0">{currentRows.length} vouchers</h4>
                </div>
              </div>
              <div className="col-md-4 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Expense Categories</span>
                  <h4 className="fw-bold text-primary mt-1 mb-0">{Object.keys(reportData.categoryTotals || {}).length} categories</h4>
                </div>
              </div>
            </>
          )}

          {reportType === 'financials' && (
            <>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Total Revenue</span>
                  <h4 className="fw-bold text-dark mt-1 mb-0">₹{(reportData.revenue || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Cost of Goods (COGS)</span>
                  <h4 className="fw-bold text-secondary mt-1 mb-0">₹{(reportData.cogs || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Operating Expenses</span>
                  <h4 className="fw-bold text-danger mt-1 mb-0">₹{(reportData.operatingExpenses || 0).toLocaleString()}</h4>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-muted fw-bold text-uppercase">Net Profit / Margin</span>
                  <h4 className="fw-bold text-success mt-1 mb-0">₹{(reportData.netIncome || 0).toLocaleString()}</h4>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* REPORT DATA TABLE */}
      <div className="card border-0 shadow-sm bg-white">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover table-striped mb-0 align-middle">
              <thead className="table-light border-bottom">
                <tr>
                  <th style={{ width: 45 }}>#</th>
                  {activeColumns.map((col) => (
                    <th key={col.key} className="small text-secondary fw-bold">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={activeColumns.length + 1} className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                      Loading report data...
                    </td>
                  </tr>
                ) : currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length + 1} className="text-center py-5 text-muted">
                      No records found for the selected dates and filters.
                    </td>
                  </tr>
                ) : (
                  currentRows.map((row, idx) => (
                    <tr key={row.id || row.key || idx}>
                      <td className="small text-muted">{idx + 1}</td>
                      {activeColumns.map((col) => {
                        const val = row[col.key];

                        // Special badge renderers
                        if (col.key === 'status') {
                          return (
                            <td key={col.key}>
                              <span
                                className={`badge ${
                                  val === 'PAID' || val === 'COMPLETED' || val === 'ADEQUATE' || val === 'APPROVED'
                                    ? 'bg-success'
                                    : val === 'LOW STOCK' || val === 'UNPAID' || val === 'REJECTED'
                                    ? 'bg-danger'
                                    : 'bg-warning text-dark'
                                }`}
                              >
                                {val}
                              </span>
                            </td>
                          );
                        }

                        if (col.key === 'totalRevenue' || col.key === 'netTotal' || col.key === 'totalPayable') {
                          return (
                            <td key={col.key} className="fw-bold text-dark">
                              ₹{Number(val || 0).toLocaleString()}
                            </td>
                          );
                        }

                        if (col.key === 'amount') {
                          return (
                            <td key={col.key} className="fw-bold text-success">
                              ₹{Number(val || 0).toLocaleString()}
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} className="small">
                            {val !== undefined && val !== null ? String(val) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-footer bg-light d-flex justify-content-between align-items-center py-2 px-3 small text-muted">
          <span>
            Displaying <strong>{currentRows.length}</strong> records across <strong>{activeColumns.length}</strong> active columns
          </span>
          <span className="fst-italic">Bhatigal Bhanu Central Audit Engine</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* COLUMN CUSTOMIZATION MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        title="Customize Report Columns (કોલમ પસંદ કરો)"
      >
        <div className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-0">
            Select the columns you want to view on screen and include in the <strong>Excel & PDF exports</strong>:
          </p>

          <div className="row g-2 p-2 bg-light rounded border">
            {REPORT_COLUMNS[reportType].map((col) => {
              const isChecked = (visibleColumns[reportType] || []).includes(col.key);
              return (
                <div key={col.key} className="col-6">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`col_${col.key}`}
                      checked={isChecked}
                      onChange={() => toggleColumn(col.key)}
                    />
                    <label className="form-check-label small fw-medium" htmlFor={`col_${col.key}`}>
                      {col.label}
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="d-flex justify-content-between align-items-center pt-3 border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetColumns}>
              Select All / Reset Defaults
            </button>
            <button type="button" className="btn btn-primary btn-sm px-3 fw-bold" onClick={() => setIsColumnModalOpen(false)}>
              Apply Columns
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* SPREADSHEET CSV/EXCEL IMPORT MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Spreadsheet Data (Excel / CSV ઇમ્પોર્ટ)"
        size="lg"
      >
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-bold">Select Import Target (ક્યાં ડેટા ઉમેરવો છે?)</label>
              <select
                className="form-select form-select-sm"
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value as any);
                  setImportPreview([]);
                  setImportFileName('');
                }}
              >
                <option value="inventory">Inventory Stock & Items (કાચો માલ અને સ્ટોક)</option>
                <option value="expenses">Operating Expenses (દૈનિક ખર્ચા)</option>
              </select>
            </div>

            <div className="col-md-6 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                onClick={handleDownloadSampleTemplate}
              >
                <Download size={14} /> Download Sample CSV Template
              </button>
            </div>
          </div>

          {/* File Upload Box */}
          <div className="p-4 border border-dashed rounded text-center bg-light">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <FileSpreadsheet size={36} className="text-success mb-2" />
            <h6 className="fw-bold mb-1">Upload CSV or Excel File</h6>
            <p className="small text-muted mb-3">
              {importFileName ? (
                <span className="fw-bold text-success">Selected: {importFileName}</span>
              ) : (
                'Choose your filled spreadsheet (.csv or .xlsx)'
              )}
            </p>
            <button
              type="button"
              className="btn btn-dark btn-sm px-3 shadow-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Computer File
            </button>
          </div>

          {/* Preview Parsed Data */}
          {importPreview.length > 0 && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small fw-bold text-dark">
                  Preview (First {Math.min(5, importPreview.length)} of {importPreview.length} rows detected):
                </span>
                <span className="badge bg-success">{importPreview.length} Ready to Import</span>
              </div>
              <div className="table-responsive border rounded" style={{ maxHeight: 180 }}>
                <table className="table table-sm table-bordered mb-0 small">
                  <thead className="table-light">
                    <tr>
                      {Object.keys(importPreview[0] || {}).map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((v: any, cIdx) => (
                          <td key={cIdx}>{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm fw-bold px-3 d-flex align-items-center gap-1 shadow-sm"
              onClick={handleExecuteImport}
              disabled={isImporting || importPreview.length === 0}
            >
              {isImporting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" /> Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirm & Import {importPreview.length} Records
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
