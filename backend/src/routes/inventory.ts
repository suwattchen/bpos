import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get low stock items (MUST be before /:productId)
router.get('/alerts/low-stock', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const threshold = parseInt(req.query.threshold as string) || 10;

    const result = await db.query(
      `SELECT
        i.*,
        p.name as product_name,
        p.sku as product_sku,
        p.selling_price
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.tenant_id = $1 AND i.quantity <= $2
      ORDER BY i.quantity ASC`,
      [tenantId, threshold]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get low stock error:', error);
    throw new AppError('Failed to fetch low stock items', 500);
  }
});

// Get all inventory for tenant
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await db.query(
      `SELECT
        i.*,
        p.name as product_name,
        p.sku as product_sku
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.tenant_id = $1
      ORDER BY i.last_updated DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get inventory error:', error);
    throw new AppError('Failed to fetch inventory', 500);
  }
});

// Get inventory for specific product (MUST be after specific paths)
router.get('/:productId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { productId } = req.params;

    const result = await db.query(
      `SELECT
        i.*,
        p.name as product_name,
        p.sku as product_sku
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.product_id = $1 AND i.tenant_id = $2`,
      [productId, tenantId]
    );

    if (result.rows.length === 0) {
      // Return zero stock if no record exists
      res.json({
        product_id: productId,
        tenant_id: tenantId,
        location: 'main',
        quantity: 0,
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product inventory error:', error);
    throw new AppError('Failed to fetch product inventory', 500);
  }
});

// Adjust inventory (add or subtract)
router.post('/adjust', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { product_id, quantity, location = 'main' } = req.body;

    if (!product_id) {
      throw new AppError('Product ID is required', 400);
    }

    if (quantity === undefined || quantity === null) {
      throw new AppError('Quantity is required', 400);
    }

    // Verify product belongs to tenant
    const productCheck = await db.query(
      'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
      [product_id, tenantId]
    );

    if (productCheck.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    // Use transaction for inventory adjustment
    const result = await db.transaction(async (client) => {
      // Get current inventory
      const current = await client.query(
        `SELECT quantity FROM inventory
         WHERE tenant_id = $1 AND product_id = $2 AND location = $3`,
        [tenantId, product_id, location]
      );

      const currentQty = current.rows.length > 0 ? current.rows[0].quantity : 0;
      const newQty = currentQty + quantity;

      if (newQty < 0) {
        throw new AppError('Insufficient stock', 400);
      }

      // Upsert inventory
      const inventoryResult = await client.query(
        `INSERT INTO inventory (tenant_id, product_id, location, quantity, last_updated)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (tenant_id, product_id, location)
         DO UPDATE SET
           quantity = $4,
           last_updated = NOW()
         RETURNING *`,
        [tenantId, product_id, location, newQty]
      );

      // Log the movement (if you have inventory_movements table)
      // await client.query(
      //   `INSERT INTO inventory_movements
      //    (tenant_id, product_id, quantity, type, reason, user_id)
      //    VALUES ($1, $2, $3, $4, $5, $6)`,
      //   [tenantId, product_id, quantity, quantity > 0 ? 'in' : 'out', reason, userId]
      // );

      return inventoryResult.rows[0];
    });

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Adjust inventory error:', error);
    throw new AppError('Failed to adjust inventory', 500);
  }
});

// Set inventory (absolute value)
router.post('/set', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { product_id, quantity, location = 'main' } = req.body;

    if (!product_id) {
      throw new AppError('Product ID is required', 400);
    }

    if (quantity === undefined || quantity === null || quantity < 0) {
      throw new AppError('Valid quantity is required', 400);
    }

    // Verify product
    const productCheck = await db.query(
      'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
      [product_id, tenantId]
    );

    if (productCheck.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const result = await db.query(
      `INSERT INTO inventory (tenant_id, product_id, location, quantity, last_updated)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, product_id, location)
       DO UPDATE SET
         quantity = $4,
         last_updated = NOW()
       RETURNING *`,
      [tenantId, product_id, location, quantity]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Set inventory error:', error);
    throw new AppError('Failed to set inventory', 500);
  }
});

// Update inventory (alias for set)
router.post('/update', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { product_id, quantity, location = 'main' } = req.body;

    if (!product_id) {
      throw new AppError('Product ID is required', 400);
    }

    if (quantity === undefined || quantity === null || quantity < 0) {
      throw new AppError('Valid quantity is required', 400);
    }

    const productCheck = await db.query(
      'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
      [product_id, tenantId]
    );

    if (productCheck.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const result = await db.query(
      `INSERT INTO inventory (tenant_id, product_id, location, quantity, last_updated)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, product_id, location)
       DO UPDATE SET
         quantity = $4,
         last_updated = NOW()
       RETURNING *`,
      [tenantId, product_id, location, quantity]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Update inventory error:', error);
    throw new AppError('Failed to update inventory', 500);
  }
});

export default router;
