import { useEffect } from 'react';
import { useCategoryStore, useTransactionStore, useStatsStore } from '../store';
import { initDB } from '../db';

export function useDataSync() {
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchTransactions = useTransactionStore((s) => s.fetchTransactions);
  const fetchStats = useStatsStore((s) => s.fetchStats);

  useEffect(() => {
    initDB().then(() => {
      fetchCategories();
      fetchTransactions();
      fetchStats();
    });
  }, []);
}
