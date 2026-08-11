import { useState } from 'react';
import { useCategoryStore, useExpenseStore } from '../../store';
import type { Category } from '../../db';

export default function ExpenseForm() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [level1Id, setLevel1Id] = useState('');
  const [level2Id, setLevel2Id] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  const categories = useCategoryStore((s) => s.categories);
  const addExpense = useExpenseStore((s) => s.addExpense);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);

  // 一级分类
  const level1 = categories.filter((c: Category) => !c.parentId);
  // 二级分类
  const level2 = categories.filter((c: Category) => c.parentId !== null);

  // 当前选中一级分类下的二级分类
  const currentLevel2 = level1Id
    ? level2.filter((c: Category) => c.parentId === level1Id)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('请输入有效的金额');
      return;
    }

    const categoryId = level2Id || level1Id;
    if (!categoryId) {
      setError('请选择分类');
      return;
    }

    if (!date) {
      setError('请选择日期');
      return;
    }

    try {
      await addExpense({
        amount: numAmount,
        categoryId,
        remark,
        createdAt: date + 'T00:00:00.000Z',
      });
      setAmount('');
      setDate(today);
      setLevel1Id('');
      setLevel2Id('');
      setRemark('');
      await fetchExpenses();
    } catch (err) {
      setError('添加失败，请重试');
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">💰 记一笔</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || today)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">金额 (¥)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">一级分类</label>
          <select
            value={level1Id}
            onChange={(e) => {
              setLevel1Id(e.target.value);
              setLevel2Id(''); // 重置二级分类
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          >
            <option value="">选择一级分类</option>
            {level1.map((cat: Category) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {level1Id && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              二级分类
              {currentLevel2.length === 0 && <span className="text-slate-400 ml-2">（无二级分类，将使用一级分类）</span>}
            </label>
            <select
              value={level2Id}
              onChange={(e) => setLevel2Id(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            >
              <option value="">选择二级分类（可选）</option>
              {currentLevel2.map((cat: Category) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">备注（可选）</label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="例如：午餐、打车回家..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          className="w-full bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          确认记账
        </button>
      </form>
    </div>
  );
}
