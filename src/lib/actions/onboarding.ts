import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type OnboardResult = 'admin' | 'active' | 'pending' | 'unauthenticated' | 'error';

function nameFromEmail(email: string | undefined): string {
  if (!email) return 'Admin';
  const local = email.split('@')[0] ?? 'Admin';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Ensure the current signed-in user belongs to a family.
 *
 * - If they already have a membership, return its state.
 * - If they are the FIRST user (no active admin exists yet), make them the
 *   admin: link them to the existing unlinked admin slot (the seeded "Dad")
 *   so they inherit the family, or create a fresh family + admin member.
 * - Otherwise create a pending membership awaiting admin approval.
 *
 * Runs with the service-role client so a brand-new user (who has no RLS
 * permissions yet) can be bootstrapped safely on the server.
 */
export async function ensureMembership(): Promise<OnboardResult> {
  try {
    return await ensureMembershipInner();
  } catch (e) {
    console.error('[ensureMembership] failed:', e instanceof Error ? e.message : String(e));
    return 'error';
  }
}

async function ensureMembershipInner(): Promise<OnboardResult> {
  const supabase = await createClient();
  if (!supabase) return 'error';
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 'unauthenticated';

  const admin = createAdminClient();
  if (!admin) return 'error';

  // Make sure a profile row exists (the DB trigger normally handles this).
  await admin
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email, full_name: (user.user_metadata?.full_name as string) ?? '' },
      { onConflict: 'id' },
    );

  // Find an unlinked, pre-invited slot whose email matches this user (any
  // family). This is how an admin onboards others: set a member's login email,
  // they sign up with it, and they land straight into that member (with its role).
  const findInviteSlot = async (): Promise<{ id: string; role: string } | null> => {
    if (!user.email) return null;
    const { data } = await admin
      .from('family_members')
      .select('id, role')
      .is('profile_id', null)
      .ilike('invite_email', user.email)
      .limit(1)
      .maybeSingle();
    return data ?? null;
  };
  const linkSlot = async (slot: { id: string; role: string }): Promise<OnboardResult | null> => {
    const { error } = await admin
      .from('family_members')
      .update({ profile_id: user.id, status: 'active' })
      .eq('id', slot.id);
    if (error) return null;
    return slot.role === 'admin' ? 'admin' : 'active';
  };

  // Already a member?
  const { data: existing } = await admin
    .from('family_members')
    .select('id, role, status')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (existing) {
    // Self-heal: this user was auto-created as a plain family member (e.g. they
    // signed in before an admin set their real email, or their slot still had a
    // placeholder). If a proper invited slot now matches their email — like the
    // student profile an admin prepared — move them into it and drop the
    // duplicate. Never touch an existing admin/parent/student membership.
    if (existing.role === 'family_member') {
      const slot = await findInviteSlot();
      if (slot && slot.id !== existing.id) {
        await admin.from('family_members').delete().eq('id', existing.id);
        const healed = await linkSlot(slot);
        if (healed) return healed;
      }
    }
    return existing.status === 'active' ? 'active' : 'pending';
  }

  // First-time sign-in: link straight into a matching invited slot.
  {
    const slot = await findInviteSlot();
    if (slot) {
      const linked = await linkSlot(slot);
      if (linked) return linked;
    }
  }

  // Is there already an active, linked admin? If not, this user bootstraps as admin.
  const { data: admins } = await admin
    .from('family_members')
    .select('id')
    .eq('role', 'admin')
    .eq('status', 'active')
    .not('profile_id', 'is', null)
    .limit(1);
  const isFirstUser = !admins || admins.length === 0;

  // Find or create the family.
  const { data: fam } = await admin
    .from('families')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  let familyId = fam?.id as string | undefined;
  if (!familyId) {
    const { data: newFam, error } = await admin
      .from('families')
      .insert({ name: 'My Family' })
      .select('id')
      .single();
    if (error || !newFam) return 'error';
    familyId = newFam.id;
  }

  if (isFirstUser) {
    // Prefer linking to an existing unlinked admin slot (seeded "Dad").
    const { data: slot } = await admin
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('role', 'admin')
      .is('profile_id', null)
      .limit(1)
      .maybeSingle();

    if (slot) {
      const { error } = await admin
        .from('family_members')
        .update({ profile_id: user.id, status: 'active' })
        .eq('id', slot.id);
      if (error) return 'error';
    } else {
      const { error } = await admin.from('family_members').insert({
        family_id: familyId,
        profile_id: user.id,
        role: 'admin',
        status: 'active',
        display_name: nameFromEmail(user.email),
        created_by: user.id,
      });
      if (error) return 'error';
    }
    return 'admin';
  }

  // Subsequent users join as pending until an admin approves them.
  await admin.from('family_members').insert({
    family_id: familyId,
    profile_id: user.id,
    role: 'family_member',
    status: 'invited',
    display_name: nameFromEmail(user.email),
  });
  return 'pending';
}
