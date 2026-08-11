import { useEffect, useMemo, useState } from 'react';
import { useStatsStore, useExpenseStore, useCategoryStore } from '../../store';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { PieChart as PieChartIcon, BarChart3, CalendarDays, CalendarRange } from 'lucide-react';

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
  const setPeriod = useStatsStore((s) => s.setPeriod);
  const setCustomRange = useStatsStore((s) => s.setCustomRange);
  const fetchStats = useStatsStore((s) => s.fetchStats);
  const setGroupFilter = useStatsStore((s) => s.setGroupFilter);
  const loading = useStatsStore((s) => s.loading);

  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');

  // 分类树映射，便于快速获取分类层级信息
  const categoryTree = useMemo(() => {
    const cats = useCategoryStore.getState().categories;
    const tree = new Map<string, {
      name: string;
      color: string | null;
      children: { name: string; color: string | null }[];
    }>();
    // 先建立一级分类占位
    for (const c of cats) {
      if (c.parentId === null) {
        tree.set(c.id, { name: c.name, color: c.color, children: [] });
      }
    }
    // 填入二级分类
    for (const c of cats) {
      if (c.parentId) {
        const parent = tree.get(c.parentId);
        if (parent) {
          parent.children.push({ name: c.name, color: c.color ?? c.parentId ?? '#64748b' });
        }
      }
    }
    return tree;
  }, []);

  // 双击图表跳转账单页筛选
  const categoryTreeLookup = useMemo(() => {
    const cats = useCategoryStore.getState().categories;
    return new Map(cats.map((c) => [c.id, c]));
  }, []);
  void categoryTreeLookup;

  // 周期显示标签
  const periodLabel = useMemo(() => {
    if (period === 'custom' && startDate && endDate) {
      return `${startDate} ~ ${endDate}`;
    }
    const idx = QUICK_PERIODS.findIndex(p => p.key === period);
    return idx >= 0 ? QUICK_PERIODS[idx].label : period;
  }, [period, startDate, endDate]);

  // 应用自定义日期
  const applyCustom = () => {
    setCustomRange(customStart, customEnd);
    setPeriod('custom');
    setShowCustom(false);
  };

  // 切换预设周期
  const handlePeriod = (p: string) => {
    setPeriod(p as typeof period);
  };

  // 当 period 切换回非自定义时，重置输入框
  useEffect(() => {
    if (period !== 'custom') {
      setShowCustom(false);
    } else {
      setCustomStart(startDate);
      setCustomEnd(endDate);
    }
  }, [period, startDate, endDate]);

  // 单击大类块：选中/取消选中；展开时联动二级分类
  const handleGroupClick = (group: { id: string; name: string }) => {
    setGroupFilter(group.id);
  };

  // 双击大类块：跳转到账单页筛选
  const handleGroupDoubleClick = (group: { id: string; name: string }) => {
    const { startDate: pStart, endDate: pEnd } = useStatsStore.getState();
    const filter = {
      startDate: pStart || undefined,
      endDate: pEnd || undefined,
      categoryId: group.id,
    };
    const range = pStart && pEnd ? `${pStart} ~ ${pEnd}` : '全部时间';
    if (!confirm(`当前范围：${range}\n\n是否查看「${group.name}」的记录，跳转到账单页？`)) return;
    useExpenseStore.getState().applyListFilterAndNavigate(filter);
  };

  // 计算平均支出
  const avgExpense = useMemo(() => {
    if (!summary || summary.count === 0) return 0;
    return summary.total / summary.count;
  }, [summary]);

  // 计算最大支出日期
  const maxExpenseDay = useMemo(() => {
    if (daily.length === 0) return null;
    return daily.reduce((max, d) => d.total > max.total ? d : max, daily[0]);
  }, [daily]);

  // 二级分类数据：选中大类时只显示该大类下的子分类，否则显示全部
  const filteredCategories = useMemo(() => {
    if (!selectedGroupId) return byCategory;
    const group = categoryTree.get(selectedGroupId);
    if (!group || group.children.length === 0) return byCategory;
    // 在 byCategory 中筛选出属于该大类的子分类
    const childNames = new Set(group.children.map((c) => c.name));
    return byCategory.filter((item) => childNames.has(item.name));
  }, [byCategory, selectedGroupId, categoryTree]);

  useEffect(() => {
    fetchStats();
  }, [period]); // 仅 period 变化时触发，因为 setPeriod 会自动更新 startDate/endDate

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">总支出</div>
          <div className="text-2xl font-bold text-slate-800">
            ¥{summary?.total.toFixed(2) ?? '0.00'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">记账笔数</div>
          <div className="text-2xl font-bold text-slate-800">{summary?.count ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">平均支出</div>
          <div className="text-2xl font-bold text-slate-800">
            ¥{avgExpense.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">最高单日</div>
          <div className="text-2xl font-bold text-slate-800">
            {maxExpenseDay ? `¥${maxExpenseDay.total.toFixed(0)}` : '-'}
          </div>
          {maxExpenseDay && (
            <div className="text-xs text-slate-500 mt-1">{maxExpenseDay.date}</div>
          )}
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

      {/* 大类占比 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            大类占比
          </h3>
          {selectedGroupId && (
            <button
              onClick={() => setGroupFilter(null)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              ✕ 取消筛选
            </button>
          )}
        </div>
        {byGroup.length > 0 ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie
                  data={byGroup}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="total"
                  // 单击选中/取消，双击跳转到账单页
                  onClick={(data: any) => handleGroupClick(data.payload)}
                  onDoubleClick={(data: any) => handleGroupDoubleClick(data.payload)}
                  label={({ name, percent }) => {
                    if (!name || !percent) return '';
                    return `${name} ${(percent * 100).toFixed(0)}%`;
                  }}
                  labelLine={false}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {byGroup.map((group, index) => {
                    const isSelected = selectedGroupId === group.id;
                    return (
                      <Cell
                        key={group.id}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
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
              {byGroup.map((item, index) => {
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
                        style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                      />
                      <span className={`truncate ${isSelected ? 'font-medium text-slate-800' : 'text-slate-700'}`}>
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="font-medium text-slate-800">¥{item.total.toFixed(2)}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        {((item.total / (summary?.total || 1)) * 100).toFixed(1)}%
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-crosshair" title="双击图表可查看账单明细">
        <h3 className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
          <PieChartIcon className="w-4 h-4" />
          分类占比
          <span className="text-xs text-slate-400 font-normal ml-auto">双击查看账单</span>
          {selectedGroupId && (
            <span className="text-xs text-slate-400 font-normal">
              · 仅展示「{categoryTree.get(selectedGroupId)?.name}」子分类
            </span>
          )}
        </h3>
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
                  onDoubleClick={((data: any) => {
                    if (data?.name) handleChartDoubleClick(data);
                  }) as any}
                  label={({ name, percent }: { name?: string; percent?: number }) => {
                    if (!name || !percent) return '';
                    return `${name} ${(percent * 100).toFixed(0)}%`;
                  }}
                  labelLine={false}
                >
                  {filteredCategories.map((_entry: unknown, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown) => `¥${Number(value).toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 max-h-[250px] overflow-y-auto">
              {filteredCategories.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                    />
                    <span className="text-slate-700 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-slate-800">¥{item.total.toFixed(2)}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {((item.total / (summary?.total || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            暂无数据
          </div>
        )}
      </div>

      {/* 分类支出柱状图 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-crosshair" title="双击柱状图柱体可查看账单明细">
        <h3 className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          分类支出对比
          <span className="text-xs text-slate-400 font-normal ml-auto">双击查看账单</span>
          {selectedGroupId && (
            <span className="text-xs text-slate-400 font-normal">
              · 仅展示「{categoryTree.get(selectedGroupId)?.name}」子分类
            </span>
          )}
        </h3>
        {filteredCategories.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={filteredCategories.slice(0, 8)}>
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
                formatter={(value: unknown) => [`¥${Number(value).toFixed(2)}`, '支出']}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Bar
                dataKey="total"
                fill="#64748b"
                radius={[4, 4, 0, 0]}
                name="支出"
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

// 辅助函数：双击图表根据分类名称推断筛选条件，跳转到账单页
function handleChartDoubleClick(payload?: { name?: string; date?: string }) {
  if (!payload) return;
  const { startDate: pStart, endDate: pEnd } = useStatsStore.getState();
  const filter: { startDate?: string; endDate?: string; categoryId?: string } = {
    startDate: pStart || undefined,
    endDate: pEnd || undefined,
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
  useExpenseStore.getState().applyListFilterAndNavigate(filter);
}
