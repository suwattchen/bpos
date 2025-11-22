import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { posService } from '../modules/pos';

const router = Router();

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { items, customerId, paymentMethod, notes } = req.body;

    if (!items || items.length === 0) {
      throw new AppError('Sale must have at least one item', 400);
    }

    if (!paymentMethod) {
      throw new AppError('Payment method is required', 400);
    }

    const transaction = await posService.createSale({
      tenantId,
      items,
      customerId,
      paymentMethod,
      notes,
    });

    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Create sale error:', error);
    throw new AppError(error instanceof Error ? error.message : 'Failed to create sale', 500);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const transaction = await posService.getTransaction(id, tenantId);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    res.json(transaction);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Get transaction error:', error);
    throw new AppError('Failed to fetch transaction', 500);
  }
});

export default router;
