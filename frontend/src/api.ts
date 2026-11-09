export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
export interface Hold {
  holdId: string;
  classId: string;
  status: HoldStatus;
  expiresAt: string;
}
export interface MyHold extends Hold { className: string }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const messages: Record<string, string> = {
  'Class not found.': 'ক্লাসটি পাওয়া যায়নি। ক্লাস তালিকায় ফিরে যান।',
  'Hold not found.': 'আবেদনটি পাওয়া যায়নি। আমার আবেদন থেকে আবার খুলুন।',
  'You already have an active hold or confirmed admission in this class.': 'এই ক্লাসে আপনার একটি চলমান আবেদন বা নিশ্চিত ভর্তি আছে। আমার আবেদন দেখুন।',
  'No seats available in this class.': 'দুঃখিত, এই ক্লাসে এখন কোনো খালি আসন নেই।',
  'This hold belongs to another student.': 'এই আবেদনটি অন্য শিক্ষার্থীর। জন্মনিবন্ধন নম্বর যাচাই করুন।',
  'A confirmed admission cannot be cancelled.': 'নিশ্চিত ভর্তি বাতিল করা যাবে না।',
  'This hold is no longer active.': 'এই আবেদনটি আর সক্রিয় নেই। বর্তমান অবস্থা দেখুন।',
};

export async function request<T>(path: string, options: RequestInit = {}, studentId?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (studentId) headers.set('X-Student-Id', studentId);
  const response = await fetch(`/api${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as { title?: string };
    throw new ApiError(response.status, messages[problem.title ?? ''] ??
      (response.status === 400 ? 'তথ্য সঠিক হয়নি। ফর্মের তথ্য আবার যাচাই করুন।' :
        'এই মুহূর্তে কাজটি করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।'));
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message :
    'সার্ভারের সঙ্গে যোগাযোগ করা যায়নি। সংযোগ যাচাই করে আবার চেষ্টা করুন।';
}

export const validStudentId = (value: string) => /^[0-9]{17}$/.test(value);
