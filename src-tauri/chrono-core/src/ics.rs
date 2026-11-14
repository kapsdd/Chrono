//! Minimal iCalendar (.ics) export (#12). Tasks with a due date become
//! 30-minute VEVENTs that any calendar app (Google, Outlook, Apple) can
//! import — no OAuth or backend required.

use crate::types::Task;
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};

/// iCalendar UTC stamp: `20260617T140000Z`
fn to_ics_date(dt: DateTime<Utc>) -> String {
    dt.format("%Y%m%dT%H%M%SZ").to_string()
}

/// Escape per RFC 5545: backslash, comma, semicolon, newline.
fn esc(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            ';' => out.push_str("\\;"),
            ',' => out.push_str("\\,"),
            '\n' => out.push_str("\\n"),
            _ => out.push(ch),
        }
    }
    out
}

/// Parse the timestamp strings the app stores (RFC 3339, `YYYY-MM-DDTHH:MM:SS`,
/// or a bare `YYYY-MM-DD` date). Bare dates land on UTC midnight, matching
/// what `new Date(s)` does in the JS runtime.
fn parse_timestamp(raw: &str) -> Option<DateTime<Utc>> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(raw) {
        return Some(dt.with_timezone(&Utc));
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M:%S%.f") {
        return Some(dt.and_utc());
    }
    if let Ok(dt) = NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
        return Some(dt.and_hms_opt(0, 0, 0).unwrap().and_utc());
    }
    None
}

/// Convenience wrapper for callers that pass an ISO/RFC 3339 stamp string.
/// Falls back to "now" when the stamp cannot be parsed.
pub fn build_ics_at(tasks: &[Task], stamp: &str) -> String {
    let stamp = parse_timestamp(stamp).unwrap_or_else(Utc::now);
    build_ics(tasks, stamp)
}

pub fn build_ics(tasks: &[Task], stamp: DateTime<Utc>) -> String {
    let mut lines: Vec<String> = vec![
        "BEGIN:VCALENDAR".into(),
        "VERSION:2.0".into(),
        "PRODID:-//CHRONO//Task Manager//RU".into(),
        "CALSCALE:GREGORIAN".into(),
        "X-WR-CALNAME:CHRONO".into(),
    ];
    let dtstamp = to_ics_date(stamp);

    for t in tasks.iter().filter(|t| t.due.is_some()) {
        let Some(start) = t.due.as_deref().and_then(parse_timestamp) else {
            continue;
        };
        let end = start + chrono::Duration::minutes(30);
        lines.push("BEGIN:VEVENT".into());
        lines.push(format!("UID:{}@chrono", t.id));
        lines.push(format!("DTSTAMP:{dtstamp}"));
        lines.push(format!("DTSTART:{}", to_ics_date(start)));
        lines.push(format!("DTEND:{}", to_ics_date(end)));
        lines.push(format!("SUMMARY:{}", esc(&t.title)));
        lines.push(if t.is_completed {
            "STATUS:COMPLETED".into()
        } else {
            "STATUS:CONFIRMED".into()
        });
        lines.push("END:VEVENT".into());
    }

    lines.push("END:VCALENDAR".into());
    // RFC 5545 wants CRLF line endings.
    lines.join("\r\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str, title: &str, due: Option<&str>, done: bool) -> Task {
        Task {
            id: id.into(),
            title: title.into(),
            is_completed: done,
            priority: 0,
            parent_id: None,
            project_id: None,
            tags: vec![],
            created_at: "2026-01-01T00:00:00Z".into(),
            order: None,
            due: due.map(|s| s.to_string()),
            collapsed: false,
            time_spent: None,
            note: None,
            recurrence: None,
            streak: None,
            last_completed_at: None,
        }
    }

    #[test]
    fn skips_undated_tasks() {
        let out = build_ics(&[task("a", "без даты", None, false)], Utc::now());
        assert!(!out.contains("BEGIN:VEVENT"));
        assert!(out.starts_with("BEGIN:VCALENDAR"));
        assert!(out.ends_with("END:VCALENDAR"));
    }

    #[test]
    fn formats_utc_dates_and_30min_duration() {
        let out = build_ics(
            &[task("a", "созвон", Some("2026-06-17T14:00:00Z"), false)],
            Utc::now(),
        );
        assert!(out.contains("DTSTART:20260617T140000Z"));
        assert!(out.contains("DTEND:20260617T143000Z"));
        assert!(out.contains("UID:a@chrono"));
        assert!(out.contains("STATUS:CONFIRMED"));
    }

    #[test]
    fn bare_date_lands_on_midnight() {
        let out = build_ics(&[task("a", "дедлайн", Some("2026-06-17"), true)], Utc::now());
        assert!(out.contains("DTSTART:20260617T000000Z"));
        assert!(out.contains("STATUS:COMPLETED"));
    }

    #[test]
    fn escapes_reserved_chars() {
        let out = build_ics(
            &[task("a", r"a\,b;c", Some("2026-06-17T14:00:00Z"), false)],
            Utc::now(),
        );
        assert!(out.contains("SUMMARY:a\\\\\\,b\\;c"));
    }

    #[test]
    fn crlf_line_endings() {
        let out = build_ics(&[], Utc::now());
        assert!(!out.contains("\n\n"));
        for line in out.split("\r\n") {
            assert!(!line.contains('\n'));
        }
        assert!(out.contains("\r\n"));
    }
}
