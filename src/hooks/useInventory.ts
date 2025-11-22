import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Inventory = Database['public']['Tables']['inventory']['Row'];

export function useInventory(tenantId: string | undefined) {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('tenant_id', tenantId);

      if (fetchError) throw fetchError;
      setInventory((data ?? []) as Inventory[]);
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

    const existing = inventory.find(
      (inv) => inv.product_id === productId && inv.location === location
    );

    if (existing) {
      const { error } = await supabase
        .from('inventory')
        .update({
          quantity,
          last_updated: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('inventory')
        .insert({
          tenant_id: tenantId,
          product_id: productId,
          location,
          quantity,
          last_updated: new Date().toISOString(),
        });

      if (error) throw error;
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
