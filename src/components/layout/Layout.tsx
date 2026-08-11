import { Home, List, BarChart3, Tags, Settings } from 'lucide-react';

type Page = 'home' | 'list' | 'stats' | 'category' | 'settings';

interface NavItem {
  id: Page;
  label: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'list', label: '账单', icon: List },
  { id: 'stats', label: '统计', icon: BarChart3 },
  { id: 'category', label: '分类', icon: Tags },
  { id: 'settings', label: '设置', icon: Settings },
];

interface Props {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export default function Layout({ children, currentPage, onNavigate }: Props) {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* 顶部标题栏 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">朔</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">朔记</h1>
          </div>
          <div className="text-sm text-slate-500">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>

      {/* 底部导航栏 */}
      <nav className="bg-white border-t border-slate-200 px-6 py-3">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                  isActive ? 'text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
