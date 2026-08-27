import { describe, it, expect, vi, beforeEach } from 'vitest';

const _m = vi.hoisted(() => {
  const categories = new Map<string, any>();
  const transactions = new Map<string, any>();
  const genUUID = () => `mock-uuid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const mockTable = (store: Map<string, any>) => ({
    add: vi.fn(async (item: any) => { store.set(item.id, item); return item.id; }),
    update: vi.fn(async (id, updates) => { const e = store.get(id); if (e) Object.assign(e, updates); }),
    delete: vi.fn(async (id) => { store.delete(id); }),
    clear: vi.fn(async () => { store.clear(); }),
    count: vi.fn(async () => store.size),
    toArray: vi.fn(async () => Array.from(store.values())),
    where: vi.fn(() => ({
      equals: vi.fn(async () => Array.from(store.values())),
      filter: vi.fn((fn: Function) => ({ toArray: vi.fn(async () => Array.from(store.values()).filter(fn)) })),
    })),
  });

  const mockCategories = mockTable(categories);
  const mockTransactions = mockTable(transactions);

  const getTransactions = async (params?: { type?: string; categoryId?: string; startDate?: string; endDate?: string }) => {
    let txns = await mockTransactions.toArray();
    if (params?.type) txns = txns.filter((t: any) => t.type === params.type);
    if (params?.categoryId) {
      const cats = await mockCategories.toArray();
      const cat = cats.find((c: any) => c.id === params.categoryId);
      if (cat) {
        const childIds = cat.parentId === null ? cats.filter((c: any) => c.parentId === cat.id).map((c: any) => c.id) : [];
        txns = txns.filter((t: any) => t.categoryId === params.categoryId || childIds.includes(t.categoryId));
      } else { txns = txns.filter((t: any) => t.categoryId === params.categoryId); }
    }
    if (params?.startDate || params?.endDate) {
      const start = params.startDate ? new Date(params.startDate + 'T00:00:00.000') : new Date('2000-01-01');
      const end = params.endDate ? new Date(params.endDate + 'T23:59:59.999') : new Date('2100-01-01');
      txns = txns.filter((t: any) => { const d = new Date(t.createdAt); return d >= start && d <= end; });
    }
    txns.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
    const catMap = new Map((await mockCategories.toArray()).map((c: any) => [c.id, c]));
    return txns.map((t: any) => {
      const cat = catMap.get(t.categoryId);
      return { ...t, categoryName: cat?.name ?? '未知分类', categoryIcon: cat?.icon ?? null, categoryColor: cat?.color ?? '#64748b' };
    });
  };

  return {
    categories, transactions, genUUID,
    mockCategories, mockTransactions,
    getTransactions,
    db: {
      categories: mockCategories, transactions: mockTransactions,
      open: vi.fn(async () => {}),
      version: vi.fn(() => ({ stores: vi.fn(() => ({ upgrade: vi.fn(async () => {}) })) })),
    },
    initDB: vi.fn(async () => {}),
    getCategories: vi.fn(async ({ type }: { type?: string } = {}) => {
      let cats = await mockCategories.toArray();
      cats = cats.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
      if (type) cats = cats.filter((c: any) => c.type === type || !c.type);
      return cats;
    }),
    addCategory: vi.fn(async (cat: any) => { const id = genUUID(); await mockCategories.add({ ...cat, id }); return id; }),
    updateCategory: vi.fn(async (id, updates) => { await mockCategories.update(id, updates); }),
    deleteCategory: vi.fn(async (id) => { await mockCategories.delete(id); }),
    reorderCategories: vi.fn(async () => {}),
    addTransaction: vi.fn(async (t) => { const id = genUUID(); await mockTransactions.add({ ...t, id }); return id; }),
    deleteTransaction: vi.fn(async (id) => { await mockTransactions.delete(id); }),
    getDailyStats: vi.fn(async (params) => {
      const txns = await getTransactions(params);
      const em = new Map<string, number>(), im = new Map<string, number>();
      for (const t of txns) { const d = t.createdAt.slice(0, 10); if (t.type === 'expense') em.set(d, (em.get(d) ?? 0) + t.amount); else im.set(d, (im.get(d) ?? 0) + t.amount); }
      return Array.from(new Set([...em.keys(), ...im.keys()])).map(d => ({ date: d, expense: em.get(d) ?? 0, income: im.get(d) ?? 0, balance: (im.get(d) ?? 0) - (em.get(d) ?? 0) })).sort((a, b) => a.date.localeCompare(b.date));
    }),
    getCategoryStats: vi.fn(async (params) => {
      const txns = await getTransactions(params);
      const cats = await mockCategories.toArray();
      const map = new Map<string, { name: string; total: number; color: string | null; type: string }>();
      for (const t of txns) { const cat = cats.find((c: any) => c.id === t.categoryId); if (cat) { const ex = map.get(t.categoryId) ?? { name: cat.name, total: 0, color: cat.color, type: cat.type }; map.set(t.categoryId, { ...ex, total: ex.total + t.amount }); } }
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }),
    getSummary: vi.fn(async (params) => {
      const txns = await getTransactions(params);
      let et = 0, ec = 0, it2 = 0, ic = 0;
      for (const t of txns) { if (t.type === 'expense') { et += t.amount; ec++; } else { it2 += t.amount; ic++; } }
      return { expenseTotal: et, expenseCount: ec, incomeTotal: it2, incomeCount: ic, balance: it2 - et };
    }),
    getGroupStats: vi.fn(async (params) => {
      const txns = await getTransactions(params);
      const cats = await mockCategories.toArray();
      const map = new Map<string, { name: string; total: number; color: string | null; type: string }>();
      for (const t of txns) { const cat = cats.find((c: any) => c.id === t.categoryId); if (!cat) continue; const gid = cat.parentId ?? cat.id; const gc = cats.find((c: any) => c.id === gid); const ex = map.get(gid) ?? { name: gc?.name ?? cat.name, total: 0, color: gc?.color ?? cat.color, type: cat.type }; map.set(gid, { ...ex, total: ex.total + t.amount }); }
      return Array.from(map.entries()).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.total - a.total);
    }),
    getExpenses: vi.fn(async (p) => getTransactions({ ...p, type: 'expense' })),
    addExpense: vi.fn(async (e) => addTransaction({ ...e, type: 'expense' })),
    deleteExpense: vi.fn(async (id) => deleteTransaction(id)),
  };
});

vi.mock('../db', () => _m);

import { useCategoryStore, useTransactionStore } from './index';

describe('useCategoryStore', () => {
  beforeEach(() => { vi.clearAllMocks(); _m.categories.clear(); });

  it('should initialize with empty state', () => {
    const s = useCategoryStore.getState();
    expect(s.categories).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it('should add category', async () => {
    const store = useCategoryStore;
    const initial = store.getState().categories.length;
    const id = await store.getState().addCategory({
      name: '测试', parentId: null, icon: null, color: '#ff0000', sortOrder: 99, type: 'expense',
    });
    expect(id).toBeDefined();
    expect(store.getState().categories.length).toBe(initial + 1);
  });

  it('should delete category', async () => {
    const store = useCategoryStore;
    const id = await store.getState().addCategory({
      name: '待删', parentId: null, icon: null, color: '#ff0000', sortOrder: 99, type: 'expense',
    });
    await store.getState().deleteCategory(id);
    expect(store.getState().categories.some(c => c.id === id)).toBe(false);
  });
});

describe('useTransactionStore', () => {
  beforeEach(() => { vi.clearAllMocks(); _m.transactions.clear(); });

  it('should initialize with empty state', () => {
    const s = useTransactionStore.getState();
    expect(s.transactions).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.filterApplied).toBe(false);
    expect(s.filters).toEqual({});
  });

  it('should set filters', () => {
    const store = useTransactionStore;
    store.getState().setFilters({ type: 'expense' });
    expect(store.getState().filters.type).toBe('expense');
    expect(store.getState().filterApplied).toBe(true);
  });

  it('should clear filters', () => {
    const store = useTransactionStore;
    store.getState().setFilters({ type: 'expense', startDate: '2026-01-01' });
    store.getState().clearFilters();
    expect(store.getState().filters).toEqual({});
    expect(store.getState().filterApplied).toBe(false);
  });

  it('should remove empty-string filters', () => {
    const store = useTransactionStore;
    store.getState().setFilters({ type: 'expense', startDate: '' });
    expect(store.getState().filters.startDate).toBeUndefined();
  });

  it('should add transaction', async () => {
    const store = useTransactionStore;
    const initial = store.getState().transactions.length;
    const id = await store.getState().addTransaction({
      amount: 50, type: 'expense', categoryId: 'cat-dining', remark: '测', createdAt: '2026-08-27T00:00:00.000Z',
    });
    expect(id).toBeDefined();
    expect(store.getState().transactions.length).toBe(initial + 1);
    expect(store.getState().hasAnyTransactions).toBe(true);
  });

  it('should delete transaction', async () => {
    const store = useTransactionStore;
    const id = await store.getState().addTransaction({
      amount: 10, type: 'expense', categoryId: 'cat-dining', remark: '删', createdAt: '2026-08-27T00:00:00.000Z',
    });
    await store.getState().deleteTransaction(id);
    expect(store.getState().transactions.some(t => t.id === id)).toBe(false);
  });
});
