/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Currency {
  ARS = "ARS",
  USD = "USD",
  BRL = "BRL"
}

export enum MovementStatus {
  DRAFT = "DRAFT",
  PENDING_VALIDATION = "PENDING_VALIDATION",
  OBSERVED = "OBSERVED",
  APPROVED = "APPROVED",
  POSTED = "POSTED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  REVERSED = "REVERSED"
}

export enum MovementType {
  INGRESO = "INGRESO",
  EGRESO = "EGRESO",
  TRANSFERENCIA = "TRANSFERENCIA"
}

export enum ProjectStatus {
  DRAFT = "DRAFT",
  PLANNING = "PLANNING",
  PRE_CONSTRUCTION = "PRE_CONSTRUCTION",
  IN_PROGRESS = "IN_PROGRESS",
  PAUSED = "PAUSED",
  DELIVERED = "DELIVERED",
  WARRANTY = "WARRANTY",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}

export enum UnitType {
  UNIDAD_FUNCIONAL = "UNIDAD_FUNCIONAL",
  DEPARTAMENTO = "DEPARTAMENTO",
  CASA = "CASA",
  COCHERA = "COCHERA",
  LOCAL = "LOCAL",
  OFICINA = "OFICINA",
  BAULERA = "BAULERA",
  LOTE = "LOTE"
}

export enum UnitStatus {
  AVAILABLE = "AVAILABLE",
  BLOCKED = "BLOCKED",
  RESERVED = "RESERVED",
  PRE_SOLD = "PRE_SOLD",
  SOLD = "SOLD",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED"
}

export enum InstallmentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
  PARTIAL = "PARTIAL"
}

export enum IndexType {
  CAC = "CAC", // Cámara Argentina de la Construcción
  INFLATION = "INFLATION", // IPC / Inflación general
  NONE = "NONE"
}

export enum PurchaseStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  RFQ = "RFQ",
  ORDERED = "ORDERED",
  RECEIVED = "RECEIVED",
  INVOICED = "INVOICED",
  PAID = "PAID",
  REJECTED = "REJECTED"
}

export interface Tenant {
  id: string;
  name: string;
  defaultCurrency: Currency;
  logoUrl?: string;
  enabledCurrencies: Currency[];
  nombreFantasia?: string;
  razonSocial?: string;
  webPage?: string;
  phone?: string;
  legalAddress?: string;
  commercialAddress?: string;
  companyType?: string;
  cuit?: string;
  iibbType?: string;
  activeUsers?: { name: string; email: string; role: string; active: boolean; }[];
  deposits?: { id: string; name: string; address: string; }[];
  subscription?: { planName: string; activeUntil: string; maxProjects: number; costPerMonth: number; status: string; };
}

export interface Project {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: ProjectStatus;
  address: string;
  city: string;
  startDate: string;
  plannedEndDate: string;
  surfaceM2: number;
  sellableSurfaceM2: number;
  floors: number;
  functionalUnits: number;
  baseCurrency: Currency;
  estimatedCostPerM2: number;
  estimatedTotalCost: number;
  physicalProgress: number; // 0 - 100
  financialProgress: number; // 0 - 100
  schedule?: ProjectTask[];
  projectType?: string; // Construcción, Emprendimiento, Refacción, Remodelación
  constructionType?: string; // Casa, Edificio, Local, Nave Industrial, etc.
  description?: string;
  certifications?: ProjectCertification[];
}

export interface ProjectCertification {
  id: string;
  projectId: string;
  date: string;
  physicalProgress: number;
  financialProgress: number;
  certifiedBy: string;
  notes?: string;
}

export interface ProjectTask {
  id: string;
  taskName: string;
  startWeek: number;
  endWeek: number;
  progress: number;
}

export interface FinancialAccount {
  id: string;
  tenantId: string;
  name: string;
  type: "Caja" | "Banco" | "Tarjeta" | "Caja Fuerte";
  currency: Currency;
  balance: number;
}

export interface Counterparty {
  id: string;
  tenantId: string;
  name: string;
  type: "Cliente" | "Proveedor" | "Contratista" | "Inversor";
  taxId?: string; // CUIT / CNPJ
  contactName?: string;
  email?: string;
  phone?: string;
}

export interface CostCategory {
  id: string;
  tenantId: string;
  parentId?: string;
  code: string;
  name: string;
  isLeaf: boolean;
}

export interface FinancialMovement {
  id: string;
  tenantId: string;
  projectId?: string;
  accountId: string;
  targetAccountId?: string; // Para transferencias
  counterpartyId?: string;
  categoryId?: string;
  purchaseRequestId?: string;
  amount: number;
  currency: Currency;
  baseAmount: number; // En moneda base (ej. USD)
  exchangeRate: number;
  exchangeRateDate: string;
  type: MovementType;
  description: string;
  status: MovementStatus;
  date: string;
  performedBy: string;
  approvedBy?: string;
  auditTrail?: {
    action: string;
    userId: string;
    date: string;
    notes?: string;
  }[];
}

export interface CashCount {
  id: string;
  tenantId: string;
  accountId: string;
  projectId?: string;
  countDate: string;
  systemBalance: number;
  physicalBalance: number;
  difference: number;
  currency: Currency;
  status: "OPEN" | "PENDING_APPROVAL" | "APPROVED" | "OBSERVED";
  performedBy: string;
  approvedBy?: string;
  notes?: string;
}

export interface BudgetLine {
  id: string;
  projectId: string;
  categoryId: string;
  code: string;
  name: string;
  amount: number;
  incidence: number; // Porcentaje del presupuesto total
  suggestedIncidence?: number; // Generado por el proyector de históricos
  suggestedAmount?: number;
  notes?: string;
  subitems?: BudgetSubitem[];
}

export interface BudgetSubitem {
  id: string;
  description: string;
  amount: number;
  notes?: string;
}

export interface PurchaseRequest {
  id: string;
  tenantId: string;
  projectId: string;
  code: string;
  title: string;
  status: PurchaseStatus;
  requestedBy: string;
  requiredDate: string;
  costCenterId?: string;
  categoryId?: string;
  estimatedTotal: number;
  currency: Currency;
  items: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  actualPrice?: number;
  supplierId?: string;
  receivedQuantity?: number;
}

export interface SellableUnit {
  id: string;
  projectId: string;
  name: string; // Ej. "Piso 4 - Dpto B"
  type: UnitType;
  status: UnitStatus;
  surfaceM2: number;
  coveredSurfaceM2?: number;
  semiCoveredSurfaceM2?: number;
  uncoveredSurfaceM2?: number;
  description?: string;
  view?: string;
  orientation?: string;
  floor?: string;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  imageUrls?: string[];
  financingDescription?: string;
  price: number;
  currency: Currency;
  currentOwnerId?: string;
}

export interface SalesContract {
  id: string;
  tenantId: string;
  projectId: string;
  unitId: string;
  unitIds?: string[];
  opportunityId?: string;
  customerId: string;
  contractDate: string;
  totalPrice: number;
  currency: Currency;
  downPayment: number;
  installmentCount: number;
  indexType: IndexType;
  baseIndexValue: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  cashPayment?: number;
  reinforcements?: number;
  possessionBalance?: number;
  financingRate?: number;
  commissionType?: "PERCENTAGE" | "FIXED";
  commissionValue?: number;
}

export type SalesOpportunityStage =
  | "LEAD"
  | "CONTACTED"
  | "VISIT"
  | "NEGOTIATION"
  | "RESERVED"
  | "WON"
  | "LOST"
  | "EXPIRED"
  | "CANCELLED_BY_CLIENT";

export interface SalesOpportunity {
  id: string;
  tenantId: string;
  projectId: string;
  customerId?: string;
  unitIds: string[];
  title: string;
  stage: SalesOpportunityStage;
  createdAt: string;
  updatedAt: string;
  reservationExpiresAt?: string;
  basePrice: number;
  negotiatedPrice: number;
  currency: Currency;
  discountAmount: number;
  downPayment: number;
  cashPayment: number;
  installmentCount: number;
  installmentAmount: number;
  reinforcements: number;
  possessionBalance: number;
  financingRate: number;
  indexType: IndexType;
  baseIndexValue: number;
  commissionType?: "PERCENTAGE" | "FIXED";
  commissionValue?: number;
  sellerName?: string;
  nextAction?: string;
  nextActionDate?: string;
  notes?: string;
  lossReason?: string;
  documentUrls?: string[];
}

export interface Installment {
  id: string;
  contractId: string;
  installmentNumber: number;
  originalAmount: number;
  currency: Currency;
  dueDate: string;
  indexType: IndexType;
  indexBaseValue: number;
  indexCurrentValue: number;
  adjustedAmount: number;
  paidAmount: number;
  status: InstallmentStatus;
}

export interface OcrDocument {
  id: string;
  tenantId: string;
  projectId?: string;
  fileName: string;
  fileUrl?: string;
  date?: string;
  issuer?: string;
  documentNumber?: string;
  amount?: number;
  taxAmount?: number;
  currency?: Currency;
  categoryId?: string;
  confidence: number;
  status: "PENDING_VALIDATION" | "PROCESSED" | "REJECTED";
  rawText?: string;
}

export interface EarlyCondominium {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  handoverDate: string;
  maintenanceMonths: number;
  units: {
    unitId: string;
    ownerName: string;
    contactEmail: string;
    handoverDate: string;
    occupied: boolean;
  }[];
}

export interface MaintenanceRequest {
  id: string;
  tenantId: string;
  projectId: string;
  unitId?: string;
  customerId?: string;
  reporterName: string;
  reporterContact: string;
  description: string;
  reportedDate: string;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  warrantyCoverage: "COVERED" | "NOT_COVERED" | "UNDER_INVESTIGATION";
  notes?: string;
}

export interface MarketplaceSupplier {
  id: string;
  name: string;
  categories: string[];
  serviceAreas: string[];
  rating: number;
  reviewCount: number;
  contactEmail: string;
  verified: boolean;
  empresa?: string;
  cuit?: string;
}

export interface PublicTender {
  id: string;
  tenantId: string; // Tenant que emite la licitación
  projectId: string;
  code: string;
  title: string;
  description: string;
  deadline: string;
  category: string;
  status: "OPEN" | "CLOSED" | "AWARDED";
  bids: {
    id: string;
    supplierId: string;
    supplierName: string;
    amount: number;
    currency: Currency;
    deliveryWeeks: number;
    notes?: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
  }[];
}
