import { useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "./api";
import { useSession } from "./Session";

export function useAction() {
  const { working, setWorking } = useSession();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const active = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function run<T>(
    command: () => Promise<T>,
    success: (value: T) => void,
    refresh: () => void,
  ) {
    if (running.current || working) return;
    running.current = true;
    setWorking(true);
    setPending(true);
    setError("");
    try {
      const result = await command();
      if (active.current) success(result);
    } catch (error) {
      if (active.current)
        setError(
          error instanceof ApiError
            ? errorMessage(error)
            : "The server did not respond. Your request may have completed. Check My applications before trying again.",
        );
    } finally {
      running.current = false;
      setWorking(false);
      if (active.current) {
        setPending(false);
        refresh();
      }
    }
  }
  return { pending, error, run };
}
