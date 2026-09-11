import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { ChartOfAccount, JournalEntry, DayClosing } from '../../types';
import {
  BookCheck,
  Plus,
  DollarSign,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export const AccountsPage: React.FC = () => {
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<'summary' | 'chart' | 'journal' | 'dayclosing'>('summary');

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Day Closing Modal
  const [isDayClosingModalOpen, setIsDayClosingModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');

  // Create Journal Entry Modal
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [narration, setNarration] = useState('');
  const [journalItems, setJournalItems] = useState<Array<{ accountId: string; debit: number; credit: number }>>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const canChart = can('accounts.chart.view');
      const canJournal = can('accounts.journal.view') || can('accounts.ledger.view');
      const canDayClosing = can('accounts.dayclosing.view');
      const canSummary = can('accounts.dashboard.view') || can('accounts.report.view');

      const [cRes, jRes, dRes, sRes]: any = await Promise.all([
        canChart ? apiClient.get('/accounts/chart').catch(() => null) : null,
        canJournal ? apiClient.get('/accounts/journal').catch(() => null) : null,
        canDayClosing ? apiClient.get('/accounts/day-closing').catch(() => null) : null,
        canSummary ? apiClient.get('/accounts/financial-summary').catch(() => null) : null
      ]);
      if (cRes?.success) setAccounts(cRes.data);
      if (jRes?.success) setJournals(jRes.data);
      if (dRes?.success) setDayClosings(dRes.data);
      if (sRes?.success) setFinancialSummary(sRes.data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tabs: Array<{ id: 'summary' | 'chart' | 'journal' | 'dayclosing'; perms: string[] }> = [
      { id: 'summary', perms: ['accounts.dashboard.view', 'accounts.report.view'] },
      { id: 'chart', perms: ['accounts.chart.view'] },
      { id: 'journal', perms: ['accounts.journal.view', 'accounts.ledger.view'] },
      { id: 'dayclosing', perms: ['accounts.dayclosing.view'] }
    ];
    const isCurrentAllowed = tabs.find(t => t.id === activeTab && t.perms.some(p => can(p)));
    if (!isCurrentAllowed) {
      const firstAllowed = tabs.find(t => t.perms.some(p => can(p)));
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [can]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleExecuteDayClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/accounts/day-closing', {
        actualCash: actualCashInput,
        notes: closingNotes,
        closingDate: new Date().toISOString().split('T')[0]
      });
      alert('Day Closing executed and finalized successfully!');
      setIsDayClosingModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Day closing failed.');
    }
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebit = journalItems.reduce((s, it) => s + (it.debit || 0), 0);
    const totalCredit = journalItems.reduce((s, it) => s + (it.credit || 0), 0);

    if (totalDebit !== totalCredit || totalDebit === 0) {
      alert(`Debits (₹${totalDebit}) must equal Credits (₹${totalCredit}) to maintain balanced books.`);
      return;
    }

    try {
      await apiClient.post('/accounts/journal', {
        narration,
        entryDate: new Date().toISOString().split('T')[0],
        items: journalItems.map(it => {
          const acc = accounts.find(a => a.id === it.accountId);
          return {
            accountId: it.accountId,
            accountName: acc?.accountName || 'Account',
            debit: Number(it.debit || 0),
            credit: Number(it.credit || 0)
          };
        })
      });
      alert('Balanced Journal Voucher posted to general ledger.');
      setIsJournalModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to post journal entry.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Double-Entry Financial Accounts & General Ledger</h4>
          <p className="text-muted small mb-0">Chart of accounts, journal entries, P&L statements, and register day closing</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {can('accounts.dayclosing.execute') && (
            <button className="btn btn-warning btn-sm fw-bold text-dark d-flex align-items-center gap-1 shadow-sm" onClick={() => setIsDayClosingModalOpen(true)}>
              <Calendar size={16} /> Execute Day Closing
            </button>
          )}
          {can('accounts.journal.create') && (
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
              onClick={() => {
                setNarration('');
                setJournalItems([
                  { accountId: accounts[0]?.id || '', debit: 1000, credit: 0 },
                  { accountId: accounts[1]?.id || '', debit: 0, credit: 1000 }
                ]);
                setIsJournalModalOpen(true);
              }}
            >
              <Plus size={16} /> Post Journal Voucher
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-pills bg-white p-2 rounded shadow-sm border gap-1">
        {(can('accounts.dashboard.view') || can('accounts.report.view')) && (
          <li className="nav-item">
            <button className={`nav-link btn-sm ${activeTab === 'summary' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('summary')}>
              Financial Statements (P&L)
            </button>
          </li>
        )}
        {can('accounts.chart.view') && (
          <li className="nav-item">
            <button className={`nav-link btn-sm ${activeTab === 'chart' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('chart')}>
              Chart of Accounts ({accounts.length})
            </button>
          </li>
        )}
        {(can('accounts.journal.view') || can('accounts.ledger.view')) && (
          <li className="nav-item">
            <button className={`nav-link btn-sm ${activeTab === 'journal' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('journal')}>
              Journal Entries Ledger ({journals.length})
            </button>
          </li>
        )}
        {can('accounts.dayclosing.view') && (
          <li className="nav-item">
            <button className={`nav-link btn-sm ${activeTab === 'dayclosing' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('dayclosing')}>
              Day Closing Records ({dayClosings.length})
            </button>
          </li>
        )}
      </ul>

      {/* TAB 1: FINANCIAL SUMMARY */}
      {activeTab === 'summary' && financialSummary && (
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Total Sales Revenue</span>
                <h3 className="fw-bold text-success mt-1">₹{financialSummary.revenue.toLocaleString()}</h3>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Cost of Goods Sold (COGS)</span>
                <h3 className="fw-bold text-danger mt-1">₹{financialSummary.cogs.toLocaleString()}</h3>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Operating Expenses (OPEX)</span>
                <h3 className="fw-bold text-warning-emphasis mt-1">₹{financialSummary.operatingExpenses.toLocaleString()}</h3>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white">
                <span className="small text-uppercase text-muted fw-bold">Net Operating Income</span>
                <h3 className={`fw-bold mt-1 ${financialSummary.netIncome >= 0 ? 'text-primary' : 'text-danger'}`}>
                  ₹{financialSummary.netIncome.toLocaleString()}
                </h3>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS */}
      {activeTab === 'chart' && (
        <DataTable<ChartOfAccount>
          columns={[
            { header: 'Account Code', accessor: 'accountCode', width: 120 },
            { header: 'Account Title', accessor: (row) => <span className="fw-bold text-dark">{row.accountName}</span> },
            {
              header: 'Account Type',
              accessor: (row) => (
                <span className={`badge bg-${
                  row.accountType === 'ASSET' ? 'primary' : row.accountType === 'LIABILITY' ? 'warning text-dark' : row.accountType === 'REVENUE' ? 'success' : row.accountType === 'EXPENSE' ? 'danger' : 'secondary'
                }`}>
                  {row.accountType}
                </span>
              )
            },
            {
              header: 'Current Balance',
              accessor: (row) => <span className="fw-bold fs-6">₹{row.currentBalance.toLocaleString()}</span>
            }
          ]}
          data={accounts}
          searchPlaceholder="Search account name, code..."
        />
      )}

      {/* TAB 3: JOURNAL LEDGER */}
      {activeTab === 'journal' && (
        <DataTable<JournalEntry>
          columns={[
            { header: 'Voucher #', accessor: 'entryNumber', width: 140 },
            { header: 'Date', accessor: 'entryDate' },
            { header: 'Narration / Description', accessor: 'narration' },
            { header: 'Reference', accessor: (row) => `${row.referenceType || 'MANUAL'} ${row.referenceId || ''}` },
            {
              header: 'Balanced Amount',
              accessor: (row) => <span className="fw-bold text-success fs-6">₹{row.totalDebit.toLocaleString()}</span>
            }
          ]}
          data={journals}
          searchPlaceholder="Search voucher #, narration..."
        />
      )}

      {/* TAB 4: DAY CLOSING RECORDS */}
      {activeTab === 'dayclosing' && (
        <DataTable<DayClosing>
          columns={[
            { header: 'Closing Date', accessor: 'closingDate', width: 120 },
            { header: 'Opening Cash', accessor: (row) => `₹${row.openingCash}` },
            { header: 'Total Sales', accessor: (row) => <span className="fw-bold text-success">₹{row.totalSales}</span> },
            { header: 'Cash Collected', accessor: (row) => `₹${row.cashSales}` },
            { header: 'UPI & Card', accessor: (row) => `₹${row.upiSales + row.cardSales}` },
            { header: 'Expenses', accessor: (row) => `₹${row.cashExpenses}` },
            { header: 'Actual Cash Counted', accessor: (row) => <span className="fw-bold">₹{row.actualCash}</span> },
            {
              header: 'Cash Variance',
              accessor: (row) => (
                <span className={`badge ${row.cashDifference === 0 ? 'bg-success' : row.cashDifference > 0 ? 'bg-info' : 'bg-danger'}`}>
                  {row.cashDifference === 0 ? 'Balanced' : `₹${row.cashDifference}`}
                </span>
              )
            }
          ]}
          data={dayClosings}
          searchPlaceholder="Search closing date..."
        />
      )}

      {/* DAY CLOSING MODAL */}
      <Modal
        isOpen={isDayClosingModalOpen}
        onClose={() => setIsDayClosingModalOpen(false)}
        title="Daily Register & Shift Closing Summary"
      >
        <form onSubmit={handleExecuteDayClosing} className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-1">
            Review all POS orders, payment tender methods, and cash drawer balance for today:
          </p>
          <div>
            <label className="form-label small fw-bold">Actual Physical Cash Counted in Drawer (₹)</label>
            <input
              type="number"
              className="form-control"
              required
              value={actualCashInput}
              onChange={e => setActualCashInput(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="form-label small fw-bold">Manager Closing Notes (Optional)</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              placeholder="e.g. Cash counted and deposited into safe drop box"
              value={closingNotes}
              onChange={e => setClosingNotes(e.target.value)}
            />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsDayClosingModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-warning btn-sm fw-bold">Execute & Finalize Day Closing</button>
          </div>
        </form>
      </Modal>

      {/* POST JOURNAL VOUCHER MODAL */}
      <Modal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        title="Post Manual Double-Entry Journal Voucher"
        size="lg"
      >
        <form onSubmit={handleCreateJournal} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Voucher Narration / Description</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g. Month-end depreciation on kitchen equipment"
              required
              value={narration}
              onChange={e => setNarration(e.target.value)}
            />
          </div>

          <div className="border rounded p-3 bg-light">
            <span className="small fw-bold text-dark d-block mb-2">Debit & Credit Entries</span>
            {journalItems.map((it, idx) => (
              <div key={idx} className="row g-2 align-items-center mb-2">
                <div className="col-6">
                  <select
                    className="form-select form-select-sm"
                    value={it.accountId}
                    onChange={e => {
                      const updated = [...journalItems];
                      updated[idx].accountId = e.target.value;
                      setJournalItems(updated);
                    }}
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountCode} - {acc.accountName} ({acc.accountType})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-3">
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Debit (₹)"
                    value={it.debit || ''}
                    onChange={e => {
                      const updated = [...journalItems];
                      updated[idx].debit = Number(e.target.value);
                      setJournalItems(updated);
                    }}
                  />
                </div>
                <div className="col-3">
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Credit (₹)"
                    value={it.credit || ''}
                    onChange={e => {
                      const updated = [...journalItems];
                      updated[idx].credit = Number(e.target.value);
                      setJournalItems(updated);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsJournalModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Post Journal Voucher</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
