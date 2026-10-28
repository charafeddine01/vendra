import React, { useState } from 'react';
import { Category } from '../../types';
import { ApiService } from '../../services/api';
import { X, Plus, Edit2, Trash2, Check, Folder, Tag, Sparkles } from 'lucide-react';

interface Props {
  categories: Category[];
  onClose: () => void;
  onRefresh: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#64748b', '#f97316'
];

export const CategoryManagerModal: React.FC<Props> = ({ categories, onClose, onRefresh }) => {
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCreate = () => {
    setEditingCat({});
    setName('');
    setNameAr('');
    setColor(PRESET_COLORS[categories.length % PRESET_COLORS.length]);
    setSortOrder((categories.length + 1) * 10);
    setError(null);
  };

  const startEdit = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setNameAr(cat.name_ar || '');
    setColor(cat.color || '#3b82f6');
    setSortOrder(cat.sort_order || 0);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingCat(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      id: editingCat?.id,
      name: name.trim(),
      name_ar: nameAr.trim() || null,
      color,
      sort_order: sortOrder,
    };

    const res = await ApiService.request('products.categories.save', payload);
    setLoading(false);

    if (res.success) {
      setEditingCat(null);
      onRefresh();
    } else {
      setError(res.error?.message || 'Failed to save category');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this category?')) return;
    setLoading(true);
    const res = await ApiService.request('products.categories.delete', { id });
    setLoading(false);
    if (res.success) {
      if (editingCat?.id === id) setEditingCat(null);
      onRefresh();
    } else {
      alert(res.error?.message || 'Failed to delete category');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-white text-base">Category Management</h3>
              <p className="text-[11px] text-slate-400">Add, rename, color-code, and organize POS categories</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col md:flex-row gap-6">
          {/* Left: Category List */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Categories ({categories.length})
              </span>
              <button
                type="button"
                onClick={startCreate}
                className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className={`p-2.5 rounded-2xl border transition flex items-center justify-between ${
                    editingCat?.id === c.id
                      ? 'bg-blue-600/10 border-blue-500'
                      : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: c.color || '#3b82f6' }}
                    />
                    <div>
                      <div className="text-xs font-bold text-white">{c.name}</div>
                      {c.name_ar && <div className="text-[10px] text-slate-400">{c.name_ar}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-blue-400 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Create / Edit Form */}
          {editingCat && (
            <div className="w-full md:w-72 bg-slate-850 border border-slate-700 rounded-2xl p-4 shrink-0 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-white mb-3">
                  {editingCat.id ? 'Edit Category' : 'Create Category'}
                </h4>

                {error && (
                  <div className="mb-3 p-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-[11px] text-rose-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Name (EN) *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Beverages, Solar Panels"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Name (Arabic)
                    </label>
                    <input
                      type="text"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="e.g. مشروبات"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Pill Color
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {PRESET_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setColor(col)}
                          className={`w-6 h-6 rounded-lg transition border flex items-center justify-center ${
                            color === col ? 'border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: col }}
                        >
                          {color === col && <Check className="w-3 h-3 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs transition shadow-md shadow-blue-600/30"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
