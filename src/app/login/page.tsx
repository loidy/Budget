import { redirect } from 'next/navigation';
import { LoginForm } from '../../components/LoginForm';
import { googleAuthEnabled } from '../../lib/auth';
import { getSessionUser } from '../../lib/auth-guard';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    redirect('/');
  }

  const { error } = await searchParams;

  return <LoginForm googleEnabled={googleAuthEnabled} showInviteError={error === 'invite'} />;
}
