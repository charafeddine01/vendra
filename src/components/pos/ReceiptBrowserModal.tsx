import React, { useState, useEffect, useCallback } from 'react';
import { CompanySettings } from '../../types';
import { ApiService } from '../../services/api';
import { HardwareService } from '../../services/hardwareService';
import { X, ChevronLeft, ChevronRight, Search, Printer, Receipt, RotateCcw, Usb } from 'lucide-react';

interface Props {
  isOpen: boolean;
  settings: CompanySettings | null;
  onClose: () => void;
}

export const ReceiptBrowserModal: React.FC<Props> = ({ isOpen, settings, onClose }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const primarySymbol = settings?.primary_currency_symbol || '$';
  const secondarySymbol = settings?.secondary_currency_symbol || '€';

  const fetchOrders = useCallback(async (searchTerm = '') => {
    setLoading(true);
    const res = await ApiService.request('pos.orders.list', {
      search: searchTerm,
      limit: 50,
      order: 'DESC',
    });
    setLoading(false);
    if (res.success && res.data) {
      const list = res.data.orders || res.data || [];
      setOrders(list);
      setTotal(res.data.total || list.length);
      setCurrentIndex(0);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

  if (!isOpen) return null;

  const currentOrder = orders[currentIndex] || null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(search);
  };

  // Orders are sorted DESC (index 0 = most recent / latest receipt)
  const handleOlder = () => setCurrentIndex((i) => Math.min(orders.length - 1, i + 1));
  const handleNewer = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleLatest = () => setCurrentIndex(0);

  const items = currentOrder?.items || currentOrder?.order_items || [];

  const handleEscPosPrint = async () => {
    if (!currentOrder) return;
    const rawBytes = HardwareService.generateEscPosBytes({
      companyName: settings?.company_name || 'Vendra Store',
      invoiceNumber: currentOrder.invoice_number,
      dateStr: currentOrder.created_at || new Date().toISOString(),
      cashierName: currentOrder.cashier_name || 'Staff',
      items: items.map((it: any) => ({
        name: it.product_name || it.name,
        qty: it.quantity,
        price: it.unit_price,
        total: it.line_total || it.total,
      })),
      subtotal: Number(currentOrder.subtotal || 0),
      tax: Number(currentOrder.tax_total || 0),
      discount: Number(currentOrder.discount_total || 0),
      grandTotal: Number(currentOrder.grand_total || currentOrder.total_amount || 0),
      paidCash: Number(currentOrder.paid_cash || 0),
      changeGiven: Number(currentOrder.change_given || 0),
      footerText: settings?.receipt_footer || 'Thank You!',
      paperWidth: (settings?.receipt_width === '58mm' ? '58mm' : '80mm'),
      kickDrawer: false,
    });

    const printed = await HardwareService.printEscPosSerial(rawBytes);
    if (!printed) {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-white text-sm">Receipt History / أرشيف الفواتير</h2>
              <span className="text-[10px] text-slate-400">
                {total > 0 ? `${total} receipts found` : 'Lookup previous receipts'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLatest}
              className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-xl font-semibold transition flex items-center gap-1"
              title="Jump to the latest receipt"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Latest (آخر فاتورة)</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar - Part of invoice number, product name, or contents */}
        <form onSubmit={handleSearch} className="px-5 py-3 border-b border-slate-800 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partial invoice #, product name, barcode, customer..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/30"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                fetchOrders('');
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-xs transition"
            >
              Clear
            </button>
          )}
        </form>

        {/* Navigation Bar with Forward & Backward arrows */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={handleOlder}
            disabled={currentIndex >= orders.length - 1 || orders.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold"
            title="Browse to older receipt"
          >
            <ChevronLeft className="w-4 h-4 text-emerald-400" />
            <span>◀ Older (السابق)</span>
          </button>

          <div className="text-center">
            <span className="text-xs text-white font-mono font-bold">
              {orders.length > 0 ? `#${currentIndex + 1} of ${orders.length}` : '0 receipts'}
            </span>
            {currentIndex === 0 && orders.length > 0 && (
              <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                LATEST
              </span>
            )}
          </div>

          <button
            onClick={handleNewer}
            disabled={currentIndex === 0 || orders.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold"
            title="Browse to newer receipt"
          >
            <span>Newer (التالي) ▶</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span>Loading receipt details...</span>
            </div>
          ) : !currentOrder ? (
            <div className="text-center text-slate-400 text-sm py-16">
              <Receipt className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p>No receipts found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Order Header Card */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Invoice #</span>
                  <div className="font-bold text-white font-mono text-sm tracking-wide">{currentOrder.invoice_number || currentOrder.id}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Date & Time</span>
                  <div className="font-semibold text-slate-200">{currentOrder.created_at ? new Date(currentOrder.created_at).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Customer</span>
                  <div className="font-semibold text-slate-200 truncate">{currentOrder.customer_name || 'Walk-in'}</div>
                  {currentOrder.customer_phone && <div className="text-[10px] text-slate-400 font-mono">{currentOrder.customer_phone}</div>}
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Cashier</span>
                  <div className="font-semibold text-slate-200">{currentOrder.cashier_name || 'Staff'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Payment Method</span>
                  <div className="font-semibold text-emerald-400">{currentOrder.order_type || 'RETAIL'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Status</span>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {currentOrder.status || 'PAID'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-inner">
                <table className="w-full text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">Item Description</th>
                      <th className="px-3 py-2 text-center font-bold">Qty</th>
                      <th className="px-3 py-2 text-right font-bold">Unit Price</th>
                      <th className="px-3 py-2 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-500 italic">
                          No line items recorded for this order.
                        </td>
                      </tr>
                    ) : (
                      items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-750/30">
                          <td className="px-3 py-2 text-slate-200">
                            <div className="font-semibold">{item.product_name || item.name}</div>
                            {(item.barcode || item.sku) && (
                              <div className="text-[10px] text-slate-400 font-mono">{item.barcode || item.sku}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-300 font-mono font-bold">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">
                            {primarySymbol}{Number(item.unit_price || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-white font-mono">
                            {primarySymbol}{Number(item.line_total || item.total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-1.5 text-xs">
                {Number(currentOrder.subtotal) > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal</span>
                    <span className="font-mono">{primarySymbol}{Number(currentOrder.subtotal).toFixed(2)}</span>
                  </div>
                )}
                {Number(currentOrder.discount_total) > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Discount</span>
                    <span className="font-mono">-{primarySymbol}{Number(currentOrder.discount_total).toFixed(2)}</span>
                  </div>
                )}
                {Number(currentOrder.tax_total) > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Tax</span>
                    <span className="font-mono">{primarySymbol}{Number(currentOrder.tax_total).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-white text-base border-t border-slate-700 pt-2 items-baseline">
                  <span>Grand Total</span>
                  <div className="text-right">
                    <div className="text-emerald-400 font-mono">
                      {primarySymbol}{Number(currentOrder.grand_total || currentOrder.total_amount || 0).toFixed(2)}
                    </div>
                    {Number(currentOrder.grand_total_secondary) > 0 && (
                      <div className="text-[10px] text-slate-400 font-mono font-normal">
                        {secondarySymbol}{Number(currentOrder.grand_total_secondary).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Print Actions */}
        {currentOrder && (
          <div className="px-5 py-3 border-t border-slate-800 flex gap-2 shrink-0 bg-slate-900">
            <button
              onClick={handleEscPosPrint}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-emerald-600/30"
            >
              <Usb className="w-4 h-4" />
              <span>Thermal Receipt (ESC/POS)</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Standard Print</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
