import Dexie from 'dexie';

// ─── 数据模型 ────────────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  type: TransactionType;
}

// 存储时的记录（不含分类显示信息，id 由数据库生成）
export interface TransactionRaw {
  id?: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  remark: string;
  createdAt: string;
}

// 展示时的记录（含分类显示信息）
export interface Transaction extends TransactionRaw {
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
}

// 兼容旧名称
export type Expense = Transaction;
export type ExpenseRaw = TransactionRaw;

export interface StatsDaily {
  date: string;
  expense: number;
  income: number;
  balance: number;
}

export interface StatsCategory {
  name: string;
  total: number;
  color: string | null;
  type: TransactionType;
}

export interface StatsGroup {
  id: string;
  name: string;
  total: number;
  color: string | null;
  type: TransactionType;
}

export interface Summary {
  expenseTotal: number;
  expenseCount: number;
  incomeTotal: number;
  incomeCount: number;
  balance: number;
}

// ─── 数据库定义 ──────────────────────────────────────────────────────────────

class ShuoAccountantDB extends Dexie {
  categories!: Dexie.Table<Category, string>;
  transactions!: Dexie.Table<TransactionRaw, string>;

  constructor() {
    super('ShuoAccountantDB');
    this.version(1).stores({
      categories: 'id, name, parentId, type, sortOrder',
      transactions: 'id, categoryId, createdAt, [categoryId+createdAt], type',
    });
    // 从 expenses 迁移到 transactions
    this.version(2).stores({
      categories: 'id, name, parentId, type, sortOrder',
      transactions: 'id, categoryId, createdAt, [categoryId+createdAt], type',
    }).upgrade(async () => {
      try {
        // 迁移旧 expenses 表数据到新 transactions 表，并添加 type 字段
        const oldExpenses = await (db as any).expenses.toArray();
        if (oldExpenses.length > 0) {
          const newTransactions = oldExpenses.map((e: any) => ({
            ...e,
            type: 'expense' as TransactionType,
          }));
          await db.transactions.bulkAdd(newTransactions);
          // 删除旧表
          await (db as any).expenses.delete();
        }
      } catch (e) {
        console.log('迁移旧数据时出错（可能表不存在）:', e);
      }
    });
    // v3: 为旧分类补上 type 字段
    this.version(3).upgrade(async () => {
      const cats = await db.categories.toArray();
      if (cats.length > 0) {
        for (const c of cats) {
          if (!(c as any).type) {
            await db.categories.update(c.id, { type: 'expense' as TransactionType });
          }
        }
        console.log('已为旧分类补上 type 字段，共', cats.length, '个');
      }
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
  // 一级分类 - 支出
  { id: 'cat-dining', name: '餐饮', parentId: null, icon: 'UtensilsCrossed', color: '#ef4444', sortOrder: 0, type: 'expense' },
  { id: 'cat-transport', name: '交通', parentId: null, icon: 'Car', color: '#3b82f6', sortOrder: 1, type: 'expense' },
  { id: 'cat-shopping', name: '购物', parentId: null, icon: 'ShoppingBag', color: '#8b5cf6', sortOrder: 2, type: 'expense' },
  { id: 'cat-housing', name: '住房', parentId: null, icon: 'Home', color: '#f59e0b', sortOrder: 3, type: 'expense' },
  { id: 'cat-entertainment', name: '娱乐', parentId: null, icon: 'Film', color: '#ec4899', sortOrder: 4, type: 'expense' },
  { id: 'cat-medical', name: '医疗', parentId: null, icon: 'HeartPulse', color: '#10b981', sortOrder: 5, type: 'expense' },
  { id: 'cat-education', name: '教育', parentId: null, icon: 'GraduationCap', color: '#06b6d4', sortOrder: 6, type: 'expense' },
  { id: 'cat-communication', name: '通讯', parentId: null, icon: 'Smartphone', color: '#6366f1', sortOrder: 7, type: 'expense' },
  { id: 'cat-other', name: '其他', parentId: null, icon: 'MoreHorizontal', color: '#64748b', sortOrder: 8, type: 'expense' },
  // 二级分类 - 支出（餐饮）
  { id: 'sub-breakfast', name: '早餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-lunch', name: '午餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 1, type: 'expense' },
  { id: 'sub-dinner', name: '晚餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 2, type: 'expense' },
  { id: 'sub-snack', name: '零食', parentId: 'cat-dining', icon: null, color: null, sortOrder: 3, type: 'expense' },
  // 二级分类 - 支出（交通）
  { id: 'sub-bus', name: '公交', parentId: 'cat-transport', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-subway', name: '地铁', parentId: 'cat-transport', icon: null, color: null, sortOrder: 1, type: 'expense' },
  { id: 'sub-taxi', name: '打车', parentId: 'cat-transport', icon: null, color: null, sortOrder: 2, type: 'expense' },
  { id: 'sub-bike', name: '共享单车', parentId: 'cat-transport', icon: null, color: null, sortOrder: 3, type: 'expense' },
  // 二级分类 - 支出（购物）
  { id: 'sub-clothing', name: '服装', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-electronics', name: '数码', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 1, type: 'expense' },
  { id: 'sub-daily', name: '日用品', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 2, type: 'expense' },
  // 二级分类 - 支出（住房）
  { id: 'sub-rent', name: '房租', parentId: 'cat-housing', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-utility', name: '水电', parentId: 'cat-housing', icon: null, color: null, sortOrder: 1, type: 'expense' },
  { id: 'sub-property', name: '物业', parentId: 'cat-housing', icon: null, color: null, sortOrder: 2, type: 'expense' },
  // 二级分类 - 支出（娱乐）
  { id: 'sub-movie', name: '电影', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-game', name: '游戏', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 1, type: 'expense' },
  { id: 'sub-travel', name: '旅行', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 2, type: 'expense' },
  // 二级分类 - 支出（医疗）
  { id: 'sub-medicine', name: '药品', parentId: 'cat-medical', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-checkup', name: '检查', parentId: 'cat-medical', icon: null, color: null, sortOrder: 2, type: 'expense' },
  // 二级分类 - 支出（教育）
  { id: 'sub-course', name: '课程', parentId: 'cat-education', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-book', name: '书籍', parentId: 'cat-education', icon: null, color: null, sortOrder: 1, type: 'expense' },
  // 二级分类 - 支出（通讯）
  { id: 'sub-phone', name: '话费', parentId: 'cat-communication', icon: null, color: null, sortOrder: 0, type: 'expense' },
  { id: 'sub-internet', name: '网费', parentId: 'cat-communication', icon: null, color: null, sortOrder: 1, type: 'expense' },
  // 一级分类 - 收入
  { id: 'cat-income-salary', name: '工资', parentId: null, icon: 'Wallet', color: '#22c55e', sortOrder: 9, type: 'income' },
  { id: 'cat-income-parttime', name: '兼职', parentId: null, icon: 'Briefcase', color: '#10b981', sortOrder: 10, type: 'income' },
  { id: 'cat-income-invest', name: '投资', parentId: null, icon: 'TrendingUp', color: '#06b6d4', sortOrder: 11, type: 'income' },
  { id: 'cat-income-refund', name: '退款', parentId: null, icon: 'RefreshCw', color: '#8b5cf6', sortOrder: 12, type: 'income' },
  { id: 'cat-income-other', name: '其他', parentId: null, icon: 'MoreHorizontal', color: '#64748b', sortOrder: 13, type: 'income' },
  // 二级分类 - 收入（投资）
  { id: 'sub-invest-stock', name: '股票', parentId: 'cat-income-invest', icon: null, color: null, sortOrder: 0, type: 'income' },
  { id: 'sub-invest-fund', name: '基金', parentId: 'cat-income-invest', icon: null, color: null, sortOrder: 1, type: 'income' },
  { id: 'sub-invest-deposit', name: '存款', parentId: 'cat-income-invest', icon: null, color: null, sortOrder: 2, type: 'income' },
];

// ─── 初始化数据库 ────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  console.log('🚀 初始化数据库...');
  await db.open();
  const count = await db.categories.count();
  console.log('分类数量:', count);
  if (count === 0) {
    await db.categories.bulkAdd(SEED_CATEGORIES);
    console.log('✅ 种子数据已插入');
  } else {
    // 兜底：为缺少 type 字段的旧分类补上
    const cats = await db.categories.toArray();
    let fixed = 0;
    for (const c of cats) {
      if (!(c as any).type) {
        await db.categories.update(c.id, { type: 'expense' as TransactionType });
        fixed++;
      }
    }
    if (fixed > 0) console.warn(`已修复 ${fixed} 个缺少 type 字段的分类`);
  }
}

// ─── 分类操作 ────────────────────────────────────────────────────────────────

export async function getCategories(params?: {
  type?: TransactionType;
}): Promise<Category[]> {
  console.log('📂 获取分类...');
  const categories = await db.categories.toArray();
  console.log('分类数量:', categories.length);
  // 按 sortOrder 升序排列
  categories.sort((a, b) => a.sortOrder - b.sortOrder);
  if (params?.type) {
    return categories.filter((c) => c.type === params.type || !c.type);
  }
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

// ─── 交易记录操作 ──────────────────────────────────────────────────────────────

export async function getTransactions(params?: {
  type?: TransactionType;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Transaction[]> {
  console.log('📊 查询交易记录，参数:', params);

  let transactions: TransactionRaw[] = [];

  // 先获取所有交易记录和分类
  const allTransactions = await db.transactions.toArray();
  console.log('数据库总交易数:', allTransactions.length);

  if (allTransactions.length === 0) {
    return [];
  }

  const allCategories = await getCategories();

  // 先按类型过滤
  let filtered = allTransactions;
  if (params?.type) {
    filtered = filtered.filter((e) => e.type === params.type);
    console.log('按类型过滤后:', filtered.length);
  }

  // 再按 categoryId 过滤（支持一级分类：自动包含其所有二级分类）
  if (params?.categoryId) {
    const cat = allCategories.find((c) => c.id === params.categoryId);
    if (cat) {
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
      const transactionDate = new Date(e.createdAt);
      return transactionDate >= start && transactionDate <= end;
    });
    console.log('按日期过滤后:', filtered.length);
  }

  transactions = filtered;

  // 按日期倒序排列
  transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 填充分类信息
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  return transactions.map((e) => {
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

export async function addTransaction(transaction: TransactionRaw): Promise<string> {
  const id = generateUUID();
  await db.transactions.add({ ...transaction, id });
  return id;
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id);
}

// ─── 兼容旧名称 ────────────────────────────────────────────────────────────────
// 保留旧的 Expense 别名，便于逐步迁移
export async function getExpenses(params?: {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Transaction[]> {
  return getTransactions({ ...params, type: 'expense' });
}

export async function addExpense(expense: TransactionRaw): Promise<string> {
  return addTransaction({ ...expense, type: 'expense' });
}

export async function deleteExpense(id: string): Promise<void> {
  return deleteTransaction(id);
}

// ─── 统计操作 ────────────────────────────────────────────────────────────────

export async function getDailyStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsDaily[]> {
  console.log('📈 查询每日统计，参数:', params);
  const transactions = await getTransactions(params);

  const expenseMap = new Map<string, number>();
  const incomeMap = new Map<string, number>();
  for (const t of transactions) {
    const date = t.createdAt.slice(0, 10);
    if (t.type === 'expense') {
      expenseMap.set(date, (expenseMap.get(date) ?? 0) + t.amount);
    } else {
      incomeMap.set(date, (incomeMap.get(date) ?? 0) + t.amount);
    }
  }

  // 合并所有日期
  const allDates = new Set([...expenseMap.keys(), ...incomeMap.keys()]);
  const result: StatsDaily[] = Array.from(allDates)
    .map((date) => {
      const expense = expenseMap.get(date) ?? 0;
      const income = incomeMap.get(date) ?? 0;
      return { date, expense, income, balance: income - expense };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log('每日统计结果:', result);
  return result;
}

export async function getCategoryStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsCategory[]> {
  console.log('📊 查询分类统计，参数:', params);
  const transactions = await getTransactions(params);
  const categories = await getCategories();

  const map = new Map<string, { name: string; total: number; color: string | null; type: TransactionType }>();
  for (const t of transactions) {
    const cat = categories.find((c) => c.id === t.categoryId);
    if (cat) {
      const existing = map.get(t.categoryId) ?? { name: cat.name, total: 0, color: cat.color, type: cat.type };
      map.set(t.categoryId, { ...existing, total: existing.total + t.amount });
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
  const transactions = await getTransactions(params);
  let expenseTotal = 0, expenseCount = 0;
  let incomeTotal = 0, incomeCount = 0;
  for (const t of transactions) {
    if (t.type === 'expense') {
      expenseTotal += t.amount;
      expenseCount++;
    } else {
      incomeTotal += t.amount;
      incomeCount++;
    }
  }
  console.log('汇总结果:', { expenseTotal, expenseCount, incomeTotal, incomeCount, balance: incomeTotal - expenseTotal });
  return { expenseTotal, expenseCount, incomeTotal, incomeCount, balance: incomeTotal - expenseTotal };
}

export async function getGroupStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<StatsGroup[]> {
  console.log('📊 查询大类统计，参数:', params);
  const transactions = await getTransactions(params);
  const categories = await getCategories();

  const map = new Map<string, { name: string; total: number; color: string | null; type: TransactionType }>();
  for (const t of transactions) {
    const cat = categories.find((c) => c.id === t.categoryId);
    if (!cat) continue;
    const groupId = cat.parentId ?? cat.id;
    const groupCat = categories.find((c) => c.id === groupId);
    const existing = map.get(groupId) ?? {
      name: groupCat?.name ?? cat.name,
      total: 0,
      color: groupCat?.color ?? cat.color,
      type: cat.type,
    };
    map.set(groupId, { ...existing, total: existing.total + t.amount });
  }

  console.log('大类统计结果:', Array.from(map.entries()));
  return Array.from(map.entries())
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => b.total - a.total);
}
