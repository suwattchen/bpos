import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all categories
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await db.query(
      `SELECT * FROM categories
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    throw new AppError('Failed to fetch categories', 500);
  }
});

// Create category
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { name, description } = req.body;

    if (!name) {
      throw new AppError('Category name is required', 400);
    }

    const result = await db.query(
      `INSERT INTO categories (tenant_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenantId, name, description || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Create category error:', error);
    throw new AppError('Failed to create category', 500);
  }
});

// Update category
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { name, description } = req.body;

    const result = await db.query(
      `UPDATE categories SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *`,
      [name, description, id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Category not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Update category error:', error);
    throw new AppError('Failed to update category', 500);
  }
});

// Delete category
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM categories WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Category not found', 404);
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Delete category error:', error);
    throw new AppError('Failed to delete category', 500);
  }
});

export default router;
