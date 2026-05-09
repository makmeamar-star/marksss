import { supabase } from "@/integrations/supabase/client";

type UserCtx = { id: string | null; email: string | null };

let currentUser: UserCtx = { id: null, email: null };
const recent = new Map<string, number>(); // dedupe key -> timestamp
const DEDUPE_MS = 10_000;

export function setErrorUser(user: UserCtx) {
  currentUser = user;
}

export type ReportInput = {
  error: unknown;
  source?: "react" | "window" | "promise" | "manual";
  context?: Record<string, unknown>;
};

function normalize(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message || "Unknown error", stack: err.stack };
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

export async function reportError(input: ReportInput): Promise<void> {
  if (typeof window === "undefined") return;
  const { message, stack } = normalize(input.error);
  if (!message) return;

  // Dedupe identical errors within window
  const key = `${input.source ?? "manual"}|${message}|${(stack ?? "").slice(0, 120)}`;
  const now = Date.now();
  const prev = recent.get(key);
  if (prev && now - prev < DEDUPE_MS) return;
  recent.set(key, now);
  if (recent.size > 50) {
    for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  }

  try {
    await supabase.from("client_errors").insert({
      user_id: currentUser.id,
      user_email: currentUser.email,
      message: message.slice(0, 2000),
      stack: stack ? stack.slice(0, 8000) : null,
      source: input.source ?? "manual",
      url: window.location.href,
      route: window.location.pathname,
      user_agent: navigator.userAgent,
      app_version: import.meta.env.MODE,
      context: (input.context ?? null) as never,
    });
  } catch {
    // Never throw from reporter
  }
}
