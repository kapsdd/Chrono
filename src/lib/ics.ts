import type { Task } from "@/lib/types";

// Minimal iCalendar (.ics) export (#12, client-side). Tasks with a due date
// become 30-minute VEVENTs that any calendar app (Google, Outlook, Apple) can
// import — no OAuth or backend required.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// iCalendar UTC stamp: 20260617T140000Z
function toICSDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// Escape per RFC 5545: backslash, comma, semicolon, newline.
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildICS(tasks: Task[], stamp: Date): string {
  const dated = tasks.filter((t) => t.due);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CHRONO//Task Manager//RU",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:CHRONO",
  ];
  const dtstamp = toICSDate(stamp);
  for (const t of dated) {
    const start = new Date(t.due as string);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@chrono`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${esc(t.title)}`,
      t.isCompleted ? "STATUS:COMPLETED" : "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 wants CRLF line endings.
  return lines.join("\r\n");
}

// Trigger a download of the current tasks as a .ics file.
export function downloadICS(tasks: Task[]) {
  if (typeof window === "undefined") return;
  const ics = buildICS(tasks, new Date());
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chrono.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
