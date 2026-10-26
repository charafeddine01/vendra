import React, { useState, useEffect } from 'react';
import { Customer } from '../../types';
import { ApiService } from '../../services/api';
import {
  X,
  Search,
  UserPlus,
  Users,
  Check,
  Phone,
  MapPin,
  CreditCard,
  DollarSign,
  AlertCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  selectedCustomerId?: number | null;
  onClose: () => void;
  onSelectCustomer: (customer: Customer | null) => void;
}

export const CustomerSelectModal: React.FC<Props> = ({
  isOpen,
  selectedCustomerId,
  onClose,
  onSelectCustomer,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState<number>(1000);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomers = async (searchQuery = '') => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await ApiService.request('customers.list', { search: searchQuery });
      if (res.success && res.data?.customers) {
        setCustomers(res.data.customers);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to load customers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCustomers(search);
      setIsAddingNew(false);
      setErrorMessage(null);
    }
  }, [isOpen, search]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await ApiService.request('customers.save', {
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        address: newAddress.trim() || undefined,
        credit_limit: newCreditLimit || 0,
      });

      if (res.success && res.data?.customer) {
        onSelectCustomer(res.data.customer);
        onClose();
      } else {
        // Fallback: refetch list and find customer
        await fetchCustomers();
        const created = customers.find(c => c.name.toLowerCase() === newName.trim().toLowerCase());
        if (created) {
          onSelectCustomer(created);
        }
        onClose();
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to create customer.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Select Customer (تحديد العميل)</h3>
              <p className="text-[11px] text-slate-400">Required for Installment Plans &amp; Credit Ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toggle */}
        <div className="px-5 pt-4 pb-2 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddingNew(false)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              !isAddingNew
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Search Existing</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              isAddingNew
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New Customer</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mx-5 my-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body */}
        {!isAddingNew ? (
          <div className="flex-1 flex flex-col p-5 pt-2 overflow-hidden">
            {/* Search Input */}
            <div className="relative mb-3 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer name, phone, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Walk-in Cash Customer Option */}
            <div
              onClick={() => {
                onSelectCustomer(null);
                onClose();
              }}
              className={`p-3 rounded-2xl border mb-2 cursor-pointer transition flex items-center justify-between ${
                !selectedCustomerId || selectedCustomerId === 1
                  ? 'bg-slate-800/80 border-slate-600 text-white'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div>
                <span className="font-bold text-xs block text-slate-200">Walk-in General Customer (عميل نقدي عام)</span>
                <span className="text-[10px] text-slate-400">Cash / Card without installment ledger</span>
              </div>
              {(!selectedCustomerId || selectedCustomerId === 1) && (
                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-200 font-bold">Default</span>
              )}
            </div>

            {/* Customers List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-xs text-slate-400">No customers found matching &quot;{search}&quot;</p>
                  <button
                    onClick={() => {
                      setNewName(search);
                      setIsAddingNew(true);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold underline"
                  >
                    Click here to create &quot;{search}&quot;
                  </button>
                </div>
              ) : (
                customers
                  .filter((c) => c.id !== 1)
                  .map((cust) => {
                    const isSelected = selectedCustomerId === cust.id;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => {
                          onSelectCustomer(cust);
                          onClose();
                        }}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{cust.name}</span>
                            {isSelected && (
                              <span className="flex items-center text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                                <Check className="w-3 h-3 mr-0.5" /> Selected
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            {cust.phone && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {cust.phone}
                              </span>
                            )}
                            {cust.address && (
                              <span className="flex items-center gap-1 truncate max-w-[160px]">
                                <MapPin className="w-3 h-3 text-slate-500" />
                                {cust.address}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Balance / Limit</span>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            ${Number(cust.current_balance || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono"> / ${Number(cust.credit_limit || 0).toFixed(0)}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        ) : (
          /* Add New Customer Form */
          <form onSubmit={handleCreateCustomer} className="flex-1 p-5 pt-2 overflow-y-auto space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name / اسم العميل <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ali Mortada (علي مرتضى)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number / رقم الهاتف
              </label>
              <input
                type="text"
                placeholder="+961 70 123456"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Address / City / السكن أو العنوان
              </label>
              <input
                type="text"
                placeholder="e.g. Baalbeck, Main Street"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Credit Limit (سقف الائتمان بالدولار $)
              </label>
              <input
                type="number"
                step="50"
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save & Select Customer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
