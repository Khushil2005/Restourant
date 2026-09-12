import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import {
  ChartOfAccount,
  JournalEntry,
  DayClosing,
  AccountLedgerStatement,
  TrialBalanceReport
} from '../../types';
import {
  BookOpen,
  ListTree,
  FileText,
  Scale,
  TrendingUp,
  CalendarCheck,
  Plus,
  Calendar,
  Download,
  Printer,
  Search,
  RefreshCw,
  Eye,
  Edit,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  Filter,
  ArrowUpDown,
  Smartphone,
  Wallet,
  Building2,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  HelpCircle,
  Info,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Date utility helpers
const getTodayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStartStr = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  const year = mon.getFullYear();
  const month = String(mon.getMonth() + 1).padStart(2, '0');
  const date = String(mon.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

const getMonthStartStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getFYStartStr = (): string => {
  const d = new Date();
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-04-01`;
};

type AccountTab = 'ledger' | 'chart' | 'journal' | 'trialbalance' | 'summary' | 'dayclosing';
type CoaTypeFilter = 'ALL' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

interface JournalFormItem {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export const AccountsPage: React.FC = () => {
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<AccountTab>('ledger');

  // User Mode & Explainer Toggle (Simple vs Pro CA mode)
  const [viewMode, setViewMode] = useState<'simple' | 'pro'>('simple');
  const [showExplainer, setShowExplainer] = useState(false);

  // Core Data States
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);

  // Loading states
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isLoadingTrialBalance, setIsLoadingTrialBalance] = useState(false);
  const [isLoadingJournals, setIsLoadingJournals] = useState(false);

  // --- TAB 1: INDIVIDUAL ACCOUNT LEDGER STATES ---
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [ledgerStartDate, setLedgerStartDate] = useState<string>(getMonthStartStr());
  const [ledgerEndDate, setLedgerEndDate] = useState<string>(getTodayStr());
  const [ledgerStatement, setLedgerStatement] = useState<AccountLedgerStatement | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // --- TAB 2: CHART OF ACCOUNTS STATES ---
  const [coaTypeFilter, setCoaTypeFilter] = useState<CoaTypeFilter>('ALL');
  const [coaSearch, setCoaSearch] = useState<string>('');

  // --- TAB 3: JOURNAL ENTRIES STATES ---
  const [journalSearch, setJournalSearch] = useState<string>('');
  const [journalStartDate, setJournalStartDate] = useState<string>('');
  const [journalEndDate, setJournalEndDate] = useState<string>('');
  const [selectedVoucherForSlip, setSelectedVoucherForSlip] = useState<JournalEntry | null>(null);

  // --- TAB 4: TRIAL BALANCE STATES ---
  const [trialAsOfDate, setTrialAsOfDate] = useState<string>(getTodayStr());
  const [trialBalanceReport, setTrialBalanceReport] = useState<TrialBalanceReport | null>(null);

  // --- MODALS ---
  // 1. Add Account Modal
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('ASSET');
  const [newAccSubType, setNewAccSubType] = useState('CURRENT_ASSET');
  const [newAccOpeningBal, setNewAccOpeningBal] = useState<number>(0);
  const [newAccDesc, setNewAccDesc] = useState('');

  // 2. Edit Account Modal
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccSubType, setEditAccSubType] = useState('');
  const [editAccDesc, setEditAccDesc] = useState('');
  const [editAccIsActive, setEditAccIsActive] = useState(true);

  // 3. Post Journal Voucher Modal
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalDate, setJournalDate] = useState(getTodayStr());
  const [journalNarration, setJournalNarration] = useState('');
  const [journalRefType, setJournalRefType] = useState('MANUAL');
  const [journalRefId, setJournalRefId] = useState('');
  const [journalItems, setJournalItems] = useState<JournalFormItem[]>([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' }
  ]);

  // 4. Day Closing Modal
  const [isDayClosingModalOpen, setIsDayClosingModalOpen] = useState(false);
  const [closingDate, setClosingDate] = useState(getTodayStr());
  const [countedCash, setCountedCash] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [denominations, setDenominations] = useState<{ [key: string]: number }>({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    'coins': 0
  });

  // Calculate total from denominations
  const totalDenominationCash = useMemo(() => {
    return (
      (denominations['500'] || 0) * 500 +
      (denominations['200'] || 0) * 200 +
      (denominations['100'] || 0) * 100 +
      (denominations['50'] || 0) * 50 +
      (denominations['20'] || 0) * 20 +
      (denominations['10'] || 0) * 10 +
      (denominations['coins'] || 0)
    );
  }, [denominations]);

  // Sync counted cash if user uses denomination counter
  useEffect(() => {
    if (totalDenominationCash > 0) {
      setCountedCash(totalDenominationCash);
    }
  }, [totalDenominationCash]);

  // --- DATA FETCHING ---
  const loadAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const res: any = await apiClient.get('/accounts/chart');
      if (res?.success && Array.isArray(res.data)) {
        setAccounts(res.data);
        if (!selectedAccountId && res.data.length > 0) {
          // Default to first Asset (e.g. Cash in Drawer) or first account
          const cashAcc = res.data.find((a: any) => a.accountCode === '1010' || a.accountName.toLowerCase().includes('cash'));
          setSelectedAccountId(cashAcc ? cashAcc.id : res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load chart of accounts:', err);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const loadLedgerStatement = async (accId?: string, start?: string, end?: string) => {
    const targetId = accId || selectedAccountId;
    if (!targetId) return;

    try {
      setIsLoadingLedger(true);
      const sDate = start || ledgerStartDate;
      const eDate = end || ledgerEndDate;
      const res: any = await apiClient.get(`/accounts/ledger/${targetId}`, {
        params: { startDate: sDate, endDate: eDate }
      });
      if (res?.success && res.data) {
        setLedgerStatement(res.data);
      }
    } catch (err) {
      console.error('Failed to load ledger statement:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const loadJournals = async () => {
    try {
      setIsLoadingJournals(true);
      const params: any = {};
      if (journalStartDate) params.startDate = journalStartDate;
      if (journalEndDate) params.endDate = journalEndDate;
      const res: any = await apiClient.get('/accounts/journal', { params });
      if (res?.success && Array.isArray(res.data)) {
        setJournals(res.data);
      }
    } catch (err) {
      console.error('Failed to load journals:', err);
    } finally {
      setIsLoadingJournals(false);
    }
  };

  const loadTrialBalance = async (asOf?: string) => {
    try {
      setIsLoadingTrialBalance(true);
      const res: any = await apiClient.get('/accounts/trial-balance', {
        params: { asOfDate: asOf || trialAsOfDate }
      });
      if (res?.success && res.data) {
        setTrialBalanceReport(res.data);
      }
    } catch (err) {
      console.error('Failed to load trial balance:', err);
    } finally {
      setIsLoadingTrialBalance(false);
    }
  };

  const loadDayClosings = async () => {
    try {
      const res: any = await apiClient.get('/accounts/dayclosing/history');
      if (res?.success && Array.isArray(res.data)) {
        setDayClosings(res.data);
      }
    } catch (err) {
      console.error('Failed to load day closing history:', err);
    }
  };

  const loadFinancialSummary = async () => {
    try {
      const res: any = await apiClient.get('/accounts/reports/summary');
      if (res?.success && res.data) {
        setFinancialSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load financial summary:', err);
    }
  };

  // Initial Boot
  useEffect(() => {
    loadAccounts();
    loadFinancialSummary();
  }, []);

  // When selected account or date changes, fetch ledger
  useEffect(() => {
    if (selectedAccountId) {
      loadLedgerStatement(selectedAccountId, ledgerStartDate, ledgerEndDate);
    }
  }, [selectedAccountId, ledgerStartDate, ledgerEndDate]);

  // Tab switch side effects
  useEffect(() => {
    if (activeTab === 'journal') loadJournals();
    if (activeTab === 'trialbalance') loadTrialBalance();
    if (activeTab === 'dayclosing') loadDayClosings();
    if (activeTab === 'summary') loadFinancialSummary();
  }, [activeTab]);

  // --- EXPORT TO EXCEL ---
  const handleExportLedgerExcel = () => {
    if (!ledgerStatement) return;
    try {
      const acc = ledgerStatement.account;
      const rows: any[] = [];

      // Header rows
      rows.push(['BHATIGAL BHANU - RESTAURANT ACCOUNT STATEMENT']);
      rows.push([`Account: [${acc.accountCode}] ${acc.accountName} (${acc.accountType})`]);
      rows.push([`Period: ${ledgerStatement.period.startDate} to ${ledgerStatement.period.endDate}`]);
      rows.push([`Generated On: ${new Date().toLocaleString('en-IN')}`]);
      rows.push([]);

      // Summary
      rows.push([
        'Opening Balance',
        `₹${ledgerStatement.openingBalance.toLocaleString()} ${ledgerStatement.openingBalanceType}`,
        'Total Debits (Inflow)',
        `₹${ledgerStatement.totalDebit.toLocaleString()}`,
        'Total Credits (Outflow)',
        `₹${ledgerStatement.totalCredit.toLocaleString()}`,
        'Closing Balance',
        `₹${ledgerStatement.closingBalance.toLocaleString()} ${ledgerStatement.closingBalanceType}`
      ]);
      rows.push([]);

      // Transactions
      rows.push(['Date', 'Voucher #', 'Particulars', 'Ref Type', 'Narration', 'Debit (₹)', 'Credit (₹)', 'Running Balance']);
      rows.push([
        ledgerStatement.period.startDate,
        '-',
        'Opening Balance Brought Forward (શરૂઆતની બાકી)',
        'OPENING',
        '-',
        ledgerStatement.openingBalanceType === 'Dr' ? ledgerStatement.openingBalance : 0,
        ledgerStatement.openingBalanceType === 'Cr' ? ledgerStatement.openingBalance : 0,
        `₹${ledgerStatement.openingBalance.toLocaleString()} ${ledgerStatement.openingBalanceType}`
      ]);

      ledgerStatement.transactions.forEach((tx) => {
        rows.push([
          tx.entryDate,
          tx.entryNumber,
          tx.particulars,
          tx.referenceType,
          tx.narration,
          tx.debit || 0,
          tx.credit || 0,
          `₹${((tx as any).balance ?? tx.runningBalance ?? 0).toLocaleString()} ${tx.balanceType}`
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ledger_Statement');
      XLSX.writeFile(wb, `${acc.accountCode}_${acc.accountName.replace(/\s+/g, '_')}_Statement.xlsx`);
    } catch (err: any) {
      alert('Failed to export Excel: ' + err.message);
    }
  };

  // --- EXPORT TO PDF ---
  const handleExportLedgerPDF = () => {
    if (!ledgerStatement) return;
    try {
      const doc = new jsPDF('p', 'pt', 'a4');
      const acc = ledgerStatement.account;

      // Title & Letterhead
      doc.setFontSize(16);
      doc.setTextColor(122, 27, 40); // Bhatigal Maroon
      doc.text('BHATIGAL BHANU RESTAURANT', 40, 45);

      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('ACCOUNT LEDGER STATEMENT (નામા ખાતાવહી સ્ટેટમેન્ટ)', 40, 62);

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Account: [${acc.accountCode}] ${acc.accountName} | Group: ${acc.accountType} (${acc.subType || 'General'})`, 40, 78);
      doc.text(`Statement Period: ${ledgerStatement.period.startDate} to ${ledgerStatement.period.endDate}`, 40, 90);
      doc.text(`Closing Balance: Rs. ${ledgerStatement.closingBalance.toLocaleString()} ${ledgerStatement.closingBalanceType}`, 40, 102);

      // Table
      const tableData = [
        [
          ledgerStatement.period.startDate,
          '-',
          'Opening Balance (શરૂઆતની બાકી)',
          'OPENING',
          ledgerStatement.openingBalanceType === 'Dr' ? `Rs. ${ledgerStatement.openingBalance}` : '-',
          ledgerStatement.openingBalanceType === 'Cr' ? `Rs. ${ledgerStatement.openingBalance}` : '-',
          `Rs. ${ledgerStatement.openingBalance} ${ledgerStatement.openingBalanceType}`
        ],
        ...ledgerStatement.transactions.map((tx) => [
          tx.entryDate,
          tx.entryNumber,
          tx.particulars,
          tx.referenceType,
          tx.debit > 0 ? `Rs. ${tx.debit.toLocaleString()}` : '-',
          tx.credit > 0 ? `Rs. ${tx.credit.toLocaleString()}` : '-',
          `Rs. ${((tx as any).balance ?? tx.runningBalance ?? 0).toLocaleString()} ${tx.balanceType}`
        ])
      ];

      autoTable(doc, {
        startY: 115,
        head: [['Date', 'Voucher #', 'Particulars / Contra', 'Type', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [122, 27, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 70 },
          2: { cellWidth: 160 },
          3: { cellWidth: 50 },
          4: { cellWidth: 65, halign: 'right' },
          5: { cellWidth: 65, halign: 'right' },
          6: { cellWidth: 70, halign: 'right', fontStyle: 'bold' }
        }
      });

      doc.save(`${acc.accountCode}_Ledger_Statement.pdf`);
    } catch (err: any) {
      alert('Failed to export PDF: ' + err.message);
    }
  };

  // --- PRINT LEDGER ---
  const handlePrintLedger = () => {
    window.print();
  };

  // --- EXPORT TRIAL BALANCE EXCEL ---
  const handleExportTrialBalanceExcel = () => {
    if (!trialBalanceReport) return;
    try {
      const rows: any[] = [];
      rows.push(['BHATIGAL BHANU - TRIAL BALANCE REPORT (કાચું સરવૈયું)']);
      rows.push([`As of Date: ${trialBalanceReport.asOfDate}`]);
      rows.push([`Status: ${trialBalanceReport.isBalanced ? 'BALANCED' : 'UNBALANCED'}`]);
      rows.push([]);
      rows.push(['Account Code', 'Account Name', 'Group', 'Sub Type', 'Debit (₹)', 'Credit (₹)']);

      trialBalanceReport.rows.forEach(r => {
        rows.push([
          r.accountCode,
          r.accountName,
          r.accountType,
          r.subType || '-',
          r.debitBalance || 0,
          r.creditBalance || 0
        ]);
      });

      rows.push([]);
      rows.push(['GRAND TOTAL', '', '', '', trialBalanceReport.grandDebit, trialBalanceReport.grandCredit]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Trial_Balance');
      XLSX.writeFile(wb, `Trial_Balance_${trialBalanceReport.asOfDate}.xlsx`);
    } catch (err: any) {
      alert('Failed to export Trial Balance: ' + err.message);
    }
  };

  // --- JOURNAL MODAL HELPERS ---
  const handleAddJournalLine = () => {
    setJournalItems(prev => [...prev, { accountId: '', debit: 0, credit: 0, description: '' }]);
  };

  const handleRemoveJournalLine = (index: number) => {
    if (journalItems.length <= 2) {
      alert('A double-entry voucher must contain at least 2 lines (Debit and Credit).');
      return;
    }
    setJournalItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateJournalLine = (index: number, field: keyof JournalFormItem, value: any) => {
    setJournalItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const journalTotals = useMemo(() => {
    let debitSum = 0;
    let creditSum = 0;
    journalItems.forEach(it => {
      debitSum += Number(it.debit || 0);
      creditSum += Number(it.credit || 0);
    });
    const diff = Math.abs(debitSum - creditSum);
    const isBalanced = debitSum > 0 && debitSum === creditSum;
    return { debitSum, creditSum, diff, isBalanced };
  }, [journalItems]);

  // --- CREATE ACCOUNT HEAD ---
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) {
      alert('Account code and account title are required.');
      return;
    }

    try {
      const payload = {
        accountCode: newAccCode.trim().toUpperCase(),
        accountName: newAccName.trim(),
        accountType: newAccType,
        subType: newAccSubType.trim() || undefined,
        openingBalance: Number(newAccOpeningBal || 0),
        description: newAccDesc.trim() || undefined
      };

      const res: any = await apiClient.post('/accounts/chart', payload);
      if (res?.success) {
        alert('New account head registered successfully!');
        setIsAddAccountModalOpen(false);
        setNewAccCode('');
        setNewAccName('');
        setNewAccOpeningBal(0);
        setNewAccDesc('');
        loadAccounts();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create account head.');
    }
  };

  // --- UPDATE ACCOUNT HEAD ---
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const res: any = await apiClient.put(`/accounts/chart/${editingAccount.id}`, {
        accountName: editAccName.trim(),
        subType: editAccSubType,
        description: editAccDesc,
        isActive: editAccIsActive
      });
      if (res?.success) {
        alert('Account head updated successfully.');
        setEditingAccount(null);
        loadAccounts();
        if (selectedAccountId === editingAccount.id) {
          loadLedgerStatement();
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update account head.');
    }
  };

  // --- POST BALANCED JOURNAL VOUCHER ---
  const handlePostJournalVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalNarration.trim()) {
      alert('Narration / Description is required for journal voucher.');
      return;
    }

    if (!journalTotals.isBalanced) {
      alert(`Double-entry unbalanced: Total Debits (Rs. ${journalTotals.debitSum}) must equal Total Credits (Rs. ${journalTotals.creditSum}).`);
      return;
    }

    // Check each line has valid account
    const invalidLine = journalItems.find(it => !it.accountId || (it.debit === 0 && it.credit === 0));
    if (invalidLine) {
      alert('Every voucher line must have a selected account and a positive debit or credit amount.');
      return;
    }

    try {
      const payload = {
        entryDate: journalDate,
        referenceType: journalRefType,
        referenceId: journalRefId || undefined,
        narration: journalNarration.trim(),
        items: journalItems.map(it => {
          const acc = accounts.find(a => a.id === it.accountId);
          return {
            accountId: it.accountId,
            accountName: acc?.accountName || 'Account',
            debit: Number(it.debit || 0),
            credit: Number(it.credit || 0),
            description: it.description || journalNarration
          };
        })
      };

      const res: any = await apiClient.post('/accounts/journal', payload);
      if (res?.success) {
        alert(`Journal Voucher posted successfully! Voucher #${res.data?.entryNumber || ''}`);
        setIsJournalModalOpen(false);
        setJournalNarration('');
        loadAccounts();
        if (activeTab === 'ledger') loadLedgerStatement();
        if (activeTab === 'journal') loadJournals();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post journal voucher.');
    }
  };

  // --- EXECUTE DAY CLOSING ---
  const handleExecuteDayClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        closingDate,
        actualCash: Number(countedCash || 0),
        notes: closingNotes.trim() || undefined,
        denominations: totalDenominationCash > 0 ? denominations : undefined
      };

      const res: any = await apiClient.post('/accounts/dayclosing', payload);
      if (res?.success) {
        alert(`Day Closing finalized successfully for date ${closingDate}!`);
        setIsDayClosingModalOpen(false);
        setClosingNotes('');
        loadDayClosings();
        loadFinancialSummary();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to finalize day closing.');
    }
  };

  // Filtered Chart of Accounts for COA Tab
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesType = coaTypeFilter === 'ALL' || acc.accountType === coaTypeFilter;
      const matchesSearch = !coaSearch ||
        acc.accountCode.toLowerCase().includes(coaSearch.toLowerCase()) ||
        acc.accountName.toLowerCase().includes(coaSearch.toLowerCase()) ||
        (acc.subType && acc.subType.toLowerCase().includes(coaSearch.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [accounts, coaTypeFilter, coaSearch]);

  // COA Totals summary
  const coaSummary = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let revenue = 0;
    let expenses = 0;
    accounts.forEach(a => {
      if (a.accountType === 'ASSET') assets += a.currentBalance;
      else if (a.accountType === 'LIABILITY') liabilities += a.currentBalance;
      else if (a.accountType === 'EQUITY') equity += a.currentBalance;
      else if (a.accountType === 'REVENUE') revenue += a.currentBalance;
      else if (a.accountType === 'EXPENSE') expenses += a.currentBalance;
    });
    return { assets, liabilities, equity, revenue, expenses };
  }, [accounts]);

  // 4 Core Restaurant Financial Pulse metrics for Simple Mode
  const quickStats = useMemo(() => {
    let cash = 0;
    let bank = 0;
    let payables = 0;
    let receivables = 0;
    let cashAccountId = '';
    let bankAccountId = '';
    let payableAccountId = '';
    let receivableAccountId = '';

    accounts.forEach(a => {
      const name = a.accountName.toLowerCase();
      const code = a.accountCode;
      const subType = (a.subType || '').toUpperCase();

      if (a.id === 'acc_cash_drawer' || subType === 'CASH' || name.includes('cash in counter') || name.includes('cash in drawer') || (name.includes('cash') && !name.includes('expense'))) {
        cash += a.currentBalance;
        if (!cashAccountId) cashAccountId = a.id;
      } else if (a.id === 'acc_bank_sbi' || subType === 'BANK' || name.includes('bank') || name.includes('sbi')) {
        bank += a.currentBalance;
        if (!bankAccountId) bankAccountId = a.id;
      } else if (a.accountType === 'LIABILITY' && (a.id === 'acc_supplier_payable' || code === '2010' || name.includes('supplier') || name.includes('payable'))) {
        payables += a.currentBalance;
        if (!payableAccountId) payableAccountId = a.id;
      } else if (a.accountType === 'ASSET' && (a.id === 'acc_pos_receivable' || code === '1030' || name.includes('receivable') || name.includes('customer'))) {
        receivables += a.currentBalance;
        if (!receivableAccountId) receivableAccountId = a.id;
      }
    });

    return {
      cash,
      bank,
      payables,
      receivables,
      cashAccountId: cashAccountId || accounts[0]?.id || '',
      bankAccountId: bankAccountId || accounts[1]?.id || '',
      payableAccountId: payableAccountId || accounts.find(a => a.accountType === 'LIABILITY')?.id || '',
      receivableAccountId: receivableAccountId || accounts.find(a => a.accountType === 'ASSET' && a.id !== cashAccountId)?.id || '',
    };
  }, [accounts]);

  // 1-Click Popular Accounts for fast navigation without searching dropdowns
  const popularAccounts = useMemo(() => {
    const findAcc = (fn: (a: ChartOfAccount) => boolean) => accounts.find(fn);
    const list = [
      {
        id: 'cash',
        label: '💵 રોકડ ગલ્લો',
        badge: 'Cash Drawer',
        acc: findAcc(a => a.id === 'acc_cash_drawer' || (a.subType || '').toUpperCase() === 'CASH' || a.accountName.toLowerCase().includes('cash'))
      },
      {
        id: 'bank',
        label: '🏦 SBI બેંક ખાતું',
        badge: 'Bank Account',
        acc: findAcc(a => a.id === 'acc_bank_sbi' || (a.subType || '').toUpperCase() === 'BANK' || a.accountName.toLowerCase().includes('bank'))
      },
      {
        id: 'sales',
        label: '🍽️ થાળી વેચાણ આવક',
        badge: 'Food Sales',
        acc: findAcc(a => a.id === 'acc_food_sales' || a.accountCode === '4010' || a.accountName.toLowerCase().includes('sales'))
      },
      {
        id: 'raw',
        label: '🥬 શાકભાજી & કરિયાણું',
        badge: 'Raw Provisions',
        acc: findAcc(a => a.id === 'acc_inventory_asset' || a.id === 'acc_cogs_food' || a.accountCode === '1040' || a.accountName.toLowerCase().includes('provision') || a.accountName.toLowerCase().includes('inventory'))
      },
      {
        id: 'salary',
        label: '👨‍🍳 સ્ટાફ પગાર',
        badge: 'Salaries',
        acc: findAcc(a => a.id === 'acc_exp_salaries' || a.accountCode === '6030' || a.accountName.toLowerCase().includes('salary'))
      },
      {
        id: 'gas',
        label: '⚡ લાઈટબિલ & ગેસ',
        badge: 'Utilities',
        acc: findAcc(a => a.id === 'acc_exp_utilities' || a.accountCode === '6020' || a.accountName.toLowerCase().includes('utilit') || a.accountName.toLowerCase().includes('gas'))
      },
      {
        id: 'supplier',
        label: '🤝 વેપારી ખાતાઓ',
        badge: 'Suppliers (દેવાં)',
        acc: findAcc(a => a.id === 'acc_supplier_payable' || a.accountCode === '2010' || a.accountName.toLowerCase().includes('supplier') || a.accountName.toLowerCase().includes('payable'))
      }
    ];
    return list.filter(item => Boolean(item.acc));
  }, [accounts]);

  // Filtered Ledger Transactions for search input inside ledger tab
  const filteredLedgerTx = useMemo(() => {
    if (!ledgerStatement) return [];
    if (!ledgerSearch.trim()) return ledgerStatement.transactions;
    const q = ledgerSearch.toLowerCase();
    return ledgerStatement.transactions.filter(tx =>
      tx.entryNumber.toLowerCase().includes(q) ||
      tx.particulars.toLowerCase().includes(q) ||
      tx.narration.toLowerCase().includes(q) ||
      (tx.referenceId && tx.referenceId.toLowerCase().includes(q))
    );
  }, [ledgerStatement, ledgerSearch]);

  // Quick Preset Setter
  const setPresetRange = (type: 'today' | 'yesterday' | 'week' | 'month' | 'fy') => {
    if (type === 'today') {
      setLedgerStartDate(getTodayStr());
      setLedgerEndDate(getTodayStr());
    } else if (type === 'yesterday') {
      setLedgerStartDate(getYesterdayStr());
      setLedgerEndDate(getYesterdayStr());
    } else if (type === 'week') {
      setLedgerStartDate(getWeekStartStr());
      setLedgerEndDate(getTodayStr());
    } else if (type === 'month') {
      setLedgerStartDate(getMonthStartStr());
      setLedgerEndDate(getTodayStr());
    } else if (type === 'fy') {
      setLedgerStartDate(getFYStartStr());
      setLedgerEndDate(getTodayStr());
    }
  };

  return (
    <div className="d-flex flex-column gap-3 p-1 p-md-2" style={{ fontSize: '0.85rem' }}>
      {/* 1. TOP HEADER BAR: Box Type Layout with Bhatigal Maroon Accents */}
      <div className="card shadow-sm border rounded-3 mb-1 bg-white" style={{ borderLeft: '4px solid #7A1B28' }}>
        <div className="card-body p-3 px-sm-3.5 py-sm-3 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div className="d-flex align-items-center gap-3">
            {/* Header Icon Box */}
            <div
              className="rounded-3 d-flex align-items-center justify-content-center shadow-sm flex-shrink-0 text-white"
              style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #7A1B28 0%, #4A0E17 100%)' }}
            >
              <BookOpen size={22} className="text-white" />
            </div>

            {/* Title & Metadata Badges */}
            <div className="d-flex flex-column">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="fw-bold mb-0 text-dark fs-6">
                  Account & Ledger Management
                </h5>
                <span className="badge px-2 py-0.5 rounded-pill fw-bold" style={{ background: '#FDF2E9', color: '#7A1B28', border: '1px solid #F5C6CB', fontSize: '0.72rem' }}>
                  નામા ખાતાવહી અને હિસાબ
                </span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill fw-bold" style={{ fontSize: '0.72rem' }}>
                  Double-Entry Central System
                </span>
              </div>
              <div className="text-muted small mt-0.5" style={{ fontSize: '0.74rem' }}>
                Chart of accounts, real-time ledger statements, balanced journal vouchers, trial balance & day closing
              </div>
            </div>
          </div>

          {/* Action Buttons Box - Responsive for Web & Mobile */}
          <div className="d-flex align-items-center gap-2 flex-wrap w-100 w-md-auto justify-content-start justify-content-md-end">
            {can('accounts.chart.create') && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center gap-1.5 px-2.5 py-1.5 rounded-2 shadow-xs fw-bold flex-fill flex-md-grow-0"
                style={{ fontSize: '0.78rem', height: 36 }}
                onClick={() => {
                  setNewAccCode(`ACC-${Math.floor(1000 + Math.random() * 9000)}`);
                  setNewAccName('');
                  setNewAccOpeningBal(0);
                  setNewAccDesc('');
                  setIsAddAccountModalOpen(true);
                }}
              >
                <Plus size={15} strokeWidth={2.5} /> <span className="text-nowrap">Add Account</span>
              </button>
            )}

            {can('accounts.journal.create') && (
              <button
                type="button"
                className="btn btn-sm text-white d-inline-flex align-items-center justify-content-center gap-1.5 px-3 py-1.5 rounded-2 shadow-xs fw-bold flex-fill flex-md-grow-0"
                style={{ backgroundColor: '#7A1B28', borderColor: '#7A1B28', fontSize: '0.78rem', height: 36 }}
                onClick={() => {
                  setJournalNarration('');
                  setJournalDate(getTodayStr());
                  setJournalRefId('');
                  setJournalItems([
                    { accountId: accounts[0]?.id || '', debit: 0, credit: 0, description: '' },
                    { accountId: accounts[1]?.id || '', debit: 0, credit: 0, description: '' }
                  ]);
                  setIsJournalModalOpen(true);
                }}
              >
                <Plus size={15} strokeWidth={2.5} /> <span className="text-nowrap">Post Journal</span>
              </button>
            )}

            {can('accounts.dayclosing.execute') && (
              <button
                type="button"
                className="btn btn-warning text-dark btn-sm d-inline-flex align-items-center justify-content-center gap-1.5 px-3 py-1.5 rounded-2 shadow-xs fw-bold flex-fill flex-md-grow-0"
                style={{ fontSize: '0.78rem', height: 36 }}
                onClick={() => setIsDayClosingModalOpen(true)}
              >
                <CalendarCheck size={15} strokeWidth={2.2} /> <span className="text-nowrap">Day Closing</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODE SWITCHER & QUICK HELP BAR */}
      <div className="card shadow-sm border rounded-3 bg-white p-2.5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          {/* Mode Switcher */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="small fw-bold text-dark d-flex align-items-center gap-1">
              <Sparkles size={14} className="text-warning" /> દર્શાવવાની પદ્ધતિ (Mode):
            </span>
            <div className="btn-group btn-group-sm shadow-xs" role="group">
              <button
                type="button"
                className={`btn btn-sm px-3 py-1 fw-bold ${viewMode === 'simple' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('simple')}
              >
                🟢 સરળ મોડ (Simple View)
              </button>
              <button
                type="button"
                className={`btn btn-sm px-3 py-1 fw-bold ${viewMode === 'pro' ? 'btn-dark text-white' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('pro')}
              >
                💼 પ્રો મોડ (CA / Accounting)
              </button>
            </div>
          </div>

          {/* Quick Guide Toggle & Help Hint */}
          <div className="d-flex align-items-center gap-2 w-100 w-md-auto justify-content-between justify-content-md-end">
            <button
              type="button"
              className={`btn btn-sm d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill shadow-xs fw-bold ${
                showExplainer ? 'btn-warning text-dark' : 'btn-outline-secondary'
              }`}
              onClick={() => setShowExplainer(!showExplainer)}
            >
              <HelpCircle size={15} /> <span>💡 હિસાબ સરળતાથી સમજો {showExplainer ? '▲' : '▼'}</span>
            </button>
            <span className="text-muted small d-none d-lg-inline" style={{ fontSize: '0.72rem' }}>
              રોકડ, બેંક અને નફા-નુકસાનનું વિશ્લેષણ
            </span>
          </div>
        </div>

        {/* COLLAPSIBLE BEGINNER'S GUIDE */}
        {showExplainer && (
          <div className="mt-3 pt-3 border-top">
            <div className="p-3 rounded-3" style={{ backgroundColor: '#FFFDF5', border: '1px solid #FDE68A' }}>
              <div className="d-flex justify-content-between align-items-center mb-2.5">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1.5 fs-6">
                  <Sparkles size={16} className="text-warning" />
                  <span>રેસ્ટોરન્ટ હિસાબને ૩ સાદા નિયમોથી સમજો (Simple Accounting Guide)</span>
                </h6>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm py-0 px-1.5 rounded-circle"
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => setShowExplainer(false)}
                >
                  ✕
                </button>
              </div>

              <div className="row g-2.5">
                {/* Rule 1: Dr & Cr Niyam */}
                <div className="col-12 col-md-4">
                  <div className="card border-0 p-2.5 rounded-2 h-100 shadow-xs" style={{ backgroundColor: '#F0FDF4', borderLeft: '3px solid #16A34A' }}>
                    <div className="fw-bold text-success small mb-1 d-flex align-items-center gap-1">
                      <ArrowDownLeft size={15} /> ૧. ઉધાર (Debit) અને જમા (Credit) શું છે?
                    </div>
                    <p className="small text-secondary mb-1" style={{ fontSize: '0.75rem' }}>
                      રોકડ ગલ્લો અને બેંક ખાતા માટે યાદ રાખો:
                    </p>
                    <ul className="small text-dark mb-0 ps-3" style={{ fontSize: '0.74rem' }}>
                      <li><strong className="text-success">🟢 Debit (Dr ⬇️):</strong> ગલ્લામાં કે બેંકમાં <strong>રૂપિયા આવ્યા</strong> (થાળી વેચાણ, બિલ વસૂલાત).</li>
                      <li><strong className="text-danger">🔴 Credit (Cr ⬆️):</strong> ગલ્લામાંથી કે બેંકમાંથી <strong>રૂપિયા ગયા</strong> (શાકભાજી, તેલ, સ્ટાફ પગાર).</li>
                    </ul>
                  </div>
                </div>

                {/* Rule 2: 5 Mukhy Khatao */}
                <div className="col-12 col-md-4">
                  <div className="card border-0 p-2.5 rounded-2 h-100 shadow-xs" style={{ backgroundColor: '#EFF6FF', borderLeft: '3px solid #2563EB' }}>
                    <div className="fw-bold text-primary small mb-1 d-flex align-items-center gap-1">
                      <Wallet size={15} /> ૨. રેસ્ટોરન્ટના ૫ મુખ્ય ખાતાઓ:
                    </div>
                    <ul className="small text-dark mb-0 ps-3" style={{ fontSize: '0.74rem' }}>
                      <li><strong>મિલકતો (Assets):</strong> ગલ્લાની રોકડ, બેંક બેલેન્સ, ગોડાઉનનો સ્ટોક.</li>
                      <li><strong>દેવાં (Liabilities):</strong> વેપારીઓને ચૂકવવાના બાકી, GST ટેક્સ.</li>
                      <li><strong>આવક (Revenue):</strong> કાઠિયાવાડી ભોજન અને પીણાંનું વેચાણ.</li>
                      <li><strong>ખર્ચ (Expenses):</strong> કરિયાણું, ગેસ, પગાર અને ભાડું.</li>
                      <li><strong>મૂડી (Equity):</strong> માલિકે ધંધામાં લગાવેલા પોતાના રૂપિયા.</li>
                    </ul>
                  </div>
                </div>

                {/* Rule 3: Tabs Shu Kaam Kare Chhe */}
                <div className="col-12 col-md-4">
                  <div className="card border-0 p-2.5 rounded-2 h-100 shadow-xs" style={{ backgroundColor: '#FFF7ED', borderLeft: '3px solid #EA580C' }}>
                    <div className="fw-bold text-warning-emphasis small mb-1 d-flex align-items-center gap-1">
                      <BookOpen size={15} /> ૩. કઈ ટેબ શેના માટે વાપરવી?
                    </div>
                    <ul className="small text-dark mb-0 ps-3" style={{ fontSize: '0.74rem' }}>
                      <li><strong>ખાતાવહી (Ledger):</strong> ૧ ખાતાની તારીખવાર આવક-જાવક જોવી.</li>
                      <li><strong>તમામ ખાતાઓ (Chart):</strong> દુકાનના તમામ ખાતાઓનું લિસ્ટ.</li>
                      <li><strong>જર્નલ:</strong> ગલ્લામાંથી બેંકમાં કે ખર્ચમાં એન્ટ્રી ટ્રાન્સફર કરવી.</li>
                      <li><strong>P&L (નફો-નુકસાન):</strong> આવક માઈનસ ખર્ચ = ચોખ્ખો નફો.</li>
                      <li><strong>ડે-ક્લોઝિંગ:</strong> રાત્રે ગલ્લો ગણીને સરભર કરવો.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4 LIVE RESTAURANT FINANCE PULSE CARDS (1-CLICK DIRECT NAVIGATION) */}
      <div className="row g-2">
        {/* Pulse Card 1: Cash in Counter */}
        <div className="col-6 col-lg-3">
          <div
            className="card shadow-sm border rounded-3 p-2.5 bg-white h-100 transition-all"
            style={{
              borderLeft: '4px solid #16A34A',
              cursor: 'pointer',
              backgroundColor: selectedAccountId === quickStats.cashAccountId && activeTab === 'ledger' ? '#F0FDF4' : '#FFFFFF'
            }}
            onClick={() => {
              if (quickStats.cashAccountId) {
                setSelectedAccountId(quickStats.cashAccountId);
                setActiveTab('ledger');
              }
            }}
            title="ક્લિક કરીને રોકડ ગલ્લાની ખાતાવહી જુઓ"
          >
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small fw-bold text-success d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                <Wallet size={14} /> રોકડ ગલ્લો (Cash in Hand)
              </span>
              <span className="badge bg-success text-white px-1.5 py-0.5 rounded-pill" style={{ fontSize: '0.65rem' }}>
                લાઇવ
              </span>
            </div>
            <h5 className="fw-bold mb-0 text-dark fs-5">
              ₹{quickStats.cash.toLocaleString()}
            </h5>
            <div className="d-flex justify-content-between align-items-center mt-1">
              <span className="text-muted small text-truncate" style={{ fontSize: '0.68rem' }}>
                કાઉન્ટર ડ્રોઅરમાં રોકડ
              </span>
              <span className="text-success fw-bold small text-nowrap" style={{ fontSize: '0.68rem' }}>
                હિસાબ જુઓ ➔
              </span>
            </div>
          </div>
        </div>

        {/* Pulse Card 2: Bank Balance */}
        <div className="col-6 col-lg-3">
          <div
            className="card shadow-sm border rounded-3 p-2.5 bg-white h-100 transition-all"
            style={{
              borderLeft: '4px solid #2563EB',
              cursor: 'pointer',
              backgroundColor: selectedAccountId === quickStats.bankAccountId && activeTab === 'ledger' ? '#EFF6FF' : '#FFFFFF'
            }}
            onClick={() => {
              if (quickStats.bankAccountId) {
                setSelectedAccountId(quickStats.bankAccountId);
                setActiveTab('ledger');
              }
            }}
            title="ક્લિક કરીને બેંક ખાતાની ખાતાવહી જુઓ"
          >
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small fw-bold text-primary d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                <Building2 size={14} /> બેંક એકાઉન્ટ (Bank Balance)
              </span>
              <span className="badge bg-primary text-white px-1.5 py-0.5 rounded-pill" style={{ fontSize: '0.65rem' }}>
                કરંટ ખાતું
              </span>
            </div>
            <h5 className="fw-bold mb-0 text-primary fs-5">
              ₹{quickStats.bank.toLocaleString()}
            </h5>
            <div className="d-flex justify-content-between align-items-center mt-1">
              <span className="text-muted small text-truncate" style={{ fontSize: '0.68rem' }}>
                SBI / HDFC બેંક જમા
              </span>
              <span className="text-primary fw-bold small text-nowrap" style={{ fontSize: '0.68rem' }}>
                સ્ટેટમેન્ટ ➔
              </span>
            </div>
          </div>
        </div>

        {/* Pulse Card 3: Supplier Payables */}
        <div className="col-6 col-lg-3">
          <div
            className="card shadow-sm border rounded-3 p-2.5 bg-white h-100 transition-all"
            style={{
              borderLeft: '4px solid #DC2626',
              cursor: 'pointer',
              backgroundColor: selectedAccountId === quickStats.payableAccountId && activeTab === 'ledger' ? '#FEF2F2' : '#FFFFFF'
            }}
            onClick={() => {
              if (quickStats.payableAccountId) {
                setSelectedAccountId(quickStats.payableAccountId);
                setActiveTab('ledger');
              }
            }}
            title="ક્લિક કરીને વેપારીઓના ચૂકવવાના દેવાં જુઓ"
          >
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small fw-bold text-danger d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                <Users size={14} /> વેપારી દેવાં (To Pay / Suppliers)
              </span>
              <span className="badge bg-danger text-white px-1.5 py-0.5 rounded-pill" style={{ fontSize: '0.65rem' }}>
                ચૂકવવાના
              </span>
            </div>
            <h5 className="fw-bold mb-0 text-danger fs-5">
              ₹{quickStats.payables.toLocaleString()}
            </h5>
            <div className="d-flex justify-content-between align-items-center mt-1">
              <span className="text-muted small text-truncate" style={{ fontSize: '0.68rem' }}>
                શાકભાજી & કરિયાણા વેપારીઓ
              </span>
              <span className="text-danger fw-bold small text-nowrap" style={{ fontSize: '0.68rem' }}>
                વિગત ➔
              </span>
            </div>
          </div>
        </div>

        {/* Pulse Card 4: Customer Receivables */}
        <div className="col-6 col-lg-3">
          <div
            className="card shadow-sm border rounded-3 p-2.5 bg-white h-100 transition-all"
            style={{
              borderLeft: '4px solid #D97706',
              cursor: 'pointer',
              backgroundColor: selectedAccountId === quickStats.receivableAccountId && activeTab === 'ledger' ? '#FFFBEB' : '#FFFFFF'
            }}
            onClick={() => {
              if (quickStats.receivableAccountId) {
                setSelectedAccountId(quickStats.receivableAccountId);
                setActiveTab('ledger');
              }
            }}
            title="ક્લિક કરીને ગ્રાહક ઉધાર લેણાં જુઓ"
          >
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small fw-bold text-warning-emphasis d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                <ArrowDownLeft size={14} /> માર્કેટ લેણાં (To Receive / Udhar)
              </span>
              <span className="badge bg-warning text-dark px-1.5 py-0.5 rounded-pill" style={{ fontSize: '0.65rem' }}>
                આવવાના
              </span>
            </div>
            <h5 className="fw-bold mb-0 text-warning-emphasis fs-5">
              ₹{quickStats.receivables.toLocaleString()}
            </h5>
            <div className="d-flex justify-content-between align-items-center mt-1">
              <span className="text-muted small text-truncate" style={{ fontSize: '0.68rem' }}>
                ગ્રાહકો પાસેથી લેવાના
              </span>
              <span className="text-warning-emphasis fw-bold small text-nowrap" style={{ fontSize: '0.68rem' }}>
                વિગત ➔
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION TABS: Horizontal Touch Scroll for Mobile & Web */}
      <div className="card shadow-sm border rounded-3 bg-white p-1.5">
        <ul className="nav nav-pills gap-1 flex-nowrap overflow-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <li className="nav-item flex-shrink-0">
            <button
              className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap ${
                activeTab === 'ledger' ? 'text-white fw-bold shadow-xs' : 'text-dark bg-light'
              }`}
              style={activeTab === 'ledger' ? { backgroundColor: '#7A1B28', borderColor: '#7A1B28' } : {}}
              onClick={() => setActiveTab('ledger')}
            >
              <BookOpen size={15} /> Account Ledger Statement (ખાતાવહી)
            </button>
          </li>
          {can('accounts.chart.view') && (
            <li className="nav-item flex-shrink-0">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap ${
                  activeTab === 'chart' ? 'text-white fw-bold shadow-xs' : 'text-dark bg-light'
                }`}
                style={activeTab === 'chart' ? { backgroundColor: '#7A1B28', borderColor: '#7A1B28' } : {}}
                onClick={() => setActiveTab('chart')}
              >
                <ListTree size={15} /> Chart of Accounts ({accounts.length})
              </button>
            </li>
          )}
          {(can('accounts.journal.view') || can('accounts.ledger.view')) && (
            <li className="nav-item flex-shrink-0">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap ${
                  activeTab === 'journal' ? 'text-white fw-bold shadow-xs' : 'text-dark bg-light'
                }`}
                style={activeTab === 'journal' ? { backgroundColor: '#7A1B28', borderColor: '#7A1B28' } : {}}
                onClick={() => setActiveTab('journal')}
              >
                <FileText size={15} /> Journal Entries ({journals.length})
              </button>
            </li>
          )}
          <li className="nav-item flex-shrink-0">
            <button
              className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap ${
                activeTab === 'trialbalance' ? 'text-white fw-bold shadow-xs' : 'text-dark bg-light'
              }`}
              style={activeTab === 'trialbalance' ? { backgroundColor: '#7A1B28', borderColor: '#7A1B28' } : {}}
              onClick={() => setActiveTab('trialbalance')}
            >
              <Scale size={15} /> Trial Balance (કાચું સરવૈયું)
            </button>
          </li>
          {(can('accounts.dashboard.view') || can('accounts.report.view')) && (
            <li className="nav-item flex-shrink-0">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap ${
                  activeTab === 'summary' ? 'text-white fw-bold shadow-xs' : 'text-dark bg-light'
                }`}
                style={activeTab === 'summary' ? { backgroundColor: '#7A1B28', borderColor: '#7A1B28' } : {}}
                onClick={() => setActiveTab('summary')}
              >
                <TrendingUp size={15} /> Financial Statements (P&L)
              </button>
            </li>
          )}
          {can('accounts.dayclosing.view') && (
            <li className="nav-item flex-shrink-0">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap ${
                  activeTab === 'dayclosing' ? 'text-white fw-bold shadow-xs' : 'text-dark bg-light'
                }`}
                style={activeTab === 'dayclosing' ? { backgroundColor: '#7A1B28', borderColor: '#7A1B28' } : {}}
                onClick={() => setActiveTab('dayclosing')}
              >
                <CalendarCheck size={15} /> Day Closing Register ({dayClosings.length})
              </button>
            </li>
          )}
        </ul>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INDIVIDUAL ACCOUNT LEDGER STATEMENT (ખાતાવહી)     */}
      {/* ======================================================== */}
      {activeTab === 'ledger' && (
        <div className="d-flex flex-column gap-3">
          {/* Top Filter & Toolbar Card - Perfectly Structured for Mobile & Web */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="row g-3">
              {/* Quick 1-Click Popular Accounts Bar */}
              {popularAccounts.length > 0 && (
                <div className="col-12 pb-2.5 border-bottom">
                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                    <span className="small text-secondary fw-bold me-1 text-nowrap d-flex align-items-center gap-1" style={{ fontSize: '0.76rem' }}>
                      <Sparkles size={13} className="text-warning" /> મુખ્ય ખાતાઓ (Quick Select):
                    </span>
                    {popularAccounts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={`btn btn-xs rounded-pill px-2.5 py-1 text-nowrap transition-all ${
                          selectedAccountId === p.acc!.id
                            ? 'btn-dark fw-bold text-white shadow-xs'
                            : 'btn-outline-secondary bg-white text-dark'
                        }`}
                        style={{ fontSize: '0.74rem' }}
                        onClick={() => {
                          if (p.acc) setSelectedAccountId(p.acc.id);
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row A: Account Selector (Left) + Export & Refresh Buttons (Right) */}
              <div className="col-12 col-lg-7">
                <label className="form-label small fw-bold text-dark d-flex align-items-center gap-1 mb-1.5">
                  <BookOpen size={14} style={{ color: '#7A1B28' }} /> Select Account Head (નામા ખાતું પસંદ કરો)
                </label>
                <select
                  className="form-select form-select-sm fw-bold shadow-xs"
                  style={{ borderColor: '#F5C6CB', backgroundColor: '#FFFDFD' }}
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={isLoadingAccounts}
                >
                  <optgroup label="Assets (મિલકતો & રોકડ/બેંક)">
                    {accounts.filter(a => a.accountType === 'ASSET').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (₹{a.currentBalance.toLocaleString()} Dr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Liabilities (દેવાં & ટેક્સ)">
                    {accounts.filter(a => a.accountType === 'LIABILITY').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (₹{a.currentBalance.toLocaleString()} Cr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Equity (મૂડી)">
                    {accounts.filter(a => a.accountType === 'EQUITY').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (₹{a.currentBalance.toLocaleString()} Cr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Revenue (આવક & વેચાણ)">
                    {accounts.filter(a => a.accountType === 'REVENUE').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (₹{a.currentBalance.toLocaleString()} Cr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Expenses (ખર્ચ)">
                    {accounts.filter(a => a.accountType === 'EXPENSE').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (₹{a.currentBalance.toLocaleString()} Dr)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="col-12 col-lg-5 d-flex align-items-end justify-content-start justify-content-lg-end">
                <div className="d-flex align-items-center gap-1.5 w-100 w-lg-auto justify-content-between justify-content-lg-end flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center gap-1 shadow-xs px-2.5 py-1.5 flex-fill flex-lg-grow-0"
                    onClick={() => loadLedgerStatement()}
                    title="Refresh Statement"
                  >
                    <RefreshCw size={14} className={isLoadingLedger ? 'spin' : ''} /> <span className="d-none d-sm-inline">Reload</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm d-inline-flex align-items-center justify-content-center gap-1 shadow-xs fw-bold px-3 py-1.5 flex-fill flex-lg-grow-0"
                    onClick={handleExportLedgerExcel}
                    title="Export to Excel (.xlsx)"
                  >
                    <FileSpreadsheet size={15} /> Excel
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm d-inline-flex align-items-center justify-content-center gap-1 shadow-xs fw-bold px-3 py-1.5 flex-fill flex-lg-grow-0"
                    onClick={handleExportLedgerPDF}
                    title="Export to PDF"
                  >
                    <Download size={15} /> PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-dark btn-sm d-inline-flex align-items-center justify-content-center gap-1 shadow-xs px-2.5 py-1.5 flex-fill flex-lg-grow-0"
                    onClick={handlePrintLedger}
                    title="Print Ledger"
                  >
                    <Printer size={15} /> Print
                  </button>
                </div>
              </div>

              {/* Row B: Date Presets & Date Inputs */}
              <div className="col-12 pt-2 border-top">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                  {/* Preset Pills */}
                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                    <span className="small text-secondary fw-bold me-1 d-none d-sm-inline">
                      <Calendar size={13} className="me-1" /> Quick Presets:
                    </span>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm px-2 py-1"
                        onClick={() => setPresetRange('today')}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm px-2 py-1"
                        onClick={() => setPresetRange('yesterday')}
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm px-2 py-1"
                        onClick={() => setPresetRange('week')}
                      >
                        This Week
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm px-2 py-1"
                        onClick={() => setPresetRange('month')}
                      >
                        This Month
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm px-2 py-1"
                        onClick={() => setPresetRange('fy')}
                      >
                        This FY
                      </button>
                    </div>
                  </div>

                  {/* Date Input Pickers */}
                  <div className="d-flex align-items-center gap-1.5 w-100 w-md-auto justify-content-between justify-content-md-end">
                    <span className="small text-muted text-nowrap">From:</span>
                    <input
                      type="date"
                      className="form-control form-control-sm shadow-xs"
                      style={{ maxWidth: 140 }}
                      value={ledgerStartDate}
                      onChange={e => setLedgerStartDate(e.target.value)}
                    />
                    <span className="small text-muted text-nowrap">To:</span>
                    <input
                      type="date"
                      className="form-control form-control-sm shadow-xs"
                      style={{ maxWidth: 140 }}
                      value={ledgerEndDate}
                      onChange={e => setLedgerEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 5 KPI Summary Cards - Perfectly Proportioned Box Type */}
          {ledgerStatement && (
            <div className="row g-2 g-md-3">
              {/* Card 1: Opening Balance */}
              <div className="col-6 col-md-4 col-xl">
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100" style={{ borderTop: '3px solid #64748B' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                      Opening Balance
                    </span>
                    <span className={`badge ${ledgerStatement.openingBalanceType === 'Dr' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'} px-1.5 py-0.5`} style={{ fontSize: '0.65rem' }}>
                      {ledgerStatement.openingBalanceType}
                    </span>
                  </div>
                  <h5 className="fw-bold mb-0 text-dark fs-5">
                    ₹{ledgerStatement.openingBalance.toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1 text-truncate" style={{ fontSize: '0.68rem' }}>
                    As of {ledgerStatement.period.startDate || 'Start'}
                  </span>
                </div>
              </div>

              {/* Card 2: Period Debits */}
              <div className="col-6 col-md-4 col-xl">
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100" style={{ borderTop: '3px solid #2563EB' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                      કુલ આવ્યા / ઉધાર (Dr ⬇️)
                    </span>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                      Inflow
                    </span>
                  </div>
                  <h5 className="fw-bold mb-0 text-primary fs-5">
                    ₹{ledgerStatement.totalDebit.toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1 text-truncate" style={{ fontSize: '0.68rem' }}>
                    {ledgerStatement.transactions.filter(t => t.debit > 0).length} Debit Postings
                  </span>
                </div>
              </div>

              {/* Card 3: Period Credits */}
              <div className="col-6 col-md-4 col-xl">
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100" style={{ borderTop: '3px solid #16A34A' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                      કુલ ગયા / જમા (Cr ⬆️)
                    </span>
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                      Outflow
                    </span>
                  </div>
                  <h5 className="fw-bold mb-0 text-success fs-5">
                    ₹{ledgerStatement.totalCredit.toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1 text-truncate" style={{ fontSize: '0.68rem' }}>
                    {ledgerStatement.transactions.filter(t => t.credit > 0).length} Credit Postings
                  </span>
                </div>
              </div>

              {/* Card 4: Net Movement */}
              <div className="col-6 col-md-6 col-xl">
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100" style={{ borderTop: '3px solid #D97706' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                      ચોખ્ખો ફેરફાર (Net Change)
                    </span>
                    <span className="badge bg-light text-secondary border px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                      Activity
                    </span>
                  </div>
                  <h5 className={`fw-bold mb-0 fs-5 ${ledgerStatement.netChange >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {ledgerStatement.netChange >= 0 ? '+' : '-'}₹{Math.abs(ledgerStatement.netChange).toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1 text-truncate" style={{ fontSize: '0.68rem' }}>
                    Net change in period
                  </span>
                </div>
              </div>

              {/* Card 5: Closing Balance (Hero Card) */}
              <div className="col-12 col-md-6 col-xl">
                <div
                  className="card shadow-sm border rounded-3 p-2.5 h-100"
                  style={{
                    borderTop: '3px solid #7A1B28',
                    backgroundColor: '#FFF9F5',
                    borderColor: '#F5C6CB'
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase fw-bold" style={{ color: '#7A1B28', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                      Closing Balance (આખર બાકી)
                    </span>
                    <span className="badge text-white px-2 py-0.5 fw-bold" style={{ backgroundColor: '#7A1B28', fontSize: '0.68rem' }}>
                      {ledgerStatement.closingBalanceType}
                    </span>
                  </div>
                  <h4 className="fw-bold mb-0 text-dark fs-5">
                    ₹{ledgerStatement.closingBalance.toLocaleString()}
                  </h4>
                  <span className="small mt-1 fw-medium text-truncate" style={{ color: '#7A1B28', fontSize: '0.7rem' }}>
                    As of {ledgerStatement.period.endDate || 'Today'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Ledger Transactions Statement Table */}
          <div className="card shadow-sm border rounded-3 bg-white">
            <div className="card-header bg-white py-2.5 px-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold text-dark fs-6">
                  {ledgerStatement?.account.accountName || 'Account'} Statement
                </span>
                <span className="badge bg-light text-secondary border">
                  {filteredLedgerTx.length} Entries
                </span>
              </div>
              <div className="d-flex align-items-center gap-2 w-100 w-sm-auto">
                <div className="input-group input-group-sm w-100" style={{ maxWidth: 260 }}>
                  <span className="input-group-text bg-light border-end-0"><Search size={14} className="text-muted" /></span>
                  <input
                    type="text"
                    className="form-control form-control-sm border-start-0"
                    placeholder="Search voucher, narration..."
                    value={ledgerSearch}
                    onChange={e => setLedgerSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Scroll Hint Banner */}
            <div className="d-block d-md-none bg-light border-bottom px-3 py-1 text-secondary text-center small" style={{ fontSize: '0.72rem' }}>
              <Smartphone size={12} className="me-1" /> આડી સ્ક્રોલ કરીને તમામ વિગતો જોઈ શકો છો (Swipe horizontally)
            </div>

            <div className="table-responsive" style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '0.82rem', minWidth: 720 }}>
                <thead className="table-light sticky-top" style={{ zIndex: 10 }}>
                  <tr>
                    <th className="text-nowrap ps-3" style={{ width: '11%' }}>Date</th>
                    <th className="text-nowrap" style={{ width: '14%' }}>Voucher #</th>
                    <th style={{ width: '28%' }}>Particulars / Contra Account</th>
                    <th className="text-nowrap" style={{ width: '12%' }}>Ref Type</th>
                    <th className="text-end text-nowrap" style={{ width: '12%' }}>
                      <span className="badge bg-success-subtle text-success border border-success-subtle me-1" style={{ fontSize: '0.65rem' }}>⬇️ આવ્યા</span>
                      <span>ઉધાર (Dr)</span>
                    </th>
                    <th className="text-end text-nowrap" style={{ width: '12%' }}>
                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle me-1" style={{ fontSize: '0.65rem' }}>⬆️ ગયા</span>
                      <span>જમા (Cr)</span>
                    </th>
                    <th className="text-end text-nowrap pe-3" style={{ width: '13%' }}>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Balance Row */}
                  {ledgerStatement && (
                    <tr className="table-light fw-semibold">
                      <td className="ps-3 text-nowrap">{ledgerStatement.period.startDate}</td>
                      <td className="text-muted text-nowrap">-</td>
                      <td>
                        <div className="text-dark fw-bold">Opening Balance Brought Forward</div>
                        <small className="text-muted">શરૂઆતની બાકી લાવ્યા</small>
                      </td>
                      <td><span className="badge bg-secondary-subtle text-secondary border">OPENING</span></td>
                      <td className="text-end font-monospace text-primary">
                        {ledgerStatement.openingBalanceType === 'Dr' ? `₹${ledgerStatement.openingBalance.toLocaleString()}` : '-'}
                      </td>
                      <td className="text-end font-monospace text-success">
                        {ledgerStatement.openingBalanceType === 'Cr' ? `₹${ledgerStatement.openingBalance.toLocaleString()}` : '-'}
                      </td>
                      <td className="text-end font-monospace fw-bold pe-3" style={{ color: '#7A1B28' }}>
                        ₹{ledgerStatement.openingBalance.toLocaleString()} <span className="small text-muted">{ledgerStatement.openingBalanceType}</span>
                      </td>
                    </tr>
                  )}

                  {isLoadingLedger ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                        Loading ledger transactions...
                      </td>
                    </tr>
                  ) : filteredLedgerTx.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No transactions recorded in this date period.
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerTx.map((tx) => (
                      <tr key={tx.id}>
                        <td className="ps-3 text-nowrap text-secondary font-monospace" style={{ fontSize: '0.8rem' }}>
                          {tx.entryDate}
                        </td>
                        <td className="text-nowrap">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none font-monospace fw-bold text-primary"
                            style={{ fontSize: '0.8rem' }}
                            title="Click to view journal voucher slip"
                            onClick={() => {
                              const j = journals.find(x => x.entryNumber === tx.entryNumber);
                              if (j) setSelectedVoucherForSlip(j);
                            }}
                          >
                            {tx.entryNumber}
                          </button>
                        </td>
                        <td>
                          <div className="fw-bold text-dark text-truncate" style={{ maxWidth: 280 }} title={tx.particulars}>
                            {tx.particulars}
                          </div>
                          {tx.narration && (
                            <small className="text-muted d-block text-truncate" style={{ maxWidth: 280 }} title={tx.narration}>
                              {tx.narration}
                            </small>
                          )}
                        </td>
                        <td className="text-nowrap">
                          <span className="badge bg-light text-secondary border" style={{ fontSize: '0.68rem' }}>
                            {tx.referenceType || 'MANUAL'}
                          </span>
                          {tx.referenceId && (
                            <small className="text-muted ms-1 font-monospace" style={{ fontSize: '0.68rem' }}>
                              #{tx.referenceId}
                            </small>
                          )}
                        </td>
                        <td className="text-end font-monospace fw-bold text-nowrap" style={{ color: tx.debit > 0 ? '#1D4ED8' : '#94A3B8' }}>
                          {tx.debit > 0 ? `₹${tx.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-end font-monospace fw-bold text-nowrap" style={{ color: tx.credit > 0 ? '#15803D' : '#94A3B8' }}>
                          {tx.credit > 0 ? `₹${tx.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-end font-monospace fw-bold pe-3 text-nowrap" style={{ color: '#7A1B28' }}>
                          ₹{((tx as any).balance ?? tx.runningBalance ?? 0).toLocaleString()} <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>{tx.balanceType}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CHART OF ACCOUNTS (ખાતાવહી યાદી)                  */}
      {/* ======================================================== */}
      {activeTab === 'chart' && (
        <div className="d-flex flex-column gap-3">
          {/* Summary Strip - Responsive Cards */}
          <div className="row g-2">
            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center h-100">
                <span className="text-muted small fw-bold" style={{ fontSize: '0.68rem' }}>Total Accounts</span>
                <h6 className="fw-bold mb-0 text-dark fs-5">{accounts.length} Heads</h6>
              </div>
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center h-100" style={{ borderTop: '3px solid #2563EB' }}>
                <span className="text-primary small fw-bold" style={{ fontSize: '0.68rem' }}>Assets (મિલકતો)</span>
                <h6 className="fw-bold mb-0 text-primary fs-5">₹{coaSummary.assets.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center h-100" style={{ borderTop: '3px solid #D97706' }}>
                <span className="text-warning-emphasis small fw-bold" style={{ fontSize: '0.68rem' }}>Liabilities (દેવાં)</span>
                <h6 className="fw-bold mb-0 text-warning-emphasis fs-5">₹{coaSummary.liabilities.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center h-100" style={{ borderTop: '3px solid #475569' }}>
                <span className="text-dark small fw-bold" style={{ fontSize: '0.68rem' }}>Equity (મૂડી)</span>
                <h6 className="fw-bold mb-0 text-dark fs-5">₹{coaSummary.equity.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center h-100" style={{ borderTop: '3px solid #16A34A' }}>
                <span className="text-success small fw-bold" style={{ fontSize: '0.68rem' }}>Revenue (આવક)</span>
                <h6 className="fw-bold mb-0 text-success fs-5">₹{coaSummary.revenue.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center h-100" style={{ borderTop: '3px solid #DC2626' }}>
                <span className="text-danger small fw-bold" style={{ fontSize: '0.68rem' }}>Expenses (ખર્ચ)</span>
                <h6 className="fw-bold mb-0 text-danger fs-5">₹{coaSummary.expenses.toLocaleString()}</h6>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
              {/* Type Pills */}
              <div className="btn-group btn-group-sm flex-wrap" role="group">
                {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as CoaTypeFilter[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn ${coaTypeFilter === t ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setCoaTypeFilter(t)}
                  >
                    {t === 'ALL' ? 'All Accounts' : t}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="input-group input-group-sm w-100 w-md-auto" style={{ maxWidth: 280 }}>
                <span className="input-group-text bg-light border-end-0"><Search size={14} className="text-muted" /></span>
                <input
                  type="text"
                  className="form-control form-control-sm border-start-0"
                  placeholder="Search code, title..."
                  value={coaSearch}
                  onChange={e => setCoaSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Accounts List Table */}
          <div className="card shadow-sm border rounded-3 bg-white">
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '0.83rem', minWidth: 640 }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-3 text-nowrap" style={{ width: '13%' }}>Code</th>
                    <th style={{ width: '30%' }}>Account Title</th>
                    <th className="text-nowrap" style={{ width: '14%' }}>Type</th>
                    <th className="text-nowrap" style={{ width: '15%' }}>Sub-Type</th>
                    <th className="text-end text-nowrap" style={{ width: '15%' }}>Current Balance</th>
                    <th className="text-center text-nowrap pe-3" style={{ width: '13%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        No accounts match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <tr key={acc.id}>
                        <td className="ps-3 text-nowrap">
                          <span className="badge bg-light text-dark border font-monospace px-2 py-1">
                            {acc.accountCode}
                          </span>
                        </td>
                        <td>
                          <div className="fw-bold text-dark">{acc.accountName}</div>
                          {acc.description && <small className="text-muted">{acc.description}</small>}
                        </td>
                        <td className="text-nowrap">
                          <span
                            className={`badge ${
                              acc.accountType === 'ASSET'
                                ? 'bg-primary'
                                : acc.accountType === 'LIABILITY'
                                ? 'bg-warning text-dark'
                                : acc.accountType === 'REVENUE'
                                ? 'bg-success'
                                : acc.accountType === 'EXPENSE'
                                ? 'bg-danger'
                                : 'bg-dark'
                            }`}
                          >
                            {acc.accountType}
                          </span>
                        </td>
                        <td className="text-nowrap">
                          <span className="badge bg-light text-secondary border">
                            {acc.subType || '-'}
                          </span>
                        </td>
                        <td className="text-end font-monospace text-nowrap">
                          <span className="fw-bold fs-6">₹{acc.currentBalance.toLocaleString()}</span>{' '}
                          <span className="small text-muted">
                            {acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE' ? 'Dr' : 'Cr'}
                          </span>
                        </td>
                        <td className="text-center pe-3 text-nowrap">
                          <div className="d-inline-flex gap-1.5">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm py-1 px-2 d-inline-flex align-items-center gap-1"
                              title="View Ledger Statement"
                              onClick={() => {
                                setSelectedAccountId(acc.id);
                                setActiveTab('ledger');
                              }}
                            >
                              <BookOpen size={13} /> Ledger
                            </button>
                            {can('accounts.chart.edit') && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm py-1 px-2"
                                title="Edit Account"
                                onClick={() => {
                                  setEditingAccount(acc);
                                  setEditAccName(acc.accountName);
                                  setEditAccSubType(acc.subType || '');
                                  setEditAccDesc(acc.description || '');
                                  setEditAccIsActive(acc.isActive);
                                }}
                              >
                                <Edit size={13} />
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
      )}

      {/* ======================================================== */}
      {/* TAB 3: JOURNAL ENTRIES (જર્નલ વાઉચર્સ)                   */}
      {/* ======================================================== */}
      {activeTab === 'journal' && (
        <div className="d-flex flex-column gap-3">
          {/* Filter Bar */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-4">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><Search size={14} className="text-muted" /></span>
                  <input
                    type="text"
                    className="form-control form-control-sm border-start-0"
                    placeholder="Search voucher #, narration..."
                    value={journalSearch}
                    onChange={e => setJournalSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-12 col-md-5 d-flex align-items-center gap-1.5 flex-wrap">
                <span className="small text-muted text-nowrap">From:</span>
                <input
                  type="date"
                  className="form-control form-control-sm shadow-xs"
                  style={{ maxWidth: 140 }}
                  value={journalStartDate}
                  onChange={e => setJournalStartDate(e.target.value)}
                />
                <span className="small text-muted text-nowrap">To:</span>
                <input
                  type="date"
                  className="form-control form-control-sm shadow-xs"
                  style={{ maxWidth: 140 }}
                  value={journalEndDate}
                  onChange={e => setJournalEndDate(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => loadJournals()}
                >
                  <Filter size={13} className="me-1" /> Filter
                </button>
              </div>
              <div className="col-12 col-md-3 d-flex justify-content-md-end">
                {can('accounts.journal.create') && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 fw-bold w-100 w-md-auto justify-content-center"
                    onClick={() => {
                      setJournalNarration('');
                      setJournalDate(getTodayStr());
                      setJournalRefId('');
                      setIsJournalModalOpen(true);
                    }}
                  >
                    <Plus size={15} /> Post New Voucher
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Journal Entries Table */}
          <div className="card shadow-sm border rounded-3 bg-white">
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '0.82rem', minWidth: 680 }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-3 text-nowrap" style={{ width: '13%' }}>Voucher #</th>
                    <th className="text-nowrap" style={{ width: '11%' }}>Date</th>
                    <th style={{ width: '30%' }}>Narration / Particulars</th>
                    <th className="text-nowrap" style={{ width: '15%' }}>Reference</th>
                    <th className="text-end text-nowrap" style={{ width: '13%' }}>Total Amount</th>
                    <th className="text-center text-nowrap" style={{ width: '9%' }}>Status</th>
                    <th className="text-center text-nowrap pe-3" style={{ width: '9%' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingJournals ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                        Loading journal vouchers...
                      </td>
                    </tr>
                  ) : journals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No journal entries found.
                      </td>
                    </tr>
                  ) : (
                    journals.map((j) => (
                      <tr key={j.id}>
                        <td className="ps-3 text-nowrap">
                          <span className="fw-bold text-primary font-monospace">{j.entryNumber}</span>
                        </td>
                        <td className="text-nowrap">{j.entryDate}</td>
                        <td>
                          <div className="fw-bold text-dark">{j.narration}</div>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {j.items?.map((it, idx) => (
                              <span key={idx} className="badge bg-light text-dark border" style={{ fontSize: '0.68rem' }}>
                                {it.accountName}: {it.debit > 0 ? `Dr ₹${it.debit}` : `Cr ₹${it.credit}`}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-nowrap">
                          <span className="badge bg-light text-secondary border">
                            {j.referenceType || 'MANUAL'} {j.referenceId ? `#${j.referenceId}` : ''}
                          </span>
                        </td>
                        <td className="text-end fw-bold text-success fs-6 font-monospace text-nowrap">
                          ₹{j.totalDebit.toLocaleString()}
                        </td>
                        <td className="text-center text-nowrap">
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            {j.status || 'POSTED'}
                          </span>
                        </td>
                        <td className="text-center pe-3 text-nowrap">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm py-0.5 px-2"
                            title="View Voucher Slip"
                            onClick={() => setSelectedVoucherForSlip(j)}
                          >
                            <Eye size={13} className="me-1" /> Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: TRIAL BALANCE (કાચું સરવૈયું)                      */}
      {/* ======================================================== */}
      {activeTab === 'trialbalance' && (
        <div className="d-flex flex-column gap-3">
          {/* Trial Balance Control Bar */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
              <div className="d-flex align-items-center gap-2 flex-wrap w-100 w-md-auto">
                <label className="form-label small fw-bold text-dark mb-0 text-nowrap">As of Date (આ તારીખ સુધીનું):</label>
                <input
                  type="date"
                  className="form-control form-control-sm shadow-xs"
                  style={{ width: 140 }}
                  value={trialAsOfDate}
                  onChange={e => setTrialAsOfDate(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => loadTrialBalance(trialAsOfDate)}
                >
                  <RefreshCw size={13} className={`me-1 ${isLoadingTrialBalance ? 'spin' : ''}`} /> Refresh
                </button>
              </div>

              <div className="d-flex align-items-center gap-2 w-100 w-md-auto justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1 fw-bold"
                  onClick={handleExportTrialBalanceExcel}
                >
                  <FileSpreadsheet size={15} /> Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="card shadow-sm border rounded-3 bg-white">
            <div className="table-responsive">
              <table className="table table-hover table-bordered mb-0 align-middle" style={{ fontSize: '0.83rem', minWidth: 600 }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-3 text-nowrap" style={{ width: '12%' }}>Account Code</th>
                    <th style={{ width: '38%' }}>Account Head Title</th>
                    <th className="text-nowrap" style={{ width: '18%' }}>Account Group / Type</th>
                    <th className="text-end text-nowrap" style={{ width: '16%' }}>Debit Balance (₹ Dr)</th>
                    <th className="text-end text-nowrap pe-3" style={{ width: '16%' }}>Credit Balance (₹ Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTrialBalance ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                        Calculating Trial Balance...
                      </td>
                    </tr>
                  ) : !trialBalanceReport || trialBalanceReport.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No account balances found.
                      </td>
                    </tr>
                  ) : (
                    trialBalanceReport.rows.map(row => (
                      <tr key={row.id}>
                        <td className="ps-3 text-nowrap">
                          <span className="badge bg-light text-dark border font-monospace">
                            {row.accountCode}
                          </span>
                        </td>
                        <td className="fw-bold text-dark">{row.accountName}</td>
                        <td className="text-nowrap">
                          <span className="badge bg-light text-secondary border">
                            {row.accountType} {row.subType ? `• ${row.subType}` : ''}
                          </span>
                        </td>
                        <td className="text-end font-monospace fw-bold text-primary text-nowrap">
                          {row.debitBalance > 0 ? `₹${row.debitBalance.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-end font-monospace fw-bold text-success pe-3 text-nowrap">
                          {row.creditBalance > 0 ? `₹${row.creditBalance.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Grand Totals & Verification Row */}
                  {trialBalanceReport && (
                    <tr className="table-warning-subtle fw-bold fs-6 border-top border-2">
                      <td colSpan={3} className="text-uppercase ps-3">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <span>Total Trial Balance (કાચું સરવૈયું કુલ)</span>
                          {trialBalanceReport.isBalanced ? (
                            <span className="badge bg-success text-white d-inline-flex align-items-center gap-1 px-2.5 py-1">
                              <CheckCircle2 size={14} /> Books Balanced (સરભર)
                            </span>
                          ) : (
                            <span className="badge bg-danger text-white d-inline-flex align-items-center gap-1 px-2.5 py-1">
                              <AlertTriangle size={14} /> Unbalanced Variance
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-end font-monospace text-primary text-nowrap">
                        ₹{trialBalanceReport.grandDebit.toLocaleString()}
                      </td>
                      <td className="text-end font-monospace text-success pe-3 text-nowrap">
                        ₹{trialBalanceReport.grandCredit.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: FINANCIAL STATEMENTS (P&L & BALANCE SHEET)         */}
      {/* ======================================================== */}
      {activeTab === 'summary' && financialSummary && (
        <div className="d-flex flex-column gap-3">
          {/* Visual P&L Equation Card */}
          <div className="card shadow-sm border rounded-3 bg-white p-3 mb-2" style={{ borderLeft: '4px solid #16A34A' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 fw-bold" style={{ fontSize: '0.74rem' }}>
                💡 સરળ નફો-નુકસાન ગણતરી (Simple Profit & Loss Formula)
              </span>
              <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                આવકમાંથી તમામ ખર્ચ બાદ કરતાં વધતો ચોખ્ખો નફો
              </span>
            </div>
            <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-2 p-2.5 rounded-3 bg-light text-center">
              <div className="p-2 bg-white rounded-2 border flex-fill shadow-xs">
                <span className="text-success fw-bold small d-block" style={{ fontSize: '0.72rem' }}>૧. કુલ વેચાણ આવક</span>
                <h5 className="fw-bold text-success mb-0 mt-0.5 fs-6">₹{(financialSummary.profitAndLoss?.totalRevenue || 0).toLocaleString()}</h5>
              </div>
              <div className="fs-5 text-muted fw-bold align-self-center">➖</div>
              <div className="p-2 bg-white rounded-2 border flex-fill shadow-xs">
                <span className="text-danger fw-bold small d-block" style={{ fontSize: '0.72rem' }}>૨. કાચી સામગ્રી ખર્ચ (COGS)</span>
                <h5 className="fw-bold text-danger mb-0 mt-0.5 fs-6">₹{(financialSummary.profitAndLoss?.totalCOGS || 0).toLocaleString()}</h5>
              </div>
              <div className="fs-5 text-muted fw-bold align-self-center">➖</div>
              <div className="p-2 bg-white rounded-2 border flex-fill shadow-xs">
                <span className="text-warning-emphasis fw-bold small d-block" style={{ fontSize: '0.72rem' }}>૩. અન્ય ખર્ચ (પગાર, લાઈટ, ભાડું)</span>
                <h5 className="fw-bold text-warning-emphasis mb-0 mt-0.5 fs-6">₹{(financialSummary.profitAndLoss?.totalOperatingExpense || 0).toLocaleString()}</h5>
              </div>
              <div className="fs-5 text-muted fw-bold align-self-center">🟰</div>
              <div
                className="p-2 rounded-2 border flex-fill text-white shadow-xs"
                style={{ backgroundColor: (financialSummary.profitAndLoss?.netProfit || 0) >= 0 ? '#15803D' : '#DC2626' }}
              >
                <span className="fw-bold small d-block text-white-50" style={{ fontSize: '0.72rem' }}>૪. ચોખ્ખો નફો (Net Profit)</span>
                <h5 className="fw-bold text-white mb-0 mt-0.5 fs-6">₹{(financialSummary.profitAndLoss?.netProfit || 0).toLocaleString()}</h5>
              </div>
            </div>
          </div>

          {/* P&L 4 Metric Cards */}
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100" style={{ borderTop: '3px solid #16A34A' }}>
                <span className="small text-uppercase text-muted fw-bold">Total Sales Revenue</span>
                <h4 className="fw-bold text-success mt-1">₹{(financialSummary.profitAndLoss?.totalRevenue || 0).toLocaleString()}</h4>
                <span className="text-muted small">Food & Dining Collections</span>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100" style={{ borderTop: '3px solid #DC2626' }}>
                <span className="small text-uppercase text-muted fw-bold">Cost of Goods Sold (COGS)</span>
                <h4 className="fw-bold text-danger mt-1">₹{(financialSummary.profitAndLoss?.totalCOGS || 0).toLocaleString()}</h4>
                <span className="text-muted small">Provisions & Ingredients</span>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100" style={{ borderTop: '3px solid #D97706' }}>
                <span className="small text-uppercase text-muted fw-bold">Operating Expenses (OPEX)</span>
                <h4 className="fw-bold text-warning-emphasis mt-1">₹{(financialSummary.profitAndLoss?.totalOperatingExpense || 0).toLocaleString()}</h4>
                <span className="text-muted small">Rent, Electricity, Salaries</span>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100" style={{ borderTop: '3px solid #7A1B28' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-uppercase text-muted fw-bold">Net Operating Income</span>
                  <span className="badge bg-primary-subtle text-primary fw-bold">
                    Margin: {financialSummary.profitAndLoss?.profitMarginPercentage || 0}%
                  </span>
                </div>
                <h4 className={`fw-bold mt-1 ${(financialSummary.profitAndLoss?.netProfit || 0) >= 0 ? 'text-primary' : 'text-danger'}`}>
                  ₹{(financialSummary.profitAndLoss?.netProfit || 0).toLocaleString()}
                </h4>
                <span className="text-muted small">Net Restaurant Earnings</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Snapshot Card */}
          {financialSummary.balanceSheet && (
            <div className="card shadow-sm border rounded-3 bg-white p-3">
              <h6 className="fw-bold text-dark mb-3">Balance Sheet Equilibrium Snapshot (મિલકતો અને દેવાં સરવૈયું)</h6>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3">
                    <span className="text-muted small fw-bold">Total Assets (મિલકતો)</span>
                    <h5 className="fw-bold text-primary mt-1">₹{financialSummary.balanceSheet.totalAssets.toLocaleString()}</h5>
                    <span className="small text-secondary">Cash in drawer, Bank, Stock</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3">
                    <span className="text-muted small fw-bold">Total Liabilities (દેવાં)</span>
                    <h5 className="fw-bold text-warning-emphasis mt-1">₹{financialSummary.balanceSheet.totalLiabilities.toLocaleString()}</h5>
                    <span className="small text-secondary">Vendor payables, GST payable</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3">
                    <span className="text-muted small fw-bold">Total Equity & Capital (મૂડી)</span>
                    <h5 className="fw-bold text-dark mt-1">₹{financialSummary.balanceSheet.totalEquity.toLocaleString()}</h5>
                    <span className="small text-secondary">Owner capital & retained earnings</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: DAY CLOSING REGISTER (રોજમેળ બંધ)                  */}
      {/* ======================================================== */}
      {activeTab === 'dayclosing' && (
        <DataTable<DayClosing>
          columns={[
            { header: 'Closing Date', accessor: 'closingDate', width: 120 },
            { header: 'Opening Cash', accessor: (row) => `₹${row.openingCash.toLocaleString()}` },
            { header: 'Total Sales', accessor: (row) => <span className="fw-bold text-success">₹${row.totalSales.toLocaleString()}</span> },
            { header: 'Cash Collected', accessor: (row) => `₹${row.cashSales.toLocaleString()}` },
            { header: 'UPI & Card', accessor: (row) => `₹${(row.upiSales + row.cardSales).toLocaleString()}` },
            { header: 'Expenses', accessor: (row) => `₹${row.cashExpenses.toLocaleString()}` },
            { header: 'Actual Cash Counted', accessor: (row) => <span className="fw-bold">₹${row.actualCash.toLocaleString()}</span> },
            {
              header: 'Cash Variance',
              accessor: (row) => (
                <span className={`badge ${row.cashDifference === 0 ? 'bg-success' : row.cashDifference > 0 ? 'bg-info' : 'bg-danger'}`}>
                  {row.cashDifference === 0 ? 'Balanced' : `₹${row.cashDifference.toLocaleString()}`}
                </span>
              )
            }
          ]}
          data={dayClosings}
          searchPlaceholder="Search closing date..."
        />
      )}

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* MODAL 1: ADD NEW ACCOUNT HEAD */}
      <Modal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        title="Add New Account Head (નવું ખાતું બનાવો)"
      >
        <form onSubmit={handleCreateAccount} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-12 col-sm-4">
              <label className="form-label small fw-bold">Account Code</label>
              <input
                type="text"
                className="form-control form-control-sm font-monospace"
                required
                value={newAccCode}
                onChange={e => setNewAccCode(e.target.value)}
              />
            </div>
            <div className="col-12 col-sm-8">
              <label className="form-label small fw-bold">Account Title / Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. HDFC Bank Current Account"
                required
                value={newAccName}
                onChange={e => setNewAccName(e.target.value)}
              />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold">Account Type</label>
              <select
                className="form-select form-select-sm"
                value={newAccType}
                onChange={e => setNewAccType(e.target.value as any)}
              >
                <option value="ASSET">ASSET (મિલકત)</option>
                <option value="LIABILITY">LIABILITY (દેવું)</option>
                <option value="EQUITY">EQUITY (મૂડી)</option>
                <option value="REVENUE">REVENUE (આવક)</option>
                <option value="EXPENSE">EXPENSE (ખર્ચ)</option>
              </select>
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold">Sub-Type Category</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. BANK, CASH, CURRENT_ASSET"
                value={newAccSubType}
                onChange={e => setNewAccSubType(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label small fw-bold">Initial Opening Balance (₹)</label>
            <input
              type="number"
              className="form-control form-control-sm"
              placeholder="0.00"
              value={newAccOpeningBal || ''}
              onChange={e => setNewAccOpeningBal(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="form-label small fw-bold">Description / Purpose (Optional)</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              placeholder="Short note describing this account..."
              value={newAccDesc}
              onChange={e => setNewAccDesc(e.target.value)}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAddAccountModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Create Account Head</button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT ACCOUNT HEAD */}
      <Modal
        isOpen={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        title={`Edit Account: [${editingAccount?.accountCode || ''}]`}
      >
        {editingAccount && (
          <form onSubmit={handleUpdateAccount} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label small fw-bold">Account Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                required
                value={editAccName}
                onChange={e => setEditAccName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label small fw-bold">Sub-Type</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={editAccSubType}
                onChange={e => setEditAccSubType(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label small fw-bold">Description</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={editAccDesc}
                onChange={e => setEditAccDesc(e.target.value)}
              />
            </div>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="editAccActive"
                checked={editAccIsActive}
                onChange={e => setEditAccIsActive(e.target.checked)}
              />
              <label className="form-check-label small fw-bold" htmlFor="editAccActive">
                Account is Active
              </label>
            </div>
            <div className="d-flex justify-content-end gap-2 pt-3 border-top">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingAccount(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm fw-bold">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: POST JOURNAL VOUCHER (Multi-Row Auto-Balanced) */}
      <Modal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        title="Post Double-Entry Journal Voucher (જર્નલ વાઉચર એન્ટ્રી)"
        size="lg"
      >
        <form onSubmit={handlePostJournalVoucher} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-12 col-sm-4">
              <label className="form-label small fw-bold">Voucher Date</label>
              <input
                type="date"
                required
                className="form-control form-control-sm"
                value={journalDate}
                onChange={e => setJournalDate(e.target.value)}
              />
            </div>
            <div className="col-12 col-sm-4">
              <label className="form-label small fw-bold">Reference Type</label>
              <select
                className="form-select form-select-sm"
                value={journalRefType}
                onChange={e => setJournalRefType(e.target.value)}
              >
                <option value="MANUAL">MANUAL (સામાન્ય વાઉચર)</option>
                <option value="CONTRA">CONTRA (બેંક-રોકડ ટ્રાન્સફર)</option>
                <option value="PURCHASE">PURCHASE (ખરીદી)</option>
                <option value="EXPENSE">EXPENSE (ખર્ચ)</option>
                <option value="SALES">SALES (વેચાણ)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (સુધારો)</option>
              </select>
            </div>
            <div className="col-12 col-sm-4">
              <label className="form-label small fw-bold">Reference Doc #</label>
              <input
                type="text"
                className="form-control form-control-sm font-monospace"
                placeholder="Bill # or PO #"
                value={journalRefId}
                onChange={e => setJournalRefId(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label small fw-bold">Voucher Narration (લખાણ / વર્ણન)</label>
            <input
              type="text"
              required
              className="form-control form-control-sm"
              placeholder="e.g. Cash withdrawn from Bank for daily expenses"
              value={journalNarration}
              onChange={e => setJournalNarration(e.target.value)}
            />
          </div>

          {/* Dynamic Lines Table */}
          <div className="border rounded-3 p-2 bg-light">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small fw-bold text-dark">Debit & Credit Entry Lines</span>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm py-0.5 px-2"
                onClick={handleAddJournalLine}
              >
                <Plus size={13} className="me-1" /> Add Line
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-sm table-bordered bg-white mb-1 align-middle" style={{ fontSize: '0.8rem', minWidth: 500 }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '45%' }}>Account Head</th>
                    <th style={{ width: '25%' }}>Debit Amount (₹ Dr)</th>
                    <th style={{ width: '25%' }}>Credit Amount (₹ Cr)</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {journalItems.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          required
                          value={item.accountId}
                          onChange={e => handleUpdateJournalLine(index, 'accountId', e.target.value)}
                        >
                          <option value="">-- Select Account --</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              [{acc.accountCode}] {acc.accountName} ({acc.accountType})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="form-control form-control-sm font-monospace"
                          placeholder="0.00"
                          value={item.debit || ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateJournalLine(index, 'debit', val);
                            if (val > 0) handleUpdateJournalLine(index, 'credit', 0);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="form-control form-control-sm font-monospace"
                          placeholder="0.00"
                          value={item.credit || ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateJournalLine(index, 'credit', val);
                            if (val > 0) handleUpdateJournalLine(index, 'debit', 0);
                          }}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm p-1 border-0"
                          onClick={() => handleRemoveJournalLine(index)}
                          title="Remove Line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Auto-Balancing Indicator Strip */}
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center p-2 rounded-2 mt-2 bg-white border">
              <div className="d-flex align-items-center gap-3">
                <span className="small">
                  Total Debits: <strong className="text-primary font-monospace">₹{journalTotals.debitSum.toLocaleString()}</strong>
                </span>
                <span className="small">
                  Total Credits: <strong className="text-success font-monospace">₹{journalTotals.creditSum.toLocaleString()}</strong>
                </span>
              </div>
              <div>
                {journalTotals.isBalanced ? (
                  <span className="badge bg-success d-inline-flex align-items-center gap-1 px-2 py-1">
                    <CheckCircle2 size={13} /> Balanced (Dr = Cr)
                  </span>
                ) : (
                  <span className="badge bg-danger d-inline-flex align-items-center gap-1 px-2 py-1">
                    <AlertTriangle size={13} /> Difference: ₹{journalTotals.diff.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-2 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsJournalModalOpen(false)}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary btn-sm fw-bold"
              disabled={!journalTotals.isBalanced}
            >
              Post Balanced Voucher
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: VIEW VOUCHER SLIP */}
      <Modal
        isOpen={!!selectedVoucherForSlip}
        onClose={() => setSelectedVoucherForSlip(null)}
        title={`Voucher Slip: #${selectedVoucherForSlip?.entryNumber || ''}`}
      >
        {selectedVoucherForSlip && (
          <div className="d-flex flex-column gap-3">
            <div className="p-3 border rounded-3 bg-light text-center">
              <h5 className="fw-bold mb-0" style={{ color: '#7A1B28' }}>BHATIGAL BHANU</h5>
              <div className="text-muted small">Double-Entry Journal Voucher</div>
              <div className="mt-2 font-monospace fw-bold fs-6">{selectedVoucherForSlip.entryNumber}</div>
              <div className="small text-secondary">Date: {selectedVoucherForSlip.entryDate} | Ref: {selectedVoucherForSlip.referenceType || 'MANUAL'} {selectedVoucherForSlip.referenceId ? `#${selectedVoucherForSlip.referenceId}` : ''}</div>
            </div>

            <div>
              <div className="small text-muted mb-1">Narration:</div>
              <div className="p-2 border rounded-2 bg-white fw-semibold text-dark">
                {selectedVoucherForSlip.narration}
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-sm table-bordered bg-white mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
                <thead className="table-light">
                  <tr>
                    <th>Account Title</th>
                    <th className="text-end" style={{ width: '30%' }}>Debit (₹ Dr)</th>
                    <th className="text-end" style={{ width: '30%' }}>Credit (₹ Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVoucherForSlip.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="fw-bold">{it.accountName}</div>
                        {it.description && <small className="text-muted">{it.description}</small>}
                      </td>
                      <td className="text-end font-monospace text-primary fw-bold">
                        {it.debit > 0 ? `₹${it.debit.toLocaleString()}` : '-'}
                      </td>
                      <td className="text-end font-monospace text-success fw-bold">
                        {it.credit > 0 ? `₹${it.credit.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="table-light fw-bold">
                    <td>TOTAL</td>
                    <td className="text-end font-monospace text-primary">₹{selectedVoucherForSlip.totalDebit.toLocaleString()}</td>
                    <td className="text-end font-monospace text-success">₹{selectedVoucherForSlip.totalCredit.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center pt-2 border-top">
              <span className="small text-muted">Created by: {(selectedVoucherForSlip as any).createdByName || (selectedVoucherForSlip as any).createdBy || 'System'}</span>
              <button
                type="button"
                className="btn btn-outline-dark btn-sm d-inline-flex align-items-center gap-1"
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print Slip
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 5: EXECUTE DAY CLOSING */}
      <Modal
        isOpen={isDayClosingModalOpen}
        onClose={() => setIsDayClosingModalOpen(false)}
        title="Execute Day Closing (દૈનિક રોજમેળ બંધ કરો)"
        size="lg"
      >
        <form onSubmit={handleExecuteDayClosing} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold">Closing Date</label>
              <input
                type="date"
                required
                className="form-control form-control-sm"
                value={closingDate}
                onChange={e => setClosingDate(e.target.value)}
              />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold">Total Physical Cash in Drawer (₹)</label>
              <input
                type="number"
                step="any"
                required
                className="form-control form-control-sm font-monospace fs-6 fw-bold"
                value={countedCash || ''}
                onChange={e => setCountedCash(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Physical Currency Denominations Box */}
          <div className="border rounded-3 p-3 bg-light">
            <h6 className="fw-bold mb-2 small text-dark">Physical Currency Denomination Counter (ચલણી નોટોની ગણતરી)</h6>
            <div className="row g-2">
              <div className="col-6 col-sm-4 col-md-3">
                <label className="small text-muted mb-0">₹500 Notes</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={denominations['500'] || ''}
                  onChange={e => setDenominations({ ...denominations, '500': parseInt(e.target.value) || 0 })}
                />
                <small className="text-secondary font-monospace">= ₹{(denominations['500'] || 0) * 500}</small>
              </div>
              <div className="col-6 col-sm-4 col-md-3">
                <label className="small text-muted mb-0">₹200 Notes</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={denominations['200'] || ''}
                  onChange={e => setDenominations({ ...denominations, '200': parseInt(e.target.value) || 0 })}
                />
                <small className="text-secondary font-monospace">= ₹{(denominations['200'] || 0) * 200}</small>
              </div>
              <div className="col-6 col-sm-4 col-md-3">
                <label className="small text-muted mb-0">₹100 Notes</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={denominations['100'] || ''}
                  onChange={e => setDenominations({ ...denominations, '100': parseInt(e.target.value) || 0 })}
                />
                <small className="text-secondary font-monospace">= ₹{(denominations['100'] || 0) * 100}</small>
              </div>
              <div className="col-6 col-sm-4 col-md-3">
                <label className="small text-muted mb-0">₹50 Notes</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={denominations['50'] || ''}
                  onChange={e => setDenominations({ ...denominations, '50': parseInt(e.target.value) || 0 })}
                />
                <small className="text-secondary font-monospace">= ₹{(denominations['50'] || 0) * 50}</small>
              </div>
              <div className="col-6 col-sm-4 col-md-3">
                <label className="small text-muted mb-0">₹20 Notes</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={denominations['20'] || ''}
                  onChange={e => setDenominations({ ...denominations, '20': parseInt(e.target.value) || 0 })}
                />
                <small className="text-secondary font-monospace">= ₹{(denominations['20'] || 0) * 20}</small>
              </div>
              <div className="col-6 col-sm-4 col-md-3">
                <label className="small text-muted mb-0">₹10 Notes</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={denominations['10'] || ''}
                  onChange={e => setDenominations({ ...denominations, '10': parseInt(e.target.value) || 0 })}
                />
                <small className="text-secondary font-monospace">= ₹{(denominations['10'] || 0) * 10}</small>
              </div>
              <div className="col-12 col-sm-4 col-md-6">
                <label className="small text-muted mb-0">Coins / Other Cash (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={denominations['coins'] || ''}
                  onChange={e => setDenominations({ ...denominations, 'coins': parseInt(e.target.value) || 0 })}
                />
                <small className="text-secondary font-monospace">= ₹{denominations['coins'] || 0}</small>
              </div>
            </div>

            <div className="mt-2 text-end">
              <span className="fw-bold small text-dark">Denominations Calculated Total: </span>
              <span className="fw-bold fs-6 text-primary font-monospace">₹{totalDenominationCash.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <label className="form-label small fw-bold">Manager Closing Notes (Optional)</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              placeholder="e.g. Cash counted, verified and deposited into safe drop box"
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
    </div>
  );
};

export default AccountsPage;
