/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import { BudgetLine, BudgetSubitem, Project } from "../types.js";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";

interface BudgetPanelProps {
  projects: Project[];
  budgetLines: BudgetLine[];
  activeProject: Project | null;
  onRefresh: () => void;
}

interface DraftLine {
  incidence: string;
  notes: string;
  subitems: BudgetSubitem[];
}

type BudgetDivision = "A" | "B" | "C";

const HOUSE_DIVISIONS: Record<BudgetDivision, string[]> = {
  A: [
    "ALBAÑILERIA MDO", "ALBAÑILERIA MATERIALES", "ESTRUCTURA HORMIGON",
    "CARPINTERIA ALUMINIO", "ESTRUCTURA ACERO", "GASTOS MUNICIPALES",
    "PISOS Y REVESTIMIENTOS", "JARDINERIA", "ELECTRICIDAD MATERIALES",
    "PLOMERIA SANITARIOS", "PINTURA MDO", "EXCAVACION", "COCINA MUEBLES",
    "ESTRUCTURA MADERAS"
  ],
  B: [
    "ELECTRICIDAD MDO", "CARPINTERIA PUERTAS", "COCINA MESADAS", "PLOMERIA MDO",
    "OBRA GENERALES", "YESERIA MDO", "AMOBLAMIENTOS", "CALEFACCION", "PISCINA",
    "PINTURA MATERIALES"
  ],
  C: [
    "COCINA ARTEFACTOS", "PLOMERIA MATERIALES", "YESERIA MATERIALES", "HERRAMIENTAS",
    "AIRE ACONDICIONADO", "ZINGUERIA", "PLOMERIA TERMOTANQUES", "ESTRUCTURA GENERALES",
    "HERRERIA", "PLOMERIA BOMBAS", "CERRAJERIA"
  ]
};

const BUILDING_DIVISIONS: Record<BudgetDivision, string[]> = {
  A: [
    "PERSONAL SUELDOS", "ALBAÑILERIA MATERIALES", "ESTRUCTURA HORMIGON",
    "IMPUESTOS GENERALES", "ESTRUCTURA ACERO", "GASTOS MUNICIPALES",
    "CARPINTERIA ALUMINIO", "PLOMERIA MATERIALES", "ASCENSOR", "PINTURA MDO",
    "PISOS Y REVESTIMIENTOS", "PLOMERIA MDO", "ELECTRICIDAD MDO",
    "ELECTRICIDAD MATERIALES", "PLOMERIA SANITARIOS", "HERRERIA"
  ],
  B: [
    "EMPRESA GENERALES", "HERRAMIENTAS", "CARPINTERIA PUERTAS", "COCINA ARTEFACTOS",
    "OBRA GENERALES", "COCINA MUEBLES", "EXCAVACION", "YESERIA MDO",
    "PINTURA MATERIALES", "HONORARIOS ESCRIBANIA", "ESTRUCTURA MADERAS",
    "PLOMERIA BOMBAS", "COMERCIALIZACION", "AMOBLAMIENTOS", "PLOMERIA TERMOTANQUES"
  ],
  C: [
    "HIGIENE Y SEGURIDAD", "RECLAMOS", "ZINGUERIA", "CERRAJERIA", "YESERIA MATERIALES",
    "DEMOLICION", "HONORARIOS CONTADURIA", "AIRE ACONDICIONADO", "JARDINERIA",
    "COCINA MESADAS", "ESTRUCTURA GENERALES", "HONORARIOS ABOGACIA", "CALEFACCION"
  ]
};

const normalizeBudgetName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .trim();

const getBudgetDivision = (line: BudgetLine, constructionType?: string): BudgetDivision => {
  const isHouse = (constructionType || "").toLocaleLowerCase("es").includes("casa");
  const divisions = isHouse ? HOUSE_DIVISIONS : BUILDING_DIVISIONS;
  const normalizedName = normalizeBudgetName(line.name);
  const matchingDivision = (Object.keys(divisions) as BudgetDivision[]).find(division =>
    divisions[division].some(name => normalizeBudgetName(name) === normalizedName)
  );
  if (matchingDivision) return matchingDivision;

  const position = Number.parseInt(line.code, 10);
  if (isHouse) return position <= 14 ? "A" : position <= 24 ? "B" : "C";
  return position <= 16 ? "A" : position <= 31 ? "B" : "C";
};

const emptySubitem = (): BudgetSubitem => ({
  id: `bsi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: "",
  amount: 0,
  notes: ""
});

export default function BudgetPanel({
  budgetLines,
  activeProject,
  onRefresh
}: BudgetPanelProps) {
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedDivisions, setCollapsedDivisions] = useState<Set<BudgetDivision>>(new Set());

  const projectLines = useMemo(
    () => activeProject
      ? budgetLines.filter(line => line.projectId === activeProject.id)
      : [],
    [activeProject, budgetLines]
  );

  useEffect(() => {
    setEditingLineId(null);
    setDraft(null);
    setErrorMsg("");
    setSearchQuery("");
    setCollapsedDivisions(new Set());
  }, [activeProject?.id]);

  const totalBudget = projectLines.reduce((sum, line) => sum + line.amount, 0);
  const totalIncidence = projectLines.reduce((sum, line) => sum + line.incidence, 0);
  const incidenceDifference = Number((100 - totalIncidence).toFixed(2));
  const normalizedSearch = normalizeBudgetName(searchQuery);
  const divisions = useMemo(() => (["A", "B", "C"] as BudgetDivision[]).map(division => {
    const lines = projectLines.filter(line => getBudgetDivision(line, activeProject?.constructionType) === division);
    const visibleLines = normalizedSearch
      ? lines.filter(line => normalizeBudgetName([
          line.code,
          line.name,
          line.notes || "",
          ...(line.subitems || []).flatMap(item => [item.description, item.notes || ""])
        ].join(" ")).includes(normalizedSearch))
      : lines;
    return {
      division,
      lines,
      visibleLines,
      amount: lines.reduce((sum, line) => sum + line.amount, 0),
      incidence: lines.reduce((sum, line) => sum + line.incidence, 0)
    };
  }), [activeProject?.constructionType, normalizedSearch, projectLines]);

  const toggleDivision = (division: BudgetDivision) => {
    setCollapsedDivisions(previous => {
      const next = new Set(previous);
      if (next.has(division)) next.delete(division);
      else next.add(division);
      return next;
    });
  };

  const startEditing = (line: BudgetLine) => {
    setEditingLineId(line.id);
    setDraft({
      incidence: String(line.incidence),
      notes: line.notes || "",
      subitems: (line.subitems || []).map(item => ({ ...item }))
    });
    setExpandedLines(previous => new Set(previous).add(line.id));
    setErrorMsg("");
  };

  const cancelEditing = () => {
    setEditingLineId(null);
    setDraft(null);
    setErrorMsg("");
  };

  const updateSubitem = (
    subitemId: string,
    field: "description" | "amount" | "notes",
    value: string
  ) => {
    setDraft(current => current ? {
      ...current,
      subitems: current.subitems.map(item => item.id === subitemId
        ? { ...item, [field]: field === "amount" ? Number(value) : value }
        : item)
    } : current);
  };

  const saveLine = async (line: BudgetLine) => {
    if (!draft) return;

    const incidence = Number(draft.incidence);
    if (!Number.isFinite(incidence) || incidence < 0 || incidence > 100) {
      setErrorMsg("El porcentaje debe estar entre 0 y 100.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      const response = await fetch(`/api/budget-lines/${line.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidence,
          notes: draft.notes,
          subitems: draft.subitems
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo actualizar la línea.");
      }

      await onRefresh();
      setEditingLineId(null);
      setDraft(null);
    } catch (error: any) {
      setErrorMsg(error.message || "No se pudo actualizar la línea.");
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (lineId: string) => {
    setExpandedLines(previous => {
      const next = new Set(previous);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  return (
    <div className="space-y-6" id="budget-panel-container">
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold font-display text-slate-800">
              Presupuesto Operativo: {activeProject?.name || "Sin Proyecto Seleccionado"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Edite la incidencia de cada rubro y detalle sus componentes mediante subítems.
            </p>
          </div>
          {activeProject && (
            <div className="text-right">
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
          <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Rubros</span>
                <p className="font-mono text-lg font-bold text-slate-800">{projectLines.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Total distribuido</span>
                <p className="font-mono text-lg font-bold text-slate-800">
                  {activeProject.baseCurrency} {totalBudget.toLocaleString()}
                </p>
              </div>
              <div className={`rounded-lg border p-3 ${
                Math.abs(incidenceDifference) < 0.01
                  ? "bg-emerald-50 border-emerald-100"
                  : "bg-amber-50 border-amber-200"
              }`}>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Incidencia acumulada</span>
                <p className="font-mono text-lg font-bold text-slate-800">{totalIncidence.toFixed(2)}%</p>
                {Math.abs(incidenceDifference) >= 0.01 && (
                  <p className="text-[10px] text-amber-700">
                    {incidenceDifference > 0 ? `Falta asignar ${incidenceDifference}%` : `Excede por ${Math.abs(incidenceDifference)}%`}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                <span>Distribución del gasto</span>
                <span>{totalIncidence.toFixed(2)}%</span>
              </div>
              <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100">
                {projectLines.map((line, index) => {
                  const colors = ["bg-amber-600", "bg-amber-500", "bg-slate-700", "bg-slate-500"];
                  return (
                    <div
                      key={line.id}
                      style={{ width: `${Math.min(line.incidence, 100)}%` }}
                      className={`${colors[index % colors.length]} h-full transition-all`}
                      title={`${line.name}: ${line.incidence}%`}
                    />
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Buscar por código, rubro, nota o subítem..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <span className="text-xs font-medium text-slate-500">
                  {divisions.reduce((sum, group) => sum + group.visibleLines.length, 0)} rubros encontrados
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="py-2 w-8" />
                    <th className="py-2">Código</th>
                    <th className="py-2">Categoría / Rubro</th>
                    <th className="py-2 text-right">Incidencia</th>
                    <th className="py-2 text-right">Monto estimado</th>
                    <th className="py-2 text-right">Subítems</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {divisions.filter(group => !normalizedSearch || group.visibleLines.length > 0).map(group => {
                    const isCollapsed = collapsedDivisions.has(group.division);
                    return (
                    <Fragment key={`division-${group.division}`}>
                      <tr className="border-y border-slate-200 bg-slate-100/90">
                        <td colSpan={3} className="px-2 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleDivision(group.division)}
                            className="flex w-full items-center gap-2 text-left"
                            aria-expanded={!isCollapsed}
                          >
                            {isCollapsed
                              ? <ChevronRight className="h-4 w-4 text-slate-500" />
                              : <ChevronDown className="h-4 w-4 text-slate-500" />}
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-xs font-bold text-white">
                              {group.division}
                            </span>
                            <span className="font-bold text-slate-800">Categoría {group.division}</span>
                            <span className="text-xs text-slate-500">
                              {normalizedSearch ? `${group.visibleLines.length} de ${group.lines.length}` : group.lines.length} rubros
                            </span>
                          </button>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-700">
                          {group.incidence.toFixed(2)}%
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900">
                          {activeProject.baseCurrency} {group.amount.toLocaleString()}
                        </td>
                        <td colSpan={2} className="px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Subtotal categoría
                        </td>
                      </tr>
                      {!isCollapsed && group.visibleLines.map(line => {
                    const isEditing = editingLineId === line.id && draft;
                    const isExpanded = expandedLines.has(line.id);
                    const visibleSubitems = isEditing ? draft.subitems : (line.subitems || []);
                    const subitemsTotal = visibleSubitems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                    const remaining = line.amount - subitemsTotal;

                    return (
                      <Fragment key={line.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3">
                            <button
                              onClick={() => toggleExpanded(line.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Mostrar subítems"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="py-3 font-mono text-xs">{line.code}</td>
                          <td className="py-3">
                            <p className="font-semibold text-slate-800">{line.name}</p>
                            {!isEditing && line.notes && (
                              <p className="text-[10px] text-slate-400 max-w-md">{line.notes}</p>
                            )}
                          </td>
                          <td className="py-3 text-right font-mono font-medium">
                            {isEditing ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={draft.incidence}
                                  onChange={event => setDraft({ ...draft, incidence: event.target.value })}
                                  className="w-24 rounded border border-slate-200 px-2 py-1.5 text-right outline-none focus:border-amber-500"
                                />
                                <span>%</span>
                              </div>
                            ) : `${line.incidence.toFixed(2)}%`}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-slate-900">
                            {activeProject.baseCurrency} {line.amount.toLocaleString()}
                          </td>
                          <td className="py-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                              {visibleSubitems.length}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {isEditing ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => saveLine(line)}
                                  disabled={saving}
                                  className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                                  title="Guardar"
                                >
                                  {saving ? <Save className="w-4 h-4 animate-pulse" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditing(line)}
                                className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Editar
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${line.id}-detail`} className="bg-slate-50/70">
                            <td />
                            <td colSpan={6} className="px-3 py-4">
                              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                      Subítems de {line.name}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Desglosado: {activeProject.baseCurrency} {subitemsTotal.toLocaleString()} ·
                                      Saldo: {activeProject.baseCurrency} {remaining.toLocaleString()}
                                    </p>
                                  </div>
                                  {isEditing && (
                                    <button
                                      onClick={() => setDraft({
                                        ...draft,
                                        subitems: [...draft.subitems, emptySubitem()]
                                      })}
                                      className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Agregar subítem
                                    </button>
                                  )}
                                </div>

                                {visibleSubitems.length === 0 ? (
                                  <div className="rounded border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">
                                    Esta línea todavía no tiene subítems.
                                    {!isEditing && " Presione Editar para agregarlos."}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {visibleSubitems.map(item => (
                                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_160px_1fr_36px] gap-2 items-center">
                                        {isEditing ? (
                                          <>
                                            <input
                                              value={item.description}
                                              onChange={event => updateSubitem(item.id, "description", event.target.value)}
                                              placeholder="Descripción del subítem"
                                              className="rounded border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-amber-500"
                                            />
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={item.amount}
                                              onChange={event => updateSubitem(item.id, "amount", event.target.value)}
                                              className="rounded border border-slate-200 px-2.5 py-2 text-right font-mono text-xs outline-none focus:border-amber-500"
                                            />
                                            <input
                                              value={item.notes || ""}
                                              onChange={event => updateSubitem(item.id, "notes", event.target.value)}
                                              placeholder="Notas opcionales"
                                              className="rounded border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-amber-500"
                                            />
                                            <button
                                              onClick={() => setDraft({
                                                ...draft,
                                                subitems: draft.subitems.filter(subitem => subitem.id !== item.id)
                                              })}
                                              className="p-2 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                              title="Eliminar subítem"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-xs font-semibold text-slate-700">{item.description}</span>
                                            <span className="text-right font-mono text-xs">
                                              {activeProject.baseCurrency} {item.amount.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-slate-400">{item.notes || "—"}</span>
                                            <span />
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {isEditing && (
                                  <textarea
                                    value={draft.notes}
                                    onChange={event => setDraft({ ...draft, notes: event.target.value })}
                                    placeholder="Notas generales del rubro"
                                    rows={2}
                                    className="w-full rounded border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-amber-500"
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                      })}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
