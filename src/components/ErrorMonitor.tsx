import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { reportError, setErrorUser } from "@/lib/errorReporter";

export function ErrorMonitor() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setErrorUser({ id: user?.id ?? null, email: user?.email ?? null });
  }, [user?.id, user?.email]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void reportError({
        error: event.error ?? event.message,
        source: "window",
        context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      void reportError({ error: event.reason, source: "promise" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
