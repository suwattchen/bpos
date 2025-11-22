export interface SaleCompletedEvent {
  transactionId: string;
  tenantId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  customerId?: string;
  timestamp: Date;
}

export interface StockUpdatedEvent {
  productId: string;
  tenantId: string;
  oldQuantity: number;
  newQuantity: number;
  reason: 'sale' | 'restock' | 'adjustment';
  timestamp: Date;
}

export interface ProductCreatedEvent {
  productId: string;
  tenantId: string;
  name: string;
  category: string;
  timestamp: Date;
}

export interface ProductUpdatedEvent {
  productId: string;
  tenantId: string;
  changes: Record<string, any>;
  timestamp: Date;
}

export const EventNames = {
  SALE_COMPLETED: 'sale_completed',
  STOCK_UPDATED: 'stock_updated',
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
} as const;
