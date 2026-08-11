import { invoke } from "@tauri-apps/api/core";

export interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
}

export interface ExpenseOption {
  id: string;
  amount: number;
  categoryId: string;
  remark: string;
  createdAt: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export interface StatsDaily {
  date: string;
  total: number;
}

export interface StatsCategory {
  name: string;
  total: number;
  color: string | null;
}

export interface Summary {
  total: number;
  count: number;
}

// ─── Category ────────────────────────────────────────────────────────────────

export async function listCategories(): Promise<CategoryOption[]> {
  const data = await invoke<any[]>("list_categories");
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parent_id,
    icon: c.icon,
    color: c.color,
  }));
}

export async function addCategory(
  name: string,
  parentId: string | null,
  icon: string | null,
  color: string | null
): Promise<CategoryOption> {
  const data = await invoke<any>("add_category", { name, parent_id: parentId, icon, color });
  return {
    id: data.id,
    name: data.name,
    parentId: data.parent_id,
    icon: data.icon,
    color: data.color,
  };
}

export async function deleteCategory(id: string): Promise<void> {
  return invoke<void>("delete_category", { id });
}

// ─── Expense ─────────────────────────────────────────────────────────────────

export async function listExpenses(params?: {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseOption[]> {
  const data = await invoke<any[]>("list_expenses", {
    category_id: params?.categoryId ?? null,
    start_date: params?.startDate ?? null,
    end_date: params?.endDate ?? null,
  });
  return data.map((e) => ({
    id: e.id,
    amount: e.amount,
    categoryId: e.category_id,
    remark: e.remark,
    createdAt: e.created_at,
    categoryName: e.category_name,
    categoryIcon: e.category_icon,
    categoryColor: e.category_color,
  }));
}

export async function addExpense(
  amount: number,
  categoryId: string,
  remark: string
): Promise<ExpenseOption> {
  const data = await invoke<any>("add_expense", { amount, category_id: categoryId, remark });
  return {
    id: data.id,
    amount: data.amount,
    categoryId: data.category_id,
    remark: data.remark,
    createdAt: data.created_at,
    categoryName: data.category_name,
    categoryIcon: data.category_icon,
    categoryColor: data.category_color,
  };
}

export async function deleteExpense(id: string): Promise<void> {
  return invoke<void>("delete_expense", { id });
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getDailyStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsDaily[]> {
  const data = await invoke<any[]>("get_daily_stats", {
    start_date: params?.startDate ?? null,
    end_date: params?.endDate ?? null,
  });
  return data.map((d) => ({ date: d.date, total: d.total }));
}

export async function getCategoryStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsCategory[]> {
  const data = await invoke<any[]>("get_category_stats", {
    start_date: params?.startDate ?? null,
    end_date: params?.endDate ?? null,
  });
  return data.map((s) => ({ name: s.name, total: s.total, color: s.color }));
}

export async function getSummary(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Summary> {
  return invoke<Summary>("get_summary", {
    start_date: params?.startDate ?? null,
    end_date: params?.endDate ?? null,
  });
}
