import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all products for tenant
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await db.query(
      `SELECT * FROM products
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get products error:', error);
    throw new AppError('Failed to fetch products', 500);
  }
});

// Get single product
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM products WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Get product error:', error);
    throw new AppError('Failed to fetch product', 500);
  }
});

// Search products
router.get('/search/:query', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { query } = req.params;

    const result = await db.query(
      `SELECT * FROM products
       WHERE tenant_id = $1
       AND (
         name ILIKE $2
         OR sku ILIKE $2
         OR barcode ILIKE $2
       )
       ORDER BY name`,
      [tenantId, `%${query}%`]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Search products error:', error);
    throw new AppError('Failed to search products', 500);
  }
});

// Create product
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const {
      name,
      sku,
      barcode,
      category_id,
      cost_price,
      selling_price,
      tax_rate,
      description,
      image_url,
      is_active,
    } = req.body;

    if (!name || !sku) {
      throw new AppError('Name and SKU are required', 400);
    }

    if (cost_price < 0 || selling_price < 0) {
      throw new AppError('Prices cannot be negative', 400);
    }

    // Check if SKU exists
    const skuCheck = await db.query(
      'SELECT id FROM products WHERE tenant_id = $1 AND sku = $2',
      [tenantId, sku]
    );

    if (skuCheck.rows.length > 0) {
      throw new AppError('SKU already exists', 409);
    }

    const result = await db.query(
      `INSERT INTO products (
        tenant_id, name, sku, barcode, category_id,
        cost_price, selling_price, tax_rate, description,
        image_url, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        tenantId,
        name,
        sku,
        barcode || null,
        category_id || null,
        cost_price || 0,
        selling_price || 0,
        tax_rate || 7,
        description || '',
        image_url || null,
        is_active !== false,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Create product error:', error);
    throw new AppError('Failed to create product', 500);
  }
});

// Update product
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const {
      name,
      sku,
      barcode,
      category_id,
      cost_price,
      selling_price,
      tax_rate,
      description,
      image_url,
      is_active,
    } = req.body;

    // Check if product exists
    const existing = await db.query(
      'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    // Check if new SKU conflicts
    if (sku) {
      const skuCheck = await db.query(
        'SELECT id FROM products WHERE tenant_id = $1 AND sku = $2 AND id != $3',
        [tenantId, sku, id]
      );

      if (skuCheck.rows.length > 0) {
        throw new AppError('SKU already exists', 409);
      }
    }

    const result = await db.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        barcode = COALESCE($3, barcode),
        category_id = COALESCE($4, category_id),
        cost_price = COALESCE($5, cost_price),
        selling_price = COALESCE($6, selling_price),
        tax_rate = COALESCE($7, tax_rate),
        description = COALESCE($8, description),
        image_url = COALESCE($9, image_url),
        is_active = COALESCE($10, is_active),
        updated_at = NOW()
      WHERE id = $11 AND tenant_id = $12
      RETURNING *`,
      [
        name,
        sku,
        barcode,
        category_id,
        cost_price,
        selling_price,
        tax_rate,
        description,
        image_url,
        is_active,
        id,
        tenantId,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Update product error:', error);
    throw new AppError('Failed to update product', 500);
  }
});

// Delete product
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM products WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Delete product error:', error);
    throw new AppError('Failed to delete product', 500);
  }
});

export default router;
