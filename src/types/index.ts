export interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
}

export interface ExpenseOption {
  id: string;
  amount: number;
  categoryId: string;
  remark: string;
  createdAt: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export interface StatsDaily {
  date: string;
  total: number;
}

export interface StatsCategory {
  name: string;
  total: number;
  color: string | null;
}

export interface Summary {
  total: number;
  count: number;
}
