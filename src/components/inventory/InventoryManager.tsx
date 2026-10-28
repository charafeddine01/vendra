import React, { useState, useEffect, useMemo } from 'react';
import { Warehouse, ProductBatch, CompanySettings } from '../../types';
import { ApiService } from '../../services/api';
import { I18nService } from '../../services/i18nService';
import {
  Boxes,
  ArrowRightLeft,
  Sliders,
  AlertTriangle,
  Clock,
  Warehouse as WhIcon,
  RefreshCw,
  Plus,
  CheckCircle2,
  X,
  Search,
  Package,
  ImageIcon
} from 'lucide-react';

interface Props {
  settings: CompanySettings | null;
}

export const InventoryManager: React.FC<Props> = ({ settings }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWhId, setSelectedWhId] = useState<number>(1);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [nearExpiryBatches, setNearExpiryBatches] = useState<ProductBatch[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState<number>(1);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustMode, setAdjustMode] = useState<'UNITS' | 'PACKS'>('UNITS');
  const [adjustReason, setAdjustReason] = useState('Physical Stock Count');

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferProductId, setTransferProductId] = useState<number>(1);
  const [transferToWh, setTransferToWh] = useState<number>(2);
  const [transferQty, setTransferQty] = useState<number>(5);

  const fetchInventory = async () => {
    setLoading(true);

    const [whRes, stockRes, expRes] = await Promise.all([
      ApiService.request('inventory.warehouses'),
      ApiService.request('inventory.stockLevels', { warehouse_id: selectedWhId, low_stock_only: lowStockOnly }),
      ApiService.request('inventory.nearExpiry', { days: 90 }),
    ]);

    setLoading(false);

    if (whRes.success && whRes.data) {
      setWarehouses(whRes.data.warehouses || []);
    }
    if (stockRes.success && stockRes.data) {
      setStockLevels(stockRes.data.stock_levels || []);
    }
    if (expRes.success && expRes.data) {
      setNearExpiryBatches(expRes.data.near_expiry_batches || []);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedWhId, lowStockOnly]);

  const selectedProductObj = useMemo(() => {
    return stockLevels.find((s) => s.product_id === adjustProductId);
  }, [stockLevels, adjustProductId]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await ApiService.request('inventory.adjust', {
      product_id: adjustProductId,
      warehouse_id: selectedWhId,
      quantity: adjustQty,
      unit_type: adjustMode,
      reason: adjustReason,
    });
    if (res.success) {
      setIsAdjustModalOpen(false);
      setAdjustQty(0);
      fetchInventory();
    } else {
      alert(res.error?.message || 'Adjustment failed');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await ApiService.request('inventory.transfer', {
      product_id: transferProductId,
      from_warehouse_id: selectedWhId,
      to_warehouse_id: transferToWh,
      quantity: transferQty,
    });
    if (res.success) {
      setIsTransferModalOpen(false);
      fetchInventory();
    } else {
      alert(res.error?.message || 'Transfer failed');
    }
  };

  // Filter & sort: zero-stock items always sorted to the end
  const filteredAndSorted = useMemo(() => {
    const list = stockLevels.filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.product_name?.toLowerCase().includes(q) ||
        s.sku?.toLowerCase().includes(q) ||
        s.barcode?.toLowerCase().includes(q) ||
        s.category_name?.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      const stockA = Number(a.current_quantity ?? 0);
      const stockB = Number(b.current_quantity ?? 0);
      if (stockA > 0 && stockB <= 0) return -1;
      if (stockA <= 0 && stockB > 0) return 1;
      return 0;
    });
  }, [stockLevels, search]);

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none overflow-hidden font-sans">
      {/* Top Controls */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <Boxes className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">
            {I18nService.t('nav.inventory')} ({stockLevels.length})
          </h2>

          {/* Warehouse Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
            <WhIcon className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedWhId}
              onChange={(e) => setSelectedWhId(parseInt(e.target.value, 10))}
              className="bg-transparent border-none text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id} className="bg-slate-800 text-white">
                  {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              lowStockOnly ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock Only</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stock by name, SKU..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => { setAdjustProductId(stockLevels[0]?.product_id || 1); setIsAdjustModalOpen(true); }}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Adjust Stock</span>
          </button>
          <button
            onClick={() => { setTransferProductId(stockLevels[0]?.product_id || 1); setIsTransferModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-md shadow-blue-600/30 flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Stock</span>
          </button>
        </div>
      </div>

      {/* Near Expiry Banner (FEFO Alert) */}
      {nearExpiryBatches.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold">FEFO Expiry Alert:</span>
            <span>{nearExpiryBatches.length} batch lots expiring within 90 days.</span>
          </div>
          <span className="text-[11px] font-mono text-amber-400">First-Expired, First-Out Enforced</span>
        </div>
      )}

      {/* Stock Levels Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="px-3 py-3 w-12 text-center">Image</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-3 py-3 text-center">Local Low Alert</th>
                <th className="px-3 py-3 text-center">Online Low Alert</th>
                <th className="px-4 py-3">Stock Valuation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-3 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAndSorted.map((s) => {
                const stockQty = Number(s.current_quantity ?? 0);
                const isZeroStock = stockQty <= 0;
                const lowLocal = Number(s.low_stock_local ?? s.alert_quantity ?? 5);
                const lowOnline = Number(s.low_stock_online ?? 5);
                const isLowLocal = stockQty > 0 && stockQty <= lowLocal;
                const isLowOnline = stockQty > 0 && stockQty <= lowOnline;
                const packQty = Number(s.pack_quantity || 1);
                const hasPack = packQty > 1;
                const valuation = stockQty * Number(s.cost_price || 0);

                return (
                  <tr
                    key={s.product_id}
                    className={`hover:bg-slate-850/50 transition ${
                      isZeroStock ? 'bg-slate-950/40 opacity-70' : ''
                    }`}
                  >
                    {/* Thumbnail */}
                    <td className="px-3 py-2.5 text-center">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.product_name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-700/80 mx-auto bg-slate-950"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-500">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Product Name & SKU */}
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-white block">{s.product_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{s.sku}</span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-2.5">{s.category_name || 'General'}</td>

                    {/* Current Stock */}
                    <td className="px-4 py-2.5 font-mono">
                      {isZeroStock ? (
                        <span className="bg-rose-950/80 text-rose-400 border border-rose-800/50 text-[10px] font-bold px-2 py-0.5 rounded-lg inline-block">
                          0.00 {s.unit_code}
                        </span>
                      ) : (
                        <div>
                          <span className={`font-bold text-sm ${isLowLocal ? 'text-rose-400' : 'text-white'}`}>
                            {stockQty.toFixed(2)} {s.unit_code}
                          </span>
                          {hasPack && stockQty > 0 && (
                            <div className="text-[10px] text-amber-300 font-bold">
                              {Math.floor(stockQty / packQty)} packs + {(stockQty % packQty).toFixed(0)} units
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Local Low Alert */}
                    <td className="px-3 py-2.5 text-center font-mono text-slate-300">
                      <span className={isLowLocal ? 'text-rose-400 font-bold' : ''}>
                        {lowLocal}
                      </span>
                    </td>

                    {/* Online Low Alert */}
                    <td className="px-3 py-2.5 text-center font-mono text-blue-300">
                      <span className={isLowOnline ? 'text-amber-400 font-bold' : ''}>
                        {lowOnline}
                      </span>
                    </td>

                    {/* Stock Valuation */}
                    <td className="px-4 py-2.5 font-mono text-slate-300">
                      ${valuation.toFixed(2)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-2.5">
                      {isZeroStock ? (
                        <span className="bg-rose-950/80 text-rose-400 border border-rose-800/50 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Zero Stock
                        </span>
                      ) : isLowLocal ? (
                        <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Local Low
                        </span>
                      ) : isLowOnline ? (
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Online Low
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Adequate
                        </span>
                      )}
                    </td>

                    {/* Quick Adjust Button */}
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => {
                          setAdjustProductId(s.product_id);
                          setAdjustQty(0);
                          setIsAdjustModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold transition"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setIsAdjustModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-white text-sm mb-4">Adjust Stock Quantity</h3>
            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Product</label>
                <select
                  value={adjustProductId}
                  onChange={(e) => setAdjustProductId(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                >
                  {stockLevels.map((s) => (
                    <option key={s.product_id} value={s.product_id}>
                      {s.product_name} ({s.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Mode Selector (Units vs Packs) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">Adjustment Unit</label>
                  {selectedProductObj && Number(selectedProductObj.pack_quantity) > 1 && (
                    <span className="text-[10px] text-amber-400 font-bold">
                      1 Pack = {selectedProductObj.pack_quantity} units
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setAdjustMode('UNITS')}
                    className={`py-1 rounded-lg text-xs font-bold transition ${
                      adjustMode === 'UNITS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Units
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustMode('PACKS')}
                    className={`py-1 rounded-lg text-xs font-bold transition ${
                      adjustMode === 'PACKS' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Packs
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Adjustment Quantity (+ / -) {adjustMode === 'PACKS' ? 'in Packs' : 'in Units'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. +5 or -2"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                />
                {adjustMode === 'PACKS' && selectedProductObj && Number(selectedProductObj.pack_quantity) > 1 && (
                  <span className="text-[11px] text-amber-300 font-bold block mt-1">
                    = {adjustQty * Number(selectedProductObj.pack_quantity)} total base units
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-blue-600/30"
              >
                Apply Adjustment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setIsTransferModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-white text-sm mb-4">Inter-Warehouse Transfer</h3>
            <form onSubmit={handleTransferSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Destination Warehouse</label>
                <select
                  value={transferToWh}
                  onChange={(e) => setTransferToWh(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                >
                  {warehouses.filter((w) => w.id !== selectedWhId).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Transfer Quantity</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-blue-600/30"
              >
                Execute Transfer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
