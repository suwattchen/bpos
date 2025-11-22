import { eventBus } from '../../events/eventBus';
import { EventNames, SaleCompletedEvent } from '../../types/events';
import { recommendationsService } from './service';

const handleSaleCompleted = async (event: SaleCompletedEvent): Promise<void> => {
  try {
    console.log('[Recommendations] Processing sale_completed event:', event.transactionId);

    await recommendationsService.updatePurchasePatterns(event.items, event.tenantId);

    console.log('[Recommendations] Purchase patterns updated for transaction:', event.transactionId);
  } catch (error) {
    console.error('[Recommendations] Error handling sale_completed event:', error);
  }
};

export const initRecommendationsHandlers = (): void => {
  console.log('[Recommendations] Initializing event handlers...');
  eventBus.onEvent<SaleCompletedEvent>(EventNames.SALE_COMPLETED, handleSaleCompleted);
  console.log('[Recommendations] Event handlers initialized');
};
