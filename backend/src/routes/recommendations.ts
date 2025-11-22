import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { recommendationsService } from '../modules/recommendations';

const router = Router();

router.get('/frequently-bought-together/:productId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { productId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    const recommendations = await recommendationsService.getFrequentlyBoughtTogether(productId, tenantId, limit);
    res.json(recommendations);
  } catch (error) {
    console.error('Get frequently bought together error:', error);
    throw new AppError('Failed to fetch recommendations', 500);
  }
});

router.get('/product/:productId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { productId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    const recommendations = await recommendationsService.getSmartRecommendations(productId, tenantId, limit);
    res.json(recommendations);
  } catch (error) {
    console.error('Get product recommendations error:', error);
    throw new AppError('Failed to fetch recommendations', 500);
  }
});

router.get('/top-selling', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const limit = parseInt(req.query.limit as string) || 10;

    const recommendations = await recommendationsService.getTopSellingProducts(tenantId, limit);
    res.json(recommendations);
  } catch (error) {
    console.error('Get top selling products error:', error);
    throw new AppError('Failed to fetch top selling products', 500);
  }
});

router.get('/trending', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 10;

    const recommendations = await recommendationsService.getTrendingProducts(tenantId, days, limit);
    res.json(recommendations);
  } catch (error) {
    console.error('Get trending products error:', error);
    throw new AppError('Failed to fetch trending products', 500);
  }
});

router.get('/customer/:customerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { customerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    const recommendations = await recommendationsService.getPersonalizedRecommendations(customerId, tenantId, limit);
    res.json(recommendations);
  } catch (error) {
    console.error('Get customer recommendations error:', error);
    throw new AppError('Failed to fetch customer recommendations', 500);
  }
});

export default router;
