import { redirect } from 'next/navigation';
import { AccountInviteForm } from '../../../../components/AccountInviteForm';
import { getSessionUser } from '../../../../lib/auth-guard';
import { getOpenUserInvite } from '../../../../lib/user-invites';

export const dynamic = 'force-dynamic';

export default async function AccountInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getOpenUserInvite(token);

  if (!invite) {
    redirect('/login?error=invite');
  }

  const sessionUser = await getSessionUser();

  return (
    <AccountInviteForm
      token={token}
      name={invite.name}
      email={invite.email}
      errorCode={error ?? null}
      signedInAs={sessionUser ? sessionUser.name || sessionUser.email : null}
    />
  );
}
