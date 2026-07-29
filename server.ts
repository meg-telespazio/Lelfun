/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  Currency,
  MovementStatus,
  MovementType,
  ProjectStatus,
  UnitType,
  UnitStatus,
  InstallmentStatus,
  IndexType,
  PurchaseStatus,
  Tenant,
  Project,
  FinancialAccount,
  Counterparty,
  CostCategory,
  FinancialMovement,
  CashCount,
  BudgetLine,
  PurchaseRequest,
  SellableUnit,
  SalesOpportunity,
  SalesContract,
  Installment,
  OcrDocument,
  MaintenanceRequest,
  MarketplaceSupplier,
  PublicTender,
  EarlyCondominium
} from "./src/types.js";

dotenv.config();

const app = express();
const PORT = 3000;
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

// Setup JSON body parsing with high limit for base64 file uploads
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", runtime: process.env.VERCEL ? "vercel" : "node", timestamp: new Date().toISOString() });
});

// Enforce environment boundaries at the API edge. The UI is not trusted to
// decide whether somebody is a tenant user, supplier, or platform admin.
app.use("/api", async (req, res, next) => {
  const route = req.path;
  const publicRequest =
    route === "/auth/access-context" ||
    route === "/request-demo" ||
    (req.method === "POST" && route === "/tenants") ||
    (req.method === "POST" && route === "/marketplace-suppliers") ||
    (req.method === "POST" && route === "/marketplace/public/register-buyer") ||
    (req.method === "GET" && /^\/tenants\/[^/]+\/logo$/.test(route)) ||
    (req.method === "GET" && route.startsWith("/marketplace/v2/media")) ||
    (req.method === "GET" && route.startsWith("/marketplace/public/"));
  if (publicRequest) return next();
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado en el servidor." });

  const user = await getRequestAuthUser(req);
  if (!user) return res.status(401).json({ error: "Sesión requerida." });

  const [{ data: admin }, { data: supplier }, { data: tenant }] = await Promise.all([
    supabaseAdmin.from("platform_admins").select("user_id,active").eq("user_id", user.id).eq("active", true).maybeSingle(),
    supabaseAdmin.from("supplier_members").select("user_id,active").eq("user_id", user.id).eq("active", true).maybeSingle(),
    supabaseAdmin.from("tenant_members").select("tenant_id,role,active").eq("user_id", user.id).eq("active", true).maybeSingle()
  ]);

  if (admin) {
    if (!route.startsWith("/superadmin/")) return res.status(403).json({ error: "El superadmin no puede acceder a datos operativos." });
    return next();
  }
  if (supplier) {
    if (!route.startsWith("/marketplace/")) return res.status(403).json({ error: "El proveedor solo puede acceder al Marketplace." });
    return next();
  }
  if (!tenant) return res.status(403).json({ error: "El usuario no tiene un entorno habilitado." });
  if (route.startsWith("/superadmin/")) return res.status(403).json({ error: "Acceso exclusivo de superadmin." });
  const { data: tenantLicense } = await supabaseAdmin.from("tenant_licenses").select("subscription_plans(code)").eq("tenant_id", tenant.tenant_id).maybeSingle();
  const licensePlan: any = Array.isArray(tenantLicense?.subscription_plans) ? tenantLicense?.subscription_plans[0] : tenantLicense?.subscription_plans;
  if (licensePlan?.code === "MARKETPLACE_BUYER" && !route.startsWith("/marketplace/")) return res.status(403).json({ error: "La cuenta Comprador Marketplace no incluye módulos ERP." });

  // Downstream handlers can use the server-derived tenant instead of trusting
  // tenant identifiers received from the browser.
  (req as Request & { authTenantId?: string }).authTenantId = tenant.tenant_id;
  next();
});

// ---------------------------------------------------------
// Google Gen AI Client Setup
// ---------------------------------------------------------
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  console.log("Gemini AI Client initialized successfully.");
} else {
  console.warn("GEMINI_API_KEY not found. OCR and AI features will run in high-fidelity simulation mode.");
}

// ---------------------------------------------------------
// Seed Data & In-Memory Database (Isolated per Tenant)
// ---------------------------------------------------------

// File-based persistence for dynamic tenants
const CUSTOM_TENANTS_FILE = path.join(process.cwd(), "custom-tenants.json");

function loadPersistedTenants(): Tenant[] {
  try {
    if (fs.existsSync(CUSTOM_TENANTS_FILE)) {
      const data = fs.readFileSync(CUSTOM_TENANTS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error loading persisted tenants:", e);
  }
  return [];
}

function persistTenant(tenant: Tenant) {
  try {
    const list = loadPersistedTenants();
    const index = list.findIndex(t => t.id === tenant.id);
    if (index >= 0) {
      list[index] = tenant;
    } else {
      list.push(tenant);
    }
    fs.writeFileSync(CUSTOM_TENANTS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving persisted tenant:", e);
  }
}

const tenants: Tenant[] = [
  {
    id: "tenant-lelfun",
    name: "Lelfun Desarrollos S.A.",
    defaultCurrency: Currency.USD,
    logoUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=100&auto=format&fit=crop",
    enabledCurrencies: [Currency.ARS, Currency.USD],
    nombreFantasia: "Lelfun Desarrollos",
    razonSocial: "Lelfun Desarrollos S.A.",
    webPage: "www.lelfun.com",
    phone: "+54 11 4802-9988",
    legalAddress: "Av. del Libertador 2424, CABA",
    commercialAddress: "Av. Alvear 1850, Recoleta, CABA",
    companyType: "Constructora & Desarrolladora",
    cuit: "30-71409581-2",
    iibbType: "Convenio Multilateral",
    activeUsers: [
      { name: "Mariano Telespazio", email: "mariano.telespazio@gmail.com", role: "Administrador General", active: true },
      { name: "Sofía Ingeniera", email: "sofia.obra@lelfun.com", role: "Director de Obra", active: true },
      { name: "Esteban Tesorero", email: "esteban@lelfun.com", role: "Tesorero", active: true }
    ],
    deposits: [
      { id: "dep-1", name: "Depósito Central Recoleta", address: "Heras 2240, CABA" },
      { id: "dep-2", name: "Obrador Alvear (In-situ)", address: "Av. Alvear 1850, Recoleta" }
    ],
    subscription: {
      planName: "Lelfun SaaS Enterprise",
      activeUntil: "2027-12-31",
      maxProjects: 10,
      costPerMonth: 450,
      status: "Activo"
    }
  },
  {
    id: "tenant-norte",
    name: "Norte Obras S.A. (Córdoba)",
    defaultCurrency: Currency.ARS,
    logoUrl: "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?q=80&w=100&auto=format&fit=crop",
    enabledCurrencies: [Currency.ARS, Currency.USD],
    nombreFantasia: "Norte Obras Civiles",
    razonSocial: "Norte Obras S.A.",
    webPage: "www.norteobras.com",
    phone: "+54 351 4455-888",
    legalAddress: "Av. Colón 1200, Córdoba",
    commercialAddress: "Av. Cruz Roja s/n, Córdoba",
    companyType: "Contratista General",
    cuit: "30-58421094-1",
    iibbType: "Local / Régimen General",
    activeUsers: [
      { name: "Juan Norte", email: "juan@norte.com", role: "Administrador General", active: true },
      { name: "Pedro Capataz", email: "pedro@norte.com", role: "Capataz de Campo", active: true }
    ],
    deposits: [
      { id: "dep-3", name: "Obrador Altos de Manantiales", address: "Av. Cruz Roja s/n, Córdoba" }
    ],
    subscription: {
      planName: "Lelfun SaaS Pro",
      activeUntil: "2026-12-31",
      maxProjects: 5,
      costPerMonth: 250,
      status: "Activo"
    }
  },
  {
    id: "tenant-alianza",
    name: "Alianza Construtora Ltda.",
    defaultCurrency: Currency.BRL,
    logoUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=100&auto=format&fit=crop",
    enabledCurrencies: [Currency.BRL, Currency.USD],
    nombreFantasia: "Alianza Construtora",
    razonSocial: "Alianza Construtora Ltda.",
    webPage: "www.alianza.com.br",
    phone: "+55 11 3088-7711",
    legalAddress: "Alameda Lorena 1200, São Paulo",
    commercialAddress: "Alameda Lorena 1200, São Paulo",
    companyType: "Incorporadora",
    cuit: "12-34567890-9",
    iibbType: "Simples Nacional / ISS",
    activeUsers: [
      { name: "Thiago Alianza", email: "thiago@alianza.com.br", role: "Administrador General", active: true }
    ],
    deposits: [
      { id: "dep-4", name: "Depósito Bela Vista", address: "Alameda Lorena 1200, São Paulo" }
    ],
    subscription: {
      planName: "Lelfun SaaS Starter",
      activeUntil: "2026-09-30",
      maxProjects: 2,
      costPerMonth: 120,
      status: "Activo"
    }
  }
];

// Load persisted tenants on startup
try {
  const persisted = loadPersistedTenants();
  persisted.forEach(t => {
    if (!tenants.find(existing => existing.id === t.id)) {
      tenants.push(t);
    }
  });
} catch (e) {
  console.error("Error loading persisted tenants on startup:", e);
}

// Global Public Exchange Rates snapshot
let exchangeRates = {
  ARS_USD_MEP: 1220.0,
  ARS_USD_OFICIAL: 940.0,
  BRL_USD: 5.60,
  CAC_INDEX_BASE: 2540.2,
  CAC_INDEX_CURRENT: 2845.6,
  INFLATION_INDEX_CURRENT: 310.4
};

interface DailyOfficialExchangeRate {
  date: string;
  currency: "USD";
  buy: number;
  sell: number;
  updatedAt: string;
  source: "dolarapi-oficial";
}

let officialExchangeRateHistory: DailyOfficialExchangeRate[] = [];

async function getDailyOfficialRate(date = new Date().toISOString().split("T")[0]) {
  const stored = officialExchangeRateHistory.find(rate => rate.date === date);
  if (stored) return stored;

  const today = new Date().toISOString().split("T")[0];
  if (date !== today) {
    const prior = officialExchangeRateHistory
      .filter(rate => rate.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prior) return prior;
  }

  const response = await fetch("https://dolarapi.com/v1/dolares/oficial");
  if (!response.ok) throw new Error(`DolarAPI respondió ${response.status}`);
  const data = await response.json() as {
    compra: number;
    venta: number;
    fechaActualizacion: string;
  };

  const snapshot: DailyOfficialExchangeRate = {
    date: today,
    currency: "USD",
    buy: Number(data.compra),
    sell: Number(data.venta),
    updatedAt: data.fechaActualizacion,
    source: "dolarapi-oficial"
  };
  officialExchangeRateHistory = officialExchangeRateHistory.filter(rate => rate.date !== today);
  officialExchangeRateHistory.push(snapshot);
  exchangeRates.ARS_USD_OFICIAL = snapshot.sell;
  persistAppState();
  return snapshot;
}

function convertAmount(amount: number, from: Currency, to: Currency, arsPerUsd: number) {
  if (from === to) return amount;
  if (from === Currency.ARS && to === Currency.USD) return amount / arsPerUsd;
  if (from === Currency.USD && to === Currency.ARS) return amount * arsPerUsd;
  if (from === Currency.BRL && to === Currency.USD) return amount / exchangeRates.BRL_USD;
  if (from === Currency.USD && to === Currency.BRL) return amount * exchangeRates.BRL_USD;
  if (from === Currency.ARS && to === Currency.BRL) return (amount / arsPerUsd) * exchangeRates.BRL_USD;
  if (from === Currency.BRL && to === Currency.ARS) return (amount / exchangeRates.BRL_USD) * arsPerUsd;
  return amount;
}

// Seed Tables
let projects: Project[] = [
  // Tenant Lelfun
  {
    id: "proj-alvear",
    tenantId: "tenant-lelfun",
    code: "ALV-150",
    name: "Torre Alvear Residencias",
    status: ProjectStatus.IN_PROGRESS,
    address: "Av. Alvear 1850, Recoleta",
    city: "Buenos Aires",
    startDate: "2024-03-01",
    plannedEndDate: "2027-06-30",
    surfaceM2: 8400,
    sellableSurfaceM2: 6800,
    floors: 25,
    functionalUnits: 120,
    baseCurrency: Currency.USD,
    estimatedCostPerM2: 1750,
    estimatedTotalCost: 14700000,
    physicalProgress: 42,
    financialProgress: 38,
    schedule: [
      { id: "task-1", taskName: "Excavación y Subestructura", startWeek: 1, endWeek: 6, progress: 100 },
      { id: "task-2", taskName: "Estructura de Hormigón (Pisos 1-12)", startWeek: 5, endWeek: 14, progress: 85 },
      { id: "task-3", taskName: "Estructura de Hormigón (Pisos 13-25)", startWeek: 12, endWeek: 20, progress: 10 },
      { id: "task-4", taskName: "Mampostería y Cerramientos", startWeek: 10, endWeek: 18, progress: 40 },
      { id: "task-5", taskName: "Instalaciones Eléctricas y Sanitarias", startWeek: 14, endWeek: 22, progress: 25 },
      { id: "task-6", taskName: "Terminaciones y Pintura", startWeek: 18, endWeek: 24, progress: 0 }
    ],
    projectType: "Construcción",
    constructionType: "Edificio",
    description: "Torre de departamentos residenciales premium con amenities de primer nivel y certificación sustentable.",
    certifications: [
      {
        id: "cert-seed-1",
        projectId: "proj-alvear",
        date: "2024-06-15",
        physicalProgress: 20,
        financialProgress: 18,
        certifiedBy: "Ing. Sofía Obra",
        notes: "Primera certificación de obra. Excavación completada y primeras columnas de subsuelo en progreso."
      },
      {
        id: "cert-seed-2",
        projectId: "proj-alvear",
        date: "2024-11-20",
        physicalProgress: 42,
        financialProgress: 38,
        certifiedBy: "Ing. Sofía Obra",
        notes: "Segunda certificación de obra. Avance sostenido en estructura de hormigón armado hasta piso 10."
      }
    ]
  },
  {
    id: "proj-palermo-historico",
    tenantId: "tenant-lelfun",
    code: "PAL-MED",
    name: "Complejo Palermo Zen (Cerrado)",
    status: ProjectStatus.CLOSED,
    address: "Honduras 4800, Palermo",
    city: "Buenos Aires",
    startDate: "2021-01-15",
    plannedEndDate: "2023-12-15",
    surfaceM2: 4500,
    sellableSurfaceM2: 3800,
    floors: 10,
    functionalUnits: 48,
    baseCurrency: Currency.USD,
    estimatedCostPerM2: 1600,
    estimatedTotalCost: 7200000,
    physicalProgress: 100,
    financialProgress: 100,
    schedule: [
      { id: "task-p1", taskName: "Preliminares y Demolición", startWeek: 1, endWeek: 4, progress: 100 },
      { id: "task-p2", taskName: "Hormigón Estructural", startWeek: 3, endWeek: 12, progress: 100 },
      { id: "task-p3", taskName: "Instalaciones de Servicios", startWeek: 10, endWeek: 18, progress: 100 },
      { id: "task-p4", taskName: "Yesería y Pisos", startWeek: 15, endWeek: 22, progress: 100 },
      { id: "task-p5", taskName: "Aberturas y Fachada", startWeek: 18, endWeek: 24, progress: 100 }
    ]
  },
  {
    id: "proj-madero-historico",
    tenantId: "tenant-lelfun",
    code: "MAD-OFF",
    name: "Oficinas Madero Office (Cerrado)",
    status: ProjectStatus.CLOSED,
    address: "Juana Manso 1050, Puerto Madero",
    city: "Buenos Aires",
    startDate: "2020-05-01",
    plannedEndDate: "2023-04-30",
    surfaceM2: 12000,
    sellableSurfaceM2: 9500,
    floors: 30,
    functionalUnits: 60,
    baseCurrency: Currency.USD,
    estimatedCostPerM2: 2100,
    estimatedTotalCost: 25200000,
    physicalProgress: 100,
    financialProgress: 100,
    schedule: [
      { id: "task-m1", taskName: "Fundaciones Especiales", startWeek: 1, endWeek: 5, progress: 100 },
      { id: "task-m2", taskName: "Superestructura de Hormigón", startWeek: 4, endWeek: 14, progress: 100 },
      { id: "task-m3", taskName: "Fachada Courtain Wall", startWeek: 12, endWeek: 20, progress: 100 },
      { id: "task-m4", taskName: "Climatización y Ventilación", startWeek: 15, endWeek: 22, progress: 100 },
      { id: "task-m5", taskName: "Pisos Técnicos y Cielorrasos", startWeek: 18, endWeek: 24, progress: 100 }
    ]
  },
  // Tenant Norte
  {
    id: "proj-altos",
    tenantId: "tenant-norte",
    code: "ALT-COR",
    name: "Altos de Manantiales",
    status: ProjectStatus.PLANNING,
    address: "Av. Cruz Roja s/n, Zona Sur",
    city: "Córdoba",
    startDate: "2026-09-01",
    plannedEndDate: "2029-12-01",
    surfaceM2: 15400,
    sellableSurfaceM2: 12200,
    floors: 4,
    functionalUnits: 140,
    baseCurrency: Currency.ARS,
    estimatedCostPerM2: 1200000,
    estimatedTotalCost: 18480000000,
    physicalProgress: 5,
    financialProgress: 2,
    schedule: [
      { id: "task-al1", taskName: "Limpieza y Replanteo", startWeek: 1, endWeek: 4, progress: 30 },
      { id: "task-al2", taskName: "Movimiento de Suelos", startWeek: 3, endWeek: 8, progress: 0 },
      { id: "task-al3", taskName: "Cimentación y Plateas", startWeek: 6, endWeek: 12, progress: 0 },
      { id: "task-al4", taskName: "Mampostería Planta Baja", startWeek: 10, endWeek: 16, progress: 0 },
      { id: "task-al5", taskName: "Instalaciones Cloacales y Pluviales", startWeek: 14, endWeek: 20, progress: 0 }
    ]
  },
  // Tenant Alianza
  {
    id: "proj-jardins",
    tenantId: "tenant-alianza",
    code: "JAR-SP",
    name: "Residencial Jardins Bela Vista",
    status: ProjectStatus.IN_PROGRESS,
    address: "Alameda Lorena 1200, Jardins",
    city: "São Paulo",
    startDate: "2024-08-10",
    plannedEndDate: "2027-12-20",
    surfaceM2: 6200,
    sellableSurfaceM2: 5000,
    floors: 18,
    functionalUnits: 72,
    baseCurrency: Currency.BRL,
    estimatedCostPerM2: 9200,
    estimatedTotalCost: 57040000,
    physicalProgress: 28,
    financialProgress: 25,
    schedule: [
      { id: "task-j1", taskName: "Fundações e Fundações Profundas", startWeek: 1, endWeek: 5, progress: 100 },
      { id: "task-j2", taskName: "Estrutura de Concreto Armado", startWeek: 4, endWeek: 15, progress: 45 },
      { id: "task-j3", taskName: "Alvenaria de Vedação", startWeek: 12, endWeek: 18, progress: 10 },
      { id: "task-j4", taskName: "Instalações Hidráulicas e Elétricas", startWeek: 14, endWeek: 21, progress: 5 },
      { id: "task-j5", taskName: "Acabamentos Internos", startWeek: 18, endWeek: 24, progress: 0 }
    ]
  }
];

let accounts: FinancialAccount[] = [
  // Lelfun S.A.
  { id: "acc-1", tenantId: "tenant-lelfun", name: "Caja Chica Obra Alvear", type: "Caja", currency: Currency.ARS, balance: 1254300 },
  { id: "acc-2", tenantId: "tenant-lelfun", name: "Banco Galicia Cuenta Corriente", type: "Banco", currency: Currency.ARS, balance: 24890000 },
  { id: "acc-3", tenantId: "tenant-lelfun", name: "Caja Fuerte Central (USD)", type: "Caja Fuerte", currency: Currency.USD, balance: 485000 },
  { id: "acc-4", tenantId: "tenant-lelfun", name: "Banco Galicia Especial (USD)", type: "Banco", currency: Currency.USD, balance: 1250000 },
  
  // Norte S.A.
  { id: "acc-5", tenantId: "tenant-norte", name: "Caja Administración Córdoba", type: "Caja", currency: Currency.ARS, balance: 850000 },
  { id: "acc-6", tenantId: "tenant-norte", name: "Banco Bancor Cuenta Empresa", type: "Banco", currency: Currency.ARS, balance: 112400000 },
  { id: "acc-7", tenantId: "tenant-norte", name: "Cofre USD Córdoba", type: "Caja Fuerte", currency: Currency.USD, balance: 82000 },

  // Alianza Ltda.
  { id: "acc-8", tenantId: "tenant-alianza", name: "Caixa Obra Jardins", type: "Caja", currency: Currency.BRL, balance: 45000 },
  { id: "acc-9", tenantId: "tenant-alianza", name: "Banco Itaú PJ BRL", type: "Banco", currency: Currency.BRL, balance: 1850000 },
  { id: "acc-10", tenantId: "tenant-alianza", name: "Banco Itaú USD", type: "Banco", currency: Currency.USD, balance: 140000 }
];

let counterparties: Counterparty[] = [
  // Tenant Lelfun
  { id: "cnt-1", tenantId: "tenant-lelfun", name: "Comercializadora Lomas (Inversor)", type: "Inversor", taxId: "30-71458921-9" },
  { id: "cnt-2", tenantId: "tenant-lelfun", name: "Hormigones del Plata S.A.", type: "Proveedor", taxId: "30-50239564-2" },
  { id: "cnt-3", tenantId: "tenant-lelfun", name: "Ingeniería Estructural S.R.L.", type: "Contratista", taxId: "33-68421054-9" },
  { id: "cnt-4", tenantId: "tenant-lelfun", name: "Eduardo Pérez (Comprador Piso 4A)", type: "Cliente", taxId: "20-33458921-2" },
  { id: "cnt-5", tenantId: "tenant-lelfun", name: "Mariela Fernández (Compradora Piso 5B)", type: "Cliente", taxId: "27-28491032-4" },

  // Tenant Norte
  { id: "cnt-6", tenantId: "tenant-norte", name: "Cimiento Córdoba S.A.", type: "Contratista", taxId: "30-66231450-1" },
  { id: "cnt-7", tenantId: "tenant-norte", name: "Hierros del Interior", type: "Proveedor", taxId: "30-58432109-2" },
  { id: "cnt-8", tenantId: "tenant-norte", name: "Juan Carlos Gómez (Comprador Casa 12)", type: "Cliente", taxId: "20-17849310-1" },

  // Tenant Alianza
  { id: "cnt-9", tenantId: "tenant-alianza", name: "Fundações Paulistas S/A", type: "Contratista", taxId: "12.345.678/0001-90" },
  { id: "cnt-10", tenantId: "tenant-alianza", name: "Aço São Paulo S.A.", type: "Proveedor", taxId: "98.765.432/0001-10" },
  { id: "cnt-11", tenantId: "tenant-alianza", name: "Ana Silva (Compradora Apt 101)", type: "Cliente", taxId: "456.789.123-00" }
];

let costCategories: CostCategory[] = [
  // Categories (hierarchical tree simulation, code defines hierarchy)
  { id: "cat-1", tenantId: "tenant-lelfun", code: "01", name: "Trabajos Preliminares", isLeaf: false },
  { id: "cat-1-1", tenantId: "tenant-lelfun", parentId: "cat-1", code: "01.01", name: "Limpieza y Cercos", isLeaf: true },
  { id: "cat-1-2", tenantId: "tenant-lelfun", parentId: "cat-1", code: "01.02", name: "Movimiento de Suelos", isLeaf: true },
  { id: "cat-2", tenantId: "tenant-lelfun", code: "02", name: "Estructura de Hormigón", isLeaf: false },
  { id: "cat-2-1", tenantId: "tenant-lelfun", parentId: "cat-2", code: "02.01", name: "Hormigón Elaborado", isLeaf: true },
  { id: "cat-2-2", tenantId: "tenant-lelfun", parentId: "cat-2", code: "02.02", name: "Hierro y Armaduras", isLeaf: true },
  { id: "cat-2-3", tenantId: "tenant-lelfun", parentId: "cat-2", code: "02.03", name: "Mano de Obra Estructura", isLeaf: true },
  { id: "cat-3", tenantId: "tenant-lelfun", code: "03", name: "Instalaciones Básicas", isLeaf: false },
  { id: "cat-3-1", tenantId: "tenant-lelfun", parentId: "cat-3", code: "03.01", name: "Instalación Sanitaria", isLeaf: true },
  { id: "cat-3-2", tenantId: "tenant-lelfun", parentId: "cat-3", code: "03.02", name: "Instalación Eléctrica", isLeaf: true },
  { id: "cat-4", tenantId: "tenant-lelfun", code: "04", name: "Terminaciones", isLeaf: false },
  { id: "cat-4-1", tenantId: "tenant-lelfun", parentId: "cat-4", code: "04.01", name: "Yesería y Pintura", isLeaf: true },
  { id: "cat-4-2", tenantId: "tenant-lelfun", parentId: "cat-4", code: "04.02", name: "Aberturas y Cristales", isLeaf: true },
  { id: "cat-4-3", tenantId: "tenant-lelfun", parentId: "cat-4", code: "04.03", name: "Revestimientos", isLeaf: true },

  // For tenant Norte
  { id: "cat-n1", tenantId: "tenant-norte", code: "01", name: "Preliminares y Movimientos", isLeaf: true },
  { id: "cat-n2", tenantId: "tenant-norte", code: "02", name: "Fundaciones y Hormigón", isLeaf: true },
  { id: "cat-n3", tenantId: "tenant-norte", code: "03", name: "Albañilería Integral", isLeaf: true },
  { id: "cat-n4", tenantId: "tenant-norte", code: "04", name: "Instalaciones y Conexiones", isLeaf: true },

  // For tenant Alianza
  { id: "cat-a1", tenantId: "tenant-alianza", code: "01", name: "Fundações e Limpeza", isLeaf: true },
  { id: "cat-a2", tenantId: "tenant-alianza", code: "02", name: "Estrutura de Concreto", isLeaf: true },
  { id: "cat-a3", tenantId: "tenant-alianza", code: "03", name: "Alvenarias e Revestimentos", isLeaf: true },
  { id: "cat-a4", tenantId: "tenant-alianza", code: "04", name: "Acabamentos e Metais", isLeaf: true }
];

let movements: FinancialMovement[] = [
  // Torre Alvear (Lelfun) - Initial investments and structure expenses
  {
    id: "mov-1",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    accountId: "acc-4", // Galicia USD
    counterpartyId: "cnt-1",
    amount: 150000,
    currency: Currency.USD,
    baseAmount: 150000,
    exchangeRate: 1.0,
    exchangeRateDate: "2024-03-05",
    type: MovementType.INGRESO,
    description: "Inyección de capital inicial - Inversor Lomas",
    status: MovementStatus.POSTED,
    date: "2024-03-05",
    performedBy: "Gerencia Financiera",
    approvedBy: "Director Gral."
  },
  {
    id: "mov-2",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    accountId: "acc-2", // Galicia ARS
    counterpartyId: "cnt-2", // Hormigones del Plata
    categoryId: "cat-2-1", // Hormigon Elaborado
    amount: 18300000,
    currency: Currency.ARS,
    baseAmount: 15000, // Equiv to 15K USD
    exchangeRate: 1220.0, // MEP rate
    exchangeRateDate: "2024-04-12",
    type: MovementType.EGRESO,
    description: "Despacho hormigón H21 para loza del 3er piso",
    status: MovementStatus.POSTED,
    date: "2024-04-12",
    performedBy: "Administración Obra",
    approvedBy: "Jefe de Obra Alvear"
  },
  {
    id: "mov-3",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    accountId: "acc-1", // Caja Obra ARS
    counterpartyId: "cnt-3", // Ingenieria Estructural
    categoryId: "cat-2-3", // Mano de obra
    amount: 610000,
    currency: Currency.ARS,
    baseAmount: 500,
    exchangeRate: 1220.0,
    exchangeRateDate: "2026-07-15",
    type: MovementType.EGRESO,
    description: "Jornal quincenal colocadores de armadura de hierro",
    status: MovementStatus.APPROVED, // Workflow completed, but not POSTED to balance yet
    date: "2026-07-15",
    performedBy: "Ayudante de Campo",
    approvedBy: "Jefe de Obra Alvear"
  },
  {
    id: "mov-4",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    accountId: "acc-1", // Caja Obra ARS
    counterpartyId: "cnt-3",
    categoryId: "cat-1-1",
    amount: 120000,
    currency: Currency.ARS,
    baseAmount: 98.36,
    exchangeRate: 1220.0,
    exchangeRateDate: "2026-07-18",
    type: MovementType.EGRESO,
    description: "Limpieza de escombros de hormigón en vereda",
    status: MovementStatus.PENDING_VALIDATION, // Needs approval
    date: "2026-07-18",
    performedBy: "Operador de Campo"
  },
  // Transfer Galicia USD to Galicia ARS (Galicia MEP Sell)
  {
    id: "mov-5",
    tenantId: "tenant-lelfun",
    accountId: "acc-3", // From Safe USD
    targetAccountId: "acc-2", // To Galicia ARS
    amount: 10000,
    currency: Currency.USD,
    baseAmount: 10000,
    exchangeRate: 1220.0,
    exchangeRateDate: "2026-07-10",
    type: MovementType.TRANSFERENCIA,
    description: "Venta MEP para reponer fondos de caja corriente ARS",
    status: MovementStatus.POSTED,
    date: "2026-07-10",
    performedBy: "Tesorero Central",
    approvedBy: "Director Financiero"
  },

  // Altos de Córdoba (Norte)
  {
    id: "mov-6",
    tenantId: "tenant-norte",
    projectId: "proj-altos",
    accountId: "acc-6", // Bancor
    counterpartyId: "cnt-7", // Hierros del interior
    categoryId: "cat-n2",
    amount: 45000000,
    currency: Currency.ARS,
    baseAmount: 36885,
    exchangeRate: 1220.0,
    exchangeRateDate: "2026-07-02",
    type: MovementType.EGRESO,
    description: "Compra inicial de acopio de varillas de acero nervado",
    status: MovementStatus.POSTED,
    date: "2026-07-02",
    performedBy: "Comprador Norte",
    approvedBy: "Gerente Operativo"
  }
];

let cashCounts: CashCount[] = [
  {
    id: "count-1",
    tenantId: "tenant-lelfun",
    accountId: "acc-1", // Caja Chica
    projectId: "proj-alvear",
    countDate: "2026-07-19",
    systemBalance: 1374300, // Before the pending mov-4 which is 120,000
    physicalBalance: 1374300,
    difference: 0,
    currency: Currency.ARS,
    status: "APPROVED",
    performedBy: "Jefe de Obra Alvear",
    approvedBy: "Auditor Administrativo",
    notes: "Arqueo de caja chica semanal sin novedades."
  }
];

type BudgetTemplateItem = { name: string; incidence: number };

// Matrices tomadas de las hojas CASAS y EDIFICIOS de Tr3sR Contabilidad v12.0.
const HOUSE_BUDGET_TEMPLATE: BudgetTemplateItem[] = [
  ["Albañilería MDO", 24.40], ["Albañilería Materiales", 9.75],
  ["Estructura Hormigón", 7.40], ["Carpintería Aluminio", 6.80],
  ["Estructura Acero", 6.00], ["Gastos Municipales", 5.60],
  ["Pisos y Revestimientos", 4.20], ["Jardinería", 3.20],
  ["Electricidad Materiales", 2.80], ["Plomería Sanitarios", 2.80],
  ["Pintura MDO", 2.75], ["Excavación", 2.70], ["Cocina Muebles", 2.40],
  ["Estructura Maderas", 2.00], ["Electricidad MDO", 1.80],
  ["Carpintería Puertas", 1.40], ["Cocina Mesadas", 1.30],
  ["Plomería MDO", 1.30], ["Obra Generales", 1.25], ["Yesería MDO", 1.25],
  ["Amoblamientos", 1.00], ["Calefacción", 1.00], ["Piscina", 1.00],
  ["Pintura Materiales", 0.90], ["Cocina Artefactos", 0.85],
  ["Plomería Materiales", 0.85], ["Yesería Materiales", 0.60],
  ["Herramientas", 0.50], ["Aire Acondicionado", 0.45], ["Zinguería", 0.40],
  ["Plomería Termotanques", 0.40], ["Estructura Generales", 0.35],
  ["Herrería", 0.25], ["Plomería Bombas", 0.20], ["Cerrajería", 0.15]
].map(([name, incidence]) => ({ name: String(name), incidence: Number(incidence) }));

const BUILDING_BUDGET_TEMPLATE: BudgetTemplateItem[] = [
  ["Personal Sueldos", 18.40], ["Albañilería Materiales", 8.46],
  ["Estructura Hormigón", 5.40], ["Impuestos Generales", 4.98],
  ["Estructura Acero", 4.74], ["Gastos Municipales", 3.88],
  ["Carpintería Aluminio", 3.80], ["Plomería Materiales", 3.60],
  ["Ascensor", 3.50], ["Pintura MDO", 2.75],
  ["Pisos y Revestimientos", 2.57], ["Plomería MDO", 2.44],
  ["Electricidad MDO", 2.42], ["Electricidad Materiales", 2.34],
  ["Plomería Sanitarios", 2.30], ["Herrería", 2.18],
  ["Empresa Generales", 1.87], ["Herramientas", 1.78],
  ["Carpintería Puertas", 1.78], ["Cocina Artefactos", 1.75],
  ["Obra Generales", 1.72], ["Cocina Muebles", 1.68], ["Excavación", 1.40],
  ["Yesería MDO", 1.36], ["Pintura Materiales", 1.32],
  ["Honorarios Escribanía", 1.20], ["Estructura Maderas", 1.16],
  ["Plomería Bombas", 1.08], ["Comercialización", 1.00],
  ["Amoblamientos", 1.00], ["Plomería Termotanques", 0.98],
  ["Higiene y Seguridad", 0.72], ["Reclamos", 0.68], ["Zinguería", 0.60],
  ["Cerrajería", 0.58], ["Yesería Materiales", 0.54], ["Demolición", 0.44],
  ["Honorarios Contaduría", 0.40], ["Aire Acondicionado", 0.38],
  ["Jardinería", 0.28], ["Cocina Mesadas", 0.26],
  ["Estructura Generales", 0.16], ["Honorarios Abogacía", 0.12],
  ["Calefacción", 0.00]
].map(([name, incidence]) => ({ name: String(name), incidence: Number(incidence) }));

function getBudgetTemplate(constructionType?: string) {
  return (constructionType || "").toLocaleLowerCase("es").includes("casa")
    ? HOUSE_BUDGET_TEMPLATE
    : BUILDING_BUDGET_TEMPLATE;
}

function createReferenceBudgetLines(project: Project): BudgetLine[] {
  const template = getBudgetTemplate(project.constructionType);
  const templateName = template === HOUSE_BUDGET_TEMPLATE ? "Casa" : "Edificio";

  return template.map((item, index) => ({
    id: `bl-${project.id}-${index + 1}`,
    projectId: project.id,
    categoryId: `ref-${templateName.toLowerCase()}-${index + 1}`,
    code: String(index + 1).padStart(2, "0"),
    name: item.name,
    amount: Number(((project.estimatedTotalCost * item.incidence) / 100).toFixed(2)),
    incidence: item.incidence,
    notes: `Plantilla de referencia ${templateName} · Tr3sR Contabilidad v12.0`,
    subitems: []
  }));
}

let budgetLines: BudgetLine[] = [
  ...createReferenceBudgetLines(projects.find(project => project.id === "proj-alvear")!)
];

// Durable local persistence for operational data.
// Supabase currently provides Auth only; these entities can be migrated when its tables exist.
const APP_STATE_FILE = path.join(process.cwd(), "custom-app-state.json");

function loadPersistedAppState() {
  try {
    if (!fs.existsSync(APP_STATE_FILE)) return;
    const persisted = JSON.parse(fs.readFileSync(APP_STATE_FILE, "utf-8"));
    if (Array.isArray(persisted.projects)) projects = persisted.projects;
    if (Array.isArray(persisted.budgetLines)) budgetLines = persisted.budgetLines;
    if (Array.isArray(persisted.costCategories)) costCategories = persisted.costCategories;
    if (Array.isArray(persisted.purchaseRequests)) purchaseRequests = persisted.purchaseRequests;
    if (Array.isArray(persisted.movements)) movements = persisted.movements;
    if (Array.isArray(persisted.accounts)) accounts = persisted.accounts;
    if (Array.isArray(persisted.cashCounts)) cashCounts = persisted.cashCounts;
    if (Array.isArray(persisted.officialExchangeRateHistory)) {
      officialExchangeRateHistory = persisted.officialExchangeRateHistory;
    }
    if (Array.isArray(persisted.sellableUnits)) sellableUnits = persisted.sellableUnits;
    if (Array.isArray(persisted.salesOpportunities)) salesOpportunities = persisted.salesOpportunities;
    if (Array.isArray(persisted.salesContracts)) salesContracts = persisted.salesContracts;
    if (Array.isArray(persisted.installments)) installments = persisted.installments;
  } catch (error) {
    console.error("Error loading persisted application state:", error);
  }
}

function persistAppState() {
  try {
    const temporaryFile = `${APP_STATE_FILE}.tmp`;
    fs.writeFileSync(
      temporaryFile,
      JSON.stringify({
        version: 4,
        projects,
        budgetLines,
        costCategories,
        purchaseRequests,
        movements,
        accounts,
        cashCounts,
        officialExchangeRateHistory,
        salesOpportunities,
        sellableUnits,
        salesContracts,
        installments
      }, null, 2),
      "utf-8"
    );
    fs.renameSync(temporaryFile, APP_STATE_FILE);
  } catch (error) {
    console.error("Error saving persisted application state:", error);
    throw error;
  }
}

let purchaseRequests: PurchaseRequest[] = [
  {
    id: "pr-1",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    code: "NP-084",
    title: "Compra de Yeso y Molduras de Terminación",
    status: PurchaseStatus.RFQ,
    requestedBy: "Jefe de Terminaciones Alvear",
    requiredDate: "2026-08-15",
    categoryId: "cat-4-1",
    estimatedTotal: 8400,
    currency: Currency.USD,
    items: [
      { id: "pri-1", description: "Bolsas de yeso de 30kg - Marca Tuyango", quantity: 200, unit: "Bolsa", estimatedPrice: 15 },
      { id: "pri-2", description: "Moldura de yeso modelo imperial M2", quantity: 300, unit: "Metros", estimatedPrice: 18 }
    ]
  },
  {
    id: "pr-2",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    code: "OC-052",
    title: "Provisión e Instalación Eléctrica Principal",
    status: PurchaseStatus.ORDERED,
    requestedBy: "Director de Obra",
    requiredDate: "2026-09-01",
    categoryId: "cat-3-2",
    estimatedTotal: 28000,
    currency: Currency.USD,
    items: [
      { id: "pri-3", description: "Cables unipolar sintenax subterráneo 4x16mm", quantity: 450, unit: "Metros", estimatedPrice: 40, actualPrice: 42, supplierId: "cnt-3" },
      { id: "pri-4", description: "Tablero de distribución trifásico seccional", quantity: 4, unit: "Unidad", estimatedPrice: 2500, actualPrice: 2275, supplierId: "cnt-3" }
    ]
  }
];

let sellableUnits: SellableUnit[] = [
  // Torre Alvear units
  { id: "unit-1", projectId: "proj-alvear", name: "Piso 4 - Departamento A", type: UnitType.DEPARTAMENTO, status: UnitStatus.SOLD, surfaceM2: 85, price: 195000, currency: Currency.USD, currentOwnerId: "cnt-4" },
  { id: "unit-2", projectId: "proj-alvear", name: "Piso 5 - Departamento B", type: UnitType.DEPARTAMENTO, status: UnitStatus.SOLD, surfaceM2: 120, price: 285000, currency: Currency.USD, currentOwnerId: "cnt-5" },
  { id: "unit-3", projectId: "proj-alvear", name: "Piso 6 - Departamento A (Vista Río)", type: UnitType.DEPARTAMENTO, status: UnitStatus.RESERVED, surfaceM2: 85, price: 210000, currency: Currency.USD },
  { id: "unit-4", projectId: "proj-alvear", name: "Piso 6 - Departamento B", type: UnitType.DEPARTAMENTO, status: UnitStatus.AVAILABLE, surfaceM2: 120, price: 290000, currency: Currency.USD },
  { id: "unit-5", projectId: "proj-alvear", name: "Cochera Subsuelo 1 - N° 12", type: UnitType.COCHERA, status: UnitStatus.AVAILABLE, surfaceM2: 15, price: 25000, currency: Currency.USD },
  { id: "unit-6", projectId: "proj-alvear", name: "Cochera Subsuelo 1 - N° 14", type: UnitType.COCHERA, status: UnitStatus.SOLD, surfaceM2: 15, price: 25000, currency: Currency.USD, currentOwnerId: "cnt-4" },

  // Altos de Córdoba units
  { id: "unit-7", projectId: "proj-altos", name: "Casa Lote 12 - Altos de Manantiales", type: UnitType.LOTE, status: UnitStatus.SOLD, surfaceM2: 360, price: 72000000, currency: Currency.ARS, currentOwnerId: "cnt-8" },
  { id: "unit-8", projectId: "proj-altos", name: "Casa Lote 14 - Altos de Manantiales", type: UnitType.LOTE, status: UnitStatus.AVAILABLE, surfaceM2: 360, price: 75000000, currency: Currency.ARS },

  // Jardins units
  { id: "unit-9", projectId: "proj-jardins", name: "Apt 101 - Edificio Jardins", type: UnitType.DEPARTAMENTO, status: UnitStatus.SOLD, surfaceM2: 95, price: 920000, currency: Currency.BRL, currentOwnerId: "cnt-11" },
  { id: "unit-10", projectId: "proj-jardins", name: "Apt 102 - Edificio Jardins", type: UnitType.DEPARTAMENTO, status: UnitStatus.AVAILABLE, surfaceM2: 110, price: 1150000, currency: Currency.BRL }
];

let salesOpportunities: SalesOpportunity[] = [];

let salesContracts: SalesContract[] = [
  {
    id: "con-1",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    unitId: "unit-1",
    customerId: "cnt-4", // Eduardo Pérez
    contractDate: "2024-06-15",
    totalPrice: 195000,
    currency: Currency.USD,
    downPayment: 45000,
    installmentCount: 24,
    indexType: IndexType.CAC, // CAC indexing on installments
    baseIndexValue: 2540.2, // Base CAC value in June 2024
    status: "ACTIVE"
  },
  {
    id: "con-2",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    unitId: "unit-2",
    customerId: "cnt-5", // Mariela Fernández
    contractDate: "2025-01-10",
    totalPrice: 285000,
    currency: Currency.USD,
    downPayment: 85000,
    installmentCount: 36,
    indexType: IndexType.CAC,
    baseIndexValue: 2680.5,
    status: "ACTIVE"
  },

  // Norte Córdoba in ARS
  {
    id: "con-3",
    tenantId: "tenant-norte",
    projectId: "proj-altos",
    unitId: "unit-7",
    customerId: "cnt-8",
    contractDate: "2026-05-10",
    totalPrice: 72000000,
    currency: Currency.ARS,
    downPayment: 12000000,
    installmentCount: 24,
    indexType: IndexType.INFLATION,
    baseIndexValue: 295.0,
    status: "ACTIVE"
  }
];

let installments: Installment[] = [
  // Installments for Eduardo Perez (Torre Alvear)
  {
    id: "inst-1-1",
    contractId: "con-1",
    installmentNumber: 1,
    originalAmount: 6250, // (195k total - 45k down payment) / 24 installments
    currency: Currency.USD,
    dueDate: "2024-07-10",
    indexType: IndexType.CAC,
    indexBaseValue: 2540.2,
    indexCurrentValue: 2540.2, // At payment date
    adjustedAmount: 6250,
    paidAmount: 6250,
    status: InstallmentStatus.PAID
  },
  {
    id: "inst-1-2",
    contractId: "con-1",
    installmentNumber: 2,
    originalAmount: 6250,
    currency: Currency.USD,
    dueDate: "2024-08-10",
    indexType: IndexType.CAC,
    indexBaseValue: 2540.2,
    indexCurrentValue: 2595.6, // CAC went up
    adjustedAmount: 6386.27, // 6250 * (2595.6 / 2540.2)
    paidAmount: 6386.27,
    status: InstallmentStatus.PAID
  },
  // Upcoming active installment adjusted with real current index (index current = 2845.6 vs base = 2540.2)
  {
    id: "inst-1-25", // active July 2026
    contractId: "con-1",
    installmentNumber: 15,
    originalAmount: 6250,
    currency: Currency.USD,
    dueDate: "2026-07-10",
    indexType: IndexType.CAC,
    indexBaseValue: 2540.2,
    indexCurrentValue: 2845.6, // Today's CAC index
    adjustedAmount: 7001.38, // 6250 * (2845.6 / 2540.2)
    paidAmount: 0,
    status: InstallmentStatus.PENDING
  },
  {
    id: "inst-1-16",
    contractId: "con-1",
    installmentNumber: 16,
    originalAmount: 6250,
    currency: Currency.USD,
    dueDate: "2026-08-10",
    indexType: IndexType.CAC,
    indexBaseValue: 2540.2,
    indexCurrentValue: 2845.6, // Index estimated
    adjustedAmount: 7001.38,
    paidAmount: 0,
    status: InstallmentStatus.PENDING
  }
];

loadPersistedAppState();

let ocrDocuments: OcrDocument[] = [
  {
    id: "doc-1",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    fileName: "factura_hormigon_alvear.pdf",
    fileUrl: "https://example.com/files/factura_hormigon_alvear.pdf",
    date: "2026-07-12",
    issuer: "Hormigones del Plata S.A.",
    documentNumber: "Factura A-0004-9843",
    amount: 18300000,
    taxAmount: 3843000,
    currency: Currency.ARS,
    categoryId: "cat-2-1", // Hormigón Elaborado
    confidence: 0.95,
    status: "PROCESSED",
    rawText: "HORMIGONES DEL PLATA S.A. CUIT 30-50239564-2. FACTURA A 0004-9843. Fecha: 12/07/2026. Alvear Obra. Detalle: Hormigon H21 x 120m3. Neto: $14.457.000. IVA 21%: $3.843.000. Total: $18.300.000."
  }
];

// Early Consortium (Consorcios Tempranos) - managing warranty claims for delivered buildings
let earlyCondominiums: EarlyCondominium[] = [
  {
    id: "cond-1",
    tenantId: "tenant-lelfun",
    projectId: "proj-palermo-historico", // delivered project
    name: "Consorcio Provisional Palermo Zen",
    handoverDate: "2024-01-10",
    maintenanceMonths: 24, // 24 months developer management
    units: [
      { unitId: "unit-p1", ownerName: "Carlos Salvador", contactEmail: "carlos.salvador@gmail.com", handoverDate: "2024-01-15", occupied: true },
      { unitId: "unit-p2", ownerName: "Marta Legrand", contactEmail: "marta@legrand.com", handoverDate: "2024-02-01", occupied: true },
      { unitId: "unit-p3", ownerName: "Esteban Quito", contactEmail: "estebanquito@gmail.com", handoverDate: "2024-01-20", occupied: false }
    ]
  }
];

let maintenanceRequests: MaintenanceRequest[] = [
  {
    id: "maint-1",
    tenantId: "tenant-lelfun",
    projectId: "proj-palermo-historico",
    unitId: "unit-p1",
    reporterName: "Carlos Salvador",
    reporterContact: "+54 11 4839-2010",
    description: "Filtración leve en el techo del baño secundario. Se observó humedad en las molduras de yeso.",
    reportedDate: "2026-07-16",
    status: "IN_PROGRESS",
    warrantyCoverage: "COVERED",
    notes: "Visita de contratista sanitario agendada para el 22 de Julio. Cubierto por garantía estructural de obra de 24 meses."
  },
  {
    id: "maint-2",
    tenantId: "tenant-lelfun",
    projectId: "proj-palermo-historico",
    unitId: "unit-p2",
    reporterName: "Marta Legrand",
    reporterContact: "marta@legrand.com",
    description: "Falla en el portero visor eléctrico, no emite sonido al tocar desde portería.",
    reportedDate: "2026-07-19",
    status: "PENDING",
    warrantyCoverage: "UNDER_INVESTIGATION"
  }
];

// Global Public Marketplace suppliers and public bids
let marketplaceSuppliers: MarketplaceSupplier[] = [
  { id: "msup-1", name: "Siderar Aceros del Norte", categories: ["Estructura", "Hierro y Armaduras"], serviceAreas: ["Buenos Aires", "Córdoba", "Santa Fe"], rating: 4.8, reviewCount: 42, contactEmail: "cotizaciones@siderar.com.ar", verified: true },
  { id: "msup-2", name: "Yesos San Juan", categories: ["Terminaciones", "Yesería y Pintura"], serviceAreas: ["Mendoza", "Córdoba", "Buenos Aires"], rating: 4.5, reviewCount: 18, contactEmail: "ventas@yesossanjuan.com", verified: true },
  { id: "msup-3", name: "Climatización Delta", categories: ["Instalaciones", "Instalaciones Básicas"], serviceAreas: ["Buenos Aires", "Uruguay"], rating: 4.2, reviewCount: 12, contactEmail: "proyectos@climadelta.com", verified: false },
  { id: "msup-4", name: "TecnoAberturas Alum", categories: ["Terminaciones", "Aberturas y Cristales"], serviceAreas: ["Buenos Aires", "Córdoba", "Santa Fe", "São Paulo"], rating: 4.9, reviewCount: 35, contactEmail: "contacto@tecnoaberturas.com", verified: true }
];

let publicTenders: PublicTender[] = [
  {
    id: "tend-1",
    tenantId: "tenant-lelfun",
    projectId: "proj-alvear",
    code: "LIC-ALV-04",
    title: "Provisión de Cristales DVH Templados para Fachada",
    description: "Licitación para la provisión de carpinterías de aluminio anodizado negro y cristales dobles vidriados templados (DVH) de seguridad para las caras A y B de la torre. Según planos adjuntos de fachada.",
    deadline: "2026-08-10",
    category: "Terminaciones",
    status: "OPEN",
    bids: [
      {
        id: "bid-1",
        supplierId: "msup-4",
        supplierName: "TecnoAberturas Alum",
        amount: 32000,
        currency: Currency.USD,
        deliveryWeeks: 4,
        notes: "Perfil Aluar línea Nordica, vidrio laminado 4+4 con cámara de aire de 12mm.",
        status: "PENDING"
      }
    ]
  }
];


// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

// 1. Get List of Tenants
app.get("/api/tenants", (req: Request, res: Response) => {
  res.json(tenants);
});

// Create dynamic Tenant and seed initial accounts & cost categories
app.post("/api/tenants", async (req: Request, res: Response) => {
  const tData = req.body;
  if (!tData.name) {
    return res.status(400).json({ error: "Falta el nombre de la empresa" });
  }

  // Production registrations must be persisted in Supabase. Vercel's local
  // filesystem is ephemeral and cannot be used as the source of truth.
  if (supabaseAdmin) {
    const user = await getRequestAuthUser(req);
    if (!user) return res.status(401).json({ error: "Debe confirmar el correo antes de crear la empresa" });
    try {
      const membership = await provisionTenantForUser(user, {
        name: String(tData.nombreFantasia || tData.name || "").trim(),
        legalName: String(tData.razonSocial || tData.name || "").trim(),
        taxId: String(tData.cuit || "").trim(),
        phone: String(tData.phone || "").trim(),
        legalAddress: String(tData.legalAddress || "").trim(),
        commercialAddress: String(tData.commercialAddress || tData.legalAddress || "").trim(),
        companyType: String(tData.companyType || "Constructora").trim(),
        defaultCurrency: String(tData.defaultCurrency || "ARS").trim(),
        planCode: String(tData.planCode || "STARTER").trim().toUpperCase()
      });
      return res.status(201).json({ tenantId: membership.tenant_id, environment: "TENANT" });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo crear la empresa" });
    }
  }

  const newTenantId = tData.id || `tenant-${Date.now()}`;
  
  // Seed the tenant object
  const newTenant: Tenant = {
    id: newTenantId,
    name: tData.name,
    defaultCurrency: tData.defaultCurrency || Currency.USD,
    enabledCurrencies: tData.enabledCurrencies || [Currency.ARS, Currency.USD],
    nombreFantasia: tData.nombreFantasia || tData.name,
    razonSocial: tData.razonSocial || tData.name,
    phone: tData.phone || "",
    legalAddress: tData.legalAddress || "",
    commercialAddress: tData.commercialAddress || "",
    companyType: tData.companyType || "Desarrolladora",
    cuit: tData.cuit || "",
    iibbType: tData.iibbType || "Local / Régimen General",
    logoUrl: tData.logoUrl || "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=100&auto=format&fit=crop",
    activeUsers: tData.activeUsers || [],
    deposits: [
      { id: `dep-${Date.now()}-1`, name: "Obrador Central", address: tData.commercialAddress || "Dirección Comercial" }
    ],
    subscription: {
      planName: tData.planName || "Lelfun SaaS Starter",
      activeUntil: "2027-12-31",
      maxProjects: 3,
      costPerMonth: 150,
      status: "Activo"
    }
  };

  tenants.push(newTenant);
  persistTenant(newTenant);

  // Seed default financial accounts for this new Tenant with $0 starting balance
  const currencyToUse = newTenant.defaultCurrency;
  accounts.push({
    id: `acc-${Date.now()}-1`,
    tenantId: newTenantId,
    name: "Caja Principal Pesos (ARS)",
    type: "Caja",
    currency: Currency.ARS,
    balance: 0
  });

  accounts.push({
    id: `acc-${Date.now()}-2`,
    tenantId: newTenantId,
    name: "Banco Cuenta Corriente (USD)",
    type: "Banco",
    currency: Currency.USD,
    balance: 0
  });

  // Seed basic Cost Categories for this new Tenant
  const seedCategories = [
    { code: "01", name: "Trabajos Preliminares" },
    { code: "02", name: "Estructura de Hormigón" },
    { code: "03", name: "Instalaciones Básicas" },
    { code: "04", name: "Terminaciones" }
  ];

  seedCategories.forEach((cat, index) => {
    costCategories.push({
      id: `cat-${Date.now()}-${index}`,
      tenantId: newTenantId,
      code: cat.code,
      name: cat.name,
      isLeaf: true
    });
  });

  res.status(201).json(newTenant);
});

// Create dynamic marketplace supplier
app.post("/api/marketplace-suppliers", async (req: Request, res: Response) => {
  const sData = req.body;
  if (!sData.name) {
    return res.status(400).json({ error: "Falta el nombre de la empresa proveedora" });
  }

  const newSupplier: MarketplaceSupplier = {
    id: sData.id || `msup-${Date.now()}`,
    name: sData.name,
    categories: sData.categories || ["Materiales generales"],
    serviceAreas: sData.serviceAreas || ["Nacional"],
    rating: 5.0,
    reviewCount: 1,
    contactEmail: sData.contactEmail || "",
    verified: false,
    empresa: sData.name,
    cuit: sData.cuit || ""
  };

  marketplaceSuppliers.push(newSupplier);
  if (supabaseAdmin && sData.contactEmail) {
    try {
      const authUser = await findAuthUserByEmail(sData.contactEmail);
      const { data: organization, error } = await supabaseAdmin.from("supplier_organizations").insert({
        legal_name: sData.name,
        trade_name: sData.tradeName || sData.name,
        tax_id: sData.cuit,
        company_type: sData.companyType || null,
        address: sData.address || null,
        phone: sData.phone || null,
        contact_email: sData.contactEmail,
        website: sData.website || null,
        service_areas: sData.serviceAreas || [],
        years_in_business_range: sData.yearsInBusinessRange || null,
        employees_range: sData.employeesRange || null,
        annual_revenue_range: sData.annualRevenueRange || null,
        company_description: sData.description || null,
        approval_status: "PENDING"
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      if (authUser) {
        await supabaseAdmin.from("supplier_members").insert({ supplier_id: organization.id, user_id: authUser.id, role: "owner", full_name: sData.ownerName || authUser.user_metadata?.nombre || sData.contactEmail, phone: sData.phone || null });
      }
      return res.status(201).json({ ...newSupplier, id: organization.id, approvalStatus: "PENDING" });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo registrar el proveedor" });
    }
  }
  res.status(201).json(newSupplier);
});

const MARKETPLACE_SUPERADMIN_EMAIL = "marianoez.gonzalez@gmail.com";

async function getRequestAuthUser(req: Request) {
  if (!supabaseAdmin) return null;
  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

type TenantRegistration = {
  name: string;
  legalName: string;
  taxId: string;
  phone?: string;
  legalAddress?: string;
  commercialAddress?: string;
  companyType?: string;
  defaultCurrency?: string;
  planCode?: string;
};

async function provisionTenantForUser(user: any, registration: TenantRegistration) {
  if (!supabaseAdmin) throw new Error("Supabase no estÃ¡ configurado");
  const { data: currentMembership, error: membershipLookupError } = await supabaseAdmin
    .from("tenant_members")
    .select("tenant_id,user_id,role,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (membershipLookupError) throw membershipLookupError;
  if (currentMembership) return currentMembership;

  if (!registration.name || !registration.legalName || !registration.taxId) {
    throw new Error("Complete nombre, razÃ³n social y CUIT");
  }

  const planCode = registration.planCode || "STARTER";
  const { data: plan, error: planError } = await supabaseAdmin
    .from("subscription_plans")
    .select("id")
    .eq("code", planCode)
    .eq("active", true)
    .single();
  if (planError || !plan) throw new Error(`El plan ${planCode} no estÃ¡ disponible`);

  const { data: tenantWithTaxId, error: taxLookupError } = await supabaseAdmin
    .from("tenants")
    .select("id,created_by")
    .eq("tax_id", registration.taxId)
    .maybeSingle();
  if (taxLookupError) throw taxLookupError;
  if (tenantWithTaxId && tenantWithTaxId.created_by !== user.id) {
    throw new Error("Ya existe una empresa registrada con ese CUIT");
  }

  let tenantId = tenantWithTaxId?.id || null;
  let createdTenant = false;
  try {
    if (!tenantId) {
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: registration.name,
          legal_name: registration.legalName,
          tax_id: registration.taxId,
          default_currency: registration.defaultCurrency || "ARS",
          phone: registration.phone || null,
          legal_address: registration.legalAddress || null,
          commercial_address: registration.commercialAddress || registration.legalAddress || null,
          company_type: registration.companyType || "Constructora",
          created_by: user.id
        })
        .select("id")
        .single();
      if (tenantError) throw tenantError;
      tenantId = tenant.id;
      createdTenant = true;
    }

    let { data: membership, error: memberLookupError } = await supabaseAdmin
      .from("tenant_members")
      .select("tenant_id,user_id,role,active")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberLookupError) throw memberLookupError;
    if (!membership) {
      const memberResult = await supabaseAdmin
        .from("tenant_members")
        .insert({ tenant_id: tenantId, user_id: user.id, role: "owner", active: true })
        .select("tenant_id,user_id,role,active")
        .single();
      if (memberResult.error) throw memberResult.error;
      membership = memberResult.data;
    }

    const { data: license, error: licenseLookupError } = await supabaseAdmin
      .from("tenant_licenses")
      .select("id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (licenseLookupError) throw licenseLookupError;
    if (!license) {
      const startsAt = new Date();
      const nextDueDate = new Date(startsAt);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      const { error: licenseError } = await supabaseAdmin.from("tenant_licenses").insert({
        tenant_id: tenantId,
        plan_id: plan.id,
        status: "ACTIVE",
        starts_at: startsAt.toISOString().slice(0, 10),
        next_due_date: nextDueDate.toISOString().slice(0, 10)
      });
      if (licenseError) throw licenseError;
    }
    return membership;
  } catch (error) {
    if (createdTenant && tenantId) await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
    throw error;
  }
}

app.get("/api/auth/access-context", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req);
  if (!user) return res.status(401).json({ error: "Sesión inválida" });
  const [adminResult, supplierResult, tenantResult] = await Promise.all([
    supabaseAdmin.from("platform_admins").select("active").eq("user_id", user.id).eq("active", true).maybeSingle(),
    supabaseAdmin.from("supplier_members").select("supplier_id,role,active,supplier_organizations(approval_status,legal_name,trade_name)").eq("user_id", user.id).eq("active", true).maybeSingle(),
    supabaseAdmin.from("tenant_members").select("tenant_id,role,active,tenants(name,legal_name,tax_id,phone),tenant_member_modules(module_key,can_read,can_write,can_approve)").eq("user_id", user.id).eq("active", true).maybeSingle()
  ]);
  if (adminResult.data) return res.json({ environment: "SUPERADMIN", userId: user.id, email: user.email });
  if (supplierResult.data) return res.json({ environment: "SUPPLIER", userId: user.id, email: user.email, supplier: supplierResult.data });
  let tenantMembership: any = tenantResult.data;
  if (!tenantMembership && user.user_metadata?.user_type === "tenant") {
    try {
      tenantMembership = await provisionTenantForUser(user, {
        name: String(user.user_metadata.tenant_name || "").trim(),
        legalName: String(user.user_metadata.tenant_legal_name || "").trim(),
        taxId: String(user.user_metadata.tenant_tax_id || "").trim(),
        phone: String(user.user_metadata.tenant_phone || user.user_metadata.telefono || "").trim(),
        legalAddress: String(user.user_metadata.tenant_legal_address || "").trim(),
        commercialAddress: String(user.user_metadata.tenant_legal_address || "").trim(),
        companyType: "Constructora",
        defaultCurrency: "ARS",
        planCode: String(user.user_metadata.tenant_plan || "STARTER").toUpperCase()
      });
    } catch (error) {
      console.error("Could not complete tenant registration:", error);
    }
  }
  if (tenantMembership) {
    const { data: license } = await supabaseAdmin.from("tenant_licenses").select("*,subscription_plans(*)").eq("tenant_id", tenantMembership.tenant_id).maybeSingle();
    const blocked = !license || ["PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"].includes(license.status) || new Date(license.next_due_date) < new Date(new Date().toISOString().slice(0, 10));
    if (blocked && license?.status === "ACTIVE") await supabaseAdmin.from("tenant_licenses").update({ status: "SUSPENDED", suspended_at: new Date().toISOString(), suspension_reason: "Licencia vencida" }).eq("id", license.id);
    const tenantDetailsResult = await supabaseAdmin.from("tenants").select("id,name,legal_name,tax_id,phone,legal_address,commercial_address,company_type,default_currency,logo_url").eq("id", tenantMembership.tenant_id).single();
    const databaseTenant = tenantDetailsResult.data;
    const localTenant = tenants.find(item => item.cuit && databaseTenant?.tax_id && item.cuit === databaseTenant.tax_id);
    const tenantProfile = databaseTenant ? {
      id: databaseTenant.id,
      name: databaseTenant.name,
      nombreFantasia: databaseTenant.name,
      razonSocial: databaseTenant.legal_name,
      cuit: databaseTenant.tax_id,
      phone: databaseTenant.phone,
      legalAddress: databaseTenant.legal_address,
      commercialAddress: databaseTenant.commercial_address,
      companyType: databaseTenant.company_type,
      defaultCurrency: databaseTenant.default_currency,
      logoUrl: databaseTenant.logo_url,
      activeUsers: [{
        name: user.user_metadata?.nombre || user.email,
        email: user.email,
        role: ["owner", "admin"].includes(tenantMembership.role) ? "Administrador General" : tenantMembership.role,
        active: true
      }]
    } : null;
    return res.json({ environment: "TENANT", userId: user.id, email: user.email, tenant: { ...tenantMembership, tenants: databaseTenant, local_tenant_id: localTenant?.id || tenantMembership.tenant_id }, tenantProfile, license: { ...license, blocked } });
  }
  return res.status(403).json({ error: "El usuario no tiene un entorno habilitado" });
});

async function requirePlatformAdmin(req: Request, res: Response) {
  if (!supabaseAdmin) { res.status(503).json({ error: "Supabase no está configurado" }); return null; }
  const user = await getRequestAuthUser(req);
  if (!user) { res.status(401).json({ error: "Sesión inválida" }); return null; }
  const { data } = await supabaseAdmin.from("platform_admins").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!data) { res.status(403).json({ error: "Acceso exclusivo de superadmin" }); return null; }
  return user;
}

async function writeAdminAudit(userId: string, action: string, entityType: string, entityId?: string, beforeData?: unknown, afterData?: unknown) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("platform_audit_log").insert({ actor_user_id: userId, action, entity_type: entityType, entity_id: entityId || null, before_data: beforeData || null, after_data: afterData || null });
}

app.get("/api/superadmin/dashboard", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const [tenantsResult, suppliersResult, productsResult, licensesResult, plansResult, billingResult, expensesResult, feesResult, alertsResult, auditResult, usageResult, featuredResult, bannersResult, marketplaceSettingsResult, categoriesResult] = await Promise.all([
    supabaseAdmin.from("tenants").select("id,name,legal_name,tax_id,phone,company_type,created_at"),
    supabaseAdmin.from("supplier_organizations").select("id,legal_name,trade_name,tax_id,phone,contact_email,approval_status,created_at"),
    supabaseAdmin.from("marketplace_products").select("id,name,status,supplier_id,created_at,expires_at,supplier_organizations(legal_name,trade_name)"),
    supabaseAdmin.from("tenant_licenses").select("*,subscription_plans(*)"),
    supabaseAdmin.from("subscription_plans").select("*").order("sort_order"),
    supabaseAdmin.from("billing_entries").select("*,tenants(name),supplier_organizations(legal_name,trade_name)").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("platform_expenses").select("*").order("expense_date", { ascending: false }).limit(500),
    supabaseAdmin.from("marketplace_service_fees").select("*,tenants(name),supplier_organizations(legal_name,trade_name)").order("calculated_at", { ascending: false }).limit(500),
    supabaseAdmin.from("platform_alerts").select("*,tenants(name)").is("resolved_at", null).order("created_at", { ascending: false }),
    supabaseAdmin.from("platform_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("tenant_usage_snapshots").select("*").order("measured_at", { ascending: false }),
    supabaseAdmin.from("marketplace_featured_memberships").select("*,supplier_organizations(legal_name,trade_name,store_slug)").order("created_at", { ascending: false }),
    supabaseAdmin.from("marketplace_banners").select("*").order("sort_order"),
    supabaseAdmin.from("platform_settings").select("setting_key,value").in("setting_key", ["featured_membership_monthly_price","featured_membership_annual_monthly_price","featured_membership_max_products","featured_membership_vat_rate"]),
    supabaseAdmin.from("marketplace_categories").select("id,name,code").eq("active",true).order("sort_order")
  ]);
  const error = [tenantsResult, suppliersResult, productsResult, licensesResult, plansResult, billingResult, expensesResult, feesResult, alertsResult, auditResult, usageResult, featuredResult, bannersResult, marketplaceSettingsResult, categoriesResult].find(result => result.error)?.error;
  if (error) return res.status(500).json({ error: error.message });

  const { data: memberships } = await supabaseAdmin.from("tenant_members").select("tenant_id,user_id,role,active");
  const { data: supplierMembers } = await supabaseAdmin.from("supplier_members").select("supplier_id,user_id,role,active,full_name,phone");
  const userIds = new Set([...(memberships || []).map(item => item.user_id), ...(supplierMembers || []).map(item => item.user_id), admin.id]);
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = (authUsers?.users || []).filter(user => userIds.has(user.id)).map(user => ({ id: user.id, email: user.email, fullName: user.user_metadata?.nombre || user.user_metadata?.full_name || "", phone: user.phone || user.user_metadata?.phone || "", createdAt: user.created_at, lastSignInAt: user.last_sign_in_at, bannedUntil: user.banned_until, tenantMembership: (memberships || []).find(member => member.user_id === user.id), supplierMembership: (supplierMembers || []).find(member => member.user_id === user.id), isSuperAdmin: user.id === admin.id }));

  const income = (billingResult.data || []).filter(entry => entry.status !== "VOID").reduce((sum, entry) => sum + (entry.entry_type === "PAYMENT" || entry.entry_type === "CREDIT" ? -Number(entry.total_amount) : Number(entry.total_amount)), 0);
  const expenses = (expensesResult.data || []).reduce((sum, expense) => sum + Number(expense.total_amount), 0);
  const latestUsage = Array.from(new Map((usageResult.data || []).map(item => [item.tenant_id, item])).values());
  const { data: marketplaceComplaints } = await supabaseAdmin.from("marketplace_complaints").select("*").order("created_at", { ascending: false }).limit(200);
  res.json({ tenants: tenantsResult.data || [], suppliers: suppliersResult.data || [], products: productsResult.data || [], categories: categoriesResult.data || [], licenses: licensesResult.data || [], plans: plansResult.data || [], billingEntries: billingResult.data || [], expenses: expensesResult.data || [], serviceFees: feesResult.data || [], marketplaceComplaints: marketplaceComplaints || [], featuredMemberships: featuredResult.data || [], banners: bannersResult.data || [], marketplaceSettings: marketplaceSettingsResult.data || [], alerts: alertsResult.data || [], audit: auditResult.data || [], usage: latestUsage, users, memberships: memberships || [], metrics: { tenantCount: tenantsResult.data?.length || 0, supplierCount: suppliersResult.data?.length || 0, activeLicenses: (licensesResult.data || []).filter(item => item.status === "ACTIVE").length, pendingReceivables: (billingResult.data || []).filter(item => ["PENDING", "OVERDUE"].includes(item.status)).reduce((sum, item) => sum + Number(item.total_amount), 0), income, expenses, margin: income - expenses } });
});

app.put("/api/superadmin/tenants/:id/license", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const { data: before } = await supabaseAdmin.from("tenant_licenses").select("*").eq("tenant_id", req.params.id).maybeSingle();
  const update: Record<string, unknown> = {};
  for (const [requestKey, databaseKey] of Object.entries({ planId: "plan_id", status: "status", nextDueDate: "next_due_date", endsAt: "ends_at", customMonthlyPrice: "custom_monthly_price", customMaxProjects: "custom_max_projects", customMaxUsers: "custom_max_users", customStorageLimitGb: "custom_storage_limit_gb", customEnabledModules: "custom_enabled_modules", suspensionReason: "suspension_reason" })) if (req.body[requestKey] !== undefined) update[databaseKey] = req.body[requestKey];
  if (req.body.status === "SUSPENDED") { update.suspended_at = new Date().toISOString(); update.suspended_by = admin.id; }
  const { data, error } = await supabaseAdmin.from("tenant_licenses").update(update).eq("tenant_id", req.params.id).select("*,subscription_plans(*)").single();
  if (error) return res.status(400).json({ error: error.message });
  await writeAdminAudit(admin.id, "UPDATE_LICENSE", "tenant_license", req.params.id, before, data);
  res.json(data);
});

app.put("/api/superadmin/users/:id/access", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  if (req.params.id === admin.id) return res.status(400).json({ error: "No puede bloquear su propio usuario" });
  const duration = req.body.blocked ? "876000h" : "none";
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { ban_duration: duration });
  if (error) return res.status(400).json({ error: error.message });
  await writeAdminAudit(admin.id, req.body.blocked ? "BLOCK_USER" : "UNBLOCK_USER", "auth_user", req.params.id, null, { blocked: req.body.blocked });
  res.json({ id: data.user.id, blocked: req.body.blocked });
});

app.post("/api/superadmin/billing", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const vatRate = Number(req.body.taxRate ?? 21); const net = Number(req.body.netAmount); const tax = Number((net * vatRate / 100).toFixed(2));
  const { data, error } = await supabaseAdmin.from("billing_entries").insert({ party_type: req.body.partyType, tenant_id: req.body.partyType === "TENANT" ? req.body.partyId : null, supplier_id: req.body.partyType === "SUPPLIER" ? req.body.partyId : null, entry_type: req.body.entryType, description: req.body.description, currency: req.body.currency, net_amount: net, tax_rate: vatRate, tax_amount: tax, total_amount: net + tax, due_date: req.body.dueDate || null, status: req.body.entryType === "PAYMENT" ? "PAID" : "PENDING", paid_at: req.body.entryType === "PAYMENT" ? new Date().toISOString() : null, notes: req.body.notes || null, created_by: admin.id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  await writeAdminAudit(admin.id, "CREATE_BILLING_ENTRY", "billing_entry", data.id, null, data); res.status(201).json(data);
});

app.put("/api/superadmin/billing/:id/paid", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const { data: before } = await supabaseAdmin.from("billing_entries").select("*").eq("id", req.params.id).single();
  const { data, error } = await supabaseAdmin.from("billing_entries").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message }); await writeAdminAudit(admin.id, "MARK_BILLING_PAID", "billing_entry", req.params.id, before, data); res.json(data);
});

app.post("/api/superadmin/expenses", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const net = Number(req.body.netAmount); const tax = Number(req.body.taxAmount || 0);
  const { data, error } = await supabaseAdmin.from("platform_expenses").insert({ expense_category: req.body.category, supplier_name: req.body.supplierName || null, description: req.body.description, currency: req.body.currency, net_amount: net, tax_amount: tax, total_amount: net + tax, expense_date: req.body.expenseDate, recurring: Boolean(req.body.recurring), recurrence: req.body.recurring ? req.body.recurrence : null, next_renewal_date: req.body.nextRenewalDate || null, notes: req.body.notes || null, created_by: admin.id }).select().single();
  if (error) return res.status(400).json({ error: error.message }); await writeAdminAudit(admin.id, "CREATE_EXPENSE", "platform_expense", data.id, null, data); res.status(201).json(data);
});

app.put("/api/superadmin/products/:id/suspend", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const { data: before } = await supabaseAdmin.from("marketplace_products").select("id,name,status,suspended_reason").eq("id", req.params.id).single();
  const { data, error } = await supabaseAdmin.from("marketplace_products").update({ status: req.body.suspended ? "SUSPENDED" : "ACTIVE", suspended_reason: req.body.suspended ? req.body.reason || "Suspendido por moderación" : null }).eq("id", req.params.id).select("id,name,status,suspended_reason").single();
  if (error) return res.status(400).json({ error: error.message }); await writeAdminAudit(admin.id, req.body.suspended ? "SUSPEND_PRODUCT" : "RESTORE_PRODUCT", "marketplace_product", req.params.id, before, data); res.json(data);
});

app.put("/api/superadmin/suppliers/:id/status", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const status = String(req.body.status || "").toUpperCase();
  if (!["APPROVED", "REJECTED", "SUSPENDED", "PENDING"].includes(status)) return res.status(400).json({ error: "Estado inválido" });
  const { data: before } = await supabaseAdmin.from("supplier_organizations").select("id,approval_status,approval_notes").eq("id", req.params.id).single();
  const { data, error } = await supabaseAdmin.from("supplier_organizations").update({
    approval_status: status,
    approval_notes: req.body.notes || null,
    approved_by: status === "APPROVED" ? admin.id : null,
    approved_at: status === "APPROVED" ? new Date().toISOString() : null
  }).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  await writeAdminAudit(admin.id, `${status}_SUPPLIER`, "supplier_organization", req.params.id, before, data);
  res.json(data);
});

app.post("/api/superadmin/marketplace/memberships", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const cycle = req.body.billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";
  const settingKeys = cycle === "ANNUAL" ? ["featured_membership_annual_monthly_price","featured_membership_vat_rate"] : ["featured_membership_monthly_price","featured_membership_vat_rate"];
  const { data: settings } = await supabaseAdmin.from("platform_settings").select("setting_key,value").in("setting_key", settingKeys);
  const setting = (key: string, fallback: number) => Number((settings || []).find(item => item.setting_key === key)?.value ?? fallback);
  const price = cycle === "ANNUAL" ? setting("featured_membership_annual_monthly_price",5) : setting("featured_membership_monthly_price",10);
  const ends = new Date(); ends.setMonth(ends.getMonth() + (cycle === "ANNUAL" ? 12 : 1));
  const { data, error } = await supabaseAdmin.from("marketplace_featured_memberships").insert({ supplier_id: req.body.supplierId, billing_cycle: cycle, monthly_price: price, currency: "USD", vat_rate: setting("featured_membership_vat_rate",21), current_period_end: ends.toISOString().slice(0,10), status: "ACTIVE", auto_renew: true }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const { data: supplier } = await supabaseAdmin.from("supplier_organizations").select("trade_name,legal_name,store_slug").eq("id", req.body.supplierId).single();
  if (!supplier?.store_slug) { const source = supplier?.trade_name || supplier?.legal_name || req.body.supplierId; const slug = source.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") + "-" + String(req.body.supplierId).slice(0,6); await supabaseAdmin.from("supplier_organizations").update({ store_slug: slug }).eq("id", req.body.supplierId); }
  await writeAdminAudit(admin.id,"CREATE_FEATURED_MEMBERSHIP","marketplace_membership",data.id,null,data); res.status(201).json(data);
});

app.put("/api/superadmin/marketplace/settings", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const allowed = ["featured_membership_monthly_price","featured_membership_annual_monthly_price","featured_membership_max_products","featured_membership_vat_rate"];
  const rows = Object.entries(req.body).filter(([key])=>allowed.includes(key)).map(([setting_key,value])=>({setting_key,value,description:"Configuración Marketplace"}));
  const { data,error } = await supabaseAdmin.from("platform_settings").upsert(rows,{onConflict:"setting_key"}).select(); if(error) return res.status(400).json({error:error.message}); await writeAdminAudit(admin.id,"UPDATE_MARKETPLACE_SETTINGS","platform_settings",undefined,null,rows); res.json(data);
});

app.post("/api/superadmin/marketplace/banners", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const { data,error } = await supabaseAdmin.from("marketplace_banners").insert({ title:req.body.title,subtitle:req.body.subtitle||null,background_color:req.body.backgroundColor||"#0f172a",target_type:req.body.targetType,target_id:req.body.targetId,active:true,sort_order:Number(req.body.sortOrder||0),created_by:admin.id }).select().single(); if(error) return res.status(400).json({error:error.message}); await writeAdminAudit(admin.id,"CREATE_MARKETPLACE_BANNER","marketplace_banner",data.id,null,data); res.status(201).json(data);
});

app.put("/api/superadmin/marketplace/banners/:id", async (req: Request, res: Response) => {
  const admin = await requirePlatformAdmin(req, res); if (!admin || !supabaseAdmin) return;
  const { data,error } = await supabaseAdmin.from("marketplace_banners").update({active:Boolean(req.body.active)}).eq("id",req.params.id).select().single(); if(error) return res.status(400).json({error:error.message}); await writeAdminAudit(admin.id,"UPDATE_MARKETPLACE_BANNER","marketplace_banner",data.id,null,data); res.json(data);
});

app.put("/api/superadmin/marketplace/complaints/:id", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const admin = await requirePlatformAdmin(req, res); if (!admin) return;
  const status = String(req.body.status || ""); if (!["OPEN","UNDER_REVIEW","RESOLVED","REJECTED"].includes(status)) return res.status(400).json({ error: "Estado inválido" });
  const updates: any = { status, admin_notes: req.body.adminNotes || null, resolution: req.body.resolution || null, updated_at: new Date().toISOString() };
  if (["RESOLVED","REJECTED"].includes(status)) { updates.resolved_by = admin.id; updates.resolved_at = new Date().toISOString(); }
  const { data, error } = await supabaseAdmin.from("marketplace_complaints").update(updates).eq("id", req.params.id).select().single(); if (error) return res.status(400).json({ error: error.message });
  await writeAdminAudit(admin.id, "RESOLVE_MARKETPLACE_COMPLAINT", "marketplace_complaint", data.id, null, data); res.json(data);
});

async function findAuthUserByEmail(email: string) {
  if (!supabaseAdmin || !email) return null;
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users as any[]).find(user => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function resolveDatabaseTenantId(localTenantId: string) {
  if (!supabaseAdmin) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(localTenantId)) {
    return localTenantId;
  }
  const tenant = tenants.find(item => item.id === localTenantId);
  if (!tenant?.cuit) return null;
  const { data } = await supabaseAdmin.from("tenants").select("id").eq("tax_id", tenant.cuit).maybeSingle();
  return data?.id || null;
}

async function resolveDatabaseProjectId(localProjectId: string | undefined, databaseTenantId: string) {
  if (!supabaseAdmin || !localProjectId) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(localProjectId)) return localProjectId;
  const localProject = projects.find(project => project.id === localProjectId);
  if (!localProject) return null;
  const { data } = await supabaseAdmin.from("projects").select("id").eq("tenant_id", databaseTenantId).eq("name", localProject.name).maybeSingle();
  return data?.id || null;
}

async function getSupplierForEmail(email: string) {
  if (!supabaseAdmin || !email) return null;
  const authUser = await findAuthUserByEmail(email);
  if (authUser) {
    const { data } = await supabaseAdmin
      .from("supplier_members")
      .select("supplier_id,supplier_organizations(*)")
      .eq("user_id", authUser.id)
      .eq("active", true)
      .maybeSingle();
    if (data?.supplier_organizations) return data.supplier_organizations;
  }
  const { data } = await supabaseAdmin
    .from("supplier_organizations")
    .select("*")
    .ilike("contact_email", email)
    .maybeSingle();
  return data || null;
}

async function calculateMarketplaceFee(operationType: "DIRECT_PURCHASE" | "TENDER_AWARD", amount: number, currency: "ARS" | "USD") {
  if (!supabaseAdmin) throw new Error("Supabase no está configurado");
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("marketplace_fee_rules")
    .select("percentage")
    .eq("operation_type", operationType)
    .eq("active", true)
    .lte("minimum_amount", amount)
    .or(`maximum_amount.is.null,maximum_amount.gt.${amount}`)
    .or(`currency.is.null,currency.eq.${currency}`)
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .order("minimum_amount", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const percentage = Number(data?.percentage ?? (operationType === "DIRECT_PURCHASE" ? 1 : 0.5));
  return { percentage, feeAmount: Number((amount * percentage / 100).toFixed(2)) };
}

app.post("/api/marketplace/public/register-buyer", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Debe confirmar su cuenta para continuar" });
  const [{ data: existingTenant }, { data: existingSupplier }] = await Promise.all([
    supabaseAdmin.from("tenant_members").select("tenant_id").eq("user_id", user.id).eq("active", true).maybeSingle(),
    supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", user.id).eq("active", true).maybeSingle()
  ]);
  if (existingTenant || existingSupplier) return res.status(409).json({ error: "El usuario ya pertenece a una organización" });
  const companyName = String(req.body.companyName || "").trim(); const taxId = String(req.body.taxId || "").trim(); if (companyName.length < 2 || taxId.length < 7) return res.status(400).json({ error: "Complete empresa y CUIT" });
  const { data: plan } = await supabaseAdmin.from("subscription_plans").select("id").eq("code", "MARKETPLACE_BUYER").eq("active", true).single(); if (!plan) return res.status(503).json({ error: "El plan Comprador Marketplace no está disponible" });
  const { data: tenant, error: tenantError } = await supabaseAdmin.from("tenants").insert({ name: companyName, legal_name: req.body.legalName || companyName, tax_id: taxId, default_currency: req.body.currency || "ARS", phone: req.body.phone || null, legal_address: req.body.address || null, commercial_address: req.body.address || null, company_type: "MARKETPLACE_BUYER", created_by: user.id }).select().single(); if (tenantError) return res.status(400).json({ error: tenantError.message });
  const { error: memberError } = await supabaseAdmin.from("tenant_members").insert({ tenant_id: tenant.id, user_id: user.id, role: "owner", active: true }); if (memberError) { await supabaseAdmin.from("tenants").delete().eq("id", tenant.id); return res.status(400).json({ error: memberError.message }); }
  const dueDate = new Date(); dueDate.setFullYear(dueDate.getFullYear() + 10);
  const { error: licenseError } = await supabaseAdmin.from("tenant_licenses").insert({ tenant_id: tenant.id, plan_id: plan.id, status: "ACTIVE", starts_at: new Date().toISOString().slice(0,10), next_due_date: dueDate.toISOString().slice(0,10) }); if (licenseError) { await supabaseAdmin.from("tenants").delete().eq("id", tenant.id); return res.status(400).json({ error: licenseError.message }); }
  res.status(201).json({ tenantId: tenant.id, environment: "MARKETPLACE_BUYER" });
});

app.get("/api/marketplace/public/catalog", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req);
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(48, Math.max(6, Number(req.query.pageSize || 12)));
  const search = String(req.query.search || "").trim().replace(/[,%()]/g, " ");
  const category = String(req.query.category || "");
  const currency = String(req.query.currency || "");
  const publicationType = String(req.query.type || "");
  const sort = String(req.query.sort || "featured");
  let query = supabaseAdmin.from("marketplace_products").select("id,name,description,brand,model,sale_unit,currency,base_price,price_on_request,vat_included,stock_quantity,minimum_quantity,delivery_lead_days,location,financing_available,delivery_methods,status,view_count,sold_count,publication_type,service_available,service_people_capacity,service_hours_per_day,published_at,expires_at,category_id,marketplace_categories(id,name,code),supplier_organizations!inner(id,legal_name,trade_name,city,province,rating,review_count,identity_verified,completed_operations,average_response_minutes,approval_status,store_slug),marketplace_product_media(id,storage_path,sort_order)", { count: "exact" })
    .eq("status", "ACTIVE").eq("supplier_organizations.approval_status", "APPROVED").gt("expires_at", new Date().toISOString());
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,brand.ilike.%${search}%`);
  if (category) query = query.eq("category_id", category);
  if (["ARS", "USD"].includes(currency)) query = query.eq("currency", currency);
  if (["PRODUCT", "SERVICE"].includes(publicationType)) query = query.eq("publication_type", publicationType);
  if (sort === "price_asc") query = query.order("base_price", { ascending: true, nullsFirst: false });
  else if (sort === "price_desc") query = query.order("base_price", { ascending: false, nullsFirst: false });
  else if (sort === "best_selling") query = query.order("sold_count", { ascending: false });
  else if (sort === "newest") query = query.order("published_at", { ascending: false });
  else query = query.order("sold_count", { ascending: false }).order("published_at", { ascending: false });
  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return res.status(400).json({ error: error.message });
  const products = (data || []).map((product: any) => {
    const media = (product.marketplace_product_media || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    return { ...product, base_price: user ? product.base_price : null, price_locked: !user, image_url: media[0]?.storage_path ? `/api/marketplace/v2/media?path=${encodeURIComponent(media[0].storage_path)}` : null, marketplace_product_media: undefined };
  });
  const [{ data: categories }, bannersResult] = await Promise.all([
    supabaseAdmin.from("marketplace_categories").select("id,parent_id,code,name").eq("active", true).order("sort_order"),
    supabaseAdmin.from("marketplace_banners").select("*").eq("active", true).order("sort_order")
  ]);
  res.json({ products, categories: categories || [], banners: bannersResult.data || [], authenticated: Boolean(user), page, pageSize, total: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)) });
});

app.get("/api/marketplace/public/products/:id", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req);
  const { data, error } = await supabaseAdmin.from("marketplace_products").select("*,marketplace_categories(id,name,code),supplier_organizations!inner(id,legal_name,trade_name,city,province,rating,review_count,identity_verified,completed_operations,average_response_minutes,approval_status,store_slug),marketplace_product_variants(*),marketplace_product_media(*)").eq("id", req.params.id).eq("status", "ACTIVE").eq("supplier_organizations.approval_status", "APPROVED").single();
  if (error || !data) return res.status(404).json({ error: "Publicación no disponible" });
  const media = (data.marketplace_product_media || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => ({ ...item, url: `/api/marketplace/v2/media?path=${encodeURIComponent(item.storage_path)}` }));
  res.json({ ...data, base_price: user ? data.base_price : null, financing_details: user ? data.financing_details : null, payment_methods: user ? data.payment_methods : [], price_locked: !user, marketplace_product_media: media });
});

app.get("/api/marketplace/public/products/:id/questions", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const { data, error } = await supabaseAdmin.from("marketplace_public_questions").select("id,question,answer,answered_at,created_at").eq("product_id", req.params.id).is("hidden_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message }); res.json(data || []);
});

app.get("/api/marketplace/public/stores/:slug", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req);
  const { data: supplier, error } = await supabaseAdmin.from("supplier_organizations").select("id,legal_name,trade_name,company_description,city,province,store_slug,store_logo_path,store_banner_path,rating,review_count,identity_verified,completed_operations,average_response_minutes,approval_status").eq("store_slug", req.params.slug).eq("approval_status", "APPROVED").single();
  if (error || !supplier) return res.status(404).json({ error: "Tienda no disponible" });
  const { data: membership } = await supabaseAdmin.from("marketplace_featured_memberships").select("id,status,current_period_end").eq("supplier_id", supplier.id).eq("status", "ACTIVE").gte("current_period_end", new Date().toISOString().slice(0, 10)).maybeSingle();
  if (!membership) return res.status(404).json({ error: "La tienda no tiene una membresía activa" });
  const { data: featured } = await supabaseAdmin.from("marketplace_featured_products").select("product_id,sort_order").eq("membership_id", membership.id).order("sort_order");
  const { data: products } = await supabaseAdmin.from("marketplace_products").select("id,name,description,brand,currency,base_price,price_on_request,vat_included,stock_quantity,publication_type,category_id,marketplace_categories(name),marketplace_product_media(storage_path,sort_order)").eq("supplier_id", supplier.id).eq("status", "ACTIVE").gt("expires_at", new Date().toISOString()).order("published_at", { ascending: false });
  const featuredIds = new Set((featured || []).map(item => item.product_id));
  res.json({ supplier, membership, products: (products || []).map((product: any) => { const media = (product.marketplace_product_media || []).sort((a: any,b: any)=>a.sort_order-b.sort_order); return { ...product, base_price: user ? product.base_price : null, price_locked: !user, featured: featuredIds.has(product.id), image_url: media[0]?.storage_path ? `/api/marketplace/v2/media?path=${encodeURIComponent(media[0].storage_path)}` : null, marketplace_product_media: undefined }; }).sort((a: any,b: any)=>Number(b.featured)-Number(a.featured)) });
});

app.get("/api/marketplace/public/tenders", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req);
  if (!user) return res.status(401).json({ error: "Debe iniciar sesión como proveedor aprobado" });
  const { data: membership } = await supabaseAdmin.from("supplier_members").select("supplier_id,supplier_organizations(approval_status)").eq("user_id", user.id).eq("active", true).maybeSingle();
  const organization: any = Array.isArray(membership?.supplier_organizations) ? membership?.supplier_organizations[0] : membership?.supplier_organizations;
  if (!membership || organization?.approval_status !== "APPROVED") return res.status(403).json({ error: "Las licitaciones son exclusivas para proveedores aprobados" });
  const page = Math.max(1, Number(req.query.page || 1)); const pageSize = 12;
  const { data, error, count } = await supabaseAdmin.from("marketplace_tenders").select("id,title,description,process_type,visibility,scope_type,status,opening_at,closes_at,created_at,tenants(name),marketplace_tender_lines(id)", { count: "exact" }).eq("visibility", "PUBLIC").in("status", ["PUBLISHED","QUESTIONS","CLOSED","AWARDED"]).order("closes_at").range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return res.status(400).json({ error: error.message });
  const tenderIds = (data || []).map((item: any) => item.id);
  const submissionResult = tenderIds.length ? await supabaseAdmin.from("marketplace_submissions").select("tender_id,supplier_id").in("tender_id", tenderIds) : { data: [] as any[] };
  res.json({ tenders: (data || []).map((tender: any) => ({ ...tender, participant_count: new Set((submissionResult.data || []).filter((s: any) => s.tender_id === tender.id).map((s: any) => s.supplier_id)).size })), page, total: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)) });
});

app.post("/api/marketplace/v2/checkout", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req);
  const tenantId = (req as Request & { authTenantId?: string }).authTenantId;
  if (!user || !tenantId) return res.status(403).json({ error: "La compra requiere una organización validada" });
  try {
    const projectId = req.body.projectId ? await resolveDatabaseProjectId(req.body.projectId, tenantId) : null;
    const budgetLineId = req.body.budgetLineId && /^[0-9a-f-]{36}$/i.test(req.body.budgetLineId) ? req.body.budgetLineId : null;
    const { data, error } = await supabaseAdmin.rpc("confirm_marketplace_purchase", {
      p_requested_by: user.id,
      p_tenant_id: tenantId,
      p_project_id: projectId,
      p_budget_line_id: budgetLineId,
      p_delivery_location: req.body.deliveryLocation || null,
      p_required_date: req.body.requiredDate || null,
      p_payment_terms: req.body.paymentTerms || null,
      p_notes: req.body.notes || null,
      p_items: req.body.items || []
    });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo confirmar la compra" }); }
});

app.get("/api/marketplace/v2/favorites", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" }); const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const { data, error } = await supabaseAdmin.from("marketplace_favorites").select("id,favorite_type,product_id,supplier_id,created_at").eq("user_id", user.id); if (error) return res.status(400).json({ error: error.message }); res.json(data || []);
});

app.post("/api/marketplace/v2/favorites/toggle", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" }); const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const type = String(req.body.type || "").toUpperCase(); if (!["PRODUCT","SUPPLIER"].includes(type)) return res.status(400).json({ error: "Favorito inválido" });
  let query = supabaseAdmin.from("marketplace_favorites").select("id").eq("user_id", user.id).eq("favorite_type", type); query = type === "PRODUCT" ? query.eq("product_id", req.body.id) : query.eq("supplier_id", req.body.id); const { data: existing } = await query.maybeSingle();
  if (existing) { await supabaseAdmin.from("marketplace_favorites").delete().eq("id", existing.id); return res.json({ favorite: false }); }
  const { error } = await supabaseAdmin.from("marketplace_favorites").insert({ user_id: user.id, favorite_type: type, product_id: type === "PRODUCT" ? req.body.id : null, supplier_id: type === "SUPPLIER" ? req.body.id : null }); if (error) return res.status(400).json({ error: error.message }); res.json({ favorite: true });
});

app.post("/api/marketplace/v2/products/:id/questions", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" }); const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const question = String(req.body.question || "").trim(); if (question.length < 5) return res.status(400).json({ error: "La consulta es demasiado breve" });
  if (/(\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(question)) return res.status(400).json({ error: "No se permiten teléfonos ni correos en las consultas" });
  const { data, error } = await supabaseAdmin.from("marketplace_public_questions").insert({ product_id: req.params.id, asked_by: user.id, question }).select("id,question,created_at").single(); if (error) return res.status(400).json({ error: error.message }); res.status(201).json(data);
});

app.get("/api/marketplace/v2/notifications", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" }); const user=await getRequestAuthUser(req); if(!user)return res.status(401).json({error:"Sesión requerida"});
  const {data,error}=await supabaseAdmin.from("marketplace_notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100); if(error)return res.status(400).json({error:error.message}); res.json({notifications:data||[],unread:(data||[]).filter(item=>!item.read_at).length});
});

app.put("/api/marketplace/v2/notifications/:id/read", async (req: Request, res: Response) => {
  if(!supabaseAdmin)return res.status(503).json({error:"Supabase no está configurado"}); const user=await getRequestAuthUser(req); if(!user)return res.status(401).json({error:"Sesión requerida"}); const {data,error}=await supabaseAdmin.from("marketplace_notifications").update({read_at:new Date().toISOString()}).eq("id",req.params.id).eq("user_id",user.id).select().single(); if(error)return res.status(400).json({error:error.message}); res.json(data);
});

app.put("/api/marketplace/v2/notifications/read-all", async (req: Request, res: Response) => {
  if(!supabaseAdmin)return res.status(503).json({error:"Supabase no está configurado"}); const user=await getRequestAuthUser(req); if(!user)return res.status(401).json({error:"Sesión requerida"}); const {error}=await supabaseAdmin.from("marketplace_notifications").update({read_at:new Date().toISOString()}).eq("user_id",user.id).is("read_at",null); if(error)return res.status(400).json({error:error.message}); res.json({ok:true});
});

app.put("/api/marketplace/v2/supplier/store", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" }); const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const { data: member } = await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", user.id).eq("active", true).maybeSingle(); if (!member) return res.status(403).json({ error: "Acceso exclusivo de proveedor" });
  const slug = String(req.body.slug || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); if (slug.length < 3) return res.status(400).json({ error: "El identificador de tienda es inválido" });
  const updates = {
    store_slug: slug,
    trade_name: String(req.body.tradeName || "").trim() || null,
    company_description: String(req.body.description || "").trim() || null,
    city: String(req.body.city || "").trim() || null,
    province: String(req.body.province || "").trim() || null
  };
  const { data, error } = await supabaseAdmin.from("supplier_organizations").update(updates).eq("id", member.supplier_id).select("id,store_slug,trade_name,company_description,city,province").single(); if (error) return res.status(400).json({ error: error.message }); res.json(data);
});

app.put("/api/marketplace/v2/questions/:id/answer", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const { data: member } = await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", user.id).eq("active", true).maybeSingle(); if (!member) return res.status(403).json({ error: "Acceso exclusivo de proveedor" });
  const answer = String(req.body.answer || "").trim(); if (answer.length < 2) return res.status(400).json({ error: "Debe escribir una respuesta" });
  if (/(\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(answer)) return res.status(400).json({ error: "No se permiten teléfonos ni correos en las respuestas" });
  const { data: question } = await supabaseAdmin.from("marketplace_public_questions").select("id,marketplace_products!inner(supplier_id)").eq("id", req.params.id).single();
  const product: any = Array.isArray(question?.marketplace_products) ? question?.marketplace_products[0] : question?.marketplace_products;
  if (!question || product?.supplier_id !== member.supplier_id) return res.status(403).json({ error: "La consulta no pertenece a su empresa" });
  const { data, error } = await supabaseAdmin.from("marketplace_public_questions").update({ answer, answered_by: user.id, answered_at: new Date().toISOString() }).eq("id", req.params.id).select("id,answer,answered_at").single();
  if (error) return res.status(400).json({ error: error.message }); res.json(data);
});

app.put("/api/marketplace/v2/featured-products/:productId", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const { data: member } = await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", user.id).eq("active", true).maybeSingle(); if (!member) return res.status(403).json({ error: "Acceso exclusivo de proveedor" });
  const { data: product } = await supabaseAdmin.from("marketplace_products").select("id,supplier_id,status").eq("id", req.params.productId).single(); if (!product || product.supplier_id !== member.supplier_id) return res.status(403).json({ error: "La publicación no pertenece a su empresa" });
  const { data: membership } = await supabaseAdmin.from("marketplace_featured_memberships").select("id").eq("supplier_id", member.supplier_id).eq("status", "ACTIVE").gte("current_period_end", new Date().toISOString().slice(0,10)).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (!membership) return res.status(403).json({ error: "Necesita una membresía destacada activa" });
  if (!req.body.featured) { await supabaseAdmin.from("marketplace_featured_products").delete().eq("membership_id", membership.id).eq("product_id", product.id); return res.json({ featured: false }); }
  const { data: setting } = await supabaseAdmin.from("platform_settings").select("value").eq("setting_key", "featured_membership_max_products").maybeSingle(); const maximum = Number(setting?.value || 10);
  const { count } = await supabaseAdmin.from("marketplace_featured_products").select("product_id", { count: "exact", head: true }).eq("membership_id", membership.id); if ((count || 0) >= maximum) return res.status(400).json({ error: `Puede destacar hasta ${maximum} publicaciones` });
  const { error } = await supabaseAdmin.from("marketplace_featured_products").upsert({ membership_id: membership.id, product_id: product.id, sort_order: count || 0 }); if (error) return res.status(400).json({ error: error.message }); res.json({ featured: true });
});

app.get("/api/marketplace/v2/context", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    const localTenantId = String(req.query.tenantId || "");
    const supplier = await getSupplierForEmail(email);
    const tenantId = await resolveDatabaseTenantId(localTenantId);
    const isSuperAdmin = email === MARKETPLACE_SUPERADMIN_EMAIL;

    await supabaseAdmin.from("marketplace_products").update({ status: "ARCHIVED" }).eq("status", "ACTIVE").lt("expires_at", new Date().toISOString());

    await supabaseAdmin
      .from("marketplace_tenders")
      .update({ status: "CLOSED" })
      .in("status", ["PUBLISHED", "QUESTIONS"])
      .lt("closes_at", new Date().toISOString());

    const [categoriesResult, productsResult, tendersResult, suppliersResult] = await Promise.all([
      supabaseAdmin.from("marketplace_categories").select("*").order("sort_order"),
      supabaseAdmin.from("marketplace_products").select("*,supplier_organizations(legal_name,trade_name,approval_status),marketplace_product_variants(*),marketplace_product_media(*)").order("created_at", { ascending: false }),
      supabaseAdmin.from("marketplace_tenders").select("*,tenants(name),projects(name),marketplace_tender_lines(*),marketplace_tender_requirements(*)").order("created_at", { ascending: false }),
      supabaseAdmin.from("supplier_organizations").select("*").order("created_at", { ascending: false })
    ]);
    const firstError = categoriesResult.error || productsResult.error || tendersResult.error || suppliersResult.error;
    if (firstError) return res.status(500).json({ error: firstError.message });

    let directRequests: any[] = [];
    if (supplier || tenantId) {
      let query = supabaseAdmin.from("marketplace_direct_requests").select("*,marketplace_direct_request_items(*,marketplace_products(name,sale_unit))").order("created_at", { ascending: false });
      query = supplier ? query.eq("supplier_id", supplier.id) : query.eq("tenant_id", tenantId);
      const result = await query;
      directRequests = result.data || [];
    }

    let submissions: any[] = [];
    if (supplier || tenantId) {
      let query = supabaseAdmin.from("marketplace_submissions").select("*,supplier_organizations(legal_name,trade_name),marketplace_submission_lines(*),marketplace_tenders(tenant_id,process_type,status)");
      if (supplier) query = query.eq("supplier_id", supplier.id);
      const result = await query;
      submissions = (result.data || []).filter((submission: any) => supplier || submission.marketplace_tenders?.tenant_id === tenantId);
    }
    let supplierQuestions: any[] = [];
    let featuredMembership: any = null;
    let featuredProductIds: string[] = [];
    if (supplier) {
      const [questionsResult, membershipResult] = await Promise.all([
        supabaseAdmin.from("marketplace_public_questions").select("id,product_id,question,answer,answered_at,created_at,marketplace_products!inner(name,supplier_id)").eq("marketplace_products.supplier_id", supplier.id).is("hidden_at", null).order("created_at", { ascending: false }),
        supabaseAdmin.from("marketplace_featured_memberships").select("*").eq("supplier_id", supplier.id).eq("status", "ACTIVE").gte("current_period_end", new Date().toISOString().slice(0, 10)).order("created_at", { ascending: false }).limit(1).maybeSingle()
      ]);
      supplierQuestions = questionsResult.data || [];
      featuredMembership = membershipResult.data || null;
      if (featuredMembership) {
        const { data: featuredRows } = await supabaseAdmin.from("marketplace_featured_products").select("product_id").eq("membership_id", featuredMembership.id);
        featuredProductIds = (featuredRows || []).map(row => row.product_id);
      }
    }
    let feeRules: any[] = [];
    let serviceFees: any[] = [];
    if (isSuperAdmin) {
      const [rulesResult, feesResult] = await Promise.all([
        supabaseAdmin.from("marketplace_fee_rules").select("*").order("operation_type").order("minimum_amount"),
        supabaseAdmin.from("marketplace_service_fees").select("*,supplier_organizations(legal_name,trade_name),tenants(name)").order("calculated_at", { ascending: false }).limit(100)
      ]);
      feeRules = rulesResult.data || [];
      serviceFees = feesResult.data || [];
    }

    let visibleTenders = tendersResult.data || [];
    if (supplier && !isSuperAdmin) {
      const { data: invites } = await supabaseAdmin.from("marketplace_tender_invites").select("tender_id").eq("supplier_id", supplier.id);
      const invitedIds = new Set((invites || []).map(invite => invite.tender_id));
      const supplierCategoryIds = new Set(supplier.category_ids || []);
      const limitedTenderIds = new Set<string>();
      if (supplierCategoryIds.size) {
        const { data: tenderCategories } = await supabaseAdmin.from("marketplace_tender_categories").select("tender_id,category_id").in("category_id", Array.from(supplierCategoryIds));
        (tenderCategories || []).forEach(item => limitedTenderIds.add(item.tender_id));
      }
      visibleTenders = visibleTenders.filter((tender: any) => tender.visibility === "PUBLIC" || invitedIds.has(tender.id) || (tender.visibility === "LIMITED" && limitedTenderIds.has(tender.id)));
    } else if (!supplier && !tenantId && !isSuperAdmin) {
      visibleTenders = visibleTenders.filter((tender: any) => tender.visibility === "PUBLIC");
    }

    res.json({
      isSuperAdmin,
      supplier,
      suppliers: suppliersResult.data || [],
      databaseTenantId: tenantId,
      categories: categoriesResult.data || [],
      products: productsResult.data || [],
      tenders: visibleTenders,
      directRequests,
      submissions,
      feeRules,
      serviceFees
      ,supplierQuestions
      ,featuredMembership
      ,featuredProductIds
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo cargar el Marketplace" });
  }
});

app.post("/api/marketplace/v2/products", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  try {
    const { email, variants = [], ...product } = req.body;
    const supplier = await getSupplierForEmail(String(email || ""));
    if (!supplier) return res.status(403).json({ error: "No existe un perfil proveedor para este usuario" });
    if (supplier.approval_status !== "APPROVED") return res.status(403).json({ error: "El proveedor todavía no fue aprobado" });
    const { data, error } = await supabaseAdmin.from("marketplace_products").insert({
      supplier_id: supplier.id,
      category_id: product.categoryId,
      name: product.name,
      description: product.description,
      publication_type: product.publicationType || "PRODUCT",
      brand: product.brand || null,
      model: product.model || null,
      sale_unit: product.saleUnit,
      currency: product.currency,
      base_price: product.priceOnRequest ? null : Number(product.basePrice),
      price_on_request: Boolean(product.priceOnRequest),
      vat_included: Boolean(product.vatIncluded),
      stock_quantity: product.publicationType === "SERVICE" || product.stockQuantity === "" ? null : Number(product.stockQuantity),
      service_available: product.publicationType === "SERVICE" ? Boolean(product.serviceAvailable) : true,
      service_people_capacity: product.publicationType === "SERVICE" ? Number(product.servicePeopleCapacity || 1) : null,
      service_hours_per_day: product.publicationType === "SERVICE" ? Number(product.serviceHoursPerDay || 8) : null,
      minimum_quantity: Number(product.minimumQuantity || 1),
      delivery_lead_days: product.deliveryLeadDays ? Number(product.deliveryLeadDays) : null,
      location: product.location || null,
      financing_available: Boolean(product.financingAvailable),
      financing_details: product.financingDetails || null,
      payment_methods: product.paymentMethods || [],
      delivery_methods: product.deliveryMethods || [],
      status: "ACTIVE",
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    if (variants.length) {
      const { error: variantError } = await supabaseAdmin.from("marketplace_product_variants").insert(
        variants.map((variant: any) => ({
          product_id: data.id,
          name: variant.name,
          sku: variant.sku || null,
          attributes: variant.attributes || {},
          price: variant.price ? Number(variant.price) : null,
          stock_quantity: variant.stockQuantity ? Number(variant.stockQuantity) : null
        }))
      );
      if (variantError) return res.status(400).json({ error: variantError.message });
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo publicar el producto" });
  }
});

app.post("/api/marketplace/v2/products/:id/media", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  try {
    const supplier = await getSupplierForEmail(req.body.email);
    if (!supplier) return res.status(403).json({ error: "Acceso denegado" });
    const { data: product } = await supabaseAdmin.from("marketplace_products").select("supplier_id").eq("id", req.params.id).single();
    if (!product || product.supplier_id !== supplier.id) return res.status(403).json({ error: "El producto no pertenece a este proveedor" });
    const mimeType = String(req.body.mimeType || "");
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
    const isTechnicalSheet = Boolean(req.body.technicalSheet);
    if ((!isImage && !(isTechnicalSheet && mimeType === "application/pdf")) || !req.body.base64) return res.status(400).json({ error: "Formato de archivo no admitido" });
    const buffer = Buffer.from(req.body.base64, "base64");
    const maxSize = isTechnicalSheet ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!buffer.length || buffer.length > maxSize) return res.status(400).json({ error: `El archivo supera el límite de ${isTechnicalSheet ? 10 : 2} MB` });
    if (!isTechnicalSheet) {
      const { count } = await supabaseAdmin.from("marketplace_product_media").select("id", { count: "exact", head: true }).eq("product_id", req.params.id);
      if ((count || 0) >= 5) return res.status(400).json({ error: "El producto ya tiene el máximo de cinco imágenes" });
    }
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const bucket = isTechnicalSheet ? "marketplace-supplier-documents" : "marketplace-product-media";
    const storagePath = `${supplier.id}/products/${req.params.id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, { contentType: mimeType });
    if (uploadError) return res.status(400).json({ error: uploadError.message });
    if (isTechnicalSheet) {
      const { error } = await supabaseAdmin.from("marketplace_products").update({ technical_sheet_path: storagePath, technical_sheet_mime: mimeType }).eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
    } else {
      const { count } = await supabaseAdmin.from("marketplace_product_media").select("id", { count: "exact", head: true }).eq("product_id", req.params.id);
      const { error } = await supabaseAdmin.from("marketplace_product_media").insert({ product_id: req.params.id, storage_path: storagePath, mime_type: mimeType, file_size: buffer.length, sort_order: count || 0 });
      if (error) return res.status(400).json({ error: error.message });
    }
    res.status(201).json({ storagePath });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo guardar el archivo" });
  }
});

app.get("/api/marketplace/v2/media", async (req: Request, res: Response) => {
  if (!supabaseAdmin || !req.query.path) return res.status(404).end();
  const { data, error } = await supabaseAdmin.storage.from("marketplace-product-media").download(String(req.query.path));
  if (error || !data) return res.status(404).end();
  res.setHeader("Content-Type", data.type || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(Buffer.from(await data.arrayBuffer()));
});

app.put("/api/marketplace/v2/products/:id/status", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const email = String(req.body.email || "").toLowerCase();
  const supplier = await getSupplierForEmail(email);
  const allowed = ["ACTIVE", "PAUSED", "SUSPENDED", "ARCHIVED"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Estado inválido" });
  const update: Record<string, unknown> = { status: req.body.status, suspended_reason: req.body.reason || null };
  if (req.body.republish && req.body.status === "ACTIVE") {
    update.published_at = new Date().toISOString();
    update.last_republished_at = new Date().toISOString();
    update.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  let query = supabaseAdmin.from("marketplace_products").update(update).eq("id", req.params.id);
  if (email !== MARKETPLACE_SUPERADMIN_EMAIL) {
    if (!supplier) return res.status(403).json({ error: "Acceso denegado" });
    query = query.eq("supplier_id", supplier.id);
  }
  const { data, error } = await query.select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.put("/api/marketplace/v2/products/:id", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const authUser = await getRequestAuthUser(req);
  if (!authUser) return res.status(401).json({ error: "Sesión requerida" });
  const { data: supplierMember } = await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", authUser.id).eq("active", true).maybeSingle();
  if (!supplierMember) return res.status(403).json({ error: "Acceso exclusivo de proveedor" });
  const allowedFields: Record<string, unknown> = {
    name: req.body.name,
    description: req.body.description,
    publication_type: req.body.publicationType || "PRODUCT",
    category_id: req.body.categoryId,
    brand: req.body.brand || null,
    model: req.body.model || null,
    sale_unit: req.body.saleUnit,
    currency: req.body.currency,
    base_price: req.body.priceOnRequest ? null : Number(req.body.basePrice),
    price_on_request: Boolean(req.body.priceOnRequest),
    vat_included: Boolean(req.body.vatIncluded),
    stock_quantity: req.body.publicationType === "SERVICE" || req.body.stockQuantity === "" ? null : Number(req.body.stockQuantity),
    service_available: req.body.publicationType === "SERVICE" ? Boolean(req.body.serviceAvailable) : true,
    service_people_capacity: req.body.publicationType === "SERVICE" ? Number(req.body.servicePeopleCapacity || 1) : null,
    service_hours_per_day: req.body.publicationType === "SERVICE" ? Number(req.body.serviceHoursPerDay || 8) : null,
    minimum_quantity: Number(req.body.minimumQuantity || 1),
    delivery_lead_days: req.body.deliveryLeadDays ? Number(req.body.deliveryLeadDays) : null,
    location: req.body.location || null,
    financing_available: Boolean(req.body.financingAvailable),
    financing_details: req.body.financingDetails || null,
    payment_methods: req.body.paymentMethods || [],
    delivery_methods: req.body.deliveryMethods || []
  };
  const { data, error } = await supabaseAdmin.from("marketplace_products").update(allowedFields).eq("id", req.params.id).eq("supplier_id", supplier.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.put("/api/marketplace/v2/suppliers/:id/status", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  if (String(req.body.email || "").toLowerCase() !== MARKETPLACE_SUPERADMIN_EMAIL) return res.status(403).json({ error: "Acceso exclusivo de superadmin" });
  if (!["APPROVED", "REJECTED", "SUSPENDED", "PENDING"].includes(req.body.status)) return res.status(400).json({ error: "Estado inválido" });
  const admin = await findAuthUserByEmail(req.body.email);
  const { data, error } = await supabaseAdmin.from("supplier_organizations").update({ approval_status: req.body.status, approval_notes: req.body.notes || null, approved_by: req.body.status === "APPROVED" ? admin?.id || null : null, approved_at: req.body.status === "APPROVED" ? new Date().toISOString() : null }).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post("/api/marketplace/v2/categories", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  if (String(req.body.email || "").toLowerCase() !== MARKETPLACE_SUPERADMIN_EMAIL) return res.status(403).json({ error: "Acceso exclusivo de superadmin" });
  const { data, error } = await supabaseAdmin.from("marketplace_categories").insert({ code: req.body.code, name: req.body.name, description: req.body.description || null, parent_id: req.body.parentId || null, sort_order: Number(req.body.sortOrder || 0) }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.post("/api/marketplace/v2/fee-rules", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  if (String(req.body.email || "").toLowerCase() !== MARKETPLACE_SUPERADMIN_EMAIL) return res.status(403).json({ error: "Acceso exclusivo de superadmin" });
  const admin = await findAuthUserByEmail(req.body.email);
  const { data, error } = await supabaseAdmin.from("marketplace_fee_rules").insert({ operation_type: req.body.operationType, minimum_amount: Number(req.body.minimumAmount || 0), maximum_amount: req.body.maximumAmount === "" || req.body.maximumAmount == null ? null : Number(req.body.maximumAmount), percentage: Number(req.body.percentage), currency: req.body.currency || null, active: true, created_by: admin?.id || null }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.put("/api/marketplace/v2/fee-rules/:id", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  if (String(req.body.email || "").toLowerCase() !== MARKETPLACE_SUPERADMIN_EMAIL) return res.status(403).json({ error: "Acceso exclusivo de superadmin" });
  const { data, error } = await supabaseAdmin.from("marketplace_fee_rules").update({ active: Boolean(req.body.active) }).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post("/api/marketplace/v2/direct-requests", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  try {
    const tenantId = await resolveDatabaseTenantId(req.body.tenantId);
    const user = await findAuthUserByEmail(req.body.email);
    if (!tenantId || !user) return res.status(400).json({ error: "No se pudo identificar empresa o usuario" });
    const projectId = await resolveDatabaseProjectId(req.body.projectId, tenantId);
    const { items = [], ...request } = req.body;
    const { data, error } = await supabaseAdmin.from("marketplace_direct_requests").insert({
      tenant_id: tenantId,
      project_id: projectId,
      supplier_id: request.supplierId,
      requested_by: user.id,
      currency: request.currency,
      delivery_location: request.deliveryLocation || null,
      payment_terms: request.paymentTerms || null,
      notes: request.notes || null
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    const { error: itemsError } = await supabaseAdmin.from("marketplace_direct_request_items").insert(items.map((item: any) => ({
      request_id: data.id,
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: Number(item.quantity),
      unit_price: item.unitPrice == null ? null : Number(item.unitPrice)
    })));
    if (itemsError) return res.status(400).json({ error: itemsError.message });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo crear la solicitud" });
  }
});

app.put("/api/marketplace/v2/direct-requests/:id/respond", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const supplier = await getSupplierForEmail(req.body.email);
  if (!supplier) return res.status(403).json({ error: "Acceso denegado" });
  if (!["ACCEPTED", "REJECTED", "CHANGES_PROPOSED"].includes(req.body.status)) return res.status(400).json({ error: "Respuesta inválida" });
  const proposedItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (req.body.status === "CHANGES_PROPOSED" && !String(req.body.response || "").trim() && !proposedItems.length) return res.status(400).json({ error: "Debe detallar la contrapropuesta" });
  for (const item of proposedItems) {
    const price = Number(item.proposedUnitPrice);
    if (!item.id || !Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Hay precios propuestos inválidos" });
    await supabaseAdmin.from("marketplace_direct_request_items").update({ proposed_unit_price: price }).eq("id", item.id).eq("request_id", req.params.id);
  }
  const { data, error } = await supabaseAdmin.from("marketplace_direct_requests").update({ status: req.body.status, supplier_response: req.body.response || null, last_action_by: authUser.id, last_action_at: new Date().toISOString() }).eq("id", req.params.id).eq("supplier_id", supplierMember.supplier_id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  await supabaseAdmin.from("marketplace_direct_request_events").insert({ request_id: data.id, actor_id: authUser.id, actor_type: "SUPPLIER", event_type: req.body.status, message: req.body.response || null, proposed_items: proposedItems.length ? proposedItems : null });
  await supabaseAdmin.from("marketplace_notifications").insert({ user_id: data.requested_by, notification_type: `DIRECT_REQUEST_${req.body.status}`, title: "El proveedor respondió su solicitud", message: req.body.status === "CHANGES_PROPOSED" ? "Recibió una contrapropuesta para revisar" : `La solicitud fue ${req.body.status === "ACCEPTED" ? "aceptada" : "rechazada"}`, entity_type: "DIRECT_REQUEST", entity_id: data.id });
  if (req.body.status === "ACCEPTED") {
    const { data: items } = await supabaseAdmin.from("marketplace_direct_request_items").select("quantity,unit_price,proposed_unit_price").eq("request_id", req.params.id);
    const taxableAmount = (items || []).reduce((total, item) => total + Number(item.quantity) * Number(item.proposed_unit_price ?? item.unit_price ?? 0), 0);
    const fee = await calculateMarketplaceFee("DIRECT_PURCHASE", taxableAmount, data.currency);
    await supabaseAdmin.from("marketplace_service_fees").upsert({ operation_type: "DIRECT_PURCHASE", direct_request_id: data.id, tender_id: null, supplier_id: data.supplier_id, tenant_id: data.tenant_id, currency: data.currency, taxable_amount: taxableAmount, percentage: fee.percentage, fee_amount: fee.feeAmount, status: "PENDING", calculated_at: new Date().toISOString() }, { onConflict: "direct_request_id" });
  }
  res.json(data);
});

app.put("/api/marketplace/v2/direct-requests/:id/buyer-response", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req);
  const tenantId = (req as Request & { authTenantId?: string }).authTenantId;
  if (!user || !tenantId) return res.status(403).json({ error: "Acceso exclusivo de la constructora compradora" });
  const action = String(req.body.action || "");
  if (!["ACCEPT_CHANGES", "CANCEL"].includes(action)) return res.status(400).json({ error: "Acción inválida" });
  const { data: current } = await supabaseAdmin.from("marketplace_direct_requests").select("*").eq("id", req.params.id).eq("tenant_id", tenantId).single();
  if (!current) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (action === "ACCEPT_CHANGES" && current.status !== "CHANGES_PROPOSED") return res.status(409).json({ error: "La solicitud no tiene una contrapropuesta pendiente" });
  const status = action === "ACCEPT_CHANGES" ? "ACCEPTED" : "CANCELLED";
  const { data, error } = await supabaseAdmin.from("marketplace_direct_requests").update({ status, buyer_response: req.body.response || null, last_action_by: user.id, last_action_at: new Date().toISOString() }).eq("id", current.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  await supabaseAdmin.from("marketplace_direct_request_events").insert({ request_id: current.id, actor_id: user.id, actor_type: "BUYER", event_type: action === "ACCEPT_CHANGES" ? "CHANGES_ACCEPTED" : "CANCELLED", message: req.body.response || null });
  const { data: members } = await supabaseAdmin.from("supplier_members").select("user_id").eq("supplier_id", current.supplier_id).eq("active", true);
  if (members?.length) await supabaseAdmin.from("marketplace_notifications").insert(members.map(member => ({ user_id: member.user_id, notification_type: `DIRECT_REQUEST_${status}`, title: "La constructora respondió la solicitud", message: action === "ACCEPT_CHANGES" ? "La contrapropuesta fue aceptada" : "La solicitud fue cancelada", entity_type: "DIRECT_REQUEST", entity_id: current.id })));
  res.json(data);
});

app.put("/api/marketplace/v2/direct-requests/:id/operation", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const action = String(req.body.action || ""); if (!["COMPLETE","CLAIM"].includes(action)) return res.status(400).json({ error: "Acción inválida" });
  const { data: request } = await supabaseAdmin.from("marketplace_direct_requests").select("*").eq("id", req.params.id).single(); if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
  const { data: tenantMember } = await supabaseAdmin.from("tenant_members").select("tenant_id").eq("user_id", user.id).eq("tenant_id", request.tenant_id).eq("active", true).maybeSingle();
  const { data: supplierMember } = await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", user.id).eq("supplier_id", request.supplier_id).eq("active", true).maybeSingle();
  if (!tenantMember && !supplierMember) return res.status(403).json({ error: "No participa de esta operación" });
  if (action === "COMPLETE" && (!tenantMember || request.status !== "ACCEPTED")) return res.status(409).json({ error: "Solo la constructora puede confirmar la recepción de una operación aceptada" });
  if (action === "CLAIM" && !["ACCEPTED","COMPLETED"].includes(request.status)) return res.status(409).json({ error: "La operación no admite reclamos en su estado actual" });
  const claimDescription = String(req.body.message || "").trim();
  if (action === "CLAIM" && claimDescription.length < 5) return res.status(400).json({ error: "Debe describir el reclamo" });
  const status = action === "COMPLETE" ? "COMPLETED" : "CLAIMED";
  const { data, error } = await supabaseAdmin.from("marketplace_direct_requests").update({ status, last_action_by: user.id, last_action_at: new Date().toISOString() }).eq("id", request.id).select().single(); if (error) return res.status(400).json({ error: error.message });
  await supabaseAdmin.from("marketplace_direct_request_events").insert({ request_id: request.id, actor_id: user.id, actor_type: tenantMember ? "BUYER" : "SUPPLIER", event_type: action === "COMPLETE" ? "COMPLETED" : "COMMENT", message: req.body.message || (action === "COMPLETE" ? "Recepción confirmada" : "Se abrió un reclamo") });
  if (action === "COMPLETE") {
    await supabaseAdmin.from("supplier_organizations").update({ completed_operations: Number((await supabaseAdmin.from("supplier_organizations").select("completed_operations").eq("id", request.supplier_id).single()).data?.completed_operations || 0) + 1 }).eq("id", request.supplier_id);
  } else {
    const subject = String(req.body.subject || "Reclamo sobre compra directa").trim();
    await supabaseAdmin.from("marketplace_complaints").insert({ operation_type: "DIRECT_REQUEST", operation_id: request.id, created_by: user.id, complainant_party_type: tenantMember ? "TENANT" : "SUPPLIER", complainant_party_id: tenantMember ? request.tenant_id : request.supplier_id, respondent_party_id: tenantMember ? request.supplier_id : request.tenant_id, subject, description: claimDescription });
  }
  res.json(data);
});

app.post("/api/marketplace/v2/direct-requests/:id/review", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const { data: request } = await supabaseAdmin.from("marketplace_direct_requests").select("*").eq("id", req.params.id).eq("status", "COMPLETED").single(); if (!request) return res.status(409).json({ error: "Solo se califican operaciones finalizadas" });
  const { data: tenantMember } = await supabaseAdmin.from("tenant_members").select("tenant_id").eq("user_id", user.id).eq("tenant_id", request.tenant_id).eq("active", true).maybeSingle();
  const { data: supplierMember } = await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", user.id).eq("supplier_id", request.supplier_id).eq("active", true).maybeSingle();
  if (!tenantMember && !supplierMember) return res.status(403).json({ error: "No participa de esta operación" });
  const ratings = ["priceRating","qualityRating","deliveryRating","serviceRating"].map(key => Number(req.body[key])); if (ratings.some(value => !Number.isInteger(value) || value < 1 || value > 5)) return res.status(400).json({ error: "Todas las calificaciones deben estar entre 1 y 5" });
  const reviewerType = tenantMember ? "TENANT" : "SUPPLIER";
  const { data, error } = await supabaseAdmin.from("marketplace_reviews").insert({ operation_type: "DIRECT_REQUEST", operation_id: request.id, reviewer_user_id: user.id, reviewer_party_type: reviewerType, reviewed_party_id: tenantMember ? request.supplier_id : request.tenant_id, price_rating: ratings[0], quality_rating: ratings[1], delivery_rating: ratings[2], service_rating: ratings[3], comment: req.body.comment || null }).select().single(); if (error) return res.status(400).json({ error: error.code === "23505" ? "Ya calificó esta operación" : error.message });
  if (tenantMember) { const { data: reviews } = await supabaseAdmin.from("marketplace_reviews").select("price_rating,quality_rating,delivery_rating,service_rating").eq("reviewer_party_type", "TENANT").eq("reviewed_party_id", request.supplier_id); const scores = (reviews || []).flatMap(review => [review.price_rating,review.quality_rating,review.delivery_rating,review.service_rating].filter(Boolean).map(Number)); await supabaseAdmin.from("supplier_organizations").update({ rating: scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null, review_count: reviews?.length || 0 }).eq("id", request.supplier_id); }
  res.status(201).json(data);
});

app.post("/api/marketplace/v2/tenders", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  try {
    const tenantId = await resolveDatabaseTenantId(req.body.tenantId);
    const user = await findAuthUserByEmail(req.body.email);
    if (!tenantId || !user) return res.status(400).json({ error: "No se pudo identificar empresa o usuario" });
    const projectId = await resolveDatabaseProjectId(req.body.projectId, tenantId);
    if (!projectId) return res.status(400).json({ error: "La obra todavía no está sincronizada con Supabase" });
    const { lines = [], requirements = [], invitedSupplierIds = [], categoryIds = [], ...tender } = req.body;
    const { data, error } = await supabaseAdmin.from("marketplace_tenders").insert({
      tenant_id: tenantId,
      project_id: projectId,
      created_by: user.id,
      code: tender.code || `LIC-${Date.now()}`,
      process_type: tender.processType,
      visibility: tender.visibility,
      title: tender.title,
      location: tender.location || null,
      description: tender.description,
      scope_type: tender.scopeType,
      delivery_required: Boolean(tender.deliveryRequired),
      budget_amount: tender.budgetAmount ? Number(tender.budgetAmount) : null,
      budget_currency: tender.budgetCurrency || null,
      opening_at: tender.openingAt,
      questions_until: tender.questionsUntil || null,
      closes_at: tender.closesAt,
      award_at: tender.processType === "RFP" ? tender.awardAt || null : null,
      public_answers: Boolean(tender.publicAnswers),
      terms_text: tender.termsText || null,
      required_quote_fields: tender.requiredQuoteFields || {},
      status: tender.status || "PUBLISHED"
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    if (lines.length) {
      const { error: lineError } = await supabaseAdmin.from("marketplace_tender_lines").insert(lines.map((line: any, index: number) => ({ tender_id: data.id, line_number: index + 1, category_id: line.categoryId || null, description: line.description, specifications: line.specifications || null, quantity: Number(line.quantity), unit: line.unit })));
      if (lineError) return res.status(400).json({ error: lineError.message });
    }
    if (requirements.length) {
      await supabaseAdmin.from("marketplace_tender_requirements").insert(requirements.map((requirement: any, index: number) => ({ tender_id: data.id, label: requirement.label, requirement_type: requirement.type, required: requirement.required !== false, sort_order: index })));
    }
    if (categoryIds.length) {
      await supabaseAdmin.from("marketplace_tender_categories").insert(categoryIds.map((categoryId: string) => ({ tender_id: data.id, category_id: categoryId })));
    }
    if (invitedSupplierIds.length) {
      await supabaseAdmin.from("marketplace_tender_invites").insert(invitedSupplierIds.map((supplierId: string) => ({ tender_id: data.id, supplier_id: supplierId })));
    }
    let notifiedSupplierIds: string[] = invitedSupplierIds;
    if (tender.visibility === "PUBLIC") { const { data: approved } = await supabaseAdmin.from("supplier_organizations").select("id").eq("approval_status", "APPROVED"); notifiedSupplierIds = (approved || []).map(item => item.id); }
    if (tender.visibility === "LIMITED" && categoryIds.length) { const { data: matching } = await supabaseAdmin.from("supplier_organizations").select("id").eq("approval_status", "APPROVED").overlaps("category_ids", categoryIds); notifiedSupplierIds = (matching || []).map(item => item.id); }
    if (notifiedSupplierIds.length) { const { data: members } = await supabaseAdmin.from("supplier_members").select("user_id").in("supplier_id", notifiedSupplierIds).eq("active", true); if (members?.length) await supabaseAdmin.from("marketplace_notifications").insert(members.map(member => ({ user_id: member.user_id, notification_type: "TENDER_PUBLISHED", title: "Nueva licitación disponible", message: tender.title, entity_type: "TENDER", entity_id: data.id }))); }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo crear la licitación" });
  }
});

app.get("/api/marketplace/v2/tenders/:id/communications", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  const user = await getRequestAuthUser(req); if (!user) return res.status(401).json({ error: "Sesión requerida" });
  const { data: tender } = await supabaseAdmin.from("marketplace_tenders").select("id,tenant_id,status,visibility,public_answers,questions_until").eq("id", req.params.id).single(); if (!tender) return res.status(404).json({ error: "Licitación no encontrada" });
  const { data: tenantMember } = await supabaseAdmin.from("tenant_members").select("tenant_id").eq("user_id", user.id).eq("tenant_id", tender.tenant_id).eq("active", true).maybeSingle();
  const { data: supplierMember } = await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!tenantMember && !supplierMember) return res.status(403).json({ error: "No tiene acceso a este proceso" });
  let documentQuery = supabaseAdmin.from("marketplace_tender_documents").select("id,title,mime_type,file_size,document_type,created_at").eq("tender_id", tender.id).order("created_at");
  if (supplierMember) documentQuery = documentQuery.eq("visible_to_suppliers", true);
  const [{ data: questions, error: questionError }, { data: documents, error: documentError }] = await Promise.all([
    supabaseAdmin.from("marketplace_tender_questions").select("id,supplier_id,question,answer,answered_at,created_at,supplier_organizations(trade_name,legal_name)").eq("tender_id", tender.id).order("created_at"),
    documentQuery
  ]);
  if (questionError || documentError) return res.status(400).json({ error: questionError?.message || documentError?.message });
  const visibleQuestions = tenantMember || tender.public_answers ? questions || [] : (questions || []).filter((question:any)=>question.supplier_id===supplierMember?.supplier_id);
  res.json({ questions: visibleQuestions, documents: documents || [], canAsk: Boolean(supplierMember && (!tender.questions_until || new Date(tender.questions_until).getTime()>Date.now())), canAnswer: Boolean(tenantMember) });
});

app.post("/api/marketplace/v2/tenders/:id/questions", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" }); const user=await getRequestAuthUser(req); if(!user)return res.status(401).json({error:"Sesión requerida"});
  const { data: member }=await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id",user.id).eq("active",true).maybeSingle(); if(!member)return res.status(403).json({error:"Acceso exclusivo de proveedor"});
  const { data: tender }=await supabaseAdmin.from("marketplace_tenders").select("tenant_id,questions_until,status").eq("id",req.params.id).single(); if(!tender||!["PUBLISHED","QUESTIONS"].includes(tender.status)||tender.questions_until&&new Date(tender.questions_until).getTime()<=Date.now())return res.status(409).json({error:"El período de consultas está cerrado"});
  const question=String(req.body.question||"").trim(); if(question.length<5)return res.status(400).json({error:"La consulta es demasiado breve"}); if (/(\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(question)) return res.status(400).json({error:"No se permiten datos de contacto"});
  const {data,error}=await supabaseAdmin.from("marketplace_tender_questions").insert({tender_id:req.params.id,supplier_id:member.supplier_id,question}).select().single(); if(error)return res.status(400).json({error:error.message});
  const {data:buyers}=await supabaseAdmin.from("tenant_members").select("user_id").eq("tenant_id",tender.tenant_id).eq("active",true).in("role",["owner","admin","purchasing_manager"]); if(buyers?.length)await supabaseAdmin.from("marketplace_notifications").insert(buyers.map(buyer=>({user_id:buyer.user_id,notification_type:"TENDER_QUESTION",title:"Nueva consulta en una licitación",message:question,entity_type:"TENDER",entity_id:req.params.id})));
  res.status(201).json(data);
});

app.put("/api/marketplace/v2/tender-questions/:id/answer", async (req: Request, res: Response) => {
  if(!supabaseAdmin)return res.status(503).json({error:"Supabase no está configurado"}); const user=await getRequestAuthUser(req); const tenantId=(req as Request & {authTenantId?:string}).authTenantId; if(!user||!tenantId)return res.status(403).json({error:"Acceso exclusivo del licitante"});
  const answer=String(req.body.answer||"").trim(); if(answer.length<2)return res.status(400).json({error:"Debe escribir una respuesta"});
  const {data:question}=await supabaseAdmin.from("marketplace_tender_questions").select("id,supplier_id,marketplace_tenders!inner(tenant_id,public_answers)").eq("id",req.params.id).single(); const linkedTender:any=Array.isArray(question?.marketplace_tenders)?question?.marketplace_tenders[0]:question?.marketplace_tenders; if(!question||linkedTender?.tenant_id!==tenantId)return res.status(403).json({error:"La consulta no pertenece a su organización"});
  const {data,error}=await supabaseAdmin.from("marketplace_tender_questions").update({answer,answered_by:user.id,answered_at:new Date().toISOString()}).eq("id",req.params.id).select().single(); if(error)return res.status(400).json({error:error.message});
  const {data:members}=await supabaseAdmin.from("supplier_members").select("user_id").eq("supplier_id",question.supplier_id).eq("active",true); if(members?.length)await supabaseAdmin.from("marketplace_notifications").insert(members.map(member=>({user_id:member.user_id,notification_type:"TENDER_ANSWER",title:"Respondieron su consulta",message:answer,entity_type:"TENDER_QUESTION",entity_id:question.id})));
  res.json(data);
});

app.post("/api/marketplace/v2/tenders/:id/documents", async (req: Request, res: Response) => {
  if(!supabaseAdmin)return res.status(503).json({error:"Supabase no está configurado"}); const user=await getRequestAuthUser(req); const tenantId=(req as Request & {authTenantId?:string}).authTenantId; if(!user||!tenantId)return res.status(403).json({error:"Acceso exclusivo del licitante"});
  const {data:tender}=await supabaseAdmin.from("marketplace_tenders").select("tenant_id").eq("id",req.params.id).single(); if(!tender||tender.tenant_id!==tenantId)return res.status(403).json({error:"La licitación no pertenece a su organización"});
  const mimeType=String(req.body.mimeType||""); if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mimeType)||!req.body.base64)return res.status(400).json({error:"Formato no admitido"}); const buffer=Buffer.from(req.body.base64,"base64"); if(!buffer.length||buffer.length>10*1024*1024)return res.status(400).json({error:"El archivo supera 10 MB"});
  const extension=mimeType==="application/pdf"?"pdf":mimeType==="image/png"?"png":mimeType==="image/webp"?"webp":"jpg"; const storagePath=`${tenantId}/tenders/${req.params.id}/${randomUUID()}.${extension}`; const {error:uploadError}=await supabaseAdmin.storage.from("marketplace-tender-documents").upload(storagePath,buffer,{contentType:mimeType}); if(uploadError)return res.status(400).json({error:uploadError.message});
  const {data,error}=await supabaseAdmin.from("marketplace_tender_documents").insert({tender_id:req.params.id,uploaded_by:user.id,title:String(req.body.title||"Documento"),storage_path:storagePath,mime_type:mimeType,file_size:buffer.length,document_type:req.body.documentType||"GENERAL",visible_to_suppliers:req.body.visibleToSuppliers!==false}).select().single(); if(error){await supabaseAdmin.storage.from("marketplace-tender-documents").remove([storagePath]);return res.status(400).json({error:error.message});} res.status(201).json(data);
});

app.get("/api/marketplace/v2/tender-documents/:id/download", async (req: Request, res: Response) => {
  if(!supabaseAdmin)return res.status(503).end(); const user=await getRequestAuthUser(req); if(!user)return res.status(401).end(); const {data:document}=await supabaseAdmin.from("marketplace_tender_documents").select("storage_path,mime_type,title,tender_id,visible_to_suppliers,marketplace_tenders!inner(tenant_id,status)").eq("id",req.params.id).single(); if(!document)return res.status(404).end();
  const linkedTender:any=Array.isArray(document.marketplace_tenders)?document.marketplace_tenders[0]:document.marketplace_tenders; const {data:tenantMember}=await supabaseAdmin.from("tenant_members").select("tenant_id").eq("user_id",user.id).eq("tenant_id",linkedTender?.tenant_id).eq("active",true).maybeSingle(); const {data:supplierMember}=await supabaseAdmin.from("supplier_members").select("supplier_id").eq("user_id",user.id).eq("active",true).maybeSingle(); if(!tenantMember&&(!supplierMember||!document.visible_to_suppliers||linkedTender?.status==="DRAFT"))return res.status(403).end();
  const {data,error}=await supabaseAdmin.storage.from("marketplace-tender-documents").download(document.storage_path); if(error||!data)return res.status(404).end(); res.setHeader("Content-Type",document.mime_type); res.setHeader("Content-Disposition",`inline; filename="${String(document.title).replace(/[\r\n\"]+/g,"_")}"`); res.send(Buffer.from(await data.arrayBuffer()));
});

app.post("/api/marketplace/v2/tenders/:id/submissions", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  try {
    const user = await getRequestAuthUser(req);
    if (!user) return res.status(401).json({ error: "Sesión requerida" });
    const { data: supplierMember } = await supabaseAdmin.from("supplier_members").select("supplier_id,supplier_organizations(*)").eq("user_id", user.id).eq("active", true).maybeSingle();
    const supplier: any = Array.isArray(supplierMember?.supplier_organizations) ? supplierMember?.supplier_organizations[0] : supplierMember?.supplier_organizations;
    if (!supplierMember || supplier?.approval_status !== "APPROVED") return res.status(403).json({ error: "Proveedor no habilitado" });
    if (!req.body.termsAccepted) return res.status(400).json({ error: "Debe aceptar los términos antes de enviar" });
    const { data: tender } = await supabaseAdmin.from("marketplace_tenders").select("id,status,opening_at,closes_at,visibility").eq("id", req.params.id).single();
    const now = Date.now(); if (!tender || !["PUBLISHED","QUESTIONS"].includes(tender.status) || new Date(tender.opening_at).getTime()>now || new Date(tender.closes_at).getTime()<=now) return res.status(409).json({ error: "La licitación no está abierta para recibir ofertas" });
    if (tender.visibility === "PRIVATE") { const { data: invite } = await supabaseAdmin.from("marketplace_tender_invites").select("tender_id").eq("tender_id", tender.id).eq("supplier_id", supplierMember.supplier_id).maybeSingle(); if (!invite) return res.status(403).json({ error: "El proveedor no fue invitado a este proceso" }); }
    const lines = req.body.lines || []; const { data: tenderLines } = await supabaseAdmin.from("marketplace_tender_lines").select("id").eq("tender_id", tender.id); const allowedLines = new Set((tenderLines||[]).map(line=>line.id)); if (!lines.length || lines.some((line:any)=>!allowedLines.has(line.tenderLineId))) return res.status(400).json({ error: "La oferta contiene renglones inválidos" });
    const { data, error } = await supabaseAdmin.from("marketplace_submissions").insert({ tender_id: req.params.id, supplier_id: supplierMember.supplier_id, submitted_by: user.id, requirement_answers: req.body.requirementAnswers || {}, terms_accepted: true, terms_accepted_at: new Date().toISOString() }).select().single();
    if (error) return res.status(400).json({ error: error.code === "23505" ? "Ya presentó una oferta para esta licitación" : error.message });
    if (lines.length) {
      const { error: lineError } = await supabaseAdmin.from("marketplace_submission_lines").insert(lines.map((line: any) => ({ submission_id: data.id, tender_line_id: line.tenderLineId, offered: line.offered !== false, unit_price: line.offered === false ? null : Number(line.unitPrice), currency: line.offered === false ? null : line.currency, vat_rate: line.vatRate == null ? null : Number(line.vatRate), discount_percent: line.discountPercent == null ? null : Number(line.discountPercent), transport_cost: line.transportCost == null ? null : Number(line.transportCost), delivery_days: line.deliveryDays ? Number(line.deliveryDays) : null, validity_days: line.validityDays ? Number(line.validityDays) : null, payment_terms: line.paymentTerms || null, notes: line.notes || null })));
      if (lineError) return res.status(400).json({ error: lineError.message });
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo enviar la oferta" });
  }
});

app.post("/api/marketplace/v2/tenders/:id/award", async (req: Request, res: Response) => {
  if (!supabaseAdmin) return res.status(503).json({ error: "Supabase no está configurado" });
  try {
    const user = await getRequestAuthUser(req);
    const tenantId = (req as Request & { authTenantId?: string }).authTenantId;
    const { data: tender } = await supabaseAdmin.from("marketplace_tenders").select("tenant_id,process_type,status").eq("id", req.params.id).single();
    if (!user || !tenantId || tender?.tenant_id !== tenantId) return res.status(403).json({ error: "Acceso denegado" });
    if (tender.process_type !== "RFP") return res.status(400).json({ error: "Las RFI no admiten adjudicación" });
    if (tender.status === "AWARDED") return res.status(409).json({ error: "La licitación ya fue adjudicada" });
    const awards = req.body.awards || [];
    if (!awards.length) return res.status(400).json({ error: "Debe seleccionar al menos un renglón" });
    const tenderLineIds = awards.map((award:any)=>award.tenderLineId); if (new Set(tenderLineIds).size !== tenderLineIds.length) return res.status(400).json({ error: "Cada renglón solo puede adjudicarse a un proveedor" });
    const { data: validLines } = await supabaseAdmin.from("marketplace_submission_lines").select("id,tender_line_id,marketplace_submissions!inner(tender_id)").in("id", awards.map((award:any)=>award.submissionLineId));
    const validById = new Map((validLines||[]).map((line:any)=>[line.id,line]));
    if (awards.some((award:any)=>{ const line:any=validById.get(award.submissionLineId); return !line || line.tender_line_id!==award.tenderLineId || line.marketplace_submissions?.tender_id!==req.params.id; })) return res.status(400).json({ error: "Una selección no pertenece a esta licitación o renglón" });
    const { error } = await supabaseAdmin.from("marketplace_line_awards").insert(awards.map((award: any) => ({ tender_line_id: award.tenderLineId, submission_line_id: award.submissionLineId, awarded_by: user.id, notes: award.notes || null })));
    if (error) return res.status(400).json({ error: error.message });
    const submissionLineIds = awards.map((award: any) => award.submissionLineId);
    const { data: awardedLines } = await supabaseAdmin.from("marketplace_submission_lines").select("id,unit_price,currency,discount_percent,transport_cost,marketplace_submissions(supplier_id),marketplace_tender_lines(quantity)").in("id", submissionLineIds);
    const feeGroups = new Map<string, { supplierId: string; currency: "ARS" | "USD"; amount: number }>();
    for (const line of awardedLines || []) {
      const supplierId = (line.marketplace_submissions as any)?.supplier_id;
      const currency = line.currency as "ARS" | "USD";
      if (!supplierId || !currency) continue;
      const quantity = Number((line.marketplace_tender_lines as any)?.quantity || 0);
      const gross = Number(line.unit_price || 0) * quantity;
      const discounted = gross * (1 - Number(line.discount_percent || 0) / 100);
      const amount = discounted + Number(line.transport_cost || 0);
      const key = `${supplierId}:${currency}`;
      const current = feeGroups.get(key) || { supplierId, currency, amount: 0 };
      current.amount += amount;
      feeGroups.set(key, current);
    }
    for (const group of feeGroups.values()) {
      const fee = await calculateMarketplaceFee("TENDER_AWARD", group.amount, group.currency);
      const taxAmount = Math.round(fee.feeAmount * 0.21 * 100) / 100;
      const baseFee = { operation_type: "TENDER_AWARD", direct_request_id: null, tender_id: req.params.id, supplier_id: group.supplierId, tenant_id: tenantId, currency: group.currency, taxable_amount: group.amount, percentage: fee.percentage, fee_amount: fee.feeAmount, tax_rate: 21, tax_amount: taxAmount, total_amount: fee.feeAmount + taxAmount, status: "PENDING", calculated_at: new Date().toISOString() };
      const { error: feeError } = await supabaseAdmin.from("marketplace_service_fees").insert([{ ...baseFee, payer_type: "SUPPLIER" }, { ...baseFee, payer_type: "TENANT" }]);
      if (feeError) throw feeError;
    }
    const awardedSubmissionIds = new Set((awardedLines || []).map((line:any)=>(line.marketplace_submissions as any)?.supplier_id).filter(Boolean));
    const { data: tenderSubmissions } = await supabaseAdmin.from("marketplace_submissions").select("id,supplier_id").eq("tender_id", req.params.id);
    for (const submission of tenderSubmissions || []) {
      const awarded = awardedSubmissionIds.has(submission.supplier_id);
      await supabaseAdmin.from("marketplace_submissions").update({ status: awarded ? "PARTIALLY_AWARDED" : "NOT_AWARDED" }).eq("id", submission.id);
      const { data: members } = await supabaseAdmin.from("supplier_members").select("user_id").eq("supplier_id", submission.supplier_id).eq("active", true);
      if (members?.length) await supabaseAdmin.from("marketplace_notifications").insert(members.map(member => ({ user_id: member.user_id, notification_type: awarded ? "TENDER_AWARDED" : "TENDER_NOT_AWARDED", title: awarded ? "Fue adjudicado en una licitación" : "Licitación resuelta", message: awarded ? "Revise los renglones adjudicados" : "Su oferta no fue seleccionada", entity_type: "TENDER", entity_id: req.params.id })));
    }
    await supabaseAdmin.from("marketplace_tenders").update({ status: "AWARDED" }).eq("id", req.params.id);
    res.json({ awardedLines: awards.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo adjudicar" });
  }
});

// 1.5. Detect connected user and assign active tenant based on connection headers
app.get("/api/me", (req: Request, res: Response) => {
  let email = "";
  
  // Prioritize user_email query param or header so custom login sessions work correctly in preview/dev environment
  if (req.query.user_email) {
    email = (req.query.user_email as string).trim();
  } else if (req.headers["x-user-email"]) {
    email = (req.headers["x-user-email"] as string).trim();
  } else if (req.headers["x-goog-authenticated-user-email"]) {
    let googleIap = req.headers["x-goog-authenticated-user-email"] as string;
    const match = googleIap.match(/(?:accounts\.google\.com:|mailto:)?(.+)/i);
    if (match && match[1]) {
      email = match[1].trim();
    }
  } else if (req.headers["x-replit-user-email"]) {
    email = (req.headers["x-replit-user-email"] as string).trim();
  }

  if (!email) {
    email = "mariano.telespazio@gmail.com"; // Default developer email fallback
  }

  const normalizedEmail = email.toLowerCase().trim();
  
  // Determine tenant based on email, or custom parameter, or look up in tenants list
  let tenantId = (req.headers["x-tenant-id"] as string) || (req.query.tenant_id as string) || "";
  
  // Check if requested tenant actually exists, otherwise fallback to lookup
  if (tenantId && !tenants.some(t => t.id === tenantId)) {
    tenantId = "";
  }

  if (!tenantId) {
    if (normalizedEmail.includes("norte") || normalizedEmail.includes("cordoba") || normalizedEmail.includes("norte-obras")) {
      tenantId = "tenant-norte";
    } else if (normalizedEmail.includes("alianza") || normalizedEmail.includes("brasil") || normalizedEmail.includes("brazil")) {
      tenantId = "tenant-alianza";
    } else {
      // Find a tenant that has this user registered in its activeUsers array, checking newest first (custom ones first)
      const userTenant = [...tenants].reverse().find(t => t.activeUsers?.some(u => u.email.toLowerCase().trim() === normalizedEmail));
      if (userTenant) {
        tenantId = userTenant.id;
      } else {
        // Find if there is any custom tenant at the end of the array (user created)
        const customTenant = [...tenants].reverse().find(t => t.id.startsWith("tenant-dyn-"));
        tenantId = customTenant ? customTenant.id : "tenant-lelfun";
      }
    }
  }

  const activeTenant = tenants.find(t => t.id === tenantId) || tenants[0];

  // Resolve user info inside the active tenant
  const userObj = activeTenant.activeUsers?.find(u => u.email.toLowerCase().trim() === normalizedEmail);
  const role = userObj ? userObj.role : (normalizedEmail === "mariano.telespazio@gmail.com" ? "Administrador General" : "Colaborador");
  const name = userObj ? userObj.name : (normalizedEmail === "mariano.telespazio@gmail.com" ? "Mariano Telespazio" : email.split("@")[0]);

  res.json({
    email,
    tenantId: activeTenant.id,
    tenantName: activeTenant.name,
    cuit: activeTenant.cuit || "30-71409581-2",
    defaultCurrency: activeTenant.defaultCurrency,
    role,
    name
  });
});

// 2. Get Global Exchange Rates
app.get("/api/exchange-rates", (req: Request, res: Response) => {
  res.json(exchangeRates);
});

app.get("/api/exchange-rates/history", (req: Request, res: Response) => {
  res.json(
    [...officialExchangeRateHistory].sort((a, b) => b.date.localeCompare(a.date))
  );
});

// 3. Central Synchronization State Endpoint (returns isolated tenant data)
app.get("/api/state", async (req: Request, res: Response) => {
  const tenantId = (req as Request & { authTenantId?: string }).authTenantId || req.query.tenantId as string;
  if (!tenantId) {
    return res.status(400).json({ error: "Missing tenantId parameter" });
  }

  // Filter global database based on the tenant context
  const tenantProjects = projects.filter(p => p.tenantId === tenantId);
  const tenantProjectIds = tenantProjects.map(p => p.id);

  const tenantAccounts = accounts.filter(a => a.tenantId === tenantId);
  const tenantCounterparties = counterparties.filter(c => c.tenantId === tenantId);
  let tenantCategories = costCategories.filter(c => c.tenantId === tenantId);
  
  // Filter movements belonging directly to tenant accounts
  const tenantAccountIds = tenantAccounts.map(a => a.id);
  const tenantMovements = movements.filter(m => tenantAccountIds.includes(m.accountId));
  const tenantCashCounts = cashCounts.filter(cc => tenantAccountIds.includes(cc.accountId));

  const tenantBudgetLines = budgetLines.filter(bl => tenantProjectIds.includes(bl.projectId));
  if (tenantCategories.length === 0 && tenantBudgetLines.length > 0) {
    const categoriesByName = new Map<string, CostCategory>();
    tenantBudgetLines.forEach((line, index) => {
      if (!categoriesByName.has(line.name)) {
        categoriesByName.set(line.name, {
          id: `cat-${tenantId}-${index + 1}`,
          tenantId,
          code: line.code || String(index + 1).padStart(2, "0"),
          name: line.name,
          isLeaf: true
        });
      }
    });
    tenantCategories = Array.from(categoriesByName.values());
    costCategories.push(...tenantCategories);
    persistAppState();
  }
  const tenantPurchaseRequests = purchaseRequests.filter(pr => pr.tenantId === tenantId);
  const tenantUnits = sellableUnits.filter(u => tenantProjectIds.includes(u.projectId));
  const now = new Date();
  salesOpportunities.forEach(opportunity => {
    if (
      opportunity.tenantId === tenantId &&
      opportunity.stage === "RESERVED" &&
      opportunity.reservationExpiresAt &&
      new Date(opportunity.reservationExpiresAt) < now
    ) {
      opportunity.stage = "EXPIRED";
      opportunity.updatedAt = now.toISOString();
      opportunity.unitIds.forEach(unitId => {
        const unit = sellableUnits.find(item => item.id === unitId);
        if (unit?.status === UnitStatus.RESERVED) unit.status = UnitStatus.AVAILABLE;
      });
    }
  });
  const tenantOpportunities = salesOpportunities.filter(opportunity => opportunity.tenantId === tenantId);
  
  const tenantContractIds = salesContracts.filter(sc => sc.tenantId === tenantId).map(c => c.id);
  const tenantContracts = salesContracts.filter(sc => sc.tenantId === tenantId);
  const tenantInstallments = installments.filter(inst => tenantContractIds.includes(inst.contractId));
  
  const tenantDocuments = ocrDocuments.filter(doc => doc.tenantId === tenantId);
  const tenantCondos = earlyCondominiums.filter(cond => cond.tenantId === tenantId);
  const tenantMaintenance = maintenanceRequests.filter(m => m.tenantId === tenantId);

  // Global tenders where the active tenant is the creator, or all public tenders
  const tenantTenders = publicTenders.filter(t => t.tenantId === tenantId);

  let tenantProfile = tenants.find(t => t.id === tenantId) || null;
  if (supabaseAdmin) {
    const { data: databaseTenant } = await supabaseAdmin
      .from("tenants")
      .select("id,name,legal_name,tax_id,phone,legal_address,commercial_address,company_type,default_currency,logo_url")
      .eq("id", tenantId)
      .maybeSingle();
    if (databaseTenant) {
      tenantProfile = {
        id: databaseTenant.id,
        name: databaseTenant.name,
        nombreFantasia: databaseTenant.name,
        razonSocial: databaseTenant.legal_name,
        cuit: databaseTenant.tax_id,
        phone: databaseTenant.phone,
        legalAddress: databaseTenant.legal_address,
        commercialAddress: databaseTenant.commercial_address,
        companyType: databaseTenant.company_type,
        defaultCurrency: databaseTenant.default_currency,
        logoUrl: databaseTenant.logo_url,
        enabledCurrencies: [Currency.ARS, Currency.USD],
        activeUsers: []
      } as Tenant;
    }
  }
  if (!tenantProfile) tenantProfile = tenants[0];
  let currentOfficialRate: DailyOfficialExchangeRate | null = null;
  try {
    currentOfficialRate = await getDailyOfficialRate();
  } catch (error) {
    console.error("No se pudo actualizar la cotización oficial:", error);
    currentOfficialRate = officialExchangeRateHistory
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }
  const consolidationCurrency = tenantProfile.defaultCurrency;
  const officialSellRate = currentOfficialRate?.sell || exchangeRates.ARS_USD_OFICIAL;
  const consolidatedLiquidity = tenantAccounts.reduce(
    (total, account) => total + convertAmount(account.balance, account.currency, consolidationCurrency, officialSellRate),
    0
  );

  res.json({
    projects: tenantProjects,
    accounts: tenantAccounts,
    counterparties: tenantCounterparties,
    categories: tenantCategories,
    movements: tenantMovements,
    cashCounts: tenantCashCounts,
    budgetLines: tenantBudgetLines,
    purchaseRequests: tenantPurchaseRequests,
    units: tenantUnits,
    opportunities: tenantOpportunities,
    contracts: tenantContracts,
    installments: tenantInstallments,
    documents: tenantDocuments,
    earlyCondominiums: tenantCondos,
    maintenanceRequests: tenantMaintenance,
    tenders: tenantTenders,
    marketplaceSuppliers, // Global catalog is public
    tenantProfile,
    exchangeRates: {
      ARS_USD_OFICIAL: officialSellRate,
      BRL_USD: exchangeRates.BRL_USD,
      date: currentOfficialRate?.date,
      updatedAt: currentOfficialRate?.updatedAt
    },
    consolidation: {
      currency: consolidationCurrency,
      totalLiquidity: consolidatedLiquidity
    }
  });
});

// 3.5. Tenant Profile updates, Deposits, Bank Accounts, and Active Users management
app.put("/api/tenants/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const tenant = tenants.find(t => t.id === id);
  if (!tenant) {
    return res.status(404).json({ error: "Empresa no encontrada" });
  }

  // Update profile fields
  if (data.name !== undefined) tenant.name = data.name;
  if (data.logoUrl !== undefined) tenant.logoUrl = data.logoUrl;
  if (data.defaultCurrency !== undefined) tenant.defaultCurrency = data.defaultCurrency;
  if (data.nombreFantasia !== undefined) tenant.nombreFantasia = data.nombreFantasia;
  if (data.razonSocial !== undefined) tenant.razonSocial = data.razonSocial;
  if (data.webPage !== undefined) tenant.webPage = data.webPage;
  if (data.phone !== undefined) tenant.phone = data.phone;
  if (data.legalAddress !== undefined) tenant.legalAddress = data.legalAddress;
  if (data.commercialAddress !== undefined) tenant.commercialAddress = data.commercialAddress;
  if (data.companyType !== undefined) tenant.companyType = data.companyType;
  if (data.cuit !== undefined) tenant.cuit = data.cuit;
  if (data.iibbType !== undefined) tenant.iibbType = data.iibbType;

  if (tenant.id.startsWith("tenant-dyn-")) {
    persistTenant(tenant);
  }

  res.json(tenant);
});

app.get("/api/tenants/:id/logo", async (req: Request, res: Response) => {
  const tenant = tenants.find(t => t.id === req.params.id);
  if (!tenant?.logoStoragePath || !supabaseAdmin) {
    return res.status(404).json({ error: "Logo no encontrado" });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("project-images")
    .download(tenant.logoStoragePath);
  if (error || !data) {
    return res.status(404).json({ error: "No se pudo obtener el logo" });
  }

  res.setHeader("Content-Type", data.type || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(Buffer.from(await data.arrayBuffer()));
});

app.post("/api/tenants/:id/logo", async (req: Request, res: Response) => {
  const tenant = tenants.find(t => t.id === req.params.id);
  if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Supabase Storage no está configurado en el servidor." });
  }

  const { mimeType, base64 } = req.body as { fileName?: string; mimeType?: string; base64?: string };
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
  };
  if (!mimeType || !extensions[mimeType] || !base64) {
    return res.status(400).json({ error: "El logo debe ser PNG, JPG o WEBP." });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(base64, "base64");
  } catch {
    return res.status(400).json({ error: "El archivo enviado no es válido." });
  }
  if (!fileBuffer.length || fileBuffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "El logo no puede superar los 5 MB." });
  }

  const safeTenantId = tenant.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `${safeTenantId}/company/logo/${randomUUID()}.${extensions[mimeType]}`;
  const { error } = await supabaseAdmin.storage
    .from("project-images")
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
  if (error) {
    return res.status(500).json({ error: `No se pudo guardar el logo: ${error.message}` });
  }

  const previousPath = tenant.logoStoragePath;
  tenant.logoStoragePath = storagePath;
  tenant.logoUrl = `/api/tenants/${tenant.id}/logo?v=${Date.now()}`;
  if (tenant.id.startsWith("tenant-dyn-")) persistTenant(tenant);

  if (previousPath) {
    await supabaseAdmin.storage.from("project-images").remove([previousPath]);
  }

  res.json({ logoUrl: tenant.logoUrl });
});

app.post("/api/tenants/:id/deposits", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, address } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: "Faltan datos del depósito" });
  }

  const tenant = tenants.find(t => t.id === id);
  if (!tenant) {
    return res.status(404).json({ error: "Empresa no encontrada" });
  }

  if (!tenant.deposits) {
    tenant.deposits = [];
  }

  const newDeposit = {
    id: `dep-${Date.now()}`,
    name,
    address
  };

  tenant.deposits.push(newDeposit);
  if (tenant.id.startsWith("tenant-dyn-")) {
    persistTenant(tenant);
  }
  res.status(201).json(newDeposit);
});

app.post("/api/tenants/:id/accounts", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, currency, type, balance, responsibleName, responsibleEmail, responsiblePhone } = req.body;
  const accountType = type || "Banco";
  if (!name || !currency) {
    return res.status(400).json({ error: "Nombre y moneda requeridos" });
  }
  if (!["Banco", "Caja", "Caja Fuerte"].includes(accountType)) {
    return res.status(400).json({ error: "Tipo de cuenta inválido" });
  }
  if (accountType !== "Banco" && (!responsibleName || !responsibleEmail || !responsiblePhone)) {
    return res.status(400).json({ error: "Las cajas requieren responsable y teléfono" });
  }

  const tenant = tenants.find(t => t.id === id);
  if (!tenant) {
    return res.status(404).json({ error: "Empresa no encontrada" });
  }

  const newAccount: FinancialAccount = {
    id: `acc-${Date.now()}`,
    tenantId: id,
    name,
    type: accountType,
    currency: currency as Currency,
    balance: Number(balance) || 0,
    responsibleName,
    responsibleEmail,
    responsiblePhone
  };

  accounts.push(newAccount);
  persistAppState();
  res.status(201).json(newAccount);
});

app.put("/api/tenants/:tenantId/accounts/:accountId", (req: Request, res: Response) => {
  const { tenantId, accountId } = req.params;
  const { name, currency, balance, type, responsibleName, responsibleEmail, responsiblePhone } = req.body;
  const accountType = type || "Banco";

  if (!name || !currency || balance === undefined || Number.isNaN(Number(balance))) {
    return res.status(400).json({ error: "Nombre, moneda y saldo válidos son requeridos" });
  }
  if (!["Banco", "Caja", "Caja Fuerte"].includes(accountType)) {
    return res.status(400).json({ error: "Tipo de cuenta inválido" });
  }
  if (accountType !== "Banco" && (!responsibleName || !responsibleEmail || !responsiblePhone)) {
    return res.status(400).json({ error: "Las cajas requieren responsable y teléfono" });
  }

  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) {
    return res.status(404).json({ error: "Empresa no encontrada" });
  }

  const account = accounts.find(a => a.id === accountId && a.tenantId === tenantId);
  if (!account) {
    return res.status(404).json({ error: "Cuenta no encontrada para esta empresa" });
  }

  account.name = String(name).trim();
  account.type = accountType;
  account.currency = currency as Currency;
  account.balance = Number(balance);
  account.responsibleName = responsibleName || undefined;
  account.responsibleEmail = responsibleEmail || undefined;
  account.responsiblePhone = responsiblePhone || undefined;
  persistAppState();

  res.json(account);
});

app.post("/api/tenants/:id/users", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: "Nombre, email y rol requeridos" });
  }

  const tenant = tenants.find(t => t.id === id);
  if (!tenant) {
    return res.status(404).json({ error: "Empresa no encontrada" });
  }

  if (!tenant.activeUsers) {
    tenant.activeUsers = [];
  }

  const newUser = {
    name,
    email,
    role,
    active: true
  };

  tenant.activeUsers.push(newUser);
  if (tenant.id.startsWith("tenant-dyn-")) {
    persistTenant(tenant);
  }
  res.status(201).json(newUser);
});

// 4. Create Financial Movement
app.post("/api/movements", async (req: Request, res: Response) => {
  const movementData = req.body;
  if (!movementData.tenantId || !movementData.accountId || !movementData.amount || !movementData.type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (movementData.purchaseRequestId) {
    const linkedRequest = purchaseRequests.find(pr => pr.id === movementData.purchaseRequestId);
    if (
      movementData.type !== MovementType.EGRESO ||
      !linkedRequest ||
      linkedRequest.tenantId !== movementData.tenantId ||
      (movementData.projectId && linkedRequest.projectId !== movementData.projectId)
    ) {
      return res.status(400).json({ error: "Invalid purchase request association" });
    }
  }

  const tenant = tenants.find(t => t.id === movementData.tenantId);
  const consolidationCurrency = tenant?.defaultCurrency || Currency.USD;
  const movementDate = movementData.date || new Date().toISOString().split("T")[0];
  let dailyRate: DailyOfficialExchangeRate;
  try {
    dailyRate = await getDailyOfficialRate(movementDate);
  } catch (error) {
    return res.status(503).json({ error: "No se pudo obtener el tipo de cambio oficial para registrar el movimiento" });
  }
  const movementAmount = Number(movementData.amount);

  // Generate ID
  const newMovement: FinancialMovement = {
    id: `mov-${Date.now()}`,
    tenantId: movementData.tenantId,
    projectId: movementData.projectId,
    accountId: movementData.accountId,
    targetAccountId: movementData.targetAccountId,
    counterpartyId: movementData.counterpartyId,
    categoryId: movementData.categoryId,
    purchaseRequestId: movementData.purchaseRequestId,
    amount: movementAmount,
    currency: movementData.currency || Currency.USD,
    baseAmount: convertAmount(
      movementAmount,
      movementData.currency || Currency.USD,
      consolidationCurrency,
      dailyRate.sell
    ),
    exchangeRate: dailyRate.sell,
    exchangeRateDate: dailyRate.date,
    type: movementData.type,
    description: movementData.description || "",
    status: movementData.status || MovementStatus.DRAFT,
    date: movementDate,
    performedBy: movementData.performedBy || "Administración Central"
  };

  movements.unshift(newMovement);
  persistAppState();

  // If POSTED directly, update account balance immediately
  if (newMovement.status === MovementStatus.POSTED) {
    applyMovementToBalance(newMovement);
  }

  res.status(201).json(newMovement);
});

// 5. Update Movement Status (Workflow approval)
app.put("/api/movements/:id/status", (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, approvedBy } = req.body;

  const mov = movements.find(m => m.id === id);
  if (!mov) {
    return res.status(404).json({ error: "Movement not found" });
  }

  const prevStatus = mov.status;
  mov.status = status;
  if (approvedBy) {
    mov.approvedBy = approvedBy;
  }

  // Rules: Only POSTED transactions affect financial balances
  if (status === MovementStatus.POSTED && prevStatus !== MovementStatus.POSTED) {
    applyMovementToBalance(mov);
  } else if (prevStatus === MovementStatus.POSTED && status !== MovementStatus.POSTED) {
    // Revert balance if unposted or cancelled
    revertMovementFromBalance(mov);
  }

  persistAppState();
  res.json(mov);
});

// Helper functions to update in-memory balances
function applyMovementToBalance(mov: FinancialMovement) {
  const account = accounts.find(a => a.id === mov.accountId);
  if (account) {
    if (mov.type === MovementType.INGRESO) {
      account.balance += mov.amount;
    } else if (mov.type === MovementType.EGRESO) {
      account.balance -= mov.amount;
    } else if (mov.type === MovementType.TRANSFERENCIA && mov.targetAccountId) {
      account.balance -= mov.amount;
      const targetAcc = accounts.find(a => a.id === mov.targetAccountId);
      if (targetAcc) {
        // Multi-currency conversion if needed
        const receivedAmt = mov.currency === targetAcc.currency 
          ? mov.amount 
          : mov.amount * mov.exchangeRate; // Target currency is base * rate (or vice versa depending on setup)
        targetAcc.balance += receivedAmt;
      }
    }
  }
}

function revertMovementFromBalance(mov: FinancialMovement) {
  const account = accounts.find(a => a.id === mov.accountId);
  if (account) {
    if (mov.type === MovementType.INGRESO) {
      account.balance -= mov.amount;
    } else if (mov.type === MovementType.EGRESO) {
      account.balance += mov.amount;
    } else if (mov.type === MovementType.TRANSFERENCIA && mov.targetAccountId) {
      account.balance += mov.amount;
      const targetAcc = accounts.find(a => a.id === mov.targetAccountId);
      if (targetAcc) {
        const receivedAmt = mov.currency === targetAcc.currency 
          ? mov.amount 
          : mov.amount * mov.exchangeRate;
        targetAcc.balance -= receivedAmt;
      }
    }
  }
}

// 6. Perform Cash Count (Archeo)
app.post("/api/cash-counts", (req: Request, res: Response) => {
  const countData = req.body;
  if (!countData.tenantId || !countData.accountId || countData.physicalBalance === undefined) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const account = accounts.find(a => a.id === countData.accountId);
  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  const systemBalance = account.balance;
  const physicalBalance = Number(countData.physicalBalance);
  const difference = physicalBalance - systemBalance;

  const newCount: CashCount = {
    id: `count-${Date.now()}`,
    tenantId: countData.tenantId,
    accountId: countData.accountId,
    projectId: countData.projectId,
    countDate: new Date().toISOString().split("T")[0],
    systemBalance,
    physicalBalance,
    difference,
    currency: account.currency,
    status: "PENDING_APPROVAL",
    performedBy: countData.performedBy || "Auditor Obra",
    notes: countData.notes || ""
  };

  cashCounts.unshift(newCount);
  persistAppState();
  res.status(201).json(newCount);
});

// 7. Approve Cash Count (Balances update to Physical Balance if differences found)
app.put("/api/cash-counts/:id/approve", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { approvedBy } = req.body;

  const count = cashCounts.find(c => c.id === id);
  if (!count) {
    return res.status(404).json({ error: "Cash count not found" });
  }

  count.status = "APPROVED";
  count.approvedBy = approvedBy || "Gerencia Administrativa";

  // Reconcile system balance with physical balance
  if (count.difference !== 0) {
    const account = accounts.find(a => a.id === count.accountId);
    if (account) {
      const tenant = tenants.find(t => t.id === count.tenantId);
      const consolidationCurrency = tenant?.defaultCurrency || Currency.USD;
      let dailyRate: DailyOfficialExchangeRate;
      try {
        dailyRate = await getDailyOfficialRate(count.countDate);
      } catch (error) {
        return res.status(503).json({ error: "No se pudo obtener el tipo de cambio oficial del arqueo" });
      }
      // Create a compensatory movement automatically
      const adjustmentMovement: FinancialMovement = {
        id: `mov-adj-${Date.now()}`,
        tenantId: count.tenantId,
        projectId: count.projectId,
        accountId: count.accountId,
        amount: Math.abs(count.difference),
        currency: count.currency,
        baseAmount: convertAmount(
          Math.abs(count.difference),
          count.currency,
          consolidationCurrency,
          dailyRate.sell
        ),
        exchangeRate: dailyRate.sell,
        exchangeRateDate: dailyRate.date,
        type: count.difference > 0 ? MovementType.INGRESO : MovementType.EGRESO,
        description: `Ajuste automático de arqueo de caja #${count.id} - Conciliación`,
        status: MovementStatus.POSTED,
        date: count.countDate,
        performedBy: "Sistema - Arqueo Automático",
        approvedBy: count.approvedBy
      };

      movements.unshift(adjustmentMovement);
      // Update balance directly
      account.balance = count.physicalBalance;
    }
  }

  persistAppState();
  res.json(count);
});

// 8. Create Purchase Request
app.post("/api/purchase-requests", (req: Request, res: Response) => {
  const prData = req.body;
  if (!prData.tenantId || !prData.projectId || !prData.title || !prData.categoryId || !prData.items) {
    return res.status(400).json({ error: "Missing required purchase fields" });
  }

  const itemsWithIds = prData.items.map((item: any) => ({
    id: `pri-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    description: item.description,
    quantity: Number(item.quantity),
    unit: item.unit || "Unidad",
    estimatedPrice: Number(item.estimatedPrice),
    actualPrice: item.actualPrice ? Number(item.actualPrice) : undefined,
    supplierId: item.supplierId,
    receivedQuantity: 0
  }));

  const total = itemsWithIds.reduce((sum: number, item: any) => sum + (item.quantity * item.estimatedPrice), 0);

  const newPr: PurchaseRequest = {
    id: `pr-${Date.now()}`,
    tenantId: prData.tenantId,
    projectId: prData.projectId,
    code: `NP-${String(purchaseRequests.length + 85).padStart(3, "0")}`,
    title: prData.title,
    status: PurchaseStatus.PENDING,
    requestedBy: prData.requestedBy || "Jefe de Compras",
    requiredDate: prData.requiredDate || new Date().toISOString().split("T")[0],
    categoryId: prData.categoryId,
    estimatedTotal: total,
    currency: prData.currency || Currency.USD,
    items: itemsWithIds
  };

  purchaseRequests.unshift(newPr);
  persistAppState();
  res.status(201).json(newPr);
});

// 9. Process Purchase Flow (Approve -> RFQ -> Order -> Receive -> Invoice)
app.put("/api/purchase-requests/:id/flow", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, supplierId, itemsActualPrices, receivedQuantities } = req.body;

  const pr = purchaseRequests.find(p => p.id === id);
  if (!pr) {
    return res.status(404).json({ error: "Purchase Request not found" });
  }

  if (action === "APPROVE") {
    pr.status = PurchaseStatus.APPROVED;
  } else if (action === "SEND_RFQ") {
    pr.status = PurchaseStatus.RFQ;
  } else if (action === "PLACE_ORDER") {
    pr.status = PurchaseStatus.ORDERED;
    if (supplierId) {
      pr.items.forEach(item => {
        item.supplierId = supplierId;
        if (itemsActualPrices && itemsActualPrices[item.id]) {
          item.actualPrice = Number(itemsActualPrices[item.id]);
        } else {
          item.actualPrice = item.estimatedPrice; // Default to estimated
        }
      });
      // Recalculate estimated total with actual prices
      pr.estimatedTotal = pr.items.reduce((sum, item) => sum + (item.quantity * (item.actualPrice || item.estimatedPrice)), 0);
    }
  } else if (action === "RECEIVE_GOODS") {
    pr.status = PurchaseStatus.RECEIVED;
    if (receivedQuantities) {
      pr.items.forEach(item => {
        if (receivedQuantities[item.id] !== undefined) {
          item.receivedQuantity = Number(receivedQuantities[item.id]);
        } else {
          item.receivedQuantity = item.quantity; // Assume all received
        }
      });
    } else {
      pr.items.forEach(item => { item.receivedQuantity = item.quantity; });
    }
  } else if (action === "INVOICE_SUPPLIER") {
    pr.status = PurchaseStatus.INVOICED;
  } else if (action === "PAY") {
    pr.status = PurchaseStatus.PAID;

    // Automatically trigger an EGRESO in the project's default financial account
    const defaultAcc = accounts.find(a => a.tenantId === pr.tenantId && a.type === "Banco");
    if (defaultAcc) {
      const actualTotal = pr.items.reduce((sum, item) => sum + ((item.actualPrice || item.estimatedPrice) * (item.receivedQuantity || item.quantity)), 0);
      const tenant = tenants.find(t => t.id === pr.tenantId);
      const consolidationCurrency = tenant?.defaultCurrency || Currency.USD;
      const paymentDate = new Date().toISOString().split("T")[0];
      const dailyRate = await getDailyOfficialRate(paymentDate);
      const invoicePayment: FinancialMovement = {
        id: `mov-pur-${Date.now()}`,
        tenantId: pr.tenantId,
        projectId: pr.projectId,
        accountId: defaultAcc.id,
        counterpartyId: pr.items[0]?.supplierId,
        categoryId: pr.categoryId,
        purchaseRequestId: pr.id,
        amount: actualTotal,
        currency: pr.currency,
        baseAmount: convertAmount(actualTotal, pr.currency, consolidationCurrency, dailyRate.sell),
        exchangeRate: dailyRate.sell,
        exchangeRateDate: dailyRate.date,
        type: MovementType.EGRESO,
        description: `Pago automático Factura Proveedor - OC #${pr.code}: ${pr.title}`,
        status: MovementStatus.POSTED,
        date: paymentDate,
        performedBy: "Sistema de Compras Automático"
      };

      movements.unshift(invoicePayment);
      applyMovementToBalance(invoicePayment);
    }
  } else if (action === "REJECT") {
    pr.status = PurchaseStatus.REJECTED;
  }

  persistAppState();
  res.json(pr);
});

app.post("/api/sales/units", (req: Request, res: Response) => {
  const data = req.body;
  const project = projects.find(item => item.id === data.projectId && item.tenantId === data.tenantId);
  if (!project || !data.name || !data.type || !data.currency || Number(data.price) < 0) {
    return res.status(400).json({ error: "Datos de unidad incompletos o proyecto inválido" });
  }

  const unit: SellableUnit = {
    id: `unit-${Date.now()}`,
    projectId: project.id,
    name: String(data.name).trim(),
    type: data.type as UnitType,
    status: UnitStatus.AVAILABLE,
    surfaceM2: Number(data.surfaceM2) || 0,
    coveredSurfaceM2: Number(data.coveredSurfaceM2) || 0,
    semiCoveredSurfaceM2: Number(data.semiCoveredSurfaceM2) || 0,
    uncoveredSurfaceM2: Number(data.uncoveredSurfaceM2) || 0,
    description: data.description || "",
    view: data.view || "",
    orientation: data.orientation || "",
    floor: data.floor || "",
    rooms: Number(data.rooms) || 0,
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.slice(0, 6) : [],
    financingDescription: data.financingDescription || "",
    price: Number(data.price),
    currency: data.currency as Currency
  };
  sellableUnits.push(unit);
  persistAppState();
  res.status(201).json(unit);
});

app.post("/api/sales/opportunities", (req: Request, res: Response) => {
  const data = req.body;
  const project = projects.find(item => item.id === data.projectId && item.tenantId === data.tenantId);
  const customer = counterparties.find(item => item.id === data.customerId && item.tenantId === data.tenantId && item.type === "Cliente");
  const selectedUnits = sellableUnits.filter(item => data.unitIds?.includes(item.id) && item.projectId === data.projectId);
  if (!project || !customer || selectedUnits.length === 0 || selectedUnits.length !== data.unitIds.length) {
    return res.status(400).json({ error: "Cliente, proyecto o unidades inválidos" });
  }
  if (selectedUnits.some(unit => unit.status === UnitStatus.SOLD)) {
    return res.status(409).json({ error: "Una de las unidades ya fue vendida" });
  }

  const basePrice = selectedUnits.reduce((sum, unit) => sum + unit.price, 0);
  const negotiatedPrice = Number(data.negotiatedPrice) || basePrice;
  const reservationDays = Math.max(0, Number(data.reservationDays) || 0);
  const stage = reservationDays > 0 ? "RESERVED" : (data.stage || "LEAD");
  const createdAt = new Date();
  const opportunity: SalesOpportunity = {
    id: `opp-${Date.now()}`,
    tenantId: data.tenantId,
    projectId: data.projectId,
    customerId: data.customerId,
    unitIds: selectedUnits.map(unit => unit.id),
    title: data.title || `${customer.name} · ${selectedUnits.map(unit => unit.name).join(" + ")}`,
    stage,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    reservationExpiresAt: reservationDays > 0
      ? new Date(createdAt.getTime() + reservationDays * 86400000).toISOString()
      : undefined,
    basePrice,
    negotiatedPrice,
    currency: data.currency || selectedUnits[0].currency,
    discountAmount: basePrice - negotiatedPrice,
    downPayment: Number(data.downPayment) || 0,
    cashPayment: Number(data.cashPayment) || 0,
    installmentCount: Number(data.installmentCount) || 0,
    installmentAmount: Number(data.installmentAmount) || 0,
    reinforcements: Number(data.reinforcements) || 0,
    possessionBalance: Number(data.possessionBalance) || 0,
    financingRate: Number(data.financingRate) || 0,
    indexType: data.indexType || IndexType.NONE,
    baseIndexValue: Number(data.baseIndexValue) || 1,
    commissionType: data.commissionType || "PERCENTAGE",
    commissionValue: Number(data.commissionValue) || 0,
    sellerName: data.sellerName || "",
    nextAction: data.nextAction || "",
    nextActionDate: data.nextActionDate,
    notes: data.notes || "",
    documentUrls: Array.isArray(data.documentUrls) ? data.documentUrls : []
  };
  salesOpportunities.unshift(opportunity);
  if (stage === "RESERVED") selectedUnits.forEach(unit => { unit.status = UnitStatus.RESERVED; });
  persistAppState();
  res.status(201).json(opportunity);
});

app.put("/api/sales/opportunities/:id/stage", (req: Request, res: Response) => {
  const opportunity = salesOpportunities.find(item => item.id === req.params.id);
  if (!opportunity) return res.status(404).json({ error: "Oportunidad no encontrada" });
  const nextStage = req.body.stage as SalesOpportunity["stage"];
  const allowedStages = ["LEAD", "CONTACTED", "VISIT", "NEGOTIATION", "RESERVED", "WON", "LOST", "EXPIRED", "CANCELLED_BY_CLIENT"];
  if (!allowedStages.includes(nextStage)) return res.status(400).json({ error: "Etapa inválida" });
  if (["LOST", "CANCELLED_BY_CLIENT"].includes(nextStage) && !req.body.lossReason) {
    return res.status(400).json({ error: "Debe indicar el motivo de cierre" });
  }

  opportunity.stage = nextStage;
  opportunity.lossReason = req.body.lossReason || opportunity.lossReason;
  opportunity.updatedAt = new Date().toISOString();
  const opportunityUnits = sellableUnits.filter(unit => opportunity.unitIds.includes(unit.id));

  if (["LOST", "EXPIRED", "CANCELLED_BY_CLIENT"].includes(nextStage)) {
    opportunityUnits.forEach(unit => {
      if (unit.status === UnitStatus.RESERVED) unit.status = UnitStatus.AVAILABLE;
    });
  }

  if (nextStage === "WON") {
    const existingContract = salesContracts.find(contract => contract.opportunityId === opportunity.id);
    if (!existingContract) {
      const contractId = `con-${Date.now()}`;
      const contract: SalesContract = {
        id: contractId,
        tenantId: opportunity.tenantId,
        projectId: opportunity.projectId,
        unitId: opportunity.unitIds[0],
        unitIds: opportunity.unitIds,
        opportunityId: opportunity.id,
        customerId: opportunity.customerId,
        contractDate: new Date().toISOString().split("T")[0],
        totalPrice: opportunity.negotiatedPrice,
        currency: opportunity.currency,
        downPayment: opportunity.downPayment,
        installmentCount: opportunity.installmentCount,
        indexType: opportunity.indexType,
        baseIndexValue: opportunity.baseIndexValue,
        status: "ACTIVE",
        cashPayment: opportunity.cashPayment,
        reinforcements: opportunity.reinforcements,
        possessionBalance: opportunity.possessionBalance,
        financingRate: opportunity.financingRate,
        commissionType: opportunity.commissionType,
        commissionValue: opportunity.commissionValue
      };
      salesContracts.unshift(contract);
      opportunityUnits.forEach(unit => {
        unit.status = UnitStatus.SOLD;
        unit.currentOwnerId = opportunity.customerId;
      });
      for (let number = 1; number <= opportunity.installmentCount; number += 1) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + number);
        installments.push({
          id: `inst-${contractId}-${number}`,
          contractId,
          installmentNumber: number,
          originalAmount: opportunity.installmentAmount,
          currency: opportunity.currency,
          dueDate: dueDate.toISOString().split("T")[0],
          indexType: opportunity.indexType,
          indexBaseValue: opportunity.baseIndexValue,
          indexCurrentValue: opportunity.baseIndexValue,
          adjustedAmount: opportunity.installmentAmount,
          paidAmount: 0,
          status: InstallmentStatus.PENDING
        });
      }
    }
  }
  persistAppState();
  res.json(opportunity);
});

// 10. Adjust Installments using CAC/Inflation indices (Section 11.5)
app.post("/api/installments/:id/adjust", (req: Request, res: Response) => {
  const { id } = req.params;
  const { indexCurrentValue } = req.body;

  const inst = installments.find(i => i.id === id);
  if (!inst) {
    return res.status(404).json({ error: "Installment not found" });
  }

  if (!indexCurrentValue || Number(indexCurrentValue) <= 0) {
    return res.status(400).json({ error: "Invalid index value" });
  }

  inst.indexCurrentValue = Number(indexCurrentValue);
  
  // Calculate adjusted amount: originalAmount * (indexCurrentValue / indexBaseValue)
  const ratio = inst.indexCurrentValue / inst.indexBaseValue;
  inst.adjustedAmount = Number((inst.originalAmount * ratio).toFixed(2));

  res.json(inst);
});

// 11. Pay Installment
app.post("/api/installments/:id/pay", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { accountId, paidAmount, date } = req.body;

  const inst = installments.find(i => i.id === id);
  if (!inst) {
    return res.status(404).json({ error: "Installment not found" });
  }

  const activePaidAmt = Number(paidAmount) || inst.adjustedAmount || inst.originalAmount;
  inst.paidAmount = Number((inst.paidAmount + activePaidAmt).toFixed(2));
  
  const finalAmountToPay = inst.adjustedAmount || inst.originalAmount;
  if (inst.paidAmount >= finalAmountToPay * 0.99) {
    inst.status = InstallmentStatus.PAID;
  } else {
    inst.status = InstallmentStatus.PARTIAL;
  }

  // Retrieve contract and customer to build an INGRESO
  const contract = salesContracts.find(c => c.id === inst.contractId);
  if (contract) {
    const activeAcc = accounts.find(a => a.id === accountId) || accounts.find(a => a.tenantId === contract.tenantId && a.type === "Banco");
    
    if (activeAcc) {
      const tenant = tenants.find(t => t.id === contract.tenantId);
      const consolidationCurrency = tenant?.defaultCurrency || Currency.USD;
      const paymentDate = date || new Date().toISOString().split("T")[0];
      const dailyRate = await getDailyOfficialRate(paymentDate);
      // Record financial movement INGRESO
      const installmentIncome: FinancialMovement = {
        id: `mov-inst-${Date.now()}`,
        tenantId: contract.tenantId,
        projectId: contract.projectId,
        accountId: activeAcc.id,
        counterpartyId: contract.customerId,
        amount: activePaidAmt,
        currency: inst.currency,
        baseAmount: convertAmount(activePaidAmt, inst.currency, consolidationCurrency, dailyRate.sell),
        exchangeRate: dailyRate.sell,
        exchangeRateDate: dailyRate.date,
        type: MovementType.INGRESO,
        description: `Cobranza de Cuota #${inst.installmentNumber} - Contrato Unidad ${contract.unitId}`,
        status: MovementStatus.POSTED,
        date: paymentDate,
        performedBy: "Cobranzas Automatizadas"
      };

      movements.unshift(installmentIncome);
      applyMovementToBalance(installmentIncome);
    }
  }

  persistAppState();
  res.json(inst);
});

// 12. Add Project
app.post("/api/projects", (req: Request, res: Response) => {
  const pData = req.body;
  if (!pData.tenantId || !pData.name) {
    return res.status(400).json({ error: "Missing required project fields" });
  }

  const generatedCode = pData.code || `OB-${Date.now().toString().slice(-4)}`;

  const newProj: Project = {
    id: `proj-${Date.now()}`,
    tenantId: pData.tenantId,
    code: generatedCode,
    name: pData.name,
    status: ProjectStatus.DRAFT,
    address: pData.address || "Dirección Obra",
    city: pData.city || "Ciudad Obra",
    startDate: pData.startDate || new Date().toISOString().split("T")[0],
    plannedEndDate: pData.plannedEndDate || new Date(Date.now() + 31536000000 * 2.5).toISOString().split("T")[0], // 2.5 years
    surfaceM2: Number(pData.surfaceM2) || 1000,
    sellableSurfaceM2: Number(pData.sellableSurfaceM2) || 800,
    floors: Number(pData.floors) || 1,
    functionalUnits: Number(pData.functionalUnits) || 10,
    baseCurrency: pData.baseCurrency || Currency.USD,
    estimatedCostPerM2: Number(pData.estimatedCostPerM2) || 1500,
    estimatedTotalCost: (Number(pData.surfaceM2) || 1000) * (Number(pData.estimatedCostPerM2) || 1500),
    physicalProgress: 0,
    financialProgress: 0,
    schedule: [],
    projectType: pData.projectType || "Construcción",
    constructionType: pData.constructionType || "Casa",
    description: pData.description || "",
    certifications: []
  };

  projects.push(newProj);

  // Initialize the complete reference budget for the selected construction type.
  budgetLines.push(...createReferenceBudgetLines(newProj));
  persistAppState();

  res.status(201).json(newProj);
});

// 12a. Update Project status, schedule, or progress
app.put("/api/projects/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const pData = req.body;
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Proyecto no encontrado" });
  }

  if (pData.status !== undefined) project.status = pData.status;
  if (pData.name !== undefined) project.name = pData.name;
  if (pData.address !== undefined) project.address = pData.address;
  if (pData.city !== undefined) project.city = pData.city;
  if (pData.startDate !== undefined) project.startDate = pData.startDate;
  if (pData.projectType !== undefined) project.projectType = pData.projectType;
  if (pData.constructionType !== undefined) project.constructionType = pData.constructionType;
  if (pData.description !== undefined) project.description = pData.description;
  if (pData.surfaceM2 !== undefined) {
    project.surfaceM2 = Number(pData.surfaceM2);
    project.estimatedTotalCost = project.surfaceM2 * project.estimatedCostPerM2;
  }
  if (pData.estimatedCostPerM2 !== undefined) {
    project.estimatedCostPerM2 = Number(pData.estimatedCostPerM2);
    project.estimatedTotalCost = project.surfaceM2 * project.estimatedCostPerM2;
  }
  if (pData.physicalProgress !== undefined) project.physicalProgress = Number(pData.physicalProgress);
  if (pData.financialProgress !== undefined) project.financialProgress = Number(pData.financialProgress);
  if (pData.schedule !== undefined) project.schedule = pData.schedule;
  if (pData.certifications !== undefined) project.certifications = pData.certifications;

  if (
    pData.constructionType !== undefined ||
    pData.surfaceM2 !== undefined ||
    pData.estimatedCostPerM2 !== undefined
  ) {
    budgetLines = budgetLines.filter(line => line.projectId !== project.id);
    budgetLines.push(...createReferenceBudgetLines(project));
  }

  persistAppState();
  res.json(project);
});

// 12b. Edit a budget line and its detail subitems
app.put("/api/budget-lines/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const line = budgetLines.find(item => item.id === id);
  if (!line) {
    return res.status(404).json({ error: "Línea presupuestaria no encontrada" });
  }

  const project = projects.find(item => item.id === line.projectId);
  if (!project) {
    return res.status(404).json({ error: "Proyecto no encontrado" });
  }

  const incidence = Number(req.body.incidence);
  if (!Number.isFinite(incidence) || incidence < 0 || incidence > 100) {
    return res.status(400).json({ error: "El porcentaje debe estar entre 0 y 100" });
  }

  const subitems = Array.isArray(req.body.subitems)
    ? req.body.subitems.map((item: any, index: number) => ({
        id: String(item.id || `bsi-${Date.now()}-${index}`),
        description: String(item.description || "").trim(),
        amount: Math.max(0, Number(item.amount) || 0),
        notes: item.notes ? String(item.notes) : undefined
      })).filter((item: any) => item.description)
    : line.subitems || [];

  line.incidence = Number(incidence.toFixed(2));
  line.amount = Number(((project.estimatedTotalCost * line.incidence) / 100).toFixed(2));
  line.notes = req.body.notes !== undefined ? String(req.body.notes) : line.notes;
  line.subitems = subitems;

  persistAppState();
  return res.json(line);
});

// 12c. Generate schedule with AI (Gemini)
app.post("/api/projects/:id/generate-schedule", async (req: Request, res: Response) => {
  const { id } = req.params;
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Proyecto no encontrado" });
  }

  const getFallbackTasks = (pType?: string, cType?: string) => {
    const isEdificio = cType === "Edificio" || project.name.toLowerCase().includes("torre") || project.name.toLowerCase().includes("edificio");
    const isRefaccion = pType === "Refacción" || pType === "Remodelación";
    
    if (isRefaccion) {
      return [
        { id: `task-gen-1`, taskName: "Desmontajes y Demoliciones", startWeek: 1, endWeek: 3, progress: 0 },
        { id: `task-gen-2`, taskName: "Instalaciones Sanitarias y Eléctricas", startWeek: 2, endWeek: 5, progress: 0 },
        { id: `task-gen-3`, taskName: "Cielorrasos y Revoques", startWeek: 4, endWeek: 7, progress: 0 },
        { id: `task-gen-4`, taskName: "Colocación de Revestimientos y Pisos", startWeek: 6, endWeek: 9, progress: 0 },
        { id: `task-gen-5`, taskName: "Pintura y Colocación de Artefactos", startWeek: 8, endWeek: 11, progress: 0 },
        { id: `task-gen-6`, taskName: "Limpieza Final de Obra", startWeek: 11, endWeek: 12, progress: 0 }
      ];
    } else if (isEdificio) {
      return [
        { id: `task-gen-1`, taskName: "Trabajos Preliminares y Demolición", startWeek: 1, endWeek: 4, progress: 0 },
        { id: `task-gen-2`, taskName: "Excavación y Fundaciones", startWeek: 3, endWeek: 8, progress: 0 },
        { id: `task-gen-3`, taskName: "Estructura de Hormigón Armado", startWeek: 6, endWeek: 16, progress: 0 },
        { id: `task-gen-4`, taskName: "Mampostería y Cerramientos", startWeek: 12, endWeek: 20, progress: 0 },
        { id: `task-gen-5`, taskName: "Instalaciones (Agua, Gas, Electricidad, Climatización)", startWeek: 14, endWeek: 22, progress: 0 },
        { id: `task-gen-6`, taskName: "Yesería, Revoques y Terminaciones de Interiores", startWeek: 18, endWeek: 26, progress: 0 },
        { id: `task-gen-7`, taskName: "Colocación de Carpinterías y Vidrios", startWeek: 20, endWeek: 28, progress: 0 },
        { id: `task-gen-8`, taskName: "Pintura, Detalles y Entrega de Llaves", startWeek: 26, endWeek: 32, progress: 0 }
      ];
    } else {
      return [
        { id: `task-gen-1`, taskName: "Limpieza, Nivelación y Replanteo", startWeek: 1, endWeek: 3, progress: 0 },
        { id: `task-gen-2`, taskName: "Movimiento de Suelos y Fundaciones", startWeek: 2, endWeek: 6, progress: 0 },
        { id: `task-gen-3`, taskName: "Estructura Elevada y Cubierta", startWeek: 5, endWeek: 11, progress: 0 },
        { id: `task-gen-4`, taskName: "Instalaciones Eléctricas, Sanitarias y Térmicas", startWeek: 9, endWeek: 14, progress: 0 },
        { id: `task-gen-5`, taskName: "Revoques, Pisos y Revestimientos", startWeek: 12, endWeek: 17, progress: 0 },
        { id: `task-gen-6`, taskName: "Pintura, Colocación de Sanitarios y Griferías", startWeek: 15, endWeek: 19, progress: 0 },
        { id: `task-gen-7`, taskName: "Limpieza y Entrega", startWeek: 19, endWeek: 20, progress: 0 }
      ];
    }
  };

  if (!ai) {
    console.log("Gemini API Client not initialized. Returning high-fidelity fallback schedule.");
    const schedule = getFallbackTasks(project.projectType, project.constructionType);
    project.schedule = schedule;
    persistAppState();
    return res.json(project);
  }

  try {
    const prompt = `Generate a construction schedule (stages/tasks) for a project with the following properties:
Nombre del Proyecto: ${project.name}
Descripción: ${project.description || "Sin descripción"}
Tipo de Proyecto: ${project.projectType || "Construcción"}
Tipo de Construcción: ${project.constructionType || "Casa"}
Superficie M2: ${project.surfaceM2}
Fecha de Inicio: ${project.startDate}

Provide a coherent, professionally sequenced list of 5 to 8 tasks for this project's schedule.
The tasks should be in Spanish. Output weekly timelines (representing startWeek and endWeek where 1 is the first week).
Each task must have:
- taskName: descriptive Spanish name of the stage (e.g., "Excavación y Cimientos", "Estructura de Hormigón", "Instalaciones Eléctricas")
- startWeek: integer, starting from 1
- endWeek: integer, finishing week (endWeek >= startWeek)
- progress: must be 0

Return a JSON array of these tasks directly matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskName: { type: Type.STRING },
              startWeek: { type: Type.INTEGER },
              endWeek: { type: Type.INTEGER },
              progress: { type: Type.INTEGER }
            },
            required: ["taskName", "startWeek", "endWeek", "progress"]
          }
        }
      }
    });

    const contentText = response.text;
    if (contentText) {
      const generatedTasks = JSON.parse(contentText);
      if (Array.isArray(generatedTasks)) {
        project.schedule = generatedTasks.map((t: any, idx: number) => ({
          id: `task-gen-${Date.now()}-${idx}`,
          taskName: t.taskName || `Etapa ${idx + 1}`,
          startWeek: Number(t.startWeek) || 1,
          endWeek: Number(t.endWeek) || 4,
          progress: 0
        }));
        persistAppState();
        return res.json(project);
      }
    }
    
    const schedule = getFallbackTasks(project.projectType, project.constructionType);
    project.schedule = schedule;
    persistAppState();
    return res.json(project);
  } catch (error) {
    console.error("Error generating schedule via Gemini API:", error);
    const schedule = getFallbackTasks(project.projectType, project.constructionType);
    project.schedule = schedule;
    persistAppState();
    return res.json(project);
  }
});

// 12d. Add Work progress certification
app.post("/api/projects/:id/certifications", (req: Request, res: Response) => {
  const { id } = req.params;
  const { date, physicalProgress, financialProgress, certifiedBy, notes } = req.body;
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Proyecto no encontrado" });
  }

  const newCert = {
    id: `cert-${Date.now()}`,
    projectId: id,
    date: date || new Date().toISOString().split("T")[0],
    physicalProgress: Number(physicalProgress) || 0,
    financialProgress: Number(financialProgress) || 0,
    certifiedBy: certifiedBy || "Director de Obra",
    notes: notes || ""
  };

  if (!project.certifications) {
    project.certifications = [];
  }
  project.certifications.push(newCert);

  // Also update overall project progress to match this latest certification!
  project.physicalProgress = newCert.physicalProgress;
  project.financialProgress = newCert.financialProgress;

  persistAppState();
  res.status(201).json(project);
});

// 12b. Add/Update Counterparty
app.post("/api/counterparties", (req: Request, res: Response) => {
  const { id, tenantId, name, type, taxId, contactName, email, phone } = req.body;
  if (!tenantId || !name || !type) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  if (id) {
    const cp = counterparties.find(c => c.id === id);
    if (cp) {
      cp.name = name;
      cp.type = type;
      cp.taxId = taxId;
      cp.contactName = contactName;
      cp.email = email;
      cp.phone = phone;
      return res.json(cp);
    } else {
      return res.status(404).json({ error: "Contraparte no encontrada" });
    }
  } else {
    const newCp: Counterparty = {
      id: `cnt-${Date.now()}`,
      tenantId,
      name,
      type,
      taxId,
      contactName,
      email,
      phone
    };
    counterparties.push(newCp);
    return res.status(201).json(newCp);
  }
});

// 13. Create Early Consortium Complaint
app.post("/api/consortium/complaints", (req: Request, res: Response) => {
  const reqData = req.body;
  if (!reqData.tenantId || !reqData.projectId || !reqData.customerId || !reqData.description) {
    return res.status(400).json({ error: "Missing required warranty fields" });
  }

  const newMaint: MaintenanceRequest = {
    id: `maint-${Date.now()}`,
    tenantId: reqData.tenantId,
    projectId: reqData.projectId,
    unitId: reqData.unitId || undefined,
    customerId: reqData.customerId,
    reporterName: reqData.reporterName || "Propietario",
    reporterContact: reqData.reporterContact || "Email/Tel",
    description: reqData.description,
    reportedDate: new Date().toISOString().split("T")[0],
    status: "PENDING",
    warrantyCoverage: reqData.warrantyCoverage || "UNDER_INVESTIGATION",
    notes: reqData.notes || ""
  };

  maintenanceRequests.unshift(newMaint);
  res.status(201).json(newMaint);
});

app.put("/api/consortium/complaints/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, warrantyCoverage, notes } = req.body;

  const request = maintenanceRequests.find(m => m.id === id);
  if (!request) {
    return res.status(404).json({ error: "Warranty request not found" });
  }

  if (status) request.status = status;
  if (warrantyCoverage) request.warrantyCoverage = warrantyCoverage;
  if (notes) request.notes = notes;

  res.json(request);
});

// 14. Create Public Tender on Marketplace
app.post("/api/tenders", (req: Request, res: Response) => {
  const tendData = req.body;
  if (!tendData.tenantId || !tendData.projectId || !tendData.title || !tendData.category) {
    return res.status(400).json({ error: "Missing required tender fields" });
  }

  const newTender: PublicTender = {
    id: `tend-${Date.now()}`,
    tenantId: tendData.tenantId,
    projectId: tendData.projectId,
    code: `LIC-NEW-${String(publicTenders.length + 10).padStart(2, "0")}`,
    title: tendData.title,
    description: tendData.description || "",
    deadline: tendData.deadline || new Date(Date.now() + 31536000000 / 12).toISOString().split("T")[0], // 1 month deadline
    category: tendData.category,
    status: "OPEN",
    bids: []
  };

  publicTenders.unshift(newTender);
  res.status(201).json(newTender);
});

// 15. Submit Supplier Bid on Public Tender
app.post("/api/marketplace/bids", (req: Request, res: Response) => {
  const { tenderId, supplierId, amount, currency, deliveryWeeks, notes } = req.body;
  if (!tenderId || !supplierId || !amount) {
    return res.status(400).json({ error: "Missing required bid details" });
  }

  const tender = publicTenders.find(t => t.id === tenderId);
  const supplier = marketplaceSuppliers.find(s => s.id === supplierId);

  if (!tender || !supplier) {
    return res.status(404).json({ error: "Tender or Supplier not found" });
  }

  const newBid = {
    id: `bid-${Date.now()}`,
    supplierId: supplier.id,
    supplierName: supplier.name,
    amount: Number(amount),
    currency: currency || Currency.USD,
    deliveryWeeks: Number(deliveryWeeks) || 4,
    notes: notes || "",
    status: "PENDING" as "PENDING" | "ACCEPTED" | "REJECTED"
  };

  tender.bids.push(newBid);
  res.status(201).json(newBid);
});

// 16. Award Public Tender Bid
app.put("/api/tenders/:tenderId/award/:bidId", (req: Request, res: Response) => {
  const { tenderId, bidId } = req.params;

  const tender = publicTenders.find(t => t.id === tenderId);
  if (!tender) {
    return res.status(404).json({ error: "Tender not found" });
  }

  const winningBid = tender.bids.find(b => b.id === bidId);
  if (!winningBid) {
    return res.status(404).json({ error: "Bid not found" });
  }

  tender.status = "AWARDED";
  tender.bids.forEach(b => {
    b.status = b.id === bidId ? "ACCEPTED" : "REJECTED";
  });

  // Automatically convert winning bid into an approved Purchase Request/Order for the Tenant
  const items = [
    {
      id: `pri-${Date.now()}-win`,
      description: `Suministro adjudicado en licitación ${tender.code}: ${tender.title}`,
      quantity: 1,
      unit: "Global",
      estimatedPrice: winningBid.amount,
      actualPrice: winningBid.amount,
      supplierId: winningBid.supplierId,
      receivedQuantity: 0
    }
  ];

  const contractOrder: PurchaseRequest = {
    id: `pr-${Date.now()}-contract`,
    tenantId: tender.tenantId,
    projectId: tender.projectId,
    code: `NP-${String(purchaseRequests.length + 85).padStart(3, "0")}`,
    title: `Contrato Adjudicado: ${tender.title}`,
    status: PurchaseStatus.ORDERED, // Directly ordered from supplier
    requestedBy: "Sistema de Licitaciones",
    requiredDate: new Date(Date.now() + winningBid.deliveryWeeks * 7 * 24 * 3600 * 1000).toISOString().split("T")[0],
    estimatedTotal: winningBid.amount,
    currency: winningBid.currency,
    items
  };

  purchaseRequests.unshift(contractOrder);

  res.json({ tender, purchaseOrder: contractOrder });
});

// 17. OCR Document Upload & Gemini Extraction Endpoint (Section 11.6)
app.post("/api/ocr", async (req: Request, res: Response) => {
  const { tenantId, fileData, fileName, mimeType } = req.body;

  if (!tenantId || !fileData) {
    return res.status(400).json({ error: "Missing required fields tenantId and fileData" });
  }

  console.log(`Processing OCR Request for file: ${fileName || "unnamed"} (${mimeType || "unknown IANA"})`);

  // Define high-fidelity fallback parser in case Gemini is disabled or key is missing
  const getSimulatedOcrResult = () => {
    const isTerminaciones = fileName?.toLowerCase().includes("pintura") || fileName?.toLowerCase().includes("revestimiento");
    const isEstructura = fileName?.toLowerCase().includes("hierro") || fileName?.toLowerCase().includes("hormigon") || fileName?.toLowerCase().includes("acero");
    const isSani = fileName?.toLowerCase().includes("plomeria") || fileName?.toLowerCase().includes("baño") || fileName?.toLowerCase().includes("sanitario");

    let suggestedCategory = "cat-1-1"; // Limpieza
    let issuer = "Ferretería El Industrial S.A.";
    let amount = 325000;
    let taxAmount = 68250;
    let currency = Currency.ARS;

    if (isTerminaciones) {
      suggestedCategory = "cat-4-1"; // Yesería y Pintura
      issuer = "Pinturerías Prestigio S.A.";
      amount = 485000;
      taxAmount = 101850;
    } else if (isEstructura) {
      suggestedCategory = "cat-2-2"; // Hierro y Armaduras
      issuer = "Siderar Aceros del Norte";
      amount = 12500;
      taxAmount = 0; // Moneda USD
      currency = Currency.USD;
    } else if (isSani) {
      suggestedCategory = "cat-3-1"; // Sanitaria
      issuer = "Sanitarios Gaona S.R.L.";
      amount = 950000;
      taxAmount = 199500;
    }

    const docNum = `Factura B-0002-${Math.floor(Math.random() * 90000) + 10000}`;
    return {
      date: new Date().toISOString().split("T")[0],
      issuer,
      documentNumber: docNum,
      amount,
      taxAmount,
      currency,
      categoryId: suggestedCategory,
      confidence: 0.88,
      rawText: `SIMULACIÓN OCR HIGH FIDELITY - ${issuer}. CUIT 30-99432109-2. COMPROBANTE DE COMPRA ${docNum}. Neto: $${(amount - taxAmount).toLocaleString()}. IVA: $${taxAmount.toLocaleString()}. Total: $${amount.toLocaleString()} ${currency}. Para Obra Lelfun.`
    };
  };

  // If Gemini client is enabled, perform OCR using multi-modal capabilities of gemini-3.5-flash
  if (ai) {
    try {
      const systemInstruction = `You are an expert AI Invoice OCR reader for Spanish/Latin American construction companies.
Analyze the provided document (invoice, receipt, or "comprobante") and extract details as JSON.
Always map to one of these Lelfun Category IDs if applicable:
- cat-1-1: Limpieza y Cercos
- cat-1-2: Movimiento de Suelos
- cat-2-1: Hormigón Elaborado
- cat-2-2: Hierro y Armaduras
- cat-2-3: Mano de Obra Estructura
- cat-3-1: Instalación Sanitaria
- cat-3-2: Instalación Eléctrica
- cat-4-1: Yesería y Pintura
- cat-4-2: Aberturas y Cristales
- cat-4-3: Revestimientos

Respond ONLY with valid JSON containing:
{
  "date": "YYYY-MM-DD" (extracted document date),
  "issuer": "Merchant Name S.A.",
  "documentNumber": "Factura Number",
  "amount": numeric total amount,
  "taxAmount": numeric tax or IVA amount,
  "currency": "ARS" or "USD" or "BRL" based on currency symbol,
  "categoryId": "cat-..." matching suggested category,
  "confidence": float 0 to 1,
  "rawText": "A string summary of key terms found on the invoice"
}`;

      // Convert fileData (base64 string) to part
      const base64Clean = fileData.replace(/^data:.*,/, "");
      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/png",
          data: base64Clean
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          imagePart,
          { text: "Extract the details of this invoice following your system instructions." }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              issuer: { type: Type.STRING },
              documentNumber: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              taxAmount: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              categoryId: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              rawText: { type: Type.STRING }
            },
            required: ["date", "issuer", "documentNumber", "amount", "currency", "confidence", "rawText"]
          }
        }
      });

      const rawJson = response.text?.trim() || "{}";
      const parsed = JSON.parse(rawJson);

      const ocrDocResult: OcrDocument = {
        id: `doc-${Date.now()}`,
        tenantId,
        fileName: fileName || "comprobante_captura.png",
        date: parsed.date,
        issuer: parsed.issuer,
        documentNumber: parsed.documentNumber,
        amount: parsed.amount,
        taxAmount: parsed.taxAmount || 0,
        currency: parsed.currency as Currency || Currency.USD,
        categoryId: parsed.categoryId || "cat-1-1",
        confidence: parsed.confidence || 0.90,
        status: "PENDING_VALIDATION",
        rawText: parsed.rawText || "Parsed via Gemini API"
      };

      ocrDocuments.unshift(ocrDocResult);
      return res.status(200).json(ocrDocResult);

    } catch (error: any) {
      console.error("Gemini OCR extraction failed, rolling back to simulated fallback:", error);
      const simulated = getSimulatedOcrResult();
      const ocrDocResult: OcrDocument = {
        id: `doc-${Date.now()}`,
        tenantId,
        fileName: fileName || "comprobante_fallback.png",
        ...simulated,
        status: "PENDING_VALIDATION"
      };
      ocrDocuments.unshift(ocrDocResult);
      return res.status(200).json(ocrDocResult);
    }
  } else {
    // If Gemini not configured, return high-fidelity simulation
    const simulated = getSimulatedOcrResult();
    const ocrDocResult: OcrDocument = {
      id: `doc-${Date.now()}`,
      tenantId,
      fileName: fileName || "comprobante_simulado.png",
      ...simulated,
      status: "PENDING_VALIDATION"
    };
    ocrDocuments.unshift(ocrDocResult);
    return res.status(200).json(ocrDocResult);
  }
});

// 18. Historical Budget Projection Helper Endpoint (Section 11.2)
app.post("/api/budget-helper", async (req: Request, res: Response) => {
  const { projectId, comProjects, surfaceM2, estimatedCostPerM2 } = req.body;

  if (!projectId || !surfaceM2 || !estimatedCostPerM2) {
    return res.status(400).json({ error: "Missing required simulation fields" });
  }

  const referenceProject = projects.find(project => project.id === projectId);
  if (!referenceProject) {
    return res.status(404).json({ error: "Proyecto no encontrado" });
  }

  const template = getBudgetTemplate(referenceProject.constructionType);
  const templateName = template === HOUSE_BUDGET_TEMPLATE ? "Casa" : "Edificio";
  const totalCost = Number(surfaceM2) * Number(estimatedCostPerM2);
  const results = template.map((item, index) => ({
    code: String(index + 1).padStart(2, "0"),
    name: item.name,
    suggestedIncidence: item.incidence,
    suggestedAmount: Number(((totalCost * item.incidence) / 100).toFixed(2)),
    justification: `Incidencia de referencia para ${templateName} según Tr3sR Contabilidad v12.0.`
  }));

  results.forEach(result => {
    const matchingLine = budgetLines.find(
      line => line.projectId === projectId && line.code === result.code
    );
    if (matchingLine) {
      matchingLine.suggestedIncidence = result.suggestedIncidence;
      matchingLine.suggestedAmount = result.suggestedAmount;
      matchingLine.notes = result.justification;
    }
  });

  persistAppState();
  return res.status(200).json(results);

  /*
  console.log(`Calculating budget projection for project ID ${projectId} using comparison weights...`);

  // Retrieve comparable projects and compile actual distributions
  const compWeights: { [key: string]: number } = comProjects; // { 'proj-palermo-historico': 0.6, 'proj-madero-historico': 0.4 }

  // Fallback programmatic weighted math in case Gemini is disabled
  const calculateProgrammaticSplit = () => {
    const totalWeight = Object.values(compWeights).reduce((a, b) => a + b, 0) || 1.0;
    
    // Core categories we want to distribute
    const categoriesToDistribute = [
      { code: "01", name: "Trabajos Preliminares" },
      { code: "02", name: "Estructura de Hormigón" },
      { code: "03", name: "Instalaciones Básicas" },
      { code: "04", name: "Terminaciones" }
    ];

    const results = categoriesToDistribute.map(cat => {
      let weightedIncidenceSum = 0;

      Object.entries(compWeights).forEach(([projId, weight]) => {
        const bl = budgetLines.find(b => b.projectId === projId && b.code === cat.code);
        if (bl) {
          weightedIncidenceSum += bl.incidence * weight;
        } else {
          // default backup splits if lines aren't loaded
          const defs: { [key: string]: number } = { "01": 5.5, "02": 42.0, "03": 24.5, "04": 28.0 };
          weightedIncidenceSum += defs[cat.code] * weight;
        }
      });

      const suggestedIncidence = Number((weightedIncidenceSum / totalWeight).toFixed(2));
      const projTotalCost = Number(surfaceM2) * Number(estimatedCostPerM2);
      const suggestedAmount = Number(((projTotalCost * suggestedIncidence) / 100).toFixed(2));

      return {
        code: cat.code,
        name: cat.name,
        suggestedIncidence,
        suggestedAmount,
        justification: `Calculado mediante promedio ponderado de proyectos históricos (${Object.keys(compWeights).join(", ")}) con ponderación del ${(compWeights[Object.keys(compWeights)[0]] || 0.5) * 100}%`
      };
    });

    return results;
  };

  if (ai) {
    try {
      const programmaticResults = calculateProgrammaticSplit();
      const promptString = `I am planning a construction project with a surface of ${surfaceM2}m2 at an estimated cost of ${estimatedCostPerM2} per m2.
The total estimated budget is ${Number(surfaceM2) * Number(estimatedCostPerM2)}.
We calculated a weighted distribution from comparable closed projects:
${JSON.stringify(programmaticResults, null, 2)}

Provide expert construction engineering advice in Spanish (max 100 words per category) explaining WHY this distribution is correct, adjusting it slightly if there are known factors, and outputting the final suggested budget splits.
Return ONLY valid JSON:
{
  "projectedLines": [
    {
      "code": "01",
      "name": "Trabajos Preliminares",
      "suggestedIncidence": 6.0,
      "suggestedAmount": amount,
      "justification": "justification in Spanish"
    },
    ... for all 4 categories: 01, 02, 03, 04 ...
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptString,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              projectedLines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    name: { type: Type.STRING },
                    suggestedIncidence: { type: Type.NUMBER },
                    suggestedAmount: { type: Type.NUMBER },
                    justification: { type: Type.STRING }
                  },
                  required: ["code", "name", "suggestedIncidence", "suggestedAmount", "justification"]
                }
              }
            },
            required: ["projectedLines"]
          }
        }
      });

      const parsed = JSON.parse(response.text?.trim() || "{}");
      if (parsed.projectedLines && parsed.projectedLines.length > 0) {
        // Update the active project lines in our memory
        parsed.projectedLines.forEach((pLine: any) => {
          const matchingActiveLine = budgetLines.find(bl => bl.projectId === projectId && bl.code === pLine.code);
          if (matchingActiveLine) {
            matchingActiveLine.suggestedIncidence = pLine.suggestedIncidence;
            matchingActiveLine.suggestedAmount = pLine.suggestedAmount;
            matchingActiveLine.notes = pLine.justification;
          }
        });
        return res.status(200).json(parsed.projectedLines);
      }
    } catch (err) {
      console.error("Gemini budget suggestion failed, falling back to programmatic splits:", err);
    }
  }

  // Programmatic fallback
  const fallbackResults = calculateProgrammaticSplit();
  fallbackResults.forEach((pLine: any) => {
    const matchingActiveLine = budgetLines.find(bl => bl.projectId === projectId && bl.code === pLine.code);
    if (matchingActiveLine) {
      matchingActiveLine.suggestedIncidence = pLine.suggestedIncidence;
      matchingActiveLine.suggestedAmount = pLine.suggestedAmount;
      matchingActiveLine.notes = pLine.justification;
    }
  });

  res.status(200).json(fallbackResults);
  */
});

// ---------------------------------------------------------
// STARTUP AND VITE MIDDLEWARE INTERACTION
// ---------------------------------------------------------
async function startServer() {
  const refreshOfficialRate = async () => {
    try {
      await getDailyOfficialRate();
    } catch (error) {
      console.error("No se pudo guardar la cotización oficial diaria:", error);
    }
  };
  await refreshOfficialRate();
  setInterval(refreshOfficialRate, 60 * 60 * 1000);

  // Vite dev middleware for development environment
  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite middleware in development...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static assets serving
    const distPath = path.join(process.cwd(), "dist");
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lelfun server running on port ${PORT}`);
  });
}

export { app };
export default app;

// Vercel imports the Express application as a serverless function. A local or
// container deployment still starts the traditional long-running HTTP server.
if (!process.env.VERCEL) {
  void startServer();
}
