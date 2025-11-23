import { useState } from 'react';
import { Search, Minus, Plus, Trash2, ShoppingCart, CreditCard } from 'lucide-react';

interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku: string;
  barcode?: string;
  category_id?: string;
  cost_price: number;
  selling_price: number;
  tax_rate: number;
  description?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
}

interface POSInterfaceProps {
  products: Product[];
  tenantId: string;
  onCheckout: (items: CartItem[], totals: CheckoutTotals) => Promise<void>;
}

export interface CheckoutTotals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export function POSInterface({ products, onCheckout }: POSInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredProducts = products.filter((p) =>
    p.is_active &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const calculateItemTotals = (product: Product, quantity: number) => {
    const subtotal = product.selling_price * quantity;
    const tax = (subtotal * product.tax_rate) / 100;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);

      if (existing) {
        const newQuantity = existing.quantity + 1;
        const totals = calculateItemTotals(product, newQuantity);
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQuantity, ...totals }
            : item
        );
      }

      const totals = calculateItemTotals(product, 1);
      return [...prev, { product, quantity: 1, ...totals }];
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const totals = calculateItemTotals(item.product, newQuantity);
          return { ...item, quantity: newQuantity, ...totals };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const totals: CheckoutTotals = cart.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      tax: acc.tax + item.tax,
      discount: 0,
      total: acc.total + item.total,
    }),
    { subtotal: 0, tax: 0, discount: 0, total: 0 }
  );

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    try {
      await onCheckout(cart, totals);
      clearCart();
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to complete checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto pb-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="flex flex-col bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all p-3 text-left group"
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-24 object-cover rounded-md mb-2"
                />
              ) : (
                <div className="w-full h-24 bg-slate-100 rounded-md mb-2 flex items-center justify-center">
                  <ShoppingCart className="w-8 h-8 text-slate-300" />
                </div>
              )}
              <h3 className="font-medium text-slate-900 text-sm line-clamp-2 mb-1 group-hover:text-blue-600">
                {product.name}
              </h3>
              <p className="text-xs text-slate-500 mb-2">{product.sku}</p>
              <p className="text-lg font-semibold text-slate-900">
                ฿{product.selling_price.toFixed(2)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="w-96 bg-white border border-slate-200 rounded-xl flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Cart</h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500">Cart is empty</p>
              <p className="text-sm text-slate-400 mt-1">Add products to get started</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                {item.product.image_url ? (
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-slate-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-slate-900 truncate">
                    {item.product.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    ฿{item.product.selling_price.toFixed(2)} each
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-300 rounded-md">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 hover:bg-slate-100 rounded-l"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 hover:bg-slate-100 rounded-r"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <span className="ml-auto font-semibold text-slate-900">
                      ฿{item.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium">฿{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tax</span>
              <span className="font-medium">฿{totals.tax.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span className="font-medium">-฿{totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-slate-200">
              <span>Total</span>
              <span>฿{totals.total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            <CreditCard className="w-5 h-5" />
            {loading ? 'Processing...' : 'Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}
