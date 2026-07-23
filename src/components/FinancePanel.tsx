/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { 
  FinancialAccount, 
  FinancialMovement, 
  Counterparty, 
  CostCategory, 
  MovementType, 
  MovementStatus, 
  Currency 
} from "../types.js";
import { 
  Plus, 
  Check, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Scale, 
  AlertTriangle, 
  Info,
  RefreshCw
} from "lucide-react";

interface FinancePanelProps {
  accounts: FinancialAccount[];
  movements: FinancialMovement[];
  counterparties: Counterparty[];
  categories: CostCategory[];
  tenantId: string;
  onRefresh: () => void;
  exchangeRates: any;
}

export default function FinancePanel({
  accounts,
  movements,
  counterparties,
  categories,
  tenantId,
  onRefresh,
  exchangeRates
}: FinancePanelProps) {
  // Movement form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [type, setType] = useState<MovementType>(MovementType.EGRESO);
  const [accountId, setAccountId] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(Currency.USD);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cash count (Arqueo) state
  const [selectedAccId, setSelectedAccId] = useState("");
  const [physicalCount, setPhysicalCount] = useState("");
  const [arqueoNotes, setArqueoNotes] = useState("");
  const [showArqueoConfirm, setShowArqueoConfirm] = useState(false);
  const [calculatedDiff, setCalculatedDiff] = useState<number | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Filter leaf categories
  const leafCategories = categories.filter(c => c.isLeaf);

  // Submit new movement
  const handleAddMovement = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!accountId || !amount || Number(amount) <= 0 || !description) {
      setErrorMsg("Por favor complete todos los campos obligatorios.");
      return;
    }

    if (type === MovementType.TRANSFERENCIA && !targetAccountId) {
      setErrorMsg("Debe especificar una cuenta destino para transferencias.");
      return;
    }

    if (type === MovementType.TRANSFERENCIA && accountId === targetAccountId) {
      setErrorMsg("La cuenta de origen y destino no pueden ser iguales.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate conversion rate if needed
      const rate = currency === Currency.USD ? 1.0 : exchangeRates.ARS_USD_MEP;
      const baseAmount = currency === Currency.USD ? Number(amount) : Number(amount) / rate;

      const response = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          accountId,
          targetAccountId: type === MovementType.TRANSFERENCIA ? targetAccountId : undefined,
          counterpartyId: counterpartyId || undefined,
          categoryId: categoryId || undefined,
          amount: Number(amount),
          currency,
          baseAmount,
          exchangeRate: rate,
          type,
          description,
          status: MovementStatus.PENDING_VALIDATION, // Under review by default
          date,
          performedBy: "Administrador de Finanzas"
        })
      });

      if (!response.ok) {
        throw new Error("Error al registrar movimiento.");
      }

      // Reset
      setShowAddModal(false);
      setAmount("");
      setDescription("");
      setCounterpartyId("");
      setCategoryId("");
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error de red.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Change movement status
  const handleUpdateStatus = async (id: string, status: MovementStatus) => {
    try {
      const response = await fetch(`/api/movements/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          approvedBy: "Gerente de Finanzas"
        })
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Arqueo Calculations
  const triggerArqueoCheck = () => {
    if (!selectedAccId || !physicalCount) return;
    const acc = accounts.find(a => a.id === selectedAccId);
    if (!acc) return;

    const diff = Number(physicalCount) - acc.balance;
    setCalculatedDiff(diff);
    setShowArqueoConfirm(true);
  };

  const handleConfirmArqueo = async () => {
    if (!selectedAccId || physicalCount === "") return;
    try {
      const response = await fetch("/api/cash-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          accountId: selectedAccId,
          physicalBalance: Number(physicalCount),
          performedBy: "Auditor de Campo",
          notes: arqueoNotes
        })
      });

      if (response.ok) {
        const newCount = await response.json();
        // Automatically approve count to apply compensatory entry
        await fetch(`/api/cash-counts/${newCount.id}/approve`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvedBy: "Director Financiero" })
        });

        // Reset
        setPhysicalCount("");
        setArqueoNotes("");
        setShowArqueoConfirm(false);
        setCalculatedDiff(null);
        onRefresh();
      }
    } catch (err) {
      console.error("Arqueo failed", err);
    }
  };

  // Filter ledger list
  const filteredMovements = movements.filter(m => {
    const matchesSearch = 
      m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      counterparties.find(c => c.id === m.counterpartyId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categories.find(c => c.id === m.categoryId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = 
      filterType === "ALL" || 
      (filterType === "INGRESO" && m.type === MovementType.INGRESO) ||
      (filterType === "EGRESO" && m.type === MovementType.EGRESO) ||
      (filterType === "TRANSFERENCIA" && m.type === MovementType.TRANSFERENCIA) ||
      (filterType === "PENDING" && m.status === MovementStatus.PENDING_VALIDATION);

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6" id="finance-panel-container">
      {/* 1. Accounts Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold font-display text-slate-800">Cuentas y Liquidez</h2>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium text-sm transition-colors cursor-pointer"
            id="btn-new-movement"
          >
            <Plus className="w-4 h-4" /> Registrar Movimiento
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs" id={`card-acc-${acc.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-50 text-slate-500 rounded-lg">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm text-slate-500">{acc.type}</span>
                </div>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                  {acc.currency}
                </span>
              </div>
              <p className="font-semibold text-slate-800 truncate" title={acc.name}>{acc.name}</p>
              <p className="font-mono text-xl font-bold text-slate-900 mt-2">
                {acc.currency === Currency.USD ? "u$s " : acc.currency === Currency.BRL ? "R$ " : "$ "}
                {acc.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Main Ledger & Search (Left 2/3) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold font-display text-slate-800">Libro Diario de Caja</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Buscar por descripción, proveedor..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-sm outline-none focus:border-amber-500 max-w-xs"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-sm outline-none focus:border-amber-500 bg-slate-50 text-slate-700"
              >
                <option value="ALL">Todos los tipos</option>
                <option value="INGRESO">Ingresos</option>
                <option value="EGRESO">Egresos</option>
                <option value="TRANSFERENCIA">Transferencias</option>
                <option value="PENDING">Pendientes</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Concepto</th>
                  <th className="py-2">Imputación</th>
                  <th className="py-2">Cuenta</th>
                  <th className="py-2 text-right">Importe</th>
                  <th className="py-2 text-center">Estado</th>
                  <th className="py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No se encontraron movimientos registrados en esta vista.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(mov => {
                    const acc = accounts.find(a => a.id === mov.accountId);
                    const destAcc = mov.targetAccountId ? accounts.find(a => a.id === mov.targetAccountId) : null;
                    const cp = counterparties.find(c => c.id === mov.counterpartyId);
                    const cat = categories.find(c => c.id === mov.categoryId);

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors" id={`row-mov-${mov.id}`}>
                        <td className="py-3 font-mono text-xs">{mov.date}</td>
                        <td className="py-3">
                          <p className="font-medium text-slate-800">{mov.description}</p>
                          {cp && <span className="text-xs text-slate-400">{cp.name}</span>}
                        </td>
                        <td className="py-3">
                          {mov.type === MovementType.TRANSFERENCIA ? (
                            <span className="text-slate-400 italic text-xs">Transferencia</span>
                          ) : (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                              {cat?.name || "Sin imputar"}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <p className="text-xs font-semibold text-slate-600">{acc?.name}</p>
                          {destAcc && <p className="text-[10px] text-amber-600">→ {destAcc.name}</p>}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {mov.type === MovementType.INGRESO ? (
                              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                            ) : mov.type === MovementType.EGRESO ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />
                            ) : null}
                            <span className={`font-mono font-bold ${
                              mov.type === MovementType.INGRESO 
                                ? "text-emerald-600" 
                                : mov.type === MovementType.EGRESO 
                                ? "text-rose-600" 
                                : "text-amber-600"
                            }`}>
                              {mov.currency === Currency.USD ? "u$s " : mov.currency === Currency.BRL ? "R$ " : "$ "}
                              {mov.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            mov.status === MovementStatus.POSTED 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : mov.status === MovementStatus.APPROVED
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : mov.status === MovementStatus.PENDING_VALIDATION
                              ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {mov.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {mov.status === MovementStatus.PENDING_VALIDATION && (
                              <>
                                <button 
                                  onClick={() => handleUpdateStatus(mov.id, MovementStatus.APPROVED)}
                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                  title="Validar y Aprobar"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleUpdateStatus(mov.id, MovementStatus.REJECTED)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Rechazar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {mov.status === MovementStatus.APPROVED && (
                              <button 
                                onClick={() => handleUpdateStatus(mov.id, MovementStatus.POSTED)}
                                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer"
                                title="Postear al saldo"
                              >
                                Postear
                              </button>
                            )}
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

        {/* 3. Cash Count (Arqueo de Caja) (Right 1/3) */}
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold font-display">Arqueo de Caja y Control</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              El arqueo de caja física valida que los saldos registrados correspondan a los fondos reales disponibles. Toda discrepancia generará un registro compensatorio de ajuste oficial.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Seleccionar Caja de Control</label>
                <select 
                  value={selectedAccId}
                  onChange={(e) => setSelectedAccId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar Cuenta --</option>
                  {accounts.filter(a => a.type === "Caja" || a.type === "Caja Fuerte").map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
              </div>

              {selectedAccId && (
                <div className="p-3 bg-slate-800/50 rounded border border-slate-800 flex justify-between items-center animate-fade-in">
                  <span className="text-xs text-slate-400">Saldo del Sistema:</span>
                  <span className="font-mono font-bold text-sm">
                    {accounts.find(a => a.id === selectedAccId)?.currency} {accounts.find(a => a.id === selectedAccId)?.balance.toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Monto Físico Contado</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Notas de Arqueo (Opcional)</label>
                <textarea 
                  placeholder="Detalles sobre rotación de billetes, faltantes temporales, etc."
                  value={arqueoNotes}
                  onChange={(e) => setArqueoNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-amber-500 h-16 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={triggerArqueoCheck}
              disabled={!selectedAccId || !physicalCount}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 font-semibold py-2 rounded text-sm transition-colors cursor-pointer"
            >
              Comprobar Diferencias
            </button>
          </div>

          {/* Arqueo confirmation popup */}
          {showArqueoConfirm && calculatedDiff !== null && (
            <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 text-slate-900 animate-fade-in">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
                <div className="flex items-center gap-2 text-amber-600 mb-3">
                  <AlertTriangle className="w-6 h-6" />
                  <h4 className="text-lg font-semibold font-display">Confirmar Ajuste por Arqueo</h4>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Se ha detectado una diferencia de{" "}
                  <span className={`font-mono font-bold ${calculatedDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {calculatedDiff >= 0 ? "+" : ""}
                    {calculatedDiff.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>{" "}
                  respecto al saldo del sistema.
                </p>
                <div className="p-3 bg-slate-50 border rounded text-xs space-y-1 text-slate-500 mb-4">
                  <p>• Cuenta: <strong>{accounts.find(a => a.id === selectedAccId)?.name}</strong></p>
                  <p>• Saldo Sistema: <strong>{accounts.find(a => a.id === selectedAccId)?.balance.toLocaleString()}</strong></p>
                  <p>• Saldo Físico: <strong>{Number(physicalCount).toLocaleString()}</strong></p>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Al confirmar, se creará automáticamente un asiento compensatorio por la diferencia para actualizar los registros.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={handleConfirmArqueo}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 rounded text-sm cursor-pointer"
                  >
                    Confirmar y Ajustar
                  </button>
                  <button 
                    onClick={() => { setShowArqueoConfirm(false); setCalculatedDiff(null); }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded text-sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Registrar Movimiento Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-900">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold font-display">Registrar Movimiento Financiero</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMovement} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Operación</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(MovementType).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                        type === t 
                          ? "bg-amber-500/10 border-amber-500 text-amber-700" 
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Cuenta {type === MovementType.TRANSFERENCIA ? "Origen" : ""}</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 text-slate-800 outline-none focus:border-amber-500"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>

                {type === MovementType.TRANSFERENCIA ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Cuenta Destino</label>
                    <select
                      value={targetAccountId}
                      onChange={(e) => setTargetAccountId(e.target.value)}
                      className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 text-slate-800 outline-none focus:border-amber-500"
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Contraparte (Persona/Empresa)</label>
                    <select
                      value={counterpartyId}
                      onChange={(e) => setCounterpartyId(e.target.value)}
                      className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 text-slate-800 outline-none focus:border-amber-500"
                    >
                      <option value="">Ninguna</option>
                      {counterparties.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Monto del Asiento</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Moneda</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 text-slate-800 outline-none focus:border-amber-500"
                  >
                    {Object.values(Currency).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category selector (hidden for transfers) */}
              {type !== MovementType.TRANSFERENCIA && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Rubro / Imputación de Obra</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 text-slate-800 outline-none focus:border-amber-500"
                  >
                    <option value="">-- Sin imputación --</option>
                    {leafCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>[{cat.code}] {cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date and Description */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1 text-xs outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción corta</label>
                  <input
                    type="text"
                    placeholder="Factura de materiales, jornal, aporte..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 rounded text-xs transition-colors cursor-pointer"
                >
                  {isSubmitting ? "Registrando..." : "Registrar y Enviar a Validación"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
