import React, { useState, useEffect } from 'react';
import { CartItem, Customer, CompanySettings, RestaurantTable } from '../../types';
import { I18nService } from '../../services/i18nService';
import { CustomerSelectModal } from './CustomerSelectModal';
import {
  X,
  CreditCard,
  Banknote,
  Split,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  User,
  UserPlus,
  Coins,
  ArrowRightLeft
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  items: CartItem[];
  customer: Customer | null;
  table: RestaurantTable | null;
  settings: CompanySettings | null;
  onClose: () => void;
  onSelectCustomer?: (customer: Customer | null) => void;
  onConfirmOrder: (paymentData: {
    customer_id?: number;
    paidCash: number;
    paidCard: number;
    paidCredit: number;
    paidOnAccount: number;
    changeGiven: number;
    changeCurrency: 'PRIMARY' | 'SECONDARY';
    exchangeRate: number;
    notes?: string;
    installmentPlan?: {
      total_amount: number;
      down_payment: number;
      total_installments: number;
      frequency: 'MONTHLY' | 'WEEKLY';
      first_due_date: string;
      notes?: string;
    };
  }) => Promise<void>;
}

export const PaymentModal: React.FC<Props> = ({
  isOpen,
  items,
  customer: initialCustomer,
  table,
  settings,
  onClose,
  onSelectCustomer,
  onConfirmOrder,
}) => {
  const primarySymbol = settings?.primary_currency_symbol || '$';
  const secondarySymbol = settings?.secondary_currency_symbol || 'L.L.';
  const secondaryRate = Number(settings?.secondary_currency_rate || 89500);

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const discountTotal = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  const taxTotal = items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
  const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);
  const grandTotalSecondary = Math.round(grandTotal * secondaryRate);

  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(initialCustomer);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const [paymentType, setPaymentType] = useState<'CASH' | 'CARD' | 'SPLIT' | 'ON_ACCOUNT' | 'INSTALLMENT'>('CASH');

  // Dual Currency Cash Tendered
  const [tenderedUSD, setTenderedUSD] = useState<number>(grandTotal);
  const [tenderedLBP, setTenderedLBP] = useState<number>(0);

  // Card Tendered (for split)
  const [tenderedCard, setTenderedCard] = useState<number>(0);

  // Change currency choice ('PRIMARY' = USD, 'SECONDARY' = LBP)
  const [changeCurrency, setChangeCurrency] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY');

  // Installment specific states
  const [downPayment, setDownPayment] = useState<number>(Math.round(grandTotal * 0.3));
  const [installmentCount, setInstallmentCount] = useState<number>(4);
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);
  const [firstDueDate, setFirstDueDate] = useState<string>(defaultDueDate.toISOString().split('T')[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initialCustomer if changed from props
  useEffect(() => {
    setCurrentCustomer(initialCustomer);
  }, [initialCustomer]);

  // Reset default cash amounts when grandTotal changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTenderedUSD(grandTotal);
      setTenderedLBP(0);
      setTenderedCard(0);
      setDownPayment(Math.round(grandTotal * 0.3));
      setErrorMsg(null);
    }
  }, [isOpen, grandTotal]);

  if (!isOpen) return null;

  // Total cash paid in USD terms (including both USD and converted LBP)
  const effectiveCashInUSD = (Number(tenderedUSD) || 0) + ((Number(tenderedLBP) || 0) / secondaryRate);
  const effectiveCashInLBP = effectiveCashInUSD * secondaryRate;

  // Split total
  const splitTotalInUSD = effectiveCashInUSD + (Number(tenderedCard) || 0);

  // Total tendered for the active payment mode
  const currentTotalTenderedUSD =
    paymentType === 'CASH'
      ? effectiveCashInUSD
      : paymentType === 'CARD'
      ? grandTotal
      : paymentType === 'SPLIT'
      ? splitTotalInUSD
      : paymentType === 'ON_ACCOUNT'
      ? grandTotal
      : paymentType === 'INSTALLMENT'
      ? downPayment
      : 0;

  // Difference vs grandTotal (positive = change due, negative = still owed)
  const balanceDiffUSD = currentTotalTenderedUSD - grandTotal;
  const isUnderpaid = balanceDiffUSD < -0.01;
  const remainingDueUSD = isUnderpaid ? Math.abs(balanceDiffUSD) : 0;
  const remainingDueLBP = Math.round(remainingDueUSD * secondaryRate);

  // Change Due computations for the TWO payback boxes
  const changeDueUSD = !isUnderpaid ? Math.max(0, balanceDiffUSD) : 0;
  const changeDueLBP = Math.round(changeDueUSD * secondaryRate);

  // Installment math
  const financedRemaining = Math.max(0, grandTotal - downPayment);
  const monthlyInstallment = installmentCount > 0 ? financedRemaining / installmentCount : 0;

  const handleCustomerSelected = (cust: Customer | null) => {
    setCurrentCustomer(cust);
    if (onSelectCustomer) {
      onSelectCustomer(cust);
    }
  };

  const handleFinish = async () => {
    setErrorMsg(null);

    // Validate on account
    if (paymentType === 'ON_ACCOUNT') {
      if (!currentCustomer || currentCustomer.id === 1) {
        setErrorMsg('Please select a registered customer with credit account for on-account charges.');
        return;
      }
      const availableCredit = (currentCustomer.credit_limit || 0) - (currentCustomer.current_balance || 0);
      if (grandTotal > availableCredit) {
        setErrorMsg(`Customer credit limit exceeded! Available credit: $${availableCredit.toFixed(2)}.`);
        return;
      }
    }

    // Validate installment plan
    if (paymentType === 'INSTALLMENT') {
      if (!currentCustomer || currentCustomer.id === 1) {
        setErrorMsg('Please select or add a registered customer to create an installment plan (الأقساط).');
        return;
      }
      if (downPayment >= grandTotal) {
        setErrorMsg('Down payment equals or exceeds total amount. Please use standard Cash/Card payment.');
        return;
      }
      if (installmentCount < 1) {
        setErrorMsg('Number of installments must be at least 1.');
        return;
      }
    }

    // Validate cash payment
    if (paymentType === 'CASH' && isUnderpaid) {
      setErrorMsg(`Tendered amount is short by $${remainingDueUSD.toFixed(2)} (${remainingDueLBP.toLocaleString()} L.L.).`);
      return;
    }

    // Validate split payment
    if (paymentType === 'SPLIT' && splitTotalInUSD < (grandTotal - 0.01)) {
      const shortUSD = grandTotal - splitTotalInUSD;
      setErrorMsg(`Combined Cash + Card is short by $${shortUSD.toFixed(2)}.`);
      return;
    }

    setIsSubmitting(true);

    // Construct payment summary notes (e.g. Paid $40.00 USD + 895,000 L.L.)
    let paymentNotes = '';
    if (paymentType === 'CASH') {
      const parts = [];
      if (tenderedUSD > 0) parts.push(`$${tenderedUSD.toFixed(2)} USD`);
      if (tenderedLBP > 0) parts.push(`${Number(tenderedLBP).toLocaleString()} L.L.`);
      paymentNotes = `Cash Payment: ${parts.join(' + ') || '$0'}`;
      if (changeDueUSD > 0) {
        paymentNotes += ` | Change: ${changeCurrency === 'PRIMARY' ? `$${changeDueUSD.toFixed(2)}` : `${changeDueLBP.toLocaleString()} L.L.`}`;
      }
    }

    try {
      await onConfirmOrder({
        customer_id: currentCustomer?.id || 1,
        paidCash: paymentType === 'CASH' ? effectiveCashInUSD : (paymentType === 'SPLIT' ? effectiveCashInUSD : (paymentType === 'INSTALLMENT' ? downPayment : 0)),
        paidCard: paymentType === 'CARD' ? grandTotal : (paymentType === 'SPLIT' ? tenderedCard : 0),
        paidCredit: 0,
        paidOnAccount: paymentType === 'ON_ACCOUNT' ? grandTotal : (paymentType === 'INSTALLMENT' ? financedRemaining : 0),
        changeGiven: changeCurrency === 'PRIMARY' ? changeDueUSD : changeDueLBP,
        changeCurrency,
        exchangeRate: secondaryRate,
        notes: paymentNotes || undefined,
        installmentPlan: paymentType === 'INSTALLMENT' ? {
          total_amount: grandTotal,
          down_payment: downPayment,
          total_installments: installmentCount,
          frequency: 'MONTHLY',
          first_due_date: firstDueDate,
          notes: `Solar Showroom Installment Plan (${installmentCount} months @ $${monthlyInstallment.toFixed(2)}/mo)`,
        } : undefined,
      });
      setIsSubmitting(false);
      onClose();
    } catch (e: any) {
      setIsSubmitting(false);
      setErrorMsg(e.message || 'Payment processing failed.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl relative select-none overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">{I18nService.t('pos.charge')}</h2>
                {table && (
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700">
                    Table #{table.table_number}
                  </span>
                )}
              </div>

              {/* Customer Selector Chip */}
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="mt-1 flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 px-2.5 py-1 rounded-xl border border-slate-700/80 transition"
              >
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold">
                  {currentCustomer && currentCustomer.id !== 1
                    ? currentCustomer.name
                    : 'Walk-in Customer (عميل عام)'}
                </span>
                <span className="text-[10px] text-blue-400 underline ml-1">Change</span>
              </button>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-white font-mono">
                {primarySymbol}{grandTotal.toFixed(2)}
              </div>
              <div className="text-xs text-amber-400 font-semibold font-mono">
                {grandTotalSecondary.toLocaleString()} {secondarySymbol}
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tender Method Selector */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('CASH')}
                className={`py-2.5 px-1 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentType === 'CASH'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash (كاش)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('CARD')}
                className={`py-2.5 px-1 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentType === 'CARD'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Card (بطاقة)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType('SPLIT');
                  setTenderedUSD(Math.floor(grandTotal / 2));
                  setTenderedLBP(0);
                  setTenderedCard(grandTotal - Math.floor(grandTotal / 2));
                }}
                className={`py-2.5 px-1 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentType === 'SPLIT'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Split className="w-4 h-4" />
                <span>Split (مجزأ)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('ON_ACCOUNT')}
                className={`py-2.5 px-1 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentType === 'ON_ACCOUNT'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>On Account</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('INSTALLMENT')}
                className={`py-2.5 px-1 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentType === 'INSTALLMENT'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-600/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Calendar className="w-4 h-4 text-amber-300" />
                <span>Installments (تقسيط)</span>
              </button>
            </div>

            {/* ========================================================
                1. CASH & DUAL-CURRENCY SIMULTANEOUS PAYMENT CONTROLS
               ======================================================== */}
            {(paymentType === 'CASH' || paymentType === 'SPLIT') && (
              <div className="space-y-4 bg-slate-950/60 border border-slate-800 rounded-3xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>Dual-Currency Cash Tendered (الدفع بالعملتين معاً)</span>
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                    1 USD = {secondaryRate.toLocaleString()} L.L.
                  </span>
                </div>

                {/* Quick Presets */}
                {paymentType === 'CASH' && (
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTenderedUSD(grandTotal);
                        setTenderedLBP(0);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-1.5 rounded-xl text-xs transition"
                    >
                      Exact ${grandTotal.toFixed(0)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTenderedUSD(0);
                        setTenderedLBP(grandTotalSecondary);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold py-1.5 rounded-xl text-xs transition"
                    >
                      Exact LBP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const roundUSD = Math.ceil(grandTotal / 50) * 50;
                        setTenderedUSD(roundUSD);
                        setTenderedLBP(0);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-1.5 rounded-xl text-xs transition"
                    >
                      ${Math.ceil(grandTotal / 50) * 50}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTenderedUSD(0);
                        setTenderedLBP(0);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 font-bold py-1.5 rounded-xl text-xs transition"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Simultaneous Dual Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Input 1: Cash in USD */}
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 focus-within:border-blue-500 transition">
                    <label className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                      <span>Cash in Dollars ($)</span>
                      <span className="text-[10px] text-slate-400 font-mono">USD</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-base font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={tenderedUSD === 0 ? '' : tenderedUSD}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setTenderedUSD(val);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-base font-black text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Input 2: Cash in LBP */}
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 focus-within:border-emerald-500 transition">
                    <label className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                      <span>Cash in Lebanese (ليرة)</span>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {tenderedLBP > 0 ? `≈ $${(tenderedLBP / secondaryRate).toFixed(2)}` : 'L.L.'}
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">L.L.</span>
                      <input
                        type="number"
                        step="1000"
                        placeholder="0"
                        value={tenderedLBP === 0 ? '' : tenderedLBP}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setTenderedLBP(val);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-10 py-2 text-base font-black text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Card input for SPLIT mode */}
                {paymentType === 'SPLIT' && (
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 focus-within:border-blue-500 transition">
                    <label className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                      <span>Card / POS Machine Terminal Amount ($)</span>
                      <span className="text-[10px] text-blue-400 font-mono">Electronic Card</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-base font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="any"
                        value={tenderedCard === 0 ? '' : tenderedCard}
                        onChange={(e) => setTenderedCard(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-base font-black text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Tendered Summary Strip */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Tendered (المجموع المستلم):</span>
                    <span className="font-bold text-white text-sm font-mono">
                      ${currentTotalTenderedUSD.toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono ml-1.5">
                      (≈ {Math.round(currentTotalTenderedUSD * secondaryRate).toLocaleString()} L.L.)
                    </span>
                  </div>

                  {isUnderpaid ? (
                    <div className="text-right">
                      <span className="text-rose-400 font-bold block text-[11px]">Still Due (المتبقي للدفع):</span>
                      <span className="font-mono font-black text-rose-400 text-sm">
                        ${remainingDueUSD.toFixed(2)}
                      </span>
                      <span className="text-rose-300 text-[11px] font-mono ml-1 block">
                        {remainingDueLBP.toLocaleString()} L.L.
                      </span>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold flex items-center gap-1 justify-end text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fully Covered
                      </span>
                    </div>
                  )}
                </div>

                {/* ========================================================
                    TWO PAYBACK / RETURN BOXES (USD vs LBP)
                   ======================================================== */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Payback to Customer &bull; الصرف المتبقي للعميل:</span>
                    <span className="text-[10px] text-slate-400 font-normal">Choose which currency to hand back:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Box 1: Return in USD ($) */}
                    <div
                      onClick={() => setChangeCurrency('PRIMARY')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        changeCurrency === 'PRIMARY'
                          ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-400">Return in USD ($)</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition ${
                            changeCurrency === 'PRIMARY'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {changeCurrency === 'PRIMARY' ? '✓ Selected' : 'Click to select'}
                        </span>
                      </div>
                      <div className="text-2xl font-black text-white font-mono my-1.5">
                        ${changeDueUSD.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Hand ${changeDueUSD.toFixed(2)} cash from register
                      </span>
                    </div>

                    {/* Box 2: Return in LBP (L.L.) */}
                    <div
                      onClick={() => setChangeCurrency('SECONDARY')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        changeCurrency === 'SECONDARY'
                          ? 'bg-emerald-600/20 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400">Return in LBP (ليرة)</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition ${
                            changeCurrency === 'SECONDARY'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {changeCurrency === 'SECONDARY' ? '✓ Selected' : 'Click to select'}
                        </span>
                      </div>
                      <div className="text-2xl font-black text-emerald-300 font-mono my-1.5">
                        {changeDueLBP.toLocaleString()} L.L.
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Hand {changeDueLBP.toLocaleString()} L.L. from register
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                2. CARD PAYMENT VIEW
               ======================================================== */}
            {paymentType === 'CARD' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 text-center space-y-3">
                <CreditCard className="w-12 h-12 text-blue-400 mx-auto" />
                <h3 className="font-bold text-white text-base">Direct Card Terminal Processing</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Swipe, insert chip, or tap contactless card for full order amount of{' '}
                  <span className="text-white font-bold font-mono">${grandTotal.toFixed(2)}</span>.
                </p>
              </div>
            )}

            {/* ========================================================
                3. ON-ACCOUNT (CREDIT LEDGER) VIEW
               ======================================================== */}
            {paymentType === 'ON_ACCOUNT' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-200">Customer Credit Ledger Account</span>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold underline"
                  >
                    {currentCustomer && currentCustomer.id !== 1 ? 'Change Customer' : '+ Select Customer'}
                  </button>
                </div>

                {!currentCustomer || currentCustomer.id === 1 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center space-y-2">
                    <p className="font-bold">No registered customer selected!</p>
                    <p className="text-[11px] text-slate-400">
                      On-account sales require a customer with an active ledger and credit limit.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Select or Add Customer</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Customer:</span>
                      <span className="font-bold text-white">{currentCustomer.name}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Current Balance Owed:</span>
                      <span className="font-bold text-amber-400 font-mono">
                        ${Number(currentCustomer.current_balance || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Credit Limit:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        ${Number(currentCustomer.credit_limit || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================
                4. INSTALLMENT FINANCING PLAN (الأقساط)
               ======================================================== */}
            {paymentType === 'INSTALLMENT' && (
              <div className="bg-slate-950/70 border border-amber-500/30 rounded-3xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Installment Financing Plan (الأقساط الميسرة)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold underline"
                  >
                    {currentCustomer && currentCustomer.id !== 1 ? 'Change Customer' : '+ Select / Add Customer'}
                  </button>
                </div>

                {/* Customer Status Banner */}
                {!currentCustomer || currentCustomer.id === 1 ? (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold">Customer Required for Installment Contract</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      You must select an existing customer or add a new customer (name, phone, address) to attach the installment schedule and payment reminders.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/20"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Select or Add Customer Now (تحديد العميل الآن)</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Contract Holder (صاحب العقد)</span>
                      <span className="font-bold text-white text-sm">{currentCustomer.name}</span>
                      {currentCustomer.phone && (
                        <span className="text-slate-400 font-mono text-[11px] block">{currentCustomer.phone}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Plan Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Down payment */}
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Down Payment (الدفعة الأولى) ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="any"
                        value={downPayment}
                        onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-base font-black text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      ≈ {Math.round(downPayment * secondaryRate).toLocaleString()} L.L.
                    </span>
                  </div>

                  {/* Installment count */}
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Number of Months (عدد الأشهر)
                    </label>
                    <select
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value={2}>2 Months (شهران)</option>
                      <option value={3}>3 Months (3 أشهر)</option>
                      <option value={4}>4 Months (4 أشهر)</option>
                      <option value={5}>5 Months (5 أشهر)</option>
                      <option value={6}>6 Months (6 أشهر - نصف سنة)</option>
                      <option value={8}>8 Months (8 أشهر)</option>
                      <option value={10}>10 Months (10 أشهر)</option>
                      <option value={12}>12 Months (سنة كاملة)</option>
                      <option value={18}>18 Months (سنة ونصف)</option>
                      <option value={24}>24 Months (سنتان)</option>
                      <option value={36}>36 Months (3 سنوات)</option>
                    </select>
                  </div>
                </div>

                {/* Due Date */}
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    First Installment Due Date (تاريخ أول قسط)
                  </label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Financed Remainder (المبلغ المقسط)</span>
                    <span className="font-black text-amber-400 text-base font-mono">
                      ${financedRemaining.toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-[10px] block font-mono">
                      ({Math.round(financedRemaining * secondaryRate).toLocaleString()} L.L.)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Monthly Installment (القسط الشهري)</span>
                    <span className="font-black text-emerald-400 text-base font-mono">
                      ${monthlyInstallment.toFixed(2)} / mo
                    </span>
                    <span className="text-emerald-300/80 text-[10px] block font-mono">
                      ({Math.round(monthlyInstallment * secondaryRate).toLocaleString()} L.L. / mo)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Submit Button */}
          <div className="p-5 border-t border-slate-800 bg-slate-950/80 shrink-0">
            <button
              onClick={handleFinish}
              disabled={isSubmitting || (paymentType === 'CASH' && isUnderpaid)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-emerald-600/30 transition text-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Processing Order...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {paymentType === 'INSTALLMENT'
                      ? `Create Installment Sale (Down Payment: $${downPayment.toFixed(2)})`
                      : I18nService.t('pos.finish_sale')}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Customer Selection Modal */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        selectedCustomerId={currentCustomer?.id}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={handleCustomerSelected}
      />
    </>
  );
};
