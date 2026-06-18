// Extract a human-readable message from anything thrown — Error instances,
// Supabase/PostgREST error objects ({ message, details, hint, code }), or
// plain values. Avoids the "[object Object]" you get from String(obj).
export function errMessage(e: unknown): string {
  if (!e) return "неизвестная ошибка";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint].filter(Boolean).map(String);
    if (parts.length) return parts.join(" — ");
  }
  return String(e);
}
