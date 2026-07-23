/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { OcrDocument, CostCategory, Currency, Project } from "../types.js";
import { Sparkles, FileText, Upload, Check, AlertTriangle, HelpCircle, ArrowRight, CornerDownRight, Info } from "lucide-react";

interface OcrPanelProps {
  categories: CostCategory[];
  projects: Project[];
  tenantId: string;
  onRefresh: () => void;
}

// Comprobantes presets simulating real construction receipt images
const invoicePresets = [
  {
    name: "Factura Yesos y Pintura ($485.000 ARS)",
    fileName: "factura_prestigio_pinturas.png",
    mimeType: "image/png",
    // Base64 simulation representing a invoice
    fileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    visualReceipt: {
      issuer: "Pinturerías Prestigio S.A.",
      cuit: "30-58421094-1",
      docNum: "Factura B-0005-4921",
      date: "2026-07-14",
      items: [
        { desc: "Lata Pintura Latex Interior Alba 20L", qty: 4, price: 95000 },
        { desc: "Pincel Profesional Cerda Blanca N°20", qty: 5, price: 21000 }
      ],
      net: 383150,
      tax: 101850, // 21% IVA
      total: 485000,
      currency: Currency.ARS
    }
  },
  {
    name: "Factura Perfiles y Acero (u$s 12.500 USD)",
    fileName: "invoice_siderar_steel.png",
    mimeType: "image/png",
    fileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    visualReceipt: {
      issuer: "Siderar Aceros del Norte",
      cuit: "30-50239564-2",
      docNum: "Invoice A-0120-0082",
      date: "2026-07-12",
      items: [
        { desc: "Varillas de acero de refuerzo dadas de 12mm", qty: 10, price: 850 },
        { desc: "Viga doble T estructural laminada", qty: 4, price: 1000 }
      ],
      net: 12500,
      tax: 0,
      total: 12500,
      currency: Currency.USD
    }
  },
  {
    name: "Remito de Cañerías Sanitarias ($950.000 ARS)",
    fileName: "factura_gaona_sanitarios.png",
    mimeType: "image/png",
    fileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    visualReceipt: {
      issuer: "Sanitarios Gaona S.R.L.",
      cuit: "30-71109456-9",
      docNum: "Remito R-0001-4432",
      date: "2026-07-19",
      items: [
        { desc: "Tubos de polipropileno fusión IPS 32mm", qty: 50, price: 15000 },
        { desc: "Accesorios codos y derivaciones IPS pack", qty: 1, price: 200000 }
      ],
      net: 750500,
      tax: 199500,
      total: 950000,
      currency: Currency.ARS
    }
  }
];

export default function OcrPanel({
  categories,
  projects,
  tenantId,
  onRefresh
}: OcrPanelProps) {
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedDoc, setExtractedDoc] = useState<OcrDocument | null>(null);
  const [imputationProjectId, setImputationProjectId] = useState("");
  const [isImputing, setIsImputing] = useState(false);
  const [imputeSuccess, setImputeSuccess] = useState(false);

  const activePreset = selectedPresetIdx !== null ? invoicePresets[selectedPresetIdx] : null;

  // Run Gemini multi-modal OCR
  const handleRunOcr = async () => {
    if (!activePreset) return;
    setIsLoading(true);
    setExtractedDoc(null);
    setImputeSuccess(false);

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          fileData: activePreset.fileData,
          fileName: activePreset.fileName,
          mimeType: activePreset.mimeType
        })
      });

      if (!response.ok) {
        throw new Error("La ingesta OCR por IA falló.");
      }

      const result = await response.json();
      setExtractedDoc(result);
      // Auto-select first active project for imputation
      if (projects.length > 0) {
        setImputationProjectId(projects[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Human Validates the AI Sugestion & Imputes to Ledger
  const handleConfirmOcrImputation = async () => {
    if (!extractedDoc) return;
    setIsImputing(true);

    try {
      // Find a cash account for default imputation
      const accountsRes = await fetch(`/api/state?tenantId=${tenantId}`);
      const state = await accountsRes.json();
      const defaultAcc = state.accounts.find((a: any) => a.type === "Banco") || state.accounts[0];

      if (!defaultAcc) {
        throw new Error("No hay cuentas financieras habilitadas.");
      }

      // Create ledger movement PENDING_VALIDATION
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          projectId: imputationProjectId || undefined,
          accountId: defaultAcc.id,
          amount: extractedDoc.amount,
          currency: extractedDoc.currency,
          description: `Ingesta OCR [IA-CONF: ${Math.round(extractedDoc.confidence * 100)}%] - Doc: ${extractedDoc.documentNumber} - Emisor: ${extractedDoc.issuer}`,
          categoryId: extractedDoc.categoryId,
          type: "EGRESO",
          status: "PENDING_VALIDATION", // Human in the loop authorizes
          date: extractedDoc.date,
          performedBy: "Ingesta Inteligente Gemini"
        })
      });

      if (response.ok) {
        setImputeSuccess(true);
        setExtractedDoc(null);
        setSelectedPresetIdx(null);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsImputing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="ocr-panel-container">
      {/* 1. Selector de Presets & Trigger (Left 4/12) */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-100 p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-semibold font-display text-slate-800">Ingesta Inteligente OCR</h3>
          <p className="text-xs text-slate-400 mt-1 leading-normal">
            Cargue comprobantes de compra, remitos o facturas físicas. El modelo multimodal **Gemini 3.5 Flash** procesará la imagen, extraerá los conceptos y sugerirá la imputación presupuestaria.
          </p>
        </div>

        {/* Upload simulated box */}
        <div className="border border-dashed border-slate-200 rounded-lg p-6 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-2">
          <Upload className="w-8 h-8 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Simulador de Captura de Cámara</span>
          <span className="text-[10px] text-slate-400">Haga clic en un comprobante pre-cargado abajo para simular el escaneo:</span>
        </div>

        {/* Presets List */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Muestras de Obra Habilitadas</span>
          {invoicePresets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedPresetIdx(idx);
                setExtractedDoc(null);
                setImputeSuccess(false);
              }}
              className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex justify-between items-center cursor-pointer ${
                selectedPresetIdx === idx 
                  ? "border-amber-500 bg-amber-500/5 font-semibold text-amber-900" 
                  : "border-slate-100 bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="truncate max-w-[180px]">{preset.name}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>

        {activePreset && (
          <button
            onClick={handleRunOcr}
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            {isLoading ? "Analizando con Gemini..." : "Analizar con Gemini AI"}
          </button>
        )}

        {imputeSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Comprobante Registrado</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">
                La factura fue validada y guardada en el Libro Diario con estado *PENDING_VALIDATION*. Un administrador financiero deberá aprobarla de forma definitiva.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Side-By-Side Visualizer (Right 8/12) */}
      <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Document View Representation */}
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 flex flex-col justify-between min-h-[380px]">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-4">Vista Previa del Archivo</span>
            {activePreset ? (
              <div className="bg-white border p-5 rounded shadow-sm text-xs space-y-4 font-mono text-slate-800 animate-fade-in">
                {/* Visual rendering resembling a real ticket */}
                <div className="border-b pb-3 text-center">
                  <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wide">{activePreset.visualReceipt.issuer}</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">CUIT: {activePreset.visualReceipt.cuit}</p>
                </div>

                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>DOC: {activePreset.visualReceipt.docNum}</span>
                  <span>FECHA: {activePreset.visualReceipt.date}</span>
                </div>

                <div className="space-y-1 pt-2 border-t border-dashed">
                  <div className="grid grid-cols-12 text-[10px] text-slate-400 font-bold">
                    <span className="col-span-7">Concepto</span>
                    <span className="col-span-2 text-right">Cant.</span>
                    <span className="col-span-3 text-right">Total</span>
                  </div>
                  {activePreset.visualReceipt.items.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 text-[10px]">
                      <span className="col-span-7 truncate text-slate-700">{it.desc}</span>
                      <span className="col-span-2 text-right text-slate-500">{it.qty}</span>
                      <span className="col-span-3 text-right font-bold">
                        {activePreset.visualReceipt.currency === Currency.USD ? "u$s " : "$ "}
                        {(it.qty * it.price).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed pt-2 text-[10px] text-slate-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Neto Gravado:</span>
                    <span>{activePreset.visualReceipt.currency} {activePreset.visualReceipt.net.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA (21%):</span>
                    <span>{activePreset.visualReceipt.currency} {activePreset.visualReceipt.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 text-xs border-t pt-1">
                    <span>TOTAL:</span>
                    <span>{activePreset.visualReceipt.currency} {activePreset.visualReceipt.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full py-20 flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
                <FileText className="w-12 h-12 text-slate-200" />
                <p className="text-xs">No hay ningún comprobante seleccionado.</p>
              </div>
            )}
          </div>

          {activePreset && (
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-4">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Simulación de carga binaria para análisis de visión directa.</span>
            </div>
          )}
        </div>

        {/* Right: Extracted fields & Imputations */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col justify-between min-h-[380px]">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-4">Campos Extraídos por IA</span>
            {extractedDoc ? (
              <div className="space-y-4 animate-fade-in text-xs">
                <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Gemini OCR Extraído (Confianza: {Math.round(extractedDoc.confidence * 100)}%)</span>
                </div>

                <div className="space-y-3 font-medium text-slate-700">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Razón Social:</span>
                    <span className="text-slate-800 font-bold">{extractedDoc.issuer}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">N° Comprobante:</span>
                    <span className="text-slate-800 font-mono">{extractedDoc.documentNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Fecha Emisión:</span>
                    <span className="text-slate-800 font-mono">{extractedDoc.date}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Monto Total:</span>
                    <span className="text-slate-900 font-mono font-bold">
                      {extractedDoc.currency} {extractedDoc.amount?.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Mapeo de Rubro Sugerido:</span>
                    <span className="text-amber-600 font-semibold uppercase">
                      {categories.find(c => c.id === extractedDoc.categoryId)?.name || "Trabajos Preliminares"}
                    </span>
                  </div>
                </div>

                {/* Project Imputation selector */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Imputar a Proyecto de Obra</label>
                  <select
                    value={imputationProjectId}
                    onChange={(e) => setImputationProjectId(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800 outline-none focus:border-amber-500 bg-slate-50"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="h-full py-20 flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
                <Sparkles className="w-12 h-12 text-slate-200 animate-pulse" />
                <p className="text-xs">Los campos reconocidos se mostrarán aquí.</p>
                <p className="text-[10px] text-slate-300">Presione "Analizar con Gemini AI" para procesar el preset.</p>
              </div>
            )}
          </div>

          {extractedDoc && (
            <button
              onClick={handleConfirmOcrImputation}
              disabled={isImputing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-semibold py-2 rounded text-xs cursor-pointer transition-colors"
            >
              {isImputing ? "Imputando..." : "Validar e Imputar en Tesorería"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
