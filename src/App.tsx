/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent } from "react";
import { 
  Project, 
  FinancialAccount, 
  Counterparty, 
  CostCategory, 
  FinancialMovement, 
  CashCount, 
  BudgetLine, 
  PurchaseRequest, 
  SalesOpportunity,
  SellableUnit, 
  SalesContract, 
  Installment, 
  OcrDocument, 
  EarlyCondominium, 
  MaintenanceRequest, 
  PublicTender, 
  MarketplaceSupplier,
  Currency,
  Tenant,
  ProjectStatus
} from "./types.js";

// Import modular panels
import FinancePanel from "./components/FinancePanel.js";
import BudgetPanel from "./components/BudgetPanel.js";
import ProcurementPanel from "./components/ProcurementPanel.js";
import SalesPanel from "./components/SalesPanel.js";
import OcrPanel from "./components/OcrPanel.js";
import ConsortiumPanel from "./components/ConsortiumPanel.js";
import MarketplacePanel from "./components/MarketplacePanel.js";
import TenantProfilePanel from "./components/TenantProfilePanel.js";
import SuperAdminPanel from "./components/SuperAdminPanel.js";
import PublicMarketplace from "./components/PublicMarketplace.js";

// Import Landing, Login and SignUp
import LandingAndAuth from "./components/LandingAndAuth.js";
import { supabase } from "./supabaseClient.js";

// Icons
import { 
  Hammer, 
  Wallet, 
  TrendingUp, 
  ShoppingCart, 
  Sparkles, 
  Building2, 
  Award, 
  RefreshCw, 
  MapPin, 
  Layers, 
  Percent, 
  Calendar, 
  Clock, 
  Plus, 
  Check, 
  X, 
  FileText,
  Menu,
  ChevronRight,
  Pin,
  PinOff,
  GitBranch,
  ArrowRight,
  DollarSign,
  CheckCircle2,
  ShoppingBag,
  Gavel,
  Edit2,
  Trash2,
  LogOut
} from "lucide-react";

// Multi-tenant profile definitions
const TENANT_PROFILES = [
  { id: "tenant-lelfun", name: "Lelfun Desarrollos S.A.", cuit: "30-71409581-2", defaultCurrency: Currency.USD },
  { id: "tenant-norte", name: "Norte Obras Civiles S.R.L.", cuit: "30-58421094-1", defaultCurrency: Currency.ARS },
  { id: "tenant-alianza", name: "Alianza Construtora Ltda.", cuit: "12-34567890-9", defaultCurrency: Currency.BRL }
];

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'register' | 'app' | 'superadmin' | 'marketplace-public'>('landing');
  const [sessionUser, setSessionUser] = useState<{ email: string; name: string; role: string; tenantId: string; isMarketplaceSupplier?: boolean; modules?: string[] } | null>(null);
  
  const [activeTenantId, setActiveTenantId] = useState("tenant-lelfun");
  const [userEmail, setUserEmail] = useState("");
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [activeTab, setActiveTab] = useState("control-obra");
  const [marketplaceSection, setMarketplaceSection] = useState("catalog");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncTimestamp, setSyncTimestamp] = useState<string>("");
  const [tenantProfile, setTenantProfile] = useState<Tenant | null>(null);

  // Backend state storage
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [cashCounts, setCashCounts] = useState<CashCount[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [salesOpportunities, setSalesOpportunities] = useState<SalesOpportunity[]>([]);
  const [units, setUnits] = useState<SellableUnit[]>([]);
  const [contracts, setContracts] = useState<SalesContract[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [documents, setDocuments] = useState<OcrDocument[]>([]);
  const [earlyCondominiums, setEarlyCondominiums] = useState<EarlyCondominium[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [tenders, setTenders] = useState<PublicTender[]>([]);
  const [marketplaceSuppliers, setMarketplaceSuppliers] = useState<MarketplaceSupplier[]>([]);

  // Project selected state
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showProjectDetail, setShowProjectDetail] = useState(false);
  const [showBudgetDetail, setShowBudgetDetail] = useState(false);

  // Form states for creating a project
  const [showAddProject, setShowAddProject] = useState(false);
  const [projName, setProjName] = useState("");
  const [projLoc, setProjLoc] = useState("");
  const [projSurface, setProjSurface] = useState("");
  const [projCostM2, setProjCostM2] = useState("");
  const [projCurr, setProjCurr] = useState(Currency.USD);
  const [projType, setProjType] = useState("Construcción");
  const [projConstructionType, setProjConstructionType] = useState("Casa");
  const [projStartDate, setProjStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [projDescription, setProjDescription] = useState("");

  const [exchangeRates, setExchangeRates] = useState({
    ARS_USD_OFICIAL: 1,
    BRL_USD: 5.45,
    date: "",
    updatedAt: ""
  });
  const [consolidation, setConsolidation] = useState({
    currency: Currency.USD,
    totalLiquidity: 0
  });

  // Fetch complete centralized state from the backend
  const fetchTenantState = async (tenantId: string) => {
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`/api/state?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        throw new Error("Falla al recuperar los datos del servidor.");
      }
      const data = await response.json();

      setProjects(data.projects || []);
      setAccounts(data.accounts || []);
      setCounterparties(data.counterparties || []);
      setCategories(data.categories || []);
      setMovements(data.movements || []);
      setCashCounts(data.cashCounts || []);
      setBudgetLines(data.budgetLines || []);
      setPurchaseRequests(data.purchaseRequests || []);
      setSalesOpportunities(data.opportunities || []);
      setUnits(data.units || []);
      setContracts(data.contracts || []);
      setInstallments(data.installments || []);
      setDocuments(data.documents || []);
      setEarlyCondominiums(data.earlyCondominiums || []);
      setMaintenanceRequests(data.maintenanceRequests || []);
      setTenders(data.tenders || []);
      setMarketplaceSuppliers(data.marketplaceSuppliers || []);
      setTenantProfile(data.tenantProfile || null);
      if (data.exchangeRates) setExchangeRates(data.exchangeRates);
      if (data.consolidation) setConsolidation(data.consolidation);

      // Auto-select first project of the tenant if none selected or invalid
      const firstProj = data.projects?.[0];
      if (firstProj && (!selectedProjectId || !data.projects.find((p: any) => p.id === selectedProjectId))) {
        setSelectedProjectId(firstProj.id);
      }

      setSyncTimestamp(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Detect connected user and assign active tenant on mount
    const detectUserAndTenant = async () => {
      // A fresh page load must always begin at the public landing. Clear only
      // the active session markers; tenant registration data remains intact.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (error) {
        console.warn("No se pudo limpiar la sesión anterior de Supabase", error);
      }
      localStorage.removeItem("lelf_user_email");
      localStorage.removeItem("lelf_user_name");
      localStorage.setItem("lelf_logged_out", "true");
      setSessionUser(null);
      setUserEmail("");
      setCurrentView("landing");
      setIsLoading(false);
      return;

      // If the user explicitly logged out, do not perform automatic login
      if (localStorage.getItem("lelf_logged_out") === "true") {
        setCurrentView("landing");
        setIsLoading(false);
        return;
      }

      let resolvedEmail = "";
      let resolvedName = "";
      let resolvedIsSupplier = false;

      // 1. Check active Supabase Auth session first
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          resolvedEmail = session.user.email || "";
          resolvedIsSupplier = localStorage.getItem(`is_supplier_${resolvedEmail}`) === "true";
          resolvedName = session.user.user_metadata?.nombre || resolvedEmail.split("@")[0];
        }
      } catch (e) {
        console.warn("Error checking Supabase session, trying fallback", e);
      }

      // 2. Check local persistence override if no active session
      if (!resolvedEmail) {
        const localEmail = localStorage.getItem("lelf_user_email");
        if (localEmail) {
          resolvedEmail = localEmail;
          resolvedIsSupplier = localStorage.getItem(`is_supplier_${localEmail}`) === "true";
          resolvedName = localStorage.getItem("lelf_user_name") || localEmail.split("@")[0];
        }
      }

      // If we detected a logged-in user, fetch their mapped tenant profile from the server
      if (resolvedEmail) {
        let tenantId = localStorage.getItem(`tenant_id_${resolvedEmail}`) || "";
        let userRole = resolvedIsSupplier ? "Proveedor Marketplace" : "Administrador General";

        try {
          const res = await fetch(`/api/me?user_email=${encodeURIComponent(resolvedEmail)}&tenant_id=${encodeURIComponent(tenantId)}`);
          if (res.ok) {
            const me = await res.json();
            if (me.tenantId) {
              tenantId = me.tenantId;
              localStorage.setItem(`tenant_id_${resolvedEmail}`, me.tenantId);
              userRole = me.role || userRole;
              resolvedName = me.name || resolvedName;
            }
          }
        } catch (err) {
          console.warn("Could not query server /api/me", err);
        }

        if (!tenantId) {
          tenantId = "tenant-lelfun";
        }

        setUserEmail(resolvedEmail);
        setActiveTenantId(tenantId);
        setSessionUser({
          email: resolvedEmail,
          name: resolvedName,
          role: userRole,
          tenantId: tenantId,
          isMarketplaceSupplier: resolvedIsSupplier
        });

        if (resolvedIsSupplier) {
          setActiveTab("proveedores-licitaciones");
        }
        setCurrentView("app");
        return;
      }

      // 3. Fallback backend auto-detect
      try {
        const localTenantId = localStorage.getItem("tenant_id_mariano.telespazio@gmail.com") || "";
        const response = await fetch(`/api/me?tenant_id=${encodeURIComponent(localTenantId)}`);
        if (response.ok) {
          const userData = await response.json();
          setUserEmail(userData.email);
          setActiveTenantId(userData.tenantId);
          
          setSessionUser({
            email: userData.email,
            name: userData.name || "Mariano Telespazio",
            role: userData.role || "Administrador General",
            tenantId: userData.tenantId,
            isMarketplaceSupplier: false
          });
          setCurrentView("app");
        } else {
          setCurrentView("landing");
        }
      } catch (err) {
        console.error("Falla al auto-detectar tenant/usuario:", err);
        setCurrentView("landing");
      }
    };
    detectUserAndTenant();
  }, []);

  useEffect(() => {
    if (currentView === "app" && sessionUser && !sessionUser.isMarketplaceSupplier) {
      fetchTenantState(activeTenantId);
    }
  }, [activeTenantId, currentView, sessionUser?.tenantId, sessionUser?.isMarketplaceSupplier]);

  const activeTenantProfile = useMemo(() => {
    // 1. If we have a tenantProfile from server, and its ID matches the activeTenantId, use it!
    if (tenantProfile && tenantProfile.id === activeTenantId) {
      return tenantProfile;
    }
    
    // 2. Check local TENANT_PROFILES list
    const found = TENANT_PROFILES.find(p => p.id === activeTenantId);
    if (found) return found;

    // 3. Check localStorage for custom registered tenant info
    const cachedName = localStorage.getItem(`tenant_name_${activeTenantId}`);
    if (cachedName) {
      return {
        id: activeTenantId,
        name: cachedName,
        cuit: localStorage.getItem(`tenant_cuit_${activeTenantId}`) || "N/A",
        defaultCurrency: (localStorage.getItem(`tenant_currency_${activeTenantId}`) as any) || Currency.USD,
        logoUrl: localStorage.getItem(`tenant_logo_${activeTenantId}`) || ""
      };
    }

    // 4. Default fallback
    return TENANT_PROFILES[0];
  }, [tenantProfile, activeTenantId]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const orderedProjectTasks = useMemo(() => {
    const tasks = activeProject?.schedule || [];
    const roots = tasks.filter(task => !task.parentTaskId);
    return roots.flatMap(root => [root, ...tasks.filter(task => task.parentTaskId === root.id)]);
  }, [activeProject?.schedule]);

  // Lifecycle/Editing states
  const [editingProjectDetails, setEditingProjectDetails] = useState(false);
  const [showingTaskPlanner, setShowingTaskPlanner] = useState(false);
  const [showingProgressCertifier, setShowingProgressCertifier] = useState(false);

  // Edit fields
  const [editProjName, setEditProjName] = useState("");
  const [editProjLoc, setEditProjLoc] = useState("");
  const [editProjSurface, setEditProjSurface] = useState("");
  const [editProjCostM2, setEditProjCostM2] = useState("");
  const [editProjType, setEditProjType] = useState("Construcción");
  const [editProjConstructionType, setEditProjConstructionType] = useState("Casa");
  const [editProjStartDate, setEditProjStartDate] = useState("");
  const [editProjDescription, setEditProjDescription] = useState("");

  // Task Planner fields
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("1");
  const [newTaskEnd, setNewTaskEnd] = useState("4");
  const [newTaskProgress, setNewTaskProgress] = useState("0");
  const [newTaskParentId, setNewTaskParentId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskPlannerError, setTaskPlannerError] = useState("");
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

  // Certifier fields
  const [certPhysical, setCertPhysical] = useState("0");
  const [certFinancial, setCertFinancial] = useState("0");
  const [certDate, setCertDate] = useState(new Date().toISOString().split("T")[0]);
  const [certCertifiedBy, setCertCertifiedBy] = useState("Director de Obra");
  const [certTaskId, setCertTaskId] = useState("");
  const [certAmount, setCertAmount] = useState("");
  const [certInvoiceNumber, setCertInvoiceNumber] = useState("");
  const [certReceiptNumber, setCertReceiptNumber] = useState("");
  const [certNotes, setCertNotes] = useState("");
  const [certError, setCertError] = useState("");

  // Step definitions based on user request:
  // Nuevo Proyecto -> Presupuesto -> Plan (cronograma de tareas) -> Ejecución -> Cierre
  const projectSteps = [
    { 
      status: ProjectStatus.DRAFT, 
      name: "Nuevo Proyecto", 
      sub: "Inicio & Registro",
      desc: "El proyecto ha sido inicializado. En esta fase se configuran los datos generales, ubicación, m² constructivos y valores estimados iniciales."
    },
    { 
      status: ProjectStatus.PRE_CONSTRUCTION, 
      name: "Presupuesto", 
      sub: "Definición Costos",
      desc: "En esta fase se genera y detalla el presupuesto por rubros (Cimentación, Estructura, Albañilería, etc.). Conectado con el Módulo de Presupuestos."
    },
    { 
      status: ProjectStatus.PLANNING, 
      name: "Plan (Cronograma)", 
      sub: "Gantt de Tareas",
      desc: "Planificación de plazos, asignación de semanas y tareas en el cronograma (Gantt) previo al inicio físico de los trabajos de obra."
    },
    { 
      status: ProjectStatus.IN_PROGRESS, 
      name: "Ejecución", 
      sub: "Construcción Activa",
      desc: "La obra está en marcha física. Se realizan compras, egresos y se registran certificaciones periódicas de avance de obra."
    },
    { 
      status: ProjectStatus.CLOSED, 
      name: "Cierre de Obra", 
      sub: "Finalización Auditada",
      desc: "La obra se encuentra completada y cerrada administrativamente. Todas las unidades están construidas y listas o entregadas."
    }
  ];

  // Helper to get active step index
  const getProjectStepIndex = (proj: Project | null) => {
    if (!proj) return 0;
    switch (proj.status) {
      case ProjectStatus.DRAFT: return 0;
      case ProjectStatus.PRE_CONSTRUCTION: return 1;
      case ProjectStatus.PLANNING: return 2;
      case ProjectStatus.IN_PROGRESS:
      case ProjectStatus.PAUSED:
        return 3;
      case ProjectStatus.CLOSED:
      case ProjectStatus.DELIVERED:
      case ProjectStatus.WARRANTY:
        return 4;
      default: return 0;
    }
  };

  // Helper to map step index to ProjectStatus
  const getStatusFromStepIndex = (idx: number): ProjectStatus => {
    switch (idx) {
      case 0: return ProjectStatus.DRAFT;
      case 1: return ProjectStatus.PRE_CONSTRUCTION;
      case 2: return ProjectStatus.PLANNING;
      case 3: return ProjectStatus.IN_PROGRESS;
      case 4: return ProjectStatus.CLOSED;
      default: return ProjectStatus.DRAFT;
    }
  };

  // Sync edit form states when opening details modal
  useEffect(() => {
    if (activeProject) {
      setEditProjName(activeProject.name);
      setEditProjLoc(activeProject.address || "");
      setEditProjSurface(String(activeProject.surfaceM2));
      setEditProjCostM2(String(activeProject.estimatedCostPerM2));
      setCertPhysical(String(activeProject.physicalProgress));
      setCertFinancial(String(activeProject.financialProgress));
      setEditProjType(activeProject.projectType || "Construcción");
      setEditProjConstructionType(activeProject.constructionType || "Casa");
      setEditProjStartDate(activeProject.startDate || "");
      setEditProjDescription(activeProject.description || "");
    }
  }, [activeProject, editingProjectDetails, showingProgressCertifier]);

  const handleAdvanceProjectStep = async (proj: Project) => {
    const currentStepIdx = getProjectStepIndex(proj);
    if (currentStepIdx >= 4) return;
    const nextStatus = getStatusFromStepIndex(currentStepIdx + 1);

    try {
      const response = await fetch(`/api/projects/${proj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) {
        await fetchTenantState(activeTenantId);
        if (nextStatus === ProjectStatus.PRE_CONSTRUCTION) {
          setShowBudgetDetail(true);
          setActiveTab("presupuestos");
        }
      }
    } catch (err) {
      console.error("Error al avanzar fase del proyecto:", err);
    }
  };

  const handleRegressProjectStep = async (proj: Project) => {
    const currentStepIdx = getProjectStepIndex(proj);
    if (currentStepIdx <= 0) return;
    const prevStatus = getStatusFromStepIndex(currentStepIdx - 1);

    try {
      const response = await fetch(`/api/projects/${proj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: prevStatus })
      });
      if (response.ok) {
        fetchTenantState(activeTenantId);
      }
    } catch (err) {
      console.error("Error al retroceder fase del proyecto:", err);
    }
  };

  const handleUpdateProjectDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    try {
      const response = await fetch(`/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProjName,
          address: editProjLoc,
          surfaceM2: Number(editProjSurface),
          estimatedCostPerM2: Number(editProjCostM2),
          projectType: editProjType,
          constructionType: editProjConstructionType,
          startDate: editProjStartDate,
          description: editProjDescription
        })
      });
      if (response.ok) {
        setEditingProjectDetails(false);
        fetchTenantState(activeTenantId);
      }
    } catch (err) {
      console.error("Error al actualizar detalles del proyecto:", err);
    }
  };

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newTaskName) return;

    setTaskPlannerError("");
    try {
      const response = await fetch(`/api/projects/${activeProject.id}/tasks${editingTaskId ? `/${editingTaskId}` : ""}`, {
        method: editingTaskId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: newTaskName,
          startWeek: Number(newTaskStart),
          endWeek: Number(newTaskEnd),
          progress: Number(newTaskProgress),
          parentTaskId: editingTaskId ? undefined : (newTaskParentId || undefined)
        })
      });
      if (response.ok) {
        setNewTaskName("");
        setNewTaskStart("1");
        setNewTaskEnd("4");
        setNewTaskProgress("0");
        setNewTaskParentId("");
        setEditingTaskId(null);
        fetchTenantState(activeTenantId);
      } else {
        const payload = await response.json().catch(() => null);
        setTaskPlannerError(payload?.error || "No se pudo guardar la tarea.");
      }
    } catch (err) {
      console.error("Error al agregar tarea:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeProject) return;
    setTaskPlannerError("");
    try {
      const response = await fetch(`/api/projects/${activeProject.id}/tasks/${taskId}`, { method: "DELETE" });
      if (response.ok) {
        fetchTenantState(activeTenantId);
      } else {
        const payload = await response.json().catch(() => null);
        setTaskPlannerError(payload?.error || "No se pudo eliminar la tarea.");
      }
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
    }
  };

  const startEditingTask = (task: NonNullable<Project["schedule"]>[number]) => {
    setEditingTaskId(task.id);
    setNewTaskName(task.taskName);
    setNewTaskStart(String(task.startWeek));
    setNewTaskEnd(String(task.endWeek));
    setNewTaskProgress(String(task.progress));
    setNewTaskParentId(task.parentTaskId || "");
    setTaskPlannerError("");
  };

  const startAddingSubtask = (parentTaskId: string) => {
    setEditingTaskId(null);
    setNewTaskName("");
    setNewTaskStart("1");
    setNewTaskEnd("4");
    setNewTaskProgress("0");
    setNewTaskParentId(parentTaskId);
    setTaskPlannerError("");
  };

  const handleCertifyProgress = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    setCertError("");
    try {
      const response = await fetch(`/api/projects/${activeProject.id}/certifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: certDate,
          physicalProgress: Number(certPhysical),
          financialProgress: Number(certFinancial),
          certifiedBy: certCertifiedBy,
          taskId: certTaskId,
          amount: certAmount,
          invoiceNumber: certInvoiceNumber,
          receiptNumber: certReceiptNumber,
          notes: certNotes
        })
      });
      if (response.ok) {
        setShowingProgressCertifier(false);
        setCertTaskId("");
        setCertAmount("");
        setCertInvoiceNumber("");
        setCertReceiptNumber("");
        setCertNotes("");
        fetchTenantState(activeTenantId);
      } else {
        const payload = await response.json().catch(() => null);
        setCertError(payload?.error || "No se pudo registrar la certificación.");
      }
    } catch (err) {
      console.error("Error al certificar avance:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase signout failed", e);
    }
    localStorage.setItem("lelf_logged_out", "true");
    localStorage.removeItem("lelf_user_email");
    localStorage.removeItem("lelf_user_name");
    setUserEmail("");
    setSessionUser(null);
    setCurrentView("landing");
  };

  const handleGenerateScheduleAI = async () => {
    if (!activeProject) return;
    setIsGeneratingSchedule(true);
    try {
      const response = await fetch(`/api/projects/${activeProject.id}/generate-schedule`, {
        method: "POST"
      });
      if (response.ok) {
        fetchTenantState(activeTenantId);
      } else {
        console.error("Falla al generar cronograma");
      }
    } catch (err) {
      console.error("Error al generar cronograma:", err);
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  // Handle Project Creation
  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!projName || !projLoc || !projSurface || !projCostM2) return;

    try {
      const surface = Number(projSurface);
      const costPerM2 = Number(projCostM2);
      const totalCost = surface * costPerM2;

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: activeTenantId,
          name: projName,
          address: projLoc,
          surfaceM2: surface,
          estimatedCostPerM2: costPerM2,
          estimatedTotalCost: totalCost,
          baseCurrency: projCurr,
          startDate: projStartDate,
          projectType: projType,
          constructionType: projConstructionType,
          description: projDescription
        })
      });

      if (response.ok) {
        setShowAddProject(false);
        setProjName("");
        setProjLoc("");
        setProjSurface("");
        setProjCostM2("");
        setProjType("Construcción");
        setProjConstructionType("Casa");
        setProjStartDate(new Date().toISOString().split("T")[0]);
        setProjDescription("");
        await fetchTenantState(activeTenantId);
        setShowProjectDetail(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // KPI Calculations
  const totalConsolidatedLiquidity = consolidation.totalLiquidity;

  const averagePhysicalProgress = useMemo(() => {
    if (projects.length === 0) return 0;
    const sum = projects.reduce((acc, p) => acc + p.physicalProgress, 0);
    return Math.round(sum / projects.length);
  }, [projects]);

  if (currentView === "superadmin") {
    return <SuperAdminPanel onLogout={handleLogout} />;
  }

  if (currentView === "marketplace-public") {
    return <PublicMarketplace authenticated={Boolean(sessionUser)} projects={projects} onBack={() => setCurrentView(sessionUser ? "app" : "landing")} onLogin={() => setCurrentView("login")} onRegister={() => setCurrentView("register")} onOpenPortal={() => {
      if (!sessionUser) { setCurrentView("login"); return; }
      setActiveTab("marketplace");
      setMarketplaceSection(sessionUser.isMarketplaceSupplier ? "supplier" : "catalog");
      setCurrentView("app");
    }} />;
  }

  if (currentView !== "app") {
    return (
      <LandingAndAuth 
        onOpenMarketplace={() => setCurrentView("marketplace-public")}
        onLoginSuccess={async (email, _tenantId, userName, _isSupplier) => {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) {
            await handleLogout();
            alert("No se pudo validar la sesión.");
            return;
          }
          const accessResponse = await fetch("/api/auth/access-context", { headers: { Authorization: `Bearer ${token}` } });
          const access = await accessResponse.json();
          if (!accessResponse.ok) {
            await handleLogout();
            alert(access.error || "El usuario no tiene acceso habilitado.");
            return;
          }
          localStorage.removeItem("lelf_logged_out");
          setUserEmail(email);
          if (access.environment === "SUPERADMIN") {
            setSessionUser({ email, name: userName, role: "Superadmin", tenantId: "platform" });
            setCurrentView("superadmin");
            return;
          }
          const isSupplier = access.environment === "SUPPLIER";
          const tenantId = isSupplier ? access.supplier.supplier_id : (access.tenant.local_tenant_id || access.tenant.tenant_id);
          if (!isSupplier && access.license?.blocked) {
            await handleLogout();
            alert("La licencia del tenant está suspendida o vencida. Contacte al administrador de Lelfun.");
            return;
          }
          const marketplaceBuyer = access.license?.subscription_plans?.code === "MARKETPLACE_BUYER";
          const modules = isSupplier || marketplaceBuyer ? ["marketplace"] : access.tenant.role === "purchasing_manager" ? ["marketplace"] : ["owner", "admin"].includes(access.tenant.role)
            ? ["projects", "treasury", "budgets", "procurement", "sales", "consortium", "ocr", "marketplace", "tenant_settings"]
            : (access.tenant.tenant_member_modules || []).filter((module: any) => module.can_read).map((module: any) => module.module_key);
          setActiveTenantId(tenantId);
          if (!isSupplier && access.tenantProfile) {
            setTenantProfile(access.tenantProfile);
            localStorage.setItem(`tenant_id_${email}`, tenantId);
            localStorage.setItem(`tenant_name_${tenantId}`, access.tenantProfile.name || "");
            localStorage.setItem(`tenant_cuit_${tenantId}`, access.tenantProfile.cuit || "");
            localStorage.setItem(`tenant_currency_${tenantId}`, access.tenantProfile.defaultCurrency || Currency.ARS);
          }
          setSessionUser({
            email,
            name: userName,
            role: isSupplier ? access.supplier.role : access.tenant.role,
            tenantId,
            isMarketplaceSupplier: isSupplier,
            modules
          });
          
          if (isSupplier || marketplaceBuyer) {
            setActiveTab("marketplace");
            setMarketplaceSection(isSupplier ? "supplier" : "catalog");
          } else {
            const moduleToTab: Record<string, string> = { projects: "control-obra", treasury: "tesoreria-caja", budgets: "presupuestos", procurement: "compras", sales: "ventas", consortium: "consorcio", ocr: "ocr", marketplace: "marketplace", tenant_settings: "tenant-profile" };
            setActiveTab(moduleToTab[modules[0]] || "marketplace");
          }
          
          setCurrentView("app");
          if (!isSupplier && !marketplaceBuyer) fetchTenantState(tenantId);
        }}
        initialView={currentView === "landing" ? "landing" : (currentView === "login" ? "login" : "register")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800 antialiased" id="lelfun-app-root">
      
      {/* 1. Sidebar Container (Left) */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-slate-900 text-white flex flex-col border-r border-slate-800 transition-all duration-300 ${
        sidebarPinned ? "w-64" : "w-16 md:hover:w-64 group shadow-2xl max-md:w-64"
      } ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 overflow-hidden">
          <div className={`flex items-center transition-all duration-300 ${sidebarPinned ? "gap-2.5" : "gap-0 md:group-hover:gap-2.5"}`}>
            <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/lelfun.png" alt="Lelfun" className="w-full h-full object-cover" />
            </div>
            <div className={`transition-all duration-300 overflow-hidden ${
              sidebarPinned 
                ? "w-auto opacity-100" 
                : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100 max-md:w-auto max-md:opacity-100"
            }`}>
              <h1 className="font-extrabold font-display text-[14px] tracking-tight leading-tight whitespace-nowrap">
                LELFUN <span className="text-[9px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1 py-0.2 rounded-sm uppercase tracking-wider">SaaS</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-mono tracking-wide whitespace-nowrap">
                {sessionUser?.isMarketplaceSupplier ? "Portal de Proveedores" : "ERP Obras & Ingesta OCR"}
              </p>
            </div>
          </div>
          {/* Action buttons (Pin on desktop, Close on mobile) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSidebarPinned(!sidebarPinned)}
              className={`hidden md:block p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-850 cursor-pointer transition-colors ${
                sidebarPinned ? "" : "opacity-0 md:group-hover:opacity-100"
              }`}
              title={sidebarPinned ? "Desanclar barra" : "Fijar barra"}
            >
              {sidebarPinned ? <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <Pin className="w-3.5 h-3.5 rotate-45" />}
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)} 
              className="md:hidden p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tenant Profile Section (Auto-detected, no dropdown) */}
        {!sessionUser?.isMarketplaceSupplier && (
        <div className="p-4 border-b border-slate-800 bg-slate-950/25 shrink-0 overflow-hidden">
          <div className={`transition-all duration-300 ${
            sidebarPinned 
              ? "block" 
              : "hidden md:group-hover:block max-md:block"
          }`}>
            <label className="block text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Empresa Conectada</label>
            <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-800 p-2 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{activeTenantProfile.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{userEmail || "Auto-detectando..."}</p>
              </div>
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-slate-500 font-mono">
              <span>CUIT: {activeTenantProfile.cuit || "N/A"}</span>
              <span className="text-amber-500 font-semibold">{activeTenantProfile.defaultCurrency}</span>
            </div>
            {["owner", "admin"].includes((sessionUser?.role || "").toLowerCase()) && <button
              onClick={() => {
                setActiveTab("tenant-profile");
                setMobileSidebarOpen(false);
              }}
              className={`mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                activeTab === "tenant-profile"
                  ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow-sm hover:bg-amber-400"
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              Ver Perfil de Empresa
            </button>}
          </div>
          <div className={`flex flex-col items-center gap-1 ${
            sidebarPinned 
              ? "hidden" 
              : "block md:group-hover:hidden max-md:hidden"
          }`}>
            {["owner", "admin"].includes((sessionUser?.role || "").toLowerCase()) && <button
              onClick={() => {
                setActiveTab("tenant-profile");
                setMobileSidebarOpen(false);
              }}
              className="p-1.5 bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title="Ver Perfil de Empresa"
            >
              <Building2 className="w-4 h-4" />
            </button>}
            <span className="text-[8px] font-mono text-slate-500 uppercase font-bold mt-1">{activeTenantProfile.defaultCurrency}</span>
          </div>
        </div>
        )}

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {sessionUser?.isMarketplaceSupplier && (
            <div className="space-y-1">
              <span className={`px-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2 ${sidebarPinned ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"}`}>Portal de Proveedores</span>
              {[
                { id: "supplier", name: "Panel de mi empresa", icon: Building2 },
                { id: "catalog", name: "Catálogo de productos", icon: ShoppingBag },
                { id: "publish", name: "Publicar y administrar", icon: Plus },
                { id: "sales", name: "Ventas y solicitudes", icon: ShoppingCart },
                { id: "tenders", name: "Licitaciones", icon: Gavel },
                { id: "notifications", name: "Notificaciones", icon: FileText },
                { id: "reputation", name: "Reputación y reclamos", icon: Award }
              ].map((item, index) => {
                const Icon = item.icon;
                const isActive = activeTab === "marketplace" && marketplaceSection === item.id;
                return <button key={`${item.name}-${index}`} onClick={() => { setActiveTab("marketplace"); setMarketplaceSection(item.id); setMobileSidebarOpen(false); }} className={`w-full flex items-center rounded-lg p-2.5 text-xs font-semibold transition-all cursor-pointer ${sidebarPinned ? "gap-2.5" : "gap-0 md:group-hover:gap-2.5 justify-center md:group-hover:justify-start"} ${isActive ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"}`}><Icon className="w-4 h-4 shrink-0" /><span className={`${sidebarPinned ? "w-auto opacity-100" : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100"} overflow-hidden whitespace-nowrap`}>{item.name}</span></button>;
              })}
            </div>
          )}
          {!sessionUser?.isMarketplaceSupplier && (<>
          {/* Group 1: Empresa / Interno */}
          <div className="space-y-1">
            <span className={`px-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2 transition-opacity duration-200 truncate ${
              sidebarPinned ? "opacity-100" : "opacity-0 md:group-hover:opacity-100 max-md:opacity-100"
            }`}>
              Empresa / Interno
            </span>
            {[
              { id: "control-obra", module: "projects", name: "Control de Obra", icon: Hammer },
              { id: "tesoreria-caja", module: "treasury", name: "Tesorería y Caja", icon: Wallet },
              { id: "presupuestos", module: "budgets", name: "Presupuestos", icon: TrendingUp },
              { id: "compras", module: "procurement", name: "Logística y Compras", icon: ShoppingCart },
              { id: "ventas", module: "sales", name: "Ventas y Cuotas", icon: Building2 },
              { id: "consorcio", module: "condominium", name: "Consorcios y Garantías", icon: Layers }
            ].filter(tab => sessionUser?.modules?.includes(tab.module)).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === "control-obra") setShowProjectDetail(false);
                    if (tab.id === "presupuestos") setShowBudgetDetail(false);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center rounded-lg transition-all cursor-pointer p-2.5 text-xs font-semibold ${
                    sidebarPinned ? "gap-2.5" : "gap-0 md:group-hover:gap-2.5 justify-center md:group-hover:justify-start"
                  } ${
                    isActive 
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs" 
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
                  <span className={`transition-all duration-200 overflow-hidden ${
                    sidebarPinned 
                      ? "w-auto opacity-100" 
                      : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100 max-md:w-auto max-md:opacity-100 whitespace-nowrap"
                  }`}>
                    {tab.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Group 2: Servicios Globales */}
          {sessionUser?.modules?.includes("marketplace") && <div className="space-y-1 pt-1 border-t border-slate-800/40">
            <span className={`px-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2 transition-opacity duration-200 truncate ${
              sidebarPinned ? "opacity-100" : "opacity-0 md:group-hover:opacity-100 max-md:opacity-100"
            }`}>
              Servicios Globales
            </span>
            <button
              onClick={() => { setCurrentView("marketplace-public"); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center rounded-lg transition-all cursor-pointer p-2.5 text-xs font-semibold ${
                sidebarPinned ? "gap-2.5" : "gap-0 md:group-hover:gap-2.5 justify-center md:group-hover:justify-start"
              } ${
                activeTab === "marketplace" 
                  ? "bg-amber-500 text-slate-950 font-bold shadow-xs" 
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Award className={`w-4 h-4 shrink-0 ${activeTab === "marketplace" ? "text-slate-950" : "text-slate-400"}`} />
              <span className={`transition-all duration-200 overflow-hidden ${
                sidebarPinned 
                  ? "w-auto opacity-100" 
                  : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100 max-md:w-auto max-md:opacity-100 whitespace-nowrap"
              }`}>
                Marketplace Global
              </span>
            </button>
          </div>}

          {/* Group 3: OCR Ingesta Separada */}
          {sessionUser?.modules?.includes("ocr") && <div className="space-y-1 pt-1 border-t border-slate-800/40">
            <span className={`px-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2 transition-opacity duration-200 truncate ${
              sidebarPinned ? "opacity-100" : "opacity-0 md:group-hover:opacity-100 max-md:opacity-100"
            }`}>
              Soporte de Campo
            </span>
            <button
              onClick={() => { setActiveTab("ocr"); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between rounded-lg transition-all cursor-pointer p-2.5 text-xs font-semibold border border-dashed ${
                activeTab === "ocr" 
                  ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold" 
                  : "border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <span className={`flex items-center ${sidebarPinned ? "gap-2.5" : "gap-0 md:group-hover:gap-2.5"}`}>
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                <span className={`transition-all duration-200 overflow-hidden ${
                  sidebarPinned 
                    ? "w-auto opacity-100" 
                    : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100 max-md:w-auto max-md:opacity-100 whitespace-nowrap"
                }`}>
                  Ingesta OCR
                </span>
              </span>
              <span className={`bg-amber-500/20 text-amber-400 text-[8px] font-bold px-1 py-0.2 rounded font-mono shrink-0 transition-all duration-200 ${
                sidebarPinned ? "opacity-100" : "opacity-0 md:group-hover:opacity-100 max-md:opacity-100"
              }`}>
                IA
              </span>
            </button>
          </div>}
          </>)}
        </div>

        {/* Log Out button */}
        <div className="p-3 border-t border-slate-850 bg-slate-950/10 shrink-0">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center rounded-lg p-2 text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/15 cursor-pointer border border-transparent hover:border-rose-500/20 transition-all ${
              sidebarPinned ? "gap-2" : "gap-0 md:group-hover:gap-2"
            }`}
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`transition-all duration-200 overflow-hidden ${
              sidebarPinned 
                ? "w-auto opacity-100" 
                : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100 max-md:w-auto max-md:opacity-100 whitespace-nowrap"
            }`}>
              Cerrar Sesión
            </span>
          </button>
        </div>

        {/* Footer info branding in Sidebar */}
        <div className={`p-4 border-t border-slate-800 bg-slate-950/30 text-center text-[9px] text-slate-500 font-mono shrink-0 transition-opacity duration-200 ${
          sidebarPinned ? "opacity-100" : "opacity-0 md:group-hover:opacity-100 max-md:opacity-100"
        }`}>
          Lelfun SaaS • v2.0
        </div>
      </aside>

      {/* Overlay to close sidebar on mobile */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 md:hidden animate-fade-in"
        />
      )}

      {/* Spacer for desktop layout (pushes content cleanly to avoid layout overlap shifts) */}
      <div className={`hidden md:block shrink-0 transition-all duration-300 ${sidebarPinned ? "w-64" : "w-16"}`} />

      {/* 2. Main Content Wrapper (Right) */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* Mobile Top Header & Desktop Auditor Bar */}
        <header className="bg-slate-900 md:bg-white text-white md:text-slate-800 py-3.5 px-6 flex items-center justify-between border-b border-slate-800 md:border-slate-100 shrink-0 shadow-3xs">
          {/* Menu Hamburger Toggle on Mobile */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-white bg-slate-800 rounded hover:bg-slate-700 cursor-pointer"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
            <div className="hidden md:block">
              <span className="text-xs text-slate-400 font-bold font-mono">{sessionUser?.isMarketplaceSupplier ? "PORTAL COMERCIAL DE PROVEEDORES" : "ESTACIÓN CORPORATIVA CONSOLIDADA"}</span>
            </div>
            <div className="md:hidden">
              <img src="/lelfun.png" alt="Lelfun" className="w-8 h-8 rounded-md object-cover bg-white" />
            </div>
          </div>

          {/* Sync & Active Auditor Selection */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-800">
            {/* Sync Timestamp indicator */}
            <div className="hidden sm:flex items-center gap-1 text-slate-400 md:text-slate-500 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
              <span>Refresco: {syncTimestamp || "Sincronizado"}</span>
              <button 
                onClick={() => fetchTenantState(activeTenantId)} 
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded cursor-pointer transition-colors"
                title="Sincronizar ahora"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Auditor select */}
            {!sessionUser?.isMarketplaceSupplier && projects.length > 0 && (
              <div className="flex items-center gap-1.5 text-slate-300 md:text-slate-700">
                <span className="text-slate-400 md:text-slate-500 hidden md:inline text-[11px] font-medium">Auditar Obra:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    if (activeTab === "control-obra") setShowProjectDetail(true);
                    if (activeTab === "presupuestos") setShowBudgetDetail(true);
                  }}
                  className="bg-slate-800 md:bg-slate-50 border border-slate-700 md:border-slate-200 text-white md:text-slate-700 text-xs rounded-md px-2.5 py-1 outline-none font-bold focus:border-amber-500 max-w-[130px] sm:max-w-[180px] truncate cursor-pointer"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* 3. Global KPI Cards Dashboard (Hidden for Marketplace & OCR support) */}
        {!["marketplace", "ocr"].includes(activeTab) && (
          <section className="px-6 pt-5 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Caja Centralizada</span>
              <p className="font-mono text-base md:text-lg font-extrabold text-slate-900 mt-1 leading-none">
                {consolidation.currency} {totalConsolidatedLiquidity.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[9px] text-slate-400 mt-1 truncate">
                Consolidado oficial en {consolidation.currency}
                {exchangeRates.date ? ` · TC ${exchangeRates.ARS_USD_OFICIAL} (${exchangeRates.date})` : ""}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Físico Promedio</span>
              <div className="flex items-center gap-2 mt-1 leading-none">
                <p className="font-mono text-base md:text-lg font-extrabold text-amber-600 shrink-0">{averagePhysicalProgress}%</p>
                <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden md:block">
                  <div style={{ width: `${averagePhysicalProgress}%` }} className="bg-amber-500 h-full rounded-full" />
                </div>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">Avance global de obras</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Obras Registradas</span>
              <p className="font-mono text-base md:text-lg font-extrabold text-slate-900 mt-1 leading-none">
                {projects.length} <span className="text-[10px] text-slate-400 font-normal">Activas</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Con inspección municipal</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Compras Pendientes</span>
              <p className="font-mono text-base md:text-lg font-extrabold text-rose-600 mt-1 leading-none">
                {purchaseRequests.filter(pr => pr.status !== "PAID").length} <span className="text-[10px] text-slate-400 font-normal">Suministros</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Pedidos en cotización</p>
            </div>
          </section>
        )}

        {/* 4. Main Application Body Area */}
        <main className="flex-1 px-6 py-5 overflow-y-auto" id="lelfun-active-panel">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
              <p className="text-xs text-slate-500 font-semibold">Sincronizando base de datos corporativa...</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Tab 1: Control de Obra / Gantt Dashboard */}
              {activeTab === "control-obra" && sessionUser?.modules?.includes("projects") && (
                <div className="space-y-6">
                  {/* Header Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-2xs animate-fade-in">
                    <div className="flex items-center gap-3">
                      {showProjectDetail && (
                        <button
                          onClick={() => setShowProjectDetail(false)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                          title="Volver al listado de obras"
                        >
                          <ChevronRight className="w-4 h-4 rotate-180" />
                        </button>
                      )}
                      <div>
                        <h3 className="text-sm font-bold font-display text-slate-800">
                          {showProjectDetail ? `Detalle de Obra: ${activeProject?.name || ""}` : "Obras y Proyectos"}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {showProjectDetail
                            ? "Estado, presupuesto y cronograma de la obra seleccionada"
                            : "Seleccione una obra para consultar su estado y gestión individual"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {showProjectDetail && activeProject && (
                        <button
                          onClick={() => {
                            setShowBudgetDetail(true);
                            setActiveTab("presupuestos");
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Ver Presupuesto
                        </button>
                      )}
                      <button
                        onClick={() => setShowAddProject(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar Nueva Obra / Proyecto
                      </button>
                    </div>
                  </div>

                  {!showProjectDetail && (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
                      {projects.length === 0 ? (
                        <div className="py-16 text-center">
                          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <h4 className="text-sm font-bold text-slate-700">Todavía no hay obras registradas</h4>
                          <p className="text-xs text-slate-400 mt-1">Registre la primera obra para comenzar.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {projects.map(project => {
                            const stepIndex = getProjectStepIndex(project);
                            const projectBudget = budgetLines.filter(line => line.projectId === project.id);
                            return (
                              <button
                                key={project.id}
                                onClick={() => {
                                  setSelectedProjectId(project.id);
                                  setShowProjectDetail(true);
                                }}
                                className="w-full grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-3 items-center p-4 text-left hover:bg-amber-50/40 transition-colors cursor-pointer group"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700">
                                      <Building2 className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-sm text-slate-800 truncate">{project.name}</p>
                                      <p className="text-[10px] text-slate-400 truncate">{project.code} · {project.address || project.city}</p>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 block">Estado</span>
                                  <span className="inline-flex mt-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                                    {projectSteps[stepIndex].name}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 block">Presupuesto</span>
                                  <span className="font-mono text-xs font-bold text-slate-700">
                                    {project.baseCurrency} {project.estimatedTotalCost.toLocaleString()}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">{projectBudget.length} rubros</span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 block">Avance</span>
                                  <span className="font-mono text-xs font-bold text-slate-700">{project.physicalProgress}% físico</span>
                                  <span className="text-[9px] text-slate-400 block">{project.schedule?.length || 0} tareas</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-600" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {showProjectDetail && activeProject && (
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-2xs space-y-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                            <GitBranch className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">Ciclo de Vida Obligatorio del Proyecto</h4>
                            <p className="text-[10px] text-slate-400">Control estricto de fases operativas</p>
                          </div>
                        </div>

                        {/* Action buttons to move project through lifecycle */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {getProjectStepIndex(activeProject) < 4 && (
                            <button
                              onClick={() => handleAdvanceProjectStep(activeProject)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-2xs animate-pulse"
                            >
                              <span>Avanzar a {projectSteps[getProjectStepIndex(activeProject) + 1].name}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {getProjectStepIndex(activeProject) > 0 && (
                            <button
                              onClick={() => handleRegressProjectStep(activeProject)}
                              className="text-slate-400 hover:text-slate-600 text-[10px] font-medium px-2 py-1.5 cursor-pointer transition-colors border border-transparent hover:border-slate-200 rounded"
                            >
                              Regresar Fase
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Visual Stepper Nodes */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative py-2">
                        {/* Connecting track line for desktop */}
                        <div className="absolute top-7 left-12 right-12 h-0.5 bg-slate-100 -z-10 hidden md:block" />

                        {projectSteps.map((step, idx) => {
                          const currentStepIdx = getProjectStepIndex(activeProject);
                          const isCompleted = idx < currentStepIdx;
                          const isActive = idx === currentStepIdx;

                          return (
                            <div key={idx} className="flex flex-col items-center text-center space-y-1.5">
                              {/* Circle bubble */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-extrabold border transition-all ${
                                isActive
                                  ? "bg-amber-500 border-amber-500 text-slate-950 ring-4 ring-amber-500/15 scale-105 font-black"
                                  : isCompleted
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "bg-slate-50 border-slate-200 text-slate-400"
                              }`}>
                                {isCompleted ? "✓" : idx + 1}
                              </div>

                              <div className="space-y-0.5">
                                <p className={`text-[10.5px] font-bold ${
                                  isActive ? "text-slate-900 font-extrabold" : isCompleted ? "text-emerald-600" : "text-slate-400"
                                }`}>
                                  {step.name}
                                </p>
                                <p className="text-[8.5px] text-slate-400 font-medium">
                                  {step.sub}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Interactive Explanation & Action Helper */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full inline-block ${
                              getProjectStepIndex(activeProject) === 4 ? "bg-slate-400" : "bg-amber-500 animate-pulse"
                            }`} />
                            <span className="font-mono font-bold text-slate-700 uppercase tracking-wider text-[9px]">
                              Estado: {projectSteps[getProjectStepIndex(activeProject)].name}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[10px] leading-relaxed">
                            {projectSteps[getProjectStepIndex(activeProject)].desc}
                          </p>
                        </div>

                        {/* Phase-specific quick-action triggers */}
                        <div className="shrink-0 flex items-center gap-2">
                          {getProjectStepIndex(activeProject) === 0 && (
                            <button
                              onClick={() => setEditingProjectDetails(true)}
                              className="px-2.5 py-1 bg-white border text-slate-700 hover:bg-slate-50 text-[10px] font-semibold rounded shadow-3xs cursor-pointer flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" /> Editar Datos
                            </button>
                          )}
                          {getProjectStepIndex(activeProject) === 1 && (
                            <button
                              onClick={() => {
                                setShowBudgetDetail(true);
                                setActiveTab("presupuestos");
                              }}
                              className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-[10px] font-semibold rounded shadow-3xs cursor-pointer flex items-center gap-1"
                            >
                              <DollarSign className="w-3 h-3" /> Configurar Presupuesto
                            </button>
                          )}
                          {getProjectStepIndex(activeProject) === 2 && (
                            <button
                              onClick={() => setShowingTaskPlanner(true)}
                              className="px-2.5 py-1 bg-amber-550 border border-amber-400 text-slate-950 hover:bg-amber-500 text-[10px] font-bold rounded shadow-3xs cursor-pointer flex items-center gap-1"
                            >
                              <Calendar className="w-3 h-3" /> Planificar Tareas (Cronograma)
                            </button>
                          )}
                          {getProjectStepIndex(activeProject) === 3 && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setShowingProgressCertifier(true)}
                                className="px-2.5 py-1 bg-amber-550 hover:bg-amber-500 text-slate-950 border border-amber-400 text-[10px] font-bold rounded shadow-3xs cursor-pointer flex items-center gap-1"
                              >
                                <Percent className="w-3 h-3" /> Certificar Avance
                              </button>
                              <button
                                onClick={() => setActiveTab("compras")}
                                className="px-2.5 py-1 bg-white border text-slate-700 hover:bg-slate-50 text-[10px] font-semibold rounded shadow-3xs cursor-pointer flex items-center gap-1"
                              >
                                <ShoppingBag className="w-3 h-3" /> Suministros
                              </button>
                            </div>
                          )}
                          {getProjectStepIndex(activeProject) === 4 && (
                            <div className="flex items-center gap-1 text-emerald-600 font-extrabold text-[10px]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> OBRA CERRADA CON ÉXITO
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {showProjectDetail && activeProject ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Progress details (Left 1/3) */}
                    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-xs space-y-5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proyecto Activo</span>
                        <h2 className="text-xl font-bold font-display text-slate-800 mt-0.5">{activeProject.name}</h2>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {activeProject.address || activeProject.location}
                        </p>
                      </div>

                      {/* Badges of Type and Edificacion */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Tipo: {activeProject.projectType || "Construcción"}
                        </span>
                        <span className="bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Edificación: {activeProject.constructionType || "Casa"}
                        </span>
                      </div>

                      {/* Visual progress circle */}
                      <div className="flex items-center gap-5 p-4 bg-slate-50 rounded-lg border">
                        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="28" fill="transparent" stroke="#e2e8f0" strokeWidth="5" />
                            <circle 
                              cx="32" 
                              cy="32" 
                              r="28" 
                              fill="transparent" 
                              stroke="#d97706" 
                              strokeWidth="5" 
                              strokeDasharray={2 * Math.PI * 28}
                              strokeDashoffset={2 * Math.PI * 28 * (1 - activeProject.physicalProgress / 100)}
                            />
                          </svg>
                          <span className="absolute text-xs font-mono font-extrabold text-slate-800">{activeProject.physicalProgress}%</span>
                        </div>
                        <div className="text-xs space-y-1 text-slate-600">
                          <p>• Fecha Inicio: <strong className="font-mono">{activeProject.startDate}</strong></p>
                          <p>• Superficie: <strong className="font-mono">{activeProject.surfaceM2} m²</strong></p>
                          <p>• Moneda de Obra: <strong className="font-mono">{activeProject.baseCurrency}</strong></p>
                          <p>• Financiero: <strong className="font-mono text-amber-700">{activeProject.financialProgress || 0}%</strong></p>
                        </div>
                      </div>

                      {activeProject.description && (
                        <div className="text-xs text-slate-600 space-y-1 p-3 bg-slate-50 rounded-lg border">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wide">Descripción del Proyecto</span>
                          <p className="leading-relaxed whitespace-pre-line text-slate-700">{activeProject.description}</p>
                        </div>
                      )}

                      <div className="text-xs text-slate-500 space-y-2">
                        <span className="font-bold text-slate-700 block">Especificaciones Técnicas</span>
                        <p className="leading-relaxed">
                          La obra cuenta con permisos municipales certificados, habilitaciones contra incendios, planos estructurales de fundación y planillas de control de colada de hormigón.
                        </p>
                      </div>

                      {/* Historial de Certificaciones de Obra */}
                      <div className="pt-3 border-t space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wide">Historial de Certificaciones</span>
                          <button
                            onClick={() => activeProject.status === ProjectStatus.IN_PROGRESS && setShowingProgressCertifier(true)}
                            disabled={activeProject.status !== ProjectStatus.IN_PROGRESS}
                            title={activeProject.status !== ProjectStatus.IN_PROGRESS ? "La obra debe estar en ejecución para certificar" : "Registrar certificación"}
                            className="text-amber-600 hover:text-amber-700 disabled:text-slate-300 disabled:cursor-not-allowed font-bold text-[10px] flex items-center gap-0.5"
                          >
                            + Nueva Certificación
                          </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {activeProject.certifications && activeProject.certifications.length > 0 ? (
                            activeProject.certifications.map((cert, cIdx) => (
                              <div key={cert.id || cIdx} className="bg-slate-50 p-2.5 rounded border border-slate-200/60 text-xs space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                  <span>{cert.date}</span>
                                  <span className="text-amber-700">Auditado por: {cert.certifiedBy}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-800 font-semibold">
                                  <span>Físico: <strong className="text-slate-950">{cert.physicalProgress}%</strong></span>
                                  <span>Financiero: <strong className="text-slate-950">{cert.financialProgress}%</strong></span>
                                </div>
                                <p className="text-[10px] font-semibold text-slate-600">
                                  Tarea: {cert.taskName || "Certificación histórica sin tarea asociada"}
                                </p>
                                {(cert.amount !== undefined || cert.invoiceNumber || cert.receiptNumber) && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-1 text-[10px] text-slate-500">
                                    {cert.amount !== undefined && <span>Monto: <strong>{activeProject.baseCurrency} {cert.amount.toLocaleString()}</strong></span>}
                                    {cert.invoiceNumber && <span>Factura: <strong>{cert.invoiceNumber}</strong></span>}
                                    {cert.receiptNumber && <span>Recibo: <strong>{cert.receiptNumber}</strong></span>}
                                  </div>
                                )}
                                {cert.notes && (
                                  <p className="text-[10px] text-slate-500 italic border-t pt-1 mt-1 leading-normal">
                                    "{cert.notes}"
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 text-center py-4 text-[10px]">No se han registrado certificaciones para esta obra aún.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Gantt / Schedule Timeline (Right 2/3) */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-xs">
                      <h3 className="text-base font-semibold font-display text-slate-800 mb-4 flex items-center gap-1.5">
                        <Clock className="w-4.5 h-4.5 text-slate-500" /> Cronograma de Tareas (Diagrama de Gantt)
                      </h3>

                      <div className="space-y-4">
                        {orderedProjectTasks.map(task => (
                          <div key={task.id} className={`space-y-1 ${task.parentTaskId ? "ml-5 border-l-2 border-slate-200 pl-3" : ""}`}>
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-800">{task.parentTaskId && "Subtarea · "}{task.taskName}</span>
                              <span className="text-slate-500 text-[10px]">
                                {task.progress}% • Semanas {task.startWeek} - {task.endWeek}
                              </span>
                            </div>
                            {/* Gantt Bar rendering */}
                            <div className="relative h-5 w-full bg-slate-100 rounded-md overflow-hidden border border-slate-200/50">
                              {/* Position Gantt Bar using left/width percentages representing week offsets */}
                              <div 
                                style={{ 
                                  left: `${(task.startWeek / 24) * 100}%`, 
                                  width: `${((task.endWeek - task.startWeek) / 24) * 100}%` 
                                }} 
                                className="absolute top-0 bottom-0 bg-amber-600/10 border-l border-r border-amber-600 text-[9px] font-bold text-amber-800 px-1.5 flex items-center shadow-2xs"
                              >
                                <div 
                                  style={{ width: `${task.progress}%` }} 
                                  className="absolute left-0 top-0 bottom-0 bg-amber-500/25 transition-all"
                                />
                                <span className="relative z-10 font-sans truncate">Incidencia Obra</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center text-[9px] text-slate-400 pt-6 border-t mt-6 font-mono">
                        <span>Semana 0</span>
                        <span>Semana 4</span>
                        <span>Semana 8</span>
                        <span>Semana 12</span>
                        <span>Semana 16</span>
                        <span>Semana 20</span>
                        <span>Semana 24</span>
                      </div>
                    </div>
                  </div>
                ) : showProjectDetail ? (
                  <p className="text-center text-slate-400 py-12">Por favor configure o asigne un proyecto activo.</p>
                ) : null}
                </div>
            )}

            {/* Tab 2: Finance Ledger & Arqueos */}
            {activeTab === "tesoreria-caja" && sessionUser?.modules?.includes("treasury") && (
              <FinancePanel 
                accounts={accounts}
                movements={movements}
                counterparties={counterparties}
                categories={categories}
                purchaseRequests={purchaseRequests}
                tenantId={activeTenantId}
                projectId={selectedProjectId}
                onRefresh={() => fetchTenantState(activeTenantId)}
              />
            )}

            {/* Tab 3: Presupuestos */}
            {activeTab === "presupuestos" && sessionUser?.modules?.includes("budgets") && (
              <div className="space-y-5">
                {!showBudgetDetail ? (
                  <>
                    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-xs">
                      <h3 className="text-sm font-bold font-display text-slate-800">Presupuestos por Obra</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Seleccione una obra para consultar y editar su presupuesto individual.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
                      {projects.length === 0 ? (
                        <div className="py-16 text-center">
                          <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <h4 className="text-sm font-bold text-slate-700">No hay presupuestos disponibles</h4>
                          <p className="text-xs text-slate-400 mt-1">Primero debe registrar una obra.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {projects.map(project => {
                            const lines = budgetLines.filter(line => line.projectId === project.id);
                            const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
                            const totalIncidence = lines.reduce((sum, line) => sum + line.incidence, 0);
                            return (
                              <button
                                key={project.id}
                                onClick={() => {
                                  setSelectedProjectId(project.id);
                                  setShowBudgetDetail(true);
                                }}
                                className="w-full grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-3 items-center p-4 text-left hover:bg-amber-50/40 transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700">
                                    <TrendingUp className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-sm text-slate-800 truncate">{project.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{project.code} · {project.constructionType}</p>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 block">Estado de obra</span>
                                  <span className="text-xs font-semibold text-slate-700">
                                    {projectSteps[getProjectStepIndex(project)].name}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 block">Presupuesto</span>
                                  <span className="font-mono text-xs font-bold text-slate-800">
                                    {project.baseCurrency} {totalAmount.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 block">Distribución</span>
                                  <span className="font-mono text-xs font-bold text-slate-700">{totalIncidence.toFixed(2)}%</span>
                                  <span className="text-[9px] text-slate-400 block">{lines.length} rubros</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-600" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowBudgetDetail(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" /> Volver al listado de presupuestos
                    </button>
                    <BudgetPanel
                      projects={projects}
                      budgetLines={budgetLines}
                      activeProject={activeProject}
                      onRefresh={() => fetchTenantState(activeTenantId)}
                    />
                  </>
                )}
              </div>
            )}

            {/* Tab 4: Compras */}
            {activeTab === "compras" && sessionUser?.modules?.includes("procurement") && (
              <ProcurementPanel 
                purchaseRequests={purchaseRequests}
                counterparties={counterparties}
                categories={categories}
                tenantId={activeTenantId}
                projectId={selectedProjectId}
                onRefresh={() => fetchTenantState(activeTenantId)}
              />
            )}

            {/* Tab 5: Ventas */}
            {activeTab === "ventas" && sessionUser?.modules?.includes("sales") && (
              <SalesPanel 
                units={units}
                opportunities={salesOpportunities}
                contracts={contracts}
                installments={installments}
                accounts={accounts}
                counterparties={counterparties}
                tenantId={activeTenantId}
                projectId={selectedProjectId}
                onRefresh={() => fetchTenantState(activeTenantId)}
              />
            )}

            {/* Tab 6: OCR Ingest */}
            {activeTab === "ocr" && sessionUser?.modules?.includes("ocr") && (
              <div className="flex flex-col items-center justify-center py-4">
                {/* Visual simulator header on desktop only */}
                <div className="hidden md:flex flex-col items-center text-center max-w-md mb-6 space-y-2">
                  <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" /> Módulo Optimizado para Campo
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800">Simulador de Ingesta OCR en Obra</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Este módulo inteligente está diseñado exclusivamente para dispositivos móviles (teléfonos inteligentes) para que el capataz pueda escanear facturas en el corralón o en tránsito con la cámara.
                  </p>
                </div>

                {/* Simulated Smartphone Container on Desktop, native on Mobile */}
                <div className="w-full max-w-[420px] md:border-[10px] md:border-slate-850 md:rounded-[40px] md:shadow-2xl md:bg-slate-900 overflow-hidden md:aspect-[9/19] md:relative md:ring-4 md:ring-slate-800/10">
                  {/* Smartphone notch on desktop */}
                  <div className="hidden md:block absolute top-0 inset-x-0 h-6 bg-slate-900 z-50">
                    <div className="mx-auto w-32 h-4 bg-black rounded-b-xl flex items-center justify-center">
                      <div className="w-10 h-1 bg-slate-850 rounded-full" />
                    </div>
                  </div>
                  
                  {/* Smartphone App Frame */}
                  <div className="md:pt-6 md:h-full bg-slate-50 overflow-y-auto">
                    <OcrPanel 
                      categories={categories}
                      projects={projects}
                      tenantId={activeTenantId}
                      onRefresh={() => fetchTenantState(activeTenantId)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 7: Consorcios */}
            {activeTab === "consorcio" && sessionUser?.modules?.includes("condominium") && (
              <ConsortiumPanel 
                condominiums={earlyCondominiums}
                maintenanceRequests={maintenanceRequests}
                projects={projects}
                units={units}
                counterparties={counterparties}
                tenantId={activeTenantId}
                projectId={selectedProjectId}
                onRefresh={() => fetchTenantState(activeTenantId)}
              />
            )}

            {/* Tab 8: Marketplace */}
            {activeTab === "marketplace" && sessionUser?.modules?.includes("marketplace") && (
              <MarketplacePanel 
                tenantId={activeTenantId}
                userEmail={userEmail}
                isSupplier={Boolean(sessionUser?.isMarketplaceSupplier)}
                projects={projects}
                initialSection={marketplaceSection}
              />
            )}

            {/* Tab 9: Tenant / Company Profile Config */}
            {activeTab === "tenant-profile" && ["owner", "admin"].includes((sessionUser?.role || "").toLowerCase()) && (
              <TenantProfilePanel 
                tenant={tenantProfile}
                accounts={accounts}
                userEmail={userEmail}
                authenticatedRole={sessionUser?.role}
                onRefresh={() => fetchTenantState(activeTenantId)}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer info branding */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-[10px] text-slate-400 font-mono">
        Lelfun SaaS Constructores • Versión 2.0 (Dual Currency Platform) • Integrado con Gemini Pro Multimodal OCR
      </footer>
      </div>

      {/* Crear Obra / Proyecto Modal */}
      {showAddProject && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900 text-xs font-semibold">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold font-display flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-400" /> Configurar Nueva Obra
              </h3>
              <button onClick={() => setShowAddProject(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Nombre Comercial de la Obra</label>
                <input
                  type="text"
                  placeholder="Ej. Torres de Libertador II"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Ubicación / Dirección</label>
                <input
                  type="text"
                  placeholder="Av. Del Libertador 2450, CABA"
                  value={projLoc}
                  onChange={(e) => setProjLoc(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Tipo de Proyecto</label>
                  <select
                    value={projType}
                    onChange={(e) => setProjType(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 outline-none"
                  >
                    <option value="Construcción">Construcción</option>
                    <option value="Emprendimiento">Emprendimiento</option>
                    <option value="Refacción">Refacción</option>
                    <option value="Remodelación">Remodelación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Tipo de Edificación</label>
                  <select
                    value={projConstructionType}
                    onChange={(e) => setProjConstructionType(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 outline-none"
                  >
                    <option value="Casa">Casa</option>
                    <option value="Edificio">Edificio</option>
                    <option value="Local">Local</option>
                    <option value="Nave Industrial">Nave Industrial</option>
                    <option value="Dúplex">Dúplex</option>
                    <option value="Barrio Cerrado">Barrio Cerrado</option>
                    <option value="Oficinas">Oficinas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Sup. Proyecto (m²)</label>
                  <input
                    type="number"
                    placeholder="3500"
                    value={projSurface}
                    onChange={(e) => setProjSurface(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Costo Estimado m²</label>
                  <input
                    type="number"
                    placeholder="1200"
                    value={projCostM2}
                    onChange={(e) => setProjCostM2(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={projStartDate}
                    onChange={(e) => setProjStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Moneda del Presupuesto</label>
                  <select
                    value={projCurr}
                    onChange={(e) => setProjCurr(e.target.value as Currency)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 outline-none"
                  >
                    <option value={Currency.USD}>Dólar Estadounidense (USD)</option>
                    <option value={Currency.ARS}>Pesos Argentinos (ARS)</option>
                    <option value={Currency.BRL}>Real Brasileño (BRL)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Descripción de la Obra</label>
                <textarea
                  placeholder="Breve descripción del alcance, etapas iniciales u observaciones clave..."
                  value={projDescription}
                  onChange={(e) => setProjDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500 h-16 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded text-xs cursor-pointer"
                >
                  Registrar e Inicializar Obra
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editar Datos Básicos Modal */}
      {editingProjectDetails && activeProject && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900 text-xs font-semibold">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold font-display flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-amber-400" /> Editar Datos del Proyecto
              </h3>
              <button onClick={() => setEditingProjectDetails(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProjectDetails} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  value={editProjName}
                  onChange={(e) => setEditProjName(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Dirección / Ubicación</label>
                <input
                  type="text"
                  value={editProjLoc}
                  onChange={(e) => setEditProjLoc(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Tipo de Proyecto</label>
                  <select
                    value={editProjType}
                    onChange={(e) => setEditProjType(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 outline-none"
                  >
                    <option value="Construcción">Construcción</option>
                    <option value="Emprendimiento">Emprendimiento</option>
                    <option value="Refacción">Refacción</option>
                    <option value="Remodelación">Remodelación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Tipo de Edificación</label>
                  <select
                    value={editProjConstructionType}
                    onChange={(e) => setEditProjConstructionType(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs bg-slate-50 outline-none"
                  >
                    <option value="Casa">Casa</option>
                    <option value="Edificio">Edificio</option>
                    <option value="Local">Local</option>
                    <option value="Nave Industrial">Nave Industrial</option>
                    <option value="Dúplex">Dúplex</option>
                    <option value="Barrio Cerrado">Barrio Cerrado</option>
                    <option value="Oficinas">Oficinas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Sup. Proyecto (m²)</label>
                  <input
                    type="number"
                    value={editProjSurface}
                    onChange={(e) => setEditProjSurface(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Costo Estimado m²</label>
                  <input
                    type="number"
                    value={editProjCostM2}
                    onChange={(e) => setEditProjCostM2(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  value={editProjStartDate}
                  onChange={(e) => setEditProjStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Descripción de la Obra</label>
                <textarea
                  placeholder="Breve descripción del alcance..."
                  value={editProjDescription}
                  onChange={(e) => setEditProjDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500 h-20 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded text-xs cursor-pointer font-bold"
                >
                  Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProjectDetails(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Planificar Tareas / Gantt Planner Modal */}
      {showingTaskPlanner && activeProject && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900 text-xs font-semibold">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <h3 className="font-semibold font-display flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" /> Planificador de Cronograma (Gantt)
              </h3>
              <button onClick={() => setShowingTaskPlanner(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* List of current tasks */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tareas Actuales</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-slate-50">
                  {orderedProjectTasks.map((task) => (
                    <div key={task.id} className={`bg-white p-2.5 rounded border flex justify-between items-center text-xs ${task.parentTaskId ? "ml-5 border-l-4 border-l-amber-300" : ""}`}>
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="font-bold text-slate-800 truncate">{task.parentTaskId && <span className="text-amber-700">Subtarea · </span>}{task.taskName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Semanas {task.startWeek} a {task.endWeek} • Avance: {task.progress}%
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {!task.parentTaskId && (
                          <button onClick={() => startAddingSubtask(task.id)} className="text-amber-700 hover:bg-amber-50 p-1.5 rounded" title="Agregar subtarea">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => startEditingTask(task)} className="text-slate-500 hover:bg-slate-100 p-1.5 rounded" title="Editar tarea">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer shrink-0"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(activeProject.schedule || []).length === 0 && (
                    <p className="text-center text-[11px] text-slate-400 py-4">No hay tareas en el cronograma. Agregue una abajo o use la AI para sugerir etapas.</p>
                  )}
                </div>
                {taskPlannerError && <p className="mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{taskPlannerError}</p>}
              </div>

              {/* AI Scheduler Trigger */}
              <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs">
                <div className="space-y-1">
                  <h5 className="text-[11px] font-extrabold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" /> Generación de Etapas por AI
                  </h5>
                  <p className="text-[10.5px] text-amber-800 font-medium leading-relaxed">
                    Crear automáticamente el cronograma detallado de la obra según su tipo ({activeProject.projectType || "Construcción"}), edificación ({activeProject.constructionType || "Casa"}) y metros cuadrados con el poder de Gemini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateScheduleAI}
                  disabled={isGeneratingSchedule}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  {isGeneratingSchedule ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Sugerir Cronograma</span>
                    </>
                  )}
                </button>
              </div>

              {/* Add task form */}
              <form onSubmit={handleAddTask} className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {editingTaskId ? "Editar tarea" : newTaskParentId ? "Agregar subtarea" : "Agregar nueva tarea"}
                  </h4>
                  {(editingTaskId || newTaskParentId) && (
                    <button type="button" onClick={() => { setEditingTaskId(null); setNewTaskParentId(""); setNewTaskName(""); setNewTaskProgress("0"); }} className="text-[10px] text-slate-500 hover:text-slate-800">Cancelar</button>
                  )}
                </div>
                {newTaskParentId && !editingTaskId && (
                  <p className="rounded bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                    Tarea principal: {(activeProject.schedule || []).find(task => task.id === newTaskParentId)?.taskName}
                  </p>
                )}
                
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">Nombre de la Tarea</label>
                  <input
                    type="text"
                    placeholder="Ej. Movimiento de Suelos / Excavación"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500 font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Semana Inicio</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={newTaskStart}
                      onChange={(e) => setNewTaskStart(e.target.value)}
                      className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Semana Fin</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={newTaskEnd}
                      onChange={(e) => setNewTaskEnd(e.target.value)}
                      className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Avance (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newTaskProgress}
                      onChange={(e) => setNewTaskProgress(e.target.value)}
                      className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded text-xs cursor-pointer font-bold mt-2"
                >
                  {editingTaskId ? "Guardar cambios" : newTaskParentId ? "Agregar subtarea" : "Agregar tarea al Gantt"}
                </button>
              </form>
            </div>

            <div className="bg-slate-50 p-4 border-t flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowingTaskPlanner(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs cursor-pointer font-bold"
              >
                Cerrar Planificador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificar Avance Modal */}
      {showingProgressCertifier && activeProject && activeProject.status === ProjectStatus.IN_PROGRESS && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900 text-xs font-semibold">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold font-display flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-amber-400" /> Registrar Certificación de Obra
              </h3>
              <button onClick={() => setShowingProgressCertifier(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCertifyProgress} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Seleccione una tarea con avance parcial o finalizado. La certificación actualizará el progreso global y conservará el historial de auditoría.
              </p>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Tarea certificada</label>
                <select value={certTaskId} onChange={(e) => setCertTaskId(e.target.value)} className="w-full border border-slate-200 rounded p-2 text-xs outline-none focus:border-amber-500" required>
                  <option value="">Seleccione una tarea...</option>
                  {orderedProjectTasks.filter(task => task.progress > 0).map(task => (
                    <option key={task.id} value={task.id}>
                      {task.parentTaskId ? "↳ " : ""}{task.taskName} · {task.progress === 100 ? "Finalizada" : `${task.progress}% finalizada`}
                    </option>
                  ))}
                </select>
                {orderedProjectTasks.every(task => task.progress <= 0) && (
                  <p className="mt-1 text-[10px] text-amber-700">Primero edite una tarea y registre un avance superior a 0%.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Fecha de Certificación</label>
                  <input
                    type="date"
                    value={certDate}
                    onChange={(e) => setCertDate(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Certificado Por</label>
                  <input
                    type="text"
                    placeholder="Ej. Ing. Juan Pérez"
                    value={certCertifiedBy}
                    onChange={(e) => setCertCertifiedBy(e.target.value)}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Avance Físico Certificado (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={certPhysical}
                    onChange={(e) => setCertPhysical(e.target.value)}
                    className="flex-1 accent-amber-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={certPhysical}
                    onChange={(e) => setCertPhysical(e.target.value)}
                    className="w-16 border border-slate-200 rounded p-1 text-center font-mono text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Avance Financiero Desembolsado (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={certFinancial}
                    onChange={(e) => setCertFinancial(e.target.value)}
                    className="flex-1 accent-amber-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={certFinancial}
                    onChange={(e) => setCertFinancial(e.target.value)}
                    className="w-16 border border-slate-200 rounded p-1 text-center font-mono text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Monto opcional</label>
                  <input type="number" min="0" step="0.01" value={certAmount} onChange={(e) => setCertAmount(e.target.value)} placeholder={activeProject.baseCurrency} className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Nº de factura</label>
                  <input type="text" value={certInvoiceNumber} onChange={(e) => setCertInvoiceNumber(e.target.value)} placeholder="Opcional" className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Nº de recibo</label>
                  <input type="text" value={certReceiptNumber} onChange={(e) => setCertReceiptNumber(e.target.value)} placeholder="Opcional" className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Notas / Observaciones de la Certificación</label>
                <textarea
                  placeholder="Ej. Conclusión de hormigonado del 3er piso, inspección municipal aprobada..."
                  value={certNotes}
                  onChange={(e) => setCertNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-amber-500 h-16 resize-none"
                />
              </div>

              {certError && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{certError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!certTaskId}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white py-2 rounded text-xs cursor-pointer font-bold"
                >
                  Registrar Certificación
                </button>
                <button
                  type="button"
                  onClick={() => setShowingProgressCertifier(false)}
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
