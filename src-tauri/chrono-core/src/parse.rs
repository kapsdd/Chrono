//! Smart Input grammar (Phase 1):
//!
//! ```text
//! /Project   → exactly one project (last one wins if repeated)
//! #tag       → zero or more tags (deduplicated, order preserved)
//! ! !! !!!   → priority by run length, clamped to 3; bare "!" inside a word
//!              is left alone — only standalone bangs count
//! ```
//!
//! Tokens may appear anywhere in the line; whatever remains is the title.
//!
//! The project/tag patterns are plain regexes. The priority pattern needs a
//! lookahead (`(?=\s|$)`) that Rust's `regex` crate cannot express, so it is
//! hand-scanned with exactly the JS semantics.

use crate::types::{ParsedInput, Priority};
use regex::Regex;
use std::sync::OnceLock;

fn project_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?:^|\s)/([^\s#]+)").unwrap())
}

fn tag_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?:^|\s)#([^\s#]+)").unwrap())
}

fn whitespace_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\s+").unwrap())
}

/// JS `\s` — the set of characters the source grammar treats as separators.
fn is_js_space(c: char) -> bool {
    matches!(
        c,
        ' ' | '\t'
            | '\n'
            | '\r'
            | '\x0b'
            | '\x0c'
            | '\u{00a0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200a}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
            | '\u{feff}'
    )
}

struct BangRun {
    /// Byte offset of the leading separator (or of the first `!` at start).
    start: usize,
    /// Byte offset just past the last `!` of the run.
    end: usize,
    run_len: usize,
}

/// Emulate `/(?:^|\s)(!{1,})(?=\s|$)/g`.
///
/// A run of one or more `!` counts only when it is preceded by the start of
/// the line or a single whitespace char, and followed by whitespace or the end
/// of the line. The trailing separator is *not* part of the match (lookahead).
fn find_bang_runs(raw: &str) -> Vec<BangRun> {
    let mut runs = Vec::new();
    let chars: Vec<(usize, char)> = raw.char_indices().collect();
    let mut i = 0usize;

    while i < chars.len() {
        if chars[i].1 != '!' {
            i += 1;
            continue;
        }

        // Preceded by start-of-line or exactly one whitespace char.
        let (start, ok_prefix) = if i == 0 {
            (0usize, true)
        } else {
            let (prev_idx, prev) = chars[i - 1];
            (prev_idx, is_js_space(prev))
        };
        if !ok_prefix {
            i += 1;
            continue;
        }

        // Consume the whole run of '!'
        let mut j = i;
        while j < chars.len() && chars[j].1 == '!' {
            j += 1;
        }

        // Followed by whitespace or end-of-line.
        let ok_suffix = match chars.get(j) {
            None => true,
            Some((_, c)) => is_js_space(*c),
        };
        if !ok_suffix {
            i += 1;
            continue;
        }

        runs.push(BangRun {
            start,
            end: chars[j - 1].0 + '!'.len_utf8(),
            run_len: j - i,
        });
        i = j;
    }

    runs
}

pub fn parse_input(raw: &str) -> ParsedInput {
    let mut project: Option<String> = None;
    let mut tags: Vec<String> = Vec::new();

    for cap in project_re().captures_iter(raw) {
        project = Some(cap[1].to_string());
    }

    for cap in tag_re().captures_iter(raw) {
        let tag = cap[1].to_string();
        if !tags.contains(&tag) {
            tags.push(tag);
        }
    }

    let runs = find_bang_runs(raw);
    let priority = runs
        .iter()
        .map(|r| (r.run_len as Priority).min(3))
        .last()
        .unwrap_or(0);

    // Strip tokens the same way the JS pipeline does: each match (including a
    // single leading separator) collapses to one space, then whitespace folds.
    let mut stripped = raw.to_string();
    for run in runs.iter().rev() {
        stripped.replace_range(run.start..run.end, " ");
    }
    let stripped = project_re().replace_all(&stripped, " ");
    let stripped = tag_re().replace_all(&stripped, " ");
    let stripped = whitespace_re().replace_all(&stripped, " ");
    let title = stripped.trim().to_string();

    ParsedInput {
        title,
        project,
        tags,
        priority,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(raw: &str) -> ParsedInput {
        parse_input(raw)
    }

    #[test]
    fn plain_title() {
        let r = p("купить молоко");
        assert_eq!(r.title, "купить молоко");
        assert_eq!(r.project, None);
        assert!(r.tags.is_empty());
        assert_eq!(r.priority, 0);
    }

    #[test]
    fn project_last_wins() {
        let r = p("/Работа созвон /Личное");
        assert_eq!(r.project.as_deref(), Some("Личное"));
        assert_eq!(r.title, "созвон");
    }

    #[test]
    fn tags_dedup_preserve_order() {
        let r = p("#дом #срочно купить #дом хлеб");
        assert_eq!(r.tags, vec!["дом", "срочно"]);
        assert_eq!(r.title, "купить хлеб");
    }

    #[test]
    fn priority_run_length_clamped() {
        assert_eq!(p("задача !").priority, 1);
        assert_eq!(p("задача !!").priority, 2);
        assert_eq!(p("задача !!!").priority, 3);
        assert_eq!(p("задача !!!!").priority, 3);
    }

    #[test]
    fn embedded_bang_is_left_alone() {
        let r = p("восклицание! внутри слова");
        assert_eq!(r.priority, 0);
        assert_eq!(r.title, "восклицание! внутри слова");
    }

    #[test]
    fn bang_followed_by_word_is_left_alone() {
        let r = p("!!срочно сделать");
        assert_eq!(r.priority, 0);
        assert_eq!(r.title, "!!срочно сделать");
    }

    #[test]
    fn leading_bang_at_start_of_line() {
        let r = p("! сделать");
        assert_eq!(r.priority, 1);
        assert_eq!(r.title, "сделать");
    }

    #[test]
    fn trailing_bang_at_end_of_line() {
        let r = p("сделать !");
        assert_eq!(r.priority, 1);
        assert_eq!(r.title, "сделать");
    }

    #[test]
    fn mixed_tokens_anywhere() {
        let r = p("!!! /Проект сделать #важно дело");
        assert_eq!(r.priority, 3);
        assert_eq!(r.project.as_deref(), Some("Проект"));
        assert_eq!(r.tags, vec!["важно"]);
        assert_eq!(r.title, "сделать дело");
    }

    #[test]
    fn last_bang_run_wins() {
        let r = p("!! сделать ! !! !");
        assert_eq!(r.priority, 1);
        assert_eq!(r.title, "сделать");
    }

    #[test]
    fn empty_input() {
        let r = p("");
        assert_eq!(r.title, "");
        assert_eq!(r.project, None);
        assert_eq!(r.priority, 0);
    }

    #[test]
    fn project_token_hash_terminates_name() {
        // The `#` terminates the project name, but the tag is only *captured*
        // when `#` is preceded by the start of the line or whitespace — here it
        // follows `Проект`, so it lands in the title only. Verified against the
        // original JS implementation.
        let r = p("/Проект#тег заголовок");
        assert_eq!(r.project.as_deref(), Some("Проект"));
        assert!(r.tags.is_empty());
        assert_eq!(r.title, "заголовок");
    }

    #[test]
    fn parity_with_js_reference() {
        // Snapshot of the outputs the original JS grammar produces.
        let cases: &[(&str, &str, Option<&str>, &[&str], u8)] = &[
            ("", "", None, &[], 0),
            ("купить молоко", "купить молоко", None, &[], 0),
            ("/Работа созвон /Личное", "созвон", Some("Личное"), &[], 0),
            ("#дом #срочно купить #дом хлеб", "купить хлеб", None, &["дом", "срочно"], 0),
            ("задача !", "задача", None, &[], 1),
            ("задача !!", "задача", None, &[], 2),
            ("задача !!!", "задача", None, &[], 3),
            ("задача !!!!", "задача", None, &[], 3),
            ("восклицание! внутри слова", "восклицание! внутри слова", None, &[], 0),
            ("!!срочно сделать", "!!срочно сделать", None, &[], 0),
            ("! сделать", "сделать", None, &[], 1),
            ("сделать !", "сделать", None, &[], 1),
            ("!!! /Проект сделать #важно дело", "сделать дело", Some("Проект"), &["важно"], 3),
            ("!! сделать ! !! !", "сделать", None, &[], 1),
            ("задача с ёлкой !! конец", "задача с ёлкой конец", None, &[], 2),
            ("/Проект#тег заголовок", "заголовок", Some("Проект"), &[], 0),
        ];
        for (raw, title, project, tags, priority) in cases {
            let r = parse_input(raw);
            assert_eq!(&r.title, title, "title for {raw:?}");
            assert_eq!(r.project.as_deref(), *project, "project for {raw:?}");
            assert_eq!(r.tags, *tags, "tags for {raw:?}");
            assert_eq!(r.priority, *priority, "priority for {raw:?}");
        }
    }

    #[test]
    fn utf8_offsets_are_not_trampled() {
        let r = p("задача с ёлкой !! конец");
        assert_eq!(r.priority, 2);
        assert_eq!(r.title, "задача с ёлкой конец");
    }
}
