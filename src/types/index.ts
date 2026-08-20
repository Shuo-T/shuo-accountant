export interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
}

export type TransactionType = 'expense' | 'income';

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

export interface StatsDaily {
  date: string;
  expense: number;
  income: number;
  balance: number;
}

export interface StatsCategory {
  name: string;
  total: number;
  color: string | null;
  type: TransactionType;
}

export interface Summary {
  expenseTotal: number;
  expenseCount: number;
  incomeTotal: number;
  incomeCount: number;
  balance: number;
}
