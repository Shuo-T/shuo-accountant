use super::models::Category;
use super::db::DbPool;

// ─── Category commands ───────────────────────────────────────────────────────

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
