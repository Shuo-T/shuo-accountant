import { useState } from 'react';
import {
  exportToCSV,
  exportToJson,
  importFromCSV,
  importFromJSON,
  importFromJSONText,
  downloadFile,
  clearAllData,
  clearExpensesOnly,
} from '../../lib/export';
import { useExpenseStore, useCategoryStore } from '../../store';
import { Download, Upload, Trash2, FileText, Database, ClipboardPaste } from 'lucide-react';

export default function SettingsPanel() {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; success?: number; skipped?: number; failed?: number } | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);

  // 导出 CSV
  const handleExportCSV = async () => {
    const csv = await exportToCSV();
    const now = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    downloadFile(csv, `朔记_${now}.csv`, 'text/csv;charset=utf-8');
  };

  // 导出 JSON
  const handleExportJSON = async () => {
    const json = await exportToJson();
    const now = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    downloadFile(json, `朔记备份_${now}.json`, 'application/json');
  };

  // 导入 CSV
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const result = await importFromCSV(file, (progress) => {
        setImportProgress(progress);
      });
      setImportResult(result);
      setImportProgress(null);

      if (result.success > 0) {
        await fetchExpenses();
        await fetchCategories();
      }
    } catch (err) {
      setImportResult({ success: 0, skipped: 0, errors: [err instanceof Error ? err.message : '导入失败'] });
    } finally {
      setImporting(false);
      setImportProgress(null);
      e.target.value = '';
    }
  };

  // 导入 JSON（文本粘贴）
  const handleImportJSONPaste = async () => {
    if (!pasteText.trim()) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress(null);
    try {
      const result = await importFromJSONText(pasteText, (progress) => {
        setImportProgress(progress);
      });
      setImportResult({
        success: result.expenses,
        skipped: result.expenses,
        errors: result.errors,
      });
      if (result.expenses > 0) {
        await fetchExpenses();
        await fetchCategories();
      }
      setPasteText('');
      setShowPaste(false);
    } catch (err) {
      setImportResult({ success: 0, skipped: 0, errors: [err instanceof Error ? err.message : '导入失败'] });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  // 导入 JSON
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const result = await importFromJSON(file, (progress) => {
        setImportProgress(progress);
      });
      setImportResult({
        success: result.expenses,
        skipped: result.expenses,
        errors: result.errors,
      });

      if (result.expenses > 0) {
        await fetchExpenses();
        await fetchCategories();
      }
    } catch (err) {
      setImportResult({ success: 0, skipped: 0, errors: [err instanceof Error ? err.message : '导入失败'] });
    } finally {
      setImporting(false);
      setImportProgress(null);
      e.target.value = '';
    }
  };

  // 清空记账数据（保留分类）
  const handleClearExpenses = async () => {
    if (!confirm('确定要清空所有记账记录吗？分类数据将保留，此操作不可恢复！')) return;
    try {
      await clearExpensesOnly();
      await fetchExpenses();
      await fetchCategories();
      alert('记账数据已清空');
    } catch (err) {
      alert('清空失败: ' + (err as Error).message);
    }
  };

  // 清空数据
  const handleClear = async () => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;

    try {
      await clearAllData();
      await fetchExpenses();
      await fetchCategories();
      alert('数据已清空');
    } catch (err) {
      alert('清空失败: ' + (err as Error).message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 导出功能 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-slate-500" />
          导出数据
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="font-medium text-slate-800">导出为 CSV</div>
              <div className="text-sm text-slate-500">适用于 Excel 查看和分析</div>
            </div>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              导出 CSV
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="font-medium text-slate-800">导出为 JSON</div>
              <div className="text-sm text-slate-500">完整备份，包含所有数据和配置</div>
            </div>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              导出备份
            </button>
          </div>
        </div>
      </div>

      {/* 导入功能 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-slate-500" />
          导入数据
        </h2>

        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="font-medium text-slate-800 mb-2">从 CSV 导入</div>
            <div className="text-sm text-slate-500 mb-3">
              支持从 Excel 导出的 CSV 文件导入，需包含：日期、金额、分类、备注
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              disabled={importing}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-slate-100 file:text-slate-700
                hover:file:bg-slate-200
                disabled:opacity-50"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="font-medium text-slate-800 mb-2">从 JSON 备份导入</div>
            <div className="text-sm text-slate-500 mb-3">
              从之前导出的 JSON 备份文件恢复数据（会清空现有数据）
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              disabled={importing}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-slate-100 file:text-slate-700
                hover:file:bg-slate-200
                disabled:opacity-50"
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-400">— 或粘贴 JSON 文本 —</span>
            </div>
            <button
              onClick={() => setShowPaste(!showPaste)}
              disabled={importing}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              粘贴导入
            </button>
            {showPaste && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder='在此粘贴 JSON 文本，格式如 {"categories":[...],"expenses":[...]}'
                  disabled={importing}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleImportJSONPaste}
                    disabled={importing || !pasteText.trim()}
                    className="px-4 py-1.5 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                  >
                    {importing ? '导入中...' : '确认导入'}
                  </button>
                  <button
                    onClick={() => { setPasteText(''); setShowPaste(false); }}
                    disabled={importing}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    清空
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 导入进度 */}
        {importProgress && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">导入中...</span>
              <span className="text-sm text-blue-600">
                第 {importProgress.current} / {importProgress.total} 条
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
              ></div>
            </div>
            <div className="mt-2 text-xs text-blue-600">
              {importProgress.success !== undefined ? (
                <>✅ 成功 {importProgress.success} 条，⏭️ 跳过 {importProgress.skipped ?? 0} 条重复，❌ 失败 {importProgress.failed ?? 0} 条</>
              ) : (
                '处理中...'
              )}
            </div>
          </div>
        )}

        {/* 导入结果 */}
        {importResult && (
          <div className={`mt-4 p-4 rounded-lg ${importResult.errors.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            {importResult.errors.length > 0 ? (
              <div>
                <div className="font-medium text-red-800">导入完成，但有错误：</div>
                <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                  {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-green-800">
                  ✅ 成功导入 {importResult.success} 条记录
                  {importResult.skipped > 0 && <span className="ml-2">（跳过 {importResult.skipped} 条重复）</span>}
                </span>
                <button
                  onClick={() => setImportResult(null)}
                  className="flex-shrink-0 p-1 rounded hover:bg-white/60 transition-colors text-green-700 opacity-60 hover:opacity-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 数据管理 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-slate-500" />
          数据管理
        </h2>

        {/* 清空记账数据 */}
        <div className="p-4 bg-amber-50 rounded-lg mb-3">
          <div className="font-medium text-amber-800 mb-2">清空记账数据</div>
          <div className="text-sm text-amber-600 mb-3">
            删除所有记账记录，保留分类配置
          </div>
          <button
            onClick={handleClearExpenses}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            清空记账
          </button>
        </div>

        {/* 清空所有数据 */}
        <div className="p-4 bg-red-50 rounded-lg">
          <div className="font-medium text-red-800 mb-2">清空所有数据</div>
          <div className="text-sm text-red-600 mb-3">
            删除所有记账记录和分类，此操作不可恢复！
          </div>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            清空数据
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-500" />
          关于
        </h2>
        <div className="text-sm text-slate-600 space-y-2">
          <p><strong>朔记</strong> v0.1.0</p>
          <p>一款简洁易用的个人记账工具</p>
          <p>数据存储在浏览器本地，不会上传到服务器</p>
          <p>建议定期导出备份，防止数据丢失</p>
        </div>
      </div>
    </div>
  );
}
