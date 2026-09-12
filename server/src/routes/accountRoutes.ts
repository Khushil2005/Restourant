import { Router, Response } from 'express';
import { AccountService } from '../services/accountService';
import { ExpenseService } from '../services/expenseService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const accountRouter = Router();

// --- CHART OF ACCOUNTS ---
accountRouter.get('/chart', authenticate, authorize('accounts.chart.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const chart = await AccountService.getChartOfAccounts();
    return ApiResponse.success(res, chart, 'Chart of accounts loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

accountRouter.post('/chart', authenticate, authorize('accounts.chart.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const head = await AccountService.createAccountHead(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, head, 'Account head created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

accountRouter.put('/chart/:id', authenticate, authorize('accounts.chart.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const head = await AccountService.updateAccountHead(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, head, 'Account head updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

// --- JOURNAL ENTRIES ---
accountRouter.get('/journal', authenticate, authorize('accounts.journal.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journals = await AccountService.getJournalEntries(req.query);
    return ApiResponse.success(res, journals, 'Journal entries retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

accountRouter.post('/journal', authenticate, authorize('accounts.journal.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = await AccountService.createJournalEntry(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, entry, 'Journal voucher posted.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

// --- ACCOUNT LEDGER STATEMENT ---
accountRouter.get('/ledger', authenticate, authorize('accounts.ledger.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, startDate, endDate } = req.query as { accountId?: string; startDate?: string; endDate?: string };
    if (!accountId) {
      return ApiResponse.error(res, 'accountId query parameter is required.', 400);
    }
    const statement = await AccountService.getAccountLedger(accountId, startDate, endDate);
    return ApiResponse.success(res, statement, 'Account ledger statement loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 500);
  }
});

// --- TRIAL BALANCE ---
accountRouter.get('/trial-balance', authenticate, authorize('accounts.dashboard.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { asOfDate } = req.query as { asOfDate?: string };
    const trialBalance = await AccountService.getTrialBalance(asOfDate);
    return ApiResponse.success(res, trialBalance, 'Trial balance loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- DAY CLOSING ---
accountRouter.get('/day-closing', authenticate, authorize('accounts.dayclosing.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const closings = await AccountService.getDayClosings();
    return ApiResponse.success(res, closings, 'Day closings retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

accountRouter.post('/day-closing', authenticate, authorize('accounts.dayclosing.execute'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const closing = await AccountService.executeDayClosing(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, closing, 'Day closing completed successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

// --- FINANCIAL SUMMARY ---
accountRouter.get('/financial-summary', authenticate, authorize('accounts.dashboard.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await AccountService.getFinancialSummary();
    return ApiResponse.success(res, summary, 'Financial summary loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

export const expenseRouter = Router();

expenseRouter.get('/', authenticate, authorize('expense.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const expenses = await ExpenseService.getExpenses(req.query);
    return ApiResponse.success(res, expenses, 'Expenses retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

expenseRouter.post('/', authenticate, authorize('expense.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const expense = await ExpenseService.createExpense(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, expense, 'Expense voucher recorded.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

expenseRouter.delete('/:id', authenticate, authorize('expense.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ExpenseService.deleteExpense(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'Expense deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});
