import React, { useState, useEffect } from 'react';
import { CustomerDisplayPayload, HardwareService } from '../../services/hardwareService';
import { CompanySettings } from '../../types';
import {
  ShoppingBag,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  Maximize2,
  Sun,
  Zap,
  ShieldCheck,
  PhoneCall,
  Coins,
  CheckCircle2
} from 'lucide-react';

interface Props {
  settings: CompanySettings | null;
  onBack?: () => void;
}

export const CustomerDisplayView: React.FC<Props> = ({ settings, onBack }) => {
  const [displayData, setDisplayData] = useState<CustomerDisplayPayload>({
    companyName: settings?.company_name || 'Vendra Solar Energy Showroom',
    primaryCurrencySymbol: settings?.primary_currency_symbol || '$',
    secondaryCurrencySymbol: settings?.secondary_currency_symbol || 'L.L.',
    secondaryRate: settings?.secondary_currency_rate || 89500,
    items: [],
    subtotal: 0,
    taxTotal: 0,
    discountTotal: 0,
    grandTotal: 0,
    grandTotalSecondary: 0,
    status: 'WELCOME',
  });

  useEffect(() => {
    // 1. Try reading latest cart from local storage if available
    try {
      const savedCart = localStorage.getItem('omnipos_current_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const pSym = settings?.primary_currency_symbol || '$';
          const sSym = settings?.secondary_currency_symbol || 'L.L.';
          const sRate = settings?.secondary_currency_rate || 89500;
          const sub = parsed.reduce((sum: number, it: any) => sum + (it.unit_price * it.quantity), 0);
          const disc = parsed.reduce((sum: number, it: any) => sum + (it.discount_amount || 0), 0);
          const tax = parsed.reduce((sum: number, it: any) => sum + (it.tax_amount || 0), 0);
          const grand = Math.max(0, sub + tax - disc);
          setDisplayData({
            companyName: settings?.company_name || 'Vendra Solar Energy Showroom',
            primaryCurrencySymbol: pSym,
            secondaryCurrencySymbol: sSym,
            secondaryRate: sRate,
            items: parsed.map((it: any) => ({
              name: it.product_name,
              quantity: it.quantity,
              unitPrice: it.unit_price,
              lineTotal: (it.unit_price * it.quantity) - (it.discount_amount || 0),
            })),
            subtotal: sub,
            taxTotal: tax,
            discountTotal: disc,
            grandTotal: grand,
            grandTotalSecondary: grand * sRate,
            status: 'SCANNING',
          });
        }
      }
    } catch (_) {}

    // 2. Listen to real-time broadcasts
    const unsubscribe = HardwareService.onCustomerDisplayMessage((payload) => {
      setDisplayData(payload);
    });
    return () => unsubscribe();
  }, [settings]);

  const pSymbol = displayData.primaryCurrencySymbol;
  const sSymbol = displayData.secondaryCurrencySymbol;
  const rate = displayData.secondaryRate;

  const handlePopout = () => {
    const targetUrl = window.location.pathname.includes('/customer-display')
      ? window.location.href
      : window.location.pathname + (window.location.pathname.endsWith('/') ? '' : '/') + '#customer-display';
    window.open(targetUrl, 'VendraCustomerPoleDisplay', 'width=1100,height=750');
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-6 select-none font-sans">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition shadow-sm mr-2"
              title="Return to Cashier POS Register"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span>Back to POS (رجوع)</span>
            </button>
          )}

          {settings?.primary_logo_url ? (
            <img
              src={settings.primary_logo_url}
              alt="Logo"
              className="w-10 h-10 object-contain bg-slate-900 rounded-2xl p-1 border border-slate-700"
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-amber-500/20">
              <Sun className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
              {displayData.companyName}
            </h1>
            <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Customer Pole Display Active &bull; شاشة العرض للعميل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePopout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
            title="Open dedicated customer window"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Second Monitor</span>
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="text-right pl-3 border-l border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Terminal Station</span>
            <span className="text-xs font-bold text-slate-200">Lane #01</span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 my-6 overflow-hidden">
        {/* Left 2 Cols: Items or Showroom Welcome Showcase */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>Current Order ({displayData.items.length} items)</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">Live Checkout Terminal</span>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
            {displayData.items.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                  <Sun className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Welcome to {displayData.companyName}</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
                    أهلاً بكم في صالة عرض الطاقة الشمسية والأنظمة الكهربائية. يتم احتساب كافة الأسعار بالدولار والليرة اللبنانية.
                  </p>
                </div>

                {/* Showroom Value Props */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl text-left">
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <Zap className="w-4 h-4" />
                      <span>Solar Inverters</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Deye, Growatt, Felicity Solar with official warranty.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4" />
                      <span>LiFePO4 Lithium</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Long lifespan wall-mount & rack storage batteries.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                      <Coins className="w-4 h-4" />
                      <span>Easy Installments</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Flexible monthly installments (تقسيط ميسر).</p>
                  </div>
                </div>
              </div>
            ) : (
              displayData.items.map((it, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between text-sm hover:border-slate-700 transition"
                >
                  <div className="truncate mr-4">
                    <span className="font-bold text-white block truncate">{it.name}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {it.quantity} &times; {pSymbol}{Number(it.unitPrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-base font-black text-amber-400 font-mono shrink-0">
                    {pSymbol}{Number(it.lineTotal).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal strip */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-3 text-xs text-slate-400">
            <div>
              <span>Subtotal:</span>
              <span className="font-bold text-slate-200 ml-1.5">{pSymbol}{displayData.subtotal.toFixed(2)}</span>
            </div>
            {displayData.discountTotal > 0 && (
              <div className="text-amber-400">
                <span>Savings:</span>
                <span className="font-bold ml-1.5">-{pSymbol}{displayData.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="text-right">
              <span>Tax / VAT:</span>
              <span className="font-bold text-slate-200 ml-1.5">{pSymbol}{displayData.taxTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Right Col: Grand Total Card, Dual Currency & Change */}
        <div className="bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/20 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">
                Amount Due &bull; المبلغ المطلوب
              </span>

              {/* Primary Currency (USD) */}
              <div className="text-5xl font-black text-white tracking-tight my-2 font-mono">
                {pSymbol}{displayData.grandTotal.toFixed(2)}
              </div>

              {/* Secondary Currency (LBP) */}
              <div className="text-2xl font-bold text-slate-300 font-mono">
                {Number(displayData.grandTotalSecondary).toLocaleString()} {sSymbol}
              </div>
            </div>

            {/* Exchange Rate Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Showroom Daily Rate:</span>
                <span className="font-bold text-emerald-400 font-mono">1 USD = {Number(rate).toLocaleString()} L.L.</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Dual currency accepted in cash (USD + L.L.) at today&apos;s standard market rate.
              </p>
            </div>

            {/* Change Due if completed */}
            {displayData.changeGiven !== undefined && displayData.changeGiven > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                <span className="text-xs font-semibold text-emerald-400 block">Change Given &bull; المتبقي للعميل:</span>
                <div className="text-3xl font-black text-emerald-400 mt-1 font-mono">
                  {displayData.changeGiven > 500
                    ? `${Number(displayData.changeGiven).toLocaleString()} ${sSymbol}`
                    : `${pSymbol}${Number(displayData.changeGiven).toFixed(2)}`}
                </div>
              </div>
            )}
          </div>

          {/* Contact & Support */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              <span>Customer Care &amp; Inquiries</span>
            </div>
            <p className="text-[11px] text-slate-400">
              WhatsApp: <span className="font-mono text-slate-200">+961 70 024 524</span> &bull; Baalbeck, Lebanon
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <span>&copy; {new Date().getFullYear()} {displayData.companyName} &bull; Powered by Vendra Commercial System</span>
        <span className="font-mono text-[11px] text-slate-400">Dual-Currency Realtime Engine</span>
      </footer>
    </div>
  );
};
