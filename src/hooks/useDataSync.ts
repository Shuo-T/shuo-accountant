import { useEffect } from 'react';
import { useCategoryStore, useExpenseStore, useStatsStore } from '../store';
import { initDB } from '../db';

export function useDataSync() {
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const fetchStats = useStatsStore((s) => s.fetchStats);

  useEffect(() => {
    initDB().then(() => {
      fetchCategories();
      fetchExpenses();
      fetchStats();
    });
  }, []);
}
