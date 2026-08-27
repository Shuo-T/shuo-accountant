/** 分类选项，用于下拉选择等场景（仅包含展示所需字段） */
export interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
}

/** 交易类型：支出或收入 */
export type TransactionType = 'expense' | 'income';

/** 交易选项，用于下拉选择等场景（仅包含展示所需字段） */
export interface TransactionOption {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  remark: string;
  createdAt: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
}

/** 每日统计数据 */
export interface StatsDaily {
  date: string;
  expense: number;
  income: number;
  balance: number;
}

/** 分类维度的统计结果 */
export interface StatsCategory {
  name: string;
  total: number;
  color: string | null;
  type: TransactionType;
}

/** 收支汇总数据 */
export interface Summary {
  expenseTotal: number;
  expenseCount: number;
  incomeTotal: number;
  incomeCount: number;
  balance: number;
}
