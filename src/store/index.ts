import { create } from 'zustand';
import {
  db, getCategories, addCategory, updateCategory, deleteCategory, reorderCategories,
  getTransactions, addTransaction, deleteTransaction,
  getDailyStats, getCategoryStats, getSummary, getGroupStats,
  type Category, type Transaction, type TransactionRaw, type StatsDaily, type StatsCategory, type Summary, type StatsGroup,
  type TransactionType,
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
      // 兜底：为缺少 type 字段的旧分类补上
      const needsFix = categories.some((c) => !c.type);
      if (needsFix) {
        for (const c of categories) {
          if (!c.type) {
            await db.categories.update(c.id, { type: 'expense' });
          }
        }
        set({ categories, loading: false });
      } else {
        set({ categories, loading: false });
      }
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
    const categories = await getCategories();
    set({ categories });
  },
}));

// ─── Transaction Store ───────────────────────────────────────────────────────

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  filterApplied: boolean;
  hasAnyTransactions: boolean;
  filters: { type?: TransactionType; categoryId?: string; startDate?: string; endDate?: string };
  pendingListFilter: { type?: TransactionType; startDate?: string; endDate?: string; categoryId?: string } | null;
  setFilters: (filters: Partial<TransactionState['filters']>) => void;
  clearFilters: () => void;
  fetchTransactions: () => Promise<void>;
  addTransaction: (transaction: TransactionRaw) => Promise<string>;
  deleteTransaction: (id: string) => Promise<void>;
  applyListFilterAndNavigate: (filter: { type?: TransactionType; startDate?: string; endDate?: string; categoryId?: string }) => void;
  clearPendingListFilter: () => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  filterApplied: false,
  hasAnyTransactions: false,
  filters: {},
  pendingListFilter: null,

  setFilters: (filters) => {
    const merged = { ...get().filters };
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        delete merged[key as keyof typeof merged];
      } else {
        merged[key as keyof typeof merged] = value as any;
      }
    });
    set({ filters: merged, filterApplied: Object.keys(merged).length > 0 });
  },

  clearFilters: () => set({ filters: {}, filterApplied: false }),

  fetchTransactions: async () => {
    const hasFilter = Object.keys(get().filters).length > 0;
    set({ loading: true, filterApplied: hasFilter });
    try {
      const transactions = await getTransactions(get().filters);
      const count = await db.transactions.count();
      set({ transactions, hasAnyTransactions: count > 0, loading: false });
    } catch (err) {
      console.error('获取账单失败:', err);
      set({ loading: false });
    }
  },

  addTransaction: async (transaction) => {
    const id = await addTransaction(transaction);
    const expanded: Transaction = { ...transaction, id, categoryName: '', categoryIcon: null, categoryColor: '#64748b' };
    set((s) => ({ transactions: [expanded, ...s.transactions], hasAnyTransactions: true }));
    return id;
  },

  deleteTransaction: async (id) => {
    await deleteTransaction(id);
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== id),
      hasAnyTransactions: s.transactions.filter((t) => t.id !== id).length > 0,
    }));
  },

  applyListFilterAndNavigate: (filter) => {
    set({ pendingListFilter: { ...filter } });
  },

  clearPendingListFilter: () => {
    set({ pendingListFilter: null });
  },
}));

// 兼容旧的 Expense Store 名称
export const useExpenseStore = useTransactionStore;

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
  selectedCategoryId: string | null;
  linesVisible: { expense: boolean; income: boolean; balance: boolean };
  chartType: 'expense' | 'income';
  setPeriod: (period: Period) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  fetchStats: () => Promise<void>;
  setGroupFilter: (id: string | null) => void;
  setCategoryFilter: (id: string | null) => void;
  setLinesVisible: (lines: Partial<StatsState['linesVisible']>) => void;
  setChartType: (type: 'expense' | 'income') => void;
}

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function computeRange(period: Period, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const today = formatLocalDate(now);

  if (period === 'day') {
    return { startDate: today, endDate: today };
  }
  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    return { startDate: formatLocalDate(monday), endDate: today };
  }
  if (period === 'month') {
    return {
      startDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: today,
    };
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      startDate: formatLocalDate(new Date(now.getFullYear(), q * 3, 1)),
      endDate: today,
    };
  }
  if (period === 'half') {
    const half = now.getMonth() >= 6 ? 6 : 0;
    return {
      startDate: formatLocalDate(new Date(now.getFullYear(), half, 1)),
      endDate: today,
    };
  }
  if (period === 'year') {
    return {
      startDate: formatLocalDate(new Date(now.getFullYear(), 0, 1)),
      endDate: today,
    };
  }
  if (period === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }
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
  selectedCategoryId: null,
  linesVisible: { expense: true, income: true, balance: true },
  chartType: 'expense',

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

  setCategoryFilter: (id) => {
    set((s) => ({ selectedCategoryId: s.selectedCategoryId === id ? null : id }));
  },

  setLinesVisible: (lines) => {
    set((s) => ({ linesVisible: { ...s.linesVisible, ...lines } }));
  },

  setChartType: (type) => {
    set({ chartType: type, selectedGroupId: null, selectedCategoryId: null });
  },
}));
