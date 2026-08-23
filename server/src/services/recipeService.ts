import { Recipe, IRecipeIngredient, InventoryItem } from '../models/Inventory';
import { MenuItem, Unit } from '../models/Master';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class RecipeService {
  static async getRecipes() {
    return Recipe.find().sort({ menuItemName: 1 });
  }

  static async getRecipeByMenuItem(menuItemId: string) {
    return Recipe.findOne({ menuItemId });
  }

  static async createOrUpdateRecipe(data: any, userId?: string, username?: string) {
    const menuItem = await MenuItem.findOne({ id: data.menuItemId });
    if (!menuItem) throw { statusCode: 404, message: 'Menu item not found.' };

    let totalCost = 0;
    const ingredients: IRecipeIngredient[] = [];

    for (const ing of data.ingredients) {
      const invItem = await InventoryItem.findOne({ id: ing.inventoryItemId });
      const unit = await Unit.findOne({ id: ing.unitId });
      const lineCost = (invItem?.costPerUnit || ing.cost || 0) * ing.quantity;
      totalCost += lineCost;

      ingredients.push({
        id: uuidv4(),
        inventoryItemId: ing.inventoryItemId,
        itemName: invItem?.name || ing.itemName,
        quantity: ing.quantity,
        unitId: ing.unitId,
        unitSymbol: unit?.symbol || ing.unitSymbol,
        cost: Number(lineCost.toFixed(2))
      });
    }

    const foodCostPercentage = menuItem.price > 0 
      ? Number(((totalCost / menuItem.price) * 100).toFixed(1)) 
      : 0;

    const id = data.id || `rec_${uuidv4().slice(0, 8)}`;
    const recipe = await Recipe.findOneAndUpdate(
      { menuItemId: data.menuItemId },
      {
        $set: {
          id,
          menuItemId: data.menuItemId,
          menuItemName: menuItem.name,
          yieldQuantity: data.yieldQuantity || 1,
          ingredients,
          totalCost: Number(totalCost.toFixed(2)),
          foodCostPercentage,
          instructions: data.instructions
        }
      },
      { upsert: true, new: true }
    );

    // Update cost price on menu item
    menuItem.costPrice = Number(totalCost.toFixed(2));
    await menuItem.save();

    await createAuditLog({
      userId,
      username,
      module: 'Inventory / Stock',
      submodule: 'Recipes',
      action: 'SAVE_RECIPE',
      recordId: recipe.id,
      newValue: { menuItem: menuItem.name, totalCost, foodCostPercentage }
    });

    return recipe;
  }

  static async deleteRecipe(id: string) {
    return Recipe.deleteOne({ id });
  }
}
