use super::models::Category;
use super::db::DbPool;

// ─── Category commands ───────────────────────────────────────────────────────

/// 查询所有分类，按排序权重升序排列
///
/// # 返回
/// 完整的分类列表（含一级和二级分类）
#[tauri::command]
pub async fn list_categories(pool: tauri::State<'_, DbPool>) -> Result<Vec<Category>, String> {
    let pool = pool.lock().await;
    let categories: Vec<Category> = sqlx::query_as(
        "SELECT id, name, parent_id, icon, color, sort_order
         FROM categories
         ORDER BY sort_order ASC, parent_id ASC, name ASC"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(categories)
}

/// 添加新分类，自动生成 UUID
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `name`: 分类名称
/// - `parent_id`: 可选，父分类 ID（为 None 时表示一级分类）
/// - `icon`: 可选，图标名称（Lucide 图标名）
/// - `color`: 可选，分类颜色（十六进制）
///
/// # 返回
/// 插入后完整的分类数据
#[tauri::command]
pub async fn add_category(
    pool: tauri::State<'_, DbPool>,
    name: String,
    parent_id: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<Category, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let pool = pool.lock().await;

    sqlx::query(
        "INSERT INTO categories (id, name, parent_id, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, 0)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&parent_id)
    .bind(&icon)
    .bind(&color)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let category: Category = sqlx::query_as("SELECT id, name, parent_id, icon, color, sort_order FROM categories WHERE id = ?")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(category)
}

/// 更新分类的名称、图标和颜色
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 要更新的分类 ID
/// - `name`: 新的分类名称
/// - `icon`: 可选，新的图标名称
/// - `color`: 可选，新的颜色
///
/// # 返回
/// 更新后完整的分类数据
#[tauri::command]
pub async fn update_category(
    pool: tauri::State<'_, DbPool>,
    id: String,
    name: String,
    icon: Option<String>,
    color: Option<String>,
) -> Result<Category, String> {
    let pool = pool.lock().await;

    sqlx::query(
        "UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?"
    )
    .bind(&name)
    .bind(&icon)
    .bind(&color)
    .bind(&id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let category: Category = sqlx::query_as("SELECT id, name, parent_id, icon, color, sort_order FROM categories WHERE id = ?")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(category)
}

/// 删除指定分类（仅支持无关联支出记录的二级分类）
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 要删除的分类 ID
///
/// # 错误
/// - 如果删除的是一级分类，返回错误提示
/// - 如果该分类下仍有支出记录，返回错误提示
#[tauri::command]
pub async fn delete_category(pool: tauri::State<'_, DbPool>, id: String) -> Result<(), String> {
    let pool = pool.lock().await;

    // 检查是否为一级分类（parent_id IS NULL）
    let parent_id: Option<String> = sqlx::query_scalar("SELECT parent_id FROM categories WHERE id = ?")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if parent_id.is_none() {
        return Err("不能删除一级分类，请先删除其下的所有二级分类".to_string());
    }

    // 检查是否有关联的支出记录
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM expenses WHERE category_id = ?")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Err("该分类下仍有支出记录，请先删除相关支出后再删除分类".to_string());
    }

    sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
