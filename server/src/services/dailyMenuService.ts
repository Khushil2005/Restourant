import { DailyMenu, DailyMenuConfig, DayOfWeek } from '../models/DailyMenu';
import { MenuItem } from '../models/Master';
import { createAuditLog } from '../middleware/auditMiddleware';

export const ALL_DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

export class DailyMenuService {
  static getCurrentDayOfWeek(): DayOfWeek {
    const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const now = new Date();
    return days[now.getDay()];
  }

  static async getConfig() {
    let config = await DailyMenuConfig.findOne({ id: 'default_config' });
    if (!config) {
      config = await DailyMenuConfig.create({
        id: 'default_config',
        isStrictEnforced: true
      });
    }
    return config;
  }

  static async getAllDailyMenus() {
    const existing = await DailyMenu.find().lean();
    const config = await this.getConfig();
    const currentDay = this.getCurrentDayOfWeek();

    // Ensure all 7 days have an entry
    const results = await Promise.all(
      ALL_DAYS.map(async (day) => {
        let menu: any = existing.find((m: any) => m.dayOfWeek === day);
        if (!menu) {
          const created = await DailyMenu.create({
            id: `daily_menu_${day.toLowerCase()}`,
            dayOfWeek: day,
            itemIds: [],
            isActive: true,
            notes: ''
          });
          menu = created.toObject();
        }

        const itemIds: string[] = menu?.itemIds || [];
        const items = await MenuItem.find({ id: { $in: itemIds } })
          .select('id name code price isVeg isAvailable categoryId preparationTimeMinutes')
          .lean();

        return {
          id: menu.id,
          dayOfWeek: day,
          itemIds,
          isActive: menu.isActive !== false,
          notes: menu.notes || '',
          itemCount: itemIds.length,
          items,
          isToday: day === currentDay
        };
      })
    );

    return {
      menus: results,
      currentDay,
      isStrictEnforced: config.isStrictEnforced,
      activeOverrideDay: config.activeOverrideDay
    };
  }

  static async getDailyMenuByDay(dayOfWeek: DayOfWeek) {
    let menu = await DailyMenu.findOne({ dayOfWeek });
    if (!menu) {
      menu = await DailyMenu.create({
        id: `daily_menu_${dayOfWeek.toLowerCase()}`,
        dayOfWeek,
        itemIds: [],
        isActive: true,
        notes: ''
      });
    }
    const items = await MenuItem.find({ id: { $in: menu.itemIds || [] } }).lean();
    return {
      ...menu.toObject(),
      items
    };
  }

  static async getTodayDailyMenu(requestedDay?: DayOfWeek) {
    const config = await this.getConfig();
    const systemToday = this.getCurrentDayOfWeek();
    const effectiveDay: DayOfWeek = requestedDay || config.activeOverrideDay || systemToday;

    let menu = await DailyMenu.findOne({ dayOfWeek: effectiveDay });
    if (!menu) {
      menu = await DailyMenu.create({
        id: `daily_menu_${effectiveDay.toLowerCase()}`,
        dayOfWeek: effectiveDay,
        itemIds: [],
        isActive: true,
        notes: ''
      });
    }

    const itemIds = menu.itemIds || [];
    const items = await MenuItem.find({ id: { $in: itemIds } }).lean();

    return {
      effectiveDay,
      systemToday,
      isStrictEnforced: config.isStrictEnforced,
      itemIds,
      items,
      itemCount: itemIds.length,
      notes: menu.notes || ''
    };
  }

  static async saveDailyMenu(
    dayOfWeek: DayOfWeek,
    itemIds: string[],
    notes?: string,
    isActive?: boolean,
    userId?: string,
    username?: string
  ) {
    if (!ALL_DAYS.includes(dayOfWeek)) {
      throw new Error(`Invalid day of week: ${dayOfWeek}`);
    }

    // Deduplicate and filter strings
    const cleanItemIds = Array.from(new Set((itemIds || []).filter(Boolean)));

    const old = await DailyMenu.findOne({ dayOfWeek });
    const id = `daily_menu_${dayOfWeek.toLowerCase()}`;

    const updateData: any = {
      id,
      dayOfWeek,
      itemIds: cleanItemIds
    };
    if (notes !== undefined) updateData.notes = notes;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await DailyMenu.findOneAndUpdate(
      { dayOfWeek },
      { $set: updateData },
      { new: true, upsert: true }
    );

    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'DailyMenu',
      action: 'EDIT',
      recordId: id,
      oldValue: old,
      newValue: updated
    });

    const items = await MenuItem.find({ id: { $in: cleanItemIds } }).lean();

    return {
      ...updated.toObject(),
      items,
      itemCount: cleanItemIds.length
    };
  }

  static async copyDailyMenu(
    fromDay: DayOfWeek,
    toDays: DayOfWeek[],
    userId?: string,
    username?: string
  ) {
    const source = await DailyMenu.findOne({ dayOfWeek: fromDay });
    if (!source) {
      throw new Error(`Source day ${fromDay} menu not found.`);
    }

    const itemIds = source.itemIds || [];
    const notes = source.notes || '';

    const results = await Promise.all(
      toDays.map(async (targetDay) => {
        if (targetDay === fromDay) return null;
        return this.saveDailyMenu(targetDay, itemIds, notes, true, userId, username);
      })
    );

    return results.filter(Boolean);
  }

  static async toggleStrictEnforcement(
    isStrictEnforced: boolean,
    activeOverrideDay?: DayOfWeek | null,
    userId?: string,
    username?: string
  ) {
    const old = await this.getConfig();
    const updateData: any = { isStrictEnforced: Boolean(isStrictEnforced) };
    if (activeOverrideDay !== undefined) {
      updateData.activeOverrideDay = activeOverrideDay || null;
    }

    const updated = await DailyMenuConfig.findOneAndUpdate(
      { id: 'default_config' },
      { $set: updateData },
      { new: true, upsert: true }
    );

    await createAuditLog({
      userId,
      username,
      module: 'Masters',
      submodule: 'DailyMenuConfig',
      action: 'EDIT',
      recordId: 'default_config',
      oldValue: old,
      newValue: updated
    });

    return updated;
  }

  static async getDailyMenuStatus() {
    const config = await this.getConfig();
    const currentDay = this.getCurrentDayOfWeek();
    const todayMenu = await DailyMenu.findOne({
      dayOfWeek: config.activeOverrideDay || currentDay
    });

    return {
      isStrictEnforced: config.isStrictEnforced,
      currentDay,
      effectiveDay: config.activeOverrideDay || currentDay,
      activeOverrideDay: config.activeOverrideDay || null,
      activeItemsCount: todayMenu?.itemIds?.length || 0
    };
  }
}
