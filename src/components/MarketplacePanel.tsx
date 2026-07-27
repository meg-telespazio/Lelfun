/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FormEvent, ReactElement, useEffect, useMemo, useState } from "react";
import { Currency, Project } from "../types.js";
import {
  AlertTriangle,
  Award,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  Eye,
  FileQuestion,
  Gavel,
  Loader2,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Users,
  X,
} from "lucide-react";

interface MarketplacePanelProps {
  tenantId: string;
  userEmail: string;
  isSupplier: boolean;
  projects: Project[];
  initialSection?: string;
}

type MarketplaceTab =
  | "catalog"
  | "tenders"
  | "awards"
  | "purchases"
  | "supplier"
  | "admin";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function MarketplacePanel({
  tenantId,
  userEmail,
  isSupplier,
  projects,
  initialSection,
}: MarketplacePanelProps) {
  const [tab, setTab] = useState<MarketplaceTab>(
    isSupplier ? "supplier" : "catalog",
  );
  const [context, setContext] = useState<any>({
    categories: [],
    products: [],
    tenders: [],
    directRequests: [],
    submissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showTenderForm, setShowTenderForm] = useState(false);
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [notificationCenter, setNotificationCenter] = useState<any>({ notifications: [], unread: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const loadNotifications = async () => { const response = await fetch("/api/marketplace/v2/notifications"); if (response.ok) setNotificationCenter(await response.json()); };

  const loadContext = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/marketplace/v2/context?email=${encodeURIComponent(userEmail)}&tenantId=${encodeURIComponent(tenantId)}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo cargar el Marketplace");
      setContext(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar el Marketplace",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
    loadNotifications();
  }, [tenantId, userEmail]);

  useEffect(() => {
    if (context.isSuperAdmin) setTab("admin");
    else if (initialSection === "catalog" || initialSection === "tenders")
      setTab(initialSection);
    else if (initialSection) setTab("supplier");
    else if (isSupplier) setTab("supplier");
  }, [context.isSuperAdmin, isSupplier, initialSection]);

  const products = useMemo(
    () =>
      context.products.filter((product: any) => {
        const text =
          `${product.name} ${product.brand || ""} ${product.description || ""}`.toLowerCase();
        return (
          product.status === "ACTIVE" &&
          (!search || text.includes(search.toLowerCase())) &&
          (!categoryFilter || product.category_id === categoryFilter)
        );
      }),
    [context.products, search, categoryFilter],
  );

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando Marketplace…
      </div>
    );
  }

  return (
    <div className="space-y-5" id="marketplace-v2">
      <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold">
            Lelfun Marketplace
          </span>
          <h2 className="text-xl font-extrabold mt-1">
            Materiales, servicios y licitaciones de obra
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Catálogo privado para constructoras y portal comercial para
            proveedores aprobados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!context.isSuperAdmin && (
            <TabButton
              active={tab === "catalog"}
              onClick={() => setTab("catalog")}
              icon={<Store />}
              label="Catálogo"
            />
          )}
          {!context.isSuperAdmin && (
            <TabButton
              active={tab === "tenders"}
              onClick={() => setTab("tenders")}
              icon={<Gavel />}
              label="Licitaciones"
            />
          )}
          {!context.isSuperAdmin && (
            <TabButton active={tab === "awards"} onClick={() => setTab("awards")} icon={<Award />} label="Adjudicaciones" />
          )}
          {!context.isSuperAdmin && !isSupplier && (
            <TabButton
              active={tab === "purchases"}
              onClick={() => setTab("purchases")}
              icon={<ShoppingCart />}
              label="Mis compras"
            />
          )}
          {isSupplier && (
            <TabButton
              active={tab === "supplier"}
              onClick={() => setTab("supplier")}
              icon={<Building2 />}
              label="Mi empresa"
            />
          )}
          {context.isSuperAdmin && (
            <TabButton
              active={tab === "admin"}
              onClick={() => setTab("admin")}
              icon={<ShieldCheck />}
              label="Superadmin"
            />
          )}
          {!context.isSuperAdmin && <div className="relative"><button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"><Bell className="w-4 h-4" />{notificationCenter.unread > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full min-w-4 h-4 px-1 text-[9px] flex items-center justify-center">{notificationCenter.unread}</span>}</button>{showNotifications && <NotificationCenter data={notificationCenter} onRefresh={loadNotifications} onClose={() => setShowNotifications(false)} />}</div>}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {tab === "catalog" && (
        <Catalog
          products={products}
          categories={context.categories}
          search={search}
          categoryFilter={categoryFilter}
          onSearch={setSearch}
          onCategory={setCategoryFilter}
          onSelect={setSelectedProduct}
        />
      )}

      {tab === "tenders" && (
        <Tenders
          tenders={context.tenders}
          isSupplier={isSupplier}
          onCreate={() => setShowTenderForm(true)}
          onSelect={setSelectedTender}
        />
      )}

      {tab === "purchases" && (
        <BuyerPurchases
          requests={context.directRequests || []}
          onRefresh={loadContext}
        />
      )}

      {tab === "awards" && <AwardsTracking tenders={context.tenders || []} submissions={context.submissions || []} isSupplier={isSupplier} onSelect={setSelectedTender} />}

      {tab === "supplier" && (
        <SupplierPortal
          supplier={context.supplier}
          products={context.products.filter(
            (product: any) => product.supplier_id === context.supplier?.id,
          )}
          requests={context.directRequests}
          questions={context.supplierQuestions || []}
          membership={context.featuredMembership}
          featuredProductIds={context.featuredProductIds || []}
          email={userEmail}
          onAddProduct={() => setShowProductForm(true)}
          onEditProduct={(product: any) => {
            setEditingProduct(product);
            setShowProductForm(true);
          }}
          onRefresh={loadContext}
        />
      )}

      {tab === "admin" && (
        <SuperAdmin
          context={context}
          email={userEmail}
          onRefresh={loadContext}
        />
      )}

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          tenantId={tenantId}
          email={userEmail}
          projects={projects}
          onClose={() => setSelectedProduct(null)}
          onDone={() => {
            setSelectedProduct(null);
            loadContext();
          }}
        />
      )}
      {selectedTender && (
        <TenderDetail
          tender={selectedTender}
          supplier={context.supplier}
          submissions={(context.submissions || []).filter(
            (submission: any) => submission.tender_id === selectedTender.id,
          )}
          tenantId={tenantId}
          email={userEmail}
          isSupplier={isSupplier}
          onClose={() => setSelectedTender(null)}
          onDone={() => {
            setSelectedTender(null);
            loadContext();
          }}
        />
      )}
      {showProductForm && (
        <ProductForm
          categories={context.categories}
          email={userEmail}
          initialProduct={editingProduct}
          onClose={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
          onDone={() => {
            setShowProductForm(false);
            setEditingProduct(null);
            loadContext();
          }}
        />
      )}
      {showTenderForm && (
        <TenderForm
          categories={context.categories}
          suppliers={context.suppliers || []}
          projects={projects}
          tenantId={tenantId}
          email={userEmail}
          onClose={() => setShowTenderForm(false)}
          onDone={() => {
            setShowTenderForm(false);
            loadContext();
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactElement;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${active ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
    >
      <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      {label}
    </button>
  );
}

function Catalog({
  products,
  categories,
  search,
  categoryFilter,
  onSearch,
  onCategory,
  onSelect,
}: any) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar materiales, marcas o servicios…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => onCategory(event.target.value)}
          className="border rounded-lg px-3 py-2 text-xs bg-white"
        >
          <option value="">Todos los rubros</option>
          {categories.map((category: any) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {products.length === 0 ? (
        <Empty
          icon={<Package />}
          text="No hay productos que coincidan con la búsqueda."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product: any) => (
            <button
              key={product.id}
              onClick={() => onSelect(product)}
              className="text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-amber-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="h-36 bg-slate-100 flex items-center justify-center overflow-hidden">
                {product.marketplace_product_media?.[0] ? (
                  <img
                    src={`/api/marketplace/v2/media?path=${encodeURIComponent(product.marketplace_product_media[0].storage_path)}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Boxes className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    {product.name}
                  </h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full h-fit">
                    Stock {product.stock_quantity ?? "a consultar"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2">
                  {product.description}
                </p>
                <p className="text-[10px] font-semibold text-slate-500">
                  {product.supplier_organizations?.trade_name ||
                    product.supplier_organizations?.legal_name}
                </p>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] text-slate-400">Desde</span>
                    <p className="font-mono font-extrabold text-amber-700">
                      {product.price_on_request
                        ? "Consultar"
                        : money(product.base_price, product.currency)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Tenders({ tenders, isSupplier, onCreate, onSelect }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-900">Procesos de compra</h3>
          <p className="text-xs text-slate-500">
            RFI informativas y RFP con adjudicación por renglón.
          </p>
        </div>
        {!isSupplier && (
          <button
            onClick={onCreate}
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nueva licitación
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tenders.map((tender: any) => (
          <button
            key={tender.id}
            onClick={() => onSelect(tender)}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-amber-400 cursor-pointer"
          >
            <div className="flex justify-between gap-3">
              <div>
                <span
                  className={`text-[9px] font-bold px-2 py-1 rounded ${tender.process_type === "RFP" ? "bg-indigo-50 text-indigo-700" : "bg-cyan-50 text-cyan-700"}`}
                >
                  {tender.process_type} · {tender.visibility}
                </span>
                <h4 className="font-bold text-sm mt-2">{tender.title}</h4>
                <p className="text-[10px] text-slate-500 mt-1">
                  {tender.tenants?.name} · {tender.projects?.name}
                </p>
              </div>
              <span className="text-[9px] font-bold text-amber-700">
                {tender.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-3 line-clamp-2">
              {tender.description}
            </p>
            <div className="flex justify-between mt-3 pt-3 border-t text-[10px] text-slate-500">
              <span>
                {tender.marketplace_tender_lines?.length || 0} renglones
              </span>
              <span>
                Cierre {new Date(tender.closes_at).toLocaleDateString("es-AR")}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function NotificationCenter({ data, onRefresh, onClose }: any) {
  const mark = async (notification:any) => { if(!notification.read_at) await fetch(`/api/marketplace/v2/notifications/${notification.id}/read`,{method:"PUT"}); onRefresh(); };
  const readAll = async () => { await fetch("/api/marketplace/v2/notifications/read-all",{method:"PUT"}); onRefresh(); };
  return <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-auto bg-white text-slate-900 rounded-xl border shadow-2xl"><div className="sticky top-0 bg-white border-b p-3 flex justify-between items-center"><div><strong className="text-xs">Notificaciones</strong><p className="text-[9px] text-slate-500">{data.unread} sin leer</p></div><div className="flex gap-2"><button onClick={readAll} className="text-[9px] text-indigo-700">Leer todas</button><button onClick={onClose}><X className="w-4 h-4" /></button></div></div>{data.notifications.length ? data.notifications.map((notification:any)=><button key={notification.id} onClick={()=>mark(notification)} className={`w-full text-left p-3 border-b hover:bg-slate-50 ${notification.read_at?"opacity-60":"bg-amber-50"}`}><p className="text-[10px] font-bold">{notification.title}</p><p className="text-[9px] text-slate-600 mt-1">{notification.message}</p><p className="text-[8px] text-slate-400 mt-1">{new Date(notification.created_at).toLocaleString("es-AR")}</p></button>) : <p className="p-6 text-center text-xs text-slate-400">No hay notificaciones.</p>}</div>;
}

function AwardsTracking({ tenders, submissions, isSupplier, onSelect }: any) {
  const rows = isSupplier ? submissions.filter((submission:any)=>["PARTIALLY_AWARDED","AWARDED","NOT_AWARDED"].includes(submission.status)).map((submission:any)=>({ id:submission.tender_id,status:submission.status,title:tenders.find((t:any)=>t.id===submission.tender_id)?.title||"Licitación",tender:tenders.find((t:any)=>t.id===submission.tender_id) })) : tenders.filter((tender:any)=>tender.status==="AWARDED").map((tender:any)=>({id:tender.id,status:tender.status,title:tender.title,tender}));
  return <div className="space-y-4"><div><h3 className="font-bold">Seguimiento de adjudicaciones</h3><p className="text-xs text-slate-500">Renglones ganados, perdidos y procesos adjudicados.</p></div>{rows.length?<div className="grid md:grid-cols-2 gap-4">{rows.map((row:any)=><button key={row.id} onClick={()=>row.tender&&onSelect(row.tender)} className="bg-white border rounded-xl p-4 text-left hover:border-amber-400"><div className="flex justify-between"><strong className="text-sm">{row.title}</strong><span className={`text-[9px] font-bold px-2 py-1 rounded ${row.status==="NOT_AWARDED"?"bg-slate-100":"bg-emerald-50 text-emerald-700"}`}>{row.status}</span></div><p className="text-[10px] text-slate-500 mt-2">Abrir detalle y comparador del proceso</p></button>)}</div>:<Empty icon={<Award />} text="Todavía no hay adjudicaciones para mostrar." />}</div>;
}
function BuyerPurchases({ requests, onRefresh }: any) {
  const respond = async (request: any, action: string) => {
    if (
      !confirm(
        action === "ACCEPT_CHANGES"
          ? "¿Confirma que acepta la contrapropuesta del proveedor?"
          : "¿Confirma que cancela la solicitud?",
      )
    )
      return;
    const response = await fetch(
      `/api/marketplace/v2/direct-requests/${request.id}/buyer-response`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onRefresh();
  };
  const operate = async (request: any, action: string) => {
    const message = action === "CLAIM" ? prompt("Describa el reclamo") : "";
    if (action === "CLAIM" && !message) return;
    if (
      action === "COMPLETE" &&
      !confirm("¿Confirma que recibió correctamente la compra o servicio?")
    )
      return;
    const response = await fetch(
      `/api/marketplace/v2/direct-requests/${request.id}/operation`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onRefresh();
  };
  const review = async (request: any) => {
    const score = Number(prompt("Calificación general de 1 a 5", "5"));
    if (!score) return;
    const comment = prompt("Comentario opcional") || "";
    const response = await fetch(
      `/api/marketplace/v2/direct-requests/${request.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceRating: score,
          qualityRating: score,
          deliveryRating: score,
          serviceRating: score,
          comment,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    alert("Calificación registrada");
  };
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-slate-900">Mis solicitudes de compra</h3>
        <p className="text-xs text-slate-500">
          Seguimiento de pedidos, respuestas y contrapropuestas de proveedores.
        </p>
      </div>
      {requests.length ? (
        <div className="grid lg:grid-cols-2 gap-4">
          {requests.map((request: any) => (
            <section
              key={request.id}
              className="bg-white border border-slate-200 rounded-xl p-4 text-xs"
            >
              <div className="flex justify-between">
                <strong>Solicitud {request.id.slice(0, 8)}</strong>
                <span className="font-bold text-amber-700">
                  {request.status}
                </span>
              </div>
              <div className="mt-3 space-y-1">
                {request.marketplace_direct_request_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {item.quantity} × {item.marketplace_products?.name}
                    </span>
                    <span>
                      {money(
                        item.proposed_unit_price ?? item.unit_price,
                        request.currency,
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {request.supplier_response && (
                <p className="bg-amber-50 p-2 rounded mt-3">
                  <strong>Proveedor:</strong> {request.supplier_response}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {request.status === "CHANGES_PROPOSED" && (
                  <>
                    <button
                      onClick={() => respond(request, "ACCEPT_CHANGES")}
                      className="bg-emerald-600 text-white rounded px-3 py-1.5 text-[10px] font-bold"
                    >
                      Aceptar cambios
                    </button>
                    <button
                      onClick={() => respond(request, "CANCEL")}
                      className="bg-rose-50 text-rose-700 rounded px-3 py-1.5 text-[10px] font-bold"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {["PENDING", "CONFIRMED"].includes(request.status) && (
                  <button
                    onClick={() => respond(request, "CANCEL")}
                    className="text-rose-600 text-[10px] font-bold"
                  >
                    Cancelar solicitud
                  </button>
                )}
                {request.status === "ACCEPTED" && (
                  <button
                    onClick={() => operate(request, "COMPLETE")}
                    className="bg-emerald-600 text-white rounded px-3 py-1.5 text-[10px] font-bold"
                  >
                    Confirmar recepción
                  </button>
                )}
                {["ACCEPTED", "COMPLETED"].includes(request.status) && (
                  <button
                    onClick={() => operate(request, "CLAIM")}
                    className="bg-rose-50 text-rose-700 rounded px-3 py-1.5 text-[10px] font-bold"
                  >
                    Abrir reclamo
                  </button>
                )}
                {request.status === "COMPLETED" && (
                  <button
                    onClick={() => review(request)}
                    className="bg-amber-500 rounded px-3 py-1.5 text-[10px] font-bold"
                  >
                    Calificar
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          icon={<ShoppingCart />}
          text="Todavía no realizó solicitudes de compra."
        />
      )}
    </div>
  );
}

function SupplierPortal({
  supplier,
  products,
  requests,
  questions,
  membership,
  featuredProductIds,
  email,
  onAddProduct,
  onEditProduct,
  onRefresh,
}: any) {
  const [store, setStore] = useState({
    slug: supplier?.store_slug || "",
    tradeName: supplier?.trade_name || "",
    description: supplier?.company_description || "",
    city: supplier?.city || "",
    province: supplier?.province || "",
  });
  const [savingStore, setSavingStore] = useState(false);
  if (!supplier)
    return (
      <Empty
        icon={<Building2 />}
        text="No se encontró el perfil de empresa proveedora para este usuario."
      />
    );
  const respond = async (request: any, status: string) => {
    const response =
      prompt(
        status === "CHANGES_PROPOSED"
          ? "Detalle los cambios propuestos"
          : "Comentario opcional",
      ) || "";
    const items =
      status === "CHANGES_PROPOSED"
        ? request.marketplace_direct_request_items.map((item: any) => ({
            id: item.id,
            proposedUnitPrice: Number(
              prompt(
                `Nuevo precio unitario para ${item.marketplace_products?.name}`,
                String(item.proposed_unit_price ?? item.unit_price ?? 0),
              ),
            ),
          }))
        : [];
    const result = await fetch(
      `/api/marketplace/v2/direct-requests/${request.id}/respond`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status, response, items }),
      },
    );
    const payload = await result.json();
    if (!result.ok) return alert(payload.error);
    onRefresh();
  };
  const republish = async (product: any) => {
    const response = await fetch(
      `/api/marketplace/v2/products/${product.id}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status: "ACTIVE", republish: true }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onRefresh();
  };
  const saveStore = async (event: FormEvent) => {
    event.preventDefault();
    setSavingStore(true);
    const response = await fetch("/api/marketplace/v2/supplier/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });
    const result = await response.json();
    setSavingStore(false);
    if (!response.ok) return alert(result.error);
    onRefresh();
  };
  const answerQuestion = async (question: any) => {
    const answer = prompt(
      "Escriba la respuesta pública",
      question.answer || "",
    );
    if (!answer) return;
    const response = await fetch(
      `/api/marketplace/v2/questions/${question.id}/answer`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onRefresh();
  };
  const toggleFeatured = async (product: any) => {
    const response = await fetch(
      `/api/marketplace/v2/featured-products/${product.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featured: !featuredProductIds.includes(product.id),
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onRefresh();
  };
  const claimRequest = async (request: any) => {
    const message = prompt("Describa el reclamo");
    if (!message) return;
    const response = await fetch(
      `/api/marketplace/v2/direct-requests/${request.id}/operation`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLAIM", message }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onRefresh();
  };
  const reviewBuyer = async (request: any) => {
    const score = Number(prompt("Calificación del comprador de 1 a 5", "5"));
    if (!score) return;
    const comment = prompt("Comentario opcional") || "";
    const response = await fetch(
      `/api/marketplace/v2/direct-requests/${request.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceRating: score,
          qualityRating: score,
          deliveryRating: score,
          serviceRating: score,
          comment,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    alert("Calificación registrada");
  };
  return (
    <div className="space-y-5">
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 ${supplier.approval_status === "APPROVED" ? "bg-emerald-50 border-emerald-200" : supplier.approval_status === "SUSPENDED" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}
      >
        <ShieldCheck className="w-5 h-5 mt-0.5" />
        <div>
          <p className="font-bold text-sm">
            {supplier.trade_name || supplier.legal_name}
          </p>
          <p className="text-xs mt-1">
            Estado: <strong>{supplier.approval_status}</strong>
            {supplier.approval_status === "PENDING" &&
              " · El superadmin debe aprobar la empresa antes de publicar."}
          </p>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Mis publicaciones
              </h3>
              {membership && (
                <p className="text-[9px] text-amber-700 mt-1">
                  Membresía destacada activa · {featuredProductIds.length}{" "}
                  seleccionadas
                </p>
              )}
            </div>
            <button
              disabled={supplier.approval_status !== "APPROVED"}
              onClick={onAddProduct}
              className="px-2.5 py-1.5 bg-slate-900 text-white disabled:opacity-40 rounded text-[10px] font-bold cursor-pointer"
            >
              <Plus className="inline w-3 h-3" /> Publicar
            </button>
          </div>
          {products.length ? (
            products.map((product: any) => (
              <div
                key={product.id}
                className="py-2.5 border-t flex justify-between items-center text-xs"
              >
                <div>
                  <p className="font-bold">{product.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {product.currency} {product.base_price || "Consultar"} ·
                    vence{" "}
                    {product.expires_at
                      ? new Date(product.expires_at).toLocaleDateString("es-AR")
                      : "sin fecha"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold block mb-1">
                    {product.status}
                  </span>
                  <div className="flex gap-1">
                    {membership && product.status === "ACTIVE" && (
                      <button
                        onClick={() => toggleFeatured(product)}
                        className={`px-2 py-1 rounded text-[9px] ${featuredProductIds.includes(product.id) ? "bg-amber-500 font-bold" : "bg-amber-50 text-amber-700"}`}
                      >
                        {featuredProductIds.includes(product.id)
                          ? "Destacado"
                          : "Destacar"}
                      </button>
                    )}
                    <button
                      onClick={() => onEditProduct(product)}
                      className="px-2 py-1 bg-slate-100 rounded text-[9px]"
                    >
                      Editar
                    </button>
                    {product.status === "ARCHIVED" && (
                      <button
                        onClick={() => republish(product)}
                        className="px-2 py-1 bg-amber-500 rounded text-[9px] font-bold"
                      >
                        Republicar 30 días
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">
              Todavía no publicó productos.
            </p>
          )}
        </section>
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4" /> Solicitudes directas
          </h3>
          {requests.length ? (
            requests.map((request: any) => (
              <div key={request.id} className="py-3 border-t text-xs">
                <div className="flex justify-between">
                  <strong>Solicitud {request.id.slice(0, 8)}</strong>
                  <span className="font-bold">{request.status}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {request.marketplace_direct_request_items?.map(
                    (item: any) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-[10px] text-slate-600"
                      >
                        <span>
                          {item.quantity} × {item.marketplace_products?.name}
                        </span>
                        <span>
                          {money(
                            item.proposed_unit_price ?? item.unit_price,
                            request.currency,
                          )}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                {request.supplier_response && (
                  <p className="text-[10px] bg-amber-50 p-2 rounded mt-2">
                    {request.supplier_response}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {["PENDING", "CONFIRMED"].includes(request.status) && (
                    <>
                      <button
                        onClick={() => respond(request, "ACCEPTED")}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[9px]"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => respond(request, "CHANGES_PROPOSED")}
                        className="px-2 py-1 bg-amber-500 rounded text-[9px]"
                      >
                        Proponer cambios
                      </button>
                      <button
                        onClick={() => respond(request, "REJECTED")}
                        className="px-2 py-1 bg-rose-600 text-white rounded text-[9px]"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {["ACCEPTED", "COMPLETED"].includes(request.status) && (
                    <button
                      onClick={() => claimRequest(request)}
                      className="px-2 py-1 bg-rose-50 text-rose-700 rounded text-[9px]"
                    >
                      Abrir reclamo
                    </button>
                  )}
                  {request.status === "COMPLETED" && (
                    <button
                      onClick={() => reviewBuyer(request)}
                      className="px-2 py-1 bg-amber-500 rounded text-[9px] font-bold"
                    >
                      Calificar comprador
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">
              No hay solicitudes pendientes.
            </p>
          )}
        </section>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Store className="w-4 h-4" /> Configuración de la tienda
          </h3>
          <form onSubmit={saveStore} className="grid grid-cols-2 gap-2">
            <input
              required
              value={store.tradeName}
              onChange={(e) =>
                setStore({ ...store, tradeName: e.target.value })
              }
              placeholder="Nombre comercial"
              className="border rounded p-2 text-xs"
            />
            <input
              required
              value={store.slug}
              onChange={(e) => setStore({ ...store, slug: e.target.value })}
              placeholder="Dirección de la tienda"
              className="border rounded p-2 text-xs"
            />
            <input
              value={store.city}
              onChange={(e) => setStore({ ...store, city: e.target.value })}
              placeholder="Ciudad"
              className="border rounded p-2 text-xs"
            />
            <input
              value={store.province}
              onChange={(e) => setStore({ ...store, province: e.target.value })}
              placeholder="Provincia"
              className="border rounded p-2 text-xs"
            />
            <textarea
              value={store.description}
              onChange={(e) =>
                setStore({ ...store, description: e.target.value })
              }
              placeholder="Descripción comercial"
              className="col-span-2 border rounded p-2 text-xs h-20"
            />
            <button
              disabled={savingStore}
              className="col-span-2 bg-slate-900 text-white rounded p-2 text-xs font-bold"
            >
              {savingStore ? "Guardando…" : "Guardar tienda"}
            </button>
          </form>
        </section>
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <FileQuestion className="w-4 h-4" /> Consultas de compradores
          </h3>
          {questions.length ? (
            questions.map((question: any) => (
              <div key={question.id} className="py-3 border-t text-xs">
                <p className="text-[9px] font-bold text-amber-700">
                  {question.marketplace_products?.name}
                </p>
                <p className="mt-1">{question.question}</p>
                {question.answer ? (
                  <p className="mt-2 bg-emerald-50 text-emerald-800 p-2 rounded">
                    <strong>Respuesta:</strong> {question.answer}
                  </p>
                ) : (
                  <button
                    onClick={() => answerQuestion(question)}
                    className="mt-2 bg-slate-900 text-white rounded px-2 py-1 text-[9px]"
                  >
                    Responder públicamente
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">
              No hay consultas pendientes.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function SuperAdmin({ context, email, onRefresh }: any) {
  const [newCategory, setNewCategory] = useState({ code: "", name: "" });
  const suppliers = context.suppliers || [];
  const moderate = async (id: string, status: string) => {
    await fetch(`/api/marketplace/v2/suppliers/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, status }),
    });
    onRefresh();
  };
  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    await fetch("/api/marketplace/v2/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...newCategory }),
    });
    setNewCategory({ code: "", name: "" });
    onRefresh();
  };
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="bg-white border rounded-xl p-4">
        <h3 className="font-bold flex items-center gap-2">
          <Users className="w-4 h-4" /> Moderación de proveedores
        </h3>
        {suppliers.map((supplier: any) => (
          <div
            key={supplier.id}
            className="py-3 border-t mt-3 flex justify-between items-center text-xs"
          >
            <div>
              <strong>{supplier.trade_name || supplier.legal_name}</strong>
              <p className="text-[10px] text-slate-500">
                {supplier.approval_status}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => moderate(supplier.id, "APPROVED")}
                className="p-1.5 bg-emerald-50 text-emerald-700 rounded"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => moderate(supplier.id, "SUSPENDED")}
                className="p-1.5 bg-rose-50 text-rose-700 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </section>
      <section className="bg-white border rounded-xl p-4">
        <h3 className="font-bold flex items-center gap-2">
          <Tag className="w-4 h-4" /> Categorías maestras
        </h3>
        <form onSubmit={addCategory} className="flex gap-2 my-3">
          <input
            required
            placeholder="Código"
            value={newCategory.code}
            onChange={(e) =>
              setNewCategory({ ...newCategory, code: e.target.value })
            }
            className="w-20 border rounded px-2 py-1 text-xs"
          />
          <input
            required
            placeholder="Nombre de categoría"
            value={newCategory.name}
            onChange={(e) =>
              setNewCategory({ ...newCategory, name: e.target.value })
            }
            className="flex-1 border rounded px-2 py-1 text-xs"
          />
          <button className="bg-slate-900 text-white rounded px-3">
            <Plus className="w-4 h-4" />
          </button>
        </form>
        <div className="max-h-72 overflow-auto">
          {context.categories.map((category: any) => (
            <p key={category.id} className="py-2 border-t text-xs">
              <span className="font-mono text-slate-400 mr-2">
                {category.code}
              </span>
              {category.name}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductDetail({
  product,
  tenantId,
  email,
  projects,
  onClose,
  onDone,
}: any) {
  const [quantity, setQuantity] = useState("1");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async () => {
    setSending(true);
    const response = await fetch("/api/marketplace/v2/direct-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        email,
        projectId: projectId || null,
        supplierId: product.supplier_id,
        currency: product.currency,
        notes,
        items: [
          {
            productId: product.id,
            quantity: Number(quantity),
            unitPrice: product.base_price,
          },
        ],
      }),
    });
    const result = await response.json();
    setSending(false);
    if (!response.ok) return alert(result.error);
    onDone();
  };
  return (
    <Modal title="Detalle del producto" onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-bold">{product.name}</h3>
        <p className="text-xs text-slate-600">{product.description}</p>
        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded">
          <p>
            <strong>Marca:</strong> {product.brand || "—"}
          </p>
          <p>
            <strong>Unidad:</strong> {product.sale_unit}
          </p>
          <p>
            <strong>Mínimo:</strong> {product.minimum_quantity}
          </p>
          <p>
            <strong>Entrega:</strong>{" "}
            {product.delivery_lead_days || "A confirmar"} días
          </p>
        </div>
        <p className="font-mono font-bold text-xl text-amber-700">
          {product.price_on_request
            ? "Precio a consultar"
            : money(product.base_price, product.currency)}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="border rounded p-2 text-xs"
          />
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border rounded p-2 text-xs"
          >
            <option value="">Sin obra asociada</option>
            {projects.map((project: Project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Condiciones o comentarios"
          className="w-full border rounded p-2 text-xs h-20"
        />
        <button
          disabled={sending}
          onClick={submit}
          className="w-full bg-amber-500 text-slate-950 font-bold rounded-lg py-2.5 text-xs"
        >
          {sending ? "Enviando…" : "Enviar solicitud de compra"}
        </button>
      </div>
    </Modal>
  );
}

function ProductForm({
  categories,
  email,
  initialProduct,
  onClose,
  onDone,
}: any) {
  const [form, setForm] = useState<any>(
    initialProduct
      ? {
          name: initialProduct.name,
          description: initialProduct.description,
          categoryId: initialProduct.category_id,
          publicationType: initialProduct.publication_type || "PRODUCT",
          saleUnit: initialProduct.sale_unit,
          currency: initialProduct.currency,
          basePrice: initialProduct.base_price || "",
          priceOnRequest: initialProduct.price_on_request,
          vatIncluded: initialProduct.vat_included,
          minimumQuantity: initialProduct.minimum_quantity,
          stockQuantity: initialProduct.stock_quantity ?? "",
          serviceAvailable: initialProduct.service_available !== false,
          servicePeopleCapacity: initialProduct.service_people_capacity || 1,
          serviceHoursPerDay: initialProduct.service_hours_per_day || 8,
          deliveryLeadDays: initialProduct.delivery_lead_days || "",
          brand: initialProduct.brand || "",
          model: initialProduct.model || "",
          location: initialProduct.location || "",
          financingAvailable: initialProduct.financing_available,
          financingDetails: initialProduct.financing_details || "",
          paymentMethods: initialProduct.payment_methods || [],
          deliveryMethods: initialProduct.delivery_methods || [],
          variants: [],
        }
      : {
          name: "",
          description: "",
          categoryId: "",
          publicationType: "PRODUCT",
          saleUnit: "Unidad",
          currency: "ARS",
          basePrice: "",
          priceOnRequest: false,
          vatIncluded: true,
          minimumQuantity: 1,
          stockQuantity: "",
          serviceAvailable: true,
          servicePeopleCapacity: 1,
          serviceHoursPerDay: 8,
          deliveryLeadDays: "",
          brand: "",
          model: "",
          location: "",
          financingAvailable: false,
          financingDetails: "",
          paymentMethods: [],
          deliveryMethods: [],
          variants: [],
        },
  );
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [technicalSheet, setTechnicalSheet] = useState<File | null>(null);
  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  const uploadFile = async (
    productId: string,
    file: File,
    isTechnicalSheet: boolean,
  ) => {
    const response = await fetch(
      `/api/marketplace/v2/products/${productId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          mimeType: file.type,
          base64: await toBase64(file),
          technicalSheet: isTechnicalSheet,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(
        initialProduct
          ? `/api/marketplace/v2/products/${initialProduct.id}`
          : "/api/marketplace/v2/products",
        {
          method: initialProduct ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, ...form }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      for (const file of imageFiles) await uploadFile(result.id, file, false);
      if (technicalSheet) await uploadFile(result.id, technicalSheet, true);
      onDone();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "No se pudo guardar");
    }
  };
  return (
    <Modal
      title={
        form.publicationType === "SERVICE"
          ? "Publicar servicio"
          : "Publicar producto"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.publicationType}
            onChange={(e) =>
              setForm({
                ...form,
                publicationType: e.target.value,
                saleUnit: e.target.value === "SERVICE" ? "Hora" : "Unidad",
              })
            }
            className="border rounded p-2 text-xs"
          >
            <option value="PRODUCT">Producto</option>
            <option value="SERVICE">Servicio</option>
          </select>
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="border rounded p-2 text-xs"
          >
            <option value="">Categoría</option>
            {categories.map((category: any) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border rounded p-2 text-xs col-span-2"
          />
        </div>
        <textarea
          required
          placeholder="Descripción"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border rounded p-2 text-xs h-20"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Marca"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="border rounded p-2 text-xs"
          />
          <input
            placeholder="Modelo"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="border rounded p-2 text-xs"
          />
          <input
            required
            placeholder="Unidad de venta"
            value={form.saleUnit}
            onChange={(e) => setForm({ ...form, saleUnit: e.target.value })}
            className="border rounded p-2 text-xs"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="border rounded p-2 text-xs"
          >
            <option>ARS</option>
            <option>USD</option>
          </select>
          <input
            type="number"
            placeholder="Precio"
            disabled={form.priceOnRequest}
            value={form.basePrice}
            onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
            className="border rounded p-2 text-xs"
          />
          {form.publicationType === "PRODUCT" ? (
            <input
              type="number"
              placeholder="Stock ofrecido"
              value={form.stockQuantity}
              onChange={(e) =>
                setForm({ ...form, stockQuantity: e.target.value })
              }
              className="border rounded p-2 text-xs"
            />
          ) : (
            <>
              <input
                type="number"
                min="1"
                placeholder="Personas disponibles"
                value={form.servicePeopleCapacity}
                onChange={(e) =>
                  setForm({ ...form, servicePeopleCapacity: e.target.value })
                }
                className="border rounded p-2 text-xs"
              />
              <input
                type="number"
                min="1"
                max="12"
                placeholder="Horas por día"
                value={form.serviceHoursPerDay}
                onChange={(e) =>
                  setForm({ ...form, serviceHoursPerDay: e.target.value })
                }
                className="border rounded p-2 text-xs"
              />
            </>
          )}
        </div>
        {form.publicationType === "SERVICE" && (
          <label className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.serviceAvailable}
              onChange={(e) =>
                setForm({ ...form, serviceAvailable: e.target.checked })
              }
            />{" "}
            Servicio disponible para nuevas reservas
          </label>
        )}
        <label className="flex gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.priceOnRequest}
            onChange={(e) =>
              setForm({ ...form, priceOnRequest: e.target.checked })
            }
          />{" "}
          Precio a consultar
        </label>
        <label className="flex gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.financingAvailable}
            onChange={(e) =>
              setForm({ ...form, financingAvailable: e.target.checked })
            }
          />{" "}
          Ofrece financiación
        </label>
        {form.financingAvailable && (
          <textarea
            placeholder="Condiciones de financiación"
            value={form.financingDetails}
            onChange={(e) =>
              setForm({ ...form, financingDetails: e.target.value })
            }
            className="w-full border rounded p-2 text-xs"
          />
        )}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <label className="border rounded p-2">
            Fotos (máximo 5, 2 MB)
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) =>
                setImageFiles(Array.from(e.target.files || []).slice(0, 5))
              }
              className="block mt-1 w-full text-[9px]"
            />
          </label>
          <label className="border rounded p-2">
            Ficha técnica (PDF o imagen, 10 MB)
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setTechnicalSheet(e.target.files?.[0] || null)}
              className="block mt-1 w-full text-[9px]"
            />
          </label>
        </div>
        <button className="w-full bg-slate-900 text-white rounded py-2 text-xs font-bold">
          Publicar{" "}
          {form.publicationType === "SERVICE" ? "servicio" : "producto"}
        </button>
      </form>
    </Modal>
  );
}

function TenderForm({
  categories,
  suppliers,
  projects,
  tenantId,
  email,
  onClose,
  onDone,
}: any) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  const nextMonth = new Date(Date.now() + 2592000000)
    .toISOString()
    .slice(0, 16);
  const [form, setForm] = useState<any>({
    processType: "RFP",
    visibility: "PUBLIC",
    title: "",
    projectId: "",
    location: "",
    description: "",
    scopeType: "MATERIALS",
    openingAt: tomorrow,
    closesAt: nextMonth,
    publicAnswers: true,
    termsText: "",
    invitedSupplierIds: [],
    categoryIds: [],
    lines: [{ description: "", quantity: 1, unit: "Unidad", categoryId: "" }],
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/marketplace/v2/tenders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, email, ...form }),
    });
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onDone();
  };
  return (
    <Modal title="Nueva licitación" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select
            value={form.processType}
            onChange={(e) => setForm({ ...form, processType: e.target.value })}
            className="border rounded p-2 text-xs"
          >
            <option value="RFI">RFI informativa</option>
            <option value="RFP">RFP cotizable</option>
          </select>
          <select
            value={form.visibility}
            onChange={(e) =>
              setForm({
                ...form,
                visibility: e.target.value,
                invitedSupplierIds: [],
                categoryIds: [],
              })
            }
            className="border rounded p-2 text-xs"
          >
            <option value="PUBLIC">Pública</option>
            <option value="PRIVATE">Privada</option>
            <option value="LIMITED">Limitada</option>
          </select>
          <select
            required
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="border rounded p-2 text-xs"
          >
            <option value="">Seleccionar obra</option>
            {projects.map((project: Project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={form.scopeType}
            onChange={(e) => setForm({ ...form, scopeType: e.target.value })}
            className="border rounded p-2 text-xs"
          >
            <option value="MATERIALS">Materiales</option>
            <option value="LABOR">Mano de obra</option>
          </select>
        </div>
        {form.visibility === "PRIVATE" && (
          <select
            multiple
            required
            value={form.invitedSupplierIds}
            onChange={(e) =>
              setForm({
                ...form,
                invitedSupplierIds: Array.from(e.target.selectedOptions).map(
                  (option: HTMLOptionElement) => option.value,
                ),
              })
            }
            className="w-full border rounded p-2 text-xs h-24"
          >
            {suppliers
              .filter(
                (supplier: any) => supplier.approval_status === "APPROVED",
              )
              .map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.trade_name || supplier.legal_name}
                </option>
              ))}
          </select>
        )}
        {form.visibility === "LIMITED" && (
          <select
            multiple
            required
            value={form.categoryIds}
            onChange={(e) =>
              setForm({
                ...form,
                categoryIds: Array.from(e.target.selectedOptions).map(
                  (option: HTMLOptionElement) => option.value,
                ),
              })
            }
            className="w-full border rounded p-2 text-xs h-24"
          >
            {categories.map((category: any) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
        <input
          required
          placeholder="Nombre de la licitación"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border rounded p-2 text-xs"
        />
        <textarea
          required
          placeholder="Descripción general"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border rounded p-2 text-xs h-20"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px]">
            Apertura
            <input
              type="datetime-local"
              required
              value={form.openingAt}
              onChange={(e) => setForm({ ...form, openingAt: e.target.value })}
              className="block w-full border rounded p-2 text-xs mt-1"
            />
          </label>
          <label className="text-[10px]">
            Cierre
            <input
              type="datetime-local"
              required
              value={form.closesAt}
              onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
              className="block w-full border rounded p-2 text-xs mt-1"
            />
          </label>
        </div>
        <h4 className="font-bold text-xs">Renglones</h4>
        {form.lines.map((line: any, index: number) => (
          <div key={index} className="grid grid-cols-12 gap-2">
            <input
              required
              placeholder="Descripción"
              value={line.description}
              onChange={(e) => {
                const lines = [...form.lines];
                lines[index].description = e.target.value;
                setForm({ ...form, lines });
              }}
              className="col-span-6 border rounded p-2 text-xs"
            />
            <input
              required
              type="number"
              min="0.001"
              step="0.001"
              value={line.quantity}
              onChange={(e) => {
                const lines = [...form.lines];
                lines[index].quantity = e.target.value;
                setForm({ ...form, lines });
              }}
              className="col-span-2 border rounded p-2 text-xs"
            />
            <input
              required
              value={line.unit}
              onChange={(e) => {
                const lines = [...form.lines];
                lines[index].unit = e.target.value;
                setForm({ ...form, lines });
              }}
              className="col-span-2 border rounded p-2 text-xs"
            />
            <select
              value={line.categoryId}
              onChange={(e) => {
                const lines = [...form.lines];
                lines[index].categoryId = e.target.value;
                setForm({ ...form, lines });
              }}
              className="col-span-2 border rounded p-2 text-xs"
            >
              <option value="">Rubro</option>
              {categories.map((category: any) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setForm({
              ...form,
              lines: [
                ...form.lines,
                {
                  description: "",
                  quantity: 1,
                  unit: "Unidad",
                  categoryId: "",
                },
              ],
            })
          }
          className="text-xs text-amber-700 font-bold"
        >
          <Plus className="inline w-3 h-3" /> Agregar renglón
        </button>
        <textarea
          placeholder="Términos y condiciones"
          value={form.termsText}
          onChange={(e) => setForm({ ...form, termsText: e.target.value })}
          className="w-full border rounded p-2 text-xs h-16"
        />
        <button className="w-full bg-slate-900 text-white rounded py-2 text-xs font-bold">
          Publicar licitación
        </button>
      </form>
    </Modal>
  );
}

function TenderDetail({
  tender,
  supplier,
  submissions,
  tenantId,
  email,
  isSupplier,
  onClose,
  onDone,
}: any) {
  const lines = tender.marketplace_tender_lines || [];
  const [accepted, setAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [offers, setOffers] = useState<any>(
    Object.fromEntries(
      lines.map((line: any) => [
        line.id,
        {
          offered: true,
          unitPrice: "",
          currency: "ARS",
          vatRate: 21,
          discountPercent: 0,
          transportCost: 0,
          deliveryDays: "",
          validityDays: 15,
          paymentTerms: "",
        },
      ]),
    ),
  );
  const [awards, setAwards] = useState<any>({});
  const [communications, setCommunications] = useState<any>({
    questions: [],
    documents: [],
    canAsk: false,
    canAnswer: false,
  });
  const [questionText, setQuestionText] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const loadCommunications = async () => {
    const response = await fetch(
      `/api/marketplace/v2/tenders/${tender.id}/communications`,
    );
    const result = await response.json();
    if (response.ok) setCommunications(result);
  };
  useEffect(() => {
    loadCommunications();
  }, [tender.id]);
  const ownSubmission =
    isSupplier &&
    submissions.some(
      (submission: any) => submission.supplier_id === supplier?.id,
    );
  const canAward =
    !isSupplier &&
    tender.process_type === "RFP" &&
    ["CLOSED", "PUBLISHED", "QUESTIONS"].includes(tender.status) &&
    submissions.length > 0;
  const submit = async () => {
    if (!confirming) return setConfirming(true);
    const selected = lines.filter((line: any) => offers[line.id]?.offered);
    if (!selected.length) return alert("Debe ofertar al menos un renglón");
    if (selected.some((line: any) => !Number(offers[line.id]?.unitPrice)))
      return alert("Complete el precio de todos los renglones ofertados");
    const response = await fetch(
      `/api/marketplace/v2/tenders/${tender.id}/submissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          termsAccepted: accepted,
          lines: lines.map((line: any) => ({
            tenderLineId: line.id,
            ...offers[line.id],
          })),
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onDone();
  };
  const award = async () => {
    const selections = Object.entries(awards)
      .filter(([, value]) => value)
      .map(([tenderLineId, submissionLineId]) => ({
        tenderLineId,
        submissionLineId,
      }));
    if (!selections.length) return alert("Seleccione al menos una oferta");
    if (
      !confirm(
        `Se adjudicarán ${selections.length} renglones. Esta acción genera las comisiones correspondientes. ¿Continuar?`,
      )
    )
      return;
    const response = await fetch(
      `/api/marketplace/v2/tenders/${tender.id}/award`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tenantId, awards: selections }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    onDone();
  };
  const askQuestion = async () => {
    const response = await fetch(
      `/api/marketplace/v2/tenders/${tender.id}/questions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionText }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    setQuestionText("");
    loadCommunications();
  };
  const answerQuestion = async (question: any) => {
    const answer = prompt("Respuesta pública", question.answer || "");
    if (!answer) return;
    const response = await fetch(
      `/api/marketplace/v2/tender-questions/${question.id}/answer`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    loadCommunications();
  };
  const uploadDocument = async () => {
    if (!documentFile) return;
    if (documentFile.size > 10 * 1024 * 1024)
      return alert("El archivo supera 10 MB");
    const base64 = await readFileBase64(documentFile);
    const response = await fetch(
      `/api/marketplace/v2/tenders/${tender.id}/documents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: documentFile.name,
          mimeType: documentFile.type,
          base64,
          visibleToSuppliers: true,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) return alert(result.error);
    setDocumentFile(null);
    loadCommunications();
  };
  const total = (offer: any, line: any) =>
    Number(offer.unit_price || 0) *
      Number(line.quantity || 0) *
      (1 - Number(offer.discount_percent || 0) / 100) +
    Number(offer.transport_cost || 0);
  return (
    <Modal
      title={`${tender.process_type} · ${tender.title}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded p-3 text-xs">
          <p>{tender.description}</p>
          <p className="mt-2 text-slate-500">
            Estado: <strong>{tender.status}</strong> · Cierre:{" "}
            {new Date(tender.closes_at).toLocaleString("es-AR")} ·{" "}
            {tender.visibility}
          </p>
          {tender.process_type === "RFI" && (
            <p className="mt-2 text-cyan-700 font-bold">
              La información y los precios no son vinculantes. Este proceso se
              evalúa y cierra sin adjudicación.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="font-bold text-xs">Renglones solicitados</h4>
          {lines.map((line: any) => (
            <div key={line.id} className="border rounded p-3 text-xs">
              <div className="flex justify-between">
                <strong>
                  {line.line_number}. {line.description}
                </strong>
                <span>
                  {line.quantity} {line.unit}
                </span>
              </div>
              {isSupplier &&
                supplier?.approval_status === "APPROVED" &&
                !ownSubmission && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                    <label className="flex gap-1 items-center">
                      <input
                        type="checkbox"
                        checked={offers[line.id]?.offered}
                        onChange={(e) =>
                          setOffers({
                            ...offers,
                            [line.id]: {
                              ...offers[line.id],
                              offered: e.target.checked,
                            },
                          })
                        }
                      />{" "}
                      Ofertar
                    </label>
                    <input
                      disabled={!offers[line.id]?.offered}
                      type="number"
                      min="0"
                      placeholder="Precio unitario"
                      value={offers[line.id]?.unitPrice}
                      onChange={(e) =>
                        setOffers({
                          ...offers,
                          [line.id]: {
                            ...offers[line.id],
                            unitPrice: e.target.value,
                          },
                        })
                      }
                      className="border rounded p-1.5"
                    />
                    <select
                      disabled={!offers[line.id]?.offered}
                      value={offers[line.id]?.currency}
                      onChange={(e) =>
                        setOffers({
                          ...offers,
                          [line.id]: {
                            ...offers[line.id],
                            currency: e.target.value,
                          },
                        })
                      }
                      className="border rounded p-1.5"
                    >
                      <option>ARS</option>
                      <option>USD</option>
                    </select>
                    <input
                      disabled={!offers[line.id]?.offered}
                      type="number"
                      placeholder="Entrega días"
                      value={offers[line.id]?.deliveryDays}
                      onChange={(e) =>
                        setOffers({
                          ...offers,
                          [line.id]: {
                            ...offers[line.id],
                            deliveryDays: e.target.value,
                          },
                        })
                      }
                      className="border rounded p-1.5"
                    />
                    <input
                      disabled={!offers[line.id]?.offered}
                      placeholder="Forma de pago"
                      value={offers[line.id]?.paymentTerms}
                      onChange={(e) =>
                        setOffers({
                          ...offers,
                          [line.id]: {
                            ...offers[line.id],
                            paymentTerms: e.target.value,
                          },
                        })
                      }
                      className="border rounded p-1.5"
                    />
                    <input disabled={!offers[line.id]?.offered} type="number" min="0" max="100" placeholder="Descuento %" value={offers[line.id]?.discountPercent} onChange={(e) => setOffers({ ...offers, [line.id]: { ...offers[line.id], discountPercent: e.target.value } })} className="border rounded p-1.5" />
                    <input disabled={!offers[line.id]?.offered} type="number" min="0" placeholder="Transporte" value={offers[line.id]?.transportCost} onChange={(e) => setOffers({ ...offers, [line.id]: { ...offers[line.id], transportCost: e.target.value } })} className="border rounded p-1.5" />
                    <input disabled={!offers[line.id]?.offered} type="number" min="0" max="100" placeholder="IVA %" value={offers[line.id]?.vatRate} onChange={(e) => setOffers({ ...offers, [line.id]: { ...offers[line.id], vatRate: e.target.value } })} className="border rounded p-1.5" />
                    <input disabled={!offers[line.id]?.offered} type="number" min="1" placeholder="Validez días" value={offers[line.id]?.validityDays} onChange={(e) => setOffers({ ...offers, [line.id]: { ...offers[line.id], validityDays: e.target.value } })} className="border rounded p-1.5" />
                  </div>
                )}
            </div>
          ))}
        </div>
        <section className="grid md:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <h4 className="font-bold text-xs mb-2">Consultas y aclaraciones</h4>
            <div className="space-y-2 max-h-52 overflow-auto">
              {communications.questions.map((question: any) => (
                <div key={question.id} className="border rounded p-2 text-[10px]">
                  <p className="font-semibold">{question.question}</p>
                  {question.answer ? (
                    <p className="mt-1 text-emerald-700"><strong>Respuesta:</strong> {question.answer}</p>
                  ) : communications.canAnswer ? (
                    <button onClick={() => answerQuestion(question)} className="mt-1 text-amber-700 font-bold">Responder</button>
                  ) : (
                    <p className="mt-1 text-slate-400">Pendiente de respuesta</p>
                  )}
                </div>
              ))}
              {!communications.questions.length && <p className="text-[10px] text-slate-400">Todavía no hay consultas.</p>}
            </div>
            {communications.canAsk && (
              <div className="flex gap-2 mt-2">
                <input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Hacer una consulta" className="flex-1 border rounded p-2 text-xs" />
                <button disabled={questionText.trim().length < 5} onClick={askQuestion} className="bg-slate-900 text-white rounded px-3 text-xs disabled:opacity-40">Enviar</button>
              </div>
            )}
          </div>
          <div>
            <h4 className="font-bold text-xs mb-2">Documentación</h4>
            <div className="space-y-1 max-h-52 overflow-auto">
              {communications.documents.map((document: any) => (
                <a key={document.id} href={`/api/marketplace/v2/tender-documents/${document.id}/download`} target="_blank" rel="noreferrer" className="block border rounded p-2 text-[10px] text-indigo-700 hover:bg-indigo-50">
                  {document.title} · {(Number(document.file_size) / 1024 / 1024).toFixed(1)} MB
                </a>
              ))}
              {!communications.documents.length && <p className="text-[10px] text-slate-400">No hay documentos adjuntos.</p>}
            </div>
            {!isSupplier && (
              <div className="flex gap-2 mt-2 items-center">
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} className="flex-1 text-[10px]" />
                <button disabled={!documentFile} onClick={uploadDocument} className="bg-slate-900 text-white rounded px-3 py-2 text-[10px] disabled:opacity-40">Subir</button>
              </div>
            )}
          </div>
        </section>
        {isSupplier && ownSubmission && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs font-bold">
            Su oferta ya fue enviada definitivamente y no puede modificarse ni
            retirarse.
          </div>
        )}
        {isSupplier &&
          supplier?.approval_status === "APPROVED" &&
          !ownSubmission && (
            <>
              <label className="flex items-start gap-2 text-xs p-3 bg-amber-50 border border-amber-200 rounded">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  Acepto los términos y confirmo que la oferta es definitiva,
                  inmodificable e irrevocable desde su envío.
                </span>
              </label>
              {confirming && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs font-bold">
                  Confirmación final: revise precios, moneda, entrega y forma de
                  pago. Al continuar no podrá modificar ni retirar la oferta.
                </div>
              )}
              <button
                disabled={!accepted}
                onClick={submit}
                className="w-full bg-amber-500 disabled:opacity-40 rounded py-2.5 text-xs font-bold"
              >
                {confirming
                  ? "Confirmar y enviar definitivamente"
                  : "Revisar envío definitivo"}
              </button>
            </>
          )}
        {!isSupplier && submissions.length > 0 && (
          <section className="border-t pt-4">
            <h4 className="font-bold text-sm">Comparador de ofertas</h4>
            <p className="text-[10px] text-slate-500 mb-3">
              La adjudicación es completa por renglón y solo puede asignarse a
              un proveedor.
            </p>
            <div className="overflow-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-2 text-left">Renglón</th>
                    <th className="p-2 text-left">Proveedor</th>
                    <th>Precio</th>
                    <th>Entrega</th>
                    <th>Total</th>
                    <th>Seleccionar</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.flatMap((line: any) =>
                    submissions.flatMap((submission: any) =>
                      (submission.marketplace_submission_lines || [])
                        .filter(
                          (offer: any) =>
                            offer.tender_line_id === line.id && offer.offered,
                        )
                        .map((offer: any) => (
                          <tr key={offer.id} className="border-t">
                            <td className="p-2">
                              {line.line_number}. {line.description}
                            </td>
                            <td className="p-2 font-bold">
                              {submission.supplier_organizations?.trade_name ||
                                submission.supplier_organizations?.legal_name}
                            </td>
                            <td className="p-2 text-center">
                              {money(offer.unit_price, offer.currency)}
                            </td>
                            <td className="p-2 text-center">
                              {offer.delivery_days || "—"} días
                            </td>
                            <td className="p-2 text-center font-bold">
                              {money(total(offer, line), offer.currency)}
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="radio"
                                name={`award-${line.id}`}
                                checked={awards[line.id] === offer.id}
                                onChange={() =>
                                  setAwards({ ...awards, [line.id]: offer.id })
                                }
                                disabled={!canAward}
                              />
                            </td>
                          </tr>
                        )),
                    ),
                  )}
                </tbody>
              </table>
            </div>
            {canAward && (
              <button
                onClick={award}
                className="mt-4 w-full bg-slate-900 text-white rounded py-2.5 text-xs font-bold"
              >
                Adjudicar renglones seleccionados
              </button>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function Modal({ title, onClose, children, wide = false }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-4xl" : "max-w-lg"} max-h-[92vh] overflow-auto`}
      >
        <div className="sticky top-0 bg-slate-900 text-white px-5 py-4 flex justify-between z-10">
          <h3 className="font-bold text-sm">{title}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Empty({ icon, text }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl min-h-56 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
      <span className="[&>svg]:w-10 [&>svg]:h-10">{icon}</span>
      <p>{text}</p>
    </div>
  );
}
