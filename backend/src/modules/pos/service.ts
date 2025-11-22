import pool from '../../config/database';
import { eventBus } from '../../events/eventBus';
import { EventNames, SaleCompletedEvent } from '../../types/events';
import { inventoryService } from '../inventory';

export interface SaleItem {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  tenantId: string;
  items: SaleItem[];
  customerId?: string;
  paymentMethod: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  tenantId: string;
  customerId?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  notes?: string;
  createdAt: Date;
}

class POSService {
  async createSale(input: CreateSaleInput): Promise<Transaction> {
    const { tenantId, items, customerId, paymentMethod, notes } = input;

    if (!items || items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let subtotal = 0;
      const itemsWithPrices: Array<{ productId: string; quantity: number; price: number; itemSubtotal: number }> = [];

      for (const item of items) {
        const product = await inventoryService.getProduct(item.productId, tenantId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const hasStock = await inventoryService.checkStockAvailability(item.productId, tenantId, item.quantity);
        if (!hasStock) {
          throw new Error(`Insufficient stock for product: ${product.name}`);
        }

        const price = product.selling_price;
        const itemSubtotal = price * item.quantity;
        subtotal += itemSubtotal;

        itemsWithPrices.push({
          productId: item.productId,
          quantity: item.quantity,
          price,
          itemSubtotal,
        });
      }

      const taxAmount = subtotal * 0.07;
      const totalAmount = subtotal + taxAmount;

      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM transactions WHERE tenant_id = $1',
        [tenantId]
      );
      const transactionNumber = `TXN-${Date.now()}-${parseInt(countResult.rows[0].count) + 1}`;

      const transactionResult = await client.query(
        `INSERT INTO transactions (
          tenant_id, transaction_number, customer_id,
          subtotal, tax_amount, discount_amount, total_amount,
          payment_method, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          tenantId,
          transactionNumber,
          customerId || null,
          subtotal,
          taxAmount,
          0,
          totalAmount,
          paymentMethod,
          'completed',
          notes || '',
        ]
      );

      const transaction = transactionResult.rows[0];

      for (const item of itemsWithPrices) {
        await client.query(
          `INSERT INTO transaction_items (
            transaction_id, product_id, quantity, unit_price, subtotal
          ) VALUES ($1, $2, $3, $4, $5)`,
          [transaction.id, item.productId, item.quantity, item.price, item.itemSubtotal]
        );
      }

      if (customerId) {
        await client.query(
          `UPDATE customers
           SET loyalty_points = loyalty_points + $1,
               total_spent = total_spent + $2,
               last_visit = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [Math.floor(totalAmount / 100), totalAmount, customerId, tenantId]
        );
      }

      await client.query('COMMIT');

      const saleCompletedEvent: SaleCompletedEvent = {
        transactionId: transaction.id,
        tenantId,
        items: itemsWithPrices.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount,
        customerId,
        timestamp: new Date(),
      };

      console.log('[POS] Emitting sale_completed event:', saleCompletedEvent);
      eventBus.emitEvent(EventNames.SALE_COMPLETED, saleCompletedEvent);

      return {
        id: transaction.id,
        transactionNumber: transaction.transaction_number,
        tenantId: transaction.tenant_id,
        customerId: transaction.customer_id,
        subtotal: parseFloat(transaction.subtotal),
        taxAmount: parseFloat(transaction.tax_amount),
        discountAmount: parseFloat(transaction.discount_amount),
        totalAmount: parseFloat(transaction.total_amount),
        paymentMethod: transaction.payment_method,
        status: transaction.status,
        notes: transaction.notes,
        createdAt: transaction.created_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTransaction(transactionId: string, tenantId: string): Promise<any> {
    const result = await pool.query(
      `SELECT * FROM transactions WHERE id = $1 AND tenant_id = $2`,
      [transactionId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const transaction = result.rows[0];

    const itemsResult = await pool.query(
      `SELECT ti.*, p.name as product_name
       FROM transaction_items ti
       JOIN products p ON p.id = ti.product_id
       WHERE ti.transaction_id = $1`,
      [transactionId]
    );

    return {
      ...transaction,
      items: itemsResult.rows,
    };
  }
}

export const posService = new POSService();
