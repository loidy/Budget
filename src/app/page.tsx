import { redirect } from 'next/navigation';
import { BudgetApp } from '../components/BudgetApp';
import { EmptyState } from '../components/EmptyState';
import { getSessionUser } from '../lib/auth-guard';
import { parseAppSearchParams, searchParamsFromRecord } from '../lib/catalogView';
import { getHouses } from '../lib/houses';
import { isInvitePlaceholderEmail } from '../lib/invites';
import { formatMonthKey } from '../utils/formatters';

// Every view reflects the current database state, so nothing here is cached.
export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  if (isInvitePlaceholderEmail(user.email)) {
    redirect('/welcome');
  }

  const houses = await getHouses(user.id);

  if (houses.length === 0) {
    return <EmptyState user={user} />;
  }

  // Resolved on the server so the client renders the same day it hydrates with.
  const today = new Date();
  const parsed = parseAppSearchParams(searchParamsFromRecord(await searchParams), houses);

  return (
    <BudgetApp
      user={user}
      houses={houses}
      initialMonthKey={formatMonthKey(today.getFullYear(), today.getMonth() + 1)}
      initialDay={today.getDate()}
      initialHouseId={parsed.houseId}
      initialTab={parsed.tab}
      initialCatalogView={parsed.catalogView}
    />
  );
}
