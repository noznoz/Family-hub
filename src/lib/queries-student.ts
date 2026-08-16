import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface FundingPeriod {
  id: string;
  label: string;
  status: string;
  start_date: string;
  end_date: string | null;
}
export interface Milestone {
  id: string;
  title: string;
  occurred_on: string | null;
}
export interface StudentDetail {
  funding: FundingPeriod[];
  milestones: Milestone[];
}

/** Full funding history (never overwritten) and milestones for a student. */
export async function getStudentDetail(studentId: string): Promise<StudentDetail> {
  const supabase = await createClient();
  if (!supabase) return { funding: [], milestones: [] };

  const [fundingRes, milestoneRes] = await Promise.all([
    supabase
      .from('funding_sources')
      .select('id, label, status, start_date, end_date')
      .eq('student_id', studentId)
      .order('start_date', { ascending: true }),
    supabase
      .from('student_milestones')
      .select('id, title, occurred_on')
      .eq('student_id', studentId)
      .order('occurred_on', { ascending: true }),
  ]);

  return {
    funding: (fundingRes.data ?? []) as FundingPeriod[],
    milestones: (milestoneRes.data ?? []) as Milestone[],
  };
}
