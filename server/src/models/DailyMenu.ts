import { Schema, model, Document } from 'mongoose';

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface IDailyMenu extends Document {
  id: string;
  dayOfWeek: DayOfWeek;
  itemIds: string[];
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyMenuSchema = new Schema<IDailyMenu>({
  id: { type: String, required: true, unique: true },
  dayOfWeek: {
    type: String,
    enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
    required: true,
    unique: true,
    index: true
  },
  itemIds: [{ type: String }],
  isActive: { type: Boolean, default: true },
  notes: { type: String }
}, { timestamps: true });

export interface IDailyMenuConfig extends Document {
  id: string;
  isStrictEnforced: boolean;
  activeOverrideDay?: DayOfWeek;
  updatedAt: Date;
}

const DailyMenuConfigSchema = new Schema<IDailyMenuConfig>({
  id: { type: String, required: true, unique: true, default: 'default_config' },
  isStrictEnforced: { type: Boolean, default: true },
  activeOverrideDay: {
    type: String,
    enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
  }
}, { timestamps: true });

export const DailyMenu = model<IDailyMenu>('DailyMenu', DailyMenuSchema);
export const DailyMenuConfig = model<IDailyMenuConfig>('DailyMenuConfig', DailyMenuConfigSchema);
