import { Schema, model, Document } from 'mongoose';

// Inventory Item
export interface IInventoryItem extends Document {
  id: string;
  itemCode: string;
  name: string;
  category: 'RAW_MATERIAL' | 'BEVERAGE' | 'PACKAGING' | 'SPICE' | 'DAIRY';
  unitId: string;
  unitSymbol?: string;
  currentStock: number;
  minimumStockLevel: number;
  reorderQuantity: number;
  costPerUnit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const InventoryItemSchema = new Schema<IInventoryItem>({
  id: { type: String, required: true, unique: true },
  itemCode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  unitId: { type: String, required: true, ref: 'Unit' },
  unitSymbol: { type: String },
  currentStock: { type: Number, default: 0 },
  minimumStockLevel: { type: Number, default: 5 },
  reorderQuantity: { type: Number, default: 20 },
  costPerUnit: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Recipe Ingredient
export interface IRecipeIngredient {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unitId: string;
  unitSymbol?: string;
  cost: number;
}
const RecipeIngredientSchema = new Schema<IRecipeIngredient>({
  id: { type: String, required: true },
  inventoryItemId: { type: String, required: true, ref: 'InventoryItem' },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitId: { type: String, required: true, ref: 'Unit' },
  unitSymbol: { type: String },
  cost: { type: Number, default: 0 }
}, { _id: false });

// Recipe
export interface IRecipe extends Document {
  id: string;
  menuItemId: string;
  menuItemName?: string;
  yieldQuantity: number;
  ingredients: IRecipeIngredient[];
  totalCost: number;
  foodCostPercentage: number;
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}
const RecipeSchema = new Schema<IRecipe>({
  id: { type: String, required: true, unique: true },
  menuItemId: { type: String, required: true, unique: true, ref: 'MenuItem' },
  menuItemName: { type: String },
  yieldQuantity: { type: Number, default: 1 },
  ingredients: [RecipeIngredientSchema],
  totalCost: { type: Number, default: 0 },
  foodCostPercentage: { type: Number, default: 0 },
  instructions: { type: String }
}, { timestamps: true });

// Stock Transaction
export interface IStockTransaction extends Document {
  id: string;
  itemId: string;
  itemName: string;
  transactionType: 'OPENING' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RECIPE_CONSUMPTION' | 'RETURN';
  quantity: number;
  unitPrice: number;
  totalCost: number;
  referenceType?: string; // ORDER, PURCHASE, ADJUSTMENT, MANUAL
  referenceId?: string;
  stockBefore: number;
  stockAfter: number;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}
const StockTransactionSchema = new Schema<IStockTransaction>({
  id: { type: String, required: true, unique: true },
  itemId: { type: String, required: true, ref: 'InventoryItem' },
  itemName: { type: String, required: true },
  transactionType: { 
    type: String, 
    enum: ['OPENING', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER', 'RECIPE_CONSUMPTION', 'RETURN'],
    required: true 
  },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  referenceType: { type: String },
  referenceId: { type: String },
  stockBefore: { type: Number, required: true },
  stockAfter: { type: Number, required: true },
  notes: { type: String },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

// Stock Adjustment
export interface IStockAdjustment extends Document {
  id: string;
  adjustmentNumber: string;
  itemId: string;
  itemName: string;
  type: 'INCREASE' | 'DECREASE' | 'DAMAGE' | 'EXPIRED' | 'THEFT' | 'CORRECTION';
  quantity: number;
  reason: string;
  createdBy?: string;
  createdAt: Date;
}
const StockAdjustmentSchema = new Schema<IStockAdjustment>({
  id: { type: String, required: true, unique: true },
  adjustmentNumber: { type: String, required: true, unique: true, index: true },
  itemId: { type: String, required: true, ref: 'InventoryItem' },
  itemName: { type: String, required: true },
  type: { type: String, required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

// Stock Transfer
export interface IStockTransfer extends Document {
  id: string;
  transferNumber: string;
  sourceLocation: string;
  destinationLocation: string;
  itemId: string;
  itemName: string;
  quantity: number;
  status: string;
  createdBy?: string;
  createdAt: Date;
}
const StockTransferSchema = new Schema<IStockTransfer>({
  id: { type: String, required: true, unique: true },
  transferNumber: { type: String, required: true, unique: true, index: true },
  sourceLocation: { type: String, required: true },
  destinationLocation: { type: String, required: true },
  itemId: { type: String, required: true, ref: 'InventoryItem' },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, default: 'COMPLETED' },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

export const InventoryItem = model<IInventoryItem>('InventoryItem', InventoryItemSchema);
export const Recipe = model<IRecipe>('Recipe', RecipeSchema);
export const StockTransaction = model<IStockTransaction>('StockTransaction', StockTransactionSchema);
export const StockAdjustment = model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);
export const StockTransfer = model<IStockTransfer>('StockTransfer', StockTransferSchema);
