import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable } from '../../components/PermissionGate';
import { BarChart3, Download, Calendar, DollarSign, CreditCard, Boxes, BookCheck } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { can } = usePermission();
  const [reportType, setReportType] = useState<'sales' | 'payments' | 'inventory' | 'financials'>('sales');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      let endpoint = `/reports/${reportType}?startDate=${startDate}&endDate=${endDate}`;
      if (reportType === 'inventory' || reportType === 'financials') {
        endpoint = `/reports/${reportType}`;
      }
      const res: any = await apiClient.get(endpoint);
      if (res.success) {
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

  const handleExportCSV = () => {
    if (!reportData) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    if (reportType === 'sales' && reportData.orders) {
      csvContent += 'Order Number,Date,Order Type,Table,Customer,Subtotal,Tax,Discount,Net Total\n';
      reportData.orders.forEach((o: any) => {
        csvContent += `${o.orderNumber},${o.date},${o.orderType},${o.table},"${o.customer}",${o.subtotal},${o.tax},${o.discount},${o.netTotal}\n`;
      });
    } else if (reportType === 'payments' && reportData.payments) {
      csvContent += 'Payment Number,Date,Method,Amount,Reference,Reconciled\n';
      reportData.payments.forEach((p: any) => {
        csvContent += `${p.paymentNumber},${p.date},${p.method},${p.amount},"${p.reference}",${p.isReconciled}\n`;
      });
    } else if (reportType === 'inventory' && reportData.items) {
      csvContent += 'Item Code,Name,Category,Current Stock,Unit,Unit Cost,Valuation\n';
      reportData.items.forEach((i: any) => {
        csvContent += `${i.code},"${i.name}",${i.category},${i.currentStock},${i.unit},${i.unitCost},${i.valuation}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Enterprise Intelligence & Audit Reports</h4>
          <p className="text-muted small mb-0">Export sales analytics, payment reconciliation, inventory audit, and P&L financial statements</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {reportType === 'sales' || reportType === 'payments' ? (
            <div className="d-flex align-items-center gap-1">
              <input type="date" className="form-control form-control-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="small text-muted">to</span>
              <input type="date" className="form-control form-control-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          ) : null}
          <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV / Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills bg-white p-2 rounded shadow-sm border gap-1">
        <li className="nav-item">
          <button className={`nav-link btn-sm ${reportType === 'sales' ? 'active fw-bold' : ''}`} onClick={() => setReportType('sales')}>
            Sales & Orders Report
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link btn-sm ${reportType === 'payments' ? 'active fw-bold' : ''}`} onClick={() => setReportType('payments')}>
            Payment Settlements Report
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link btn-sm ${reportType === 'inventory' ? 'active fw-bold' : ''}`} onClick={() => setReportType('inventory')}>
            Inventory Consumption Report
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link btn-sm ${reportType === 'financials' ? 'active fw-bold' : ''}`} onClick={() => setReportType('financials')}>
            Financial P&L Statements
          </button>
        </li>
      </ul>

      {/* SALES REPORT */}
      {reportType === 'sales' && reportData && (
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Total Orders Placed</span>
                <h3 className="fw-bold text-dark mt-1">{reportData.summary.totalOrders}</h3>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Gross Sales</span>
                <h3 className="fw-bold text-dark mt-1">₹{reportData.summary.totalGrossSales.toLocaleString()}</h3>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">GST Tax Collected</span>
                <h3 className="fw-bold text-muted mt-1">₹{reportData.summary.totalTax.toLocaleString()}</h3>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Net Sales Revenue</span>
                <h3 className="fw-bold text-success mt-1">₹{reportData.summary.totalNetSales.toLocaleString()}</h3>
              </div>
            </div>
          </div>

          <DataTable<any>
            columns={[
              { header: 'Order #', accessor: 'orderNumber', width: 120 },
              { header: 'Date', accessor: 'date' },
              { header: 'Type', accessor: 'orderType' },
              { header: 'Table', accessor: 'table' },
              { header: 'Customer', accessor: 'customer' },
              { header: 'Subtotal', accessor: (row) => `₹${row.subtotal}` },
              { header: 'Tax', accessor: (row) => `₹${row.tax}` },
              { header: 'Discount', accessor: (row) => `₹${row.discount}` },
              { header: 'Net Amount', accessor: (row) => <span className="fw-bold text-dark">₹{row.netTotal}</span> }
            ]}
            data={reportData.orders || []}
            searchPlaceholder="Search order records..."
          />
        </div>
      )}

      {/* PAYMENT REPORT */}
      {reportType === 'payments' && reportData && (
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Total Collected</span>
                <h3 className="fw-bold text-success mt-1">₹{(reportData.totalCollected || 0).toLocaleString()}</h3>
              </div>
            </div>
            {Object.entries(reportData.methodTotals || {}).map(([m, amt]: [string, any]) => (
              <div key={m} className="col-12 col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <span className="small text-uppercase text-muted fw-bold">{m} Settlements</span>
                  <h3 className="fw-bold text-primary mt-1">₹{amt.toLocaleString()}</h3>
                </div>
              </div>
            ))}
          </div>

          <DataTable<any>
            columns={[
              { header: 'Payment #', accessor: 'paymentNumber', width: 140 },
              { header: 'Date', accessor: 'date' },
              { header: 'Method', accessor: 'method' },
              { header: 'Amount (₹)', accessor: (row) => <span className="fw-bold text-success">₹{row.amount.toLocaleString()}</span> },
              { header: 'Reference', accessor: 'reference' },
              {
                header: 'Reconciliation',
                accessor: (row) => (
                  <span className={`badge ${row.isReconciled ? 'bg-success' : 'bg-secondary'}`}>
                    {row.isReconciled ? 'Reconciled' : 'Pending'}
                  </span>
                )
              }
            ]}
            data={reportData.payments || []}
            searchPlaceholder="Search payment transactions..."
          />
        </div>
      )}

      {/* INVENTORY REPORT */}
      {reportType === 'inventory' && reportData && (
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Total Stock Valuation</span>
                <h3 className="fw-bold text-primary mt-1">₹{(reportData.totalStockValue || 0).toLocaleString()}</h3>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Active Inventory Items</span>
                <h3 className="fw-bold text-dark mt-1">{reportData.totalItems}</h3>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Low Stock Warning Items</span>
                <h3 className={`fw-bold mt-1 ${reportData.lowStockCount > 0 ? 'text-danger' : 'text-success'}`}>
                  {reportData.lowStockCount}
                </h3>
              </div>
            </div>
          </div>

          <DataTable<any>
            columns={[
              { header: 'Item Code', accessor: 'code', width: 120 },
              { header: 'Ingredient Name', accessor: 'name' },
              { header: 'Category', accessor: 'category' },
              {
                header: 'Current Stock',
                accessor: (row) => (
                  <span className={`fw-bold ${row.isLow ? 'text-danger' : 'text-success'}`}>
                    {row.currentStock} {row.unit}
                  </span>
                )
              },
              { header: 'Min Safety Level', accessor: (row) => `${row.minStock} ${row.unit}` },
              { header: 'Unit Cost', accessor: (row) => `₹${row.unitCost}` },
              { header: 'Asset Valuation', accessor: (row) => <span className="fw-bold">₹{row.valuation.toLocaleString()}</span> }
            ]}
            data={reportData.items || []}
            searchPlaceholder="Search inventory audit records..."
          />
        </div>
      )}
    </div>
  );
};
