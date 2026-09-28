export type Domain = { code: string; name: string; weight: number; sort: number };
export type PlanRow = {
  id: number; domain: string; section: number; chapter: number; title: string;
  priority: 'high' | 'medium' | 'low'; note: string | null; sort: number;
};
export type PoolRow = { domain: string | null; fph_section: number; fph_chapter: number | null; n: number };
export type Options = Record<'A' | 'B' | 'C' | 'D', string>;
export type AttemptQ = {
  pos: number; question_id: number; stem: string; options: Options;
  chosen: string | null; flagged: boolean; domain: string | null; fph_section: number;
};
export type ReviewQ = {
  pos: number; stem: string; options: Options; chosen: string | null; answer: string;
  is_correct: boolean | null; explanation: string | null; fph_page: string; domain: string | null;
};
export type Attempt = {
  id: string; mode: 'exam' | 'domain' | 'chapter'; filter: Record<string, unknown>;
  question_count: number; time_limit_sec: number | null; started_at: string;
  submitted_at: string | null; score: number | null;
  breakdown: Record<string, { correct: number; total: number }> | null;
};
export const LETTERS = ['A', 'B', 'C', 'D'] as const;
export const PASS_MARK = 70;
