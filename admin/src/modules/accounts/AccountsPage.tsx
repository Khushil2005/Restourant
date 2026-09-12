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
  Filter
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
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');

  // 5. Printable slip ref
  const printSlipRef = useRef<HTMLDivElement>(null);

  // Load Base Chart of Accounts
  const loadAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const res: any = await apiClient.get('/accounts/chart');
      if (res?.success && Array.isArray(res.data)) {
        setAccounts(res.data);
        // Default select first cash/bank account if none selected
        if (!selectedAccountId && res.data.length > 0) {
          const defaultAcc = res.data.find((a: any) => a.id === 'acc_cash_drawer') || res.data[0];
          setSelectedAccountId(defaultAcc.id);
        }
      }
    } catch (err) {
      console.error('Failed to load chart of accounts:', err);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  // Load Ledger Statement for Selected Account
  const loadLedgerStatement = async (accId = selectedAccountId, sDate = ledgerStartDate, eDate = ledgerEndDate) => {
    if (!accId) return;
    try {
      setIsLoadingLedger(true);
      const params: any = { accountId: accId };
      if (sDate) params.startDate = sDate;
      if (eDate) params.endDate = eDate;
      const res: any = await apiClient.get('/accounts/ledger', { params });
      if (res?.success) {
        setLedgerStatement(res.data);
      }
    } catch (err) {
      console.error('Failed to load ledger statement:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Load Trial Balance
  const loadTrialBalance = async (asOf = trialAsOfDate) => {
    try {
      setIsLoadingTrialBalance(true);
      const res: any = await apiClient.get('/accounts/trial-balance', { params: { asOfDate: asOf } });
      if (res?.success) {
        setTrialBalanceReport(res.data);
      }
    } catch (err) {
      console.error('Failed to load trial balance:', err);
    } finally {
      setIsLoadingTrialBalance(false);
    }
  };

  // Load Journal Entries
  const loadJournals = async () => {
    try {
      setIsLoadingJournals(true);
      const params: any = {};
      if (journalSearch) params.search = journalSearch;
      if (journalStartDate) params.startDate = journalStartDate;
      if (journalEndDate) params.endDate = journalEndDate;
      const res: any = await apiClient.get('/accounts/journal', { params });
      if (res?.success) {
        setJournals(res.data);
      }
    } catch (err) {
      console.error('Failed to load journals:', err);
    } finally {
      setIsLoadingJournals(false);
    }
  };

  // Load Day Closings & Financial Summary
  const loadOtherData = async () => {
    try {
      const [dRes, sRes]: any = await Promise.all([
        can('accounts.dayclosing.view') ? apiClient.get('/accounts/day-closing').catch(() => null) : null,
        (can('accounts.dashboard.view') || can('accounts.report.view')) ? apiClient.get('/accounts/financial-summary').catch(() => null) : null
      ]);
      if (dRes?.success) setDayClosings(dRes.data);
      if (sRes?.success) setFinancialSummary(sRes.data);
    } catch (err) {
      console.error('Failed to load secondary accounting data:', err);
    }
  };

  // Initial Load
  useEffect(() => {
    loadAccounts();
    loadOtherData();
  }, []);

  // When active tab changes, fetch its data
  useEffect(() => {
    if (activeTab === 'ledger' && selectedAccountId) {
      loadLedgerStatement();
    } else if (activeTab === 'journal') {
      loadJournals();
    } else if (activeTab === 'trialbalance') {
      loadTrialBalance();
    } else if (activeTab === 'chart') {
      loadAccounts();
    } else if (activeTab === 'summary' || activeTab === 'dayclosing') {
      loadOtherData();
    }
  }, [activeTab]);

  // When selected account or date range changes in ledger
  useEffect(() => {
    if (activeTab === 'ledger' && selectedAccountId) {
      loadLedgerStatement(selectedAccountId, ledgerStartDate, ledgerEndDate);
    }
  }, [selectedAccountId, ledgerStartDate, ledgerEndDate]);

  // --- JOURNAL CALCULATION & AUTO-BALANCING ---
  const journalTotals = useMemo(() => {
    const debitSum = journalItems.reduce((s, it) => s + (Number(it.debit) || 0), 0);
    const creditSum = journalItems.reduce((s, it) => s + (Number(it.credit) || 0), 0);
    const diff = Math.abs(debitSum - creditSum);
    const isBalanced = diff < 0.01 && debitSum > 0;
    return { debitSum, creditSum, diff, isBalanced };
  }, [journalItems]);

  // --- EXPORT TO EXCEL: LEDGER STATEMENT ---
  const handleExportLedgerExcel = () => {
    if (!ledgerStatement) {
      alert('No ledger statement to export.');
      return;
    }
    const acc = ledgerStatement.account;
    const sheetData: any[] = [
      { A: 'BHATIGAL BHANU RESTAURANT - ACCOUNT LEDGER STATEMENT' },
      { A: `Account: ${acc.accountCode} - ${acc.accountName} (${acc.accountType})` },
      { A: `Statement Period: ${ledgerStatement.period.startDate || 'Beginning'} to ${ledgerStatement.period.endDate || 'Today'}` },
      { A: `Opening Balance: Rs. ${ledgerStatement.openingBalance.toLocaleString()} ${ledgerStatement.openingBalanceType}` },
      { A: `Closing Balance: Rs. ${ledgerStatement.closingBalance.toLocaleString()} ${ledgerStatement.closingBalanceType}` },
      {},
      {
        A: 'Date',
        B: 'Voucher #',
        C: 'Particulars / Counter Account',
        D: 'Reference Type',
        E: 'Ref #',
        F: 'Narration',
        G: 'Debit (Dr Rs.)',
        H: 'Credit (Cr Rs.)',
        I: 'Running Balance (Rs.)',
        J: 'Dr/Cr'
      }
    ];

    ledgerStatement.transactions.forEach(tx => {
      sheetData.push({
        A: tx.entryDate,
        B: tx.entryNumber,
        C: tx.particulars,
        D: tx.referenceType || 'MANUAL',
        E: tx.referenceId || '',
        F: tx.narration,
        G: tx.debit > 0 ? tx.debit : '',
        H: tx.credit > 0 ? tx.credit : '',
        I: tx.runningBalance,
        J: tx.balanceType
      });
    });

    sheetData.push({});
    sheetData.push({
      A: 'TOTALS',
      G: ledgerStatement.totalDebit,
      H: ledgerStatement.totalCredit,
      I: ledgerStatement.closingBalance,
      J: ledgerStatement.closingBalanceType
    });

    const worksheet = XLSX.utils.json_to_sheet(sheetData, { skipHeader: true });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger_Statement');
    const fileName = `Ledger_${acc.accountCode}_${acc.accountName.replace(/[^a-zA-Z0-9]/g, '_')}_${ledgerStartDate}_to_${ledgerEndDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // --- EXPORT TO PDF: LEDGER STATEMENT ---
  const handleExportLedgerPDF = () => {
    if (!ledgerStatement) {
      alert('No ledger statement to export.');
      return;
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const acc = ledgerStatement.account;

    // Header Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(122, 27, 40); // Maroon
    doc.text('BHATIGAL BHANU RESTAURANT', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Traditional Kathiyawadi & Gujarati Dining â€¢ Enterprise Financial Books', pageWidth / 2, 19, { align: 'center' });

    // Document Title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('ACCOUNT LEDGER STATEMENT', pageWidth / 2, 26, { align: 'center' });

    // Account Details Box
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 245, 238); // Cream background
    doc.roundedRect(14, 30, pageWidth - 28, 22, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Account: [${acc.accountCode}] ${acc.accountName}`, 18, 36);

    doc.setFont('helvetica', 'normal');
    doc.text(`Account Type: ${acc.accountType} (${acc.subType || 'General'})`, 18, 42);
    doc.text(`Period: ${ledgerStartDate} to ${ledgerEndDate}`, 18, 48);

    doc.setFont('helvetica', 'bold');
    doc.text(`Opening Balance: Rs. ${ledgerStatement.openingBalance.toLocaleString()} ${ledgerStatement.openingBalanceType}`, pageWidth - 18, 36, { align: 'right' });
    doc.text(`Closing Balance: Rs. ${ledgerStatement.closingBalance.toLocaleString()} ${ledgerStatement.closingBalanceType}`, pageWidth - 18, 42, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Net Period Movement: Rs. ${ledgerStatement.netChange.toLocaleString()}`, pageWidth - 18, 48, { align: 'right' });

    // Transactions Table
    const tableRows = ledgerStatement.transactions.map(tx => [
      tx.entryDate,
      tx.entryNumber,
      tx.particulars,
      tx.narration || '-',
      tx.debit > 0 ? `Rs. ${tx.debit.toLocaleString()}` : '-',
      tx.credit > 0 ? `Rs. ${tx.credit.toLocaleString()}` : '-',
      `Rs. ${tx.runningBalance.toLocaleString()} ${tx.balanceType}`
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['Date', 'Voucher #', 'Particulars', 'Narration', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [122, 27, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 26 },
        2: { cellWidth: 40 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
      },
      foot: [[
        'Total Movement',
        '',
        '',
        '',
        `Rs. ${ledgerStatement.totalDebit.toLocaleString()}`,
        `Rs. ${ledgerStatement.totalCredit.toLocaleString()}`,
        `Rs. ${ledgerStatement.closingBalance.toLocaleString()} ${ledgerStatement.closingBalanceType}`
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 }
    });

    const fileName = `Ledger_${acc.accountCode}_${acc.accountName.replace(/[^a-zA-Z0-9]/g, '_')}_${ledgerStartDate}.pdf`;
    doc.save(fileName);
  };

  // --- EXPORT TRIAL BALANCE TO EXCEL ---
  const handleExportTrialBalanceExcel = () => {
    if (!trialBalanceReport) return;
    const sheetData: any[] = [
      { A: 'BHATIGAL BHANU RESTAURANT - TRIAL BALANCE' },
      { A: `As of Date: ${trialBalanceReport.asOfDate}` },
      { A: `Status: ${trialBalanceReport.isBalanced ? 'Balanced' : 'Unbalanced Variance Detected'}` },
      {},
      { A: 'Account Code', B: 'Account Name', C: 'Account Type', D: 'Debit Balance (Rs.)', E: 'Credit Balance (Rs.)' }
    ];

    trialBalanceReport.rows.forEach(r => {
      sheetData.push({
        A: r.accountCode,
        B: r.accountName,
        C: r.accountType,
        D: r.debitBalance > 0 ? r.debitBalance : '',
        E: r.creditBalance > 0 ? r.creditBalance : ''
      });
    });

    sheetData.push({});
    sheetData.push({
      A: 'GRAND TOTALS',
      D: trialBalanceReport.grandDebit,
      E: trialBalanceReport.grandCredit
    });

    const worksheet = XLSX.utils.json_to_sheet(sheetData, { skipHeader: true });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trial_Balance');
    XLSX.writeFile(workbook, `Trial_Balance_${trialBalanceReport.asOfDate}.xlsx`);
  };

  // --- PRINT LEDGER STATEMENT ---
  const handlePrintLedger = () => {
    window.print();
  };

  // --- CREATE NEW ACCOUNT HEAD ---
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode || !newAccName) {
      alert('Account code and account name are required.');
      return;
    }
    try {
      const res: any = await apiClient.post('/accounts/chart', {
        accountCode: newAccCode.trim(),
        accountName: newAccName.trim(),
        accountType: newAccType,
        subType: newAccSubType,
        openingBalance: Number(newAccOpeningBal || 0),
        description: newAccDesc
      });
      if (res?.success) {
        alert(`Account head "${newAccName}" created successfully!`);
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
        setJournalRefId('');
        setJournalItems([
          { accountId: accounts[0]?.id || '', debit: 0, credit: 0, description: '' },
          { accountId: accounts[1]?.id || '', debit: 0, credit: 0, description: '' }
        ]);
        loadJournals();
        loadAccounts();
        if (selectedAccountId) loadLedgerStatement();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post journal voucher.');
    }
  };

  // --- EXECUTE DAY CLOSING ---
  const handleExecuteDayClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/accounts/day-closing', {
        actualCash: actualCashInput,
        notes: closingNotes,
        closingDate: getTodayStr()
      });
      alert('Day Closing executed and shift finalized successfully!');
      setIsDayClosingModalOpen(false);
      loadOtherData();
    } catch (err: any) {
      alert(err.message || 'Day closing failed.');
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

  return (
    <div className="d-flex flex-column gap-3 p-1 p-md-2" style={{ fontSize: '0.85rem' }}>
      {/* 1. TOP HEADER BAR: Box Type Layout */}
      <div className="card shadow-sm border rounded-3 mb-1 bg-white">
        <div className="card-body p-3 px-sm-3.5 py-sm-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
          <div className="d-flex align-items-center gap-3">
            {/* Header Icon Box */}
            <div
              className="bg-primary-subtle text-primary border border-primary-subtle rounded-3 d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
              style={{ width: 44, height: 44 }}
            >
              <BookOpen size={22} className="text-primary" />
            </div>

            {/* Title & Metadata Badges */}
            <div className="d-flex flex-column">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h6 className="fw-bold mb-0 text-dark fs-6">
                  Account & Ledger Management
                </h6>
                <span className="badge bg-light text-secondary border px-2 py-0.5 rounded-pill fw-medium" style={{ fontSize: '0.72rem' }}>
                  àª¨àª¾àª®àª¾ àª–àª¾àª¤àª¾àªµàª¹à«€ àª…àª¨à«‡ àª¹àª¿àª¸àª¾àª¬
                </span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill fw-bold" style={{ fontSize: '0.72rem' }}>
                  Double-Entry Central System
                </span>
              </div>
              <div className="text-muted small mt-1" style={{ fontSize: '0.74rem' }}>
                Chart of accounts, real-time ledger statements, balanced journal vouchers, trial balance & day closing
              </div>
            </div>
          </div>

          {/* Action Buttons Box */}
          <div className="d-flex align-items-center gap-2 flex-wrap flex-shrink-0 align-self-start align-self-sm-center">
            {can('accounts.chart.create') && (
              <button
                type="button"
                className="btn btn-outline-primary d-inline-flex align-items-center justify-content-center gap-1.5 px-3 py-1.5 rounded-2 shadow-sm fw-bold text-nowrap"
                style={{ fontSize: '0.82rem', height: 38 }}
                onClick={() => {
                  setNewAccCode(`ACC-${Math.floor(1000 + Math.random() * 9000)}`);
                  setNewAccName('');
                  setNewAccOpeningBal(0);
                  setNewAccDesc('');
                  setIsAddAccountModalOpen(true);
                }}
              >
                <Plus size={16} strokeWidth={2.5} /> Add Account Head
              </button>
            )}

            {can('accounts.journal.create') && (
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-1.5 px-3 py-1.5 rounded-2 shadow-sm fw-bold text-nowrap"
                style={{ fontSize: '0.82rem', height: 38 }}
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
                <Plus size={16} strokeWidth={2.5} /> Post Journal Voucher
              </button>
            )}

            {can('accounts.dayclosing.execute') && (
              <button
                type="button"
                className="btn btn-warning text-dark d-inline-flex align-items-center justify-content-center gap-1.5 px-3 py-1.5 rounded-2 shadow-sm fw-bold text-nowrap"
                style={{ fontSize: '0.82rem', height: 38 }}
                onClick={() => setIsDayClosingModalOpen(true)}
              >
                <CalendarCheck size={16} strokeWidth={2.2} /> Day Closing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div className="card shadow-sm border rounded-3 bg-white p-2">
        <ul className="nav nav-pills gap-1 flex-nowrap overflow-auto" style={{ scrollbarWidth: 'none' }}>
          <li className="nav-item">
            <button
              className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 ${activeTab === 'ledger' ? 'active fw-bold' : 'text-dark'}`}
              onClick={() => setActiveTab('ledger')}
            >
              <BookOpen size={16} /> Account Ledger Statement (àª–àª¾àª¤àª¾àªµàª¹à«€)
            </button>
          </li>
          {can('accounts.chart.view') && (
            <li className="nav-item">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 ${activeTab === 'chart' ? 'active fw-bold' : 'text-dark'}`}
                onClick={() => setActiveTab('chart')}
              >
                <ListTree size={16} /> Chart of Accounts ({accounts.length})
              </button>
            </li>
          )}
          {(can('accounts.journal.view') || can('accounts.ledger.view')) && (
            <li className="nav-item">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 ${activeTab === 'journal' ? 'active fw-bold' : 'text-dark'}`}
                onClick={() => setActiveTab('journal')}
              >
                <FileText size={16} /> Journal Entries Ledger ({journals.length})
              </button>
            </li>
          )}
          <li className="nav-item">
            <button
              className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 ${activeTab === 'trialbalance' ? 'active fw-bold' : 'text-dark'}`}
              onClick={() => setActiveTab('trialbalance')}
            >
              <Scale size={16} /> Trial Balance (àª•àª¾àªšà«àª‚ àª¸àª°àªµà«ˆàª¯à«àª‚)
            </button>
          </li>
          {(can('accounts.dashboard.view') || can('accounts.report.view')) && (
            <li className="nav-item">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 ${activeTab === 'summary' ? 'active fw-bold' : 'text-dark'}`}
                onClick={() => setActiveTab('summary')}
              >
                <TrendingUp size={16} /> Financial Statements (P&L)
              </button>
            </li>
          )}
          {can('accounts.dayclosing.view') && (
            <li className="nav-item">
              <button
                className={`nav-link btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 ${activeTab === 'dayclosing' ? 'active fw-bold' : 'text-dark'}`}
                onClick={() => setActiveTab('dayclosing')}
              >
                <CalendarCheck size={16} /> Day Closing Register ({dayClosings.length})
              </button>
            </li>
          )}
        </ul>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INDIVIDUAL ACCOUNT LEDGER STATEMENT (àª–àª¾àª¤àª¾àªµàª¹à«€) */}
      {/* ======================================================== */}
      {activeTab === 'ledger' && (
        <div className="d-flex flex-column gap-3">
          {/* Top Control Bar: Account Selector & Date Range Filter */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="row g-3 align-items-end">
              {/* Account Dropdown */}
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold text-dark d-flex align-items-center gap-1 mb-1">
                  <BookOpen size={14} className="text-primary" /> Select Account Head (àª–àª¾àª¤à«àª‚ àªªàª¸àª‚àª¦ àª•àª°à«‹)
                </label>
                <select
                  className="form-select form-select-sm fw-bold border-primary-subtle shadow-xs"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={isLoadingAccounts}
                >
                  <optgroup label="Assets (àª®àª¿àª²àª•àª¤à«‹ & àª°à«‹àª•àª¡/àª¬à«‡àª‚àª•)">
                    {accounts.filter(a => a.accountType === 'ASSET').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (â‚¹{a.currentBalance.toLocaleString()} Dr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Liabilities (àª¦à«‡àªµàª¾àª‚ & àªŸà«‡àª•à«àª¸)">
                    {accounts.filter(a => a.accountType === 'LIABILITY').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (â‚¹{a.currentBalance.toLocaleString()} Cr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Equity (àª®à«‚àª¡à«€)">
                    {accounts.filter(a => a.accountType === 'EQUITY').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (â‚¹{a.currentBalance.toLocaleString()} Cr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Revenue (àª†àªµàª• & àªµà«‡àªšàª¾àª£)">
                    {accounts.filter(a => a.accountType === 'REVENUE').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (â‚¹{a.currentBalance.toLocaleString()} Cr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Expenses (àª–àª°à«àªš)">
                    {accounts.filter(a => a.accountType === 'EXPENSE').map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.accountName} (â‚¹{a.currentBalance.toLocaleString()} Dr)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Date Presets & Inputs */}
              <div className="col-12 col-md-5">
                <label className="form-label small fw-bold text-dark d-flex align-items-center gap-1 mb-1">
                  <Calendar size={14} className="text-secondary" /> Statement Period (àª¸àª®àª¯àª—àª¾àª³à«‹)
                </label>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setLedgerStartDate(getTodayStr());
                        setLedgerEndDate(getTodayStr());
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setLedgerStartDate(getYesterdayStr());
                        setLedgerEndDate(getYesterdayStr());
                      }}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setLedgerStartDate(getWeekStartStr());
                        setLedgerEndDate(getTodayStr());
                      }}
                    >
                      This Week
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setLedgerStartDate(getMonthStartStr());
                        setLedgerEndDate(getTodayStr());
                      }}
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setLedgerStartDate(getFYStartStr());
                        setLedgerEndDate(getTodayStr());
                      }}
                    >
                      This FY
                    </button>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{ width: 130 }}
                      value={ledgerStartDate}
                      onChange={e => setLedgerStartDate(e.target.value)}
                    />
                    <span className="text-muted small">to</span>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{ width: 130 }}
                      value={ledgerEndDate}
                      onChange={e => setLedgerEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons: Refresh, Excel, PDF, Print */}
              <div className="col-12 col-md-3 d-flex justify-content-md-end gap-1.5 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                  onClick={() => loadLedgerStatement()}
                  title="Refresh Statement"
                >
                  <RefreshCw size={14} className={isLoadingLedger ? 'spin' : ''} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1 fw-bold"
                  onClick={handleExportLedgerExcel}
                  title="Export to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={15} /> Excel
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1 fw-bold"
                  onClick={handleExportLedgerPDF}
                  title="Export to PDF"
                >
                  <Download size={15} /> PDF
                </button>
                <button
                  type="button"
                  className="btn btn-outline-dark btn-sm d-inline-flex align-items-center gap-1"
                  onClick={handlePrintLedger}
                  title="Print Ledger"
                >
                  <Printer size={15} /> Print
                </button>
              </div>
            </div>
          </div>

          {/* 5 KPI Summary Cards */}
          {ledgerStatement && (
            <div className="row g-2">
              {/* Card 1: Opening Balance */}
              <div className="col-12 col-sm-6 col-md-2" style={{ flex: '1 0 18%' }}>
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem' }}>
                      Opening Balance
                    </span>
                    <span className={`badge ${ledgerStatement.openingBalanceType === 'Dr' ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning-emphasis'} px-1.5 py-0.5`} style={{ fontSize: '0.65rem' }}>
                      {ledgerStatement.openingBalanceType}
                    </span>
                  </div>
                  <h5 className="fw-bold mb-0 text-dark">
                    â‚¹{ledgerStatement.openingBalance.toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1" style={{ fontSize: '0.68rem' }}>
                    As of {ledgerStatement.period.startDate || 'Start'}
                  </span>
                </div>
              </div>

              {/* Card 2: Period Debits */}
              <div className="col-12 col-sm-6 col-md-2" style={{ flex: '1 0 18%' }}>
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem' }}>
                      Total Debits (Dr)
                    </span>
                    <span className="badge bg-primary-subtle text-primary px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                      Inflow/Expense
                    </span>
                  </div>
                  <h5 className="fw-bold mb-0 text-primary">
                    â‚¹{ledgerStatement.totalDebit.toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1" style={{ fontSize: '0.68rem' }}>
                    {ledgerStatement.transactions.filter(t => t.debit > 0).length} Debit Postings
                  </span>
                </div>
              </div>

              {/* Card 3: Period Credits */}
              <div className="col-12 col-sm-6 col-md-2" style={{ flex: '1 0 18%' }}>
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem' }}>
                      Total Credits (Cr)
                    </span>
                    <span className="badge bg-success-subtle text-success px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                      Outflow/Revenue
                    </span>
                  </div>
                  <h5 className="fw-bold mb-0 text-success">
                    â‚¹{ledgerStatement.totalCredit.toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1" style={{ fontSize: '0.68rem' }}>
                    {ledgerStatement.transactions.filter(t => t.credit > 0).length} Credit Postings
                  </span>
                </div>
              </div>

              {/* Card 4: Net Movement */}
              <div className="col-12 col-sm-6 col-md-2" style={{ flex: '1 0 18%' }}>
                <div className="card shadow-sm border rounded-3 p-2.5 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem' }}>
                      Net Movement
                    </span>
                    <span className="badge bg-light text-secondary border px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                      Activity
                    </span>
                  </div>
                  <h5 className={`fw-bold mb-0 ${ledgerStatement.netChange >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {ledgerStatement.netChange >= 0 ? '+' : '-'}â‚¹{Math.abs(ledgerStatement.netChange).toLocaleString()}
                  </h5>
                  <span className="text-muted small mt-1" style={{ fontSize: '0.68rem' }}>
                    In selected period
                  </span>
                </div>
              </div>

              {/* Card 5: Closing Balance */}
              <div className="col-12 col-sm-6 col-md-3" style={{ flex: '1 0 24%' }}>
                <div className="card shadow-sm border rounded-3 p-2.5 bg-primary-subtle border-primary-subtle h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase text-primary fw-bold" style={{ fontSize: '0.68rem' }}>
                      Closing Balance (àª†àª–àª° àª¬àª¾àª•à«€)
                    </span>
                    <span className="badge bg-primary text-white px-2 py-0.5 fw-bold" style={{ fontSize: '0.7rem' }}>
                      {ledgerStatement.closingBalanceType}
                    </span>
                  </div>
                  <h4 className="fw-bold mb-0 text-dark">
                    â‚¹{ledgerStatement.closingBalance.toLocaleString()}
                  </h4>
                  <span className="text-primary small mt-1 fw-medium" style={{ fontSize: '0.7rem' }}>
                    As of {ledgerStatement.period.endDate || 'Today'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Ledger Transactions Statement Table */}
          <div className="card shadow-sm border rounded-3 bg-white">
            <div className="card-header bg-white py-2.5 px-3 d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold text-dark fs-6">
                  {ledgerStatement?.account.accountName || 'Account'} Statement
                </span>
                <span className="badge bg-light text-secondary border">
                  {filteredLedgerTx.length} Transactions
                </span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div className="input-group input-group-sm" style={{ width: 220 }}>
                  <span className="input-group-text bg-light border-end-0"><Search size={14} /></span>
                  <input
                    type="text"
                    className="form-control form-control-sm border-start-0"
                    placeholder="Search voucher, particulars..."
                    value={ledgerSearch}
                    onChange={e => setLedgerSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '0.82rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '10%' }}>Date</th>
                    <th style={{ width: '13%' }}>Voucher #</th>
                    <th style={{ width: '22%' }}>Particulars / Contra Account</th>
                    <th style={{ width: '12%' }}>Ref Type</th>
                    <th style={{ width: '15%' }}>Narration</th>
                    <th className="text-end" style={{ width: '9%' }}>Debit (â‚¹ Dr)</th>
                    <th className="text-end" style={{ width: '9%' }}>Credit (â‚¹ Cr)</th>
                    <th className="text-end" style={{ width: '10%' }}>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row for Opening Balance */}
                  {ledgerStatement && (
                    <tr className="table-warning-subtle fw-bold">
                      <td>{ledgerStatement.period.startDate || '-'}</td>
                      <td>-</td>
                      <td colSpan={3}>
                        <em>Opening Balance Brought Forward (àª¶àª°à«‚àª†àª¤àª¨à«€ àª¬àª¾àª•à«€ àª†àª—àª³ àª²àª¾àªµà«àª¯àª¾)</em>
                      </td>
                      <td className="text-end">{ledgerStatement.openingBalanceType === 'Dr' ? `â‚¹${ledgerStatement.openingBalance.toLocaleString()}` : '-'}</td>
                      <td className="text-end">{ledgerStatement.openingBalanceType === 'Cr' ? `â‚¹${ledgerStatement.openingBalance.toLocaleString()}` : '-'}</td>
                      <td className="text-end text-primary">
                        â‚¹{ledgerStatement.openingBalance.toLocaleString()} <span className="small text-muted">{ledgerStatement.openingBalanceType}</span>
                      </td>
                    </tr>
                  )}

                  {isLoadingLedger ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                        Loading ledger transactions...
                      </td>
                    </tr>
                  ) : filteredLedgerTx.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        No transactions recorded for this account in the selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerTx.map((tx) => (
                      <tr key={tx.id}>
                        <td className="text-nowrap">{tx.entryDate}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 fw-bold text-primary text-decoration-none text-nowrap"
                            onClick={async () => {
                              const v = journals.find(j => j.id === tx.entryId) || (await apiClient.get('/accounts/journal').then((r: any) => r.data?.find((j: any) => j.id === tx.entryId)));
                              if (v) setSelectedVoucherForSlip(v);
                            }}
                          >
                            {tx.entryNumber}
                          </button>
                        </td>
                        <td>
                          <span className="fw-medium text-dark">{tx.particulars}</span>
                        </td>
                        <td>
                          <span className="badge bg-light text-secondary border">
                            {tx.referenceType || 'MANUAL'} {tx.referenceId ? `#${tx.referenceId}` : ''}
                          </span>
                        </td>
                        <td className="text-truncate text-secondary" style={{ maxWidth: 180 }}>
                          {tx.narration || '-'}
                        </td>
                        <td className="text-end fw-bold text-primary">
                          {tx.debit > 0 ? `â‚¹${tx.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-end fw-bold text-success">
                          {tx.credit > 0 ? `â‚¹${tx.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-end fw-bold text-dark">
                          â‚¹{tx.runningBalance.toLocaleString()} <span className="badge bg-light text-secondary border px-1 py-0" style={{ fontSize: '0.65rem' }}>{tx.balanceType}</span>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Closing Balance Row */}
                  {ledgerStatement && (
                    <tr className="table-primary-subtle fw-bold border-top border-2">
                      <td>{ledgerStatement.period.endDate || '-'}</td>
                      <td>-</td>
                      <td colSpan={3}>
                        <em>Closing Balance Carried Down (àª†àª–àª° àª¬àª¾àª•à«€ àª†àª—àª³ àª²àªˆ àª—àª¯àª¾)</em>
                      </td>
                      <td className="text-end text-primary">â‚¹{ledgerStatement.totalDebit.toLocaleString()}</td>
                      <td className="text-end text-success">â‚¹{ledgerStatement.totalCredit.toLocaleString()}</td>
                      <td className="text-end text-primary fs-6">
                        â‚¹{ledgerStatement.closingBalance.toLocaleString()} <span className="small">{ledgerStatement.closingBalanceType}</span>
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
      {/* TAB 2: CHART OF ACCOUNTS (àª–àª¾àª¤àª¾àªµàª¹à«€ àª¯àª¾àª¦à«€) */}
      {/* ======================================================== */}
      {activeTab === 'chart' && (
        <div className="d-flex flex-column gap-3">
          {/* Summary Strip */}
          <div className="row g-2">
            <div className="col-6 col-md-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center">
                <span className="text-muted small fw-bold" style={{ fontSize: '0.68rem' }}>Total Accounts</span>
                <h6 className="fw-bold mb-0 text-dark">{accounts.length} Heads</h6>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center">
                <span className="text-primary small fw-bold" style={{ fontSize: '0.68rem' }}>Assets (àª®àª¿àª²àª•àª¤à«‹)</span>
                <h6 className="fw-bold mb-0 text-primary">â‚¹{coaSummary.assets.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center">
                <span className="text-warning-emphasis small fw-bold" style={{ fontSize: '0.68rem' }}>Liabilities (àª¦à«‡àªµàª¾àª‚)</span>
                <h6 className="fw-bold mb-0 text-warning-emphasis">â‚¹{coaSummary.liabilities.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center">
                <span className="text-dark small fw-bold" style={{ fontSize: '0.68rem' }}>Equity (àª®à«‚àª¡à«€)</span>
                <h6 className="fw-bold mb-0 text-dark">â‚¹{coaSummary.equity.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center">
                <span className="text-success small fw-bold" style={{ fontSize: '0.68rem' }}>Revenue (àª†àªµàª•)</span>
                <h6 className="fw-bold mb-0 text-success">â‚¹{coaSummary.revenue.toLocaleString()}</h6>
              </div>
            </div>
            <div className="col-6 col-md-2">
              <div className="card shadow-sm border rounded-3 p-2 bg-white text-center">
                <span className="text-danger small fw-bold" style={{ fontSize: '0.68rem' }}>Expenses (àª–àª°à«àªš)</span>
                <h6 className="fw-bold mb-0 text-danger">â‚¹{coaSummary.expenses.toLocaleString()}</h6>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              {/* Type Pills */}
              <div className="btn-group btn-group-sm" role="group">
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
              <div className="input-group input-group-sm" style={{ width: 260 }}>
                <span className="input-group-text bg-light border-end-0"><Search size={14} /></span>
                <input
                  type="text"
                  className="form-control form-control-sm border-start-0"
                  placeholder="Search code, account title..."
                  value={coaSearch}
                  onChange={e => setCoaSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Accounts List Table */}
          <div className="card shadow-sm border rounded-3 bg-white">
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '0.83rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '12%' }}>Account Code</th>
                    <th style={{ width: '28%' }}>Account Title</th>
                    <th style={{ width: '14%' }}>Type</th>
                    <th style={{ width: '16%' }}>Sub-Type</th>
                    <th className="text-end" style={{ width: '15%' }}>Current Balance</th>
                    <th className="text-center" style={{ width: '15%' }}>Actions</th>
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
                        <td>
                          <span className="badge bg-light text-dark border font-monospace px-2 py-1">
                            {acc.accountCode}
                          </span>
                        </td>
                        <td>
                          <div className="fw-bold text-dark">{acc.accountName}</div>
                          {acc.description && <small className="text-muted">{acc.description}</small>}
                        </td>
                        <td>
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
                        <td>
                          <span className="badge bg-light text-secondary border">
                            {acc.subType || '-'}
                          </span>
                        </td>
                        <td className="text-end">
                          <span className="fw-bold fs-6">â‚¹{acc.currentBalance.toLocaleString()}</span>{' '}
                          <span className="small text-muted">
                            {acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE' ? 'Dr' : 'Cr'}
                          </span>
                        </td>
                        <td className="text-center">
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
      {/* TAB 3: JOURNAL ENTRIES (àªœàª°à«àª¨àª² àªµàª¾àª‰àªšàª°à«àª¸) */}
      {/* ======================================================== */}
      {activeTab === 'journal' && (
        <div className="d-flex flex-column gap-3">
          {/* Filter Bar */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-4">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><Search size={14} /></span>
                  <input
                    type="text"
                    className="form-control form-control-sm border-start-0"
                    placeholder="Search voucher #, narration..."
                    value={journalSearch}
                    onChange={e => setJournalSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-12 col-md-5 d-flex align-items-center gap-1">
                <span className="small text-muted">From:</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 130 }}
                  value={journalStartDate}
                  onChange={e => setJournalStartDate(e.target.value)}
                />
                <span className="small text-muted">To:</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 130 }}
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
                    className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 fw-bold"
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
              <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '0.82rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '13%' }}>Voucher #</th>
                    <th style={{ width: '11%' }}>Date</th>
                    <th style={{ width: '30%' }}>Narration / Particulars</th>
                    <th style={{ width: '15%' }}>Reference</th>
                    <th className="text-end" style={{ width: '13%' }}>Total Amount</th>
                    <th className="text-center" style={{ width: '9%' }}>Status</th>
                    <th className="text-center" style={{ width: '9%' }}>Action</th>
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
                        <td>
                          <span className="fw-bold text-primary font-monospace">{j.entryNumber}</span>
                        </td>
                        <td>{j.entryDate}</td>
                        <td>
                          <div className="fw-bold text-dark">{j.narration}</div>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {j.items?.map((it, idx) => (
                              <span key={idx} className="badge bg-light text-dark border" style={{ fontSize: '0.68rem' }}>
                                {it.accountName}: {it.debit > 0 ? `Dr â‚¹${it.debit}` : `Cr â‚¹${it.credit}`}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-light text-secondary border">
                            {j.referenceType || 'MANUAL'} {j.referenceId ? `#${j.referenceId}` : ''}
                          </span>
                        </td>
                        <td className="text-end fw-bold text-success fs-6">
                          â‚¹{j.totalDebit.toLocaleString()}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            {j.status || 'POSTED'}
                          </span>
                        </td>
                        <td className="text-center">
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
      {/* TAB 4: TRIAL BALANCE (àª•àª¾àªšà«àª‚ àª¸àª°àªµà«ˆàª¯à«àª‚) */}
      {/* ======================================================== */}
      {activeTab === 'trialbalance' && (
        <div className="d-flex flex-column gap-3">
          {/* Trial Balance Control Bar */}
          <div className="card shadow-sm border rounded-3 bg-white p-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div className="d-flex align-items-center gap-2">
                <label className="form-label small fw-bold text-dark mb-0">As of Date (àª† àª¤àª¾àª°à«€àª– àª¸à«àª§à«€àª¨à«àª‚):</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
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

              <div className="d-flex align-items-center gap-2">
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
              <table className="table table-hover table-bordered mb-0 align-middle" style={{ fontSize: '0.83rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '12%' }}>Account Code</th>
                    <th style={{ width: '38%' }}>Account Head Title</th>
                    <th style={{ width: '18%' }}>Account Group / Type</th>
                    <th className="text-end" style={{ width: '16%' }}>Debit Balance (â‚¹ Dr)</th>
                    <th className="text-end" style={{ width: '16%' }}>Credit Balance (â‚¹ Cr)</th>
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
                        <td>
                          <span className="badge bg-light text-dark border font-monospace">
                            {row.accountCode}
                          </span>
                        </td>
                        <td className="fw-bold text-dark">{row.accountName}</td>
                        <td>
                          <span className="badge bg-light text-secondary border">
                            {row.accountType} {row.subType ? `â€¢ ${row.subType}` : ''}
                          </span>
                        </td>
                        <td className="text-end fw-bold text-primary">
                          {row.debitBalance > 0 ? `â‚¹${row.debitBalance.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-end fw-bold text-success">
                          {row.creditBalance > 0 ? `â‚¹${row.creditBalance.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Grand Totals & Verification Row */}
                  {trialBalanceReport && (
                    <tr className="table-warning-subtle fw-bold fs-6 border-top border-2">
                      <td colSpan={3} className="text-uppercase">
                        <div className="d-flex align-items-center justify-content-between">
                          <span>Total Trial Balance (àª•àª¾àªšà«àª‚ àª¸àª°àªµà«ˆàª¯à«àª‚ àª•à«àª²)</span>
                          {trialBalanceReport.isBalanced ? (
                            <span className="badge bg-success text-white d-inline-flex align-items-center gap-1 px-2.5 py-1">
                              <CheckCircle2 size={14} /> Books Balanced (àª¸àª°àª­àª°)
                            </span>
                          ) : (
                            <span className="badge bg-danger text-white d-inline-flex align-items-center gap-1 px-2.5 py-1">
                              <AlertTriangle size={14} /> Unbalanced Variance
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-end text-primary">
                        â‚¹{trialBalanceReport.grandDebit.toLocaleString()}
                      </td>
                      <td className="text-end text-success">
                        â‚¹{trialBalanceReport.grandCredit.toLocaleString()}
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
      {/* TAB 5: FINANCIAL STATEMENTS (P&L & BALANCE SHEET) */}
      {/* ======================================================== */}
      {activeTab === 'summary' && financialSummary && (
        <div className="d-flex flex-column gap-3">
          {/* P&L 4 Metric Cards */}
          <div className="row g-3">
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                <span className="small text-uppercase text-muted fw-bold">Total Sales Revenue</span>
                <h3 className="fw-bold text-success mt-1">â‚¹{(financialSummary.profitAndLoss?.totalRevenue || 0).toLocaleString()}</h3>
                <span className="text-muted small">Food & Chaas Dining Collections</span>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                <span className="small text-uppercase text-muted fw-bold">Cost of Goods Sold (COGS)</span>
                <h3 className="fw-bold text-danger mt-1">â‚¹{(financialSummary.profitAndLoss?.totalCOGS || 0).toLocaleString()}</h3>
                <span className="text-muted small">Deshi Provisions & Ingredients</span>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                <span className="small text-uppercase text-muted fw-bold">Operating Expenses (OPEX)</span>
                <h3 className="fw-bold text-warning-emphasis mt-1">â‚¹{(financialSummary.profitAndLoss?.totalOperatingExpense || 0).toLocaleString()}</h3>
                <span className="text-muted small">Rent, Electricity, Cook Salaries</span>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-uppercase text-muted fw-bold">Net Operating Income</span>
                  <span className="badge bg-primary-subtle text-primary fw-bold">
                    Margin: {financialSummary.profitAndLoss?.profitMarginPercentage || 0}%
                  </span>
                </div>
                <h3 className={`fw-bold mt-1 ${(financialSummary.profitAndLoss?.netProfit || 0) >= 0 ? 'text-primary' : 'text-danger'}`}>
                  â‚¹{(financialSummary.profitAndLoss?.netProfit || 0).toLocaleString()}
                </h3>
                <span className="text-muted small">Net Restaurant Earnings</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Snapshot Card */}
          {financialSummary.balanceSheet && (
            <div className="card shadow-sm border rounded-3 bg-white p-3">
              <h6 className="fw-bold text-dark mb-3">Balance Sheet Equilibrium Snapshot (àª®àª¿àª²àª•àª¤à«‹ àª…àª¨à«‡ àª¦à«‡àªµàª¾àª‚ àª¸àª°àªµà«ˆàª¯à«àª‚)</h6>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3">
                    <span className="text-muted small fw-bold">Total Assets (àª®àª¿àª²àª•àª¤à«‹)</span>
                    <h4 className="fw-bold text-primary mt-1">â‚¹{financialSummary.balanceSheet.totalAssets.toLocaleString()}</h4>
                    <span className="small text-secondary">Cash in drawer, Bank, Inventory</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3">
                    <span className="text-muted small fw-bold">Total Liabilities (àª¦à«‡àªµàª¾àª‚)</span>
                    <h4 className="fw-bold text-warning-emphasis mt-1">â‚¹{financialSummary.balanceSheet.totalLiabilities.toLocaleString()}</h4>
                    <span className="small text-secondary">Vendor payables, GST payable</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-3">
                    <span className="text-muted small fw-bold">Total Equity & Capital (àª®à«‚àª¡à«€)</span>
                    <h4 className="fw-bold text-dark mt-1">â‚¹{financialSummary.balanceSheet.totalEquity.toLocaleString()}</h4>
                    <span className="small text-secondary">Owner capital & retained earnings</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: DAY CLOSING REGISTER (àª°à«‹àªœàª®à«‡àª³ àª¬àª‚àª§) */}
      {/* ======================================================== */}
      {activeTab === 'dayclosing' && (
        <DataTable<DayClosing>
          columns={[
            { header: 'Closing Date', accessor: 'closingDate', width: 120 },
            { header: 'Opening Cash', accessor: (row) => `â‚¹${row.openingCash.toLocaleString()}` },
            { header: 'Total Sales', accessor: (row) => <span className="fw-bold text-success">â‚¹{row.totalSales.toLocaleString()}</span> },
            { header: 'Cash Collected', accessor: (row) => `â‚¹${row.cashSales.toLocaleString()}` },
            { header: 'UPI & Card', accessor: (row) => `â‚¹${(row.upiSales + row.cardSales).toLocaleString()}` },
            { header: 'Expenses', accessor: (row) => `â‚¹${row.cashExpenses.toLocaleString()}` },
            { header: 'Actual Cash Counted', accessor: (row) => <span className="fw-bold">â‚¹{row.actualCash.toLocaleString()}</span> },
            {
              header: 'Cash Variance',
              accessor: (row) => (
                <span className={`badge ${row.cashDifference === 0 ? 'bg-success' : row.cashDifference > 0 ? 'bg-info' : 'bg-danger'}`}>
                  {row.cashDifference === 0 ? 'Balanced' : `â‚¹${row.cashDifference.toLocaleString()}`}
                </span>
              )
            }
          ]}
          data={dayClosings}
          searchPlaceholder="Search closing date..."
        />
      )}

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* MODAL 1: ADD NEW ACCOUNT HEAD */}
      <Modal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        title="Add New Account Head (àª¨àªµà«àª‚ àª–àª¾àª¤à«àª‚ àª¬àª¨àª¾àªµà«‹)"
      >
        <form onSubmit={handleCreateAccount} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-4">
              <label className="form-label small fw-bold">Account Code</label>
              <input
                type="text"
                className="form-control form-control-sm font-monospace"
                required
                value={newAccCode}
                onChange={e => setNewAccCode(e.target.value)}
              />
            </div>
            <div className="col-8">
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
            <div className="col-6">
              <label className="form-label small fw-bold">Account Type</label>
              <select
                className="form-select form-select-sm"
                value={newAccType}
                onChange={e => setNewAccType(e.target.value as any)}
              >
                <option value="ASSET">ASSET (àª®àª¿àª²àª•àª¤)</option>
                <option value="LIABILITY">LIABILITY (àª¦à«‡àªµà«àª‚)</option>
                <option value="EQUITY">EQUITY (àª®à«‚àª¡à«€)</option>
                <option value="REVENUE">REVENUE (àª†àªµàª•)</option>
                <option value="EXPENSE">EXPENSE (àª–àª°à«àªš)</option>
              </select>
            </div>
            <div className="col-6">
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
            <label className="form-label small fw-bold">Initial Opening Balance (â‚¹)</label>
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
        title="Post Double-Entry Journal Voucher (àªœàª°à«àª¨àª² àªµàª¾àª‰àªšàª° àªàª¨à«àªŸà«àª°à«€)"
        size="lg"
      >
        <form onSubmit={handlePostJournalVoucher} className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-4">
              <label className="form-label small fw-bold">Voucher Date</label>
              <input
                type="date"
                className="form-control form-control-sm"
                required
                value={journalDate}
                onChange={e => setJournalDate(e.target.value)}
              />
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold">Ref Type</label>
              <select
                className="form-select form-select-sm"
                value={journalRefType}
                onChange={e => setJournalRefType(e.target.value)}
              >
                <option value="MANUAL">MANUAL (àª¸àª¾àª®àª¾àª¨à«àª¯)</option>
                <option value="EXPENSE">EXPENSE (àª–àª°à«àªš)</option>
                <option value="SALES">SALES (àªµà«‡àªšàª¾àª£)</option>
                <option value="PAYROLL">PAYROLL (àªªàª—àª¾àª°)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (àª¹àªµàª¾àª²àª¾)</option>
              </select>
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold">Ref # (Optional)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. BILL-9921"
                value={journalRefId}
                onChange={e => setJournalRefId(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label small fw-bold">Voucher Narration / Particulars (àªµàª¿àª—àª¤ / àªµàª°à«àª£àª¨)</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g. Month-end depreciation on kitchen stove burners"
              required
              value={journalNarration}
              onChange={e => setJournalNarration(e.target.value)}
            />
          </div>

          {/* Dynamic Lines Table */}
          <div className="border rounded-3 p-3 bg-light">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small fw-bold text-dark">Debit & Credit Ledger Lines</span>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm py-0.5 px-2 d-inline-flex align-items-center gap-1"
                onClick={() => {
                  setJournalItems([...journalItems, { accountId: accounts[0]?.id || '', debit: 0, credit: 0, description: '' }]);
                }}
              >
                <Plus size={13} /> Add Line
              </button>
            </div>

            {journalItems.map((it, idx) => (
              <div key={idx} className="row g-2 align-items-center mb-2">
                <div className="col-12 col-md-5">
                  <select
                    className="form-select form-select-sm"
                    value={it.accountId}
                    onChange={e => {
                      const updated = [...journalItems];
                      updated[idx].accountId = e.target.value;
                      setJournalItems(updated);
                    }}
                  >
                    <option value="">-- Select Account Head --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        [{acc.accountCode}] {acc.accountName} ({acc.accountType})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-5 col-md-3">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">Dr â‚¹</span>
                    <input
                      type="number"
                      className="form-control form-control-sm text-end"
                      placeholder="0.00"
                      value={it.debit || ''}
                      onChange={e => {
                        const val = Number(e.target.value);
                        const updated = [...journalItems];
                        updated[idx].debit = val;
                        if (val > 0) updated[idx].credit = 0; // mutually exclusive per line
                        setJournalItems(updated);
                      }}
                    />
                  </div>
                </div>
                <div className="col-5 col-md-3">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">Cr â‚¹</span>
                    <input
                      type="number"
                      className="form-control form-control-sm text-end"
                      placeholder="0.00"
                      value={it.credit || ''}
                      onChange={e => {
                        const val = Number(e.target.value);
                        const updated = [...journalItems];
                        updated[idx].credit = val;
                        if (val > 0) updated[idx].debit = 0; // mutually exclusive per line
                        setJournalItems(updated);
                      }}
                    />
                  </div>
                </div>
                <div className="col-2 col-md-1 text-center">
                  {journalItems.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm p-1"
                      onClick={() => {
                        setJournalItems(journalItems.filter((_, i) => i !== idx));
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Auto-balancing Indicator */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2 border-top bg-white p-2 rounded-2">
              <div className="d-flex gap-3">
                <span className="small">Total Debits: <strong className="text-primary">â‚¹{journalTotals.debitSum.toLocaleString()}</strong></span>
                <span className="small">Total Credits: <strong className="text-success">â‚¹{journalTotals.creditSum.toLocaleString()}</strong></span>
              </div>
              <div>
                {journalTotals.isBalanced ? (
                  <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                    <CheckCircle2 size={13} /> Balanced (Dr = Cr)
                  </span>
                ) : (
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                    <AlertTriangle size={13} /> Unbalanced Diff: â‚¹{journalTotals.diff.toLocaleString()}
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
              Post Journal Voucher
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: VIEW VOUCHER SLIP */}
      <Modal
        isOpen={!!selectedVoucherForSlip}
        onClose={() => setSelectedVoucherForSlip(null)}
        title={`Journal Voucher Slip: #${selectedVoucherForSlip?.entryNumber || ''}`}
        size="lg"
      >
        {selectedVoucherForSlip && (
          <div className="d-flex flex-column gap-3">
            <div ref={printSlipRef} className="border rounded-3 p-4 bg-white">
              {/* Slip Header */}
              <div className="text-center border-bottom pb-3 mb-3">
                <h5 className="fw-bold mb-0 text-dark">àª­àª¾àª¤à«€àª—àª³ àª­àª¾àª£à«àª‚ - BHATIGAL BHANU RESTAURANT</h5>
                <small className="text-muted">Double-Entry Journal Voucher Slip</small>
                <div className="d-flex justify-content-between align-items-center mt-3 small">
                  <span><strong>Voucher #:</strong> {selectedVoucherForSlip.entryNumber}</span>
                  <span><strong>Date:</strong> {selectedVoucherForSlip.entryDate}</span>
                  <span><strong>Ref:</strong> {selectedVoucherForSlip.referenceType} {selectedVoucherForSlip.referenceId || ''}</span>
                </div>
              </div>

              {/* Narration */}
              <div className="mb-3 p-2 bg-light rounded">
                <small className="text-muted d-block">Narration / Description:</small>
                <span className="fw-medium text-dark">{selectedVoucherForSlip.narration}</span>
              </div>

              {/* Items Table */}
              <table className="table table-bordered table-sm mb-3 align-middle" style={{ fontSize: '0.82rem' }}>
                <thead className="table-light">
                  <tr>
                    <th>Account Title</th>
                    <th>Line Note</th>
                    <th className="text-end" style={{ width: '20%' }}>Debit (â‚¹)</th>
                    <th className="text-end" style={{ width: '20%' }}>Credit (â‚¹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVoucherForSlip.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="fw-bold">{it.accountName}</td>
                      <td className="text-muted small">{it.description || '-'}</td>
                      <td className="text-end text-primary fw-bold">
                        {it.debit > 0 ? `â‚¹${it.debit.toLocaleString()}` : '-'}
                      </td>
                      <td className="text-end text-success fw-bold">
                        {it.credit > 0 ? `â‚¹${it.credit.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="table-light fw-bold border-top border-2">
                    <td colSpan={2} className="text-end">Total Amount</td>
                    <td className="text-end text-primary">â‚¹{selectedVoucherForSlip.totalDebit.toLocaleString()}</td>
                    <td className="text-end text-success">â‚¹{selectedVoucherForSlip.totalCredit.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <div className="d-flex justify-content-between align-items-center text-muted small pt-4">
                <span>Prepared By: Admin</span>
                <span>Status: {selectedVoucherForSlip.status}</span>
                <span>Authorized Signatory</span>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 border-top pt-2">
              <button
                type="button"
                className="btn btn-outline-dark btn-sm d-inline-flex align-items-center gap-1"
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print Slip
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedVoucherForSlip(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 5: EXECUTE DAY CLOSING */}
      <Modal
        isOpen={isDayClosingModalOpen}
        onClose={() => setIsDayClosingModalOpen(false)}
        title="Daily Register & Shift Closing Summary (àª°à«‹àªœàª®à«‡àª³ àª¬àª‚àª§)"
      >
        <form onSubmit={handleExecuteDayClosing} className="d-flex flex-column gap-3">
          <p className="small text-secondary mb-1">
            Reconcile all POS orders, customer tender payments, cash drawer balance, and expenses for today:
          </p>
          <div>
            <label className="form-label small fw-bold">Actual Physical Cash Counted in Drawer (â‚¹)</label>
            <input
              type="number"
              className="form-control"
              required
              value={actualCashInput || ''}
              onChange={e => setActualCashInput(Number(e.target.value))}
            />
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