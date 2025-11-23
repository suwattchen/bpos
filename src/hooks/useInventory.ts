import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface Inventory {
  id: string;
  tenant_id: string;
  product_id: string;
  location: string;
  quantity: number;
  last_updated: string;
}

export function useInventory(tenantId: string | undefined | null) {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.inventory.list();
      if (response.error) {
        throw new Error(response.error);
      }
      setInventory(response.data || []);
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    loadInventory();
  }, [tenantId, loadInventory]);

  const checkStock = async (productId: string, location: string = 'main'): Promise<number> => {
    const item = inventory.find(
      (inv) => inv.product_id === productId && inv.location === location
    );
    return item?.quantity || 0;
  };

  const updateStock = async (
    productId: string,
    quantity: number,
    location: string = 'main'
  ): Promise<void> => {
    if (!tenantId) throw new Error('Tenant ID required');

    const response = await api.inventory.update({
      product_id: productId,
      location,
      quantity,
    });

    if (response.error) {
      throw new Error(response.error);
    }

    await loadInventory();
  };

  const decreaseStock = async (
    productId: string,
    amount: number,
    location: string = 'main'
  ): Promise<void> => {
    const currentStock = await checkStock(productId, location);
    if (currentStock < amount) {
      throw new Error('Insufficient stock');
    }
    await updateStock(productId, currentStock - amount, location);
  };

  const increaseStock = async (
    productId: string,
    amount: number,
    location: string = 'main'
  ): Promise<void> => {
    const currentStock = await checkStock(productId, location);
    await updateStock(productId, currentStock + amount, location);
  };

  return {
    inventory,
    loading,
    error,
    checkStock,
    updateStock,
    decreaseStock,
    increaseStock,
    reload: loadInventory,
  };
}
