use sqlx::{Executor, SqliteConnectOptions, SqlitePool};
use std::path::PathBuf;

/// 全局 SQLite 连接池（线程安全）
pub type DbPool = tokio::sync::Mutex<SqlitePool>;

/// 获取数据库文件路径（跨平台兼容）
fn get_db_path() -> PathBuf {
    // 使用应用数据目录（Android、桌面端都兼容）
    let base_dir = if let Some(dir) = dirs::data_local_dir() {
        // Windows: C:\Users\xxx\AppData\Local
        // macOS: ~/Library/Application Support
        // Linux: ~/.local/share
        dir
    } else {
        // 回退到当前目录（开发调试用）
        std::env::current_dir().unwrap_or_default()
    };

    let app_dir = base_dir.join("heima-accountant");
    std::fs::create_dir_all(&app_dir).expect("创建数据目录失败");
    app_dir.join("app.db")
}

/// 初始化数据库连接池，并执行所有迁移
pub async fn init_pool() -> DbPool {
    let path = get_db_path();
    eprintln!("Database path: {}", path.display());

    let connect_options = SqliteConnectOptions::new()
        .filename(path)
        .foreign_keys(true);

    let pool = SqlitePool::connect_with(connect_options)
        .await
        .expect("无法连接数据库");

    // 执行迁移
    migrate(&pool).await;

    tokio::sync::Mutex::new(pool)
}

/// 运行所有迁移 SQL
async fn migrate(pool: &SqlitePool) {
    // 创建 categories 表
    pool.execute(
        "CREATE TABLE IF NOT EXISTS categories (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            parent_id   TEXT,
            icon        TEXT,
            color       TEXT,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
        )",
    )
    .await
    .expect("创建 categories 表失败");

    // 创建 expenses 表
    pool.execute(
        "CREATE TABLE IF NOT EXISTS expenses (
            id          TEXT PRIMARY KEY,
            amount      REAL NOT NULL CHECK(amount > 0),
            category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            remark      TEXT DEFAULT '',
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .await
    .expect("创建 expenses 表失败");

    // 创建索引
    pool.execute("CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id)")
        .await
        .expect("创建索引失败");
    pool.execute("CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at)")
        .await
        .expect("创建索引失败");

    // 种子数据
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM categories WHERE parent_id IS NULL")
        .fetch_one(pool)
        .await
        .expect("查询分类数量失败");

    if count == 0 {
        seed_categories(pool).await;
    }
}

/// 插入预置的分类种子数据
async fn seed_categories(pool: &SqlitePool) {
    // 一级分类
    let level1: &[(&str, &str, &str)] = &[
        ("餐饮", "UtensilsCrossed", "#ef4444"),
        ("交通", "Car", "#3b82f6"),
        ("购物", "ShoppingBag", "#8b5cf6"),
        ("住房", "Home", "#f59e0b"),
        ("娱乐", "Film", "#ec4899"),
        ("医疗", "HeartPulse", "#10b981"),
        ("教育", "GraduationCap", "#06b6d4"),
        ("通讯", "Smartphone", "#6366f1"),
        ("其他", "MoreHorizontal", "#64748b"),
    ];

    let mut level1_ids: Vec<(String, String)> = Vec::new();

    for (name, icon, color) in level1.iter() {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO categories (id, name, parent_id, icon, color, sort_order) VALUES (?, NULL, ?, ?, 0)")
            .bind(&id)
            .bind(name)
            .bind(icon)
            .bind(color)
            .execute(pool)
            .await
            .expect("插入一级分类失败");
        level1_ids.push((id.clone(), name.to_string()));
    }

    // 二级分类
    let level2: &[(&str, &str)] = &[
        ("早餐", "餐饮"),
        ("午餐", "餐饮"),
        ("晚餐", "餐饮"),
        ("零食", "餐饮"),
        ("公交", "交通"),
        ("地铁", "交通"),
        ("打车", "交通"),
        ("共享单车", "交通"),
        ("服装", "购物"),
        ("数码", "购物"),
        ("日用品", "购物"),
        ("房租", "住房"),
        ("水电", "住房"),
        ("物业", "住房"),
        ("电影", "娱乐"),
        ("游戏", "娱乐"),
        ("旅行", "娱乐"),
        ("药品", "医疗"),
        ("挂号", "医疗"),
        ("检查", "医疗"),
        ("课程", "教育"),
        ("书籍", "教育"),
        ("考试", "教育"),
        ("话费", "通讯"),
        ("网费", "通讯"),
        ("misc", "其他"),
    ];

    for (name, parent_name) in level2.iter() {
        let parent_id = level1_ids
            .iter()
            .find(|(_, n)| n == parent_name)
            .map(|(id, _)| id.as_str())
            .unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO categories (id, name, parent_id, icon, color, sort_order) VALUES (?, ?, ?, NULL, NULL, 0)")
            .bind(&id)
            .bind(name)
            .bind(parent_id)
            .execute(pool)
            .await
            .expect("插入二级分类失败");
    }
}
