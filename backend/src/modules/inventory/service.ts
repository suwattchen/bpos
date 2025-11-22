import { inventoryRepository, Product, StockUpdate } from './repository';
import { eventBus } from '../../events/eventBus';
import { EventNames, StockUpdatedEvent } from '../../types/events';

class InventoryService {
  async getProduct(productId: string, tenantId: string): Promise<Product | null> {
    return inventoryRepository.getProductById(productId, tenantId);
  }

  async getProductByBarcode(barcode: string, tenantId: string): Promise<Product | null> {
    return inventoryRepository.getProductByBarcode(barcode, tenantId);
  }

  async getAllProducts(tenantId: string): Promise<Product[]> {
    return inventoryRepository.getAllProducts(tenantId);
  }

  async searchProducts(searchTerm: string, tenantId: string): Promise<Product[]> {
    return inventoryRepository.searchProducts(searchTerm, tenantId);
  }

  async checkStockAvailability(productId: string, tenantId: string, quantity: number): Promise<boolean> {
    return inventoryRepository.checkInventory(productId, tenantId, quantity);
  }

  async bulkDeductStock(items: Array<{ productId: string; quantity: number }>, tenantId: string): Promise<void> {
    const updates: StockUpdate[] = items.map(item => ({
      productId: item.productId,
      tenantId,
      quantity: item.quantity,
      reason: 'sale' as const,
    }));

    await inventoryRepository.bulkDeductStock(updates);

    for (const item of items) {
      const product = await inventoryRepository.getProductById(item.productId, tenantId);
      if (product) {
        const event: StockUpdatedEvent = {
          productId: product.id,
          tenantId,
          oldQuantity: 0,
          newQuantity: 0,
          reason: 'sale',
          timestamp: new Date(),
        };
        eventBus.emitEvent(EventNames.STOCK_UPDATED, event);
      }
    }
  }
}

export const inventoryService = new InventoryService();
