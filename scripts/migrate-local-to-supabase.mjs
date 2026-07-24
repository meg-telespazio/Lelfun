import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const root = process.cwd();
const tenants = JSON.parse(fs.readFileSync(path.join(root, "custom-tenants.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(root, "custom-app-state.json"), "utf8"));

const fail = (label, error) => {
  if (error) throw new Error(`${label}: ${error.message}`);
};

const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
fail("list auth users", usersError);

for (const localTenant of tenants) {
  const ownerEmail = localTenant.activeUsers?.[0]?.email?.toLowerCase();
  const owner = usersData.users.find(user => user.email?.toLowerCase() === ownerEmail);
  if (!owner) throw new Error(`No auth user found for ${ownerEmail}`);

  const { data: existingTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("tax_id", localTenant.cuit || "")
    .maybeSingle();

  let tenantId = existingTenant?.id;
  if (!tenantId) {
    const { data, error } = await supabase.from("tenants").insert({
      name: localTenant.name,
      legal_name: localTenant.razonSocial,
      tax_id: localTenant.cuit,
      default_currency: localTenant.defaultCurrency || "USD",
      logo_url: localTenant.logoUrl,
      phone: localTenant.phone,
      legal_address: localTenant.legalAddress,
      commercial_address: localTenant.commercialAddress,
      company_type: localTenant.companyType,
      created_by: owner.id
    }).select("id").single();
    fail("insert tenant", error);
    tenantId = data.id;
  }

  fail("upsert membership", (await supabase.from("tenant_members").upsert({
    tenant_id: tenantId,
    user_id: owner.id,
    role: "owner",
    active: true
  })).error);

  for (const deposit of localTenant.deposits || []) {
    fail("insert deposit", (await supabase.from("tenant_deposits").insert({
      tenant_id: tenantId,
      name: deposit.name,
      address: deposit.address
    })).error);
  }

  const localProjects = state.projects.filter(project => project.tenantId === localTenant.id);
  const projectIds = new Map();
  for (const project of localProjects) {
    const { data, error } = await supabase.from("projects").upsert({
      tenant_id: tenantId,
      code: project.code,
      name: project.name,
      status: project.status === "CANCELLED" ? "PAUSED" : project.status,
      address: project.address,
      city: project.city,
      start_date: project.startDate,
      planned_end_date: project.plannedEndDate,
      surface_m2: project.surfaceM2 || 0,
      sellable_surface_m2: project.sellableSurfaceM2 || 0,
      floors: project.floors || 1,
      functional_units: project.functionalUnits || 0,
      base_currency: project.baseCurrency || "USD",
      estimated_cost_per_m2: project.estimatedCostPerM2 || 0,
      physical_progress: project.physicalProgress || 0,
      financial_progress: project.financialProgress || 0,
      project_type: project.projectType,
      construction_type: project.constructionType || "Casa",
      description: project.description,
      created_by: owner.id
    }, { onConflict: "tenant_id,code" }).select("id").single();
    fail("upsert project", error);
    projectIds.set(project.id, data.id);
  }

  const categoryIds = new Map();
  for (const category of state.costCategories.filter(item => item.tenantId === localTenant.id)) {
    const { data, error } = await supabase.from("cost_categories").upsert({
      tenant_id: tenantId,
      code: category.code,
      name: category.name,
      is_leaf: category.isLeaf
    }, { onConflict: "tenant_id,code" }).select("id").single();
    fail("upsert category", error);
    categoryIds.set(category.id, data.id);
  }

  for (const line of state.budgetLines.filter(item => projectIds.has(item.projectId))) {
    const { data, error } = await supabase.from("budget_lines").upsert({
      project_id: projectIds.get(line.projectId),
      code: line.code,
      name: line.name,
      incidence: line.incidence || 0,
      amount: line.amount || 0,
      notes: line.notes
    }, { onConflict: "project_id,code" }).select("id").single();
    fail("upsert budget line", error);
    for (const [index, subitem] of (line.subitems || []).entries()) {
      fail("insert budget subitem", (await supabase.from("budget_subitems").insert({
        budget_line_id: data.id,
        description: subitem.description,
        amount: subitem.amount || 0,
        notes: subitem.notes,
        sort_order: index
      })).error);
    }
  }

  const accountIds = new Map();
  for (const account of state.accounts.filter(item => item.tenantId === localTenant.id)) {
    const { data, error } = await supabase.from("financial_accounts").insert({
      tenant_id: tenantId,
      name: account.name,
      account_type: account.type,
      currency: account.currency,
      balance: account.balance || 0
    }).select("id").single();
    fail("insert account", error);
    accountIds.set(account.id, data.id);
  }

  const requestIds = new Map();
  for (const request of state.purchaseRequests.filter(item => item.tenantId === localTenant.id)) {
    const { data, error } = await supabase.from("purchase_requests").insert({
      tenant_id: tenantId,
      project_id: projectIds.get(request.projectId),
      category_id: categoryIds.get(request.categoryId) || null,
      code: request.code,
      title: request.title,
      status: request.status,
      requested_by: request.requestedBy,
      required_date: request.requiredDate,
      estimated_total: request.estimatedTotal || 0,
      currency: request.currency
    }).select("id").single();
    fail("insert purchase request", error);
    requestIds.set(request.id, data.id);
    for (const item of request.items || []) {
      fail("insert purchase item", (await supabase.from("purchase_items").insert({
        purchase_request_id: data.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        estimated_price: item.estimatedPrice || 0,
        actual_price: item.actualPrice,
        received_quantity: item.receivedQuantity || 0
      })).error);
    }
  }

  for (const movement of state.movements.filter(item => item.tenantId === localTenant.id && accountIds.has(item.accountId))) {
    fail("insert movement", (await supabase.from("financial_movements").insert({
      tenant_id: tenantId,
      project_id: projectIds.get(movement.projectId) || null,
      account_id: accountIds.get(movement.accountId),
      target_account_id: accountIds.get(movement.targetAccountId) || null,
      category_id: categoryIds.get(movement.categoryId) || null,
      purchase_request_id: requestIds.get(movement.purchaseRequestId) || null,
      amount: movement.amount,
      currency: movement.currency,
      consolidation_amount: movement.baseAmount,
      exchange_rate: movement.exchangeRate || 1,
      exchange_rate_date: movement.exchangeRateDate || movement.date,
      movement_type: movement.type,
      description: movement.description,
      status: movement.status,
      movement_date: movement.date,
      performed_by: movement.performedBy,
      approved_by: movement.approvedBy,
      audit_trail: movement.auditTrail || []
    })).error);
  }

  for (const count of state.cashCounts.filter(item => item.tenantId === localTenant.id && accountIds.has(item.accountId))) {
    fail("insert cash count", (await supabase.from("cash_counts").insert({
      tenant_id: tenantId,
      project_id: projectIds.get(count.projectId) || null,
      account_id: accountIds.get(count.accountId),
      count_date: count.countDate,
      system_balance: count.systemBalance,
      physical_balance: count.physicalBalance,
      difference: count.difference,
      currency: count.currency,
      status: count.status,
      performed_by: count.performedBy,
      approved_by: count.approvedBy,
      notes: count.notes
    })).error);
  }
}

for (const rate of state.officialExchangeRateHistory || []) {
  fail("upsert official rate", (await supabase.from("official_exchange_rates").upsert({
    rate_date: rate.date,
    currency: rate.currency,
    buy_rate: rate.buy,
    sell_rate: rate.sell,
    source: rate.source,
    source_updated_at: rate.updatedAt
  })).error);
}

console.log("Local data migration completed.");
