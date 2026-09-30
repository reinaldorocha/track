"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Percent, 
  Edit, 
  Trash2, 
  CreditCard, 
  QrCode, 
  Receipt, 
  Calculator, 
  DollarSign, 
  Sparkles, 
  Check, 
  AlertCircle, 
  TrendingUp, 
  Layers,
  HelpCircle,
  ShieldCheck
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Fee = {
  id: string;
  name: string;
  type: string;
  paymentMethod?: string | null;
  percentage: number;
  fixedAmount: number;
  installmentFee?: number | null;
  platform?: string | null;
  isActive: boolean;
};

type Tax = {
  id: string;
  name: string;
  type: string; // sales, meta_ads
  percentage: number;
  platform?: string | null;
  isActive: boolean;
};

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix", icon: QrCode, badge: "⚡ Pix" },
  { value: "card_single", label: "Cartão à Vista (1x)", icon: CreditCard, badge: "💳 Cartão à Vista" },
  { value: "card_installments", label: "Cartão Parcelado (2x a 12x)", icon: CreditCard, badge: "💳 Cartão Parcelado" },
  { value: "boleto", label: "Boleto Bancário", icon: Receipt, badge: "📄 Boleto" },
  { value: "all", label: "Todos os Métodos (Geral)", icon: Layers, badge: "🌐 Todos" },
];

const PLATFORMS = [
  { value: "", label: "Todas as Plataformas" },
  { value: "getfy", label: "Getfy" },
  { value: "cakto", label: "Cakto" },
  { value: "kiwify", label: "Kiwify" },
  { value: "hotmart", label: "Hotmart" },
  { value: "yampi", label: "Yampi" },
  { value: "shopify", label: "Shopify" },
  { value: "generic", label: "Genérico" },
];

const TAX_TYPES = [
  { 
    value: "meta_ads", 
    label: "Imposto sobre Anúncios (Meta Ads)", 
    badge: "🎯 Tráfego Pago",
    description: "Calculado sobre o gasto total de anúncios da Meta e deduzido do Lucro Líquido Real e ROI." 
  },
  { 
    value: "sales", 
    label: "Imposto sobre Vendas (Simples Nacional / NF)", 
    badge: "🏛️ Faturamento",
    description: "Calculado sobre o faturamento bruto das vendas aprovadas." 
  },
];

/* -------------------------------------------------------------
 * MODAL DE TAXA DE CHECKOUT / GATEWAY
 * ------------------------------------------------------------*/
function FeeModal({
  fee,
  initialMethod,
  onClose,
  onSave,
}: {
  fee?: Fee | null;
  initialMethod?: string;
  onClose: () => void;
  onSave: (d: Partial<Fee>) => void;
}) {
  const [form, setForm] = useState({
    name: fee?.name || (initialMethod === "pix" ? "Taxa Pix Checkout" : initialMethod === "card_single" ? "Taxa Cartão à Vista" : initialMethod === "card_installments" ? "Taxa Cartão Parcelado" : ""),
    type: fee?.type || "checkout",
    paymentMethod: fee?.paymentMethod ?? initialMethod ?? "pix",
    percentage: fee?.percentage?.toString() || (initialMethod === "pix" ? "1.99" : initialMethod === "card_single" ? "3.99" : initialMethod === "card_installments" ? "4.99" : "0"),
    fixedAmount: fee?.fixedAmount?.toString() || (initialMethod === "card_single" || initialMethod === "card_installments" ? "1.00" : "0.00"),
    installmentFee: fee?.installmentFee?.toString() || (initialMethod === "card_installments" ? "1.50" : "0"),
    platform: fee?.platform || "",
    isActive: fee?.isActive !== false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-[#142C52]/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {fee ? "Editar Taxa de Checkout" : "Nova Taxa de Checkout"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure os custos por forma de pagamento no checkout
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold">×</button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome da Regra
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Ex: Taxa Pix Getfy"
            />
          </div>

          {/* Método de Pagamento & Plataforma */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Método de Pagamento
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => {
                  const m = e.target.value;
                  setForm({
                    ...form,
                    paymentMethod: m,
                    installmentFee: m === "card_installments" && form.installmentFee === "0" ? "1.50" : form.installmentFee,
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Plataforma
              </label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Percentual & Fixo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                % Taxa Percentual
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                  className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="3.99"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Fixo por Venda (R$)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={form.fixedAmount}
                  onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="1.00"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
              </div>
            </div>
          </div>

          {/* Taxa Adicional de Parcelamento (Se cartão parcelado) */}
          {form.paymentMethod === "card_installments" && (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  Taxa Adicional por Parcela (%)
                </label>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Opcional</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={form.installmentFee}
                  onChange={(e) => setForm({ ...form, installmentFee: e.target.value })}
                  className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="1.50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs font-semibold">%</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                Cobrado sobre parcelas adicionais: (Parcelas - 1) × taxa adicional. Ex: 1.5% ao mês.
              </p>
            </div>
          )}

          {/* Fórmula / Exemplo */}
          <div className="p-3 bg-slate-50 dark:bg-[#061224] border border-slate-100 dark:border-[#142C52]/50 rounded-xl text-xs space-y-1 text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">Exemplo em uma venda de R$ 100,00:</span>
            {form.paymentMethod === "card_installments" ? (
              <p>
                Em 3x: R$ 100 × {form.percentage || 0}% + R$ {form.fixedAmount || 0} + (2 × {form.installmentFee || 0}%) = {" "}
                <span className="font-bold text-red-600 dark:text-red-400">
                  {formatCurrency((100 * (parseFloat(form.percentage) || 0) / 100) + (parseFloat(form.fixedAmount) || 0) + (2 * (parseFloat(form.installmentFee) || 0) / 100 * 100))}
                </span> (Líquido: {formatCurrency(100 - ((100 * (parseFloat(form.percentage) || 0) / 100) + (parseFloat(form.fixedAmount) || 0) + (2 * (parseFloat(form.installmentFee) || 0) / 100 * 100)))})
              </p>
            ) : (
              <p>
                Taxa descontada: R$ 100 × {form.percentage || 0}% + R$ {form.fixedAmount || 0} = {" "}
                <span className="font-bold text-red-600 dark:text-red-400">
                  {formatCurrency((100 * (parseFloat(form.percentage) || 0) / 100) + (parseFloat(form.fixedAmount) || 0))}
                </span> (Líquido: {formatCurrency(100 - ((100 * (parseFloat(form.percentage) || 0) / 100) + (parseFloat(form.fixedAmount) || 0)))})
              </p>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-[#061224]/80 border-t border-slate-100 dark:border-[#142C52] flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-white dark:hover:bg-[#142C52]/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              onSave({
                ...form,
                percentage: parseFloat(form.percentage) || 0,
                fixedAmount: parseFloat(form.fixedAmount) || 0,
                installmentFee: parseFloat(form.installmentFee) || 0,
              });
            }}
            className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-colors"
          >
            Salvar Taxa
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
 * MODAL DE IMPOSTO (META ADS OU VENDAS)
 * ------------------------------------------------------------*/
function TaxModal({
  tax,
  initialType,
  onClose,
  onSave,
}: {
  tax?: Tax | null;
  initialType?: string;
  onClose: () => void;
  onSave: (d: Partial<Tax>) => void;
}) {
  const [form, setForm] = useState({
    name: tax?.name || (initialType === "meta_ads" ? "Imposto Meta Ads" : "Simples Nacional"),
    type: tax?.type || initialType || "meta_ads",
    percentage: tax?.percentage?.toString() || (initialType === "meta_ads" ? "5.00" : "6.00"),
    platform: tax?.platform || "",
    isActive: tax?.isActive !== false,
  });

  const selectedTypeInfo = TAX_TYPES.find((t) => t.value === form.type) || TAX_TYPES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-[#142C52]/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {tax ? "Editar Imposto" : "Novo Imposto"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {form.type === "meta_ads" ? "Taxa sobre anúncios do Meta Ads" : "Imposto sobre faturamento de vendas"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo de Imposto */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Finalidade do Imposto
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {TAX_TYPES.map((t) => {
                const isSelected = form.type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        type: t.value,
                        name: t.value === "meta_ads" ? "Imposto Meta Ads" : "Simples Nacional",
                        percentage: t.value === "meta_ads" ? "5.00" : "6.00",
                      });
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-sm"
                        : "border-slate-200 dark:border-[#142C52] hover:bg-slate-50 dark:hover:bg-[#061224] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-bold block">{t.badge}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 line-clamp-1">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome do Imposto
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Ex: Imposto Meta Ads (5%)"
            />
          </div>

          {/* Alíquota Percentual */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alíquota Percentual (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#061224] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="5.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">%</span>
            </div>
          </div>

          {/* Explicação da Regra */}
          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-xl flex gap-2 text-xs text-amber-800 dark:text-amber-300">
            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">{selectedTypeInfo.label}</p>
              <p className="text-[11px] opacity-90 mt-0.5">{selectedTypeInfo.description}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-[#061224]/80 border-t border-slate-100 dark:border-[#142C52] flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-white dark:hover:bg-[#142C52]/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              onSave({
                ...form,
                percentage: parseFloat(form.percentage) || 0,
              });
            }}
            className="flex-1 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 shadow-md shadow-orange-500/20 transition-colors"
          >
            Salvar Imposto
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
 * PÁGINA PRINCIPAL: TAXAS E IMPOSTOS
 * ------------------------------------------------------------*/
export default function FeesAndTaxesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"checkout" | "taxes" | "simulator">("checkout");

  // Modais de Taxa
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeModalMethod, setFeeModalMethod] = useState<string>("pix");
  const [editingFee, setEditingFee] = useState<Fee | null>(null);

  // Modais de Imposto
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxModalType, setTaxModalType] = useState<string>("meta_ads");
  const [editingTax, setEditingTax] = useState<Tax | null>(null);

  // Simulador de Venda
  const [simSaleAmount, setSimSaleAmount] = useState<number>(100);
  const [simInstallments, setSimInstallments] = useState<number>(3);
  const [simAdSpend, setSimAdSpend] = useState<number>(50);

  // Queries
  const { data: feesData, isLoading: isLoadingFees } = useQuery<{ fees: Fee[] }>({
    queryKey: ["fees"],
    queryFn: () => fetch("/api/fees").then((r) => r.json()),
  });

  const { data: taxesData, isLoading: isLoadingTaxes } = useQuery<{ taxes: Tax[] }>({
    queryKey: ["taxes"],
    queryFn: () => fetch("/api/taxes").then((r) => r.json()),
  });

  const fees = feesData?.fees || [];
  const taxes = taxesData?.taxes || [];

  // Mutations para Fees
  const createFeeMutation = useMutation({
    mutationFn: (body: Partial<Fee>) =>
      fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
      setShowFeeModal(false);
    },
  });

  const updateFeeMutation = useMutation({
    mutationFn: (body: Partial<Fee>) =>
      fetch("/api/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
      setEditingFee(null);
    },
  });

  const deleteFeeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/fees?id=${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
    },
  });

  // Mutations para Taxes
  const createTaxMutation = useMutation({
    mutationFn: (body: Partial<Tax>) =>
      fetch("/api/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
      setShowTaxModal(false);
    },
  });

  const updateTaxMutation = useMutation({
    mutationFn: (body: Partial<Tax>) =>
      fetch("/api/taxes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
      setEditingTax(null);
    },
  });

  const deleteTaxMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/taxes?id=${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
    },
  });

  // Identificar regras ativas em destaque
  const pixFee = fees.find((f) => f.isActive && f.paymentMethod === "pix");
  const cardSingleFee = fees.find((f) => f.isActive && f.paymentMethod === "card_single");
  const cardInstFee = fees.find((f) => f.isActive && f.paymentMethod === "card_installments");
  const metaAdsTax = taxes.find((t) => t.isActive && (t.type === "meta_ads" || t.name.toLowerCase().includes("meta") || t.name.toLowerCase().includes("iof")));
  const salesTax = taxes.find((t) => t.isActive && (t.type === "sales" || !t.type));

  // Aplicar Presets Rápidos
  const applyPreset = async (presetType: string) => {
    if (presetType === "default_gateway") {
      // Cria regras padrões de mercado
      await createFeeMutation.mutateAsync({
        name: "Taxa Pix Padrão",
        type: "checkout",
        paymentMethod: "pix",
        percentage: 1.99,
        fixedAmount: 0.0,
      });
      await createFeeMutation.mutateAsync({
        name: "Taxa Cartão à Vista",
        type: "checkout",
        paymentMethod: "card_single",
        percentage: 3.99,
        fixedAmount: 1.0,
      });
      await createFeeMutation.mutateAsync({
        name: "Taxa Cartão Parcelado",
        type: "checkout",
        paymentMethod: "card_installments",
        percentage: 4.99,
        fixedAmount: 1.0,
        installmentFee: 1.5,
      });
    } else if (presetType === "meta_tax" || presetType === "meta_iof") {
      await createTaxMutation.mutateAsync({
        name: "Imposto Meta Ads (Anúncios)",
        type: "meta_ads",
        percentage: 5.0,
      });
    } else if (presetType === "simples_nacional") {
      await createTaxMutation.mutateAsync({
        name: "Simples Nacional (Vendas)",
        type: "sales",
        percentage: 6.0,
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* 1. Header com Título e Ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Percent className="w-6 h-6 text-blue-600" />
            Taxas & Impostos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure taxas de checkout por método de pagamento (Pix, Cartão à vista e parcelado) e impostos da operação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFeeModalMethod("pix");
              setShowFeeModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Taxa de Checkout
          </button>

          <button
            onClick={() => {
              setTaxModalType("meta_ads");
              setShowTaxModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-orange-500/20 transition-all"
          >
            <Receipt className="w-4 h-4" />
            Novo Imposto (Meta / Vendas)
          </button>
        </div>
      </div>

      {/* 2. Destaques das Regras Configuradas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card Pix */}
        <div className="p-4 bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-emerald-500" />
              Taxa Pix
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pixFee ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-[#061224] dark:text-slate-400"}`}>
              {pixFee ? "Ativa" : "Padrão (0%)"}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {pixFee ? `${pixFee.percentage}% ${pixFee.fixedAmount > 0 ? `+ ${formatCurrency(pixFee.fixedAmount)}` : ""}` : "0.00%"}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {pixFee ? `Aplicada em ${pixFee.platform || "todas plataformas"}` : "Clique em Nova Taxa para cadastrar"}
          </p>
        </div>

        {/* Card Cartão à Vista */}
        <div className="p-4 bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-500" />
              Cartão à Vista (1x)
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cardSingleFee ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "bg-slate-100 text-slate-600 dark:bg-[#061224] dark:text-slate-400"}`}>
              {cardSingleFee ? "Ativa" : "Padrão (0%)"}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {cardSingleFee ? `${cardSingleFee.percentage}% ${cardSingleFee.fixedAmount > 0 ? `+ ${formatCurrency(cardSingleFee.fixedAmount)}` : ""}` : "0.00%"}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {cardSingleFee ? `Aplicada em ${cardSingleFee.platform || "todas plataformas"}` : "Sem taxa específica"}
          </p>
        </div>

        {/* Card Cartão Parcelado */}
        <div className="p-4 bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-purple-500" />
              Cartão Parcelado
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cardInstFee ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" : "bg-slate-100 text-slate-600 dark:bg-[#061224] dark:text-slate-400"}`}>
              {cardInstFee ? "Ativa" : "Padrão (0%)"}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {cardInstFee ? `${cardInstFee.percentage}% ${cardInstFee.installmentFee ? `+ ${cardInstFee.installmentFee}%/parc` : ""}` : "0.00%"}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {cardInstFee?.fixedAmount ? `Fixo: ${formatCurrency(cardInstFee.fixedAmount)} por venda` : "Taxa de parcelamento configurada"}
          </p>
        </div>

        {/* Card Imposto Meta Ads */}
        <div className="p-4 bg-white dark:bg-[#081A33] border border-orange-200/60 dark:border-orange-950/50 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Imposto Meta Ads
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${metaAdsTax ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" : "bg-slate-100 text-slate-600 dark:bg-[#061224] dark:text-slate-400"}`}>
              {metaAdsTax ? "Ativo" : "0.00%"}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {metaAdsTax ? `${metaAdsTax.percentage}%` : "0.00%"}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Deduzido do gasto com campanhas Meta Ads
          </p>
        </div>

        {/* Card Imposto s/ Faturamento */}
        <div className="p-4 bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Imposto s/ Vendas (NF)
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${salesTax ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-[#061224] dark:text-slate-400"}`}>
              {salesTax ? "Ativo" : "0.00%"}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {salesTax ? `${salesTax.percentage}%` : "0.00%"}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Calculado sobre faturamento bruto
          </p>
        </div>
      </div>

      {/* 3. Navegação por Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#142C52]">
        <button
          onClick={() => setActiveTab("checkout")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "checkout"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Taxas do Checkout por Método ({fees.length})
        </button>

        <button
          onClick={() => setActiveTab("taxes")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "taxes"
              ? "border-orange-600 text-orange-600 dark:text-orange-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Receipt className="w-4 h-4" />
          Impostos (Meta Ads & Faturamento) ({taxes.length})
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "simulator"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Calculator className="w-4 h-4" />
          Simulador de Venda & Retorno Líquido
        </button>
      </div>

      {/* 4. Conteúdo das Abas */}
      {activeTab === "checkout" && (
        <div className="space-y-4">
          {/* Card de Predefinições Rápidas */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                  Preenchimento com 1 Clique (Presets de Gateway)
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Deseja cadastrar automaticamente as taxas padrões de mercado para Pix (1.99%), Cartão à Vista (3.99% + R$ 1) e Parcelado (4.99% + 1.5%/parc)?
                </p>
              </div>
            </div>

            <button
              onClick={() => applyPreset("default_gateway")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 shrink-0 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Aplicar Preset Padrão
            </button>
          </div>

          {/* Tabela de Taxas */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#142C52] bg-slate-50/70 dark:bg-[#061224]">
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Nome da Regra</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Método de Pagamento</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Plataforma</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400">% Percentual</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400">Valor Fixo</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400">Taxa p/ Parcela</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400">Exemplo R$ 100</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-500 dark:text-slate-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]/50">
                  {isLoadingFees ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="px-4 py-4 text-center">
                          <div className="h-4 bg-slate-100 dark:bg-[#142C52] rounded animate-pulse w-3/4 mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : fees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        <CreditCard className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="font-semibold text-slate-600 dark:text-slate-400">Nenhuma taxa de checkout cadastrada</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          Cadastre as taxas do seu checkout para Pix, Cartão à vista e Cartão parcelado
                        </p>
                      </td>
                    </tr>
                  ) : (
                    fees.map((fee) => {
                      const methodInfo = PAYMENT_METHODS.find((m) => m.value === fee.paymentMethod) || PAYMENT_METHODS[4];
                      const MethodIcon = methodInfo.icon;
                      const exampleCost = (100 * (fee.percentage / 100)) + fee.fixedAmount;

                      return (
                        <tr key={fee.id} className="hover:bg-slate-50/70 dark:hover:bg-[#142C52]/30 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {fee.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-[#061224] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#142C52]">
                              <MethodIcon className="w-3.5 h-3.5 text-blue-500" />
                              {methodInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {PLATFORMS.find((p) => p.value === fee.platform)?.label || "Todas"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                            {fee.percentage}%
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(fee.fixedAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 font-medium">
                            {fee.installmentFee ? `${fee.installmentFee}% / parc.` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(exampleCost)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingFee(fee)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-[#061224] transition-colors"
                                title="Editar Taxa"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Deseja excluir a taxa "${fee.name}"?`)) {
                                    deleteFeeMutation.mutate(fee.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-[#061224] transition-colors"
                                title="Excluir Taxa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "taxes" && (
        <div className="space-y-4">
          {/* Card explicativo sobre Impostos Meta Ads */}
          <div className="p-4 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/30">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-orange-950 dark:text-orange-100">
                  Impostos sobre Anúncios do Meta Ads
                </h3>
                <p className="text-xs text-orange-800 dark:text-orange-300">
                  Configure o imposto ou retenção sobre o investimento em anúncios. O valor é automaticamente deduzido do Lucro Líquido Real.
                </p>
              </div>
            </div>

            <button
              onClick={() => applyPreset("meta_tax")}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 shrink-0 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Ativar Imposto Meta Ads
            </button>
          </div>

          {/* Tabela de Impostos */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#142C52] bg-slate-50/70 dark:bg-[#061224]">
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Nome do Imposto</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Tipo de Incidência</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400">Alíquota (%)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">Base de Cálculo</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-500 dark:text-slate-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]/50">
                  {isLoadingTaxes ? (
                    [...Array(2)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-4 py-4 text-center">
                          <div className="h-4 bg-slate-100 dark:bg-[#142C52] rounded animate-pulse w-3/4 mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : taxes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="font-semibold text-slate-600 dark:text-slate-400">Nenhum imposto cadastrado</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          Adicione o imposto sobre faturamento ou anúncios
                        </p>
                      </td>
                    </tr>
                  ) : (
                    taxes.map((tax) => {
                      const isMeta = tax.type === "meta_ads" || tax.name.toLowerCase().includes("meta") || tax.name.toLowerCase().includes("iof");
                      return (
                        <tr key={tax.id} className="hover:bg-slate-50/70 dark:hover:bg-[#142C52]/30 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {tax.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                              isMeta
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-900/50"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                            }`}>
                              {isMeta ? "🎯 Meta Ads / Anúncios" : "🏛️ Faturamento / Vendas"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                            {tax.percentage}%
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {isMeta ? "Investimento consumido no Meta Ads" : "Receita Bruta de Vendas Aprovadas"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingTax(tax)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-[#061224] transition-colors"
                                title="Editar Imposto"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Deseja excluir o imposto "${tax.name}"?`)) {
                                    deleteTaxMutation.mutate(tax.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-[#061224] transition-colors"
                                title="Excluir Imposto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controles do Simulador */}
          <div className="p-5 bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-500" />
              Parâmetros da Simulação
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor da Venda (R$)
              </label>
              <input
                type="number"
                step="1"
                value={simSaleAmount}
                onChange={(e) => setSimSaleAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Número de Parcelas (Cartão)
              </label>
              <select
                value={simInstallments}
                onChange={(e) => setSimInstallments(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gasto de Anúncios Estimado p/ Venda (CPA R$)
              </label>
              <input
                type="number"
                step="1"
                value={simAdSpend}
                onChange={(e) => setSimAdSpend(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#061224] rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">Regras Ativas Usadas:</span>
              <p>• Pix: {pixFee ? `${pixFee.percentage}% + ${formatCurrency(pixFee.fixedAmount)}` : "Sem taxa cadastrada"}</p>
              <p>• Cartão à Vista: {cardSingleFee ? `${cardSingleFee.percentage}% + ${formatCurrency(cardSingleFee.fixedAmount)}` : "Sem taxa cadastrada"}</p>
              <p>• Cartão Parcelado: {cardInstFee ? `${cardInstFee.percentage}% + ${cardInstFee.installmentFee || 0}%/parc` : "Sem taxa cadastrada"}</p>
              <p>• Imposto Meta Ads: {metaAdsTax ? `${metaAdsTax.percentage}%` : "0%"}</p>
            </div>
          </div>

          {/* Comparativo de Resultados */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cenário Pix */}
            {(() => {
              const feePct = (pixFee?.percentage || 0) / 100;
              const fixed = pixFee?.fixedAmount || 0;
              const feeCost = (simSaleAmount * feePct) + fixed;
              const netSale = Math.max(0, simSaleAmount - feeCost);
              const metaTaxAmount = (simAdSpend * ((metaAdsTax?.percentage || 0) / 100));
              const salesTaxAmount = (simSaleAmount * ((salesTax?.percentage || 0) / 100));
              const profit = netSale - simAdSpend - metaTaxAmount - salesTaxAmount;
              const margin = (profit / simSaleAmount) * 100;

              return (
                <div className="p-5 bg-white dark:bg-[#081A33] border border-emerald-200/80 dark:border-emerald-950/60 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <QrCode className="w-4 h-4" />
                        Cenário: PIX
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        Mais Rentável
                      </span>
                    </div>

                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(profit)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lucro Líquido Real ({margin.toFixed(1)}% margem)
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-slate-100 dark:border-[#142C52]/50 pt-3">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Venda Bruta:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(simSaleAmount)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Taxa Pix:</span>
                      <span>-{formatCurrency(feeCost)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600 dark:text-orange-400">
                      <span>Gasto Anúncio (CPA):</span>
                      <span>-{formatCurrency(simAdSpend)}</span>
                    </div>
                    {metaTaxAmount > 0 && (
                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span>Imposto Meta Ads:</span>
                        <span>-{formatCurrency(metaTaxAmount)}</span>
                      </div>
                    )}
                    {salesTaxAmount > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Imposto Vendas:</span>
                        <span>-{formatCurrency(salesTaxAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Cenário Cartão à Vista */}
            {(() => {
              const feePct = (cardSingleFee?.percentage || 0) / 100;
              const fixed = cardSingleFee?.fixedAmount || 0;
              const feeCost = (simSaleAmount * feePct) + fixed;
              const netSale = Math.max(0, simSaleAmount - feeCost);
              const metaTaxAmount = (simAdSpend * ((metaAdsTax?.percentage || 0) / 100));
              const salesTaxAmount = (simSaleAmount * ((salesTax?.percentage || 0) / 100));
              const profit = netSale - simAdSpend - metaTaxAmount - salesTaxAmount;
              const margin = (profit / simSaleAmount) * 100;

              return (
                <div className="p-5 bg-white dark:bg-[#081A33] border border-blue-200/80 dark:border-blue-950/60 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" />
                        Cartão à Vista (1x)
                      </span>
                    </div>

                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(profit)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lucro Líquido Real ({margin.toFixed(1)}% margem)
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-slate-100 dark:border-[#142C52]/50 pt-3">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Venda Bruta:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(simSaleAmount)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Taxa Cartão 1x:</span>
                      <span>-{formatCurrency(feeCost)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600 dark:text-orange-400">
                      <span>Gasto Anúncio (CPA):</span>
                      <span>-{formatCurrency(simAdSpend)}</span>
                    </div>
                    {metaTaxAmount > 0 && (
                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span>Imposto Meta Ads:</span>
                        <span>-{formatCurrency(metaTaxAmount)}</span>
                      </div>
                    )}
                    {salesTaxAmount > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Imposto Vendas:</span>
                        <span>-{formatCurrency(salesTaxAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Cenário Cartão Parcelado */}
            {(() => {
              const feePct = (cardInstFee?.percentage || 0) / 100;
              const fixed = cardInstFee?.fixedAmount || 0;
              const instPct = ((cardInstFee?.installmentFee || 0) / 100) * (simInstallments - 1);
              const feeCost = (simSaleAmount * feePct) + fixed + (simSaleAmount * instPct);
              const netSale = Math.max(0, simSaleAmount - feeCost);
              const metaTaxAmount = (simAdSpend * ((metaAdsTax?.percentage || 0) / 100));
              const salesTaxAmount = (simSaleAmount * ((salesTax?.percentage || 0) / 100));
              const profit = netSale - simAdSpend - metaTaxAmount - salesTaxAmount;
              const margin = (profit / simSaleAmount) * 100;

              return (
                <div className="p-5 bg-white dark:bg-[#081A33] border border-purple-200/80 dark:border-purple-950/60 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" />
                        Parcelado ({simInstallments}x)
                      </span>
                    </div>

                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(profit)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lucro Líquido Real ({margin.toFixed(1)}% margem)
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-slate-100 dark:border-[#142C52]/50 pt-3">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Venda Bruta:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(simSaleAmount)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Taxa Cartão {simInstallments}x:</span>
                      <span>-{formatCurrency(feeCost)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600 dark:text-orange-400">
                      <span>Gasto Anúncio (CPA):</span>
                      <span>-{formatCurrency(simAdSpend)}</span>
                    </div>
                    {metaTaxAmount > 0 && (
                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span>Imposto Meta Ads:</span>
                        <span>-{formatCurrency(metaTaxAmount)}</span>
                      </div>
                    )}
                    {salesTaxAmount > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Imposto Vendas:</span>
                        <span>-{formatCurrency(salesTaxAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modais */}
      {showFeeModal && (
        <FeeModal
          initialMethod={feeModalMethod}
          onClose={() => setShowFeeModal(false)}
          onSave={(d) => createFeeMutation.mutate(d)}
        />
      )}

      {editingFee && (
        <FeeModal
          fee={editingFee}
          onClose={() => setEditingFee(null)}
          onSave={(d) => updateFeeMutation.mutate({ ...d, id: editingFee.id })}
        />
      )}

      {showTaxModal && (
        <TaxModal
          initialType={taxModalType}
          onClose={() => setShowTaxModal(false)}
          onSave={(d) => createTaxMutation.mutate(d)}
        />
      )}

      {editingTax && (
        <TaxModal
          tax={editingTax}
          onClose={() => setEditingTax(null)}
          onSave={(d) => updateTaxMutation.mutate({ ...d, id: editingTax.id })}
        />
      )}
    </div>
  );
}
