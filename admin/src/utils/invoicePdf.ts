import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bill } from '../types';

export interface InvoicePrintOptions {
  download?: boolean;
  autoPrint?: boolean;
  fileName?: string;
}

/**
 * Generates a clean, professional PDF Tax Invoice for Bhatigal Bhanu Restaurant.
 * Optionally triggers file download or auto-print.
 */
export function generateInvoicePdf(bill: Bill, options: InvoicePrintOptions = { download: true }): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 18;

  // 1. Restaurant Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(212, 139, 40); // Bhatigal Bhanu Gold
  doc.text('BHATIGAL BHANU', pageWidth / 2, currentY, { align: 'center' });

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text('Traditional Kathiyawadi & Gujarati Dining Experience', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Kothariya Ring Road, Rajkot, Gujarat - 360022', pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.5;
  doc.text('GSTIN: 24AAAFB1234A1Z8 | FSSAI: 10724026000123 | Phone: +91 98790 12345', pageWidth / 2, currentY, { align: 'center' });

  currentY += 6;
  doc.setDrawColor(212, 139, 40);
  doc.setLineWidth(0.8);
  doc.line(14, currentY, pageWidth - 14, currentY);

  currentY += 7;
  // Tax Invoice Tag
  doc.setFillColor(248, 245, 238);
  doc.roundedRect(pageWidth / 2 - 28, currentY - 4.5, 56, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 30, 30);
  doc.text('ORIGINAL TAX INVOICE', pageWidth / 2, currentY, { align: 'center' });

  currentY += 8;

  // 2. Invoice Meta Box
  const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const formattedDate = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);

  // Left column
  doc.text(`Invoice No:`, 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${bill.billNumber}`, 36, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text(`Table No:`, 14, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${bill.tableNumber || 'Dine-In / Counter'}`, 36, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text(`Customer:`, 14, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${bill.customerName || 'Walk-in Guest'}`, 36, currentY + 10);

  // Right column
  doc.setFont('helvetica', 'bold');
  doc.text(`Date:`, pageWidth - 65, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formattedDate}`, pageWidth - 45, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text(`Time:`, pageWidth - 65, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formattedTime}`, pageWidth - 45, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text(`Payment:`, pageWidth - 65, currentY + 10);
  doc.setFont('helvetica', 'bold');
  if (bill.status === 'PAID') {
    doc.setTextColor(25, 135, 84); // Green
    doc.text('PAID (SETTLED)', pageWidth - 45, currentY + 10);
  } else if (bill.status === 'PARTIALLY_PAID') {
    doc.setTextColor(255, 193, 7); // Yellow/Orange
    doc.text('PARTIALLY PAID', pageWidth - 45, currentY + 10);
  } else {
    doc.setTextColor(220, 53, 69); // Red
    doc.text('UNPAID', pageWidth - 45, currentY + 10);
  }

  currentY += 15;

  // 3. Items Table using jspdf-autotable
  const tableRows = (bill.items || []).map((it, idx) => [
    idx + 1,
    it.itemName,
    it.quantity,
    `₹${Number(it.unitPrice).toFixed(2)}`,
    `₹${Number(it.totalPrice).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Item Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [212, 139, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [30, 30, 30]
    },
    alternateRowStyles: {
      fillColor: [253, 251, 247]
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // 4. Financial Calculations Summary Box
  const summaryX = pageWidth - 80;
  let sumY = finalY;

  const drawRow = (label: string, value: string, isBold = false, isDanger = false, isTotal = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isTotal ? 11 : 9);
    doc.setTextColor(isDanger ? 220 : 50, isDanger ? 53 : 50, isDanger ? 69 : 50);
    doc.text(label, summaryX, sumY);
    doc.text(value, pageWidth - 14, sumY, { align: 'right' });
    sumY += isTotal ? 6.5 : 4.8;
  };

  drawRow('Subtotal:', `₹${Number(bill.subtotal).toFixed(2)}`);

  if (bill.discountAmount > 0) {
    drawRow('Discount:', `-₹${Number(bill.discountAmount).toFixed(2)}`, false, true);
  }

  const halfTax = (bill.taxAmount || 0) / 2;
  drawRow('CGST (2.5%):', `₹${halfTax.toFixed(2)}`);
  drawRow('SGST (2.5%):', `₹${halfTax.toFixed(2)}`);

  if (bill.serviceCharge > 0) {
    drawRow('Service Charge:', `₹${Number(bill.serviceCharge).toFixed(2)}`);
  }

  if (bill.roundOff !== 0) {
    drawRow('Round Off:', `${bill.roundOff > 0 ? '+' : ''}₹${Number(bill.roundOff).toFixed(2)}`);
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(summaryX, sumY - 1, pageWidth - 14, sumY - 1);
  sumY += 2;

  // Grand Total
  drawRow('Grand Total:', `₹${Number(bill.totalPayable).toFixed(2)}`, true, false, true);

  if (bill.paidAmount > 0 || bill.status === 'PAID') {
    const paidAmt = bill.status === 'PAID' ? (bill.paidAmount || bill.totalPayable) : bill.paidAmount;
    drawRow('Amount Paid:', `₹${Number(paidAmt).toFixed(2)}`, true);
    if (bill.balanceAmount > 0 && bill.status !== 'PAID') {
      drawRow('Balance Due:', `₹${Number(bill.balanceAmount).toFixed(2)}`, true, true);
    }
  }

  // 5. Footer & Terms
  const footerY = Math.max(sumY + 12, 260);
  doc.setDrawColor(220, 220, 220);
  doc.line(14, footerY, pageWidth - 14, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for dining with Bhatigal Bhanu! Please visit again.', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text('This is a computer-generated tax invoice and does not require a physical signature.', pageWidth / 2, footerY + 9, { align: 'center' });

  // Options Handling
  if (options.download !== false) {
    const fileName = options.fileName || `${bill.billNumber || 'INVOICE'}.pdf`;
    doc.save(fileName);
  }

  if (options.autoPrint) {
    doc.autoPrint();
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.src = blobUrl;
    document.body.appendChild(printFrame);
    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        window.open(blobUrl, '_blank');
      }
    };
  }

  return doc;
}

/**
 * Universal Native Receipt Printer:
 * Formats an 80mm thermal receipt / standard voucher and triggers window.print() immediately.
 * Works seamlessly with USB Thermal POS Slip Printers (Epson, TVS, etc.) & standard desktop printers.
 */
export function printInvoiceReceipt(bill: Bill): void {
  const printWindow = window.open('', '_blank', 'width=450,height=650,location=no,toolbar=no');
  if (!printWindow) {
    // If popup blocked, fallback to PDF auto-print
    generateInvoicePdf(bill, { autoPrint: true, download: false });
    return;
  }

  const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const formattedDate = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const itemsHtml = (bill.items || []).map(it => `
    <tr>
      <td style="padding: 4px 0; text-align: left;">
        <div style="font-weight: 600;">${it.itemName}</div>
        <small style="color: #666;">${it.quantity} x ₹${Number(it.unitPrice).toFixed(2)}</small>
      </td>
      <td style="padding: 4px 0; text-align: right; vertical-align: top; font-weight: 600;">
        ₹${Number(it.totalPrice).toFixed(2)}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${bill.billNumber}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 12px;
            color: #111;
            font-size: 13px;
            line-height: 1.35;
          }
          .receipt {
            max-width: 320px;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .brand-title {
            font-size: 19px;
            font-weight: 800;
            color: #b8731d;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .brand-sub {
            font-size: 11px;
            color: #555;
            margin: 2px 0;
          }
          .divider {
            border-top: 1px dashed #444;
            margin: 8px 0;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 11.5px;
            margin: 2px 0;
          }
          table.items {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin: 3px 0;
          }
          .grand-total {
            font-size: 16px;
            font-weight: 800;
            border-top: 1.5px solid #111;
            border-bottom: 1.5px solid #111;
            padding: 5px 0;
            margin-top: 5px;
          }
          .paid-tag {
            display: inline-block;
            background: #198754;
            color: #fff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 4px;
          }
          .unpaid-tag {
            display: inline-block;
            background: #dc3545;
            color: #fff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="text-center">
            <h1 class="brand-title">BHATIGAL BHANU</h1>
            <p class="brand-sub">Traditional Kathiyawadi Dining</p>
            <p style="font-size: 10px; color: #666; margin: 0;">Kothariya Ring Road, Rajkot - 360022</p>
            <p style="font-size: 10px; color: #666; margin: 0;">GSTIN: 24AAAFB1234A1Z8 | +91 98790 12345</p>
            <div>
              <span class="${bill.status === 'PAID' ? 'paid-tag' : 'unpaid-tag'}">
                ${bill.status === 'PAID' ? 'PAID TAX INVOICE' : 'UNPAID INVOICE'}
              </span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="meta-row">
            <span><strong>Bill No:</strong> ${bill.billNumber}</span>
            <span><strong>Table:</strong> ${bill.tableNumber || 'Dine-In'}</span>
          </div>
          <div class="meta-row">
            <span><strong>Date:</strong> ${formattedDate}</span>
            <span><strong>Time:</strong> ${formattedTime}</span>
          </div>
          <div class="meta-row">
            <span><strong>Guest:</strong> ${bill.customerName || 'Walk-in'}</span>
            <span><strong>Status:</strong> ${bill.status}</span>
          </div>

          <div class="divider"></div>

          <table class="items">
            ${itemsHtml}
          </table>

          <div class="divider"></div>

          <div class="total-row">
            <span>Subtotal:</span>
            <span>₹${Number(bill.subtotal).toFixed(2)}</span>
          </div>
          ${bill.discountAmount > 0 ? `
            <div class="total-row" style="color: #dc3545;">
              <span>Discount:</span>
              <span>-₹${Number(bill.discountAmount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>CGST (2.5%):</span>
            <span>₹${((bill.taxAmount || 0) / 2).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>SGST (2.5%):</span>
            <span>₹${((bill.taxAmount || 0) / 2).toFixed(2)}</span>
          </div>
          ${bill.serviceCharge > 0 ? `
            <div class="total-row">
              <span>Service Charge:</span>
              <span>₹${Number(bill.serviceCharge).toFixed(2)}</span>
            </div>
          ` : ''}
          ${bill.roundOff !== 0 ? `
            <div class="total-row">
              <span>Round Off:</span>
              <span>${bill.roundOff > 0 ? '+' : ''}₹${Number(bill.roundOff).toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="total-row grand-total">
            <span>GRAND TOTAL:</span>
            <span>₹${Number(bill.totalPayable).toFixed(2)}</span>
          </div>

          ${bill.status === 'PAID' ? `
            <div class="total-row" style="margin-top: 4px; font-weight: 600; color: #198754;">
              <span>Amount Paid:</span>
              <span>₹${Number(bill.paidAmount || bill.totalPayable).toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="divider"></div>

          <div class="text-center" style="font-size: 11px; color: #555; margin-top: 10px;">
            <p style="margin: 2px 0;">Thank you for dining with us!</p>
            <p style="margin: 2px 0; font-size: 9.5px;">Please Visit Again</p>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
