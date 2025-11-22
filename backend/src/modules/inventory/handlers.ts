import { eventBus } from '../../events/eventBus';
import { EventNames, SaleCompletedEvent } from '../../types/events';
import { inventoryService } from './service';

const handleSaleCompleted = async (event: SaleCompletedEvent): Promise<void> => {
  try {
    console.log('[Inventory] Processing sale_completed event:', event.transactionId);

    await inventoryService.bulkDeductStock(event.items, event.tenantId);

    console.log('[Inventory] Stock deducted successfully for transaction:', event.transactionId);
  } catch (error) {
    console.error('[Inventory] Error handling sale_completed event:', error);
  }
};

export const initInventoryHandlers = (): void => {
  console.log('[Inventory] Initializing event handlers...');
  eventBus.onEvent<SaleCompletedEvent>(EventNames.SALE_COMPLETED, handleSaleCompleted);
  console.log('[Inventory] Event handlers initialized');
};
