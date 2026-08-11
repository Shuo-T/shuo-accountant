const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 创建临时 HTML 文件用于插入测试数据
const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>插入测试数据</title></head>
<body>
<script src="https://unpkg.com/dexie@3/dist/dexie.min.js"></script>
<script>
(async () => {
  const db = new Dexie('HeiMaAccountantDB');
  await db.open();

  // 检查是否已有数据
  const count = await db.expenses.count();
  if (count > 0) {
    console.log('已有数据，跳过');
    document.body.innerHTML = '<h1>已有 ' + count + ' 条记录</h1>';
    return;
  }

  // 插入测试分类（如果不存在）
  const categories = [
    { id: 'cat-dining', name: '餐饮', parentId: null, icon: 'UtensilsCrossed', color: '#ef4444', sortOrder: 0 },
    { id: 'cat-transport', name: '交通', parentId: null, icon: 'Car', color: '#3b82f6', sortOrder: 1 },
    { id: 'cat-shopping', name: '购物', parentId: null, icon: 'ShoppingBag', color: '#8b5cf6', sortOrder: 2 },
    { id: 'cat-housing', name: '住房', parentId: null, icon: 'Home', color: '#f59e0b', sortOrder: 3 },
    { id: 'cat-entertainment', name: '娱乐', parentId: null, icon: 'Film', color: '#ec4899', sortOrder: 4 },
    { id: 'cat-medical', name: '医疗', parentId: null, icon: 'HeartPulse', color: '#10b981', sortOrder: 5 },
    { id: 'cat-education', name: '教育', parentId: null, icon: 'GraduationCap', color: '#06b6d4', sortOrder: 6 },
    { id: 'cat-communication', name: '通讯', parentId: null, icon: 'Smartphone', color: '#6366f1', sortOrder: 7 },
    { id: 'cat-other', name: '其他', parentId: null, icon: 'MoreHorizontal', color: '#64748b', sortOrder: 8 },
    { id: 'sub-lunch', name: '午餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 1 },
    { id: 'sub-dinner', name: '晚餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 2 },
    { id: 'sub-breakfast', name: '早餐', parentId: 'cat-dining', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-snack', name: '零食', parentId: 'cat-dining', icon: null, color: null, sortOrder: 3 },
    { id: 'sub-bus', name: '公交', parentId: 'cat-transport', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-subway', name: '地铁', parentId: 'cat-transport', icon: null, color: null, sortOrder: 1 },
    { id: 'sub-taxi', name: '打车', parentId: 'cat-transport', icon: null, color: null, sortOrder: 2 },
    { id: 'sub-bike', name: '共享单车', parentId: 'cat-transport', icon: null, color: null, sortOrder: 3 },
    { id: 'sub-clothing', name: '服装', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-electronics', name: '数码', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 1 },
    { id: 'sub-daily', name: '日用品', parentId: 'cat-shopping', icon: null, color: null, sortOrder: 2 },
    { id: 'sub-rent', name: '房租', parentId: 'cat-housing', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-utility', name: '水电', parentId: 'cat-housing', icon: null, color: null, sortOrder: 1 },
    { id: 'sub-movie', name: '电影', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-game', name: '游戏', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 1 },
    { id: 'sub-travel', name: '旅行', parentId: 'cat-entertainment', icon: null, color: null, sortOrder: 2 },
    { id: 'sub-medicine', name: '药品', parentId: 'cat-medical', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-checkup', name: '检查', parentId: 'cat-medical', icon: null, color: null, sortOrder: 2 },
    { id: 'sub-course', name: '课程', parentId: 'cat-education', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-book', name: '书籍', parentId: 'cat-education', icon: null, color: null, sortOrder: 1 },
    { id: 'sub-phone', name: '话费', parentId: 'cat-communication', icon: null, color: null, sortOrder: 0 },
    { id: 'sub-internet', name: '网费', parentId: 'cat-communication', icon: null, color: null, sortOrder: 1 },
  ];

  await db.categories.bulkPut(categories);
  console.log('分类已就绪');

  // 插入测试支出数据
  const now = new Date();
  const testData = [
    { amount: 25.5, categoryId: 'sub-lunch', remark: '公司食堂', daysAgo: 0 },
    { amount: 12.0, categoryId: 'sub-bus', remark: '上班公交', daysAgo: 0 },
    { amount: 45.0, categoryId: 'sub-dinner', remark: '和朋友吃饭', daysAgo: 0 },
    { amount: 8.0, categoryId: 'sub-phone', remark: '话费充值', daysAgo: 1 },
    { amount: 35.0, categoryId: 'sub-snack', remark: '奶茶+蛋糕', daysAgo: 1 },
    { amount: 18.0, categoryId: 'sub-breakfast', remark: '早餐', daysAgo: 1 },
    { amount: 68.0, categoryId: 'sub-clothing', remark: 'T恤', daysAgo: 2 },
    { amount: 22.0, categoryId: 'sub-subway', remark: '通勤', daysAgo: 2 },
    { amount: 15.0, categoryId: 'sub-movie', remark: '电影票', daysAgo: 2 },
    { amount: 5.0, categoryId: 'sub-internet', remark: '宽带续费', daysAgo: 3 },
    { amount: 280.0, categoryId: 'sub-rent', remark: '房租', daysAgo: 3 },
    { amount: 156.0, categoryId: 'sub-electronics', remark: '蓝牙耳机', daysAgo: 4 },
    { amount: 88.0, categoryId: 'sub-book', remark: '《三体》套装', daysAgo: 4 },
    { amount: 45.0, categoryId: 'sub-utility', remark: '电费', daysAgo: 5 },
    { amount: 30.0, categoryId: 'sub-taxi', remark: '打车回家', daysAgo: 5 },
    { amount: 120.0, categoryId: 'sub-course', remark: '在线课程', daysAgo: 6 },
    { amount: 65.0, categoryId: 'sub-game', remark: '游戏充值', daysAgo: 6 },
    { amount: 200.0, categoryId: 'sub-medicine', remark: '感冒药', daysAgo: 7 },
    { amount: 99.0, categoryId: 'sub-travel', remark: '景点门票', daysAgo: 7 },
    { amount: 15.0, categoryId: 'sub-daily', remark: '抽纸', daysAgo: 8 },
    { amount: 56.0, categoryId: 'sub-taxi', remark: '打车', daysAgo: 8 },
    { amount: 38.0, categoryId: 'sub-bike', remark: '共享单车月卡', daysAgo: 9 },
    { amount: 75.0, categoryId: 'sub-daily', remark: '洗衣液', daysAgo: 9 },
    { amount: 128.0, categoryId: 'sub-clothing', remark: '鞋子', daysAgo: 10 },
    { amount: 25.0, categoryId: 'sub-checkup', remark: '体检', daysAgo: 10 },
  ];

  const expenses = testData.map(item => {
    const date = new Date(now);
    date.setDate(date.getDate() - item.daysAgo);
    date.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
    return {
      ...item,
      id: crypto.randomUUID(),
      createdAt: date.toISOString(),
      categoryName: '',
      categoryIcon: null,
      categoryColor: '#64748b'
    };
  });

  await db.expenses.bulkAdd(expenses);
  console.log('✅ 测试数据插入成功！共 ' + expenses.length + ' 条记录');
  document.body.innerHTML = '<h1 style="text-align:center;margin-top:50px;">✅ 测试数据插入成功！<br>共 ' + expenses.length + ' 条记录</h1><p style="text-align:center;"><a href="http://localhost:1420">返回应用</a></p>';
})();
</script>
</body>
</html>
`;

// 保存 HTML 文件
const htmlPath = path.join(__dirname, 'public', 'insert-test-data.html');
fs.writeFileSync(htmlPath, htmlContent);
console.log('✅ 测试数据页面已创建: public/insert-test-data.html');
console.log('请在浏览器中打开: http://localhost:1420/insert-test-data.html');
