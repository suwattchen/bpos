# Testing Guide

## การรัน Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

### 1. Unit Tests - POS Service
**Location**: `src/modules/pos/__tests__/service.test.ts`

**ทดสอบ**:
- ✅ สร้างการขายและ emit event
- ✅ Validation: ไม่มีสินค้า
- ✅ Validation: สินค้าไม่พบ
- ✅ Validation: สต็อกไม่พอ
- ✅ Rollback เมื่อเกิด error

**ตัวอย่าง Test**:
```typescript
it('should create a sale and emit sale_completed event', async () => {
  const input = {
    tenantId: 'tenant-1',
    items: [{ productId: 'product-1', quantity: 2 }],
    paymentMethod: 'cash',
  };

  const result = await posService.createSale(input);

  expect(result).toBeDefined();
  expect(emitSpy).toHaveBeenCalledWith(
    EventNames.SALE_COMPLETED,
    expect.objectContaining({
      transactionId: expect.any(String),
      tenantId: 'tenant-1',
    })
  );
});
```

### 2. Integration Tests - Event Flow
**Location**: `src/__tests__/event-flow.test.ts`

**ทดสอบ**:
- ✅ Event `sale_completed` ถูกส่งไป inventory และ recommendations
- ✅ Inventory handler ทำงานอัตโนมัติ
- ✅ Recommendations handler ทำงานอัตโนมัติ
- ✅ Error handling ทำงานถูกต้อง
- ✅ Event isolation (listeners ไม่รบกวนกัน)

**ตัวอย่าง Test**:
```typescript
it('should trigger inventory and recommendations handlers', async () => {
  const saleEvent: SaleCompletedEvent = {
    transactionId: 'txn-123',
    tenantId: 'tenant-1',
    items: [
      { productId: 'prod-1', quantity: 2, price: 100 },
    ],
    totalAmount: 200,
    timestamp: new Date(),
  };

  eventBus.emitEvent(EventNames.SALE_COMPLETED, saleEvent);

  await new Promise(resolve => setTimeout(resolve, 100));

  expect(inventoryService.bulkDeductStock).toHaveBeenCalled();
  expect(recommendationsService.updatePurchasePatterns).toHaveBeenCalled();
});
```

## Test Scenarios

### Scenario 1: การขายสำเร็จ
```
1. POS สร้างธุรกรรม
2. Emit sale_completed event
3. Inventory รับ event → ตัดสต็อก
4. Recommendations รับ event → อัพเดทรูปแบบ
```

### Scenario 2: การขายล้มเหลว (สต็อกไม่พอ)
```
1. POS ตรวจสอบสต็อก
2. พบว่าสต็อกไม่พอ
3. Throw error
4. Rollback transaction
5. ไม่มี event ถูกส่งออก
```

### Scenario 3: Error ใน Handler
```
1. POS emit event สำเร็จ
2. Inventory handler เกิด error
3. Log error แต่ไม่ crash
4. Recommendations handler ทำงานต่อได้
```

## Mocking Strategy

### Database Mocking
```typescript
jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
}));
```

### Service Mocking
```typescript
jest.mock('../../inventory');
(inventoryService.getProduct as jest.Mock).mockResolvedValue(mockProduct);
(inventoryService.checkStockAvailability as jest.Mock).mockResolvedValue(true);
```

## Best Practices

### 1. Test Isolation
- แต่ละ test ต้อง independent
- ใช้ `beforeEach` เพื่อ reset state
- ใช้ `jest.clearAllMocks()` ก่อนแต่ละ test

### 2. Async Testing
- ใช้ `async/await` สำหรับ async operations
- ใช้ `Promise` + `setTimeout` เพื่อรอ event handlers
```typescript
await new Promise(resolve => setTimeout(resolve, 100));
```

### 3. Event Testing
- Spy on `eventBus.emitEvent`
- Verify event name และ payload
- Test event isolation

### 4. Error Testing
- Test expected errors
- Test rollback behavior
- Test error logging

## Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical paths covered
- **Event Flow**: All event handlers tested

## Running Specific Tests

```bash
# Run specific test file
npm test -- service.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create a sale"

# Run with verbose output
npm test -- --verbose
```

## Debugging Tests

### 1. Console Output
```typescript
console.log('[DEBUG]', eventData);
```

### 2. Jest Debugging
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 3. Check Mocks
```typescript
console.log(mockFunction.mock.calls);
console.log(mockFunction.mock.results);
```

## Common Issues

### Issue: Tests timeout
**Solution**: เพิ่ม timeout
```typescript
it('test name', async () => {
  // test code
}, 10000); // 10 seconds
```

### Issue: Event handlers ไม่ทำงาน
**Solution**: เพิ่มเวลารอ
```typescript
await new Promise(resolve => setTimeout(resolve, 200));
```

### Issue: Mocks ไม่ reset
**Solution**: ใช้ `beforeEach`
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Next Steps

1. เพิ่ม tests สำหรับ edge cases
2. เพิ่ม E2E tests
3. Setup CI/CD pipeline
4. Add test coverage reporting
