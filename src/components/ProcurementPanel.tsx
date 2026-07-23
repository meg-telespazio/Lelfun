/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { 
  PurchaseRequest, 
  PurchaseItem, 
  PurchaseStatus, 
  Counterparty, 
  CostCategory, 
  Currency 
} from "../types.js";
import { 
  Plus, 
  X, 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  Send, 
  Truck, 
  FileText, 
  DollarSign, 
  Eye, 
  Trash,
  AlertTriangle 
} from "lucide-react";

interface ProcurementPanelProps {
  purchaseRequests: PurchaseRequest[];
  counterparties: Counterparty[];
  categories: CostCategory[];
  tenantId: string;
  projectId: string;
  onRefresh: () => void;
}

export default function ProcurementPanel({
  purchaseRequests,
  counterparties,
  categories,
  tenantId,
  projectId,
  onRefresh
}: ProcurementPanelProps) {
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [showAddPr, setShowAddPr] = useState(false);

  // Supplier management states
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Counterparty | null>(null);
  const [supName, setSupName] = useState("");
  const [supTaxId, setSupTaxId] = useState("");
  const [supContactName, setSupContactName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!supName) return;
    setIsSubmittingSupplier(true);
    try {
      const response = await fetch("/api/counterparties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSupplier?.id || undefined,
          tenantId,
          name: supName,
          type: "Proveedor",
          taxId: supTaxId,
          contactName: supContactName,
          email: supEmail,
          phone: supPhone
        })
      });
      if (response.ok) {
        setEditingSupplier(null);
        setSupName("");
        setSupTaxId("");
        setSupContactName("");
        setSupEmail("");
        setSupPhone("");
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const handleEditSupplierStart = (sup: Counterparty) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupTaxId(sup.taxId || "");
    setSupContactName(sup.contactName || "");
    setSupEmail(sup.email || "");
    setSupPhone(sup.phone || "");
  };

  const handleCancelEditSupplier = () => {
    setEditingSupplier(null);
    setSupName("");
    setSupTaxId("");
    setSupContactName("");
    setSupEmail("");
    setSupPhone("");
  };

  // New PR Form State
  const [title, setTitle] = useState("");
  const [requiredDate, setRequiredDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState(Currency.USD);
  const [items, setItems] = useState<{ description: string; quantity: number; unit: string; estimatedPrice: number }[]>([]);
  
  // Temporary Item state
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemUnit, setItemUnit] = useState("Unidad");
  const [itemPrice, setItemPrice] = useState("");

  const selectedPr = purchaseRequests.find(pr => pr.id === selectedPrId);
  const suppliers = counterparties.filter(c => c.type === "Proveedor");

  // Lifecycle action handler
  const handleFlowAction = async (action: string, payload: any = {}) => {
    if (!selectedPrId) return;
    try {
      const response = await fetch(`/api/purchase-requests/${selectedPrId}/flow`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    if (!itemDesc || !itemQty || !itemPrice) return;
    setItems([
      ...items,
      {
        description: itemDesc,
        quantity: Number(itemQty),
        unit: itemUnit,
        estimatedPrice: Number(itemPrice)
      }
    ]);
    setItemDesc("");
    setItemQty("");
    setItemPrice("");
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSubmitPr = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !title) return;

    try {
      const response = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          projectId,
          title,
          requiredDate,
          categoryId: categoryId || undefined,
          currency,
          items,
          requestedBy: "Jefe de Compras de Obra"
        })
      });

      if (response.ok) {
        setShowAddPr(false);
        setTitle("");
        setItems([]);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="procurement-panel-container">
      {/* List (Left 2/3) */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold font-display text-slate-800">Notas de Pedido y Compras</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSupplierModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer transition-colors border border-slate-200"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" /> Directorio de Proveedores
              </button>
              <button
                onClick={() => setShowAddPr(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva Nota de Pedido
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="py-2">Código</th>
                  <th className="py-2">Detalle Pedido</th>
                  <th className="py-2 text-center">Ítems</th>
                  <th className="py-2 text-right">Monto Estimado</th>
                  <th className="py-2 text-center">Estado Logístico</th>
                  <th className="py-2 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {purchaseRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hay compras registradas para este proyecto.
                    </td>
                  </tr>
                ) : (
                  purchaseRequests.map(pr => (
                    <tr 
                      key={pr.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${selectedPrId === pr.id ? "bg-amber-500/5 font-semibold" : ""}`}
                    >
                      <td className="py-3 font-mono text-xs text-slate-500">{pr.code}</td>
                      <td className="py-3">
                        <p className="text-slate-800 font-medium">{pr.title}</p>
                        <span className="text-[10px] text-slate-400">Requerido: {pr.requiredDate}</span>
                      </td>
                      <td className="py-3 text-center font-mono text-xs font-bold">{pr.items.length}</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900">
                        {pr.currency} {pr.estimatedTotal.toLocaleString()}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          pr.status === PurchaseStatus.PAID
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : pr.status === PurchaseStatus.ORDERED
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : pr.status === PurchaseStatus.RFQ
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : pr.status === PurchaseStatus.PENDING
                            ? "bg-slate-50 text-slate-600 border border-slate-200 animate-pulse"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}>
                          {pr.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setSelectedPrId(pr.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded flex items-center gap-1 ml-auto cursor-pointer font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" /> Gestionar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lifecycle Manager (Right 1/3) */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col justify-between">
        {selectedPr ? (
          <div className="space-y-6 animate-fade-in">
            {/* Title */}
            <div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-amber-400 font-bold">{selectedPr.code}</span>
                <span className="text-[10px] text-slate-400">Por: {selectedPr.requestedBy}</span>
              </div>
              <h4 className="font-bold text-base mt-1 text-slate-100">{selectedPr.title}</h4>
            </div>

            {/* Visual Steps Tracker */}
            <div className="border-l-2 border-slate-700 pl-4 space-y-4 text-xs">
              <div className="flex items-center gap-2 relative">
                <div className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                  [PurchaseStatus.PENDING, PurchaseStatus.APPROVED, PurchaseStatus.RFQ, PurchaseStatus.ORDERED, PurchaseStatus.RECEIVED, PurchaseStatus.INVOICED, PurchaseStatus.PAID].includes(selectedPr.status) 
                    ? "bg-amber-500" : "bg-slate-700"
                }`} />
                <span className="font-semibold">1. Pedido de Obra</span>
                <span className="text-[10px] text-slate-400 ml-auto">Completado</span>
              </div>

              <div className="flex items-center gap-2 relative">
                <div className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                  [PurchaseStatus.APPROVED, PurchaseStatus.RFQ, PurchaseStatus.ORDERED, PurchaseStatus.RECEIVED, PurchaseStatus.INVOICED, PurchaseStatus.PAID].includes(selectedPr.status) 
                    ? "bg-amber-500" : "bg-slate-700"
                }`} />
                <span className="font-semibold">2. Aprobación Administrativa</span>
                {selectedPr.status === PurchaseStatus.PENDING && (
                  <button 
                    onClick={() => handleFlowAction("APPROVE")}
                    className="ml-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] cursor-pointer"
                  >
                    Aprobar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 relative">
                <div className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                  [PurchaseStatus.RFQ, PurchaseStatus.ORDERED, PurchaseStatus.RECEIVED, PurchaseStatus.INVOICED, PurchaseStatus.PAID].includes(selectedPr.status) 
                    ? "bg-amber-500" : "bg-slate-700"
                }`} />
                <span className="font-semibold">3. Licitación / Cotización (RFQ)</span>
                {selectedPr.status === PurchaseStatus.APPROVED && (
                  <button 
                    onClick={() => handleFlowAction("SEND_RFQ")}
                    className="ml-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] cursor-pointer"
                  >
                    Emitir RFQ
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5 relative">
                <div className="flex items-center gap-2">
                  <div className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                    [PurchaseStatus.ORDERED, PurchaseStatus.RECEIVED, PurchaseStatus.INVOICED, PurchaseStatus.PAID].includes(selectedPr.status) 
                      ? "bg-amber-500" : "bg-slate-700"
                  }`} />
                  <span className="font-semibold">4. Órden de Compra Adjudicada</span>
                </div>
                {selectedPr.status === PurchaseStatus.RFQ && (
                  <div className="bg-slate-800 p-2.5 rounded border border-slate-700 space-y-2 mt-1">
                    <label className="block text-[10px] text-slate-300 font-medium">Asignar Proveedor:</label>
                    <select 
                      id="supplier-adjudicate"
                      className="w-full bg-slate-900 border border-slate-700 text-[11px] rounded p-1 text-white outline-none"
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                        const el = document.getElementById("supplier-adjudicate") as HTMLSelectElement;
                        handleFlowAction("PLACE_ORDER", { supplierId: el?.value });
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1 rounded text-[10px] cursor-pointer"
                    >
                      Adjudicar y Emitir Orden
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 relative">
                <div className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                  [PurchaseStatus.RECEIVED, PurchaseStatus.INVOICED, PurchaseStatus.PAID].includes(selectedPr.status) 
                    ? "bg-amber-500" : "bg-slate-700"
                }`} />
                <span className="font-semibold">5. Recepción de Mercadería</span>
                {selectedPr.status === PurchaseStatus.ORDERED && (
                  <button 
                    onClick={() => handleFlowAction("RECEIVE_GOODS")}
                    className="ml-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] cursor-pointer"
                  >
                    Registrar Recepción
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 relative">
                <div className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                  [PurchaseStatus.INVOICED, PurchaseStatus.PAID].includes(selectedPr.status) 
                    ? "bg-amber-500" : "bg-slate-700"
                }`} />
                <span className="font-semibold">6. Comprobante / Factura Proveedor</span>
                {selectedPr.status === PurchaseStatus.RECEIVED && (
                  <button 
                    onClick={() => handleFlowAction("INVOICE_SUPPLIER")}
                    className="ml-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] cursor-pointer"
                  >
                    Validar Factura
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5 relative">
                <div className="flex items-center gap-2">
                  <div className={`absolute -left-[21px] w-2 h-2 rounded-full ${
                    selectedPr.status === PurchaseStatus.PAID ? "bg-emerald-500" : "bg-slate-700"
                  }`} />
                  <span className="font-semibold">7. Liquidación y Pago</span>
                </div>
                {selectedPr.status === PurchaseStatus.INVOICED && (
                  <div className="bg-slate-800 p-2.5 rounded border border-slate-700 text-[10px] text-slate-300 space-y-2 mt-1">
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      El pago debitará automáticamente de las cuentas bancarias de la constructora.
                    </p>
                    <button 
                      onClick={() => handleFlowAction("PAY")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded text-[10px] cursor-pointer"
                    >
                      Abonar y Descontar Fondos
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Material Items List */}
            <div className="pt-4 border-t border-slate-800">
              <h5 className="font-semibold text-xs text-slate-200 mb-2">Artículos del Pedido</h5>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedPr.items?.map((item, idx) => (
                  <div key={item.id || idx} className="p-2 bg-slate-800/80 rounded border border-slate-700/50 text-[11px] space-y-1">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-200">{item.description}</span>
                      <span className="font-mono text-amber-400">{item.quantity} {item.unit}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Estimado: {selectedPr.currency} {item.estimatedPrice}</span>
                      {item.actualPrice && <span className="text-emerald-400">Final: {selectedPr.currency} {item.actualPrice}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 text-slate-500 text-center space-y-3">
            <ShoppingCart className="w-10 h-10 text-slate-700" />
            <p className="text-xs">
              Seleccione una Nota de Pedido de la lista para gestionar su ciclo de vida y compras críticas.
            </p>
          </div>
        )}
      </div>

      {/* Creación de Nota de Pedido Modal */}
      {showAddPr && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-950">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold font-display flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4" /> Registrar Nota de Pedido
              </h3>
              <button onClick={() => setShowAddPr(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPr} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Título de Pedido / Obra</label>
                  <input
                    type="text"
                    placeholder="Ej. Suministro de Hierro de Estructura Principal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Rubro de Obra</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 text-slate-800 outline-none focus:border-amber-500"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categories.filter(c => c.isLeaf).map(c => (
                      <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Entrega Requerida</label>
                  <input
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1 text-xs outline-none"
                    required
                  />
                </div>
              </div>

              {/* Items Compositor Table */}
              <div className="border border-slate-100 rounded-lg p-3 bg-slate-50 space-y-3">
                <span className="text-xs font-semibold text-slate-500 block">Componer Lista de Materiales</span>
                
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Descripción del insumo..."
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    className="col-span-6 border border-slate-200 bg-white rounded p-1.5 text-xs outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Cant."
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className="col-span-2 border border-slate-200 bg-white rounded p-1.5 text-xs outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Unid."
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="col-span-2 border border-slate-200 bg-white rounded p-1.5 text-xs outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Precio"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="col-span-2 border border-slate-200 bg-white rounded p-1.5 text-xs outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-1 rounded text-[11px] cursor-pointer"
                >
                  + Agregar Insumo a la Lista
                </button>

                {items.length > 0 && (
                  <div className="max-h-24 overflow-y-auto divide-y divide-slate-200/50 mt-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex justify-between py-1 text-xs text-slate-600">
                        <span className="truncate max-w-xs">{it.description}</span>
                        <div className="flex gap-2 font-mono">
                          <span>{it.quantity} {it.unit} @ ${it.estimatedPrice}</span>
                          <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-500 hover:text-rose-700">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={items.length === 0}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white font-semibold py-2 rounded text-xs cursor-pointer"
                >
                  Registrar Nota de Pedido
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPr(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Directorio de Proveedores Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <h3 className="font-semibold font-display flex items-center gap-1.5 text-sm">
                <Truck className="w-4 h-4 text-amber-400" /> Directorio de Proveedores de Obra
              </h3>
              <button onClick={() => { setShowSupplierModal(false); handleCancelEditSupplier(); }} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Side: Suppliers List */}
              <div className="space-y-3 flex flex-col">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2 shrink-0">Proveedores Homologados</h4>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 max-h-[45vh]">
                  {suppliers.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No hay proveedores registrados para esta empresa.</p>
                  ) : (
                    suppliers.map(sup => (
                      <div key={sup.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-xs hover:border-amber-500 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-bold text-slate-800 text-[13px]">{sup.name}</h5>
                            <p className="font-mono text-[10px] text-slate-500 mt-0.5">CUIT: {sup.taxId || "No asignado"}</p>
                          </div>
                          <button
                            onClick={() => handleEditSupplierStart(sup)}
                            className="text-amber-600 hover:text-amber-800 font-semibold text-[11px] cursor-pointer"
                          >
                            Editar
                          </button>
                        </div>
                        
                        {(sup.contactName || sup.email || sup.phone) && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 text-[10px] text-slate-600 space-y-0.5">
                            {sup.contactName && <p>• Contacto: <strong>{sup.contactName}</strong></p>}
                            {sup.email && <p>• Email: <span className="font-mono">{sup.email}</span></p>}
                            {sup.phone && <p>• Tel: <span className="font-mono">{sup.phone}</span></p>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Side: Form to Add/Edit Supplier */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col">
                <form onSubmit={handleSaveSupplier} className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                    {editingSupplier ? "Modificar Proveedor" : "Dar de Alta Proveedor"}
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-1">Razón Social / Nombre Comercial *</label>
                      <input
                        type="text"
                        placeholder="Ej. Corralón San Martín S.A."
                        value={supName}
                        onChange={(e) => setSupName(e.target.value)}
                        className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-1">Identificación Fiscal / CUIT</label>
                      <input
                        type="text"
                        placeholder="Ej. 30-54910321-2"
                        value={supTaxId}
                        onChange={(e) => setSupTaxId(e.target.value)}
                        className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none font-mono"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200/50">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-2">Información de Contacto</span>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Nombre del Contacto Principal</label>
                          <input
                            type="text"
                            placeholder="Ej. Ing. Carlos Pérez"
                            value={supContactName}
                            onChange={(e) => setSupContactName(e.target.value)}
                            className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Email</label>
                            <input
                              type="email"
                              placeholder="carlos@corralon.com"
                              value={supEmail}
                              onChange={(e) => setSupEmail(e.target.value)}
                              className="w-full border border-slate-200 rounded p-2 text-xs bg-white outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Teléfono / Celular</label>
                            <input
                              type="text"
                              placeholder="+54 9 11..."
                              value={supPhone}
                              onChange={(e) => setSupPhone(e.target.value)}
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
                      disabled={isSubmittingSupplier}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold py-2 rounded text-xs cursor-pointer text-center"
                    >
                      {isSubmittingSupplier ? "Guardando..." : editingSupplier ? "Guardar Cambios" : "Dar de Alta"}
                    </button>
                    {editingSupplier && (
                      <button
                        type="button"
                        onClick={handleCancelEditSupplier}
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
