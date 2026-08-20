mod db;
mod models;
mod categories;
mod expenses;

use db::init_pool;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 使用 tokio runtime 来初始化数据库
            let rt = match tokio::runtime::Runtime::new() {
                Ok(rt) => rt,
                Err(e) => {
                    eprintln!("Failed to create tokio runtime: {}", e);
                    return Err(Box::new(e));
                }
            };
            let pool = match rt.block_on(init_pool()) {
                Ok(pool) => pool,
                Err(e) => {
                    eprintln!("Failed to initialize database: {}", e);
                    return Err(Box::new(e));
                }
            };
            app.manage(pool);
            // 保持 runtime 存活
            app.manage(rt);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 分类
            categories::list_categories,
            categories::add_category,
            categories::update_category,
            categories::delete_category,
            // 支出
            expenses::list_expenses,
            expenses::add_expense,
            expenses::update_expense,
            expenses::delete_expense,
            // 统计
            expenses::get_daily_stats,
            expenses::get_category_stats,
            expenses::get_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
