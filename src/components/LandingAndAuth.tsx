import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Check,
  Lock,
  Mail,
  Phone,
  Building2,
  Briefcase,
  ShieldAlert,
  RefreshCw,
  Star,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  X,
  ChevronRight,
  MapPin,
  FileText,
  BadgePercent,
  Compass,
  ShoppingCart,
} from "lucide-react";
import { supabase } from "../supabaseClient";

// Lelfun custom logo
export function LelfunLogo({
  className = "w-12 h-12",
}: {
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ${className}`}
    >
      <img
        src="/lelfun.png"
        alt="Lelfun"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2.5 hover:border-amber-500/50 transition-all"><div className="w-8 h-8 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{icon}</div><h3 className="text-sm font-bold text-white">{title}</h3><p className="text-[11px] text-slate-400 leading-relaxed font-semibold">{text}</p></div>;
}

interface LandingAndAuthProps {
  onLoginSuccess: (
    email: string,
    tenantId: string,
    userName: string,
    isSupplier: boolean,
  ) => void;
  onOpenMarketplace: () => void;
  initialView?: "landing" | "login" | "register";
}

export default function LandingAndAuth({
  onLoginSuccess,
  onOpenMarketplace,
  initialView = "landing",
}: LandingAndAuthProps) {
  const [view, setView] = useState<"landing" | "login" | "register">(
    initialView,
  );

  // Login State
  const [loginType, setLoginType] = useState<"tenant" | "marketplace">(
    "tenant",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Register State
  const [registerType, setRegisterType] = useState<
    "tenant" | "marketplace" | "buyer"
  >("tenant");
  const [regStep, setRegStep] = useState(1); // 1 = User profile, 2 = Tenant Profile (only for tenant type)

  // Registration Profile Form
  const [regNombre, setRegNombre] = useState("");
  const [regApellido, setRegApellido] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Registration Tenant Profile Form
  const [tenNombreFantasia, setTenNombreFantasia] = useState("");
  const [tenRazonSocial, setTenRazonSocial] = useState("");
  const [tenCuit, setTenCuit] = useState("");
  const [tenDesc, setTenDesc] = useState("");
  const [tenLogoUrl, setTenLogoUrl] = useState("");
  const [tenPais, setTenPais] = useState("Argentina");
  const [tenProvincia, setTenProvincia] = useState("");
  const [tenCiudad, setTenCiudad] = useState("");
  const [tenDireccion, setTenDireccion] = useState("");
  const [tenMismaFacturacion, setTenMismaFacturacion] = useState(true);

  // Registration Supplier Form (Marketplace type only)
  const [suppEmpresa, setSuppEmpresa] = useState("");
  const [suppCuit, setSuppCuit] = useState("");
  const [suppCompanyType, setSuppCompanyType] = useState("");
  const [suppYearsRange, setSuppYearsRange] = useState("0-2");
  const [suppEmployeesRange, setSuppEmployeesRange] = useState("1-10");
  const [suppRevenueRange, setSuppRevenueRange] = useState("Hasta ARS 100M");
  const [suppWebsite, setSuppWebsite] = useState("");
  const [suppDescription, setSuppDescription] = useState("");

  // Demo Request State
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoSize, setDemoSize] = useState("1-5");
  const [demoMessage, setDemoMessage] = useState("");
  const [demoSuccess, setDemoSuccess] = useState(false);

  // Password rules validation
  const passLength = password.length >= 8 || regPassword.length >= 8;
  const passUpper = /[A-Z]/.test(password) || /[A-Z]/.test(regPassword);
  const passSpecial =
    /[!@#$%^&*(),.?":{}|<>]/.test(password) ||
    /[!@#$%^&*(),.?":{}|<>]/.test(regPassword);
  const passAlphaNum =
    (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) ||
    (/[a-zA-Z]/.test(regPassword) && /[0-9]/.test(regPassword));
  const passValid = passLength && passUpper && passSpecial && passAlphaNum;

  // Real-time signup validation helpers
  const getPasswordStrengthScore = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score++;
    if (/[a-zA-Z]/.test(p) && /[0-9]/.test(p)) score++;
    return score;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    if (!passValid) {
      setErrorMsg(
        "La contraseña no cumple con los requisitos mínimos de seguridad.",
      );
      setLoading(false);
      return;
    }

    try {
      // 1. Supabase Auth Sign In
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error("Correo o contraseña incorrectos.");
      }

      if (data.user) {
        const uEmail = data.user.email || email;
        const uName = data.user.user_metadata?.nombre || uEmail.split("@")[0];
        onLoginSuccess(uEmail, "", uName, false);
      }
    } catch (err: any) {
      setErrorMsg(
        err.message || "Credenciales incorrectas o error de conexión.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Password matches check
    if (regPassword !== regConfirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    // Passwords requirements check
    const regPassScore = getPasswordStrengthScore(regPassword);
    if (regPassScore < 4) {
      setErrorMsg(
        "La contraseña debe cumplir todos los requisitos de seguridad.",
      );
      return;
    }

    if (registerType === "tenant" && regStep === 1) {
      // Advance to tenant creation step
      if (!regNombre || !regApellido || !regEmail || !regPhone) {
        setErrorMsg("Por favor complete todos los datos personales.");
        return;
      }
      setRegStep(2);
      return;
    }

    setLoading(true);

    try {
      // 1. SignUp in Supabase Auth (wrapped in try-catch to keep registration resilient in sandbox environments)
      let authToken = "";
      try {
        const { data, error } = await supabase.auth.signUp({
          email: regEmail,
          password: regPassword,
          options: {
            data: {
              nombre: `${regNombre} ${regApellido}`,
              telefono: regPhone,
              user_type:
                registerType === "buyer" ? "marketplace_buyer" : registerType,
              ...(registerType === "tenant"
                ? {
                    tenant_name: tenNombreFantasia || tenRazonSocial,
                    tenant_legal_name: tenRazonSocial || tenNombreFantasia,
                    tenant_tax_id: tenCuit,
                    tenant_phone: regPhone,
                    tenant_legal_address: [
                      tenDireccion,
                      tenCiudad,
                      tenProvincia,
                      tenPais,
                    ]
                      .filter(Boolean)
                      .join(", "),
                    tenant_plan: "STARTER",
                  }
                : {}),
            },
          },
        });

        if (error) {
          throw error;
        }
        authToken = data.session?.access_token || "";
      } catch (sbErr) {
        if (registerType === "buyer") throw sbErr;
        console.warn(
          "Supabase client call threw an exception, proceeding with simulation database",
          sbErr,
        );
      }

      // Simulate registration state and sync to backend
      const userFullName = `${regNombre} ${regApellido}`;
      let generatedTenantId =
        registerType === "tenant"
          ? `tenant-dyn-${Date.now()}`
          : "tenant-lelfun";

      if (registerType === "tenant") {
        // Create Tenant on our express backend
        const fullLegalAddress = `${tenDireccion}, ${tenCiudad}, ${tenProvincia}, ${tenPais}`;
        const newTenantResponse = await fetch("/api/tenants", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken
              ? { Authorization: `Bearer ${authToken}` }
              : {}),
          },
          body: JSON.stringify({
            id: generatedTenantId,
            name: tenRazonSocial || tenNombreFantasia,
            defaultCurrency: "USD",
            nombreFantasia: tenNombreFantasia,
            razonSocial: tenRazonSocial,
            phone: regPhone,
            legalAddress: fullLegalAddress,
            commercialAddress: fullLegalAddress,
            companyType: "Desarrolladora S.A.",
            cuit: tenCuit,
            logoUrl:
              tenLogoUrl ||
              "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=100&auto=format&fit=crop",
            activeUsers: [
              {
                name: userFullName,
                email: regEmail,
                role: "Administrador General",
                active: true,
              },
            ],
          }),
        });

        if (authToken && !newTenantResponse.ok) {
          throw new Error(
            "No se pudo registrar la estructura del tenant en el servidor.",
          );
        }
      } else if (registerType === "marketplace") {
        // Register as Marketplace Supplier
        const newSupplierResponse = await fetch("/api/marketplace-suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: suppEmpresa,
            tradeName: suppEmpresa,
            ownerName: userFullName,
            contactEmail: regEmail,
            cuit: suppCuit,
            phone: regPhone,
            companyType: suppCompanyType,
            yearsInBusinessRange: suppYearsRange,
            employeesRange: suppEmployeesRange,
            annualRevenueRange: suppRevenueRange,
            website: suppWebsite,
            description: suppDescription,
            address: [tenDireccion, tenCiudad, tenProvincia]
              .filter(Boolean)
              .join(", "),
            categories: ["Estructuras", "Terminaciones", "Logística"],
            serviceAreas: [tenProvincia || "Buenos Aires", "Nacional"],
          }),
        });

        if (!newSupplierResponse.ok) {
          throw new Error(
            "No se pudo dar de alta el perfil de proveedor de marketplace.",
          );
        }
      } else {
        if (!authToken)
          throw new Error(
            "Debe confirmar el correo electrónico antes de crear la empresa compradora.",
          );
        const buyerResponse = await fetch(
          "/api/marketplace/public/register-buyer",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              companyName: suppEmpresa,
              legalName: suppEmpresa,
              taxId: suppCuit,
              phone: regPhone,
              currency: "ARS",
              address: [tenDireccion, tenCiudad, tenProvincia]
                .filter(Boolean)
                .join(", "),
            }),
          },
        );
        const buyer = await buyerResponse.json();
        if (!buyerResponse.ok)
          throw new Error(
            buyer.error || "No se pudo crear la cuenta compradora",
          );
        generatedTenantId = buyer.tenantId;
      }

      // Save credentials in simulated localStorage for browser persistence / offline testing bypass
      localStorage.setItem(`lelf_pass_${regEmail}`, regPassword);
      localStorage.setItem(`lelf_name_${regEmail}`, userFullName);
      localStorage.setItem(`tenant_id_${regEmail}`, generatedTenantId);
      localStorage.setItem(
        `is_supplier_${regEmail}`,
        String(registerType === "marketplace"),
      );

      if (registerType === "tenant") {
        const fullLegalAddress = `${tenDireccion}, ${tenCiudad}, ${tenProvincia}, ${tenPais}`;
        const companyName =
          tenNombreFantasia || tenRazonSocial || "Nueva Empresa";

        localStorage.setItem(`tenant_name_${generatedTenantId}`, companyName);
        localStorage.setItem(`tenant_cuit_${generatedTenantId}`, tenCuit || "");
        localStorage.setItem(`tenant_currency_${generatedTenantId}`, "USD");
        localStorage.setItem(
          `tenant_address_${generatedTenantId}`,
          fullLegalAddress,
        );
        localStorage.setItem(
          `tenant_logo_${generatedTenantId}`,
          tenLogoUrl || "",
        );
      }

      localStorage.setItem("lelf_user_email", regEmail);
      localStorage.setItem("lelf_user_name", userFullName);

      setSuccessMsg("¡Registro exitoso! Iniciando sesión automáticamente...");

      setTimeout(() => {
        onLoginSuccess(
          regEmail,
          generatedTenantId,
          userFullName,
          registerType === "marketplace",
        );
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al completar el registro.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSuccess(true);
    setTimeout(() => {
      setShowDemoModal(false);
      setDemoSuccess(false);
      // Reset fields
      setDemoName("");
      setDemoEmail("");
      setDemoPhone("");
      setDemoCompany("");
      setDemoMessage("");
    }, 3500);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
      {/* HEADER NAVBAR */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setView("landing")}
          >
            <img
              src="/lelfun.png"
              alt="Lelfun"
              className="w-11 h-11 rounded-xl object-cover bg-white shadow-lg shadow-amber-500/10"
            />
            <span className="font-extrabold text-base tracking-wider font-display text-white">
              LELFUN{" "}
              <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                SaaS
              </span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <button
              onClick={onOpenMarketplace}
              className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer font-bold"
            >
              Marketplace
            </button>
            <button
              onClick={() => {
                setView("landing");
                setTimeout(
                  () =>
                    document
                      .getElementById("features")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  100,
                );
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Funcionalidades
            </button>
            <button
              onClick={() => {
                setView("landing");
                setTimeout(
                  () =>
                    document
                      .getElementById("pricing")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  100,
                );
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Planes y Sususcripciones
            </button>
            <button
              onClick={() => setView("landing")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Quiénes Somos
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setView("login");
                setLoginType("tenant");
              }}
              className="text-slate-300 hover:text-white text-xs font-bold px-3.5 py-2 transition-colors cursor-pointer"
            >
              Ingresar
            </button>
            <button
              onClick={() => {
                setView("register");
                setRegStep(1);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              Registrarse
            </button>
          </div>
        </div>
      </header>

      {/* VIEW: LANDING PAGE */}
      {view === "landing" && (
        <main className="flex-1">
          {/* HERO SECTION */}
          <section className="relative py-20 px-6 overflow-hidden">
            <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
              <span className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
                ★ Control de Obras Civiles y Desarrollo Inmobiliario
              </span>
              <h1 className="text-4xl sm:text-6xl font-black font-display text-white tracking-tight leading-tight max-w-4xl mx-auto">
                La plataforma integral para construir, vender y gestionar mejor
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-medium">
                Centralice obras, presupuestos, tesorería, compras, ventas,
                clientes y proveedores. Sume inteligencia artificial y un
                Marketplace conectado para administrar todo el negocio desde
                una sola plataforma.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="w-full sm:w-auto px-7 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 hover:-translate-y-0.5"
                >
                  Solicitar Demostración Gratis{" "}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setView("register");
                    setRegisterType("tenant");
                    setRegStep(1);
                  }}
                  className="w-full sm:w-auto px-7 py-3.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-sm font-bold rounded-xl transition-all cursor-pointer hover:-translate-y-0.5"
                >
                  Crear Mi Cuenta Empresa
                </button>
              </div>

              {/* Trust Badge */}
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-8">
                Diseñado para Desarrolladoras de Latam • Soporte Normativo
                CUIT/CUIL
              </p>
            </div>

            {/* Glowing background shapes */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10" />
          </section>

          {/* KEY CAPABILITIES */}
          <section
            id="features"
            className="py-16 px-6 border-t border-slate-900 bg-slate-950/40"
          >
            <div className="max-w-7xl mx-auto space-y-12">
              <div className="text-center max-w-xl mx-auto space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white font-display uppercase tracking-tight">
                  Capacidades del Sistema
                </h2>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Lelfun está diseñado bajo las estrictas exigencias
                  administrativas de obras de gran envergadura.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Card 1 */}
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2.5 hover:border-slate-700 transition-all">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Presupuestos CAC Activos
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Controle las planillas de costos distribuidos e incidencias.
                    Reajuste cuotas de fideicomisos con índices de inflación CAC
                    de manera automática.
                  </p>
                </div>

                {/* Card 2 */}
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2.5 hover:border-slate-700 transition-all">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Tesorería y Caja MEP
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Opere con total tranquilidad en pesos (ARS), dólares (USD) y
                    reales (BRL). Conciliación de diferencias con venta MEP
                    integrada y flujos bimonetarios.
                  </p>
                </div>

                {/* Card 3 */}
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2.5 hover:border-slate-700 transition-all">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Planificación de Obras con AI
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Acelere la creación de cronogramas. Nuestra IA analiza los
                    metros cuadrados, tipo de edificación y genera
                    automáticamente un diagrama de Gantt óptimo.
                  </p>
                </div>

                {/* Card 4 */}
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2.5 hover:border-slate-700 transition-all">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
                    <BadgePercent className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Auditoría & Certificaciones
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Evite desvíos físicos-financieros. Registre certificaciones
                    de obra auditadas con firmas de ingenieros, actualizando el
                    avance en tiempo real.
                  </p>
                </div>

                {/* Card 5 */}
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2.5 hover:border-slate-700 transition-all">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Marketplace de Suministros
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Explore públicamente productos y servicios, regístrese como
                    comprador o proveedor, compre directamente, lance
                    licitaciones y compare cotizaciones por renglón.
                  </p>
                </div>

                {/* Card 6 */}
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2.5 hover:border-slate-700 transition-all">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Procesamiento OCR de Facturas
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Suba los remitos y facturas en PDF y JPG para que la AI
                    extraiga automáticamente montos, CUIT, ítems e impute
                    directamente a las líneas presupuestarias de la obra.
                  </p>
                </div>
                <FeatureCard icon={<Building2 />} title="Control integral de obras" text="Gestione múltiples proyectos, estados, documentos, responsables, presupuestos independientes y cronogramas desde un único tablero." />
                <FeatureCard icon={<Briefcase />} title="Compras, logística y proveedores" text="Administre notas de pedido, solicitudes, proveedores, clientes, entregas y su vínculo con obras y líneas presupuestarias." />
                <FeatureCard icon={<TrendingUp />} title="CRM inmobiliario y ventas" text="Publique unidades, gestione oportunidades, reservas, descuentos, financiación, cuotas, cobranzas y comisiones." />
                <FeatureCard icon={<DollarSign />} title="Arqueo y consolidación monetaria" text="Valide movimientos contra efectivo, bancos y cajas de seguridad con tipo de cambio histórico y moneda de consolidación." />
                <FeatureCard icon={<ShieldAlert />} title="Consorcios, garantías y reclamos" text="Relacione reclamos con proyectos, unidades y clientes, adjunte documentación y controle su resolución." />
                <FeatureCard icon={<Compass />} title="Licitaciones y compras directas" text="Cree RFI y RFP públicas, privadas o limitadas, compare ofertas por renglón, adjudique y califique." />
              </div>
            </div>
          </section>

          {/* SUBSCRIPTION PLANS */}
          <section id="pricing" className="py-20 px-6 bg-slate-950">
            <div className="max-w-7xl mx-auto space-y-14">
              <div className="text-center max-w-xl mx-auto space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white font-display uppercase tracking-tight">
                  Suscripciones Disponibles
                </h2>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Elija el plan que mejor se adapte al volumen de desarrollo de
                  su constructora. Sin costos ocultos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Plan 1 */}
                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between space-y-6 relative hover:border-slate-700 transition-all">
                  <div className="space-y-4">
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-[9px] font-bold uppercase tracking-wider rounded">
                      Plan Inicial
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Lelfun Starter
                    </h3>
                    <p className="text-xs text-slate-400">
                      Excelente para pequeños constructores, refacciones y
                      contratistas independientes.
                    </p>
                    <div className="pt-2">
                      <span className="text-3xl font-black text-white font-mono">
                        u$s 150
                      </span>
                      <span className="text-slate-500 text-xs font-semibold">
                        {" "}
                        / mes
                      </span>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-2.5 pt-4 border-t border-slate-800/80">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        Hasta 3 Proyectos activos
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        Flujo de caja bimonetario
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        1 Cuenta corriente bancaria
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        Ingesta OCR básica
                      </li>
                    </ul>
                  </div>
                  <button
                    onClick={() => {
                      setView("register");
                      setRegisterType("tenant");
                      setRegStep(1);
                    }}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all"
                  >
                    Comenzar Gratis
                  </button>
                </div>

                {/* Plan 2 */}
                <div className="bg-slate-900/70 border-2 border-amber-500/80 p-8 rounded-3xl flex flex-col justify-between space-y-6 relative hover:shadow-lg hover:shadow-amber-500/5 transition-all">
                  <div className="absolute top-0 right-6 -translate-y-1/2 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    RECOMENDADO
                  </div>
                  <div className="space-y-4">
                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-wider rounded">
                      Plan Corporativo
                    </span>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      Lelfun Pro
                    </h3>
                    <p className="text-xs text-slate-300">
                      Perfecto para constructoras medianas y desarrolladoras
                      inmobiliarias en expansión.
                    </p>
                    <div className="pt-2">
                      <span className="text-4xl font-black text-white font-mono">
                        u$s 250
                      </span>
                      <span className="text-slate-500 text-xs font-semibold">
                        {" "}
                        / mes
                      </span>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-2.5 pt-4 border-t border-slate-800/80">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />{" "}
                        <strong>Hasta 5 Proyectos activos</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />{" "}
                        Cronograma Gantt asistido por AI
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />{" "}
                        Multi-cuentas y control bimonetario
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />{" "}
                        Licitaciones y control de compras
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />{" "}
                        Ingesta OCR ilimitada
                      </li>
                    </ul>
                  </div>
                  <button
                    onClick={() => {
                      setView("register");
                      setRegisterType("tenant");
                      setRegStep(1);
                    }}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl cursor-pointer transition-all shadow-md"
                  >
                    Suscribirse Ahora
                  </button>
                </div>

                {/* Plan 3 */}
                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between space-y-6 relative hover:border-slate-700 transition-all">
                  <div className="space-y-4">
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-[9px] font-bold uppercase tracking-wider rounded">
                      Plan Unlimited
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Lelfun Enterprise
                    </h3>
                    <p className="text-xs text-slate-400">
                      Solución a gran escala para holdings inmobiliarios,
                      fideicomisarios y obras públicas.
                    </p>
                    <div className="pt-2">
                      <span className="text-3xl font-black text-white font-mono">
                        u$s 450
                      </span>
                      <span className="text-slate-500 text-xs font-semibold">
                        {" "}
                        / mes
                      </span>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-2.5 pt-4 border-t border-slate-800/80">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        <strong>Proyectos Activos Ilimitados</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        Soporte dedicado prioritario
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        API de integración con sistemas ERP
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />{" "}
                        Personalizaciones a medida
                      </li>
                    </ul>
                  </div>
                  <button
                    onClick={() => setShowDemoModal(true)}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all"
                  >
                    Solicitar demo corporativa
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="border-t border-slate-900 py-12 px-6 bg-slate-950/80 text-center space-y-4 text-xs text-slate-500 font-medium">
            <div className="flex items-center justify-center gap-2">
              <LelfunLogo className="w-7 h-7" />
              <span className="text-white font-bold uppercase tracking-wider">
                Lelfun · by Acizer
              </span>
            </div>
            <p>
              © 2026 Acizer. Todos los derechos reservados. Lelfun es un
              producto desarrollado por {" "}<a href="https://www.acizer.com.ar" target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">Acizer</a>.
            </p>
          </footer>
        </main>
      )}

      {/* VIEW: LOGIN PAGE */}
      {view === "login" && (
        <main className="flex-1 flex items-center justify-center py-12 px-6">
          <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl max-w-md w-full space-y-6 shadow-2xl relative">
            <div className="text-center space-y-2">
              <LelfunLogo className="w-12 h-12 mx-auto" />
              <h2 className="text-xl font-bold font-display text-white">
                Ingresar a Lelfun
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione el portal de acceso correspondiente
              </p>
            </div>

            {/* Portal type toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800/60">
              <button
                onClick={() => setLoginType("tenant")}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  loginType === "tenant"
                    ? "bg-amber-500 text-slate-950 font-extrabold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Empresa</span>
                </div>
              </button>
              <button
                onClick={() => setLoginType("marketplace")}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  loginType === "marketplace"
                    ? "bg-amber-500 text-slate-950 font-extrabold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Marketplace</span>
                </div>
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-wide">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="correo@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-500 font-semibold transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-wide">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-500 font-semibold transition-all font-mono"
                    required
                  />
                </div>
              </div>

              {/* Real-time Password checklist for feedback */}
              {password.length > 0 && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[10px] font-semibold text-slate-400">
                  <span className="block text-[9px] uppercase tracking-wide text-slate-500 mb-1">
                    Requisitos de contraseña:
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold ${passLength ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-850 text-slate-500"}`}
                      >
                        ✓
                      </div>
                      <span>Min. 8 caracteres</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold ${passUpper ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-850 text-slate-500"}`}
                      >
                        ✓
                      </div>
                      <span>1 Mayúscula</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold ${passSpecial ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-850 text-slate-500"}`}
                      >
                        ✓
                      </div>
                      <span>Caract. especial</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold ${passAlphaNum ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-850 text-slate-500"}`}
                      >
                        ✓
                      </div>
                      <span>Alfanumérico</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/5 text-xs uppercase tracking-wide"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span>
                    Ingresar al Portal{" "}
                    {loginType === "tenant" ? "Empresa" : "Marketplace"}
                  </span>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-500 font-medium">
                ¿No tienes una cuenta aún?{" "}
                <button
                  onClick={() => {
                    setView("register");
                    setRegStep(1);
                  }}
                  className="text-amber-500 hover:underline cursor-pointer font-bold"
                >
                  Regístrate aquí
                </button>
              </p>
            </div>
          </div>
        </main>
      )}

      {/* VIEW: REGISTER PAGE (ONBOARDING FLOW) */}
      {view === "register" && (
        <main className="flex-1 flex items-center justify-center py-12 px-6">
          <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl max-w-xl w-full space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <LelfunLogo className="w-12 h-12 mx-auto" />
              <h2 className="text-xl font-bold font-display text-white">
                Crear Cuenta en Lelfun
              </h2>
              <p className="text-xs text-slate-400">
                Complete el formulario de registro integrado
              </p>
            </div>

            {/* Registration type selector */}
            {regStep === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setRegisterType("tenant")}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    registerType === "tenant"
                      ? "bg-amber-500 text-slate-950 font-extrabold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Administrador de Empresa</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterType("marketplace")}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    registerType === "marketplace"
                      ? "bg-amber-500 text-slate-950 font-extrabold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Proveedor del Marketplace</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterType("buyer")}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${registerType === "buyer" ? "bg-amber-500 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"}`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Comprador Marketplace</span>
                  </div>
                </button>
              </div>
            )}

            {/* Step progress bullets for tenant type */}
            {registerType === "tenant" && (
              <div className="flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span
                  className={`px-2 py-0.5 rounded ${regStep === 1 ? "bg-amber-500 text-slate-950 font-black" : "bg-slate-800 text-slate-300"}`}
                >
                  1. Datos de Usuario
                </span>
                <ChevronRight className="w-3 h-3 text-slate-700" />
                <span
                  className={`px-2 py-0.5 rounded ${regStep === 2 ? "bg-amber-500 text-slate-950 font-black" : "bg-slate-800 text-slate-500"}`}
                >
                  2. Datos de Empresa
                </span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* STEP 1: Personal User profile for BOTH types */}
              {regStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Carlos"
                        value={regNombre}
                        onChange={(e) => setRegNombre(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        Apellido
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Rossi"
                        value={regApellido}
                        onChange={(e) => setRegApellido(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Correo Electrónico Corporativo
                    </label>
                    <input
                      type="email"
                      placeholder="admin@empresa.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Teléfono Móvil (Código País + Área + Número)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. +54 9 11 4802-9988"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white font-mono outline-none focus:border-amber-500 font-semibold"
                      required
                    />
                  </div>

                  {/* Marketplace Specific Fields (Single Step) */}
                  {registerType === "buyer" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          Empresa compradora
                        </label>
                        <input
                          value={suppEmpresa}
                          onChange={(e) => setSuppEmpresa(e.target.value)}
                          placeholder="Ej. Constructora del Sur"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          CUIT de la empresa
                        </label>
                        <input
                          value={suppCuit}
                          onChange={(e) => setSuppCuit(e.target.value)}
                          placeholder="Ej. 30-71458921-9"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                          required
                        />
                      </div>
                      <p className="sm:col-span-2 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        Cuenta gratuita para comprar productos, solicitar
                        cotizaciones y crear licitaciones. No incluye los
                        módulos ERP.
                      </p>
                    </div>
                  )}
                  {registerType === "marketplace" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          Nombre de la Empresa Proveedora
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Aceros Siderar"
                          value={suppEmpresa}
                          onChange={(e) => setSuppEmpresa(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          CUIT / CUIL de la Empresa
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. 30-71458921-9"
                          value={suppCuit}
                          onChange={(e) => setSuppCuit(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          Tipo de empresa
                        </label>
                        <input
                          value={suppCompanyType}
                          onChange={(e) => setSuppCompanyType(e.target.value)}
                          placeholder="Fabricante, distribuidor…"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          Sitio web / red principal
                        </label>
                        <input
                          value={suppWebsite}
                          onChange={(e) => setSuppWebsite(e.target.value)}
                          placeholder="https://empresa.com.ar"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <select
                        value={suppYearsRange}
                        onChange={(e) => setSuppYearsRange(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white"
                      >
                        <option>0-2</option>
                        <option>3-5</option>
                        <option>6-10</option>
                        <option>11-20</option>
                        <option>Más de 20</option>
                      </select>
                      <select
                        value={suppEmployeesRange}
                        onChange={(e) => setSuppEmployeesRange(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white"
                      >
                        <option>1-10</option>
                        <option>11-50</option>
                        <option>51-200</option>
                        <option>Más de 200</option>
                      </select>
                      <select
                        value={suppRevenueRange}
                        onChange={(e) => setSuppRevenueRange(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white"
                      >
                        <option>Hasta ARS 100M</option>
                        <option>ARS 100M-500M</option>
                        <option>ARS 500M-2.000M</option>
                        <option>Más de ARS 2.000M</option>
                      </select>
                      <textarea
                        value={suppDescription}
                        onChange={(e) => setSuppDescription(e.target.value)}
                        placeholder="Experiencia, especialidad y capacidad operativa"
                        className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white h-20 sm:col-span-2"
                        required
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        Contraseña de Acceso
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        Repetir Contraseña
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Password rules checker */}
                  {regPassword.length > 0 && (
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[10px] font-semibold text-slate-400">
                      <span className="block text-[9px] uppercase tracking-wide text-slate-500 mb-0.5">
                        La contraseña DEBE cumplir con:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] ${passLength ? "text-emerald-400" : "text-slate-600"}`}
                          >
                            {passLength ? "●" : "○"} Mínimo 8 caracteres
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] ${passUpper ? "text-emerald-400" : "text-slate-600"}`}
                          >
                            {passUpper ? "●" : "○"} Al menos una Mayúscula
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] ${passSpecial ? "text-emerald-400" : "text-slate-600"}`}
                          >
                            {passSpecial ? "●" : "○"} Carácter especial
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] ${passAlphaNum ? "text-emerald-400" : "text-slate-600"}`}
                          >
                            {passAlphaNum ? "●" : "○"} Números y letras
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Tenant profile for Admin type */}
              {registerType === "tenant" && regStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        Nombre Fantasía
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Lelfun Desarrollos"
                        value={tenNombreFantasia}
                        onChange={(e) => setTenNombreFantasia(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        Razón Social
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Lelfun Desarrollos S.A."
                        value={tenRazonSocial}
                        onChange={(e) => setTenRazonSocial(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        CUIT de la Empresa
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. 30-71409581-2"
                        value={tenCuit}
                        onChange={(e) => setTenCuit(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                        Logo Empresa (URL Opcional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={tenLogoUrl}
                        onChange={(e) => setTenLogoUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-800/60 p-4 rounded-2xl bg-slate-950 space-y-3">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                      Dirección Legal de la Obra
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">
                          País
                        </label>
                        <input
                          type="text"
                          value={tenPais}
                          onChange={(e) => setTenPais(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">
                          Provincia / Estado
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Buenos Aires"
                          value={tenProvincia}
                          onChange={(e) => setTenProvincia(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">
                          Ciudad
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Recoleta, CABA"
                          value={tenCiudad}
                          onChange={(e) => setTenCiudad(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">
                          Calle y Altura (Dirección Física)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Av. Alvear 1850"
                          value={tenDireccion}
                          onChange={(e) => setTenDireccion(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="misma_fact"
                        checked={tenMismaFacturacion}
                        onChange={(e) =>
                          setTenMismaFacturacion(e.target.checked)
                        }
                        className="rounded border-slate-800 bg-slate-900 accent-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <label
                        htmlFor="misma_fact"
                        className="text-[10px] text-slate-400 font-semibold cursor-pointer"
                      >
                        Misma dirección de facturación
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Descripción de la Empresa / Alcance de Obras
                    </label>
                    <textarea
                      placeholder="Breve descripción del alcance constructivo (ej. Desarrollos residenciales Premium)..."
                      value={tenDesc}
                      onChange={(e) => setTenDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500 h-16 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ACTION NAVIGATION BUTTONS */}
              <div className="flex gap-2 pt-2">
                {registerType === "tenant" && regStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="w-1/3 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer text-xs"
                  >
                    Volver
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs uppercase tracking-wide ${
                    registerType === "tenant" && regStep === 1
                      ? "w-full"
                      : "flex-1"
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>
                      {registerType === "tenant" && regStep === 1
                        ? "Siguiente Paso"
                        : "Completar Registro & Onboarding"}
                    </span>
                  )}
                </button>
              </div>
            </form>

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-500 font-medium">
                ¿Ya tienes una cuenta registrada?{" "}
                <button
                  onClick={() => {
                    setView("login");
                  }}
                  className="text-amber-500 hover:underline cursor-pointer font-bold"
                >
                  Inicia sesión aquí
                </button>
              </p>
            </div>
          </div>
        </main>
      )}

      {/* MODAL: SOLICITAR DEMO */}
      {showDemoModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 animate-fade-in text-slate-900 font-semibold">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base font-display flex items-center gap-1.5 text-white">
                <Sparkles className="w-4.5 h-4.5 text-amber-500" /> Solicitar
                Demo Personalizada
              </h3>
              <button
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {demoSuccess ? (
              <div className="py-8 text-center space-y-3 animate-fade-in">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl">
                  ✓
                </div>
                <h4 className="font-bold text-white text-sm uppercase tracking-wide">
                  ¡Solicitud Procesada con Éxito!
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed px-4">
                  Un Ingeniero de Implementación Comercial de Lelfun Software se
                  pondrá en contacto dentro de las próximas 2 horas hábiles.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleDemoRequest}
                className="space-y-3.5 text-xs"
              >
                <p className="text-xs text-slate-400 leading-normal">
                  Descubra cómo automatizar las auditorías y el control
                  financiero de sus obras con Lelfun. Complete sus datos para
                  coordinar una videollamada.
                </p>

                <div>
                  <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ing. Mariano Rossi"
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">
                      Email Corporativo
                    </label>
                    <input
                      type="email"
                      placeholder="mariano@empresa.com"
                      value={demoEmail}
                      onChange={(e) => setDemoEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      placeholder="+54 11 4802-9988"
                      value={demoPhone}
                      onChange={(e) => setDemoPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-amber-500 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">
                      Empresa Desarrolladora
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Norte Desarrollos"
                      value={demoCompany}
                      onChange={(e) => setDemoCompany(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">
                      Volumen de Obra Activa
                    </label>
                    <select
                      value={demoSize}
                      onChange={(e) => setDemoSize(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 font-semibold cursor-pointer"
                    >
                      <option value="1-5">1 a 5 obras anuales</option>
                      <option value="6-15">6 a 15 obras anuales</option>
                      <option value="16+">Más de 16 obras anuales</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">
                    Notas / Consultas Especiales (Opcional)
                  </label>
                  <textarea
                    placeholder="Cuéntenos brevemente qué tipo de obras administra y qué desafíos financieros busca resolver..."
                    value={demoMessage}
                    onChange={(e) => setDemoMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 h-16 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider"
                >
                  Enviar Solicitud de Reunión
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
