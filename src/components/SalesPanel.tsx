/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { 
  SellableUnit, 
  SalesContract, 
  Installment, 
  FinancialAccount, 
  InstallmentStatus, 
  IndexType,
  Currency,
  Counterparty
} from "../types.js";
import { 
  Building2, 
  Layers, 
  Percent, 
  User, 
  Calendar, 
  DollarSign, 
  Sliders, 
  TrendingUp, 
  CreditCard,
  CheckCircle2,
  Info,
  Plus,
  X
} from "lucide-react";

interface SalesPanelProps {
  units: SellableUnit[];
  contracts: SalesContract[];
  installments: Installment[];
  accounts: FinancialAccount[];
  counterparties: Counterparty[];
  tenantId: string;
  onRefresh: () => void;
}

export default function SalesPanel({
  units,
  contracts,
  installments,
  accounts,
  counterparties,
  tenantId,
  onRefresh
}: SalesPanelProps) {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [cacIndexSimulated, setCacIndexSimulated] = useState(2845.6);
  const [isPaying, setIsPaying] = useState(false);
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState("");

  // Client management states
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Counterparty | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");
  const [clientContactName, setClientContactName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  const clients = counterparties.filter(c => c.type === "Cliente");

  const handleSaveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientName) return;
    setIsSubmittingClient(true);
    try {
      const response = await fetch("/api/counterparties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingClient?.id || undefined,
          tenantId,
          name: clientName,
          type: "Cliente",
          taxId: clientTaxId,
          contactName: clientContactName,
          email: clientEmail,
          phone: clientPhone
        })
      });
      if (response.ok) {
        setEditingClient(null);
        setClientName("");
        setClientTaxId("");
        setClientContactName("");
        setClientEmail("");
        setClientPhone("");
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleEditClientStart = (cli: Counterparty) => {
    setEditingClient(cli);
    setClientName(cli.name);
    setClientTaxId(cli.taxId || "");
    setClientContactName(cli.contactName || "");
    setClientEmail(cli.email || "");
    setClientPhone(cli.phone || "");
  };

  const handleCancelEditClient = () => {
    setEditingClient(null);
    setClientName("");
    setClientTaxId("");
    setClientContactName("");
    setClientEmail("");
    setClientPhone("");
  };

  const activeContract = contracts.find(c => c.id === selectedContractId);
  const activeUnit = activeContract ? units.find(u => u.id === activeContract.unitId) : null;

  // Filter installments for active contract
  const contractInstallments = activeContract 
    ? installments.filter(inst => inst.contractId === activeContract.id)
    : [];

  // Recalculate adjusted amount live if index changes
  const getSimulatedAdjustedAmount = (inst: Installment) => {
    if (inst.status === InstallmentStatus.PAID) {
      return inst.adjustedAmount; // Keep historical paid amount
    }
    if (inst.indexType === IndexType.NONE) {
      return inst.originalAmount;
    }
    const ratio = cacIndexSimulated / inst.indexBaseValue;
    return Number((inst.originalAmount * ratio).toFixed(2));
  };

  const handlePayInstallment = async (instId: string) => {
    setPayingInstallmentId(instId);
    const bankAcc = accounts.find(a => a.type === "Banco");
    setSelectedBankId(bankAcc?.id || "");
    setIsPaying(true);
  };

  const confirmPayment = async () => {
    if (!payingInstallmentId || !selectedBankId) return;

    const inst = installments.find(i => i.id === payingInstallmentId);
    if (!inst) return;

    // Use current adjusted amount calculated
    const finalAmount = getSimulatedAdjustedAmount(inst);

    try {
      // First adjust on backend
      await fetch(`/api/installments/${payingInstallmentId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexCurrentValue: cacIndexSimulated })
      });

      // Then trigger payment
      const response = await fetch(`/api/installments/${payingInstallmentId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedBankId,
          paidAmount: finalAmount
        })
      });

      if (response.ok) {
        setIsPaying(false);
        setPayingInstallmentId(null);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" id="sales-panel-container">
      {/* Header with Client directory button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold font-display text-slate-800 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-amber-500 animate-pulse" /> Módulo de Ventas e Indexación de Cuotas
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Control de inventario de unidades y cobranzas indexadas por índice de la Cámara de la Construcción (CAC)</p>
        </div>
        <button
          onClick={() => setShowClientModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded cursor-pointer transition-colors border border-slate-200 shadow-2xs shrink-0 self-start sm:self-auto"
        >
          <User className="w-3.5 h-3.5 text-amber-600" /> Directorio de Clientes y Contactos
        </button>
      </div>

      {/* 1. Units Inventory Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inventario de Unidades</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {units.map(unit => (
            <div 
              key={unit.id} 
              className={`p-3 rounded-lg border text-xs flex flex-col justify-between h-24 shadow-2xs ${
                unit.status === "SOLD" 
                  ? "bg-slate-50 border-slate-200 text-slate-500" 
                  : unit.status === "RESERVED" 
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-white border-slate-100 hover:border-amber-400 cursor-pointer transition-colors"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[9px] font-bold uppercase bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                    {unit.type}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    unit.status === "SOLD" ? "bg-slate-400" : unit.status === "RESERVED" ? "bg-amber-500" : "bg-emerald-500"
                  }`} />
                </div>
                <p className="font-bold text-slate-800 truncate" title={unit.name}>{unit.name}</p>
              </div>

              <div className="flex justify-between items-end mt-2">
                <span className="text-[10px] text-slate-400">{unit.surfaceM2} m²</span>
                <span className="font-mono font-bold text-slate-900">
                  {unit.currency === Currency.USD ? "u$s " : "$ "}
                  {unit.price.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Contracts Selection (Left 1/3) */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-xs">
          <h3 className="text-base font-semibold font-display text-slate-800 mb-4 flex items-center gap-1.5">
            <Building2 className="w-4.5 h-4.5 text-slate-500" /> Contratos de Venta Activos
          </h3>

          <div className="space-y-3">
            {contracts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No hay contratos vigentes.</p>
            ) : (
              contracts.map(con => {
                const u = units.find(unit => unit.id === con.unitId);
                return (
                  <div 
                    key={con.id}
                    onClick={() => setSelectedContractId(con.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedContractId === con.id 
                        ? "border-amber-500 bg-amber-500/5 shadow-xs" 
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-slate-800 font-bold">{u?.name}</span>
                      <span className="text-amber-600 font-mono">{con.indexType} Index</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2">Fecha Contrato: {con.contractDate}</p>
                    <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-slate-100/60">
                      <span className="text-slate-400">Total Financiamiento:</span>
                      <span className="font-mono font-bold text-slate-700">
                        {con.currency} {con.totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. Installments Adjustment Slider & Ledger (Right 2/3) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
          {activeContract ? (
            <div className="space-y-4 animate-fade-in">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                    Plan de Cuotas: <span className="text-amber-600 font-display">{activeUnit?.name}</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Cuotas indexadas con base en {activeContract.indexType} en fecha de firma.
                  </p>
                </div>

                {/* Index Adjuster Slider */}
                {activeContract.indexType !== IndexType.NONE && (
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100 max-w-xs flex items-center gap-3">
                    <Sliders className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold mb-0.5">
                        <span>Índice CAC Simulado</span>
                        <span className="font-mono text-amber-600">{cacIndexSimulated.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range"
                        min="2540"
                        max="3400"
                        step="10"
                        value={cacIndexSimulated}
                        onChange={(e) => setCacIndexSimulated(Number(e.target.value))}
                        className="w-40 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Installments Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-2">N° Cuota</th>
                      <th className="py-2">Vencimiento</th>
                      <th className="py-2 text-right">Cuota Base</th>
                      <th className="py-2 text-right">Índice Base</th>
                      <th className="py-2 text-right">Índice Ajustado</th>
                      <th className="py-2 text-right">Monto Ajustado</th>
                      <th className="py-2 text-center">Estado</th>
                      <th className="py-2 text-right">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600">
                    {contractInstallments.map(inst => {
                      const finalAdjusted = getSimulatedAdjustedAmount(inst);
                      return (
                        <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 font-mono font-bold text-slate-800">#{inst.installmentNumber}</td>
                          <td className="py-3 font-mono text-slate-500">{inst.dueDate}</td>
                          <td className="py-3 text-right font-mono text-slate-700">
                            {inst.currency} {inst.originalAmount.toLocaleString("es-AR")}
                          </td>
                          <td className="py-3 text-right font-mono text-slate-400">{inst.indexBaseValue}</td>
                          <td className="py-3 text-right font-mono text-amber-600 font-medium">
                            {inst.status === InstallmentStatus.PAID ? inst.indexCurrentValue : cacIndexSimulated.toFixed(1)}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-slate-900">
                            {inst.currency} {finalAdjusted?.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              inst.status === InstallmentStatus.PAID 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}>
                              {inst.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {inst.status !== InstallmentStatus.PAID ? (
                              <button
                                onClick={() => handlePayInstallment(inst.id)}
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[4px] font-semibold text-[10px] cursor-pointer"
                              >
                                Pagar
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 justify-end">
                                <CheckCircle2 className="w-3 h-3" /> Cobrado
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 text-center space-y-3">
              <TrendingUp className="w-10 h-10 text-slate-200" />
              <p className="text-xs">Seleccione un contrato de venta para auditar sus cuotas indexadas.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagar Cuota Dialog Modal */}
      {isPaying && payingInstallmentId && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <CreditCard className="w-6 h-6" />
              <h4 className="text-lg font-semibold font-display">Registrar Cobranza de Cuota</h4>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Confirme la recepción del cobro de la cuota del adquirente. Esto registrará de forma inmutable un ingreso corriente en la cuenta bancaria.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Cobrar e Imputar en Cuenta Bancaria</label>
                <select 
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800 outline-none"
                  required
                >
                  <option value="">Seleccionar Banco...</option>
                  {accounts.filter(a => a.type === "Banco").map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
              </div>

              <div className="p-2.5 bg-slate-50 border rounded text-xs space-y-1 text-slate-600">
                <p>• Unidad: <strong>{activeUnit?.name}</strong></p>
                <p>• Cuota: <strong>#{installments.find(i => i.id === payingInstallmentId)?.installmentNumber}</strong></p>
                <p>• Total a Cobrar: <strong className="font-mono text-emerald-600">
                  {installments.find(i => i.id === payingInstallmentId)?.currency}{" "}
                  {getSimulatedAdjustedAmount(installments.find(i => i.id === payingInstallmentId)!).toLocaleString()}
                </strong></p>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={confirmPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded text-xs cursor-pointer"
              >
                Confirmar Cobranza
              </button>
              <button 
                onClick={() => { setIsPaying(false); setPayingInstallmentId(null); }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Directorio de Clientes y Contactos Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <h3 className="font-semibold font-display flex items-center gap-1.5 text-sm">
                <User className="w-4 h-4 text-amber-400" /> Directorio de Clientes y Contactos Comerciales
              </h3>
              <button onClick={() => { setShowClientModal(false); handleCancelEditClient(); }} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Side: Clients List */}
              <div className="space-y-3 flex flex-col">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2 shrink-0">Adquirentes / Clientes Registrados</h4>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 max-h-[45vh]">
                  {clients.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No hay clientes registrados para esta empresa.</p>
                  ) : (
                    clients.map(cli => (
                      <div key={cli.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-xs hover:border-amber-500 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-bold text-slate-800 text-[13px]">{cli.name}</h5>
                            <p className="font-mono text-[10px] text-slate-500 mt-0.5">DNI / CUIT: {cli.taxId || "No asignado"}</p>
                          </div>
                          <button
                            onClick={() => handleEditClientStart(cli)}
                            className="text-amber-600 hover:text-amber-800 font-semibold text-[11px] cursor-pointer"
                          >
                            Editar
                          </button>
                        </div>
                        
                        {(cli.contactName || cli.email || cli.phone) && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 text-[10px] text-slate-600 space-y-0.5">
                            {cli.contactName && <p>• Persona de Contacto: <strong>{cli.contactName}</strong></p>}
                            {cli.email && <p>• Email: <span className="font-mono">{cli.email}</span></p>}
                            {cli.phone && <p>• Celular: <span className="font-mono">{cli.phone}</span></p>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Side: Form to Add/Edit Client */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col">
                <form onSubmit={handleSaveClient} className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                    {editingClient ? "Modificar Cliente / Contacto" : "Dar de Alta Nuevo Cliente"}
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-1">Nombre Completo / Razón Social *</label>
                      <input
                        type="text"
                        placeholder="Ej. Eduardo Pérez"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-1">Identificación Fiscal / DNI / CUIT</label>
                      <input
                        type="text"
                        placeholder="Ej. 20-33458921-2"
                        value={clientTaxId}
                        onChange={(e) => setClientTaxId(e.target.value)}
                        className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none font-mono"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200/50">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-2">Detalles de Contacto Adquirente</span>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Nombre de Contacto Alternativo / Apoderado</label>
                          <input
                            type="text"
                            placeholder="Ej. Dra. María Pérez (Abogada)"
                            value={clientContactName}
                            onChange={(e) => setClientContactName(e.target.value)}
                            className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Email Principal</label>
                            <input
                              type="email"
                              placeholder="eduardo@perez.com"
                              value={clientEmail}
                              onChange={(e) => setClientEmail(e.target.value)}
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Teléfono / Celular</label>
                            <input
                              type="text"
                              placeholder="+54 9 11 5821 3921"
                              value={clientPhone}
                              onChange={(e) => setClientPhone(e.target.value)}
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingClient}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold py-2 rounded text-xs cursor-pointer text-center"
                    >
                      {isSubmittingClient ? "Guardando..." : editingClient ? "Guardar Cambios" : "Cargar Cliente"}
                    </button>
                    {editingClient && (
                      <button
                        type="button"
                        onClick={handleCancelEditClient}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 rounded text-xs cursor-pointer text-center"
                      >
                        Cancelar Edición
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
