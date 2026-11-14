use serde::{Deserialize, Serialize};

pub type Priority = u8;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub is_completed: bool,
    #[serde(default)]
    pub priority: Priority,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: String,
    #[serde(default)]
    pub order: Option<f64>,
    #[serde(default)]
    pub due: Option<String>,
    #[serde(default)]
    pub collapsed: bool,
    #[serde(default)]
    pub time_spent: Option<f64>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub recurrence: Option<String>,
    #[serde(default)]
    pub streak: Option<f64>,
    #[serde(default)]
    pub last_completed_at: Option<String>,
}

/// A task with its children resolved plus `depth` — the shape the tree renders.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaskNode {
    #[serde(flatten)]
    pub task: Task,
    pub children: Vec<TaskNode>,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KanbanColumn {
    pub priority: Priority,
    pub label: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedInput {
    pub title: String,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub priority: Priority,
}
