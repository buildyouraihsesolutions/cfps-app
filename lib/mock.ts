// Shared helpers for the CFPS Readiness Mock Exam
export const EXAM_TZ = 'Africa/Cairo';
export const EXAM_TZ_LABEL = 'Cairo time';

export type MockExam = {
  id: number; title: string; opens_at: string; closes_at: string;
  duration_min: number; question_count: number;
};
export type MockSitting = { id: string; started_at: string; deadline: string; submitted_at: string | null };
export type MockStatus = {
  server_now: string;
  state: 'not_open' | 'open' | 'closed';
  exam: MockExam;
  sitting: MockSitting | null;
};
export type MockQ = { pos: number; stem: string; options: Record<string, string>; chosen: string | null; flagged: boolean };

export type MockResult = {
  email: string; full_name: string | null; company: string | null; status: string;
  started_at: string | null; submitted_at: string | null; minutes_used: number | null;
  answered: number; score: number | null; question_count: number | null; pct: number | null;
  auto_submitted: boolean | null; domains: Record<string, { correct: number; total: number }> | null;
};

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: EXAM_TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: EXAM_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(iso));
}

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h ? `${h} hour${h > 1 ? 's' : ''}` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''}`;
}

export function countdown(sec: number) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d) return `${d} day${d > 1 ? 's' : ''} ${h} h ${m} min`;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
