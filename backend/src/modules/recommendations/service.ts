import pool from '../../config/database';
import { inventoryService } from '../inventory';

export interface ProductRecommendation {
  productId: string;
  productName: string;
  score: number;
  reason: string;
  confidence: number;
}

export interface FrequentlyBoughtTogether {
  productId: string;
  productName: string;
  coPurchaseCount: number;
  confidence: number;
}

class RecommendationsService {
  async updatePurchasePatterns(items: Array<{ productId: string; quantity: number }>, tenantId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of items) {
        const existingResult = await client.query(
          `SELECT * FROM purchase_patterns WHERE product_id = $1 AND tenant_id = $2`,
          [item.productId, tenantId]
        );

        if (existingResult.rows.length > 0) {
          await client.query(
            `UPDATE purchase_patterns
             SET purchase_count = purchase_count + $1,
                 last_purchased = NOW(),
                 updated_at = NOW()
             WHERE product_id = $2 AND tenant_id = $3`,
            [item.quantity, item.productId, tenantId]
          );
        } else {
          await client.query(
            `INSERT INTO purchase_patterns (product_id, tenant_id, purchase_count, last_purchased)
             VALUES ($1, $2, $3, NOW())`,
            [item.productId, tenantId, item.quantity]
          );
        }
      }

      if (items.length > 1) {
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            await this.updateCoPurchasePattern(
              client,
              items[i].productId,
              items[j].productId,
              tenantId
            );
          }
        }
      }

      await client.query('COMMIT');
      console.log('[Recommendations] Purchase patterns updated successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Recommendations] Error updating patterns:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateCoPurchasePattern(
    client: any,
    productId1: string,
    productId2: string,
    tenantId: string
  ): Promise<void> {
    const existingResult = await client.query(
      `SELECT * FROM co_purchase_patterns
       WHERE tenant_id = $1
       AND ((product_id_1 = $2 AND product_id_2 = $3)
         OR (product_id_1 = $3 AND product_id_2 = $2))`,
      [tenantId, productId1, productId2]
    );

    if (existingResult.rows.length > 0) {
      await client.query(
        `UPDATE co_purchase_patterns
         SET co_purchase_count = co_purchase_count + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [existingResult.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO co_purchase_patterns (tenant_id, product_id_1, product_id_2, co_purchase_count)
         VALUES ($1, $2, $3, 1)`,
        [tenantId, productId1, productId2]
      );
    }
  }

  async getFrequentlyBoughtTogether(
    productId: string,
    tenantId: string,
    limit: number = 5
  ): Promise<FrequentlyBoughtTogether[]> {
    const result = await pool.query(
      `SELECT
         CASE
           WHEN product_id_1 = $1 THEN product_id_2
           ELSE product_id_1
         END as recommended_product_id,
         co_purchase_count
       FROM co_purchase_patterns
       WHERE tenant_id = $2
       AND (product_id_1 = $1 OR product_id_2 = $1)
       ORDER BY co_purchase_count DESC
       LIMIT $3`,
      [productId, tenantId, limit]
    );

    const recommendations: FrequentlyBoughtTogether[] = [];
    const totalCount = result.rows.reduce((sum, row) => sum + row.co_purchase_count, 0);

    for (const row of result.rows) {
      const product = await inventoryService.getProduct(row.recommended_product_id, tenantId);

      if (product && product.is_active) {
        const confidence = totalCount > 0 ? (row.co_purchase_count / totalCount) * 100 : 0;

        recommendations.push({
          productId: product.id,
          productName: product.name,
          coPurchaseCount: row.co_purchase_count,
          confidence: parseFloat(confidence.toFixed(2)),
        });
      }
    }

    return recommendations;
  }

  async getSmartRecommendations(
    productId: string,
    tenantId: string,
    limit: number = 5
  ): Promise<ProductRecommendation[]> {
    const coPurchaseResult = await pool.query(
      `SELECT
         CASE
           WHEN product_id_1 = $1 THEN product_id_2
           ELSE product_id_1
         END as recommended_product_id,
         co_purchase_count
       FROM co_purchase_patterns
       WHERE tenant_id = $2
       AND (product_id_1 = $1 OR product_id_2 = $1)
       ORDER BY co_purchase_count DESC
       LIMIT $3`,
      [productId, tenantId, limit * 2]
    );

    const recommendations: ProductRecommendation[] = [];
    const maxCount = coPurchaseResult.rows[0]?.co_purchase_count || 1;

    for (const row of coPurchaseResult.rows) {
      const product = await inventoryService.getProduct(row.recommended_product_id, tenantId);

      if (product && product.is_active) {
        const normalizedScore = (row.co_purchase_count / maxCount) * 100;
        const confidence = parseFloat(normalizedScore.toFixed(2));

        recommendations.push({
          productId: product.id,
          productName: product.name,
          score: row.co_purchase_count,
          reason: 'Frequently bought together',
          confidence,
        });
      }

      if (recommendations.length >= limit) break;
    }

    return recommendations;
  }

  async getTopSellingProducts(tenantId: string, limit: number = 10): Promise<ProductRecommendation[]> {
    const result = await pool.query(
      `SELECT product_id, purchase_count
       FROM purchase_patterns
       WHERE tenant_id = $1
       ORDER BY purchase_count DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    const recommendations: ProductRecommendation[] = [];
    const maxCount = result.rows[0]?.purchase_count || 1;

    for (const row of result.rows) {
      const product = await inventoryService.getProduct(row.product_id, tenantId);

      if (product && product.is_active) {
        const confidence = (row.purchase_count / maxCount) * 100;

        recommendations.push({
          productId: product.id,
          productName: product.name,
          score: row.purchase_count,
          reason: 'Best seller',
          confidence: parseFloat(confidence.toFixed(2)),
        });
      }
    }

    return recommendations;
  }

  async getTrendingProducts(tenantId: string, days: number = 7, limit: number = 10): Promise<ProductRecommendation[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await pool.query(
      `SELECT product_id, purchase_count
       FROM purchase_patterns
       WHERE tenant_id = $1
       AND last_purchased >= $2
       ORDER BY purchase_count DESC
       LIMIT $3`,
      [tenantId, startDate, limit]
    );

    const recommendations: ProductRecommendation[] = [];
    const maxCount = result.rows[0]?.purchase_count || 1;

    for (const row of result.rows) {
      const product = await inventoryService.getProduct(row.product_id, tenantId);

      if (product && product.is_active) {
        const confidence = (row.purchase_count / maxCount) * 100;

        recommendations.push({
          productId: product.id,
          productName: product.name,
          score: row.purchase_count,
          reason: `Trending in last ${days} days`,
          confidence: parseFloat(confidence.toFixed(2)),
        });
      }
    }

    return recommendations;
  }

  async getPersonalizedRecommendations(
    customerId: string,
    tenantId: string,
    limit: number = 5
  ): Promise<ProductRecommendation[]> {
    const customerPurchases = await pool.query(
      `SELECT DISTINCT ti.product_id, COUNT(*) as purchase_count
       FROM transactions t
       JOIN transaction_items ti ON t.id = ti.transaction_id
       WHERE t.customer_id = $1 AND t.tenant_id = $2
       GROUP BY ti.product_id
       ORDER BY purchase_count DESC
       LIMIT 3`,
      [customerId, tenantId]
    );

    if (customerPurchases.rows.length === 0) {
      return this.getTopSellingProducts(tenantId, limit);
    }

    const recommendations: ProductRecommendation[] = [];
    const seenProducts = new Set<string>();

    for (const purchase of customerPurchases.rows) {
      const relatedProducts = await this.getSmartRecommendations(purchase.product_id, tenantId, 3);

      for (const rec of relatedProducts) {
        if (!seenProducts.has(rec.productId)) {
          seenProducts.add(rec.productId);
          recommendations.push({
            ...rec,
            reason: 'Based on your purchase history',
          });
        }

        if (recommendations.length >= limit) break;
      }

      if (recommendations.length >= limit) break;
    }

    return recommendations;
  }
}

export const recommendationsService = new RecommendationsService();
