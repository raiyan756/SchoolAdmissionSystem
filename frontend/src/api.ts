export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export type HoldStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
export interface Hold {
  holdId: string;
  classId: string;
  status: HoldStatus;
  expiresAt: string;
}
export interface MyHold extends Hold {
  className: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const messages: Record<string, string> = {
  "Class not found.": "Class not found. Return to the class list.",
  "Hold not found.":
    "Application not found. Open it again from My applications.",
  "You already have an active hold or confirmed admission in this class.":
    "You already have an active application or confirmed admission in this class. Check My applications.",
  "No seats available in this class.":
    "There are no available seats in this class right now.",
  "This hold belongs to another student.":
    "This application belongs to another student. Check the birth registration number.",
  "A confirmed admission cannot be cancelled.":
    "A confirmed admission cannot be cancelled.",
  "This hold is no longer active.":
    "This application is no longer active. Check its current status.",
};

export async function request<T>(
  path: string,
  options: RequestInit = {},
  studentId?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (studentId) headers.set("X-Student-Id", studentId);
  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as {
      title?: string;
    };
    throw new ApiError(
      response.status,
      messages[problem.title ?? ""] ??
        (response.status === 400
          ? "Some details are invalid. Please check the form and try again."
          : "This action is unavailable right now. Please try again shortly."),
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Unable to reach the server. Check your connection and try again.";
}

export const validStudentId = (value: string) => /^[0-9]{17}$/.test(value);
