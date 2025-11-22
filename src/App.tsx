import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { POSInterface, CheckoutTotals } from './components/POSInterface';
import { ProductForm } from './components/ProductForm';
import { supabase } from './lib/supabase';
import { Database } from './lib/database.types';
import { registerServiceWorker, addOnlineStatusListener, checkOnlineStatus } from './utils/pwa';
import { Plus, Package } from 'lucide-react';
import { EmptyState } from './components/EmptyState';

type Product = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
}

function AppContent() {
  const { user, tenantUser, loading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(checkOnlineStatus());
  const [showProductForm, setShowProductForm] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    const cleanup = addOnlineStatusListener(setIsOnline);
    return cleanup;
  }, []);

  const loadData = useCallback(async () => {
    if (!tenantUser?.tenant_id) return;

    try {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantUser.tenant_id)
          .order('name'),
        supabase
          .from('categories')
          .select('*')
          .eq('tenant_id', tenantUser.tenant_id)
          .order('name'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setProducts((productsRes.data ?? []) as Product[]);
      setCategories((categoriesRes.data ?? []) as Category[]);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [tenantUser]);

  useEffect(() => {
    if (tenantUser?.tenant_id) {
      loadData();
    }
  }, [tenantUser, loadData]);

  const handleCheckout = async (items: CartItem[], totals: CheckoutTotals) => {
    if (!tenantUser?.tenant_id || !user) {
      throw new Error('User not authenticated');
    }

    const transactionNumber = `TXN-${Date.now()}`;

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        tenant_id: tenantUser.tenant_id,
        transaction_number: transactionNumber,
        cashier_id: user.id,
        subtotal: totals.subtotal,
        tax_amount: totals.tax,
        discount_amount: totals.discount,
        total_amount: totals.total,
        payment_method: 'cash',
        payment_status: 'completed',
      })
      .select()
      .single<Database['public']['Tables']['transactions']['Row']>();

    if (txError) throw txError;

    const transactionItems = items.map((item) => ({
      tenant_id: tenantUser.tenant_id,
      transaction_id: transaction.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.product.selling_price,
      tax_amount: item.tax,
      discount_amount: 0,
      subtotal: item.total,
    }));

    const { error: itemsError } = await supabase
      .from('transaction_items')
      .insert(transactionItems);

    if (itemsError) throw itemsError;

    alert(`Transaction ${transactionNumber} completed successfully!`);
  };

  const handleAddProduct = async (
    productData: Omit<Database['public']['Tables']['products']['Insert'], 'tenant_id'>,
    imageBlob?: Blob
  ) => {
    if (!tenantUser?.tenant_id) {
      throw new Error('Tenant not found');
    }

    let imageUrl = productData.image_url;

    if (imageBlob) {
      const fileName = `${tenantUser.tenant_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageBlob);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from('products').insert({
      ...productData,
      tenant_id: tenantUser.tenant_id,
      image_url: imageUrl,
    });

    if (error) throw error;

    await loadData();
    setShowProductForm(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !tenantUser) {
    return <LoginForm />;
  }

  const renderPage = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading data...</p>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'pos':
        return (
          <POSInterface
            products={products}
            tenantId={tenantUser.tenant_id}
            onCheckout={handleCheckout}
          />
        );

      case 'products':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Products</h2>
                <p className="text-slate-600 mt-1">{products.length} products in catalog</p>
              </div>
              <button
                onClick={() => setShowProductForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Product
              </button>
            </div>

            {products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Start building your product catalog by adding your first product"
                action={{
                  label: 'Add Your First Product',
                  onClick: () => setShowProductForm(true),
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-md mb-3"
                    />
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded-md mb-3 flex items-center justify-center">
                      <span className="text-slate-400 text-sm">No image</span>
                    </div>
                  )}
                  <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
                  <p className="text-xs text-slate-500 mb-2">{product.sku}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">
                      ฿{product.selling_price.toFixed(2)}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        product.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                ))}
              </div>
            )}

            {showProductForm && (
              <ProductForm
                onSubmit={handleAddProduct}
                onCancel={() => setShowProductForm(false)}
                categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              />
            )}
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
            </h2>
            <p className="text-slate-600">This section is under development</p>
          </div>
        );
    }
  };

  return (
    <Dashboard
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      isOnline={isOnline}
    >
      {renderPage()}
    </Dashboard>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
