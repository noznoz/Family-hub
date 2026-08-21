import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { getTasks, getStudents, getFamilyMembers } from '@/lib/queries';
import { demoTasks, demoStudents, demoMembers } from '@/lib/demo-data';
import { TasksView } from '@/components/tasks/tasks-view';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage() {
  const session = await getSessionUser();
  if (!session) return null;

  const [tasks, students, members] = session.isDemo
    ? [demoTasks, demoStudents, demoMembers]
    : await Promise.all([
        getTasks(session.familyId),
        getStudents(session.familyId),
        getFamilyMembers(session.familyId),
      ]);

  return (
    <TasksView
      tasks={tasks}
      live={!session.isDemo}
      meId={session.memberId}
      students={students.map((s) => ({ id: s.id, name: s.name }))}
      members={members.map((m) => ({ id: m.id, name: m.displayName }))}
    />
  );
}
