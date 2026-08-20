import { useState, useEffect, useMemo } from 'react';
import { useStatsStore, useTransactionStore, useCategoryStore } from '../../store';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line } from 'recharts';
import { PieChart as PieChartIcon, BarChart3, CalendarDays, CalendarRange, TrendingUp } from 'lucide-react';

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#64748b',
];

// 快速周期选项
const QUICK_PERIODS = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季度' },
  { key: 'half', label: '上半年' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' },
] as const;

export default function StatsPanel() {
  const daily = useStatsStore((s) => s.daily);
  const byCategory = useStatsStore((s) => s.byCategory);
  const byGroup = useStatsStore((s) => s.byGroup);
  const summary = useStatsStore((s) => s.summary);
  const period = useStatsStore((s) => s.period);
  const startDate = useStatsStore((s) => s.startDate);
  const endDate = useStatsStore((s) => s.endDate);
  const selectedGroupId = useStatsStore((s) => s.selectedGroupId);
  const selectedCategoryId = useStatsStore((s) => s.selectedCategoryId);
  const linesVisible = useStatsStore((s) => s.linesVisible);
  const chartType = useStatsStore((s) => s.chartType);
  const setPeriod = useStatsStore((s) => s.setPeriod);
  const setCustomRange = useStatsStore((s) => s.setCustomRange);
  const fetchStats = useStatsStore((s) => s.fetchStats);
  const setGroupFilter = useStatsStore((s) => s.setGroupFilter);
  const setCategoryFilter = useStatsStore((s) => s.setCategoryFilter);
  const setLinesVisible = useStatsStore((s) => s.setLinesVisible);
  const setChartType = useStatsStore((s) => s.setChartType);
  const loading = useStatsStore((s) => s.loading);

  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');

  // 分类树映射
  const categoryTree = useMemo(() => {
    const cats = useCategoryStore.getState().categories;
    const tree = new Map<string, {
      name: string;
      color: string | null;
      type: 'expense' | 'income';
      children: { name: string; color: string | null; type: 'expense' | 'income' }[];
    }>();
    for (const c of cats) {
      if (c.parentId === null) {
        tree.set(c.id, { name: c.name, color: c.color, type: c.type, children: [] });
      }
    }
    for (const c of cats) {
      if (c.parentId) {
        const parent = tree.get(c.parentId);
        if (parent) {
          parent.children.push({ name: c.name, color: c.color ?? c.parentId ?? '#64748b', type: c.type });
        }
      }
    }
    return tree;
  }, []);

  // 周期显示标签
  const periodLabel = useMemo(() => {
    if (period === 'custom' && startDate && endDate) {
      return `${startDate} ~ ${endDate}`;
    }
    const idx = QUICK_PERIODS.findIndex(p => p.key === period);
    return idx >= 0 ? QUICK_PERIODS[idx].label : period;
  }, [period, startDate, endDate]);

  const applyCustom = () => {
    setCustomRange(customStart, customEnd);
    setPeriod('custom');
    setShowCustom(false);
  };

  const handlePeriod = (p: string) => {
    setPeriod(p as typeof period);
  };

  useEffect(() => {
    if (period !== 'custom') {
      setShowCustom(false);
    } else {
      setCustomStart(startDate);
      setCustomEnd(endDate);
    }
  }, [period, startDate, endDate]);

  const handleGroupClick = (group: { id: string; name: string }) => {
    setGroupFilter(group.id);
  };

  const handleGroupDoubleClick = (group: { id: string; name: string }) => {
    const { startDate: pStart, endDate: pEnd } = useStatsStore.getState();
    const filter = {
      startDate: pStart || undefined,
      endDate: pEnd || undefined,
      categoryId: group.id,
      type: chartType,
    };
    const range = pStart && pEnd ? `${pStart} ~ ${pEnd}` : '全部时间';
    if (!confirm(`当前范围：${range}\n\n是否查看「${group.name}」的记录，跳转到账单页？`)) return;
    useTransactionStore.getState().applyListFilterAndNavigate(filter);
  };

  // 按 chartType 过滤
  const filteredByGroup = useMemo(() =>
    byGroup.filter(g => g.type === chartType),
    [byGroup, chartType]
  );

  const filteredByCategory = useMemo(() =>
    byCategory.filter(c => c.type === chartType),
    [byCategory, chartType]
  );

  // 二级分类数据（受大类筛选影响）
  const filteredCategories = useMemo(() => {
    if (!selectedGroupId) return filteredByCategory;
    const group = categoryTree.get(selectedGroupId);
    if (!group || group.children.length === 0) return filteredByCategory;
    const childNames = new Set(group.children.map((c) => c.name));
    return filteredByCategory.filter((item) => childNames.has(item.name));
  }, [filteredByCategory, selectedGroupId, categoryTree]);

  const handleCategoryClick = (category: { name: string; type: 'expense' | 'income' }) => {
    setCategoryFilter(category.name);
  };

  const handleCategoryDoubleClick = (category: { name: string; type?: 'expense' | 'income' }) => {
    const { startDate: pStart, endDate: pEnd } = useStatsStore.getState();
    const cats = useCategoryStore.getState().categories;
    // 用 type 精确查找，避免同名分类（如"其他"支出/收入）匹配错误
    const cat = cats.find((c) => c.name === category.name && c.type === (category.type || chartType));
    const filter = {
      startDate: pStart || undefined,
      endDate: pEnd || undefined,
      categoryId: cat?.id,
      type: chartType,
    };
    const range = pStart && pEnd ? `${pStart} ~ ${pEnd}` : '全部时间';
    if (!confirm(`当前范围：${range}\n\n是否查看「${category.name}」的记录，跳转到账单页？`)) return;
    useTransactionStore.getState().applyListFilterAndNavigate(filter);
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  // 趋势图：只绘制可见的线
  const trendData = daily.length > 0 ? daily.map(d => ({
    date: d.date.slice(5),
    ...(linesVisible.expense ? { expense: d.expense } : {}),
    ...(linesVisible.income ? { income: d.income } : {}),
    ...(linesVisible.balance ? { balance: d.balance } : {}),
  })) : [];

  return (
    <div className="space-y-6">
      {/* 统计概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">总支出</div>
          <div className="text-2xl font-bold text-red-600">
            ¥{summary?.expenseTotal.toFixed(2) ?? '0.00'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">总收入</div>
          <div className="text-2xl font-bold text-green-600">
            ¥{summary?.incomeTotal.toFixed(2) ?? '0.00'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">结余</div>
          <div className={`text-2xl font-bold ${summary && summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ¥{summary ? summary.balance.toFixed(2) : '0.00'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">记账笔数</div>
          <div className="text-2xl font-bold text-slate-800">
            {summary ? summary.expenseCount + summary.incomeCount : 0}
          </div>
        </div>
      </div>

      {/* 时间周期切换 */}
      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handlePeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === key
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              period === 'custom'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CalendarRange className="w-3 h-3" />
            自定义
          </button>
        </div>
        {showCustom && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">开始日期</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">结束日期</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyCustom}
                className="px-4 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
              >
                确定
              </button>
              <button
                onClick={() => setShowCustom(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 text-sm rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
        <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          当前: {periodLabel}
        </div>
      </div>

      {/* 收支趋势 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            收支趋势
          </h3>
          {/* 曲线显隐开关 */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setLinesVisible({ expense: !linesVisible.expense })}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                linesVisible.expense
                  ? 'bg-red-100 text-red-600 font-medium'
                  : 'bg-slate-100 text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              支出
            </button>
            <button
              onClick={() => setLinesVisible({ income: !linesVisible.income })}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                linesVisible.income
                  ? 'bg-green-100 text-green-600 font-medium'
                  : 'bg-slate-100 text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              收入
            </button>
            <button
              onClick={() => setLinesVisible({ balance: !linesVisible.balance })}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                linesVisible.balance
                  ? 'bg-blue-100 text-blue-600 font-medium'
                  : 'bg-slate-100 text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              结余
            </button>
          </div>
        </div>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={daily.length > 14 ? -30 : 0}
                textAnchor={daily.length > 14 ? 'end' : 'middle'}
                height={daily.length > 14 ? 40 : 25}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(value: number) => `¥${value}`}
                width={50}
              />
              <Tooltip
                formatter={((value: unknown, name: string) => [`¥${Number(value).toFixed(2)}`, name]) as any}
                labelFormatter={(label: unknown) => label ? `日期：${label}` : ''}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              {linesVisible.expense && (
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', strokeWidth: 1.5, r: 3 }}
                  activeDot={{ r: 5, fill: '#ef4444' }}
                  name="支出"
                  connectNulls={false}
                />
              )}
              {linesVisible.income && (
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', strokeWidth: 1.5, r: 3 }}
                  activeDot={{ r: 5, fill: '#22c55e' }}
                  name="收入"
                  connectNulls={false}
                />
              )}
              {linesVisible.balance && (
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#3b82f6', strokeWidth: 1.5, r: 2 }}
                  name="结余"
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            暂无数据
          </div>
        )}
      </div>

      {/* 大类占比 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            大类占比
          </h3>
          <div className="flex items-center gap-2">
            {selectedGroupId && (
              <button
                onClick={() => setGroupFilter(null)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕ 取消筛选
              </button>
            )}
            <ChartTypeToggle
              value={chartType}
              onChange={setChartType}
            />
          </div>
        </div>
        {filteredByGroup.length > 0 ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie
                  data={filteredByGroup}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="total"
                  onClick={(data: any) => handleGroupClick(data.payload)}
                  onDoubleClick={(data: any) => handleGroupDoubleClick(data.payload)}
                  label={undefined}
                  labelLine={false}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {filteredByGroup.map((group, index) => {
                    const isSelected = selectedGroupId === group.id;
                    return (
                      <Cell
                        key={group.id}
                        fill={group.type === 'income' ? '#22c55e' : CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        opacity={isSelected ? 1 : 0.55}
                        stroke="#fff"
                        strokeWidth={isSelected ? 3 : 2}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  formatter={(value: unknown) => `¥${Number(value).toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 max-h-[220px] overflow-y-auto">
              {filteredByGroup.map((item, index) => {
                const isSelected = selectedGroupId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleGroupClick(item)}
                    onDoubleClick={() => handleGroupDoubleClick(item)}
                    className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-100 ring-1 ring-slate-400'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.type === 'income' ? '#22c55e' : CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                      />
                      <span className={`truncate ${isSelected ? 'font-medium text-slate-800' : 'text-slate-700'}`}>
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {item.type === 'income' ? '收' : '支'}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={`font-medium ${item.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                        ¥{item.total.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {(() => {
                          const base = item.type === 'income' ? (summary?.incomeTotal ?? 1) : (summary?.expenseTotal ?? 1);
                          return ((item.total / base) * 100).toFixed(1);
                        })()}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-44 flex items-center justify-center text-slate-400">
            暂无数据
          </div>
        )}
        <div className="mt-2 text-xs text-slate-400">
          单击选中/取消大类，双击列表数据查看账单
        </div>
      </div>

      {/* 分类占比 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            分类占比
          </h3>
          <div className="flex items-center gap-2">
            {selectedGroupId && (
              <span className="text-xs text-slate-400 font-normal">
                * 仅展示「{categoryTree.get(selectedGroupId)?.name}」子分类
              </span>
            )}
            <ChartTypeToggle
              value={chartType}
              onChange={setChartType}
            />
          </div>
        </div>
        {filteredCategories.length > 0 ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie
                  data={filteredCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="total"
                  label={undefined}
                  labelLine={false}
                  stroke="#fff"
                  strokeWidth={2}
                  onClick={(data: any) => data?.payload?.name && handleCategoryClick({ name: data.payload.name, type: data.payload.type })}
                  onDoubleClick={(data: any) => data?.payload?.name && handleCategoryDoubleClick({ name: data.payload.name, type: data.payload.type })}
                >
                  {filteredCategories.map((item, index) => {
                    const isSelected = selectedCategoryId === item.name;
                    return (
                      <Cell
                        key={item.name}
                        fill={item.type === 'income' ? '#22c55e' : CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        opacity={isSelected ? 1 : 0.55}
                        stroke="#fff"
                        strokeWidth={isSelected ? 3 : 2}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  formatter={(value: unknown) => `¥${Number(value).toFixed(2)}`}
                  labelFormatter={(label: unknown) => {
                    const item = filteredCategories.find(g => g.name === label);
                    if (!item) return label as string;
                    const base = item.type === 'income'
                      ? (summary?.incomeTotal ?? 1)
                      : (summary?.expenseTotal ?? 1);
                    return `${label}  ·  ${(item.total / base * 100).toFixed(1)}%`;
                  }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 max-h-[250px] overflow-y-auto">
              {filteredCategories.map((item) => {
                const isSelected = selectedCategoryId === item.name;
                const colorIndex = filteredCategories.findIndex(g => g.name === item.name);
                return (
                  <div
                    key={item.name}
                    onClick={() => handleCategoryClick(item)}
                    onDoubleClick={() => handleCategoryDoubleClick({ name: item.name, type: item.type })}
                    className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-100 ring-1 ring-slate-400'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.type === 'income' ? '#22c55e' : CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length] }}
                      />
                      <span className={`truncate ${isSelected ? 'font-medium text-slate-800' : 'text-slate-700'}`}>
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {item.type === 'income' ? '收' : '支'}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={`font-medium ${item.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                        ¥{item.total.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {(() => {
                          const base = item.type === 'income' ? (summary?.incomeTotal ?? 1) : (summary?.expenseTotal ?? 1);
                          return ((item.total / base) * 100).toFixed(1);
                        })()}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            暂无数据
          </div>
        )}
        <div className="mt-2 text-xs text-slate-400">
          单击选中/取消分类，双击列表数据查看账单
        </div>
      </div>

      {/* 分类对比 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            分类对比
            <span className="text-xs text-slate-400 font-normal ml-auto">双击查看账单</span>
            {selectedGroupId && (
              <span className="text-xs text-slate-400 font-normal">
                * 仅展示「{categoryTree.get(selectedGroupId)?.name}」子分类
              </span>
            )}
          </h3>
          <ChartTypeToggle
            value={chartType}
            onChange={setChartType}
          />
        </div>
        {filteredCategories.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={filteredCategories}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(value: number) => `¥${value}`}
                width={50}
              />
              <Tooltip
                formatter={((value: unknown, name: string) => [`¥${Number(value).toFixed(2)}`, name]) as any}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Bar
                dataKey="total"
                fill={(((props: any) => props.payload.type === 'income' ? '#22c55e' : '#ef4444')) as any}
                radius={[4, 4, 0, 0]}
                name="金额"
                onDoubleClick={((data: any) => {
                  if (data?.name) handleChartDoubleClick(data);
                }) as any}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            暂无数据
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 支出/收入切换按钮 ─────────────────────────────────────────────────────────

interface ChartTypeToggleProps {
  value: 'expense' | 'income';
  onChange: (type: 'expense' | 'income') => void;
}

function ChartTypeToggle({ value, onChange }: ChartTypeToggleProps) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
      <button
        onClick={() => onChange('expense')}
        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
          value === 'expense'
            ? 'bg-red-500 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        支出
      </button>
      <button
        onClick={() => onChange('income')}
        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
          value === 'income'
            ? 'bg-green-500 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        收入
      </button>
    </div>
  );
}

// 辅助函数：双击图表根据分类名称推断筛选条件，跳转到账单页
function handleChartDoubleClick(payload?: { name?: string; date?: string }) {
  if (!payload) return;
  const { startDate: pStart, endDate: pEnd } = useStatsStore.getState();
  const chartType = useStatsStore.getState().chartType;
  const filter: { startDate?: string; endDate?: string; categoryId?: string; type?: 'expense' | 'income' } = {
    startDate: pStart || undefined,
    endDate: pEnd || undefined,
    type: chartType,
  };
  let hint = '';
  if (payload.date) {
    filter.startDate = payload.date;
    filter.endDate = payload.date;
    hint = `${payload.date}`;
  } else if (payload.name) {
    const cats = useCategoryStore.getState().categories;
    const cat = cats.find((c) => c.name === payload.name);
    if (cat) filter.categoryId = cat.id;
    hint = `分类「${payload.name}」`;
  }
  const range = pStart && pEnd ? `${pStart} ~ ${pEnd}` : '全部时间';
  const message = hint
    ? `当前范围：${range}\n\n是否查看${hint}的记录，跳转到账单页？`
    : `当前范围：${range}\n\n是否跳转到账单页查看全部记录？`;
  if (!confirm(message)) return;
  useTransactionStore.getState().applyListFilterAndNavigate(filter);
}
