'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

type Result = { ok: true } | { ok: false; error: string };

export interface StudentPrivateInput {
  studentId: string;
  phone?: string; address?: string; emergencyContact?: string;
  doctorGp?: string; bloodType?: string;
  bankName?: string; accountNumber?: string; sortCode?: string; iban?: string;
  nationalInsurance?: string; brpNumber?: string; passportNumber?: string;
  notes?: string;
}

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Upsert a student's private info. RLS restricts this to admins/parents or the student. */
export async function updateStudentPrivate(input: StudentPrivateInput): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { error } = await supabase.from('student_private').upsert({
    student_id: input.studentId,
    phone: clean(input.phone),
    address: clean(input.address),
    emergency_contact: clean(input.emergencyContact),
    doctor_gp: clean(input.doctorGp),
    blood_type: clean(input.bloodType),
    bank_name: clean(input.bankName),
    account_number: clean(input.accountNumber),
    sort_code: clean(input.sortCode),
    iban: clean(input.iban),
    national_insurance: clean(input.nationalInsurance),
    brp_number: clean(input.brpNumber),
    passport_number: clean(input.passportNumber),
    notes: clean(input.notes),
  }, { onConflict: 'student_id' });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/students/${input.studentId}`);
  return { ok: true };
}
