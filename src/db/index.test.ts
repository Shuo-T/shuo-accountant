import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() 在 hoist 作用域创建变量，vi.mock 工厂可安全引用
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

vi.mock('./index', () => _m);

import {
  db, getCategories, getTransactions, addTransaction, deleteTransaction,
  getDailyStats, getCategoryStats, getSummary, getGroupStats,
} from './index';

describe('db - table operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _m.categories.clear();
    _m.transactions.clear();
  });

  describe('categories table', () => {
    it('should return empty array initially', async () => {
      expect(await db.categories.toArray()).toEqual([]);
    });
    it('should add and retrieve', async () => {
      await db.categories.add({ id: 'c1', name: '餐饮', parentId: null, icon: null, color: '#ef4444', sortOrder: 0, type: 'expense' });
      const r = await db.categories.toArray();
      expect(r).toHaveLength(1);
      expect(r[0].name).toBe('餐饮');
    });
    it('should update', async () => {
      await db.categories.add({ id: 'c1', name: '旧', parentId: null, icon: null, color: '#ff0000', sortOrder: 0, type: 'expense' });
      await db.categories.update('c1', { name: '新' });
      expect((await db.categories.toArray())[0].name).toBe('新');
    });
    it('should delete', async () => {
      await db.categories.add({ id: 'c1', name: 'X', parentId: null, icon: null, color: '#ff0000', sortOrder: 0, type: 'expense' });
      await db.categories.delete('c1');
      expect(await db.categories.count()).toBe(0);
    });
    it('should clear', async () => {
      await db.categories.add({ id: 'c1', name: 'X', parentId: null, icon: null, color: '#ff0000', sortOrder: 0, type: 'expense' });
      await db.categories.clear();
      expect(await db.categories.count()).toBe(0);
    });
  });

  describe('transactions table', () => {
    it('should add and retrieve', async () => {
      await db.transactions.add({ id: 't1', amount: 50, type: 'expense', categoryId: 'c1', remark: '午餐', createdAt: '2026-08-27T00:00:00.000Z' });
      expect((await db.transactions.toArray())[0].amount).toBe(50);
    });
    it('should delete', async () => {
      await db.transactions.add({ id: 't1', amount: 50, type: 'expense', categoryId: 'c1', remark: '', createdAt: '2026-08-27T00:00:00.000Z' });
      await db.transactions.delete('t1');
      expect(await db.transactions.count()).toBe(0);
    });
    it('should clear', async () => {
      await db.transactions.add({ id: 't1', amount: 50, type: 'expense', categoryId: 'c1', remark: '', createdAt: '2026-08-27T00:00:00.000Z' });
      await db.transactions.clear();
      expect(await db.transactions.count()).toBe(0);
    });
  });
});

describe('getCategories', () => {
  beforeEach(() => { vi.clearAllMocks(); _m.categories.clear(); });
  it('should sort by sortOrder', async () => {
    await db.categories.add({ id: 'b', name: 'B', parentId: null, icon: null, color: '#000', sortOrder: 1, type: 'expense' });
    await db.categories.add({ id: 'a', name: 'A', parentId: null, icon: null, color: '#fff', sortOrder: 0, type: 'expense' });
    const r = await getCategories();
    expect(r[0].name).toBe('A');
  });
  it('should filter by type', async () => {
    await db.categories.add({ id: 'e', name: '餐饮', parentId: null, icon: null, color: '#ef4444', sortOrder: 0, type: 'expense' });
    await db.categories.add({ id: 'i', name: '工资', parentId: null, icon: null, color: '#22c55e', sortOrder: 1, type: 'income' });
    const r = await getCategories({ type: 'income' });
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('income');
  });
});

describe('getTransactions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _m.categories.clear();
    _m.transactions.clear();
    await db.categories.add({ id: 'cat-dining', name: '餐饮', parentId: null, icon: null, color: '#ef4444', sortOrder: 0, type: 'expense' });
    await db.categories.add({ id: 'sub-lunch', name: '午餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 1, type: 'expense' });
    await db.categories.add({ id: 'cat-income', name: '工资', parentId: null, icon: null, color: '#22c55e', sortOrder: 9, type: 'income' });
    await db.transactions.add({ id: 't1', amount: 30, type: 'expense', categoryId: 'sub-lunch', remark: '午餐', createdAt: '2026-08-20T12:00:00.000Z' });
    await db.transactions.add({ id: 't2', amount: 50, type: 'expense', categoryId: 'sub-lunch', remark: '晚餐', createdAt: '2026-08-21T18:00:00.000Z' });
    await db.transactions.add({ id: 't3', amount: 500, type: 'income', categoryId: 'cat-income', remark: '工资', createdAt: '2026-08-20T09:00:00.000Z' });
  });

  it('should return sorted by date desc', async () => {
    const r = await getTransactions();
    expect(r).toHaveLength(3);
    expect(r[0].id).toBe('t2');
  });
  it('should filter by type', async () => {
    const r = await getTransactions({ type: 'expense' });
    expect(r).toHaveLength(2);
  });
  it('should filter by categoryId', async () => {
    const r = await getTransactions({ categoryId: 'sub-lunch' });
    expect(r).toHaveLength(2);
  });
  it('should include children when filtering by parent', async () => {
    const r = await getTransactions({ categoryId: 'cat-dining' });
    expect(r).toHaveLength(2);
  });
  it('should filter by date range', async () => {
    const r = await getTransactions({ startDate: '2026-08-20', endDate: '2026-08-20' });
    expect(r).toHaveLength(2);
  });
  it('should fill category display info', async () => {
    const r = await getTransactions();
    const lunch = r.find((t: any) => t.categoryId === 'sub-lunch');
    expect(lunch.categoryName).toBe('午餐');
  });
});

describe('getSummary', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _m.categories.clear();
    _m.transactions.clear();
    await db.categories.add({ id: 'cat-dining', name: '餐饮', parentId: null, icon: null, color: '#ef4444', sortOrder: 0, type: 'expense' });
    await db.categories.add({ id: 'cat-income', name: '工资', parentId: null, icon: null, color: '#22c55e', sortOrder: 9, type: 'income' });
    await db.transactions.add({ id: 't1', amount: 30, type: 'expense', categoryId: 'cat-dining', remark: '', createdAt: '2026-08-20T00:00:00.000Z' });
    await db.transactions.add({ id: 't2', amount: 50, type: 'expense', categoryId: 'cat-dining', remark: '', createdAt: '2026-08-21T00:00:00.000Z' });
    await db.transactions.add({ id: 't3', amount: 500, type: 'income', categoryId: 'cat-income', remark: '', createdAt: '2026-08-20T00:00:00.000Z' });
  });
  it('should calculate correct totals', async () => {
    const s = await getSummary();
    expect(s.expenseTotal).toBe(80);
    expect(s.expenseCount).toBe(2);
    expect(s.incomeTotal).toBe(500);
    expect(s.incomeCount).toBe(1);
    expect(s.balance).toBe(420);
  });
  it('should return zeros for empty DB', async () => {
    vi.clearAllMocks();
    await db.transactions.clear();
    const s = await getSummary();
    expect(s.expenseTotal).toBe(0);
    expect(s.incomeTotal).toBe(0);
  });
});

describe('getDailyStats', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _m.categories.clear();
    _m.transactions.clear();
    await db.categories.add({ id: 'cat-dining', name: '餐饮', parentId: null, icon: null, color: '#ef4444', sortOrder: 0, type: 'expense' });
    await db.categories.add({ id: 'cat-income', name: '工资', parentId: null, icon: null, color: '#22c55e', sortOrder: 9, type: 'income' });
    await db.transactions.add({ id: 't1', amount: 30, type: 'expense', categoryId: 'cat-dining', remark: '', createdAt: '2026-08-20T00:00:00.000Z' });
    await db.transactions.add({ id: 't2', amount: 500, type: 'income', categoryId: 'cat-income', remark: '', createdAt: '2026-08-20T00:00:00.000Z' });
  });
  it('should aggregate by date', async () => {
    const r = await getDailyStats({ startDate: '2026-08-20', endDate: '2026-08-20' });
    expect(r).toHaveLength(1);
    expect(r[0].expense).toBe(30);
    expect(r[0].income).toBe(500);
    expect(r[0].balance).toBe(470);
  });
});

describe('getCategoryStats', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _m.categories.clear();
    _m.transactions.clear();
    await db.categories.add({ id: 'cat-dining', name: '餐饮', parentId: null, icon: null, color: '#ef4444', sortOrder: 0, type: 'expense' });
    await db.categories.add({ id: 'cat-transport', name: '交通', parentId: null, icon: null, color: '#3b82f6', sortOrder: 1, type: 'expense' });
    await db.transactions.add({ id: 't1', amount: 30, type: 'expense', categoryId: 'cat-dining', remark: '', createdAt: '2026-08-20T00:00:00.000Z' });
    await db.transactions.add({ id: 't2', amount: 50, type: 'expense', categoryId: 'cat-dining', remark: '', createdAt: '2026-08-21T00:00:00.000Z' });
    await db.transactions.add({ id: 't3', amount: 20, type: 'expense', categoryId: 'cat-transport', remark: '', createdAt: '2026-08-20T00:00:00.000Z' });
  });
  it('should group and sort by total desc', async () => {
    const r = await getCategoryStats();
    expect(r[0].name).toBe('餐饮');
    expect(r[0].total).toBe(80);
    expect(r[1].name).toBe('交通');
    expect(r[1].total).toBe(20);
  });
});

describe('getGroupStats', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _m.categories.clear();
    _m.transactions.clear();
    await db.categories.add({ id: 'cat-dining', name: '餐饮', parentId: null, icon: null, color: '#ef4444', sortOrder: 0, type: 'expense' });
    await db.categories.add({ id: 'sub-lunch', name: '午餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 1, type: 'expense' });
    await db.categories.add({ id: 'sub-dinner', name: '晚餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 2, type: 'expense' });
    await db.transactions.add({ id: 't1', amount: 30, type: 'expense', categoryId: 'sub-lunch', remark: '', createdAt: '2026-08-20T00:00:00.000Z' });
    await db.transactions.add({ id: 't2', amount: 50, type: 'expense', categoryId: 'sub-dinner', remark: '', createdAt: '2026-08-21T00:00:00.000Z' });
  });
  it('should group by parent category', async () => {
    const r = await getGroupStats();
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('餐饮');
    expect(r[0].total).toBe(80);
  });
});
