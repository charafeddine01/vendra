import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, Unit, TaxRate, CompanySettings, User } from '../../types';
import { ApiService } from '../../services/api';
import { I18nService } from '../../services/i18nService';
import { CategoryManagerModal } from './CategoryManagerModal';
import { OnlineDbModal } from './OnlineDbModal';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  Layers,
  Sparkles,
  Scale,
  Printer,
  CheckCircle2,
  X,
  DollarSign,
  Tag,
  Globe,
  Cloud,
  RefreshCw,
  ImageIcon,
  AlertTriangle
} from 'lucide-react';

interface Props {
  settings: CompanySettings | null;
  currentUser?: User | null;
}

export const ProductsManager: React.FC<Props> = ({ settings, currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [syncingOnline, setSyncingOnline] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Edit/Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [stockInputMode, setStockInputMode] = useState<'UNITS' | 'PACKS'>('UNITS');
  const [rawStockInput, setRawStockInput] = useState<number>(0);

  // Category Manager Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Online DB Modal State
  const [isOnlineDbModalOpen, setIsOnlineDbModalOpen] = useState(false);

  // Barcode Label Print Modal State
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);

  // Dedicated Restock (Stock In) Modal State
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockProductId, setRestockProductId] = useState<number | null>(null);
  const [restockProductName, setRestockProductName] = useState('');
  const [restockPackQty, setRestockPackQty] = useState(1);
  const [restockQty, setRestockQty] = useState(1);
  const [restockMode, setRestockMode] = useState<'UNITS' | 'PACKS'>('UNITS');
  const [restockReason, setRestockReason] = useState('Supplier Restock / Purchase');
  const [restockLoading, setRestockLoading] = useState(false);

  const fetchCatalog = async () => {
    setLoading(true);
    const res = await ApiService.request('pos.catalog');
    setLoading(false);
    if (res.success && res.data) {
      setProducts(res.data.products || []);
      setCategories(res.data.categories || []);
      setUnits(res.data.units || []);
      setTaxRates(res.data.tax_rates || []);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleOpenCreate = () => {
    setStockInputMode('UNITS');
    setRawStockInput(0);
    setEditingProduct({
      name: '',
      name_ar: '',
      sku: 'SKU-' + Math.floor(100000 + Math.random() * 900000),
      barcode: '',
      category_id: categories[0]?.id || 1,
      unit_id: units[0]?.id || 1,
      tax_rate_id: taxRates[0]?.id || 1,
      type: 'STANDARD',
      cost_price: 1.0,
      selling_price: 2.0,
      pack_price: 0,
      pack_quantity: 1,
      pack_barcode: '',
      min_order_price: 0,
      min_order_qty: 1,
      track_inventory: 1,
      alert_quantity: 5,
      low_stock_local: 5,
      low_stock_online: 5,
      is_online: 1,
      image_url: '',
      extra_barcodes: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setStockInputMode('UNITS');
    setRawStockInput(Number(p.stock_quantity ?? 0));
    setEditingProduct({
      ...p,
      is_online: p.is_online !== undefined ? (p.is_online ? 1 : 0) : 1,
      low_stock_local: p.low_stock_local ?? p.alert_quantity ?? 5,
      low_stock_online: p.low_stock_online ?? 5,
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name) return;

    setLoading(true);

    const payload: any = {
      ...editingProduct,
      stock_input_mode: stockInputMode,
      initial_stock: rawStockInput,
      low_stock_local: Number(editingProduct.low_stock_local ?? 5),
      low_stock_online: Number(editingProduct.low_stock_online ?? 5),
      is_online: editingProduct.is_online ? 1 : 0,
    };

    const res = await ApiService.request('products.save', payload);
    setLoading(false);

    if (res.success) {
      setIsModalOpen(false);
      fetchCatalog();
    } else {
      alert(res.error?.message || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this product?')) return;
    await ApiService.request('products.delete', { id });
    fetchCatalog();
  };

  const handleSyncOnlineDb = async () => {
    setSyncingOnline(true);
    setSyncMessage(null);
    try {
      const res = await ApiService.request('sync.onlineDb.pushAll');
      if (res.success) {
        setSyncMessage(res.data?.message || 'Replication to Online Database completed successfully!');
      } else {
        setSyncMessage('Sync notice: ' + (res.error?.message || 'Online DB not reachable or disabled in config.'));
      }
    } catch (e: any) {
      setSyncMessage('Sync notice: ' + (e?.message || 'Dual DB sync failed.'));
    } finally {
      setSyncingOnline(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProductId || restockQty <= 0) return;
    setRestockLoading(true);
    try {
      const res = await ApiService.request('inventory.adjust', {
        product_id: restockProductId,
        warehouse_id: 1,
        quantity: restockQty,
        unit_type: restockMode,
        reason: restockReason || 'Supplier Restock / Purchase',
      });
      if (res.success) {
        setIsRestockModalOpen(false);
        fetchCatalog();
        if (editingProduct && editingProduct.id === restockProductId) {
          const addedUnits = restockMode === 'PACKS' ? restockQty * restockPackQty : restockQty;
          setEditingProduct((prev: any) => ({
            ...prev,
            current_stock: Number(prev.current_stock ?? 0) + addedUnits,
          }));
        }
        alert('Stock added successfully and recorded in audit movement logs.');
      } else {
        alert(res.error?.message || 'Failed to add stock');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add stock');
    } finally {
      setRestockLoading(false);
    }
  };

  // Filter & sort: zero-stock items sorted to the bottom
  const filteredAndSorted = useMemo(() => {
    const list = products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category_id !== selectedCategory) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.name_ar && p.name_ar.toLowerCase().includes(q)) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.pack_barcode && p.pack_barcode.toLowerCase().includes(q))
      );
    });

    // Zero stock always sorted to the end
    return list.sort((a, b) => {
      const stockA = Number(a.stock_quantity ?? 0);
      const stockB = Number(b.stock_quantity ?? 0);
      if (stockA > 0 && stockB <= 0) return -1;
      if (stockA <= 0 && stockB > 0) return 1;
      return 0;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-bold text-white">
            {I18nService.t('nav.products')} ({products.length})
          </h2>
          {syncMessage && (
            <div className="ml-3 px-3 py-1 rounded-xl bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-1.5 animate-fadeIn">
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span>{syncMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search */}
          <div className="relative w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, SKU, barcode..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-bold focus:outline-none"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Manage Categories Button */}
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5 shadow-sm"
            title="Manage Categories"
          >
            <Tag className="w-4 h-4 text-amber-400" />
            <span>Categories</span>
          </button>

          {/* Configure Online DB Button */}
          <button
            onClick={() => setIsOnlineDbModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5 shadow-sm"
            title="Configure Online Shop MySQL Database Replication"
          >
            <Cloud className="w-4 h-4 text-blue-400" />
            <span>Online DB Config</span>
          </button>

          {/* Sync to Online DB Button */}
          <button
            onClick={handleSyncOnlineDb}
            disabled={syncingOnline}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5 shadow-sm"
            title="Replicate products & categories to Online Shop DB"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${syncingOnline ? 'animate-spin' : ''}`} />
            <span>{syncingOnline ? 'Syncing...' : 'Sync Online DB'}</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-blue-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="px-3 py-3 w-12 text-center">Image</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">SKU / Barcodes</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3 text-center">Online Shop</th>
                <th className="px-3 py-3">Unit Price</th>
                <th className="px-3 py-3">Pack Price</th>
                <th className="px-4 py-3">Stock on Hand</th>
                <th className="px-3 py-3 text-center">Low Stock (Loc/Onl)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAndSorted.map((p) => {
                const stockQty = Number(p.stock_quantity ?? 0);
                const isZeroStock = stockQty <= 0 && p.track_inventory === 1;
                const packQty = Number(p.pack_quantity || 1);
                const hasPack = packQty > 1;
                const lowLocal = Number(p.low_stock_local ?? p.alert_quantity ?? 5);
                const lowOnline = Number(p.low_stock_online ?? 5);
                const isLowLocal = stockQty > 0 && stockQty <= lowLocal;
                const catObj = categories.find((c) => c.id === p.category_id);

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-850/50 transition ${
                      isZeroStock ? 'bg-slate-950/40 opacity-70' : ''
                    }`}
                  >
                    {/* Thumbnail */}
                    <td className="px-3 py-2.5 text-center">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-700/80 mx-auto bg-slate-950"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-500">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Product Name */}
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {p.type !== 'STANDARD' && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            p.type === 'SCALE' ? 'bg-emerald-500/20 text-emerald-400' :
                            p.type === 'COMBO' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-indigo-500/20 text-indigo-400'
                          }`}>
                            {p.type}
                          </span>
                        )}
                      </div>
                      {p.name_ar && <span className="text-[10px] text-slate-400 block">{p.name_ar}</span>}
                    </td>

                    {/* SKU / Barcodes */}
                    <td className="px-4 py-2.5 font-mono text-[11px]">
                      <div>{p.sku}</div>
                      <div className="text-slate-400 text-[10px]">{p.barcode || '—'}</div>
                      {p.pack_barcode && (
                        <div className="text-amber-400/80 text-[9px]">Pack: {p.pack_barcode}</div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-3 py-2.5">
                      {catObj ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catObj.color || '#3b82f6' }} />
                          {catObj.name}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Online Shop Flag */}
                    <td className="px-3 py-2.5 text-center">
                      {p.is_online ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <Globe className="w-3 h-3 text-emerald-400" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Local Only
                        </span>
                      )}
                    </td>

                    {/* Unit Price */}
                    <td className="px-3 py-2.5 font-mono font-bold text-white">
                      ${Number(p.selling_price).toFixed(2)}
                      {p.unit_code && <span className="text-[10px] font-normal text-slate-400 ml-0.5">/{p.unit_code}</span>}
                    </td>

                    {/* Pack Price */}
                    <td className="px-3 py-2.5 font-mono text-slate-300">
                      {hasPack ? (
                        <div>
                          <div className="text-amber-300 font-bold">
                            ${Number(p.pack_price || Number(p.selling_price) * packQty).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">({packQty} units)</div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Stock on Hand (with Pack Breakdown) */}
                    <td className="px-4 py-2.5 font-mono">
                      {p.track_inventory === 1 ? (
                        isZeroStock ? (
                          <span className="bg-rose-950/80 text-rose-400 border border-rose-800/50 text-[10px] font-bold px-2 py-0.5 rounded-lg inline-block">
                            Zero Stock
                          </span>
                        ) : (
                          <div>
                            <span className={`font-bold ${isLowLocal ? 'text-rose-400' : 'text-white'}`}>
                              {stockQty.toFixed(0)} {p.unit_code || 'units'}
                            </span>
                            {hasPack && stockQty > 0 && (
                              <div className="text-[10px] text-amber-300/80">
                                {Math.floor(stockQty / packQty)} packs + {stockQty % packQty} units
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-slate-500 text-[10px]">No Tracking</span>
                      )}
                    </td>

                    {/* Low Stock Thresholds */}
                    <td className="px-3 py-2.5 text-center font-mono text-[11px]">
                      <span className={isLowLocal ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {lowLocal}
                      </span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-blue-300">{lowOnline}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setLabelProduct(p)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                          title="Print Barcode Label"
                        >
                          <Barcode className="w-4 h-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                          title="Edit Product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <h3 className="font-bold text-white text-base">
                {editingProduct.id ? 'Edit Product' : 'Create New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Product Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Product Name (EN) *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Product Name (Arabic)</label>
                  <input
                    type="text"
                    value={editingProduct.name_ar || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name_ar: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Category & Unit with quick Category add button */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-400">Category *</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Manage / New
                    </button>
                  </div>
                  <select
                    value={editingProduct.category_id || categories[0]?.id || 1}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category_id: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Unit of Measure</label>
                  <select
                    value={editingProduct.unit_id || units[0]?.id || 1}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit_id: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SKU, Barcode, Product Type */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editingProduct.sku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Barcode</label>
                  <input
                    type="text"
                    value={editingProduct.barcode || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    placeholder="Scan or type barcode"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Product Type</label>
                  <select
                    value={editingProduct.type || 'STANDARD'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="SCALE">SCALE (Weighed PLU)</option>
                    <option value="VARIABLE">VARIABLE (Matrix)</option>
                    <option value="COMBO">COMBO (Recipe BOM)</option>
                  </select>
                </div>
              </div>

              {/* Online Shop & Product Image Section */}
              <div className="bg-slate-850 border border-slate-700/80 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Online Shop App Settings</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.is_online)}
                      onChange={(e) => setEditingProduct({ ...editingProduct, is_online: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-950 border-slate-700"
                    />
                    <span className="text-xs font-bold text-emerald-400">Available in Online Shop</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Product Image URL</label>
                    <input
                      type="url"
                      value={editingProduct.image_url || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                      placeholder="https://example.com/images/product.jpg"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    {editingProduct.image_url ? (
                      <div className="relative group">
                        <img
                          src={editingProduct.image_url}
                          alt="Preview"
                          className="w-14 h-14 rounded-xl object-cover border border-slate-600 bg-slate-900 shadow-sm"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                        <span className="text-[9px] text-slate-400 block text-center mt-1">Preview</span>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-950 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-[10px]">
                        <ImageIcon className="w-4 h-4 mb-0.5" />
                        No Image
                      </div>
                    )}
                  </div>
                </div>

                {/* Dual Low-in-Stock Thresholds */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/60">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Local POS Low-Stock Alert
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingProduct.low_stock_local ?? 5}
                      onChange={(e) => setEditingProduct({ ...editingProduct, low_stock_local: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Online Shop Low-Stock Alert
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingProduct.low_stock_online ?? 5}
                      onChange={(e) => setEditingProduct({ ...editingProduct, low_stock_online: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Extra Barcodes Section */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-400">Multiple Barcodes</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const current = (editingProduct as any).extra_barcodes || [];
                      setEditingProduct({ ...editingProduct, extra_barcodes: [...current, { barcode: '', label: '' }] } as any);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" /> Add Barcode
                  </button>
                </div>
                {((editingProduct as any).extra_barcodes || []).map((eb: any, idx: number) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={eb.barcode}
                      onChange={(e) => {
                        const arr = [...((editingProduct as any).extra_barcodes || [])];
                        arr[idx] = { ...arr[idx], barcode: e.target.value };
                        setEditingProduct({ ...editingProduct, extra_barcodes: arr } as any);
                      }}
                      placeholder="Barcode number"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={eb.label || ''}
                      onChange={(e) => {
                        const arr = [...((editingProduct as any).extra_barcodes || [])];
                        arr[idx] = { ...arr[idx], label: e.target.value };
                        setEditingProduct({ ...editingProduct, extra_barcodes: arr } as any);
                      }}
                      placeholder="Label (e.g. Pack / Carton)"
                      className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const arr = ((editingProduct as any).extra_barcodes || []).filter((_: any, i: number) => i !== idx);
                        setEditingProduct({ ...editingProduct, extra_barcodes: arr } as any);
                      }}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 3-Tier Pricing Section */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Pricing Tiers & Pack Configuration
                </h4>

                {/* Tier 1: Unit Price & Cost Price */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Selling Price ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={editingProduct.selling_price ?? 0}
                      onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Cost Price ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={editingProduct.cost_price ?? 0}
                      onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tier 2: Pack / Carton Pricing */}
                <div className="bg-slate-800/50 rounded-2xl p-3 mb-3 space-y-2 border border-slate-700/60">
                  <div className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>Tier 2: Pack / Carton Price (Wholesale)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Pack Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={(editingProduct as any).pack_price ?? ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, pack_price: parseFloat(e.target.value) || 0 } as any)}
                        placeholder="0.00"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Units per Pack</label>
                      <input
                        type="number"
                        min="1"
                        value={(editingProduct as any).pack_quantity ?? ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, pack_quantity: parseInt(e.target.value) || 1 } as any)}
                        placeholder="e.g. 12"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Pack Barcode (Optional)</label>
                      <input
                        type="text"
                        value={(editingProduct as any).pack_barcode ?? ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, pack_barcode: e.target.value } as any)}
                        placeholder="Optional"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Tier 3: Minimum Order Pricing */}
                <div className="bg-slate-800/50 rounded-2xl p-3 space-y-2 border border-slate-700/60">
                  <div className="text-xs font-semibold text-emerald-400 mb-1">
                    🛒 Tier 3: Minimum Order Bulk Price
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Min Order Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={(editingProduct as any).min_order_price ?? ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, min_order_price: parseFloat(e.target.value) || 0 } as any)}
                        placeholder="0.00"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Min Order Qty (Units)</label>
                      <input
                        type="number"
                        min="1"
                        value={(editingProduct as any).min_order_qty ?? ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, min_order_qty: parseInt(e.target.value) || 1 } as any)}
                        placeholder="e.g. 6"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Management (Units vs Packs) */}
              {editingProduct.id ? (
                /* EXISTING PRODUCT: READ-ONLY CURRENT STOCK + DEDICATED ADD STOCK BUTTON */
                <div className="pt-2 border-t border-slate-800">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Current In-Stock Quantity (Read-Only)</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {Number((editingProduct as any).current_stock ?? 0).toFixed(2)} Units
                      </span>
                      {Number((editingProduct as any).pack_quantity || 1) > 1 && (
                        <span className="text-[10px] text-amber-300 font-bold block">
                          {Math.floor(Number((editingProduct as any).current_stock ?? 0) / Number((editingProduct as any).pack_quantity))} packs + {Math.round(Number((editingProduct as any).current_stock ?? 0) % Number((editingProduct as any).pack_quantity))} units
                        </span>
                      )}
                    </div>
                    {currentUser?.role === 'ADMIN' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRestockProductId(editingProduct.id as number);
                          setRestockProductName(editingProduct.name || '');
                          setRestockPackQty(Number((editingProduct as any).pack_quantity || 1));
                          setRestockQty(1);
                          setRestockMode('UNITS');
                          setRestockReason('Supplier Restock / Purchase');
                          setIsRestockModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Stock (Stock In)</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                        Admin role required to add stock
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 px-1">
                    * Product quantity cannot be arbitrarily modified. Stock can only be added by Admin with audit logging in movement logs. Cashiers only stock out via sales.
                  </p>
                </div>
              ) : (
                /* NEW PRODUCT: INITIAL STOCK INPUT (Audited into stock_movements) */
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">Initial Stock Quantity</label>
                    {currentUser?.role === 'ADMIN' && (
                      <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setStockInputMode('UNITS')}
                          className={`px-3 py-1 rounded-lg font-bold transition ${
                            stockInputMode === 'UNITS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          In Units
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockInputMode('PACKS')}
                          className={`px-3 py-1 rounded-lg font-bold transition ${
                            stockInputMode === 'PACKS' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          In Packs (x{(editingProduct as any).pack_quantity || 1})
                        </button>
                      </div>
                    )}
                  </div>
                  {currentUser?.role === 'ADMIN' ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={rawStockInput}
                        onChange={(e) => setRawStockInput(parseFloat(e.target.value) || 0)}
                        placeholder="Enter initial stock"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                      />
                      {stockInputMode === 'PACKS' && Number((editingProduct as any).pack_quantity || 1) > 1 && (
                        <span className="text-xs text-amber-300 font-bold shrink-0">
                          = {rawStockInput * Number((editingProduct as any).pack_quantity || 1)} individual units
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                      Initial stock defaults to 0. Only Admin users can enter initial stock.
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1 px-1">
                    * Initial stock entered will be audited into the in/out movement ledger.
                  </p>
                </div>
              )}

              {editingProduct.type === 'SCALE' && (
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">Scale 5-Digit PLU Code</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={editingProduct.scale_plu || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, scale_plu: e.target.value })}
                    placeholder="e.g. 01001"
                    className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl text-xs shadow-md shadow-blue-600/30"
                >
                  {loading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setIsCategoryModalOpen(false)}
          onRefresh={fetchCatalog}
        />
      )}

      {/* Online DB Configuration Modal */}
      {isOnlineDbModalOpen && (
        <OnlineDbModal
          onClose={() => setIsOnlineDbModalOpen(false)}
          onSyncComplete={fetchCatalog}
        />
      )}

      {/* Barcode Label Designer Modal */}
      {labelProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative text-center">
            <button onClick={() => setLabelProduct(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-white text-sm mb-4">Print Barcode Shelf Label</h3>

            <div className="bg-white text-black p-4 rounded-xl shadow-lg inline-block border border-gray-300 w-full mb-4">
              <div className="text-xs font-black truncate">{labelProduct.name}</div>
              <div className="text-[10px] text-gray-600 font-mono">{labelProduct.sku}</div>
              <div className="my-2 bg-black text-white font-mono text-[11px] py-1 tracking-widest font-bold">
                * {labelProduct.barcode || labelProduct.sku} *
              </div>
              <div className="text-xl font-black text-black">
                ${Number(labelProduct.selling_price).toFixed(2)}
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print Label</span>
            </button>
          </div>
        </div>
      )}
      {/* Dedicated Restock / Stock In Modal */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => setIsRestockModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Stock In (+ Add Stock)</h3>
                <span className="text-[10px] text-slate-400 truncate block max-w-[220px]">
                  {restockProductName}
                </span>
              </div>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-3">
              {/* Unit Mode Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">Stock In Unit</label>
                  {restockPackQty > 1 && (
                    <span className="text-[10px] text-amber-400 font-bold">
                      1 Pack = {restockPackQty} units
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setRestockMode('UNITS')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      restockMode === 'UNITS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    In Units
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestockMode('PACKS')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      restockMode === 'PACKS' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    In Packs (x{restockPackQty})
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Quantity to Add ({restockMode === 'PACKS' ? 'Packs' : 'Units'})
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 10"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                {restockMode === 'PACKS' && restockPackQty > 1 && (
                  <span className="text-[11px] text-amber-300 font-bold block mt-1">
                    = {restockQty * restockPackQty} individual units added
                  </span>
                )}
              </div>

              {/* Reason / Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Reason / Supplier / Note
                </label>
                <input
                  type="text"
                  required
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  placeholder="e.g. Invoice #123, Restock shipment"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={restockLoading || restockQty <= 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{restockLoading ? 'Recording In Audit Logs...' : 'Confirm Stock In'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
