import Dexie from 'dexie';

// ─── 数据模型 ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
}

// 存储时的支出（不含分类显示信息，id 由数据库生成）
export interface ExpenseRaw {
  id?: string;
  amount: number;
  categoryId: string;
  remark: string;
  createdAt: string;
}

// 展示时的支出（含分类显示信息）
export interface Expense extends ExpenseRaw {
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

export interface StatsGroup {
  id: string;
  name: string;
  total: number;
  color: string | null;
}

export interface Summary {
  total: number;
  count: number;
}

// ─── 数据库定义 ──────────────────────────────────────────────────────────────

class ShuoAccountantDB extends Dexie {
  categories!: Dexie.Table<Category, string>;
  expenses!: Dexie.Table<ExpenseRaw, string>;

  constructor() {
    super('ShuoAccountantDB');
    this.version(1).stores({
      categories: 'id, name, parentId, sortOrder',
      expenses: 'id, categoryId, createdAt, [categoryId+createdAt]',
    });
  }
}

// ─── 数据库实例 ──────────────────────────────────────────────────────────────

export const db = new ShuoAccountantDB();

// ─── UUID 生成工具（兼容非安全上下文，如手机浏览器 HTTP 访问） ───────────────

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback: RFC4122 version 4 compatible
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── 种子数据 ────────────────────────────────────────────────────────────────

export const SEED_CATEGORIES: Category[] = [
  // 一级分类
  { id: 'cat-dining', name: '餐饮', parentId: null, icon: 'UtensilsCrossed', color: '#ef4444', sortOrder: 0 },
  { id: 'cat-transport', name: '交通', parentId: null, icon: 'Car', color: '#3b82f6', sortOrder: 1 },
  { id: 'cat-shopping', name: '购物', parentId: null, icon: 'ShoppingBag', color: '#8b5cf6', sortOrder: 2 },
  { id: 'cat-housing', name: '住房', parentId: null, icon: 'Home', color: '#f59e0b', sortOrder: 3 },
  { id: 'cat-entertainment', name: '娱乐', parentId: null, icon: 'Film', color: '#ec4899', sortOrder: 4 },
  { id: 'cat-medical', name: '医疗', parentId: null, icon: 'HeartPulse', color: '#10b981', sortOrder: 5 },
  { id: 'cat-education', name: '教育', parentId: null, icon: 'GraduationCap', color: '#06b6d4', sortOrder: 6 },
  { id: 'cat-communication', name: '通讯', parentId: null, icon: 'Smartphone', color: '#6366f1', sortOrder: 7 },
  { id: 'cat-other', name: '其他', parentId: null, icon: 'MoreHorizontal', color: '#64748b', sortOrder: 8 },
  // 二级分类
  { id: 'sub-breakfast', name: '早餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-lunch', name: '午餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 1 },
  { id: 'sub-dinner', name: '晚餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 2 },
  { id: 'sub-snack', name: '零食', parentId: 'cat-dining', icon: null, color: null, sortOrder: 3 },
  { id: 'sub-bus', name: '公交', parentId: 'cat-transport', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-subway', name: '地铁', parentId: 'cat-transport', icon: null, color: null, sortOrder: 1 },
  { id: 'sub-taxi', name: '打车', parentId: 'cat-transport', icon: null, color: null, sortOrder: 2 },
  { id: 'sub-bike', name: '共享单车', parentId: 'cat-transport', icon: null, color: null, sortOrder: 3 },
  { id: 'sub-clothing', name: '服装', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-electronics', name: '数码', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 1 },
  { id: 'sub-daily', name: '日用品', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 2 },
  { id: 'sub-rent', name: '房租', parentId: 'cat-housing', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-utility', name: '水电', parentId: 'cat-housing', icon: null, color: null, sortOrder: 1 },
  { id: 'sub-property', name: '物业', parentId: 'cat-housing', icon: null, color: null, sortOrder: 2 },
  { id: 'sub-movie', name: '电影', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-game', name: '游戏', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 1 },
  { id: 'sub-travel', name: '旅行', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 2 },
  { id: 'sub-medicine', name: '药品', parentId: 'cat-medical', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-checkup', name: '检查', parentId: 'cat-medical', icon: null, color: null, sortOrder: 2 },
  { id: 'sub-course', name: '课程', parentId: 'cat-education', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-book', name: '书籍', parentId: 'cat-education', icon: null, color: null, sortOrder: 1 },
  { id: 'sub-phone', name: '话费', parentId: 'cat-communication', icon: null, color: null, sortOrder: 0 },
  { id: 'sub-internet', name: '网费', parentId: 'cat-communication', icon: null, color: null, sortOrder: 1 },
];

// ─── 初始化数据库 ────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  console.log('🚀 初始化数据库...');
  const count = await db.categories.count();
  console.log('分类数量:', count);
  if (count === 0) {
    await db.categories.bulkAdd(SEED_CATEGORIES);
    console.log('✅ 种子数据已插入');
  }
}

// ─── 分类操作 ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  console.log('📂 获取分类...');
  const categories = await db.categories.toArray();
  console.log('分类数量:', categories.length);
  // 按 sortOrder 升序排列
  categories.sort((a, b) => a.sortOrder - b.sortOrder);
  return categories;
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<string> {
  const id = generateUUID();
  await db.categories.add({ ...category, id });
  return id;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
  await db.categories.update(id, updates);
}

/**
 * 按指定 ID 顺序批量更新分类的 sortOrder
 * @param orderedIds 目标顺序的 ID 列表（不含 null parentId 时仅包含二级分类）
 */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.categories.update(orderedIds[i], { sortOrder: i });
  }
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id);
}

// ─── 支出操作 ────────────────────────────────────────────────────────────────

export async function getExpenses(params?: {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Expense[]> {
  console.log('📊 查询支出，参数:', params);

  let expenses: ExpenseRaw[] = [];

  // 先获取所有支出和分类
  const allExpenses = await db.expenses.toArray();
  console.log('数据库总支出数:', allExpenses.length);

  if (allExpenses.length === 0) {
    return [];
  }

  const allCategories = await getCategories();

  // 先按 categoryId 过滤（支持一级分类：自动包含其所有二级分类）
  let filtered = allExpenses;
  if (params?.categoryId) {
    const cat = allCategories.find((c) => c.id === params.categoryId);
    if (cat) {
      // 若为一级分类，获取其所有子分类 ID
      const childIds = cat.parentId === null
        ? allCategories.filter((c) => c.parentId === cat.id).map((c) => c.id)
        : [];
      filtered = filtered.filter(e =>
        e.categoryId === params.categoryId || childIds.includes(e.categoryId),
      );
    } else {
      filtered = filtered.filter(e => e.categoryId === params.categoryId);
    }
    console.log('按分类过滤后:', filtered.length);
  }

  // 再按日期范围过滤
  if (params?.startDate || params?.endDate) {
    const start = params?.startDate
      ? new Date(params.startDate + 'T00:00:00.000')
      : new Date('2000-01-01T00:00:00.000');
    const end = params?.endDate
      ? new Date(params.endDate + 'T23:59:59.999')
      : new Date('2100-01-01T23:59:59.999');

    console.log('日期范围:', start.toISOString(), '到', end.toISOString());

    filtered = filtered.filter(e => {
      const expenseDate = new Date(e.createdAt);
      return expenseDate >= start && expenseDate <= end;
    });
    console.log('按日期过滤后:', filtered.length);
  }

  expenses = filtered;

  // 按日期倒序排列
  expenses.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 填充分类信息
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  return expenses.map((e) => {
    const cat = categoryMap.get(e.categoryId);
    const parentId = cat?.parentId;
    const parent = parentId ? categoryMap.get(parentId) : null;
    return {
      ...e,
      categoryName: cat?.name ?? '未知分类',
      categoryIcon: cat?.icon ?? parent?.icon ?? null,
      categoryColor: cat?.color ?? parent?.color ?? '#64748b',
    };
  });
}

export async function addExpense(expense: ExpenseRaw): Promise<string> {
  const id = generateUUID();
  await db.expenses.add({ ...expense, id });
  return id;
}

export async function deleteExpense(id: string): Promise<void> {
  await db.expenses.delete(id);
}

// ─── 统计操作 ────────────────────────────────────────────────────────────────

export async function getDailyStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsDaily[]> {
  console.log('📈 查询每日统计，参数:', params);
  const expenses = await getExpenses(params);

  const map = new Map<string, number>();
  for (const e of expenses) {
    const date = e.createdAt.slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + e.amount);
  }

  console.log('每日统计结果:', Array.from(map.entries()));
  return Array.from(map.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCategoryStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsCategory[]> {
  console.log('📊 查询分类统计，参数:', params);
  const expenses = await getExpenses(params);
  const categories = await getCategories();

  const map = new Map<string, { name: string; total: number; color: string | null }>();
  for (const e of expenses) {
    const cat = categories.find((c) => c.id === e.categoryId);
    if (cat) {
      const existing = map.get(e.categoryId) ?? { name: cat.name, total: 0, color: cat.color };
      map.set(e.categoryId, { ...existing, total: existing.total + e.amount });
    }
  }

  console.log('分类统计结果:', Array.from(map.values()));
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total);
}

export async function getSummary(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Summary> {
  console.log('📊 查询汇总，参数:', params);
  const expenses = await getExpenses(params);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  console.log('汇总结果:', { total, count: expenses.length });
  return { total, count: expenses.length };
}

export async function getGroupStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsGroup[]> {
  console.log('📊 查询大类统计，参数:', params);
  const expenses = await getExpenses(params);
  const categories = await getCategories();

  const map = new Map<string, { name: string; total: number; color: string | null }>();
  for (const e of expenses) {
    const cat = categories.find((c) => c.id === e.categoryId);
    if (!cat) continue;
    const groupId = cat.parentId ?? cat.id;
    const groupCat = categories.find((c) => c.id === groupId);
    const existing = map.get(groupId) ?? {
      name: groupCat?.name ?? cat.name,
      total: 0,
      color: groupCat?.color ?? cat.color,
    };
    map.set(groupId, { ...existing, total: existing.total + e.amount });
  }

  console.log('大类统计结果:', Array.from(map.entries()));
  return Array.from(map.entries())
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => b.total - a.total);
}
