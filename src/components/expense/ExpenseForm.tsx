import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { useCategoryStore, useTransactionStore } from '../../store';
import type { Category, TransactionType } from '../../db';

export default function ExpenseForm() {
  return <TransactionForm />;
}

function TransactionForm() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [level1Id, setLevel1Id] = useState('');
  const [level2Id, setLevel2Id] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  const categories = useCategoryStore((s) => s.categories);
  const addTransaction = useTransactionStore((s) => s.addTransaction);
  const fetchTransactions = useTransactionStore((s) => s.fetchTransactions);

  const level1 = categories.filter((c: Category) => !c.parentId && c.type === type);
  const level2 = categories.filter((c: Category) => c.parentId !== null && c.type === type);

  const currentLevel2 = level1Id
    ? level2.filter((c: Category) => c.parentId === level1Id)
    : [];

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setLevel1Id('');
    setLevel2Id('');
  };

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
      await addTransaction({
        amount: numAmount,
        type,
        categoryId,
        remark,
        createdAt: date + 'T00:00:00.000Z',
      });
      setAmount('');
      setDate(today);
      setLevel1Id('');
      setLevel2Id('');
      setRemark('');
      await fetchTransactions();
    } catch (err) {
      setError('添加失败，请重试');
      console.error(err);
    }
  };

  const isExpense = type === 'expense';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <PlusCircle className="w-5 h-5" />记一笔
      </h2>

      {/* 类型切换 */}
      <div className="flex rounded-lg bg-slate-100 p-1 mb-4">
        <button
          type="button"
          onClick={() => handleTypeChange('expense')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
            isExpense
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <span className="text-base">↓</span>
          支出
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('income')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
            !isExpense
              ? 'bg-green-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <span className="text-base">↑</span>
          收入
        </button>
      </div>

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
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            {isExpense ? '支出' : '收入'}一级分类
          </label>
          <select
            value={level1Id}
            onChange={(e) => {
              setLevel1Id(e.target.value);
              setLevel2Id('');
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
            placeholder={`例如：${isExpense ? '午餐、打车回家...' : '月薪、兼职收入...'}`}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          className={`w-full font-medium py-2 px-4 rounded-lg transition-colors ${
            isExpense
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          确认{isExpense ? '记账' : '入账'}
        </button>
      </form>
    </div>
  );
}
