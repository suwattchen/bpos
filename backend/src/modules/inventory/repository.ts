import pool from '../../config/database';

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
  cost_price: number;
  selling_price: number;
  tax_rate?: number;
  description?: string;
  image_url?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface StockUpdate {
  productId: string;
  tenantId: string;
  quantity: number;
  reason: 'sale' | 'restock' | 'adjustment';
}

class InventoryRepository {
  async getProductById(productId: string, tenantId: string): Promise<Product | null> {
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND tenant_id = $2',
      [productId, tenantId]
    );
    return result.rows[0] || null;
  }

  async getProductByBarcode(barcode: string, tenantId: string): Promise<Product | null> {
    const result = await pool.query(
      'SELECT * FROM products WHERE barcode = $1 AND tenant_id = $2',
      [barcode, tenantId]
    );
    return result.rows[0] || null;
  }

  async getAllProducts(tenantId: string): Promise<Product[]> {
    const result = await pool.query(
      'SELECT * FROM products WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );
    return result.rows;
  }

  async searchProducts(searchTerm: string, tenantId: string): Promise<Product[]> {
    const result = await pool.query(
      `SELECT * FROM products
       WHERE tenant_id = $1 AND (name ILIKE $2 OR sku ILIKE $2 OR barcode ILIKE $2)
       ORDER BY name ASC`,
      [tenantId, `%${searchTerm}%`]
    );
    return result.rows;
  }

  async createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const result = await pool.query(
      `INSERT INTO products (
        tenant_id, name, sku, barcode, category_id, cost_price,
        selling_price, tax_rate, description, image_url, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        productData.tenant_id,
        productData.name,
        productData.sku,
        productData.barcode,
        productData.category_id,
        productData.cost_price,
        productData.selling_price,
        productData.tax_rate || 0,
        productData.description,
        productData.image_url,
        productData.is_active,
      ]
    );
    return result.rows[0];
  }

  async updateProduct(productId: string, tenantId: string, updates: Partial<Product>): Promise<Product | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'tenant_id' && key !== 'created_at') {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.getProductById(productId, tenantId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(productId, tenantId);

    const query = `
      UPDATE products
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async deleteProduct(productId: string, tenantId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 AND tenant_id = $2',
      [productId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async checkInventory(productId: string, tenantId: string, quantity: number): Promise<boolean> {
    const result = await pool.query(
      'SELECT quantity FROM inventory WHERE product_id = $1 AND tenant_id = $2 AND location = $3',
      [productId, tenantId, 'main']
    );

    if (result.rows.length === 0) return false;
    return result.rows[0].quantity >= quantity;
  }

  async deductStock(update: StockUpdate): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const inventoryResult = await client.query(
        'SELECT quantity FROM inventory WHERE product_id = $1 AND tenant_id = $2 AND location = $3 FOR UPDATE',
        [update.productId, update.tenantId, 'main']
      );

      if (inventoryResult.rows.length === 0) {
        throw new Error(`Inventory not found for product: ${update.productId}`);
      }

      const oldQuantity = inventoryResult.rows[0].quantity;
      const newQuantity = oldQuantity - update.quantity;

      if (newQuantity < 0) {
        throw new Error(`Insufficient stock for product: ${update.productId}`);
      }

      await client.query(
        `UPDATE inventory
         SET quantity = $1, last_updated = NOW()
         WHERE product_id = $2 AND tenant_id = $3 AND location = $4`,
        [newQuantity, update.productId, update.tenantId, 'main']
      );

      await client.query(
        `INSERT INTO stock_movements (product_id, quantity_change, reason, old_quantity, new_quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [update.productId, -update.quantity, update.reason, oldQuantity, newQuantity]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async bulkDeductStock(updates: StockUpdate[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const update of updates) {
        const inventoryResult = await client.query(
          'SELECT quantity FROM inventory WHERE product_id = $1 AND tenant_id = $2 AND location = $3 FOR UPDATE',
          [update.productId, update.tenantId, 'main']
        );

        if (inventoryResult.rows.length === 0) {
          throw new Error(`Inventory not found for product: ${update.productId}`);
        }

        const oldQuantity = inventoryResult.rows[0].quantity;
        const newQuantity = oldQuantity - update.quantity;

        if (newQuantity < 0) {
          throw new Error(`Insufficient stock for product: ${update.productId}`);
        }

        await client.query(
          `UPDATE inventory
           SET quantity = $1, last_updated = NOW()
           WHERE product_id = $2 AND tenant_id = $3 AND location = $4`,
          [newQuantity, update.productId, update.tenantId, 'main']
        );

        await client.query(
          `INSERT INTO stock_movements (product_id, quantity_change, reason, old_quantity, new_quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [update.productId, -update.quantity, update.reason, oldQuantity, newQuantity]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const inventoryRepository = new InventoryRepository();
