import React, { useState } from "react";
import { 
  Building2, 
  Globe, 
  Phone, 
  MapPin, 
  Users, 
  CreditCard, 
  DollarSign, 
  Briefcase, 
  FileText, 
  Plus, 
  Save, 
  ShieldAlert, 
  UserCheck, 
  CheckCircle,
  Warehouse,
  Upload,
  ArrowRight
} from "lucide-react";
import { Tenant, Currency, FinancialAccount } from "../types.js";

interface TenantProfilePanelProps {
  tenant: Tenant | null;
  accounts: FinancialAccount[];
  userEmail: string;
  onRefresh: () => void;
}

export default function TenantProfilePanel({ tenant, accounts, userEmail, onRefresh }: TenantProfilePanelProps) {
  // Check if current user is admin
  const userRole = tenant?.activeUsers?.find(
    u => u.email.toLowerCase() === userEmail.toLowerCase()
  )?.role || "Colaborador";

  const isAdmin = userRole.toLowerCase().includes("admin") || userEmail.toLowerCase() === "mariano.telespazio@gmail.com";

  // Form states
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl || "");
  const [nombreFantasia, setNombreFantasia] = useState(tenant?.nombreFantasia || "");
  const [razonSocial, setRazonSocial] = useState(tenant?.razonSocial || "");
  const [webPage, setWebPage] = useState(tenant?.webPage || "");
  const [phone, setPhone] = useState(tenant?.phone || "");
  const [legalAddress, setLegalAddress] = useState(tenant?.legalAddress || "");
  const [commercialAddress, setCommercialAddress] = useState(tenant?.commercialAddress || "");
  const [companyType, setCompanyType] = useState(tenant?.companyType || "Constructora & Desarrolladora");
  const [cuit, setCuit] = useState(tenant?.cuit || "");
  const [iibbType, setIibbType] = useState(tenant?.iibbType || "Convenio Multilateral");
  const [defaultCurrency, setDefaultCurrency] = useState(tenant?.defaultCurrency || Currency.USD);

  // Lists additions form states
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("Colaborador de Obra");

  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [newDepName, setNewDepName] = useState("");
  const [newDepAddress, setNewDepAddress] = useState("");

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccCurrency, setNewAccCurrency] = useState(Currency.USD);
  const [newAccBalance, setNewAccBalance] = useState("");

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  if (!tenant) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-xs text-center py-16">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-slate-700">Cargando perfil de empresa...</h3>
      </div>
    );
  }

  // If user is not admin, show Access Denied Screen
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-rose-100 shadow-xl overflow-hidden mt-8">
        <div className="bg-rose-50 border-b border-rose-100 p-6 flex items-center gap-4">
          <div className="p-3 bg-rose-500 text-white rounded-xl">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-rose-950 font-display">Acceso Restringido</h2>
            <p className="text-xs text-rose-700">Módulo exclusivo para Administradores de Lelfun SaaS</p>
          </div>
        </div>
        <div className="p-8 text-center space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Su usuario actual (<strong className="font-mono text-slate-800">{userEmail || "No identificado"}</strong>) posee el rol de <strong>{userRole}</strong>. 
            Esta vista contiene datos corporativos confidenciales, suscripción bancaria y alta de depósitos exclusivos del administrador.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 border text-left text-xs space-y-1.5 font-mono text-slate-500">
            <p>• Tenant ID: {tenant.id}</p>
            <p>• Empresa: {tenant.name}</p>
            <p>• Requiere rol: Administrador General</p>
          </div>
          <p className="text-xs text-amber-600 font-semibold italic">
            * Conéctese utilizando la cuenta de administrador mariano.telespazio@gmail.com para obtener acceso completo.
          </p>
        </div>
      </div>
    );
  }

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setSaveMessage("");

    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl,
          nombreFantasia,
          razonSocial,
          webPage,
          phone,
          legalAddress,
          commercialAddress,
          companyType,
          cuit,
          iibbType,
          defaultCurrency
        })
      });

      if (response.ok) {
        setSaveMessage("¡Perfil corporativo actualizado correctamente!");
        onRefresh();
        setTimeout(() => setSaveMessage(""), 4000);
      } else {
        setSaveMessage("Error al actualizar el perfil.");
      }
    } catch (err) {
      console.error(err);
      setSaveMessage("Falla de red al guardar.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Add Active User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;

    try {
      const response = await fetch(`/api/tenants/${tenant.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole
        })
      });

      if (response.ok) {
        setNewUserName("");
        setNewUserEmail("");
        setNewUserRole("Colaborador de Obra");
        setShowAddUser(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Add Deposit location
  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepName || !newDepAddress) return;

    try {
      const response = await fetch(`/api/tenants/${tenant.id}/deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDepName,
          address: newDepAddress
        })
      });

      if (response.ok) {
        setNewDepName("");
        setNewDepAddress("");
        setShowAddDeposit(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Add Bank Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccBalance) return;

    try {
      const response = await fetch(`/api/tenants/${tenant.id}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAccName,
          currency: newAccCurrency,
          balance: Number(newAccBalance),
          type: "Banco"
        })
      });

      if (response.ok) {
        setNewAccName("");
        setNewAccBalance("");
        setShowAddAccount(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Base64 Logo helper simulator
  const triggerLogoUploadSim = () => {
    const urls = [
      "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=150&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?q=80&w=150&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=150&auto=format&fit=crop"
    ];
    // Pick a random construction logo to simulate real upload
    const randomUrl = urls[Math.floor(Math.random() * urls.length)];
    setLogoUrl(randomUrl);
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="tenant-profile-panel">
      
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10">
          <Building2 className="w-72 h-72" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo empresa" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-8 h-8 text-slate-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Tenant Admin
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {tenant.id}</span>
              </div>
              <h2 className="text-xl font-bold font-display mt-1">{tenant.name}</h2>
              <p className="text-xs text-slate-400">Panel Centralizado de Parámetros y Configuración Legal de Empresa</p>
            </div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs shrink-0 font-mono text-slate-300">
            <p>Conectado: <strong className="text-amber-400">{userEmail}</strong></p>
            <p>Rol validado: <strong className="text-emerald-400">{userRole}</strong></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Profile Edit Form (2/3) */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-500" /> Datos de Registro de Empresa
              </h3>
              <p className="text-xs text-slate-500">Configure los datos legales y comerciales que se imprimirán en sus contratos y presupuestos</p>
            </div>
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSavingProfile ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>

          {saveMessage && (
            <div className={`p-3 text-xs rounded-lg flex items-center gap-2 font-semibold ${
              saveMessage.includes("correctamente") ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-amber-50 text-amber-800 border border-amber-100"
            }`}>
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> {saveMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Logo de la empresa */}
            <div className="md:col-span-2 flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-16 h-16 rounded-xl bg-white border overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-bold text-slate-700">Logo de la Empresa (URL / Base64)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://ejemplo.com/logo.png"
                    className="flex-1 bg-white border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={triggerLogoUploadSim}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Subir
                  </button>
                </div>
              </div>
            </div>

            {/* Nombre Fantasía */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Nombre Fantasía</label>
              <input 
                type="text"
                required
                value={nombreFantasia}
                onChange={(e) => setNombreFantasia(e.target.value)}
                placeholder="Nombre comercial de la empresa"
                className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Razón Social */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Razón Social Legal</label>
              <input 
                type="text"
                required
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Nombre legal de la sociedad"
                className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Tipo de Empresa */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Tipo de Empresa (Categoría ARCA/AFIP)</label>
              <select 
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
                className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Sociedad Anónima (S.A.)">Sociedad Anónima (S.A.)</option>
                <option value="S.R.L.">S.R.L. (Sociedad de Resp. Limitada)</option>
                <option value="SAS">SAS (Sociedad por Acciones Simplificada)</option>
                <option value="Exento">Exento</option>
                <option value="Otros">Otros</option>
              </select>
            </div>

            {/* Página Web */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Página Web Corporativa</label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  value={webPage}
                  onChange={(e) => setWebPage(e.target.value)}
                  placeholder="www.ejemplo.com"
                  className="w-full bg-slate-50 border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Teléfono Comercial</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 11 4000-0000"
                  className="w-full bg-slate-50 border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Moneda de Consolidación */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 text-amber-600 font-bold">
                Moneda de Consolidación (Reporting)
              </label>
              <select 
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value as Currency)}
                className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs outline-none font-bold text-slate-800 border-amber-200 focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value={Currency.USD}>USD (Dólares Estadounidenses)</option>
                <option value={Currency.ARS}>ARS (Pesos Argentinos)</option>
                <option value={Currency.BRL}>BRL (Real Brasileño)</option>
              </select>
            </div>

            {/* Dirección Legal */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Dirección Legal (Fiscal)</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  value={legalAddress}
                  onChange={(e) => setLegalAddress(e.target.value)}
                  placeholder="Calle, Número, Piso, Oficina, Ciudad"
                  className="w-full bg-slate-50 border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Dirección Comercial */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Dirección Comercial (Administración)</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  value={commercialAddress}
                  onChange={(e) => setCommercialAddress(e.target.value)}
                  placeholder="Calle, Número, Oficina, Ciudad"
                  className="w-full bg-slate-50 border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* CUIT */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">CUIT (Código de Identificación Fiscal)</label>
              <input 
                type="text"
                required
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="30-XXXXXX-X"
                className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>

            {/* IIBB Tipo */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Ingresos Brutos (Régimen IIBB)</label>
              <select 
                value={iibbType}
                onChange={(e) => setIibbType(e.target.value)}
                className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="Convenio Multilateral">Convenio Multilateral</option>
                <option value="Local / Régimen General">Local / Régimen General</option>
                <option value="Régimen Simplificado">Régimen Simplificado</option>
                <option value="Exento">Exento</option>
                <option value="No Inscripto">No Inscripto</option>
              </select>
            </div>

          </div>
        </form>

        {/* Right Column: Users, Banks, Deposits, Subscription (1/3) */}
        <div className="space-y-6">
          
          {/* 1. LELFUN Subscription Status */}
          <div className="bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase font-bold">Lelfun Cloud Platform</span>
              <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono">
                {tenant.subscription?.status || "Activo"}
              </span>
            </div>
            
            <div>
              <p className="text-xs text-slate-400">Plan de Suscripción</p>
              <h4 className="text-lg font-bold font-display text-amber-400 mt-0.5">
                {tenant.subscription?.planName || "Lelfun SaaS Enterprise"}
              </h4>
            </div>

            <div className="border-t border-slate-800/80 pt-3 flex justify-between text-xs font-mono text-slate-300">
              <div>
                <p className="text-[10px] text-slate-500">PROYECTOS MAX</p>
                <p className="font-bold text-white text-sm">{tenant.subscription?.maxProjects || "Ilimitado"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">EXPIRES</p>
                <p className="font-bold text-white text-sm">{tenant.subscription?.activeUntil || "2027-12-31"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">PRECIO / MES</p>
                <p className="font-bold text-amber-400 text-sm">${tenant.subscription?.costPerMonth || "450"} USD</p>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => alert("Suscripción Enterprise administrada por el canal oficial. Soporte postventa: soporte@lelfun.com")}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 text-center cursor-pointer transition-colors"
            >
              Gestionar Suscripción LELFUN
            </button>
          </div>

          {/* 2. Active Users list */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4.5 h-4.5 text-indigo-500" /> Usuarios Activos
              </h4>
              <button
                type="button"
                onClick={() => setShowAddUser(!showAddUser)}
                className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg cursor-pointer"
                title="Dar de alta usuario"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showAddUser && (
              <form onSubmit={handleAddUser} className="bg-slate-50 p-3 rounded-xl border border-indigo-100 space-y-3.5 animate-slideDown">
                <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Alta de Nuevo Usuario</p>
                <div className="space-y-1.5">
                  <input 
                    type="text" 
                    required
                    placeholder="Nombre completo"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full bg-white border rounded px-2.5 py-1 text-xs outline-none focus:border-indigo-500"
                  />
                  <input 
                    type="email" 
                    required
                    placeholder="correo@empresa.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full bg-white border rounded px-2.5 py-1 text-xs outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full bg-white border rounded px-2 py-1 text-xs outline-none cursor-pointer"
                  >
                    <option value="Administrador General">Administrador General</option>
                    <option value="Director de Obra / Ingeniero">Director de Obra</option>
                    <option value="Tesorero">Tesorero</option>
                    <option value="Capataz / Compras">Capataz / Compras</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowAddUser(false)}
                    className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold cursor-pointer"
                  >
                    Dar de Alta
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {tenant.activeUsers?.map((usr, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{usr.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{usr.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-extrabold px-1.5 py-0.2 rounded font-sans uppercase">
                      {usr.role}
                    </span>
                    <span className="block text-[8px] text-slate-400 font-mono mt-0.5">Activo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Bank Accounts (Alta cuentas bancarias) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-4.5 h-4.5 text-emerald-500" /> Cuentas Bancarias
              </h4>
              <button
                type="button"
                onClick={() => setShowAddAccount(!showAddAccount)}
                className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg cursor-pointer"
                title="Agregar cuenta bancaria"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showAddAccount && (
              <form onSubmit={handleAddAccount} className="bg-slate-50 p-3 rounded-xl border border-emerald-100 space-y-3 animate-slideDown">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Alta de Cuenta Bancaria / Caja</p>
                <div className="space-y-1.5">
                  <input 
                    type="text" 
                    required
                    placeholder="Banco Galicia CC Pesos"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full bg-white border rounded px-2.5 py-1 text-xs outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newAccCurrency}
                      onChange={(e) => setNewAccCurrency(e.target.value as Currency)}
                      className="flex-1 bg-white border rounded px-2 py-1 text-xs outline-none cursor-pointer"
                    >
                      <option value={Currency.USD}>USD</option>
                      <option value={Currency.ARS}>ARS</option>
                      <option value={Currency.BRL}>BRL</option>
                    </select>
                    <input 
                      type="number" 
                      required
                      placeholder="Saldo Inicial"
                      value={newAccBalance}
                      onChange={(e) => setNewAccBalance(e.target.value)}
                      className="flex-1 bg-white border rounded px-2.5 py-1 text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowAddAccount(false)}
                    className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-3 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold cursor-pointer"
                  >
                    Registrar Cuenta
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {accounts.filter(a => a.type === "Banco").map((acc) => (
                <div key={acc.id} className="p-2.5 bg-slate-50 rounded-lg border text-xs flex justify-between items-center">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{acc.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Moneda: {acc.currency}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-slate-700">
                      {acc.currency === Currency.USD ? "$" : acc.currency === Currency.ARS ? "ARS " : "R$ "}
                      {acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
              {accounts.filter(a => a.type === "Banco").length === 0 && (
                <p className="text-center text-[10px] text-slate-400 py-3">No hay cuentas bancarias registradas</p>
              )}
            </div>
          </div>

          {/* 4. Places of Deposits (Lugares de Depósitos) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Warehouse className="w-4.5 h-4.5 text-amber-600" /> Lugares de Depósito (Obradores)
              </h4>
              <button
                type="button"
                onClick={() => setShowAddDeposit(!showAddDeposit)}
                className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg cursor-pointer"
                title="Agregar depósito"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showAddDeposit && (
              <form onSubmit={handleAddDeposit} className="bg-slate-50 p-3 rounded-xl border border-amber-100 space-y-3 animate-slideDown">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Alta de Depósito u Obrador</p>
                <div className="space-y-1.5">
                  <input 
                    type="text" 
                    required
                    placeholder="Depósito Central de Materiales"
                    value={newDepName}
                    onChange={(e) => setNewDepName(e.target.value)}
                    className="w-full bg-white border rounded px-2.5 py-1 text-xs outline-none focus:border-amber-500"
                  />
                  <input 
                    type="text" 
                    required
                    placeholder="Calle 123, Ciudad de Córdoba"
                    value={newDepAddress}
                    onChange={(e) => setNewDepAddress(e.target.value)}
                    className="w-full bg-white border rounded px-2.5 py-1 text-xs outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowAddDeposit(false)}
                    className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-3 py-1 bg-amber-600 text-white rounded text-[10px] font-bold cursor-pointer"
                  >
                    Agregar Obrador
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {tenant.deposits && tenant.deposits.length > 0 ? (
                tenant.deposits.map((dep) => (
                  <div key={dep.id} className="p-2.5 bg-slate-50 rounded-lg border text-xs flex items-start gap-2.5">
                    <Warehouse className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">{dep.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-3 h-3" /> {dep.address}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-[10px] text-slate-400 py-3">No hay depósitos u obradores registrados</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
