import type { SystemRole } from './permissions';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'normal' | 'important' | 'urgent';
export type RequestStatus = 'requested' | 'approved' | 'rejected' | 'paid' | 'cancelled';
export type ExpenseCategory =
  | 'accommodation' | 'food' | 'transport' | 'university'
  | 'travel' | 'shopping' | 'entertainment' | 'phone' | 'other';

export interface Member {
  id: string;
  displayName: string;
  role: SystemRole;
  isStudent: boolean;
  avatarUrl?: string | null;
  relationship?: string;
  inviteEmail?: string | null;
  status?: string;
  linked?: boolean;
  theme?: string | null;
}

export interface StudentSummary {
  id: string;
  memberId: string;
  name: string;
  university: string;
  academicYear: string;
  funding: string;
  fundingKind: 'government_scholarship' | 'family_funded' | 'personal' | 'other';
  overallStatus: string;
  nextTask?: { title: string; due: string } | null;
  nextPayment?: { label: string; amount: number; currency: string; due: string } | null;
  nextTrip?: { label: string; date: string } | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  student?: 'Hamza' | 'Omar' | null;
  due?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  // Raw fields for editing (not shown directly).
  dueDate?: string | null;
  studentId?: string | null;
  assigneeId?: string | null;
}

export interface Message {
  id: string;
  sender: string;
  role: SystemRole;
  body: string;
  createdAt: string;
  pinned?: boolean;
}

export interface Expense {
  id: string;
  student: 'Hamza' | 'Omar';
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description: string;
  spentOn: string;
  fundingLabel: string;
  studentId?: string | null;
  spentOnDate?: string | null;
}

export interface PaymentRequest {
  id: string;
  student: 'Hamza' | 'Omar';
  amount: number;
  currency: string;
  reason: string;
  category: ExpenseCategory;
  urgency: TaskPriority;
  requestedBy: string;
  status: RequestStatus;
  studentId?: string | null;
  note?: string | null;
}

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  tone: 'attention' | 'danger' | 'brand';
}
