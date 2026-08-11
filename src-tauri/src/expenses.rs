use super::models::{Expense, StatsCategory, StatsDaily};
use super::db::DbPool;

// ─── Expense commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_expenses(
    pool: tauri::State<'_, DbPool>,
    category_id: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<Expense>, String> {
    let pool = pool.lock().await;

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

#[tauri::command]
pub async fn add_expense(
    pool: tauri::State<'_, DbPool>,
    amount: f64,
    category_id: String,
    remark: String,
) -> Result<Expense, String> {
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

#[tauri::command]
pub async fn update_expense(
    pool: tauri::State<'_, DbPool>,
    id: String,
    amount: f64,
    category_id: String,
    remark: String,
) -> Result<Expense, String> {
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

#[tauri::command]
pub async fn delete_expense(pool: tauri::State<'_, DbPool>, id: String) -> Result<(), String> {
    let pool = pool.lock().await;
    sqlx::query("DELETE FROM expenses WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Stats commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_daily_stats(
    pool: tauri::State<'_, DbPool>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<StatsDaily>, String> {
    let pool = pool.lock().await;

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

#[tauri::command]
pub async fn get_category_stats(
    pool: tauri::State<'_, DbPool>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<StatsCategory>, String> {
    let pool = pool.lock().await;

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

/// 构建支出查询的 WHERE 子句
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

/// 构建统计查询的 WHERE 子句
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
