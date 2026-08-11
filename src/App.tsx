import { useState, useEffect } from 'react';
import Layout from './components/layout/Layout';
import ExpenseForm from './components/expense/ExpenseForm';
import ExpenseList from './components/expense/ExpenseList';
import StatsPanel from './components/stats/StatsPanel';
import CategoryPage from './components/category/CategoryPage';
import SettingsPanel from './components/settings/SettingsPanel';
import { useDataSync } from './hooks/useDataSync';
import { useExpenseStore } from './store';

type Page = 'home' | 'list' | 'stats' | 'category' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  // 加载数据
  useDataSync();

  // 统计页双击图表后跳转到账单页并应用筛选
  const pendingListFilter = useExpenseStore((s) => s.pendingListFilter);
  const clearPendingListFilter = useExpenseStore((s) => s.clearPendingListFilter);
  const setFilters = useExpenseStore((s) => s.setFilters);
  useEffect(() => {
    if (!pendingListFilter) return;
    setFilters(pendingListFilter);
    setCurrentPage('list');
    clearPendingListFilter();
  }, [pendingListFilter]);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <ExpenseForm />
            <ExpenseList />
          </div>
        );
      case 'list':
        return (
          <div className="max-w-2xl mx-auto">
            <ExpenseList />
          </div>
        );
      case 'stats':
        return (
          <div className="max-w-3xl mx-auto">
            <StatsPanel />
          </div>
        );
      case 'category':
        return <CategoryPage />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}
