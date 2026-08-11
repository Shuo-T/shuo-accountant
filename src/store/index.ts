import { create } from 'zustand';
import {
  db, getCategories, addCategory, updateCategory, deleteCategory, reorderCategories,
  getExpenses, addExpense, deleteExpense,
  getDailyStats, getCategoryStats, getSummary, getGroupStats,
  type Category, type Expense, type ExpenseRaw, type StatsDaily, type StatsCategory, type Summary, type StatsGroup,
} from '../db';

// ─── Category Store ──────────────────────────────────────────────────────────

interface CategoryState {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<string>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  loading: false,

  fetchCategories: async () => {
    set({ loading: true });
    try {
      const categories = await getCategories();
      set({ categories, loading: false });
    } catch (err) {
      console.error('获取分类失败:', err);
      set({ loading: false });
    }
  },

  addCategory: async (category) => {
    const id = await addCategory(category);
    set((s) => ({ categories: [...s.categories, { ...category, id }] }));
    return id;
  },

  updateCategory: async (id, updates) => {
    await updateCategory(id, updates);
    set((s) => ({
      categories: s.categories.map((c) => c.id === id ? { ...c, ...updates } : c),
    }));
  },

  deleteCategory: async (id) => {
    await deleteCategory(id);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },

  reorderCategories: async (orderedIds) => {
    await reorderCategories(orderedIds);
    // 获取已按 sortOrder 排序的分类列表
    const categories = await getCategories();
    set({ categories });
  },
}));

// ─── Expense Store ───────────────────────────────────────────────────────────

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  filterApplied: boolean;
  hasAnyExpenses: boolean;
  filters: { categoryId?: string; startDate?: string; endDate?: string };
  pendingListFilter: { startDate?: string; endDate?: string; categoryId?: string } | null;
  setFilters: (filters: Partial<ExpenseState['filters']>) => void;
  clearFilters: () => void;
  fetchExpenses: () => Promise<void>;
  addExpense: (expense: ExpenseRaw) => Promise<string>;
  deleteExpense: (id: string) => Promise<void>;
  applyListFilterAndNavigate: (filter: { startDate?: string; endDate?: string; categoryId?: string }) => void;
  clearPendingListFilter: () => void;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: false,
  filterApplied: false,
  hasAnyExpenses: false,
  filters: {},
  pendingListFilter: null,

  setFilters: (filters) => {
    const merged = { ...get().filters };
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        delete merged[key as keyof typeof merged];
      } else {
        merged[key as keyof typeof merged] = value;
      }
    });
    set({ filters: merged, filterApplied: Object.keys(merged).length > 0 });
  },

  clearFilters: () => set({ filters: {}, filterApplied: false }),

  fetchExpenses: async () => {
    const hasFilter = Object.keys(get().filters).length > 0;
    set({ loading: true, filterApplied: hasFilter });
    try {
      const expenses = await getExpenses(get().filters);
      const count = await db.expenses.count();
      set({ expenses, hasAnyExpenses: count > 0, loading: false });
    } catch (err) {
      console.error('获取账单失败:', err);
      set({ loading: false });
    }
  },

  addExpense: async (expense) => {
    const id = await addExpense(expense);
    const expanded: Expense = { ...expense, id, categoryName: '', categoryIcon: null, categoryColor: '#64748b' };
    set((s) => ({ expenses: [expanded, ...s.expenses], hasAnyExpenses: true }));
    return id;
  },

  deleteExpense: async (id) => {
    await deleteExpense(id);
    set((s) => ({
      expenses: s.expenses.filter((e) => e.id !== id),
      hasAnyExpenses: s.expenses.filter((e) => e.id !== id).length > 0,
    }));
  },

  applyListFilterAndNavigate: (filter) => {
    set({ pendingListFilter: { ...filter } });
  },

  clearPendingListFilter: () => {
    set({ pendingListFilter: null });
  },
}));

// ─── Stats Store ─────────────────────────────────────────────────────────────

type Period = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'custom' | 'all';

interface StatsState {
  daily: StatsDaily[];
  byCategory: StatsCategory[];
  byGroup: StatsGroup[];
  summary: Summary | null;
  loading: boolean;
  period: Period;
  startDate: string;
  endDate: string;
  selectedGroupId: string | null;
  setPeriod: (period: Period) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  fetchStats: () => Promise<void>;
  setGroupFilter: (id: string | null) => void;
}

function computeRange(period: Period, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (period === 'day') {
    return { startDate: today, endDate: today };
  }
  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    return { startDate: monday.toISOString().slice(0, 10), endDate: today };
  }
  if (period === 'month') {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      endDate: today,
    };
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      startDate: new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10),
      endDate: today,
    };
  }
  if (period === 'half') {
    const half = now.getMonth() >= 6 ? 6 : 0;
    return {
      startDate: new Date(now.getFullYear(), half, 1).toISOString().slice(0, 10),
      endDate: today,
    };
  }
  if (period === 'year') {
    return {
      startDate: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10),
      endDate: today,
    };
  }
  if (period === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }
  // 'all' or fallback: return everything
  return { startDate: '', endDate: '' };
}

export const useStatsStore = create<StatsState>((set, get) => ({
  daily: [],
  byCategory: [],
  byGroup: [],
  summary: null,
  loading: false,
  period: 'month',
  startDate: '',
  endDate: '',
  selectedGroupId: null,

  setPeriod: (period) => {
    const range = computeRange(period, get().startDate, get().endDate);
    set({ period, startDate: range.startDate, endDate: range.endDate });
  },

  setCustomRange: (startDate, endDate) => {
    set({ startDate, endDate });
  },

  fetchStats: async () => {
    set({ loading: true });
    try {
      const { period, startDate, endDate } = get();
      const computed = computeRange(period, startDate, endDate);
      // 同步 store 中的日期范围，避免双击跳转时读到空值
      set({ startDate: computed.startDate, endDate: computed.endDate });

      const [daily, byCategory, byGroup, summary] = await Promise.all([
        getDailyStats({ startDate: computed.startDate, endDate: computed.endDate }),
        getCategoryStats({ startDate: computed.startDate, endDate: computed.endDate }),
        getGroupStats({ startDate: computed.startDate, endDate: computed.endDate }),
        getSummary({ startDate: computed.startDate, endDate: computed.endDate }),
      ]);

      set({ daily, byCategory, byGroup, summary, loading: false });
    } catch (err) {
      console.error('获取统计数据失败:', err);
      set({ loading: false });
    }
  },

  setGroupFilter: (id) => {
    set((s) => ({ selectedGroupId: s.selectedGroupId === id ? null : id }));
  },
}));
