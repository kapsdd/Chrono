//! Kanban column settings. Columns still map to task priority for compatibility.

use crate::types::{KanbanColumn, Priority};
use regex::Regex;
use std::sync::OnceLock;

/// Priority order the board renders, most urgent first.
pub const PRIORITIES: [Priority; 4] = [3, 2, 1, 0];

pub const DEFAULT_KANBAN_LABELS: [&str; 4] = ["Срочно", "Высокий", "Средний", "Без приоритета"];
pub const DEFAULT_KANBAN_COLORS: [&str; 4] = ["#fb7185", "#f59e0b", "#a78bfa", "#64748b"];

fn hex6_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)^#[0-9a-f]{6}$").unwrap())
}

fn default_column(priority: Priority) -> KanbanColumn {
    let idx = PRIORITIES
        .iter()
        .position(|&p| p == priority)
        .unwrap_or(3);
    KanbanColumn {
        priority,
        label: DEFAULT_KANBAN_LABELS[idx].to_string(),
        color: DEFAULT_KANBAN_COLORS[idx].to_string(),
    }
}

pub fn normalize_kanban_columns(columns: Option<&[KanbanColumn]>) -> Vec<KanbanColumn> {
    PRIORITIES
        .iter()
        .map(|&priority| {
            let fallback = default_column(priority);
            let saved = columns.and_then(|cols| cols.iter().find(|c| c.priority == priority));

            let label = saved
                .map(|c| c.label.trim().to_string())
                .filter(|l| !l.is_empty())
                .unwrap_or(fallback.label);

            let color = saved
                .map(|c| c.color.as_str())
                .filter(|c| hex6_re().is_match(c))
                .map(|c| c.to_string())
                .unwrap_or(fallback.color);

            KanbanColumn {
                priority,
                label,
                color,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_when_absent() {
        let cols = normalize_kanban_columns(None);
        assert_eq!(cols.len(), 4);
        assert_eq!(cols[0].priority, 3);
        assert_eq!(cols[0].label, "Срочно");
        assert_eq!(cols[0].color, "#fb7185");
        assert_eq!(cols[3].priority, 0);
        assert_eq!(cols[3].label, "Без приоритета");
    }

    #[test]
    fn custom_label_and_color_win() {
        let saved = vec![KanbanColumn {
            priority: 2,
            label: "  Мой  ".into(),
            color: "#123abc".into(),
        }];
        let cols = normalize_kanban_columns(Some(&saved));
        assert_eq!(cols[1].priority, 2);
        assert_eq!(cols[1].label, "Мой");
        assert_eq!(cols[1].color, "#123abc");
    }

    #[test]
    fn invalid_color_and_blank_label_fall_back() {
        let saved = vec![KanbanColumn {
            priority: 1,
            label: "   ".into(),
            color: "red".into(),
        }];
        let cols = normalize_kanban_columns(Some(&saved));
        assert_eq!(cols[2].label, "Средний");
        assert_eq!(cols[2].color, "#a78bfa");
    }

    #[test]
    fn unknown_priorities_are_ignored() {
        let saved = vec![KanbanColumn {
            priority: 9,
            label: "Чужой".into(),
            color: "#ffffff".into(),
        }];
        let cols = normalize_kanban_columns(Some(&saved));
        assert_eq!(cols.len(), 4);
        assert!(cols.iter().all(|c| c.priority <= 3));
    }
}
