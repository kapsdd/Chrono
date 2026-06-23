import type { ParsedInput, Priority } from "@/lib/types";

// Smart Input grammar (Phase 1):
//   /Project   → exactly one project (last one wins if repeated)
//   #tag       → zero or more tags (deduplicated, order preserved)
//   ! !! !!!   → priority by run length, clamped to 3; bare "!" inside a word
//                is left alone — only standalone bangs count
//
// Tokens may appear anywhere in the line; whatever remains is the title.

const PROJECT_RE = /(?:^|\s)\/([^\s#]+)/g;
const TAG_RE = /(?:^|\s)#([^\s#]+)/g;
const PRIORITY_RE = /(?:^|\s)(!{1,})(?=\s|$)/g;

export function parseInput(raw: string): ParsedInput {
  let project: string | null = null;
  const tags: string[] = [];
  let priority: Priority = 0;

  let m: RegExpExecArray | null;

  while ((m = PROJECT_RE.exec(raw)) !== null) {
    project = m[1];
  }

  while ((m = TAG_RE.exec(raw)) !== null) {
    if (!tags.includes(m[1])) tags.push(m[1]);
  }

  while ((m = PRIORITY_RE.exec(raw)) !== null) {
    priority = Math.min(3, m[1].length) as Priority;
  }

  const title = raw
    .replace(PROJECT_RE, " ")
    .replace(TAG_RE, " ")
    .replace(PRIORITY_RE, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title: title || "", project, tags, priority };
}
