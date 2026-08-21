import type { Metadata } from 'next';
import { FileText, ExternalLink, ShieldCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getDocuments, getStudentOptions } from '@/lib/document-queries';
import { getFamilyMembers } from '@/lib/queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentUploadDialog } from '@/components/documents/document-upload-dialog';
import { DocumentRowActions } from '@/components/documents/document-row-actions';
import { ReminderButton } from '@/components/ui/reminder-button';
import { ShareButton } from '@/components/ui/share-button';

export const metadata: Metadata = { title: 'Documents' };

const expiryChip = { ok: 'success', soon: 'attention', expired: 'danger', none: 'neutral' } as const;

export default async function DocumentsPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canView = can(session.member.role, 'view_documents', session.overrides) || can(session.member.role, 'manage_documents', session.overrides);
  const canManage = can(session.member.role, 'manage_documents', session.overrides);

  if (!canView && session.member.role !== 'student') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Documents</h1>
        <EmptyState icon={<ShieldCheck className="size-6" />} title="Documents are private" hint="Ask an admin for access." />
      </div>
    );
  }

  const [docs, students, members] = session.isDemo
    ? [[], [], []]
    : await Promise.all([
        getDocuments(session.familyId),
        getStudentOptions(session.familyId),
        getFamilyMembers(session.familyId).then((ms) => ms.map((m) => ({ id: m.id, name: m.displayName }))),
      ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Documents</h1>
        {canManage && <DocumentUploadDialog familyId={session.familyId} students={students} />}
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<FileText className="size-6" />} title="No documents yet" hint="Upload passports, visas and letters — stored privately." />
      ) : (
        <Card className="divide-y divide-border">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-navy"><FileText className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy">{d.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Chip tone="neutral" className="capitalize">{d.category}</Chip>
                  {d.student && <Chip tone="navy">{d.student}</Chip>}
                  {d.expiry && <Chip tone={expiryChip[d.expiryState]}>
                    {d.expiryState === 'expired' ? 'Expired' : 'Expires'} {d.expiry}
                  </Chip>}
                  {d.versionCount > 1 && <Chip tone="neutral">v{d.versionCount}</Chip>}
                </div>
              </div>
              {d.url && (
                <a href={d.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.name}`}
                  className="shrink-0 rounded-lg p-2 text-brand hover:bg-muted"><ExternalLink className="size-5" /></a>
              )}
              <ShareButton text={`📄 Document: ${d.name} (${d.category})${d.expiry ? ` · ${d.expiryState === 'expired' ? 'expired' : 'expires'} ${d.expiry}` : ''}`} url="/documents" />
              <ReminderButton entityType="document" entityId={d.id} title={d.name} link="/documents" live={!session.isDemo} meId={session.memberId} />
              {canManage && <DocumentRowActions doc={d} students={students} members={members} familyId={session.familyId} live={!session.isDemo} />}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
