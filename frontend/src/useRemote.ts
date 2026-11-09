import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./api";

// Callers memoize load. A new load function resets the request; late results are ignored.
export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<T>,
  pollMs = 0,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | undefined;
    let inFlight = false;
    async function run() {
      // Allow slow reads to finish instead of aborting them on every polling tick.
      if (inFlight) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const result = await load(controller.signal);
        if (!disposed) {
          setData(result);
          setError("");
        }
      } catch (error) {
        if (
          !disposed &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setError(errorMessage(error));
        }
      } finally {
        inFlight = false;
        if (!disposed) setLoading(false);
      }
    }
    void run();
    const onVisible = () => {
      if (!document.hidden) void run();
    };
    const timer = pollMs ? window.setInterval(onVisible, pollMs) : undefined;
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, pollMs, version]);

  return { data, error, loading, refresh };
}
