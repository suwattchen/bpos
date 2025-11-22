import { posService } from '../service';
import { eventBus } from '../../../events/eventBus';
import { EventNames } from '../../../types/events';
import { inventoryService } from '../../inventory';

jest.mock('../../inventory');
jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
    query: jest.fn(),
  },
}));

describe('POS Service', () => {
  let mockProduct: any;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProduct = {
      id: 'product-1',
      tenant_id: 'tenant-1',
      name: 'Test Product',
      selling_price: 100,
      is_active: true,
    };

    (inventoryService.getProduct as jest.Mock).mockResolvedValue(mockProduct);
    (inventoryService.checkStockAvailability as jest.Mock).mockResolvedValue(true);

    emitSpy = jest.spyOn(eventBus, 'emitEvent');
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  describe('createSale', () => {
    it('should create a sale and emit sale_completed event', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 'txn-1',
              transaction_number: 'TXN-123',
              tenant_id: 'tenant-1',
              customer_id: null,
              subtotal: 200,
              tax_amount: 14,
              discount_amount: 0,
              total_amount: 214,
              payment_method: 'cash',
              status: 'completed',
              notes: '',
              created_at: new Date(),
            }]
          })
          .mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const pool = require('../../../config/database').default;
      pool.connect.mockResolvedValue(mockClient);

      const input = {
        tenantId: 'tenant-1',
        items: [
          { productId: 'product-1', quantity: 2 },
        ],
        paymentMethod: 'cash',
      };

      const result = await posService.createSale(input);

      expect(result).toBeDefined();
      expect(result.transactionNumber).toBe('TXN-123');
      expect(result.totalAmount).toBe(214);

      expect(emitSpy).toHaveBeenCalledWith(
        EventNames.SALE_COMPLETED,
        expect.objectContaining({
          transactionId: 'txn-1',
          tenantId: 'tenant-1',
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: 'product-1',
              quantity: 2,
            })
          ]),
        })
      );

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if no items provided', async () => {
      const input = {
        tenantId: 'tenant-1',
        items: [],
        paymentMethod: 'cash',
      };

      await expect(posService.createSale(input)).rejects.toThrow('Sale must have at least one item');
    });

    it('should throw error if product not found', async () => {
      (inventoryService.getProduct as jest.Mock).mockResolvedValue(null);

      const input = {
        tenantId: 'tenant-1',
        items: [{ productId: 'invalid-product', quantity: 1 }],
        paymentMethod: 'cash',
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const pool = require('../../../config/database').default;
      pool.connect.mockResolvedValue(mockClient);

      await expect(posService.createSale(input)).rejects.toThrow('Product not found');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw error if insufficient stock', async () => {
      (inventoryService.checkStockAvailability as jest.Mock).mockResolvedValue(false);

      const input = {
        tenantId: 'tenant-1',
        items: [{ productId: 'product-1', quantity: 100 }],
        paymentMethod: 'cash',
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const pool = require('../../../config/database').default;
      pool.connect.mockResolvedValue(mockClient);

      await expect(posService.createSale(input)).rejects.toThrow('Insufficient stock');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback transaction on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockRejectedValueOnce(new Error('Database error')),
        release: jest.fn(),
      };

      const pool = require('../../../config/database').default;
      pool.connect.mockResolvedValue(mockClient);

      const input = {
        tenantId: 'tenant-1',
        items: [{ productId: 'product-1', quantity: 1 }],
        paymentMethod: 'cash',
      };

      await expect(posService.createSale(input)).rejects.toThrow('Database error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
