import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { usePermission } from '../../context/PermissionContext';
import { DataTable, Modal } from '../../components/PermissionGate';
import { Recipe, MenuItem, InventoryItem } from '../../types';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export const RecipePage: React.FC = () => {
  const { can } = usePermission();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [ingredients, setIngredients] = useState<Array<{ inventoryItemId: string; quantity: number }>>([]);
  const [instructions, setInstructions] = useState('');

  const loadData = async () => {
    try {
      const [rRes, mRes, iRes]: any = await Promise.all([
        apiClient.get('/inventory/recipes'),
        apiClient.get('/masters/menu-items'),
        apiClient.get('/inventory/items')
      ]);
      if (rRes.success) setRecipes(rRes.data);
      if (mRes.success) setMenuItems(mRes.data);
      if (iRes.success) setInventoryItems(iRes.data);
    } catch (err) {
      console.error('Failed to load recipe data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddIngredientRow = () => {
    if (inventoryItems.length === 0) return;
    setIngredients(prev => [...prev, { inventoryItemId: inventoryItems[0].id, quantity: 0.1 }]);
  };

  const handleRemoveIngredientRow = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateIngredient = (idx: number, field: string, value: any) => {
    setIngredients(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      return updated;
    });
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItemId || ingredients.length === 0) {
      alert('Please select a menu dish and at least one ingredient.');
      return;
    }

    try {
      await apiClient.post('/inventory/recipes', {
        menuItemId: selectedMenuItemId,
        yieldQuantity: 1,
        instructions,
        ingredients: ingredients.map(ing => {
          const raw = inventoryItems.find(i => i.id === ing.inventoryItemId);
          return {
            inventoryItemId: ing.inventoryItemId,
            itemName: raw?.name || 'Item',
            quantity: Number(ing.quantity),
            unitSymbol: raw?.unitSymbol || 'unit',
            cost: (raw?.costPerUnit || 0) * Number(ing.quantity)
          };
        })
      });

      alert('Recipe formulation saved. Automatic inventory deduction is active for this dish!');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save recipe.');
    }
  };

  // Compute total simulated cost
  const simulatedCost = ingredients.reduce((sum, ing) => {
    const raw = inventoryItems.find(i => i.id === ing.inventoryItemId);
    return sum + ((raw?.costPerUnit || 0) * (ing.quantity || 0));
  }, 0);

  const selectedDish = menuItems.find(m => m.id === selectedMenuItemId);
  const simulatedFoodCostPct = selectedDish && selectedDish.price > 0
    ? Math.round((simulatedCost / selectedDish.price) * 100)
    : 0;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Recipe Formulation & Bill of Materials (BOM)</h4>
          <p className="text-muted small mb-0">Configure raw ingredient formulas for automated inventory deduction upon order settlement</p>
        </div>
        {can('inventory.recipe.create') && (
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={() => {
              setSelectedMenuItemId(menuItems[0]?.id || '');
              setIngredients([{ inventoryItemId: inventoryItems[0]?.id || '', quantity: 0.25 }]);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Formulate Recipe
          </button>
        )}
      </div>

      {/* Recipes Table */}
      <DataTable<Recipe>
        columns={[
          {
            header: 'Menu Dish',
            accessor: (row) => {
              const dish = menuItems.find(m => m.id === row.menuItemId);
              return (
                <div>
                  <span className="fw-bold text-dark">{dish?.name || 'Dish'}</span>
                  <span className="badge bg-light text-dark border ms-2 small">₹{dish?.price || 0}</span>
                </div>
              );
            }
          },
          {
            header: 'Ingredients Count',
            accessor: (row) => `${row.ingredients.length} Raw Ingredients`
          },
          {
            header: 'Preparation Cost',
            accessor: (row) => <span className="fw-bold text-dark">₹{row.totalCost}</span>
          },
          {
            header: 'Food Cost %',
            accessor: (row) => (
              <span className={`badge ${row.foodCostPercentage <= 35 ? 'bg-success' : 'bg-warning text-dark'}`}>
                {row.foodCostPercentage}%
              </span>
            )
          }
        ]}
        data={recipes}
        searchPlaceholder="Search recipe dish..."
        actions={(row) => (
          <>
            <button
              className="btn btn-outline-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
              onClick={() => {
                setSelectedMenuItemId(row.menuItemId);
                setIngredients(row.ingredients.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity })));
                setInstructions(row.instructions || '');
                setIsModalOpen(true);
              }}
            >
              <Edit2 size={14} /> Edit BOM
            </button>
          </>
        )}
      />

      {/* FORMULATE RECIPE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Formulate Dish Bill of Materials (BOM)"
        size="lg"
      >
        <form onSubmit={handleSaveRecipe} className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small fw-bold">Select Menu Item</label>
            <select
              className="form-select"
              value={selectedMenuItemId}
              onChange={e => setSelectedMenuItemId(e.target.value)}
            >
              {menuItems.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} (Selling Price: ₹{m.price})
                </option>
              ))}
            </select>
          </div>

          <div className="border rounded p-3 bg-light">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold small text-dark">Raw Material Ingredients List</span>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm p-1 px-2 d-flex align-items-center gap-1"
                onClick={handleAddIngredientRow}
              >
                <Plus size={14} /> Add Ingredient
              </button>
            </div>

            <div className="d-flex flex-column gap-2">
              {ingredients.map((ing, idx) => {
                const raw = inventoryItems.find(i => i.id === ing.inventoryItemId);
                const lineCost = (raw?.costPerUnit || 0) * (ing.quantity || 0);

                return (
                  <div key={idx} className="row g-2 align-items-center">
                    <div className="col-6">
                      <select
                        className="form-select form-select-sm"
                        value={ing.inventoryItemId}
                        onChange={e => handleUpdateIngredient(idx, 'inventoryItemId', e.target.value)}
                      >
                        {inventoryItems.map(rawItem => (
                          <option key={rawItem.id} value={rawItem.id}>
                            {rawItem.name} (₹{rawItem.costPerUnit}/{rawItem.unitSymbol})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-3">
                      <div className="input-group input-group-sm">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-control"
                          value={ing.quantity}
                          onChange={e => handleUpdateIngredient(idx, 'quantity', Number(e.target.value))}
                        />
                        <span className="input-group-text bg-white">{raw?.unitSymbol || 'unit'}</span>
                      </div>
                    </div>
                    <div className="col-2 text-end fw-bold small text-dark">
                      ₹{lineCost.toFixed(1)}
                    </div>
                    <div className="col-1 text-end">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm p-1"
                        onClick={() => handleRemoveIngredientRow(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cost Summary */}
            <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
              <div>
                <span className="small text-muted me-3">Estimated Dish Cost: <strong>₹{simulatedCost.toFixed(2)}</strong></span>
                <span className="small text-muted">Food Cost %: <strong className={simulatedFoodCostPct > 35 ? 'text-danger' : 'text-success'}>{simulatedFoodCostPct}%</strong></span>
              </div>
            </div>
          </div>

          <div>
            <label className="form-label small fw-bold">Chef Preparation Instructions (Optional)</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              placeholder="e.g. Marinate chicken with ginger garlic paste for 20 minutes before boiling rice..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm fw-bold">Save Recipe & Activate Auto-Deduction</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
