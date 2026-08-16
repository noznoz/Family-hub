import type { Metadata } from 'next';
import { demoTasks } from '@/lib/demo-data';
import { TasksView } from '@/components/tasks/tasks-view';

export const metadata: Metadata = { title: 'Tasks' };

export default function TasksPage() {
  return <TasksView tasks={demoTasks} />;
}
