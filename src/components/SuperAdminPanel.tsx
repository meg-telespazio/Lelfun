import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import {
  Activity, AlertTriangle, BarChart3, Boxes, Building2, CreditCard, DollarSign,
  FileClock, HardDrive, LayoutDashboard, LogOut, Package, Receipt, RefreshCw,
  Menu, Pin, PinOff, ShieldCheck, Users, Wallet, X
} from "lucide-react";

type Section = "dashboard" | "users" | "tenants" | "usage" | "products" | "billing" | "fees" | "expenses" | "plans" | "audit";

const sections: { id: Section; label: string; icon: any }[] = [
  { id: "dashboard", label: "Resumen ejecutivo", icon: LayoutDashboard },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "tenants", label: "Tenants y licencias", icon: Building2 },
  { id: "usage", label: "Consumo", icon: HardDrive },
  { id: "products", label: "Marketplace", icon: Package },
  { id: "billing", label: "Cuentas y cobranzas", icon: CreditCard },
  { id: "fees", label: "Comisiones", icon: DollarSign },
  { id: "expenses", label: "Gastos operativos", icon: Receipt },
  { id: "plans", label: "Planes", icon: Boxes },
  { id: "audit", label: "Auditoría", icon: FileClock }
];

const money = (amount: number, currency = "USD") => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount || 0);

export default function SuperAdminPanel({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section>("dashboard");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const api = async (url: string, options: RequestInit = {}) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("La sesión de superadmin venció");
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Operación rechazada");
    return result;
  };

  const load = async () => { setLoading(true); setError(""); try { setData(await api("/api/superadmin/dashboard")); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cargar"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando consola segura…</div>;

  return <div className="min-h-screen bg-slate-100 flex text-slate-800">
    <aside className={`fixed inset-y-0 left-0 z-40 bg-slate-950 text-white flex flex-col border-r border-slate-800 transition-all duration-300 ${sidebarPinned ? "w-64" : "w-16 md:hover:w-64 group shadow-2xl max-md:w-64"} ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between overflow-hidden"><div className={`flex items-center ${sidebarPinned ? "gap-3" : "gap-0 md:group-hover:gap-3"}`}><img src="/lelfun.png" className="w-10 h-10 rounded-lg bg-white object-cover shrink-0" /><div className={`${sidebarPinned ? "w-auto opacity-100" : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100"} overflow-hidden transition-all`}><p className="font-extrabold whitespace-nowrap">LELFUN</p><span className="text-[9px] text-amber-400 tracking-widest font-bold whitespace-nowrap">SUPERADMIN</span></div></div><div className="flex"><button onClick={() => setSidebarPinned(value => !value)} className={`${sidebarPinned ? "" : "opacity-0 md:group-hover:opacity-100"} hidden md:block p-1.5 text-slate-400 hover:text-amber-400`} title={sidebarPinned ? "Desanclar barra" : "Fijar barra"}>{sidebarPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}</button><button onClick={() => setMobileSidebarOpen(false)} className="md:hidden p-1.5"><X className="w-5 h-5" /></button></div></div>
      <nav className="flex-1 p-3 space-y-1 overflow-auto">{sections.map(item => { const Icon = item.icon; return <button key={item.id} title={item.label} onClick={() => { setSection(item.id); setMobileSidebarOpen(false); }} className={`w-full flex items-center p-2.5 rounded-lg text-xs font-semibold ${sidebarPinned ? "gap-2.5 justify-start" : "gap-0 justify-center md:group-hover:gap-2.5 md:group-hover:justify-start"} ${section === item.id ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}><Icon className="w-4 h-4 shrink-0" /><span className={`${sidebarPinned ? "w-auto opacity-100" : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100"} overflow-hidden whitespace-nowrap transition-all`}>{item.label}</span></button>; })}</nav>
      <button onClick={onLogout} title="Cerrar sesión" className={`m-3 p-2.5 border border-slate-800 text-rose-400 rounded-lg text-xs flex items-center justify-center ${sidebarPinned ? "gap-2" : "gap-0 md:group-hover:gap-2"}`}><LogOut className="w-4 h-4 shrink-0" /><span className={`${sidebarPinned ? "w-auto opacity-100" : "w-0 opacity-0 md:group-hover:w-auto md:group-hover:opacity-100"} overflow-hidden whitespace-nowrap`}>Cerrar sesión</span></button>
    </aside>
    {mobileSidebarOpen && <div className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" onClick={() => setMobileSidebarOpen(false)} />}
    <main className={`${sidebarPinned ? "md:ml-64" : "md:ml-16"} flex-1 min-h-screen transition-all duration-300`}><header className="h-16 bg-white border-b px-4 md:px-6 flex items-center justify-between sticky top-0 z-20"><div className="flex items-center gap-3"><button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-2 border rounded-lg"><Menu className="w-4 h-4" /></button><div><h1 className="font-bold">Consola de Administración de Plataforma</h1><p className="text-[10px] text-slate-500">Sin acceso a clientes, proyectos, presupuestos ni datos operativos</p></div></div><button onClick={load} className="p-2 border rounded-lg"><RefreshCw className="w-4 h-4" /></button></header>
      <div className="p-6">{error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs">{error}</div>}{data && <SectionContent section={section} data={data} api={api} reload={load} />}</div>
    </main>
  </div>;
}

function SectionContent({ section, data, api, reload }: any) {
  if (section === "dashboard") return <Dashboard data={data} />;
  if (section === "users") return <UsersView data={data} api={api} reload={reload} />;
  if (section === "tenants") return <TenantsView data={data} api={api} reload={reload} />;
  if (section === "usage") return <UsageView data={data} />;
  if (section === "products") return <ProductsView data={data} api={api} reload={reload} />;
  if (section === "billing") return <BillingView data={data} api={api} reload={reload} />;
  if (section === "fees") return <FeesView data={data} />;
  if (section === "expenses") return <ExpensesView data={data} api={api} reload={reload} />;
  if (section === "plans") return <PlansView data={data} />;
  return <AuditView data={data} />;
}

function Dashboard({ data }: any) {
  const m = data.metrics;
  return <div className="space-y-5"><div className="grid grid-cols-2 xl:grid-cols-5 gap-4"><Kpi label="Tenants" value={m.tenantCount} icon={<Building2 />} /><Kpi label="Licencias activas" value={m.activeLicenses} icon={<ShieldCheck />} /><Kpi label="Proveedores" value={m.supplierCount} icon={<Users />} /><Kpi label="Por cobrar" value={money(m.pendingReceivables)} icon={<Wallet />} /><Kpi label="Margen registrado" value={money(m.margin)} icon={<BarChart3 />} /></div><div className="grid lg:grid-cols-2 gap-5"><Card title="Alertas activas">{data.alerts.length ? data.alerts.map((alert: any) => <div key={alert.id} className="py-3 border-t text-xs flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><div><strong>{alert.title}</strong><p className="text-slate-500">{alert.message}</p></div></div>) : <Empty text="Sin alertas activas" />}</Card><Card title="Actividad administrativa reciente">{data.audit.slice(0, 8).map((entry: any) => <div key={entry.id} className="py-2 border-t text-xs"><strong>{entry.action}</strong><span className="text-slate-400 ml-2">{entry.entity_type}</span><p className="text-[9px] text-slate-400">{new Date(entry.created_at).toLocaleString("es-AR")}</p></div>)}</Card></div></div>;
}

function UsersView({ data, api, reload }: any) {
  const toggle = async (user: any) => { await api(`/api/superadmin/users/${user.id}/access`, { method: "PUT", body: JSON.stringify({ blocked: !user.bannedUntil }) }); reload(); };
  return <Card title="Usuarios registrados"><Table headers={["Usuario", "Entorno", "Rol", "Último acceso", "Estado", "Acción"]}>{data.users.map((user: any) => <tr key={user.id} className="border-t"><Td><strong>{user.fullName || "Sin nombre"}</strong><p className="text-[10px] text-slate-500">{user.email}</p></Td><Td>{user.isSuperAdmin ? "Superadmin" : user.tenantMembership ? "Tenant" : "Proveedor"}</Td><Td>{user.tenantMembership?.role || user.supplierMembership?.role || "platform_admin"}</Td><Td>{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("es-AR") : "Nunca"}</Td><Td>{user.bannedUntil ? "Bloqueado" : "Activo"}</Td><Td>{!user.isSuperAdmin && <button onClick={() => toggle(user)} className={`px-2 py-1 rounded text-[10px] ${user.bannedUntil ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{user.bannedUntil ? "Habilitar" : "Bloquear"}</button>}</Td></tr>)}</Table></Card>;
}

function TenantsView({ data, api, reload }: any) {
  const licenseByTenant = (id: string) => data.licenses.find((license: any) => license.tenant_id === id);
  const change = async (tenant: any, status: string) => { await api(`/api/superadmin/tenants/${tenant.id}/license`, { method: "PUT", body: JSON.stringify({ status, suspensionReason: status === "SUSPENDED" ? "Suspensión administrativa" : null }) }); reload(); };
  return <Card title="Tenants y licencias"><Table headers={["Empresa", "Identificación", "Plan", "Vencimiento", "Usuarios", "Estado", "Acción"]}>{data.tenants.map((tenant: any) => { const license = licenseByTenant(tenant.id); const users = data.memberships.filter((member: any) => member.tenant_id === tenant.id && member.active).length; return <tr key={tenant.id} className="border-t"><Td><strong>{tenant.name}</strong><p className="text-[10px] text-slate-500">{tenant.legal_name}</p></Td><Td>{tenant.tax_id}<p className="text-[10px]">{tenant.phone}</p></Td><Td>{license?.subscription_plans?.name || "Sin plan"}</Td><Td>{license?.next_due_date || "—"}</Td><Td>{users}</Td><Td>{license?.status || "SIN LICENCIA"}</Td><Td><button onClick={() => change(tenant, license?.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED")} className="px-2 py-1 bg-slate-100 rounded text-[10px]">{license?.status === "SUSPENDED" ? "Reactivar" : "Suspender"}</button></Td></tr>; })}</Table></Card>;
}

function UsageView({ data }: any) { return <div className="space-y-4"><div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs">El consumo de Storage se calcula por tenant. Database muestra el total estimado; IA quedará sin consumo hasta integrar su telemetría.</div><Card title="Consumo por tenant"><Table headers={["Tenant", "Storage", "Database", "Límite", "Uso"]}>{data.tenants.map((tenant: any) => { const usage = data.usage?.find((item: any) => item.tenant_id === tenant.id); const license = data.licenses.find((item: any) => item.tenant_id === tenant.id); const limit = Number(license?.custom_storage_limit_gb ?? license?.subscription_plans?.storage_limit_gb ?? 0); const storage = Number(usage?.storage_bytes || 0) / 1073741824; return <tr key={tenant.id} className="border-t"><Td>{tenant.name}</Td><Td>{storage.toFixed(3)} GB</Td><Td>{(Number(usage?.database_bytes || 0) / 1073741824).toFixed(3)} GB</Td><Td>{limit} GB</Td><Td>{limit ? `${(storage / limit * 100).toFixed(1)}%` : "—"}</Td></tr>; })}</Table></Card></div>; }

function ProductsView({ data, api, reload }: any) {
  const moderateSupplier = async (supplier: any, status: string) => {
    const notes = status === "REJECTED" || status === "SUSPENDED" ? prompt("Motivo para informar al proveedor") || "Decisión administrativa" : null;
    await api(`/api/superadmin/suppliers/${supplier.id}/status`, { method: "PUT", body: JSON.stringify({ status, notes }) });
    reload();
  };
  const suspend = async (product: any) => { const suspended = product.status !== "SUSPENDED"; await api(`/api/superadmin/products/${product.id}/suspend`, { method: "PUT", body: JSON.stringify({ suspended, reason: suspended ? prompt("Motivo de suspensión") || "Publicación indebida" : null }) }); reload(); };
  const suppliers = [...data.suppliers].sort((a: any, b: any) => (a.approval_status === "PENDING" ? -1 : 1) - (b.approval_status === "PENDING" ? -1 : 1));
  const pending = suppliers.filter((supplier: any) => supplier.approval_status === "PENDING").length;
  return <div className="space-y-5">
    <Card title={`Ingreso de proveedores${pending ? ` · ${pending} pendiente${pending === 1 ? "" : "s"}` : ""}`}>
      {suppliers.length ? <Table headers={["Empresa", "CUIT", "Contacto", "Registro", "Estado", "Acciones"]}>{suppliers.map((supplier: any) => <tr key={supplier.id} className={`border-t ${supplier.approval_status === "PENDING" ? "bg-amber-50/60" : ""}`}><Td><strong>{supplier.trade_name || supplier.legal_name}</strong><p className="text-[10px] text-slate-500">{supplier.legal_name}</p></Td><Td>{supplier.tax_id}</Td><Td>{supplier.contact_email}<p className="text-[10px]">{supplier.phone || "—"}</p></Td><Td>{new Date(supplier.created_at).toLocaleDateString("es-AR")}</Td><Td><span className={`px-2 py-1 rounded-full text-[9px] font-bold ${supplier.approval_status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : supplier.approval_status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{supplier.approval_status}</span></Td><Td><div className="flex flex-wrap gap-1">{supplier.approval_status !== "APPROVED" && <button onClick={() => moderateSupplier(supplier, "APPROVED")} className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold">Aprobar</button>}{supplier.approval_status === "PENDING" && <button onClick={() => moderateSupplier(supplier, "REJECTED")} className="px-2 py-1 bg-rose-600 text-white rounded text-[10px]">Rechazar</button>}{supplier.approval_status === "APPROVED" && <button onClick={() => moderateSupplier(supplier, "SUSPENDED")} className="px-2 py-1 bg-rose-50 text-rose-700 rounded text-[10px]">Suspender</button>}</div></Td></tr>)}</Table> : <Empty text="No hay proveedores registrados" />}
    </Card>
    <Card title="Moderación de publicaciones"><Table headers={["Producto", "Proveedor", "Publicado", "Vence", "Estado", "Moderación"]}>{data.products.map((product: any) => <tr key={product.id} className="border-t"><Td><strong>{product.name}</strong></Td><Td>{product.supplier_organizations?.trade_name || product.supplier_organizations?.legal_name}</Td><Td>{new Date(product.created_at).toLocaleDateString("es-AR")}</Td><Td>{product.expires_at ? new Date(product.expires_at).toLocaleDateString("es-AR") : "—"}</Td><Td>{product.status}</Td><Td><button onClick={() => suspend(product)} className="px-2 py-1 bg-rose-50 text-rose-700 rounded text-[10px]">{product.status === "SUSPENDED" ? "Restaurar" : "Suspender"}</button></Td></tr>)}</Table></Card>
  </div>;
}

function BillingView({ data, api, reload }: any) { const paid = async (entry: any) => { await api(`/api/superadmin/billing/${entry.id}/paid`, { method: "PUT", body: "{}" }); reload(); }; return <Card title="Estado de cuenta y cobranzas"><Table headers={["Fecha", "Cuenta", "Concepto", "Neto", "IVA", "Total", "Estado"]}>{data.billingEntries.map((entry: any) => <tr key={entry.id} className="border-t"><Td>{new Date(entry.created_at).toLocaleDateString("es-AR")}</Td><Td>{entry.tenants?.name || entry.supplier_organizations?.trade_name || entry.supplier_organizations?.legal_name}</Td><Td>{entry.description}</Td><Td>{money(entry.net_amount, entry.currency)}</Td><Td>{money(entry.tax_amount, entry.currency)}</Td><Td><strong>{money(entry.total_amount, entry.currency)}</strong></Td><Td>{entry.status !== "PAID" ? <button onClick={() => paid(entry)} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px]">Marcar pagado</button> : "Pagado"}</Td></tr>)}</Table></Card>; }

function FeesView({ data }: any) { return <Card title="Comisiones del Marketplace"><Table headers={["Operación", "Pagador", "Base", "%", "IVA", "Total", "Estado"]}>{data.serviceFees.map((fee: any) => <tr key={fee.id} className="border-t"><Td>{fee.operation_type}</Td><Td>{fee.payer_type === "TENANT" ? fee.tenants?.name : fee.supplier_organizations?.trade_name || fee.supplier_organizations?.legal_name}</Td><Td>{money(fee.taxable_amount, fee.currency)}</Td><Td>{fee.percentage}%</Td><Td>{money(fee.tax_amount, fee.currency)}</Td><Td><strong>{money(fee.total_amount || fee.fee_amount, fee.currency)}</strong></Td><Td>{fee.status}</Td></tr>)}</Table></Card>; }

function ExpensesView({ data, api, reload }: any) { const [form, setForm] = useState<any>({ category: "SUPABASE", description: "", currency: "USD", netAmount: "", taxAmount: "0", expenseDate: new Date().toISOString().slice(0, 10), recurring: false, recurrence: "MONTHLY" }); const submit = async (event: FormEvent) => { event.preventDefault(); await api("/api/superadmin/expenses", { method: "POST", body: JSON.stringify(form) }); setForm({ ...form, description: "", netAmount: "", taxAmount: "0" }); reload(); }; return <div className="space-y-5"><Card title="Registrar gasto"><form onSubmit={submit} className="grid md:grid-cols-4 gap-2"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="border rounded p-2 text-xs">{["SUPABASE","HOSTING","DOMAIN_CERTIFICATES","AI","SMTP","DEVELOPMENT_SUPPORT","MARKETING","TAXES","OTHER_SAAS"].map(value => <option key={value}>{value}</option>)}</select><input required placeholder="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="border rounded p-2 text-xs" /><select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="border rounded p-2 text-xs"><option>USD</option><option>ARS</option></select><input required type="number" placeholder="Neto" value={form.netAmount} onChange={e => setForm({ ...form, netAmount: e.target.value })} className="border rounded p-2 text-xs" /><input type="number" placeholder="Impuestos" value={form.taxAmount} onChange={e => setForm({ ...form, taxAmount: e.target.value })} className="border rounded p-2 text-xs" /><input type="date" value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} className="border rounded p-2 text-xs" /><label className="text-xs flex items-center gap-2"><input type="checkbox" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} /> Recurrente</label><button className="bg-slate-900 text-white rounded p-2 text-xs font-bold">Registrar</button></form></Card><Card title="Gastos registrados"><Table headers={["Fecha", "Categoría", "Descripción", "Total", "Recurrencia"]}>{data.expenses.map((expense: any) => <tr key={expense.id} className="border-t"><Td>{expense.expense_date}</Td><Td>{expense.expense_category}</Td><Td>{expense.description}</Td><Td>{money(expense.total_amount, expense.currency)}</Td><Td>{expense.recurring ? expense.recurrence : "Único"}</Td></tr>)}</Table></Card></div>; }

function PlansView({ data }: any) { return <div className="grid md:grid-cols-3 gap-4">{data.plans.map((plan: any) => <div key={plan.id} className="bg-white border rounded-xl p-5"><span className="text-[10px] font-bold text-amber-700">{plan.code}</span><h3 className="text-lg font-bold">{plan.name}</h3><p className="text-2xl font-mono font-extrabold my-3">{money(plan.monthly_price, plan.currency)}<small className="text-xs">/mes</small></p><div className="text-xs space-y-1 text-slate-500"><p>{plan.max_projects || "Ilimitadas"} obras</p><p>{plan.max_users || "Configurables"} usuarios</p><p>{plan.storage_limit_gb} GB</p><p>{plan.enabled_modules.length} módulos</p></div></div>)}</div>; }
function AuditView({ data }: any) { return <Card title="Auditoría administrativa"><Table headers={["Fecha", "Acción", "Entidad", "Identificador"]}>{data.audit.map((entry: any) => <tr key={entry.id} className="border-t"><Td>{new Date(entry.created_at).toLocaleString("es-AR")}</Td><Td>{entry.action}</Td><Td>{entry.entity_type}</Td><Td><code className="text-[10px]">{entry.entity_id || "—"}</code></Td></tr>)}</Table></Card>; }

function Kpi({ label, value, icon }: any) { return <div className="bg-white border rounded-xl p-4"><span className="text-slate-400 [&>svg]:w-5 [&>svg]:h-5">{icon}</span><p className="text-xl font-extrabold mt-2">{value}</p><p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p></div>; }
function Card({ title, children }: any) { return <section className="bg-white border border-slate-200 rounded-xl p-4 overflow-hidden"><h2 className="font-bold text-sm mb-3">{title}</h2>{children}</section>; }
function Table({ headers, children }: any) { return <div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="text-[10px] uppercase text-slate-400">{headers.map((header: string) => <th key={header} className="py-2 pr-3">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Td({ children }: any) { return <td className="py-3 pr-3 align-top">{children}</td>; }
function Empty({ text }: any) { return <p className="text-xs text-slate-400 py-8 text-center">{text}</p>; }
