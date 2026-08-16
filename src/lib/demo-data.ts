import type {
  AttentionItem, Expense, Member, Message, PaymentRequest, StudentSummary, Task,
} from './types';

/**
 * Demo data mirrors supabase/seed.sql. Used to render a fully browsable app
 * when a Supabase backend is not yet connected (isSupabaseConfigured === false).
 * Once connected, pages fetch real data via RLS-protected queries instead.
 */

export const demoMembers: Member[] = [
  { id: 'd', displayName: 'Dad', role: 'admin', isStudent: false, relationship: 'Dad' },
  { id: 'm', displayName: 'Mom', role: 'parent', isStudent: false, relationship: 'Mom' },
  { id: 's', displayName: 'Sister', role: 'family_member', isStudent: false, relationship: 'Sister' },
  { id: 'sm', displayName: 'Step Mom', role: 'parent', isStudent: false, relationship: 'Step Mom' },
  { id: 'sd', displayName: 'Step Dad', role: 'family_member', isStudent: false, relationship: 'Step Dad' },
  { id: 'h', displayName: 'Hamza', role: 'student', isStudent: true, relationship: 'Son' },
  { id: 'o', displayName: 'Omar', role: 'student', isStudent: true, relationship: 'Son' },
];

export const demoStudents: StudentSummary[] = [
  {
    id: 'h', memberId: 'h', name: 'Hamza', university: 'University of Surrey',
    academicYear: 'Year 1 · 2026/27', funding: 'Government Scholarship',
    fundingKind: 'government_scholarship', overallStatus: 'On track',
    nextTask: { title: 'Submit scholarship enrollment confirmation', due: 'in 6 days' },
    nextPayment: null,
    nextTrip: { label: 'Travel to UK', date: 'in 20 days' },
  },
  {
    id: 'o', memberId: 'o', name: 'Omar', university: 'University of Surrey',
    academicYear: 'Year 1 · 2026/27', funding: 'Family Funded',
    fundingKind: 'family_funded', overallStatus: 'On track',
    nextTask: { title: 'Pay tuition (Term 1)', due: 'in 6 days' },
    nextPayment: { label: 'Tuition — Term 1', amount: 4500, currency: 'GBP', due: 'in 6 days' },
    nextTrip: { label: 'Travel to UK', date: 'in 22 days' },
  },
];

export const demoAttention: AttentionItem[] = [
  { id: '1', title: 'Omar tuition due in 6 days', detail: '£4,500 — Term 1', tone: 'danger' },
  { id: '2', title: 'Scholarship enrollment confirmation missing', detail: 'Hamza — due in 6 days', tone: 'attention' },
  { id: '3', title: 'New payment request', detail: 'Omar requested £350 for textbooks', tone: 'brand' },
  { id: '4', title: 'Passport expiring', detail: 'Hamza — expires Apr 2028', tone: 'attention' },
];

export const demoTasks: Task[] = [
  { id: 't1', title: 'Submit scholarship enrollment confirmation', description: 'Upload to the scholarship portal', assignee: 'Hamza', student: 'Hamza', due: 'in 6 days', priority: 'important', status: 'todo' },
  { id: 't2', title: 'Pay Omar tuition (Term 1)', description: 'Bank transfer to university', assignee: 'Dad', student: 'Omar', due: 'in 6 days', priority: 'urgent', status: 'todo' },
  { id: 't3', title: 'Confirm airport transfer', description: 'Arrange pickup from Heathrow', assignee: 'Dad', student: null, due: 'in 12 days', priority: 'normal', status: 'in_progress' },
  { id: 't4', title: 'Renew travel insurance', description: 'Annual renewal', assignee: 'Mom', student: null, due: '2 days ago', priority: 'normal', status: 'done' },
];

export const demoMessages: Message[] = [
  { id: 'm1', sender: 'Dad', role: 'admin', body: "Welcome to Family Hub! Everything about Hamza & Omar's journey lives here.", createdAt: '09:02', pinned: true },
  { id: 'm2', sender: 'Omar', role: 'student', body: 'Dad, I need £350 for books before Thursday.', createdAt: '09:14' },
  { id: 'm3', sender: 'Mom', role: 'parent', body: 'Omar tuition for this term has been paid ✅', createdAt: '09:20', pinned: true },
  { id: 'm4', sender: 'Hamza', role: 'student', body: 'Thanks! I uploaded my enrollment letter to Documents.', createdAt: '09:31' },
];

export const demoPinned: Message[] = demoMessages.filter((m) => m.pinned);

export const demoExpenses: Expense[] = [
  { id: 'e1', student: 'Hamza', category: 'food', amount: 180, currency: 'GBP', description: 'Groceries', spentOn: '5 days ago', fundingLabel: 'Government Scholarship' },
  { id: 'e2', student: 'Hamza', category: 'transport', amount: 60, currency: 'GBP', description: 'Bus pass', spentOn: '3 days ago', fundingLabel: 'Government Scholarship' },
  { id: 'e3', student: 'Omar', category: 'accommodation', amount: 650, currency: 'GBP', description: 'Monthly rent', spentOn: '8 days ago', fundingLabel: 'Family Funded' },
  { id: 'e4', student: 'Omar', category: 'university', amount: 120, currency: 'GBP', description: 'Lab materials', spentOn: 'yesterday', fundingLabel: 'Family Funded' },
];

export const demoRequests: PaymentRequest[] = [
  { id: 'r1', student: 'Omar', amount: 350, currency: 'GBP', reason: 'Textbooks for Term 1', category: 'university', urgency: 'important', requestedBy: 'Omar', status: 'requested' },
];

export const demoBudgets: Record<'Hamza' | 'Omar', { budget: number; spent: number; currency: string }> = {
  Hamza: { budget: 900, spent: 240, currency: 'GBP' },
  Omar: { budget: 1100, spent: 770, currency: 'GBP' },
};
