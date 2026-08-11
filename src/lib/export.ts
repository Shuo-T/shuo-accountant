import { db, type Expense, type Category } from '../db';

// ─── 导出功能 ────────────────────────────────────────────────────────────────

/**
 * 导出为 CSV 格式（可用于 Excel 打开）
 * 包含：日期、金额、分类、备注
 */
export async function exportToCSV(): Promise<string> {
  const rawExpenses = await db.expenses.toArray();
  const categories: Category[] = await db.categories.toArray();
  const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  // 将 ExpenseRaw 转换为 Expense（填充分类信息）
  const expenses: Expense[] = rawExpenses.map(e => ({
    ...e,
    categoryName: categoryMap.get(e.categoryId)?.name || '未知分类',
    categoryIcon: categoryMap.get(e.categoryId)?.icon || null,
    categoryColor: categoryMap.get(e.categoryId)?.color || '#64748b',
  }));

  // CSV 表头
  const headers = ['日期', '金额 (元)', '一级分类', '二级分类', '备注'];
  const rows = expenses.map(e => {
    const cat = categoryMap.get(e.categoryId);
    const level1Cat = cat?.parentId ? categories.find((c: Category) => c.id === cat.parentId) : null;
    const level1 = level1Cat?.name || cat?.name || '';
    const level2 = cat?.name || '';
    const date = new Date(e.createdAt).toLocaleDateString('zh-CN');
    return [date, e.amount.toFixed(2), level1, level2, e.remark || ''];
  });

  // 添加总计行
  const total = expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  rows.push(['', total.toFixed(2), '总计', '', '']);

  // 转换为 CSV 格式（处理逗号引号）
  const csvRows = [headers, ...rows].map((row: string[]) =>
    row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(',')
  );

  // 添加 BOM 以支持 Excel 正确显示中文
  return '﻿' + csvRows.join('\n');
}

/**
 * 导出为 JSON 格式（完整备份）
 * 包含：所有分类和支出数据，可用于恢复
 */
export async function exportToJson(): Promise<string> {
  const categories: Category[] = await db.categories.toArray();
  const rawExpenses = await db.expenses.toArray();
  const expenses: Expense[] = rawExpenses.map(e => ({
    ...e,
    categoryName: '',
    categoryIcon: null,
    categoryColor: '#64748b',
  }));

  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: '黑马记账',
    categories,
    expenses,
    summary: {
      totalExpenses: expenses.length,
      totalAmount: expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0),
    }
  };

  return JSON.stringify(data, null, 2);
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 导入功能 ────────────────────────────────────────────────────────────────

/**
 * 解析 CSV 文件
 */
export function parseCSV(text: string): Array<{
  date: string;
  amount: number;
  level1: string;
  level2: string;
  remark: string;
}> {
  console.log('📄 解析 CSV，文本长度:', text.length);
  console.log('📄 前 200 字符:', text.substring(0, 200));

  // 移除 BOM
  const cleanText = text.replace(/^﻿/, '');
  console.log('✅ BOM 已移除');

  // 处理换行符（支持 Windows \r\n 和 Unix \n）
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim());
  console.log('📄 总行数:', lines.length);

  if (lines.length === 0) {
    console.error('❌ CSV 文件为空');
    return [];
  }

  // 打印第一行（表头）
  console.log('📄 表头:', lines[0]);

  // 解析 CSV
  const rows: Array<{ date: string; amount: number; level1: string; level2: string; remark: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 简单 CSV 解析（处理引号）
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    console.log(`📄 第 ${i} 行:`, values);

    const date = values[0] || '';
    const amount = parseFloat(values[1]) || 0;
    const level1 = values[2] || '';
    const level2 = values[3] || '';
    const remark = values[4] || '';

    if (amount > 0) {
      rows.push({ date, amount, level1, level2, remark });
    }
  }

  console.log('✅ 解析完成，有效行数:', rows.length);
  return rows;
}

/**
 * 导入 CSV 文件
 */
export async function importFromCSV(file: File, onProgress?: (progress: { current: number; total: number; success: number; skipped: number; failed: number }) => void): Promise<{ success: number; skipped: number; failed: number; errors: string[] }> {
  console.log('📥 开始导入 CSV:', file.name);

  const text = await file.text();
  console.log('📄 文件文本长度:', text.length);

  const parsed = parseCSV(text);
  console.log('📊 解析结果:', parsed.length, '行');

  if (parsed.length === 0) {
    return { success: 0, skipped: 0, failed: 0, errors: ['CSV 文件为空或格式不正确'] };
  }

  const categories: Category[] = await db.categories.toArray();
  console.log('📂 数据库中的分类数:', categories.length);

  const categoryMap = new Map<string, Category>(categories.map((c: Category) => [c.name, c]));
  const level1Map = new Map<string, Category>(
    categories.filter((c: Category) => !c.parentId).map((c: Category) => [c.name, c])
  );

  console.log('📂 一级分类:', Array.from(level1Map.keys()));
  console.log('📂 二级分类:', Array.from(categoryMap.keys()));

  const errors: string[] = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  // 获取已有支出，用于重复校验
  const existingExpenses = await db.expenses.toArray();
  const seenKeys = new Set<string>(
    existingExpenses.map(e => `${e.categoryId}|${e.amount}|${e.createdAt}|${e.remark}`)
  );

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    try {
      console.log(`\n处理行: ${row.date} | ${row.amount} | ${row.level1}/${row.level2}`);

      // 查找或创建分类
      let targetCategory = categoryMap.get(row.level2);
      console.log(`  查找二级分类 "${row.level2}":`, targetCategory?.id || '未找到');

      if (!targetCategory) {
        let level1Cat = level1Map.get(row.level1);
        console.log(`  查找一级分类 "${row.level1}":`, level1Cat?.id || '未找到');

        if (!level1Cat && row.level1) {
          // 检查数据库中是否已存在同名一级分类
          const existingLevel1 = categories.find(c => !c.parentId && c.name === row.level1);
          if (existingLevel1) {
            level1Cat = existingLevel1;
            level1Map.set(row.level1, level1Cat);
            console.log(`  ✅ 找到已有分类: ${row.level1}`);
          } else {
            // 自动创建缺失的一级分类
            const level1Id = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await db.categories.add({
              id: level1Id,
              name: row.level1,
              parentId: null,
              icon: null,
              color: '#64748b',
              sortOrder: 0,
            });
            level1Cat = { id: level1Id, name: row.level1, parentId: null, icon: null, color: '#64748b', sortOrder: 0 };
            level1Map.set(row.level1, level1Cat);
            console.log(`  ✅ 自动创建一级分类: ${level1Id}`);
          }
        }

        if (level1Cat) {
          // 先查内存 map 中的已有二级分类
          const cachedLevel2 = categoryMap.get(row.level2);
          if (cachedLevel2 && cachedLevel2.parentId === level1Cat.id) {
            targetCategory = cachedLevel2;
            console.log(`  ✅ 找到已有分类(内存): ${row.level1}/${row.level2}`);
          } else {
            // 检查数据库中是否已存在同名的二级分类
            const dbLevel2 = categories.find(c => c.parentId === level1Cat.id && c.name === row.level2);
            if (dbLevel2) {
              targetCategory = dbLevel2;
              categoryMap.set(row.level2, dbLevel2);
              console.log(`  ✅ 找到已有分类: ${row.level1}/${row.level2}`);
            } else {
              // 创建新的二级分类
              const newId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              await db.categories.add({
                id: newId,
                name: row.level2,
                parentId: level1Cat.id,
                icon: null,
                color: level1Cat.color,
                sortOrder: 0,
              });
              targetCategory = { ...level1Cat, id: newId, name: row.level2, parentId: level1Cat.id };
              categoryMap.set(row.level2, targetCategory);
              console.log(`  ✅ 创建新分类: ${newId}`);
            }
          }
        }
      }

      if (!targetCategory) {
        const errorMsg = row.level1 ? `无法找到分类: ${row.level1}/${row.level2}` : `缺少分类信息: ${row.level2}`;
        console.log(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        failed++;
        onProgress?.({ success, skipped, failed, total: parsed.length, current: i + 1 });
        continue;
      }

      // 解析日期 - 支持多种格式
      let isoDate: string;

      // 格式 1: 2026-08-10
      const match1 = row.date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (match1) {
        const [, year, month, day] = match1;
        isoDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
      }
      // 格式 2: 2026/08/10
      else {
        const match2 = row.date.match(/^(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})$/);
        if (match2) {
          const [, year, month, day] = match2;
          isoDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
        } else {
          const errorMsg = `日期格式错误: ${row.date}`;
          console.log(`  ❌ ${errorMsg}`);
          errors.push(errorMsg);
          failed++;
          onProgress?.({ success, skipped, failed, total: parsed.length, current: i + 1 });
          continue;
        }
      }

      console.log(`  ✅ 日期解析: ${isoDate}`);

      // 重复校验：categoryId + amount + 日期 + remark 完全相同则跳过
      const dedupKey = `${targetCategory.id}|${row.amount}|${isoDate}|${row.remark}`;
      if (seenKeys.has(dedupKey)) {
        console.log(`  ⏭️  重复记录，已跳过: ${row.amount} 元`);
        skipped++;
        onProgress?.({ success, skipped, failed, total: parsed.length, current: i + 1 });
        continue;
      }
      seenKeys.add(dedupKey);

      // 插入支出
      await db.expenses.add({
        id: crypto.randomUUID(),
        amount: row.amount,
        categoryId: targetCategory.id,
        remark: row.remark,
        createdAt: isoDate,
      });

      success++;
      console.log(`  ✅ 导入成功: ${row.amount} 元`);
      onProgress?.({ success, skipped, failed, total: parsed.length, current: i + 1 });
    } catch (err) {
      const errorMsg = `导入失败: ${err instanceof Error ? err.message : String(err)}`;
      console.log(`  ❌ ${errorMsg}`);
      errors.push(errorMsg);
      failed++;
      onProgress?.({ success, skipped, failed, total: parsed.length, current: i + 1 });
    }
  }

  console.log(`\n📊 导入完成: 成功 ${success} 条，跳过 ${skipped} 条，失败 ${failed} 条`);
  return { success, skipped, failed, errors };
}

/**
 * 从 JSON 文本导入数据（用于粘贴导入）
 */
export async function importFromJSONText(text: string, onProgress?: (progress: { current: number; total: number }) => void): Promise<{
  success: number;
  categories: number;
  expenses: number;
  errors: string[];
}> {
  try {
    const data = JSON.parse(text) as {
      version?: string;
      categories?: Category[];
      expenses?: Expense[];
      exportedAt?: string;
    };

    if (!data.categories || !data.expenses) {
      throw new Error('无效的备份格式：缺少 categories 或 expenses');
    }

    // 清空现有数据
    await db.expenses.clear();
    await db.categories.clear();

    // 导入分类
    await db.categories.bulkAdd(data.categories);

    // 导入支出（重复校验：相同 categoryId+amount+createdAt+remark 的只保留第一条）
    const seenKeys = new Set<string>();
    const dedupedExpenses: Expense[] = [];
    for (let j = 0; j < data.expenses.length; j++) {
      const e = data.expenses[j];
      const key = `${e.categoryId}|${e.amount}|${e.createdAt}|${e.remark}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      dedupedExpenses.push(e);
      onProgress?.({ current: j + 1, total: data.expenses.length });
    }

    await db.expenses.bulkAdd(dedupedExpenses);

    return {
      success: dedupedExpenses.length,
      categories: data.categories.length,
      expenses: dedupedExpenses.length,
      errors: [],
    };
  } catch (err) {
    return {
      success: 0,
      categories: 0,
      expenses: 0,
      errors: [err instanceof Error ? err.message : '解析失败'],
    };
  }
}

/**
 * 从 JSON 文件导入数据
 */
export async function importFromJSON(file: File, onProgress?: (progress: { current: number; total: number }) => void): Promise<{
  success: number;
  categories: number;
  expenses: number;
  errors: string[];
}> {
  const text = await file.text();
  return importFromJSONText(text, onProgress);
}

/**
 * 清空所有数据
 */
export async function clearAllData(): Promise<void> {
  await db.expenses.clear();
  await db.categories.clear();
}

/**
 * 只清空记账数据（保留分类）
 */
export async function clearExpensesOnly(): Promise<void> {
  await db.expenses.clear();
}
