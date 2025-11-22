import { Database } from '../lib/database.types';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface ReceiptData {
  transaction: Transaction;
  items: Array<{
    product: Product;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  tenant: {
    name: string;
    address?: string;
    phone?: string;
    taxId?: string;
  };
}

export function generateReceiptHTML(data: ReceiptData): string {
  const { transaction, items, tenant } = data;
  const date = new Date(transaction.created_at);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสร็จ ${transaction.transaction_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Sarabun', 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.4;
      padding: 10mm;
      width: 80mm;
    }

    .receipt {
      width: 100%;
    }

    .header {
      text-align: center;
      margin-bottom: 10px;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
    }

    .shop-name {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .shop-info {
      font-size: 10px;
      color: #666;
    }

    .transaction-info {
      margin: 10px 0;
      font-size: 10px;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
    }

    .transaction-info div {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }

    .items {
      margin: 10px 0;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
    }

    .item {
      margin: 8px 0;
    }

    .item-name {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .item-details {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #666;
    }

    .totals {
      margin: 10px 0;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }

    .total-row.grand-total {
      font-size: 14px;
      font-weight: bold;
      padding-top: 5px;
      border-top: 1px solid #000;
    }

    .payment-info {
      margin: 10px 0;
      text-align: center;
      border-top: 1px dashed #000;
      padding-top: 10px;
      font-size: 10px;
    }

    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }

    @media print {
      body {
        width: 80mm;
        padding: 0;
      }

      @page {
        size: 80mm auto;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="shop-name">${tenant.name}</div>
      ${tenant.address ? `<div class="shop-info">${tenant.address}</div>` : ''}
      ${tenant.phone ? `<div class="shop-info">โทร: ${tenant.phone}</div>` : ''}
      ${tenant.taxId ? `<div class="shop-info">เลขประจำตัวผู้เสียภาษี: ${tenant.taxId}</div>` : ''}
    </div>

    <div class="transaction-info">
      <div>
        <span>เลขที่บิล:</span>
        <span><strong>${transaction.transaction_number}</strong></span>
      </div>
      <div>
        <span>วันที่:</span>
        <span>${date.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}</span>
      </div>
      <div>
        <span>เวลา:</span>
        <span>${date.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
        })}</span>
      </div>
    </div>

    <div class="items">
      ${items
        .map(
          (item) => `
        <div class="item">
          <div class="item-name">${item.product.name}</div>
          <div class="item-details">
            <span>${item.quantity} × ฿${item.unit_price.toFixed(2)}</span>
            <span><strong>฿${item.subtotal.toFixed(2)}</strong></span>
          </div>
        </div>
      `
        )
        .join('')}
    </div>

    <div class="totals">
      <div class="total-row">
        <span>ยอดรวม:</span>
        <span>฿${transaction.subtotal.toFixed(2)}</span>
      </div>
      ${
        transaction.discount_amount > 0
          ? `
      <div class="total-row" style="color: green;">
        <span>ส่วนลด:</span>
        <span>-฿${transaction.discount_amount.toFixed(2)}</span>
      </div>
      `
          : ''
      }
      <div class="total-row">
        <span>ภาษี (${items[0]?.product.tax_rate || 7}%):</span>
        <span>฿${transaction.tax_amount.toFixed(2)}</span>
      </div>
      <div class="total-row grand-total">
        <span>ยอดชำระทั้งสิ้น:</span>
        <span>฿${transaction.total_amount.toFixed(2)}</span>
      </div>
    </div>

    <div class="payment-info">
      <div>ชำระโดย: <strong>${getPaymentMethodText(transaction.payment_method)}</strong></div>
    </div>

    <div class="footer">
      <div>ขอบคุณที่ใช้บริการ</div>
      <div>โปรดเก็บใบเสร็จไว้เป็นหลักฐาน</div>
    </div>
  </div>
</body>
</html>
  `;
}

function getPaymentMethodText(method: string): string {
  const methods: Record<string, string> = {
    cash: 'เงินสด',
    card: 'บัตรเครดิต/เดบิต',
    qr: 'QR Code',
    'e-wallet': 'กระเป๋าเงินอิเล็กทรอนิกส์',
    multiple: 'หลายช่องทาง',
  };
  return methods[method] || method;
}

export function printReceipt(data: ReceiptData): void {
  const html = generateReceiptHTML(data);

  const printWindow = window.open('', '_blank', 'width=300,height=600');

  if (!printWindow) {
    alert('กรุณาอนุญาตให้เปิดหน้าต่างใหม่เพื่อพิมพ์ใบเสร็จ');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 100);
    }, 250);
  };
}

export function downloadReceiptPDF(data: ReceiptData): void {
  void data;
  alert('กำลังพัฒนา: ดาวน์โหลด PDF ต้องติดตั้ง library เพิ่มเติม (jsPDF)');
}

export function emailReceipt(data: ReceiptData, email: string): void {
  void data;
  alert(`กำลังพัฒนา: ส่งใบเสร็จไปที่ ${email}`);
}
