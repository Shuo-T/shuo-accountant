import { useState, useEffect, useRef, useMemo } from 'react';
import { useExpenseStore, useCategoryStore } from '../../store';
import type { Category } from '../../db';
import { Trash2, MoreHorizontal, UtensilsCrossed, Car, ShoppingBag, Home, Film, HeartPulse, GraduationCap, Smartphone } from 'lucide-react';

// Lucide 图标名称 → 组件的映射
const ICON_MAP: Record<string, React.ElementType> = {
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Smartphone,
  MoreHorizontal,
};

export default function ExpenseList() {
  const expenses = useExpenseStore((s) => s.expenses);
  const loading = useExpenseStore((s) => s.loading);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const filters = useExpenseStore((s) => s.filters);
  const setFilters = useExpenseStore((s) => s.setFilters);
  const filterApplied = useExpenseStore((s) => s.filterApplied);
  const hasAnyExpenses = useExpenseStore((s) => s.hasAnyExpenses);
  const clearFilters = useExpenseStore((s) => s.clearFilters);
  const categories = useCategoryStore((s) => s.categories);

  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState(filters.startDate ?? '');
  const [endDate, setEndDate] = useState(filters.endDate ?? new Date().toISOString().slice(0, 10));
  const [selectedCategory, setSelectedCategory] = useState(filters.categoryId ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  // Long press timer refs
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const level1 = categories.filter((c: Category) => !c.parentId);

  // 动态获取 Lucide 图标组件
  const CategoryIcon = useMemo(() => {
    return (iconName: string | null) => {
      const IconComponent = iconName ? ICON_MAP[iconName] : null;
      return IconComponent ? <IconComponent className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />;
    };
  }, []);

  // 当 filters 变化时，同步到表单
  useEffect(() => {
    setStartDate(filters.startDate ?? '');
    setEndDate(filters.endDate ?? '');
    setSelectedCategory(filters.categoryId ?? '');
  }, [filters]);

  // 当 filters 变化（来自外部导航），自动刷新列表
  useEffect(() => {
    void fetchExpenses();
  }, [filters.startDate, filters.endDate, filters.categoryId]);

  const handleFilter = async () => {
    setFilters({ startDate: startDate || undefined, endDate: endDate || undefined, categoryId: selectedCategory || undefined });
    setShowFilters(false);
    setSelectedIds(new Set());
    setDeleteMode(false);
    await fetchExpenses();
  };

  const handleReset = async () => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
    clearFilters();
    setShowFilters(false);
    setSelectedIds(new Set());
    setDeleteMode(false);
    await fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定删除这条记录吗？')) {
      await deleteExpense(id);
      await fetchExpenses();
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set<string>(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === expenses.length) {
      setSelectedIds(new Set<string>());
    } else {
      setSelectedIds(new Set(expenses.map(e => e.id!).filter(Boolean)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条记录吗？`)) return;

    for (const id of selectedIds) {
      await deleteExpense(id);
    }
    setSelectedIds(new Set());
    await fetchExpenses();
  };

  // 开始长按
  const handleTouchStart = (id: string) => {
    longPressFired.current = false;
    setLongPressTriggered(false);

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setLongPressTriggered(true);

      // 进入多选模式并选中当前项
      if (!deleteMode) {
        setDeleteMode(true);
      }
      setSelectedIds(prev => new Set<string>(prev).add(id));
    }, 500); // 500ms 长按
  };

  // 结束长按（取消）
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setLongPressTriggered(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const formatAmount = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">
            账单明细
            <span className="ml-2 text-sm font-normal text-slate-500">
              共 {expenses.length} 条
            </span>
          </h2>
          {selectedIds.size > 0 && (
            <span className="px-2 py-1 bg-slate-600 text-white text-xs rounded-full">
              已选 {selectedIds.size} 条
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {deleteMode && selectedIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              删除 ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => {
              setDeleteMode(!deleteMode);
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              deleteMode
                ? 'bg-slate-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {deleteMode ? '完成' : '多选'}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            🔍 筛选
          </button>
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">分类筛选</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">全部分类</option>
              {level1.map((cat: Category) => (
                <optgroup key={cat.id} label={cat.name}>
                  <option value={cat.id}>全部「{cat.name}」</option>
                  {categories
                    .filter((c: Category) => c.parentId === cat.id)
                    .map((sub: Category) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFilter}
              className="px-4 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
            >
              应用筛选
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-1.5 text-slate-600 hover:bg-slate-100 text-sm rounded-lg transition-colors"
            >
              重置
            </button>
          </div>
        </div>
      )}

      {/* 账单卡片列表 */}
      <div className="space-y-2">
        {/* 全选（多选模式下显示） */}
        {deleteMode && (
          <div className="flex items-center gap-2 px-2 py-2 bg-slate-50 rounded-lg">
            <input
              type="checkbox"
              checked={selectedIds.size === expenses.length && expenses.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
            />
            <span className="text-sm text-slate-600">全选</span>
            {selectedIds.size > 0 && (
              <span className="text-xs text-slate-400 ml-1">已选 {selectedIds.size}/{expenses.length}</span>
            )}
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">
            <div className="text-4xl mb-3 opacity-50">
              {filterApplied && hasAnyExpenses ? '🔍' : '📝'}
            </div>
            <p>{filterApplied && hasAnyExpenses ? '暂无匹配记录' : '暂无记账记录'}</p>
            <p className="text-sm mt-2">
              {filterApplied && hasAnyExpenses
                ? '调整上方筛选条件后重新查询'
                : '点击上方"记一笔"开始记账吧'}
            </p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div
              key={expense.id}
              className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between transition-all duration-150 ${
                deleteMode ? 'cursor-pointer active:bg-slate-50' : ''
              } ${selectedIds.has(expense.id!) ? 'ring-2 ring-slate-400 bg-slate-50' : ''} ${
                longPressTriggered ? 'scale-[0.98] opacity-80' : ''
              }`}
              onClick={() => deleteMode && expense.id && toggleSelect(expense.id!)}
              // 触摸事件（移动端长按）
              onTouchStart={() => {
                if (!deleteMode) {
                  handleTouchStart(expense.id!);
                }
              }}
              onTouchEnd={handleTouchEnd}
              onTouchMove={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                  setLongPressTriggered(false);
                }
              }}
              // 鼠标事件（桌面端长按）
              onMouseDown={() => {
                if (!deleteMode) {
                  handleTouchStart(expense.id!);
                }
              }}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {deleteMode && (
                <div className="mr-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(expense.id!)}
                    onChange={() => expense.id && toggleSelect(expense.id!)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: expense.categoryColor ?? '#64748b' }}
                >
                  {CategoryIcon(expense.categoryIcon)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">{expense.categoryName}</div>
                  <div className="text-xs text-slate-500">{formatDate(expense.createdAt)}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold text-slate-800">
                    {formatAmount(expense.amount)}
                  </div>
                  {expense.remark && (
                    <div className="text-xs text-slate-500">{expense.remark}</div>
                  )}
                </div>
                {!deleteMode && (
                  <button
                    onClick={() => expense.id && handleDelete(expense.id!)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
