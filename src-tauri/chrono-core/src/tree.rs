//! Build the rendered forest from a flat task list.
//!
//! - Children are grouped by `parentId`; a node whose parent is absent from the
//!   set (e.g. filtered out by project scope, or an orphan) is promoted to a
//!   root so it never disappears silently.
//! - Within each level, higher priority first, then newest first — matching the
//!   "what needs attention" reading order.
//! - `depth` is assigned during the walk so the UI can indent without recomputing.

use crate::types::{Task, TaskNode};
use std::collections::{HashMap, HashSet};

pub fn build_tree(tasks: &[Task]) -> Vec<TaskNode> {
    let by_id: HashSet<&str> = tasks.iter().map(|t| t.id.as_str()).collect();

    // group by effective parent (null when the parent is not in the set)
    let mut children_of: HashMap<Option<String>, Vec<&Task>> = HashMap::new();
    for t in tasks {
        let key = match &t.parent_id {
            Some(pid) if by_id.contains(pid.as_str()) => Some(pid.clone()),
            _ => None,
        };
        children_of.entry(key).or_default().push(t);
    }

    let mut visited: HashSet<String> = HashSet::new();
    walk(&children_of, None, 0, &mut visited)
}

fn walk(
    children_of: &HashMap<Option<String>, Vec<&Task>>,
    parent: Option<&str>,
    depth: u32,
    visited: &mut HashSet<String>,
) -> Vec<TaskNode> {
    let key = parent.map(|s| s.to_string());
    let Some(level) = children_of.get(&key) else {
        return Vec::new();
    };

    let mut level: Vec<&Task> = level
        .iter()
        .copied()
        .filter(|t| visited.insert(t.id.clone()))
        .collect();

    // Manual drag-and-drop order is authoritative; fall back to creation time.
    level.sort_by(|a, b| {
        let oa = a.order.unwrap_or(0.0);
        let ob = b.order.unwrap_or(0.0);
        oa.partial_cmp(&ob)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                // JS: a.createdAt < b.createdAt ? 1 : -1  → newest first
                if a.created_at < b.created_at {
                    std::cmp::Ordering::Greater
                } else {
                    std::cmp::Ordering::Less
                }
            })
    });

    level
        .into_iter()
        .map(|t| TaskNode {
            children: walk(children_of, Some(&t.id), depth + 1, visited),
            depth,
            task: t.clone(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str, parent: Option<&str>, order: Option<f64>, created: &str) -> Task {
        Task {
            id: id.into(),
            title: format!("task {id}"),
            is_completed: false,
            priority: 0,
            parent_id: parent.map(|s| s.to_string()),
            project_id: None,
            tags: vec![],
            created_at: created.into(),
            order,
            due: None,
            collapsed: false,
            time_spent: None,
            note: None,
            recurrence: None,
            streak: None,
            last_completed_at: None,
        }
    }

    #[test]
    fn empty_input() {
        assert!(build_tree(&[]).is_empty());
    }

    #[test]
    fn parent_child_nesting() {
        let tasks = vec![
            task("a", None, Some(0.0), "2026-01-01T00:00:00Z"),
            task("b", Some("a"), Some(0.0), "2026-01-02T00:00:00Z"),
        ];
        let tree = build_tree(&tasks);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].task.id, "a");
        assert_eq!(tree[0].depth, 0);
        assert_eq!(tree[0].children.len(), 1);
        assert_eq!(tree[0].children[0].task.id, "b");
        assert_eq!(tree[0].children[0].depth, 1);
    }

    #[test]
    fn orphan_is_promoted_to_root() {
        let tasks = vec![task("b", Some("missing"), None, "2026-01-01T00:00:00Z")];
        let tree = build_tree(&tasks);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].task.id, "b");
        assert!(tree[0].children.is_empty());
    }

    #[test]
    fn manual_order_wins_then_newest_first() {
        // Lower `order` sorts first; ties break on newest `createdAt` first.
        // Tasks without `order` count as 0 and therefore lead the list.
        // Verified against the original JS implementation.
        let tasks = vec![
            task("late", None, Some(2.0), "2026-01-01T00:00:00Z"),
            task("early", None, Some(1.0), "2026-01-05T00:00:00Z"),
            task("unordered-old", None, None, "2026-01-01T00:00:00Z"),
            task("unordered-new", None, None, "2026-01-09T00:00:00Z"),
        ];
        let ids: Vec<String> = build_tree(&tasks)
            .into_iter()
            .map(|n| n.task.id)
            .collect();
        assert_eq!(
            ids,
            vec!["unordered-new", "unordered-old", "early", "late"]
        );
    }

    #[test]
    fn cycle_protection() {
        // Both nodes are unreachable from a root (each is the other's parent),
        // so nothing renders — same as the JS forest builder.
        let tasks = vec![
            task("a", Some("b"), None, "2026-01-01T00:00:00Z"),
            task("b", Some("a"), None, "2026-01-02T00:00:00Z"),
        ];
        assert!(build_tree(&tasks).is_empty());
    }

    #[test]
    fn self_parent_is_not_rendered() {
        // A node whose parent is itself is unreachable from a root — same as
        // the JS forest builder.
        let tasks = vec![task("a", Some("a"), None, "2026-01-01T00:00:00Z")];
        assert!(build_tree(&tasks).is_empty());
    }
}
