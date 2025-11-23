import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all transactions
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await db.query(
      `SELECT
        t.*,
        c.name as customer_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.tenant_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get transactions error:', error);
    throw new AppError('Failed to fetch transactions', 500);
  }
});

// Get sales report (MUST be before /:id)
router.get('/reports/sales', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { start_date, end_date, group_by = 'day' } = req.query;

    let dateFilter = '';
    const params: any[] = [tenantId];

    if (start_date && end_date) {
      dateFilter = 'AND t.created_at BETWEEN $2 AND $3';
      params.push(start_date, end_date);
    }

    const result = await db.query(
      `SELECT
        DATE_TRUNC($${params.length + 1}, t.created_at) as period,
        COUNT(*) as transaction_count,
        SUM(t.total_amount) as total_revenue,
        SUM(t.tax_amount) as total_tax,
        AVG(t.total_amount) as avg_transaction
      FROM transactions t
      WHERE t.tenant_id = $1 ${dateFilter}
      GROUP BY period
      ORDER BY period DESC`,
      [...params, group_by]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Sales report error:', error);
    throw new AppError('Failed to generate sales report', 500);
  }
});

// Get single transaction with items
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const transactionResult = await db.query(
      `SELECT
        t.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.id = $1 AND t.tenant_id = $2`,
      [id, tenantId]
    );

    if (transactionResult.rows.length === 0) {
      throw new AppError('Transaction not found', 404);
    }

    const itemsResult = await db.query(
      `SELECT
        ti.*,
        p.name as product_name,
        p.sku as product_sku
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = $1
      ORDER BY ti.id`,
      [id]
    );

    res.json({
      ...transactionResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Get transaction error:', error);
    throw new AppError('Failed to fetch transaction', 500);
  }
});

// Create transaction (sale)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const {
      customer_id,
      payment_method = 'cash',
      items, // [{ product_id, quantity, unit_price }]
      subtotal,
      tax_amount,
      discount_amount = 0,
      total_amount,
      notes,
    } = req.body;

    if (!items || items.length === 0) {
      throw new AppError('Transaction must have at least one item', 400);
    }

    if (total_amount <= 0) {
      throw new AppError('Invalid transaction amount', 400);
    }

    const result = await db.transaction(async (client) => {
      // Generate transaction number
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM transactions WHERE tenant_id = $1',
        [tenantId]
      );
      const transactionNumber = `TXN-${Date.now()}-${parseInt(countResult.rows[0].count) + 1}`;

      // Create transaction
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
          customer_id || null,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          payment_method,
          'completed',
          notes || '',
        ]
      );

      const transaction = transactionResult.rows[0];

      // Create transaction items and update inventory
      for (const item of items) {
        const { product_id, quantity, unit_price } = item;

        if (!product_id || !quantity || !unit_price) {
          throw new AppError('Invalid item data', 400);
        }

        // Verify product exists
        const productCheck = await client.query(
          'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
          [product_id, tenantId]
        );

        if (productCheck.rows.length === 0) {
          throw new AppError(`Product ${product_id} not found`, 404);
        }

        // Check inventory
        const inventoryCheck = await client.query(
          'SELECT quantity FROM inventory WHERE tenant_id = $1 AND product_id = $2 AND location = $3',
          [tenantId, product_id, 'main']
        );

        const currentStock = inventoryCheck.rows.length > 0 ? inventoryCheck.rows[0].quantity : 0;

        if (currentStock < quantity) {
          throw new AppError(`Insufficient stock for product ${product_id}`, 400);
        }

        // Insert transaction item
        await client.query(
          `INSERT INTO transaction_items (
            transaction_id, product_id, quantity, unit_price, subtotal
          ) VALUES ($1, $2, $3, $4, $5)`,
          [transaction.id, product_id, quantity, unit_price, quantity * unit_price]
        );

        // Update inventory
        await client.query(
          `UPDATE inventory
           SET quantity = quantity - $1, last_updated = NOW()
           WHERE tenant_id = $2 AND product_id = $3 AND location = $4`,
          [quantity, tenantId, product_id, 'main']
        );
      }

      // Update customer loyalty points if applicable
      if (customer_id) {
        await client.query(
          `UPDATE customers
           SET loyalty_points = loyalty_points + $1,
               total_spent = total_spent + $2,
               last_visit = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [Math.floor(total_amount / 100), total_amount, customer_id, tenantId]
        );
      }

      return transaction;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Create transaction error:', error);
    throw new AppError('Failed to create transaction', 500);
  }
});

export default router;
