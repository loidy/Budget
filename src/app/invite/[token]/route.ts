import { NextRequest } from 'next/server';
import { handleHouseInviteRequest } from '../../../lib/accept-invite';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return handleHouseInviteRequest(request, token);
}
