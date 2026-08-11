// 朔记 - 快速测试数据生成器
// 在浏览器控制台运行此代码

(async function insertTestData() {
  try {
    const db = new Dexie('ShuoAccountantDB');
    await db.open();

    const existingCount = await db.expenses.count();
    if (existingCount > 0) {
      console.log('已有 ' + existingCount + ' 条记录，如需清空请先执行: db.expenses.clear()');
      return;
    }

    const categories = await db.categories.toArray();
    const subCategories = categories.filter(c => c.parentId !== null);

    const testData = [
      { amount: 25.5, subId: 'sub-lunch', remark: '公司食堂' },
      { amount: 12.0, subId: 'sub-bus', remark: '上班公交' },
      { amount: 45.0, subId: 'sub-dinner', remark: '和朋友吃饭' },
      { amount: 8.0, subId: 'sub-phone', remark: '话费充值' },
      { amount: 35.0, subId: 'sub-snack', remark: '奶茶+蛋糕' },
      { amount: 18.0, subId: 'sub-breakfast', remark: '早餐' },
      { amount: 68.0, subId: 'sub-clothing', remark: 'T恤' },
      { amount: 22.0, subId: 'sub-subway', remark: '通勤' },
      { amount: 15.0, subId: 'sub-movie', remark: '电影票' },
      { amount: 5.0, subId: 'sub-internet', remark: '宽带续费' },
      { amount: 280.0, subId: 'sub-rent', remark: '房租' },
      { amount: 156.0, subId: 'sub-electronics', remark: '蓝牙耳机' },
      { amount: 88.0, subId: 'sub-book', remark: '《三体》套装' },
      { amount: 45.0, subId: 'sub-utility', remark: '电费' },
      { amount: 30.0, subId: 'sub-taxi', remark: '打车回家' },
      { amount: 120.0, subId: 'sub-course', remark: '在线课程' },
      { amount: 65.0, subId: 'sub-game', remark: '游戏充值' },
      { amount: 200.0, subId: 'sub-medicine', remark: '感冒药' },
      { amount: 99.0, subId: 'sub-travel', remark: '景点门票' },
      { amount: 15.0, subId: 'sub-daily', remark: '抽纸' },
      { amount: 56.0, subId: 'sub-taxi', remark: '打车' },
      { amount: 38.0, subId: 'sub-bike', remark: '共享单车月卡' },
      { amount: 75.0, subId: 'sub-daily', remark: '洗衣液' },
      { amount: 128.0, subId: 'sub-clothing', remark: '鞋子' },
      { amount: 25.0, subId: 'sub-checkup', remark: '体检' },
    ];

    const now = new Date();
    const expenses = testData.map((item, index) => {
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(index / 4));
      date.setHours(7 + Math.floor(Math.random() * 16), Math.floor(Math.random() * 60));
      const subCat = subCategories.find(c => c.id === item.subId);
      return {
        amount: item.amount,
        categoryId: item.subId,
        remark: item.remark,
        createdAt: date.toISOString(),
      };
    });

    await db.expenses.bulkAdd(expenses);
    console.log('✅ 测试数据插入成功！共 ' + expenses.length + ' 条记录');
    console.log('刷新页面查看数据');
  } catch (err) {
    console.error('插入失败:', err);
  }
})();
