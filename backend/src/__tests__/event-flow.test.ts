import { eventBus } from '../events/eventBus';
import { EventNames, SaleCompletedEvent } from '../types/events';
import { initInventoryHandlers } from '../modules/inventory';
import { initRecommendationsHandlers } from '../modules/recommendations';
import { inventoryService } from '../modules/inventory';
import { recommendationsService } from '../modules/recommendations';

jest.mock('../modules/inventory/service');
jest.mock('../modules/recommendations/service');

describe('Event Flow Integration', () => {
  beforeAll(() => {
    initInventoryHandlers();
    initRecommendationsHandlers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sale_completed event flow', () => {
    it('should trigger inventory and recommendations handlers', async () => {
      const mockBulkDeductStock = jest.fn().mockResolvedValue(undefined);
      const mockUpdatePurchasePatterns = jest.fn().mockResolvedValue(undefined);

      (inventoryService.bulkDeductStock as jest.Mock) = mockBulkDeductStock;
      (recommendationsService.updatePurchasePatterns as jest.Mock) = mockUpdatePurchasePatterns;

      const saleEvent: SaleCompletedEvent = {
        transactionId: 'txn-123',
        tenantId: 'tenant-1',
        items: [
          { productId: 'prod-1', quantity: 2, price: 100 },
          { productId: 'prod-2', quantity: 1, price: 50 },
        ],
        totalAmount: 250,
        timestamp: new Date(),
      };

      eventBus.emitEvent(EventNames.SALE_COMPLETED, saleEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockBulkDeductStock).toHaveBeenCalledWith(
        [
          { productId: 'prod-1', quantity: 2, price: 100 },
          { productId: 'prod-2', quantity: 1, price: 50 },
        ],
        'tenant-1'
      );

      expect(mockUpdatePurchasePatterns).toHaveBeenCalledWith(
        [
          { productId: 'prod-1', quantity: 2, price: 100 },
          { productId: 'prod-2', quantity: 1, price: 50 },
        ],
        'tenant-1'
      );
    });

    it('should handle inventory handler errors gracefully', async () => {
      const mockBulkDeductStock = jest.fn().mockRejectedValue(new Error('Stock deduction failed'));
      const mockUpdatePurchasePatterns = jest.fn().mockResolvedValue(undefined);

      (inventoryService.bulkDeductStock as jest.Mock) = mockBulkDeductStock;
      (recommendationsService.updatePurchasePatterns as jest.Mock) = mockUpdatePurchasePatterns;

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const saleEvent: SaleCompletedEvent = {
        transactionId: 'txn-456',
        tenantId: 'tenant-1',
        items: [{ productId: 'prod-1', quantity: 1, price: 100 }],
        totalAmount: 100,
        timestamp: new Date(),
      };

      eventBus.emitEvent(EventNames.SALE_COMPLETED, saleEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Inventory] Error handling sale_completed event:',
        expect.any(Error)
      );

      expect(mockUpdatePurchasePatterns).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle recommendations handler errors gracefully', async () => {
      const mockBulkDeductStock = jest.fn().mockResolvedValue(undefined);
      const mockUpdatePurchasePatterns = jest.fn().mockRejectedValue(new Error('Pattern update failed'));

      (inventoryService.bulkDeductStock as jest.Mock) = mockBulkDeductStock;
      (recommendationsService.updatePurchasePatterns as jest.Mock) = mockUpdatePurchasePatterns;

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const saleEvent: SaleCompletedEvent = {
        transactionId: 'txn-789',
        tenantId: 'tenant-1',
        items: [{ productId: 'prod-1', quantity: 1, price: 100 }],
        totalAmount: 100,
        timestamp: new Date(),
      };

      eventBus.emitEvent(EventNames.SALE_COMPLETED, saleEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Recommendations] Error handling sale_completed event:',
        expect.any(Error)
      );

      expect(mockBulkDeductStock).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('event isolation', () => {
    it('should allow multiple listeners without interference', async () => {
      let inventoryCalled = false;
      let recommendationsCalled = false;

      const inventoryHandler = async () => {
        inventoryCalled = true;
      };

      const recommendationsHandler = async () => {
        recommendationsCalled = true;
      };

      eventBus.onEvent('test_event', inventoryHandler);
      eventBus.onEvent('test_event', recommendationsHandler);

      eventBus.emitEvent('test_event', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(inventoryCalled).toBe(true);
      expect(recommendationsCalled).toBe(true);

      eventBus.offEvent('test_event', inventoryHandler);
      eventBus.offEvent('test_event', recommendationsHandler);
    });
  });
});
