/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { PublicTender, MarketplaceSupplier, Counterparty } from "../types.js";
import { Hammer, Award, Send, Users, ShieldCheck, DollarSign, Calendar, Clock, Plus, Check, X } from "lucide-react";

interface MarketplacePanelProps {
  tenders: PublicTender[];
  suppliers: MarketplaceSupplier[];
  counterparties: Counterparty[];
  tenantId: string;
  onRefresh: () => void;
}

export default function MarketplacePanel({
  tenders,
  suppliers,
  counterparties,
  tenantId,
  onRefresh
}: MarketplacePanelProps) {
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);

  // Bid form state
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [bidPrice, setBidPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTender = tenders.find(t => t.id === selectedTenderId);

  // Submit Bid from a Supplier
  const handleSubmitBid = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTenderId || !selectedSupplierId || !bidPrice) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/tenders/${selectedTenderId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          price: Number(bidPrice),
          deliveryDays: Number(deliveryDays || 15),
          notes: proposalNotes
        })
      });

      if (response.ok) {
        setShowBidModal(false);
        setBidPrice("");
        setDeliveryDays("");
        setProposalNotes("");
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Award the Tender to a specific Bid
  const handleAwardTender = async (bidId: string) => {
    if (!selectedTenderId) return;

    try {
      const response = await fetch(`/api/tenders/${selectedTenderId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          bidId
        })
      });

      if (response.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="marketplace-panel-container">
      {/* 1. Suppliers Directory & Tenders List (Left 2/3) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Suppliers Directory */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-xs">
          <h3 className="text-base font-semibold font-display text-slate-800 mb-4 flex items-center gap-1.5">
            <Users className="w-5 h-5 text-amber-600" /> Directorio de Proveedores Certificados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {suppliers.map(sup => (
              <div key={sup.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-2.5">
                <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-slate-800">{sup.name}</p>
                  <p className="text-[10px] text-slate-400">Rubros: {sup.categories.join(", ")}</p>
                  <p className="text-[10px] font-semibold text-amber-600">★ {sup.rating} / 5.0</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Public Tenders */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-xs">
          <h3 className="text-base font-semibold font-display text-slate-800 mb-4 flex items-center gap-1.5">
            <Hammer className="w-5 h-5 text-amber-600" /> Registro de Licitaciones Públicas
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2">Licitación</th>
                  <th className="py-2">Empresa Solicitante</th>
                  <th className="py-2">Monto Base</th>
                  <th className="py-2 text-center">Ofertas</th>
                  <th className="py-2 text-center">Estado</th>
                  <th className="py-2 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                 {tenders.map(ten => (
                  <tr 
                    key={ten.id} 
                    className={`hover:bg-slate-50/50 transition-colors ${selectedTenderId === ten.id ? "bg-amber-500/5 font-semibold" : ""}`}
                  >
                    <td className="py-3">
                      <p className="font-bold text-slate-800">{ten.title}</p>
                      <span className="text-[9px] text-slate-400">Cierre: {ten.deadline}</span>
                    </td>
                    <td className="py-3 uppercase text-slate-500 font-semibold">{ten.tenantId.replace("tenant-", "")}</td>
                    <td className="py-3 font-medium text-slate-700">{ten.category}</td>
                    <td className="py-3 text-center font-mono font-bold text-slate-900">{ten.bids.length}</td>
                    <td className="py-3 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                        ten.status === "OPEN" 
                          ? "bg-amber-50 text-amber-700 border border-amber-200" 
                          : "bg-slate-50 text-slate-400"
                      }`}>
                        {ten.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setSelectedTenderId(ten.id)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold cursor-pointer"
                      >
                        Ver Ofertas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Tender Bids list & Awards manager (Right 1/3) */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col justify-between">
        {activeTender ? (
          <div className="space-y-5 animate-fade-in">
            <div>
              <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">Detalles de Ofertas</span>
              <h4 className="font-bold text-sm mt-1 text-slate-100">{activeTender.title}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Rubro de la Licitación: {activeTender.category}</p>
            </div>

            {/* Bids list */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {!activeTender.bids || activeTender.bids.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No se han presentado propuestas todavía.</p>
              ) : (
                activeTender.bids.map(bid => {
                  const s = suppliers.find(sup => sup.id === bid.supplierId);
                  const isAwarded = bid.status === "ACCEPTED";

                  return (
                    <div 
                      key={bid.id} 
                      className={`p-3 bg-slate-800 rounded-lg border text-xs space-y-1.5 ${
                        isAwarded ? "border-emerald-500 bg-emerald-500/5" : "border-slate-800"
                      }`}
                    >
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-200 font-bold">{s?.name || bid.supplierId}</span>
                        <span className="font-mono text-amber-400">USD {bid.amount.toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Propuesta: "{bid.notes}"
                      </p>
                      <div className="flex justify-between items-center text-[9px] pt-1 border-t border-slate-700/50 text-slate-500 font-mono">
                        <span>Plazo: {bid.deliveryWeeks} semanas</span>
                        <span>Estado: {bid.status}</span>
                      </div>

                      {/* Award buttons: only available if tender is open AND the user owns this tender */}
                      {activeTender.status === "OPEN" && activeTender.tenantId === tenantId && (
                        <button
                          onClick={() => handleAwardTender(bid.id)}
                          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" /> Adjudicar Licitación
                        </button>
                      )}

                      {isAwarded && (
                        <span className="w-full mt-2 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold py-1 flex items-center justify-center gap-1 border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5" /> Propuesta Adjudicada
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Present Bid Trigger button (only if open) */}
            {activeTender.status === "OPEN" && (
              <button
                onClick={() => setShowBidModal(true)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-semibold py-2 rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Presentar Oferta como Proveedor
              </button>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 text-slate-500 text-center space-y-3">
            <Award className="w-10 h-10 text-slate-700" />
            <p className="text-xs">
              Seleccione una licitación activa para auditar las propuestas de contratistas o adjudicar el contrato.
            </p>
          </div>
        )}
      </div>

      {/* Presentar Propuesta Modal */}
      {showBidModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900 text-xs font-semibold">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold font-display flex items-center gap-1.5">
                <Send className="w-4 h-4 text-amber-400" /> Presentar Oferta Comercial
              </h3>
              <button onClick={() => setShowBidModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBid} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Empresa Proveedora</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-xs text-slate-800 outline-none"
                  required
                >
                  <option value="">Seleccionar Proveedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.categories.join(", ")})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Precio Ofertado (USD)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={bidPrice}
                    onChange={(e) => setBidPrice(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Plazo de Entrega (Días)</label>
                  <input
                    type="number"
                    placeholder="15"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Detalles de la Propuesta / Calidad</label>
                <textarea
                  placeholder="Especificaciones de marca, disponibilidad, formas de despacho..."
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs h-20 resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded text-xs cursor-pointer"
                >
                  {isSubmitting ? "Enviando..." : "Enviar Oferta"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded text-xs cursor-pointer"
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
