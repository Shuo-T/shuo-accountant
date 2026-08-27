use super::models::{Expense, StatsCategory, StatsDaily};
use super::db::DbPool;

// ─── 安全校验工具 ─────────────────────────────────────────────────────────────

/// 校验 UUID 格式（8-4-4-4-12 十六进制），防止 SQL 注入
fn is_valid_uuid(uuid: &str) -> bool {
    let bytes = uuid.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    // 校验格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    bytes[8] == b'-' && bytes[13] == b'-' && bytes[18] == b'-' && bytes[23] == b'-'
        && bytes.iter().enumerate().all(|(i, &b)| {
            if i == 8 || i == 13 || i == 18 || i == 23 {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}

/// 校验日期格式是否为 YYYY-MM-DD，防止非法字符注入
fn is_valid_date(date: &str) -> bool {
    if date.len() != 10 {
        return false;
    }
    let bytes = date.as_bytes();
    bytes[4] == b'-' && bytes[7] == b'-'
        && bytes[0..4].iter().all(|&b| b.is_ascii_digit())
        && bytes[5..7].iter().all(|&b| b.is_ascii_digit())
        && bytes[8..10].iter().all(|&b| b.is_ascii_digit())
}

// ─── Expense commands ────────────────────────────────────────────────────────

/// 查询支出记录列表，支持按分类、日期范围过滤
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `category_id`: 可选，按分类 ID 过滤
/// - `start_date`: 可选，开始日期（YYYY-MM-DD）
/// - `end_date`: 可选，结束日期（YYYY-MM-DD）
///
/// # 返回
/// 按创建时间倒序排列的支出记录列表，包含关联的分类信息
#[tauri::command]
pub async fn list_expenses(
    pool: tauri::State<'_, DbPool>,
    category_id: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<Expense>, String> {
    let pool = pool.lock().await;

    // 安全校验参数
    if let Some(ref cid) = category_id {
        if !is_valid_uuid(cid) {
            return Err("无效的分类 ID 格式".to_string());
        }
    }
    if let Some(ref sd) = start_date {
        if !is_valid_date(sd) {
            return Err("无效的开始日期格式".to_string());
        }
    }
    if let Some(ref ed) = end_date {
        if !is_valid_date(ed) {
            return Err("无效的结束日期格式".to_string());
        }
    }

    // 参数已校验，使用安全字符串格式化构建查询
    let sql = format!(
        r#"
        SELECT
            e.id, e.amount, e.category_id, e.remark,
            e.created_at, e.updated_at,
            c.name AS category_name,
            c.icon AS category_icon,
            c.color AS category_color
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE 1=1
        {}
        ORDER BY e.created_at DESC
        "#,
        build_where_clause(&category_id, &start_date, &end_date)
    );

    let expenses: Vec<Expense> = sqlx::query_as::<_, Expense>(&sql)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(expenses)
}

/// 添加一条新的支出记录
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `amount`: 支出金额（必须 > 0）
/// - `category_id`: 分类 ID
/// - `remark`: 备注（可为空）
///
/// # 返回
/// 插入后完整的支出记录（含关联分类信息）
#[tauri::command]
pub async fn add_expense(
    pool: tauri::State<'_, DbPool>,
    amount: f64,
    category_id: String,
    remark: String,
) -> Result<Expense, String> {
    // 校验分类 ID 格式
    if !is_valid_uuid(&category_id) {
        return Err("无效的分类 ID 格式".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let pool = pool.lock().await;

    sqlx::query(
        "INSERT INTO expenses (id, amount, category_id, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(amount)
    .bind(&category_id)
    .bind(&remark)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let expense: Expense = sqlx::query_as(
        r#"
        SELECT e.id, e.amount, e.category_id, e.remark,
               e.created_at, e.updated_at,
               c.name AS category_name,
               c.icon AS category_icon,
               c.color AS category_color
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE e.id = ?
        "#,
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(expense)
}

/// 更新支出记录的信息（金额、分类、备注）
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 要更新的支出记录 ID
/// - `amount`: 新的金额
/// - `category_id`: 新的分类 ID
/// - `remark`: 新的备注
///
/// # 返回
/// 更新后完整的支出记录
#[tauri::command]
pub async fn update_expense(
    pool: tauri::State<'_, DbPool>,
    id: String,
    amount: f64,
    category_id: String,
    remark: String,
) -> Result<Expense, String> {
    // 校验 ID 格式
    if !is_valid_uuid(&id) {
        return Err("无效的支出记录 ID 格式".to_string());
    }
    if !is_valid_uuid(&category_id) {
        return Err("无效的分类 ID 格式".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let pool = pool.lock().await;

    sqlx::query(
        "UPDATE expenses SET amount=?, category_id=?, remark=?, updated_at=? WHERE id=?"
    )
    .bind(&amount)
    .bind(&category_id)
    .bind(&remark)
    .bind(&now)
    .bind(&id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let expense: Expense = sqlx::query_as(
        r#"
        SELECT e.id, e.amount, e.category_id, e.remark,
               e.created_at, e.updated_at,
               c.name AS category_name,
               c.icon AS category_icon,
               c.color AS category_color
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE e.id = ?
        "#,
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(expense)
}

/// 删除指定的支出记录
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 要删除的支出记录 ID
#[tauri::command]
pub async fn delete_expense(pool: tauri::State<'_, DbPool>, id: String) -> Result<(), String> {
    if !is_valid_uuid(&id) {
        return Err("无效的支出记录 ID 格式".to_string());
    }
    let pool = pool.lock().await;
    sqlx::query("DELETE FROM expenses WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Stats commands ──────────────────────────────────────────────────────────

/// 查询每日支出统计（按日期汇总）
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `start_date`: 可选，开始日期
/// - `end_date`: 可选，结束日期
///
/// # 返回
/// 按日期升序排列的每日汇总数据
#[tauri::command]
pub async fn get_daily_stats(
    pool: tauri::State<'_, DbPool>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<StatsDaily>, String> {
    let pool = pool.lock().await;

    // 校验日期格式
    if let Some(ref sd) = start_date {
        if !is_valid_date(sd) {
            return Err("无效的开始日期格式".to_string());
        }
    }
    if let Some(ref ed) = end_date {
        if !is_valid_date(ed) {
            return Err("无效的结束日期格式".to_string());
        }
    }

    let sql = format!(
        r#"
        SELECT date(created_at, 'localtime') AS date, SUM(amount) AS total
        FROM expenses
        WHERE 1=1
        {}
        GROUP BY date
        ORDER BY date ASC
        "#,
        build_date_where_clause(&start_date, &end_date)
    );

    let stats: Vec<StatsDaily> = sqlx::query_as::<_, StatsDaily>(&sql)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(stats)
}

/// 查询各分类的支出统计汇总
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `start_date`: 可选，开始日期
/// - `end_date`: 可选，结束日期
///
/// # 返回
/// 按总金额降序排列的分类统计列表
#[tauri::command]
pub async fn get_category_stats(
    pool: tauri::State<'_, DbPool>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<StatsCategory>, String> {
    let pool = pool.lock().await;

    // 校验日期格式
    if let Some(ref sd) = start_date {
        if !is_valid_date(sd) {
            return Err("无效的开始日期格式".to_string());
        }
    }
    if let Some(ref ed) = end_date {
        if !is_valid_date(ed) {
            return Err("无效的结束日期格式".to_string());
        }
    }

    let sql = format!(
        r#"
        SELECT c.name, SUM(e.amount) AS total, c.color
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE 1=1
        {}
        GROUP BY c.id
        ORDER BY total DESC
        "#,
        build_date_where_clause(&start_date, &end_date)
    );

    let stats: Vec<StatsCategory> = sqlx::query_as::<_, StatsCategory>(&sql)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(stats)
}

/// 查询总支出金额和记录条数
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `_start_date`: 预留参数，当前未使用
/// - `_end_date`: 预留参数，当前未使用
///
/// # 返回
/// JSON 对象，包含 `total`（总金额）和 `count`（记录条数）
#[tauri::command]
pub async fn get_summary(
    pool: tauri::State<'_, DbPool>,
    _start_date: Option<String>,
    _end_date: Option<String>,
) -> Result<serde_json::Value, String> {
    let pool = pool.lock().await;

    let total: f64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(amount), 0) FROM expenses"#,
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM expenses"#,
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "total": total, "count": count }))
}

/// 构建支出查询的 WHERE 子句（支持分类和日期范围过滤）
///
/// 所有参数必须经过 `is_valid_uuid` / `is_valid_date` 校验后才传入此函数。
/// 校验在调用方（命令函数）中完成，此处不做重复校验以保持代码简洁。
fn build_where_clause(
    category_id: &Option<String>,
    start_date: &Option<String>,
    end_date: &Option<String>,
) -> String {
    let mut clauses: Vec<String> = Vec::new();

    if let Some(cid) = category_id {
        clauses.push(format!("e.category_id = '{}'", cid));
    }
    if let Some(sd) = start_date {
        clauses.push(format!("date(e.created_at) >= '{}'", sd));
    }
    if let Some(ed) = end_date {
        clauses.push(format!("date(e.created_at) <= '{}'", ed));
    }

    if clauses.is_empty() {
        String::new()
    } else {
        format!("AND {}", clauses.join(" AND "))
    }
}

/// 构建统计查询的 WHERE 子句（仅支持日期范围过滤）
///
/// 所有参数必须经过 `is_valid_date` 校验后才传入此函数。
fn build_date_where_clause(start_date: &Option<String>, end_date: &Option<String>) -> String {
    let mut clauses: Vec<String> = Vec::new();

    if let Some(sd) = start_date {
        clauses.push(format!("date(created_at) >= '{}'", sd));
    }
    if let Some(ed) = end_date {
        clauses.push(format!("date(created_at) <= '{}'", ed));
    }

    if clauses.is_empty() {
        String::new()
    } else {
        format!("AND {}", clauses.join(" AND "))
    }
}
