export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Json;
          subscription_status: 'active' | 'suspended' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Json;
          subscription_status?: 'active' | 'suspended' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          settings?: Json;
          subscription_status?: 'active' | 'suspended' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenant_users: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: 'system_admin' | 'tenant_admin' | 'manager' | 'cashier';
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role: 'system_admin' | 'tenant_admin' | 'manager' | 'cashier';
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: 'system_admin' | 'tenant_admin' | 'manager' | 'cashier';
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_users_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          category_id: string | null;
          sku: string;
          barcode: string | null;
          name: string;
          description: string;
          image_url: string | null;
          cost_price: number;
          selling_price: number;
          tax_rate: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          category_id?: string | null;
          sku: string;
          barcode?: string | null;
          name: string;
          description?: string;
          image_url?: string | null;
          cost_price?: number;
          selling_price: number;
          tax_rate?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          category_id?: string | null;
          sku?: string;
          barcode?: string | null;
          name?: string;
          description?: string;
          image_url?: string | null;
          cost_price?: number;
          selling_price?: number;
          tax_rate?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory: {
        Row: {
          id: string;
          tenant_id: string;
          product_id: string;
          location: string;
          quantity: number;
          reorder_level: number;
          last_updated: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          product_id: string;
          location?: string;
          quantity?: number;
          reorder_level?: number;
          last_updated?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          product_id?: string;
          location?: string;
          quantity?: number;
          reorder_level?: number;
          last_updated?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          customer_code: string;
          name: string;
          email: string | null;
          phone: string | null;
          loyalty_points: number;
          total_spent: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_code: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          loyalty_points?: number;
          total_spent?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_code?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          loyalty_points?: number;
          total_spent?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          tenant_id: string;
          transaction_number: string;
          customer_id: string | null;
          cashier_id: string;
          subtotal: number;
          tax_amount: number;
          discount_amount: number;
          total_amount: number;
          payment_method: 'cash' | 'card' | 'qr' | 'e-wallet' | 'multiple';
          payment_status: 'completed' | 'refunded' | 'cancelled';
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          transaction_number: string;
          customer_id?: string | null;
          cashier_id: string;
          subtotal?: number;
          tax_amount?: number;
          discount_amount?: number;
          total_amount: number;
          payment_method?: 'cash' | 'card' | 'qr' | 'e-wallet' | 'multiple';
          payment_status?: 'completed' | 'refunded' | 'cancelled';
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          transaction_number?: string;
          customer_id?: string | null;
          cashier_id?: string;
          subtotal?: number;
          tax_amount?: number;
          discount_amount?: number;
          total_amount?: number;
          payment_method?: 'cash' | 'card' | 'qr' | 'e-wallet' | 'multiple';
          payment_status?: 'completed' | 'refunded' | 'cancelled';
          notes?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      transaction_items: {
        Row: {
          id: string;
          tenant_id: string;
          transaction_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          tax_amount: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          transaction_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_amount?: number;
          tax_amount?: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          transaction_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          discount_amount?: number;
          tax_amount?: number;
          subtotal?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transaction_items_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transaction_items_transaction_id_fkey';
            columns: ['transaction_id'];
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transaction_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      promotions: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string;
          type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle';
          value: number;
          conditions: Json;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string;
          type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle';
          value?: number;
          conditions?: Json;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string;
          type?: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle';
          value?: number;
          conditions?: Json;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'promotions_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
