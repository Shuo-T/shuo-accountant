use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 分类数据模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
}

/// 支出数据模型（带 JOIN 分类信息）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Expense {
    pub id: String,
    pub amount: f64,
    pub category_id: String,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
    pub category_name: String,
    pub category_icon: Option<String>,
    pub category_color: Option<String>,
}

/// 每日统计数据
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatsDaily {
    pub date: String,
    pub total: f64,
}

/// 分类统计数据
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatsCategory {
    pub name: String,
    pub total: f64,
    pub color: Option<String>,
}
