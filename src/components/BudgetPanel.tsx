/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { BudgetLine, Project } from "../types.js";
import { Sparkles, ArrowRight, Info, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";

interface BudgetPanelProps {
  projects: Project[];
  budgetLines: BudgetLine[];
  activeProject: Project | null;
  onRefresh: () => void;
}

export default function BudgetPanel({
  projects,
  budgetLines,
  activeProject,
  onRefresh
}: BudgetPanelProps) {
  const [palermoWeight, setPalermoWeight] = useState(60);
  const [maderoWeight, setMaderoWeight] = useState(40);
  const [targetSurface, setTargetSurface] = useState(activeProject?.surfaceM2 || 5000);
  const [targetCostM2, setTargetCostM2] = useState(activeProject?.estimatedCostPerM2 || 1650);
  
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter budget lines for active project
  const projectLines = activeProject 
    ? budgetLines.filter(bl => bl.projectId === activeProject.id)
    : [];

  const totalBudget = projectLines.reduce((sum, line) => sum + line.amount, 0);

  // Trigger Gemini AI historic projector
  const handleAIProject = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    setErrorMsg("");
    setAiSuggestions(null);

    try {
      const response = await fetch("/api/budget-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          comProjects: {
            "proj-palermo-historico": palermoWeight / 100,
            "proj-madero-historico": maderoWeight / 100
          },
          surfaceM2: Number(targetSurface),
          estimatedCostPerM2: Number(targetCostM2)
        })
      });

      if (!response.ok) {
        throw new Error("Error en la proyección de costos históricos.");
      }

      const suggestions = await response.json();
      setAiSuggestions(suggestions);
      onRefresh(); // Pull refreshed data
    } catch (err: any) {
      setErrorMsg(err.message || "Falla al conectar con el asistente de IA.");
    } finally {
      setIsLoading(false);
    }
  };

  // Static closed comparable list (Section 11.2 closed projects feed the database)
  const closedProjects = projects.filter(p => p.status === "CLOSED");

  return (
    <div className="space-y-6" id="budget-panel-container">
      {/* Active Project Budget Info */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold font-display text-slate-800">
              Presupuesto Operativo: {activeProject?.name || "Sin Proyecto Seleccionado"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Desglose detallado del presupuesto estructurado por rubros de imputación.
            </p>
          </div>
          {activeProject && (
            <div className="text-right sm:text-right">
              <span className="text-xs text-slate-400 block font-medium">Costo Total Estimado</span>
              <span className="font-mono text-2xl font-bold text-slate-900">
                {activeProject.baseCurrency} {activeProject.estimatedTotalCost.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                {activeProject.surfaceM2} m² @ {activeProject.estimatedCostPerM2.toLocaleString()} / m²
              </span>
            </div>
          )}
        </div>

        {!activeProject ? (
          <div className="py-12 text-center text-slate-400 border border-dashed rounded-lg">
            Debe seleccionar un proyecto activo para visualizar su presupuesto operativo.
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Visual Budget Bar Split */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                <span>Distribución del Gasto (Incidencia)</span>
                <span>Total Operativo: 100%</span>
              </div>
              <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100">
                {projectLines.map((line, idx) => {
                  const colors = ["bg-amber-600", "bg-amber-500", "bg-slate-700", "bg-slate-500"];
                  const color = colors[idx % colors.length];
                  return (
                    <div 
                      key={line.id} 
                      style={{ width: `${line.incidence}%` }} 
                      className={`${color} h-full transition-all`}
                      title={`${line.name}: ${line.incidence}%`}
                    />
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {projectLines.map((line, idx) => {
                  const colors = ["bg-amber-600", "bg-amber-500", "bg-slate-700", "bg-slate-500"];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={line.id} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-[10px] font-semibold text-slate-600 truncate">
                        ({line.incidence}%) {line.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Budget Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="py-2">Código</th>
                    <th className="py-2">Categoría / Rubro de Obra</th>
                    <th className="py-2 text-right">Incidencia Actual</th>
                    <th className="py-2 text-right">Monto Estimado</th>
                    <th className="py-2 text-right">Proyección Ponderada (IA)</th>
                    <th className="py-2 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {projectLines.map(line => {
                    const diffPercent = line.suggestedIncidence 
                      ? Number((line.incidence - line.suggestedIncidence).toFixed(2))
                      : null;

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 font-mono text-xs">{line.code}</td>
                        <td className="py-3">
                          <p className="font-semibold text-slate-800">{line.name}</p>
                          {line.notes && <p className="text-[10px] text-slate-400 max-w-md">{line.notes}</p>}
                        </td>
                        <td className="py-3 text-right font-mono font-medium">{line.incidence}%</td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900">
                          {activeProject.baseCurrency} {line.amount.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono text-amber-700 font-medium">
                          {line.suggestedIncidence ? (
                            <>
                              {line.suggestedIncidence}% 
                              <span className="block text-[10px] text-slate-400">
                                ({activeProject.baseCurrency} {line.suggestedAmount?.toLocaleString()})
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-300 italic text-xs">Sin Proyección</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono text-xs">
                          {diffPercent !== null ? (
                            <span className={`font-bold px-1.5 py-0.5 rounded ${
                              diffPercent === 0 
                                ? "bg-slate-100 text-slate-600" 
                                : diffPercent > 0 
                                ? "bg-rose-50 text-rose-700" 
                                : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {diffPercent > 0 ? "+" : ""}{diffPercent}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Historical AI Projector Box */}
      {activeProject && (
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold font-display">Proyectador de Costos Históricos</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Consolida los costos reales de proyectos cerrados y cerrados con total auditoría. Defina factores de ponderación basados en recencia, ubicación y calidad para generar un presupuesto sugerido de referencia.
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3 bg-slate-800/60 rounded border border-slate-800 text-xs">
                <span className="font-semibold block text-slate-300 mb-1">Métricas de Comparabilidad:</span>
                • Superficie Objetivo: <strong>{targetSurface} m²</strong><br />
                • Costo m² Objetivo: <strong>USD {targetCostM2}</strong><br />
                • Costo Total: <strong>USD {(Number(targetSurface) * Number(targetCostM2)).toLocaleString()}</strong>
              </div>

              {/* Sliders for weighting closed database projects */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Pond. Palermo Zen (Sencillo)</span>
                  <span className="font-mono text-amber-400 font-bold">{palermoWeight}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={palermoWeight}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPalermoWeight(val);
                    setMaderoWeight(100 - val);
                  }}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Pond. Madero Office (Premium)</span>
                  <span className="font-mono text-amber-400 font-bold">{maderoWeight}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={maderoWeight}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaderoWeight(val);
                    setPalermoWeight(100 - val);
                  }}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            <button
              onClick={handleAIProject}
              disabled={isLoading}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 font-semibold py-2.5 rounded text-sm transition-colors cursor-pointer"
            >
              {isLoading ? (
                <span>Analizando Históricos...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Proyectar con Gemini AI
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-2 bg-slate-800/40 rounded-xl border border-slate-800 p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-semibold font-display text-slate-200 mb-4 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" /> Resultados del Análisis Predictivo
              </h4>

              {errorMsg && (
                <div className="p-3 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded flex gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {aiSuggestions ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded text-xs flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Gemini AI Proyectador:</strong> Los porcentajes y presupuestos sugeridos han sido calculados e inyectados en la columna de proyección del presupuesto de obra.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {aiSuggestions?.map((sug, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 border border-slate-700/60 rounded text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-slate-400 font-bold text-[10px]">{sug.code}</span>
                          <span className="font-mono text-amber-400 font-bold">{sug.suggestedIncidence}%</span>
                        </div>
                        <h5 className="font-semibold text-slate-200 truncate">{sug.name}</h5>
                        <p className="text-[10px] text-slate-400 leading-normal line-clamp-3">
                          {sug.justification}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-12 text-slate-500 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-slate-600 animate-pulse" />
                  <p className="text-xs">
                    Defina los pesos de ponderación y presione el botón de proyección para consultar al Asistente de IA.
                  </p>
                  <p className="text-[10px] text-slate-600">
                    Gemini evaluará las incidencias de los rubros históricos y estimará los montos necesarios para una superficie de {targetSurface} m².
                  </p>
                </div>
              )}
            </div>

            {aiSuggestions && (
              <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
                <span>* Las sugerencias de IA nunca pisan los montos oficiales de forma directa. Requiere aprobación humana.</span>
                <span className="text-amber-500 flex items-center gap-0.5 cursor-pointer hover:underline" onClick={() => setAiSuggestions(null)}>
                  Limpiar Análisis
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
