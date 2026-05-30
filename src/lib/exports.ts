import type { Order } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './types';

export function exportToCSV(orders: Order[], filename: string = 'modeltex-pedidos') {
  const headers = ['Pedido #', 'Cliente', 'Teléfono', 'Artículo', 'Prenda', 'Talles', 'Qty', 'Tipo trabajo', 'Estado', 'Prioridad', 'Precio', 'Pagado', 'Saldo', 'Entrega', 'Creado'];
  const rows = orders.map(o => [
    o.order_number,
    o.customer_name,
    o.phone,
    o.article_name || o.garment_type,
    o.garment_type,
    o.sizes,
    o.quantity,
    o.work_type,
    STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG]?.label || o.status,
    PRIORITY_CONFIG[o.priority as keyof typeof PRIORITY_CONFIG]?.label || o.priority,
    o.price,
    o.paid_amount,
    o.remaining_balance,
    o.delivery_date || '',
    new Date(o.created_at).toLocaleDateString('es-AR'),
  ]);

  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

export function exportToPDFSimple(orders: Order[], _filename: string = 'ceo-modeltex-pedidos') {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CEO MODELTEX - Reporte de Pedidos</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #1a1a2e; background: #F3EFE3; }
        h1 { color: #0F4C5C; border-bottom: 2px solid #B8A4FF; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
        th { background: #0F4C5C; color: #F3EFE3; padding: 8px 4px; text-align: left; }
        td { padding: 6px 4px; border-bottom: 1px solid #D8CCFF; }
        tr:nth-child(even) { background: #FAF8F2; }
        .status { padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .total { margin-top: 20px; font-size: 13px; font-weight: bold; color: #0F4C5C; }
        @media print { body { background: white; } }
      </style>
    </head>
    <body>
      <h1>CEO MODELTEX - Reporte de Pedidos</h1>
      <p>Generado: ${new Date().toLocaleString('es-AR')}</p>
      <table>
        <thead>
          <tr>
            <th>Pedido</th><th>Cliente</th><th>Artículo</th><th>Qty</th>
            <th>Estado</th><th>Prioridad</th><th>Precio</th><th>Pagado</th><th>Saldo</th><th>Entrega</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>${o.order_number}</td>
              <td>${o.customer_name}</td>
              <td>${o.article_name || o.garment_type}</td>
              <td>${o.quantity}</td>
              <td>${STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG]?.label || o.status}</td>
              <td>${PRIORITY_CONFIG[o.priority as keyof typeof PRIORITY_CONFIG]?.label || o.priority}</td>
              <td>$${Number(o.price).toLocaleString('es-AR')}</td>
              <td>$${Number(o.paid_amount).toLocaleString('es-AR')}</td>
              <td>$${Number(o.remaining_balance).toLocaleString('es-AR')}</td>
              <td>${o.delivery_date || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total">
        Total Ventas: $${orders.reduce((s, o) => s + Number(o.price), 0).toLocaleString('es-AR')} |
        Pendiente: $${orders.reduce((s, o) => s + Number(o.remaining_balance), 0).toLocaleString('es-AR')}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
