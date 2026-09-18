import { NextRequest } from 'next/server';
import { handleAccountInviteAccept } from '../../../../../lib/accept-invite';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return handleAccountInviteAccept(request, token);
}
