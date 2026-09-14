import { PurchaseOrder, GoodsReceipt, PurchaseInvoice, IPurchaseOrderItem } from '../models/Purchase';
import { Supplier } from '../models/Master';
import { InventoryItem, StockTransaction } from '../models/Inventory';
import { JournalEntry } from '../models/Account';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class PurchaseService {
  static async getPurchaseOrders(query: any = {}) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    return PurchaseOrder.find(filter).sort({ createdAt: -1 });
  }

  static async createPurchaseOrder(data: any, userId?: string, username?: string) {
    const supplier = await Supplier.findOne({ id: data.supplierId });
    if (!supplier) throw { statusCode: 404, message: 'Supplier not found.' };

    const count = await PurchaseOrder.countDocuments();
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const id = `po_${uuidv4().slice(0, 8)}`;

    let subtotal = 0;
    let taxAmount = 0;

    const items: IPurchaseOrderItem[] = data.items.map((it: any) => {
      const lineTotal = it.quantity * it.unitPrice;
      const lineTax = (lineTotal * (it.taxRate || 0)) / 100;
      subtotal += lineTotal;
      taxAmount += lineTax;
      return {
        id: uuidv4(),
        inventoryItemId: it.inventoryItemId,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate || 0,
        totalPrice: lineTotal + lineTax,
        receivedQuantity: 0
      };
    });

    const po = await PurchaseOrder.create({
      id,
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      orderDate: data.orderDate || new Date().toISOString().split('T')[0],
      deliveryDate: data.deliveryDate,
      items,
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
      status: 'PENDING',
      createdBy: userId
    });

    await createAuditLog({
      userId,
      username,
      module: 'Purchase',
      submodule: 'Procurement',
      action: 'CREATE_PO',
      recordId: id,
      newValue: po
    });

    return po;
  }

  static async approvePurchaseOrder(poId: string, userId?: string, username?: string) {
    const po = await PurchaseOrder.findOneAndUpdate(
      { id: poId },
      { $set: { status: 'APPROVED', approvedBy: userId } },
      { new: true }
    );
    return po;
  }

  /**
   * Receive Goods (GRN) -> Automatically increases inventory items and creates stock transactions!
   */
  static async receiveGoods(poId: string, data: any, userId?: string, username?: string) {
    const po = await PurchaseOrder.findOne({ id: poId });
    if (!po) throw { statusCode: 404, message: 'Purchase order not found.' };

    const count = await GoodsReceipt.countDocuments();
    const grnNumber = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const grnId = `grn_${uuidv4().slice(0, 8)}`;

    const grn = await GoodsReceipt.create({
      id: grnId,
      grnNumber,
      purchaseOrderId: po.id,
      receivedDate: new Date().toISOString().split('T')[0],
      receivedBy: userId,
      invoiceNumber: data.invoiceNumber || data.vendorInvoiceNumber || data.vendorInvoiceNo,
      notes: data.notes
    });

    // Auto-increase inventory stock for each item in the PO
    for (const item of po.items) {
      const inv = await InventoryItem.findOne({ id: item.inventoryItemId });
      if (inv) {
        const stockBefore = inv.currentStock;
        const stockAfter = stockBefore + item.quantity;
        inv.currentStock = stockAfter;
        inv.costPerUnit = item.unitPrice; // update cost
        await inv.save();

        item.receivedQuantity = item.quantity;

        await StockTransaction.create({
          id: uuidv4(),
          itemId: inv.id,
          itemName: inv.name,
          transactionType: 'STOCK_IN',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalCost: item.totalPrice,
          referenceType: 'PURCHASE',
          referenceId: po.poNumber,
          stockBefore,
          stockAfter,
          notes: `Received via ${grnNumber} from ${po.supplierName}`,
          createdBy: userId
        });
      }
    }

    po.status = 'RECEIVED';
    await po.save();

    // Auto-generate Purchase Invoice and Supplier Payable
    const invCount = await PurchaseInvoice.countDocuments();
    const invoiceNumber = data.invoiceNumber || data.vendorInvoiceNumber || data.vendorInvoiceNo || `PINV-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;

    const invoice = await PurchaseInvoice.create({
      id: `pinv_${uuidv4().slice(0, 8)}`,
      invoiceNumber,
      purchaseOrderId: po.id,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      invoiceDate: new Date().toISOString().split('T')[0],
      subtotal: po.subtotal,
      taxAmount: po.taxAmount,
      totalAmount: po.totalAmount,
      paidAmount: 0,
      status: 'UNPAID'
    });

    // Update supplier outstanding balance
    const supplier = await Supplier.findOne({ id: po.supplierId });
    if (supplier) {
      supplier.outstandingBalance = (supplier.outstandingBalance || 0) + po.totalAmount;
      await supplier.save();
    }

    // Auto-journal entry for Purchase & Payable
    try {
      const jrnCount = await JournalEntry.countDocuments();
      const jrnNum = `JRN-${new Date().getFullYear()}-${String(jrnCount + 1).padStart(4, '0')}`;
      await JournalEntry.create({
        id: `jrn_${uuidv4().slice(0, 8)}`,
        entryNumber: jrnNum,
        entryDate: new Date().toISOString().split('T')[0],
        referenceType: 'PURCHASE',
        referenceId: invoiceNumber,
        narration: `Purchase invoice for goods received from ${po.supplierName}`,
        totalDebit: po.totalAmount,
        totalCredit: po.totalAmount,
        status: 'POSTED',
        createdBy: userId,
        items: [
          {
            id: uuidv4(),
            accountId: 'acc_inventory_asset',
            accountName: 'Food & Kathiyawadi Provision Inventory Asset',
            debit: po.totalAmount,
            credit: 0,
            description: `Stock added from PO ${po.poNumber}`
          },
          {
            id: uuidv4(),
            accountId: 'acc_supplier_payable',
            accountName: 'Accounts Payable (Farm & Spice Suppliers)',
            debit: 0,
            credit: po.totalAmount,
            description: `Payable obligation to ${po.supplierName}`
          }
        ]
      });
    } catch (jErr) {
      console.error('[Purchase Auto Journal Error]:', jErr);
    }

    return { grn, invoice, po };
  }

  static async getPurchaseInvoices() {
    return PurchaseInvoice.find().sort({ createdAt: -1 });
  }

  static async recordSupplierPayment(invoiceId: string, amount: number, paymentMethod: string, userId?: string) {
    const invoice = await PurchaseInvoice.findOne({ id: invoiceId });
    if (!invoice) throw { statusCode: 404, message: 'Purchase invoice not found.' };

    invoice.paidAmount = (invoice.paidAmount || 0) + amount;
    if (invoice.paidAmount >= invoice.totalAmount) {
      invoice.status = 'PAID';
    } else {
      invoice.status = 'PARTIALLY_PAID';
    }
    await invoice.save();

    // Reduce supplier outstanding balance
    const supplier = await Supplier.findOne({ id: invoice.supplierId });
    if (supplier) {
      supplier.outstandingBalance = Math.max(0, (supplier.outstandingBalance || 0) - amount);
      await supplier.save();
    }

    return invoice;
  }
}
