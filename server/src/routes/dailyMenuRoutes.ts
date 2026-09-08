import { Router, Response } from 'express';
import { DailyMenuService } from '../services/dailyMenuService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';
import { DayOfWeek } from '../models/DailyMenu';

export const dailyMenuRouter = Router();

// 1. Get all 7 days schedule
dailyMenuRouter.get('/', authenticate, authorize(['daily_menu.view', 'masters.menu.view']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await DailyMenuService.getAllDailyMenus();
    return ApiResponse.success(res, data, 'Daily menu schedule retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 2. Get today's daily menu for POS & Ordering
dailyMenuRouter.get('/today', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedDay = req.query.day as DayOfWeek | undefined;
    const data = await DailyMenuService.getTodayDailyMenu(requestedDay);
    return ApiResponse.success(res, data, 'Today daily menu retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 3. Get status & enforcement settings
dailyMenuRouter.get('/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await DailyMenuService.getDailyMenuStatus();
    return ApiResponse.success(res, data, 'Daily menu status retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 4. Get specific day's menu
dailyMenuRouter.get('/:dayOfWeek', authenticate, authorize(['daily_menu.view', 'masters.menu.view']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const day = req.params.dayOfWeek.toUpperCase() as DayOfWeek;
    const data = await DailyMenuService.getDailyMenuByDay(day);
    return ApiResponse.success(res, data, `${day} menu retrieved.`);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 5. Save or update day's menu
dailyMenuRouter.post('/', authenticate, authorize(['daily_menu.edit', 'masters.menu.edit']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dayOfWeek, itemIds, notes, isActive } = req.body;
    if (!dayOfWeek) {
      return ApiResponse.error(res, 'Day of week is required.', 400);
    }
    const saved = await DailyMenuService.saveDailyMenu(
      dayOfWeek.toUpperCase() as DayOfWeek,
      itemIds || [],
      notes,
      isActive,
      req.user?.userId,
      req.user?.username
    );
    return ApiResponse.success(res, saved, `Daily menu for ${dayOfWeek} saved successfully.`);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// 6. Copy menu from one day to multiple days
dailyMenuRouter.post('/copy', authenticate, authorize(['daily_menu.edit', 'masters.menu.edit']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromDay, toDays } = req.body;
    if (!fromDay || !Array.isArray(toDays) || toDays.length === 0) {
      return ApiResponse.error(res, 'fromDay and toDays array are required.', 400);
    }
    const copied = await DailyMenuService.copyDailyMenu(
      fromDay.toUpperCase() as DayOfWeek,
      toDays.map(d => d.toUpperCase() as DayOfWeek),
      req.user?.userId,
      req.user?.username
    );
    return ApiResponse.success(res, copied, `Menu successfully copied from ${fromDay} to ${toDays.join(', ')}.`);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// 7. Toggle strict daily menu enforcement in POS
dailyMenuRouter.post('/toggle-strict', authenticate, authorize(['daily_menu.edit', 'masters.menu.edit']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isStrictEnforced, activeOverrideDay } = req.body;
    const updated = await DailyMenuService.toggleStrictEnforcement(
      Boolean(isStrictEnforced),
      activeOverrideDay ? (activeOverrideDay.toUpperCase() as DayOfWeek) : null,
      req.user?.userId,
      req.user?.username
    );
    return ApiResponse.success(res, updated, `Strict Daily Menu enforcement ${updated.isStrictEnforced ? 'enabled' : 'disabled'}.`);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});
