import { useState } from 'react';
import { Search, Minus, Plus, Trash2, ShoppingCart, CreditCard, Scan, AlertTriangle } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { Database } from '../lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
}

interface POSInterfaceV2Props {
  products: Product[];
  tenantId: string;
  inventory: Map<string, number>;
  onCheckout: (items: CartItem[], totals: CheckoutTotals) => Promise<void>;
}

export interface CheckoutTotals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export function POSInterfaceV2({ products, inventory, onCheckout }: POSInterfaceV2Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [stockWarnings, setStockWarnings] = useState<Map<string, string>>(new Map());

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

  const getAvailableStock = (productId: string) => {
    const totalStock = inventory.get(productId) || 0;
    const inCart = cart.find(item => item.product.id === productId)?.quantity || 0;
    return totalStock - inCart;
  };

  const addToCart = (product: Product) => {
    const availableStock = getAvailableStock(product.id);

    if (availableStock <= 0) {
      setStockWarnings(prev => new Map(prev).set(product.id, 'สินค้าหมด'));
      setTimeout(() => {
        setStockWarnings(prev => {
          const next = new Map(prev);
          next.delete(product.id);
          return next;
        });
      }, 3000);
      return;
    }

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

    const product = cart.find(item => item.product.id === productId)?.product;
    if (!product) return;

    const availableStock = inventory.get(productId) || 0;
    if (newQuantity > availableStock) {
      alert(`มีสินค้าเพียง ${availableStock} ชิ้น`);
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

    for (const item of cart) {
      const availableStock = inventory.get(item.product.id) || 0;
      if (availableStock < item.quantity) {
        alert(`${item.product.name} มีสต็อกไม่เพียงพอ (เหลือ ${availableStock} ชิ้น)`);
        return;
      }
    }

    setLoading(true);
    try {
      await onCheckout(cart, totals);
      clearCart();
    } catch (error) {
      console.error('Checkout error:', error);
      alert('ไม่สามารถทำรายการได้ กรุณาลองอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาสินค้า ชื่อ, SKU, หรือบาร์โค้ด..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-24 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              <Scan className="w-4 h-4" />
              สแกน
            </button>
          </div>
        </div>

        {showScanner && (
          <BarcodeScanner
            onScan={(barcode) => {
              setSearchQuery(barcode);
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto pb-4">
          {filteredProducts.map((product) => {
            const stock = inventory.get(product.id) || 0;
            const available = getAvailableStock(product.id);
            const warning = stockWarnings.get(product.id);
            const lowStock = stock > 0 && stock <= 10;

            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={available <= 0}
                className={`flex flex-col bg-white border rounded-lg hover:border-blue-400 hover:shadow-md transition-all p-3 text-left group relative ${
                  available <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {lowStock && available > 0 && (
                  <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                    เหลือน้อย
                  </div>
                )}

                {available <= 0 && (
                  <div className="absolute inset-0 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full font-medium">
                      สินค้าหมด
                    </span>
                  </div>
                )}

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
                <p className="text-xs text-slate-500 mb-2">
                  {product.sku} • คงเหลือ {available}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  ฿{product.selling_price.toFixed(2)}
                </p>

                {warning && (
                  <div className="absolute inset-x-2 bottom-2 bg-red-100 border border-red-200 text-red-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {warning}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full lg:w-96 bg-white border border-slate-200 rounded-xl flex flex-col max-h-[600px] lg:max-h-full">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">ตะกร้าสินค้า</h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <ShoppingCart className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500">ตะกร้าว่างเปล่า</p>
              <p className="text-sm text-slate-400 mt-1">เพิ่มสินค้าเพื่อเริ่มทำรายการ</p>
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
                    ฿{item.product.selling_price.toFixed(2)} × {item.quantity}
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
              <span className="text-slate-600">ยอดรวม</span>
              <span className="font-medium">฿{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">ภาษี</span>
              <span className="font-medium">฿{totals.tax.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>ส่วนลด</span>
                <span className="font-medium">-฿{totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-slate-200">
              <span>ยอดชำระ</span>
              <span>฿{totals.total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            <CreditCard className="w-5 h-5" />
            {loading ? 'กำลังประมวลผล...' : 'ชำระเงิน'}
          </button>
        </div>
      </div>
    </div>
  );
}
