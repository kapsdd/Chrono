//! CHRONO core domain logic.
//!
//! Canonical Rust implementation of the smart-input grammar, task forest
//! building, kanban column normalization, iCalendar export and password
//! hashing. Exposed to the frontend through the Tauri commands in the app
//! crate.

pub mod crypto;
pub mod ics;
pub mod kanban;
pub mod parse;
pub mod tree;
pub mod types;

pub use crypto::{hash_password, verify_password};
pub use ics::{build_ics, build_ics_at};
pub use kanban::{normalize_kanban_columns, DEFAULT_KANBAN_COLORS, DEFAULT_KANBAN_LABELS};
pub use parse::parse_input;
pub use tree::build_tree;
pub use types::{KanbanColumn, ParsedInput, Priority, Task, TaskNode};
