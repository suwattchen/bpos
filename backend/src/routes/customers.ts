import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all customers
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await db.query(
      `SELECT * FROM customers
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get customers error:', error);
    throw new AppError('Failed to fetch customers', 500);
  }
});

// Search customers
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { q } = req.query;

    if (!q) {
      throw new AppError('Search query is required', 400);
    }

    const result = await db.query(
      `SELECT * FROM customers
       WHERE tenant_id = $1
       AND (
         name ILIKE $2
         OR email ILIKE $2
         OR phone ILIKE $2
       )
       ORDER BY name ASC`,
      [tenantId, `%${q}%`]
    );

    res.json(result.rows);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Search customers error:', error);
    throw new AppError('Failed to search customers', 500);
  }
});

// Get single customer
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Customer not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Get customer error:', error);
    throw new AppError('Failed to fetch customer', 500);
  }
});

// Get customer transactions
router.get('/:id/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM transactions
       WHERE customer_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [id, tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get customer transactions error:', error);
    throw new AppError('Failed to fetch customer transactions', 500);
  }
});

// Create customer
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { name, email, phone, address, notes } = req.body;

    if (!name) {
      throw new AppError('Customer name is required', 400);
    }

    // Check if email already exists
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM customers WHERE tenant_id = $1 AND email = $2',
        [tenantId, email]
      );

      if (emailCheck.rows.length > 0) {
        throw new AppError('Email already exists', 409);
      }
    }

    const result = await db.query(
      `INSERT INTO customers (
        tenant_id, name, email, phone, address, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [tenantId, name, email || null, phone || null, address || null, notes || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Create customer error:', error);
    throw new AppError('Failed to create customer', 500);
  }
});

// Update customer
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { name, email, phone, address, notes, loyalty_points } = req.body;

    // Check if customer exists
    const existing = await db.query(
      'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Customer not found', 404);
    }

    // Check email uniqueness
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM customers WHERE tenant_id = $1 AND email = $2 AND id != $3',
        [tenantId, email, id]
      );

      if (emailCheck.rows.length > 0) {
        throw new AppError('Email already exists', 409);
      }
    }

    const result = await db.query(
      `UPDATE customers SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address),
        notes = COALESCE($5, notes),
        loyalty_points = COALESCE($6, loyalty_points),
        updated_at = NOW()
      WHERE id = $7 AND tenant_id = $8
      RETURNING *`,
      [name, email, phone, address, notes, loyalty_points, id, tenantId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Update customer error:', error);
    throw new AppError('Failed to update customer', 500);
  }
});

// Delete customer
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Customer not found', 404);
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Delete customer error:', error);
    throw new AppError('Failed to delete customer', 500);
  }
});

export default router;
