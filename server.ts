/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
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

// Setup JSON body parsing with high limit for base64 file uploads
app.use(express.json({ limit: "20mb" }));

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

// Historical budgets for projection (Torre Alvear has current, Palermo and Madero are used as database of Closed historical costs)
let budgetLines: BudgetLine[] = [
  // Torre Alvear (Project Alvear - active budget)
  { id: "bl-1", projectId: "proj-alvear", categoryId: "cat-1", code: "01", name: "Trabajos Preliminares", amount: 882000, incidence: 6.0, suggestedIncidence: 5.5, suggestedAmount: 808500, notes: "Ajustado con excavación profunda" },
  { id: "bl-2", projectId: "proj-alvear", categoryId: "cat-2", code: "02", name: "Estructura de Hormigón", amount: 5880000, incidence: 40.0, suggestedIncidence: 42.0, suggestedAmount: 6174000, notes: "Incluye losas postensadas" },
  { id: "bl-3", projectId: "proj-alvear", categoryId: "cat-3", code: "03", name: "Instalaciones Básicas", amount: 3675000, incidence: 25.0, suggestedIncidence: 24.5, suggestedAmount: 3601500, notes: "Alineado con cotización contratista" },
  { id: "bl-4", projectId: "proj-alvear", categoryId: "cat-4", code: "04", name: "Terminaciones", amount: 4263000, incidence: 29.0, suggestedIncidence: 28.0, suggestedAmount: 4116000, notes: "Calidad premium importada" },

  // Palermo Zen (Historical database of real costs - Project Palermo Historico)
  { id: "bl-p1", projectId: "proj-palermo-historico", categoryId: "cat-1", code: "01", name: "Trabajos Preliminares", amount: 360000, incidence: 5.0 }, // 5% of 7.2M
  { id: "bl-p2", projectId: "proj-palermo-historico", categoryId: "cat-2", code: "02", name: "Estructura de Hormigón", amount: 3096000, incidence: 43.0 }, // 43%
  { id: "bl-p3", projectId: "proj-palermo-historico", categoryId: "cat-3", code: "03", name: "Instalaciones Básicas", amount: 1656000, incidence: 23.0 }, // 23%
  { id: "bl-p4", projectId: "proj-palermo-historico", categoryId: "cat-4", code: "04", name: "Terminaciones", amount: 2088000, incidence: 29.0 }, // 29%

  // Madero Office (Historical database of real costs - Project Madero Historico)
  { id: "bl-m1", projectId: "proj-madero-historico", categoryId: "cat-1", code: "01", name: "Trabajos Preliminares", amount: 1512000, incidence: 6.0 }, // 6% of 25.2M
  { id: "bl-m2", projectId: "proj-madero-historico", categoryId: "cat-2", code: "02", name: "Estructura de Hormigón", amount: 10332000, incidence: 41.0 }, // 41%
  { id: "bl-m3", projectId: "proj-madero-historico", categoryId: "cat-3", code: "03", name: "Instalaciones Básicas", amount: 6552000, incidence: 26.0 }, // 26%
  { id: "bl-m4", projectId: "proj-madero-historico", categoryId: "cat-4", code: "04", name: "Terminaciones", amount: 6804000, incidence: 27.0 } // 27%
];

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
app.post("/api/tenants", (req: Request, res: Response) => {
  const tData = req.body;
  if (!tData.name) {
    return res.status(400).json({ error: "Falta el nombre de la empresa" });
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
app.post("/api/marketplace-suppliers", (req: Request, res: Response) => {
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
    verified: true,
    empresa: sData.name,
    cuit: sData.cuit || ""
  };

  marketplaceSuppliers.push(newSupplier);
  res.status(201).json(newSupplier);
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

// 3. Central Synchronization State Endpoint (returns isolated tenant data)
app.get("/api/state", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) {
    return res.status(400).json({ error: "Missing tenantId parameter" });
  }

  // Filter global database based on the tenant context
  const tenantProjects = projects.filter(p => p.tenantId === tenantId);
  const tenantProjectIds = tenantProjects.map(p => p.id);

  const tenantAccounts = accounts.filter(a => a.tenantId === tenantId);
  const tenantCounterparties = counterparties.filter(c => c.tenantId === tenantId);
  const tenantCategories = costCategories.filter(c => c.tenantId === tenantId);
  
  // Filter movements belonging directly to tenant accounts
  const tenantAccountIds = tenantAccounts.map(a => a.id);
  const tenantMovements = movements.filter(m => tenantAccountIds.includes(m.accountId));
  const tenantCashCounts = cashCounts.filter(cc => tenantAccountIds.includes(cc.accountId));

  const tenantBudgetLines = budgetLines.filter(bl => tenantProjectIds.includes(bl.projectId));
  const tenantPurchaseRequests = purchaseRequests.filter(pr => pr.tenantId === tenantId);
  const tenantUnits = sellableUnits.filter(u => tenantProjectIds.includes(u.projectId));
  
  const tenantContractIds = salesContracts.filter(sc => sc.tenantId === tenantId).map(c => c.id);
  const tenantContracts = salesContracts.filter(sc => sc.tenantId === tenantId);
  const tenantInstallments = installments.filter(inst => tenantContractIds.includes(inst.contractId));
  
  const tenantDocuments = ocrDocuments.filter(doc => doc.tenantId === tenantId);
  const tenantCondos = earlyCondominiums.filter(cond => cond.tenantId === tenantId);
  const tenantMaintenance = maintenanceRequests.filter(m => m.tenantId === tenantId);

  // Global tenders where the active tenant is the creator, or all public tenders
  const tenantTenders = publicTenders.filter(t => t.tenantId === tenantId);

  const tenantProfile = tenants.find(t => t.id === tenantId) || tenants[0];

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
    contracts: tenantContracts,
    installments: tenantInstallments,
    documents: tenantDocuments,
    earlyCondominiums: tenantCondos,
    maintenanceRequests: tenantMaintenance,
    tenders: tenantTenders,
    marketplaceSuppliers, // Global catalog is public
    tenantProfile
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
  const { name, currency, type, balance } = req.body;
  if (!name || !currency) {
    return res.status(400).json({ error: "Nombre y moneda requeridos" });
  }

  const tenant = tenants.find(t => t.id === id);
  if (!tenant) {
    return res.status(404).json({ error: "Empresa no encontrada" });
  }

  const newAccount: FinancialAccount = {
    id: `acc-${Date.now()}`,
    tenantId: id,
    name,
    type: type || "Banco",
    currency: currency as Currency,
    balance: Number(balance) || 0
  };

  accounts.push(newAccount);
  res.status(201).json(newAccount);
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
app.post("/api/movements", (req: Request, res: Response) => {
  const movementData = req.body;
  if (!movementData.tenantId || !movementData.accountId || !movementData.amount || !movementData.type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate ID
  const newMovement: FinancialMovement = {
    id: `mov-${Date.now()}`,
    tenantId: movementData.tenantId,
    projectId: movementData.projectId,
    accountId: movementData.accountId,
    targetAccountId: movementData.targetAccountId,
    counterpartyId: movementData.counterpartyId,
    categoryId: movementData.categoryId,
    amount: Number(movementData.amount),
    currency: movementData.currency || Currency.USD,
    baseAmount: Number(movementData.baseAmount) || Number(movementData.amount),
    exchangeRate: Number(movementData.exchangeRate) || 1.0,
    exchangeRateDate: movementData.exchangeRateDate || new Date().toISOString().split("T")[0],
    type: movementData.type,
    description: movementData.description || "",
    status: movementData.status || MovementStatus.DRAFT,
    date: movementData.date || new Date().toISOString().split("T")[0],
    performedBy: movementData.performedBy || "Administración Central"
  };

  movements.unshift(newMovement);

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
  res.status(201).json(newCount);
});

// 7. Approve Cash Count (Balances update to Physical Balance if differences found)
app.put("/api/cash-counts/:id/approve", (req: Request, res: Response) => {
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
      // Create a compensatory movement automatically
      const adjustmentMovement: FinancialMovement = {
        id: `mov-adj-${Date.now()}`,
        tenantId: count.tenantId,
        projectId: count.projectId,
        accountId: count.accountId,
        amount: Math.abs(count.difference),
        currency: count.currency,
        baseAmount: Math.abs(count.difference),
        exchangeRate: 1.0,
        exchangeRateDate: count.countDate,
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

  res.json(count);
});

// 8. Create Purchase Request
app.post("/api/purchase-requests", (req: Request, res: Response) => {
  const prData = req.body;
  if (!prData.tenantId || !prData.projectId || !prData.title || !prData.items) {
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
  res.status(201).json(newPr);
});

// 9. Process Purchase Flow (Approve -> RFQ -> Order -> Receive -> Invoice)
app.put("/api/purchase-requests/:id/flow", (req: Request, res: Response) => {
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
      const invoicePayment: FinancialMovement = {
        id: `mov-pur-${Date.now()}`,
        tenantId: pr.tenantId,
        projectId: pr.projectId,
        accountId: defaultAcc.id,
        counterpartyId: pr.items[0]?.supplierId,
        categoryId: pr.categoryId,
        amount: actualTotal,
        currency: pr.currency,
        baseAmount: pr.currency === Currency.USD ? actualTotal : actualTotal / exchangeRates.ARS_USD_MEP,
        exchangeRate: pr.currency === Currency.USD ? 1.0 : exchangeRates.ARS_USD_MEP,
        exchangeRateDate: new Date().toISOString().split("T")[0],
        type: MovementType.EGRESO,
        description: `Pago automático Factura Proveedor - OC #${pr.code}: ${pr.title}`,
        status: MovementStatus.POSTED,
        date: new Date().toISOString().split("T")[0],
        performedBy: "Sistema de Compras Automático"
      };

      movements.unshift(invoicePayment);
      applyMovementToBalance(invoicePayment);
    }
  } else if (action === "REJECT") {
    pr.status = PurchaseStatus.REJECTED;
  }

  res.json(pr);
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
app.post("/api/installments/:id/pay", (req: Request, res: Response) => {
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
      // Record financial movement INGRESO
      const installmentIncome: FinancialMovement = {
        id: `mov-inst-${Date.now()}`,
        tenantId: contract.tenantId,
        projectId: contract.projectId,
        accountId: activeAcc.id,
        counterpartyId: contract.customerId,
        amount: activePaidAmt,
        currency: inst.currency,
        baseAmount: inst.currency === Currency.USD ? activePaidAmt : activePaidAmt / exchangeRates.ARS_USD_MEP,
        exchangeRate: inst.currency === Currency.USD ? 1.0 : exchangeRates.ARS_USD_MEP,
        exchangeRateDate: date || new Date().toISOString().split("T")[0],
        type: MovementType.INGRESO,
        description: `Cobranza de Cuota #${inst.installmentNumber} - Contrato Unidad ${contract.unitId}`,
        status: MovementStatus.POSTED,
        date: date || new Date().toISOString().split("T")[0],
        performedBy: "Cobranzas Automatizadas"
      };

      movements.unshift(installmentIncome);
      applyMovementToBalance(installmentIncome);
    }
  }

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

  // Initialize basic budget lines for this project
  const tenantCats = costCategories.filter(c => c.tenantId === pData.tenantId && !c.parentId);
  tenantCats.forEach((cat, index) => {
    // Generate standard split distributions (e.g. 10%, 40%, 20%, 30%)
    const standardSplits = [10, 40, 20, 30];
    const incidence = standardSplits[index % standardSplits.length];
    const amt = (newProj.estimatedTotalCost * incidence) / 100;

    budgetLines.push({
      id: `bl-${Date.now()}-${index}`,
      projectId: newProj.id,
      categoryId: cat.id,
      code: cat.code,
      name: cat.name,
      amount: amt,
      incidence: incidence,
      notes: "Inicializado automáticamente"
    });
  });

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

  res.json(project);
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
        return res.json(project);
      }
    }
    
    const schedule = getFallbackTasks(project.projectType, project.constructionType);
    project.schedule = schedule;
    return res.json(project);
  } catch (error) {
    console.error("Error generating schedule via Gemini API:", error);
    const schedule = getFallbackTasks(project.projectType, project.constructionType);
    project.schedule = schedule;
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
  if (!reqData.tenantId || !reqData.projectId || !reqData.unitId || !reqData.description) {
    return res.status(400).json({ error: "Missing required warranty fields" });
  }

  const newMaint: MaintenanceRequest = {
    id: `maint-${Date.now()}`,
    tenantId: reqData.tenantId,
    projectId: reqData.projectId,
    unitId: reqData.unitId,
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

  if (!projectId || !comProjects || !surfaceM2 || !estimatedCostPerM2) {
    return res.status(400).json({ error: "Missing required simulation fields" });
  }

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
});

// ---------------------------------------------------------
// STARTUP AND VITE MIDDLEWARE INTERACTION
// ---------------------------------------------------------
async function startServer() {
  // Vite dev middleware for development environment
  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite middleware in development...");
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

startServer();
