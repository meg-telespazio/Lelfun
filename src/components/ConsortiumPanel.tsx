/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { EarlyCondominium, MaintenanceRequest } from "../types.js";
import { Plus, X, Building2, Key, ShieldAlert, Check, AlertTriangle, MessageSquare, Phone, User } from "lucide-react";

interface ConsortiumPanelProps {
  condominiums: EarlyCondominium[];
  maintenanceRequests: MaintenanceRequest[];
  tenantId: string;
  projectId: string;
  onRefresh: () => void;
}

export default function ConsortiumPanel({
  condominiums,
  maintenanceRequests,
  tenantId,
  projectId,
  onRefresh
}: ConsortiumPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [description, setDescription] = useState("");
  const [warrantyCoverage, setWarrantyCoverage] = useState<"COVERED" | "NOT_COVERED" | "UNDER_INVESTIGATION">("UNDER_INVESTIGATION");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const condo = condominiums[0]; // Take active condo for demonstration

  const handleCreateRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId || !reporterName || !description) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consortium/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          projectId, // Links to active project
          unitId: selectedUnitId,
          reporterName,
          reporterContact,
          description,
          warrantyCoverage
        })
      });

      if (response.ok) {
        setShowAddModal(false);
        setSelectedUnitId("");
        setReporterName("");
        setReporterContact("");
        setDescription("");
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED", notes?: string) => {
    try {
      const response = await fetch(`/api/consortium/complaints/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes })
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="consortium-panel-container">
      {/* 1. Condo Handover & Occupancy States (Left 1/3) */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-600" />
          <h3 className="text-base font-semibold font-display text-slate-800">Consorcios Tempranos</h3>
        </div>

        {condo ? (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 border p-3.5 rounded-lg space-y-2">
              <span className="font-bold text-slate-800 block text-sm">{condo.name}</span>
              <p className="text-slate-500">Fecha de Entrega: <strong className="font-mono text-slate-700">{condo.handoverDate}</strong></p>
              <p className="text-slate-500">Período de Administración: <strong className="font-semibold text-slate-700">{condo.maintenanceMonths} Meses (Garantía)</strong></p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Unidades Entregadas</span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {condo.units.map((unit, idx) => (
                  <div key={idx} className="p-2.5 bg-white border border-slate-100 rounded-md flex justify-between items-center text-xs shadow-2xs">
                    <div>
                      <p className="font-bold text-slate-700">Unidad ID: {unit.unitId.replace("unit-p", "Piso ")}</p>
                      <p className="text-[10px] text-slate-400">Propietario: {unit.ownerName}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                      unit.occupied 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                        : "bg-slate-50 text-slate-400"
                    }`}>
                      {unit.occupied ? "Habitado" : "Desocupado"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-12 text-center">No hay consorcios provisionales habilitados para este tenant.</p>
        )}
      </div>

      {/* 2. Warranty Claims & Maintenance Requests (Right 2/3) */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold font-display text-slate-800">Reclamos y Garantías Estructurales</h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar Reclamo Técnico
            </button>
          </div>

          <div className="space-y-3">
            {maintenanceRequests.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center">No se han registrado reclamos técnicos.</p>
            ) : (
              maintenanceRequests.map(req => (
                <div key={req.id} className="p-4 border rounded-xl space-y-3 shadow-2xs bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          Unidad {req.unitId.replace("unit-p", "")}
                        </span>
                        <span className="text-[10px] text-slate-400">Reportado: {req.reportedDate}</span>
                      </div>
                      <h4 className="font-semibold text-slate-700 text-xs mt-1.5 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {req.reporterName} ({req.reporterContact})
                      </h4>
                    </div>

                    <div className="flex gap-1.5 items-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        req.warrantyCoverage === "COVERED" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : req.warrantyCoverage === "NOT_COVERED" 
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                      }`}>
                        {req.warrantyCoverage === "COVERED" ? "Garantía Cubierta" : req.warrantyCoverage === "NOT_COVERED" ? "Fuera de Cobertura" : "En Revisión"}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === "RESOLVED" 
                          ? "bg-emerald-100 text-emerald-800" 
                          : req.status === "IN_PROGRESS" 
                          ? "bg-blue-100 text-blue-800" 
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-normal bg-slate-50/50 p-2.5 rounded border border-slate-100/50">
                    {req.description}
                  </p>

                  {req.notes && (
                    <p className="text-[10px] text-slate-400 italic flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" /> Notas de resolución: {req.notes}
                    </p>
                  )}

                  {/* Actions for operators */}
                  {req.status !== "RESOLVED" && (
                    <div className="flex justify-end gap-1.5 pt-1">
                      {req.status === "PENDING" && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, "IN_PROGRESS")}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-semibold cursor-pointer"
                        >
                          Asignar Contratista
                        </button>
                      )}
                      {req.status === "IN_PROGRESS" && (
                        <button
                          onClick={() => {
                            const note = prompt("Ingrese detalles sobre los trabajos correctivos:");
                            if (note !== null) handleUpdateStatus(req.id, "RESOLVED", note);
                          }}
                          className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-semibold cursor-pointer"
                        >
                          Marcar Solucionado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Registrar Reclamo Técnico Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold font-display flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> Registrar Reclamo Técnico
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-5 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Unidad Funcional Reclamante</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800 outline-none"
                  required
                >
                  <option value="">Seleccionar unidad...</option>
                  {condo?.units?.map(u => (
                    <option key={u.unitId} value={u.unitId}>Unidad {u.unitId.replace("unit-p", "")} ({u.ownerName})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Nombre Reclamante</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Contacto / Teléfono</label>
                  <input
                    type="text"
                    placeholder="+54 9 11..."
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Descripción de Falla Humedad/Rotura</label>
                <textarea
                  placeholder="Detalle de filtración, grietas, mal funcionamiento eléctrico..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs h-24 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Diagnóstico Inicial de Garantía</label>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setWarrantyCoverage("COVERED")}
                    className={`py-1.5 rounded border transition-colors cursor-pointer text-center ${
                      warrantyCoverage === "COVERED" ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "border-slate-200"
                    }`}
                  >
                    Cubierto
                  </button>
                  <button
                    type="button"
                    onClick={() => setWarrantyCoverage("UNDER_INVESTIGATION")}
                    className={`py-1.5 rounded border transition-colors cursor-pointer text-center ${
                      warrantyCoverage === "UNDER_INVESTIGATION" ? "bg-amber-50 border-amber-400 text-amber-800" : "border-slate-200"
                    }`}
                  >
                    En Revisión
                  </button>
                  <button
                    type="button"
                    onClick={() => setWarrantyCoverage("NOT_COVERED")}
                    className={`py-1.5 rounded border transition-colors cursor-pointer text-center ${
                      warrantyCoverage === "NOT_COVERED" ? "bg-rose-50 border-rose-400 text-rose-800" : "border-slate-200"
                    }`}
                  >
                    Excluido
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded text-xs cursor-pointer"
                >
                  {isSubmitting ? "Registrando..." : "Registrar Reclamo"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
