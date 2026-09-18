import { redirect } from 'next/navigation';
import { WelcomeForm } from '../../components/WelcomeForm';
import { getSessionUser } from '../../lib/auth-guard';
import { isInvitePlaceholderEmail } from '../../lib/invites';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  if (!isInvitePlaceholderEmail(user.email)) {
    redirect('/');
  }

  return <WelcomeForm defaultName={user.name} />;
}
