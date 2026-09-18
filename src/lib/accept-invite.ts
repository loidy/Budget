import { NextRequest, NextResponse } from 'next/server';
import { auth } from './auth';
import { newId } from './ids';
import { isInvitePlaceholderEmail, isInviteToken, INVITE_PLACEHOLDER_NAME, newInvitePlaceholderEmail } from './invites';
import { prisma } from './prisma';

function copyCookies(from: Response, to: NextResponse) {
  const cookies =
    typeof from.headers.getSetCookie === 'function' ? from.headers.getSetCookie() : [];

  if (cookies.length > 0) {
    for (const cookie of cookies) {
      to.headers.append('Set-Cookie', cookie);
    }
    return;
  }

  const header = from.headers.get('set-cookie');
  if (header) {
    to.headers.append('Set-Cookie', header);
  }
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

function requestOrigin(request: NextRequest): string {
  const configured = process.env.BETTER_AUTH_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return request.nextUrl.origin;

  const proto =
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '') ?? 'http';
  return `${proto}://${host}`;
}

export async function handleHouseInviteRequest(request: NextRequest, token: string): Promise<NextResponse> {
  const origin = requestOrigin(request);
  const loginUrl = new URL('/login?error=invite', origin);

  if (!isInviteToken(token)) {
    return NextResponse.redirect(loginUrl);
  }

  const invite = await prisma.houseInvite.findUnique({
    where: { token },
    select: { houseId: true },
  });

  if (!invite) {
    return NextResponse.redirect(loginUrl);
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (session?.user) {
    if (session.user.id) {
      const house = await prisma.house.findUnique({
        where: { id: invite.houseId },
        select: { ownerId: true },
      });

      if (house && house.ownerId !== session.user.id) {
        await prisma.houseMember.upsert({
          where: { houseId_userId: { houseId: invite.houseId, userId: session.user.id } },
          create: { id: newId('member'), houseId: invite.houseId, userId: session.user.id },
          update: {},
        });
      }
    }

    const nextPath = isInvitePlaceholderEmail(session.user.email) ? '/welcome' : '/';
    return NextResponse.redirect(new URL(nextPath, origin));
  }

  const email = newInvitePlaceholderEmail();

  try {
    const signUp = await auth.api.signUpEmail({
      body: {
        email,
        password: randomPassword(),
        name: INVITE_PLACEHOLDER_NAME,
      },
      asResponse: true,
    });

    if (!signUp.ok) {
      console.error('Invite sign-up failed', signUp.status, await signUp.text());
      return NextResponse.redirect(loginUrl);
    }

    const payload = (await signUp.json()) as { user?: { id?: string } };
    const userId = payload.user?.id;
    if (!userId) {
      return NextResponse.redirect(loginUrl);
    }

    await prisma.houseMember.upsert({
      where: { houseId_userId: { houseId: invite.houseId, userId } },
      create: { id: newId('member'), houseId: invite.houseId, userId },
      update: {},
    });

    const redirect = NextResponse.redirect(new URL('/welcome', origin));
    copyCookies(signUp, redirect);
    return redirect;
  } catch (error) {
    console.error('Invite sign-up failed', error);
    return NextResponse.redirect(loginUrl);
  }
}

function accountInviteErrorUrl(origin: string, token: string, error: string): URL {
  return new URL(`/invite/account/${encodeURIComponent(token)}?error=${error}`, origin);
}

function inviteName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('name');
  }
  return trimmed.slice(0, 200);
}

/** Accepts an account-only invite: creates a user and does not attach any house. */
export async function handleAccountInviteAccept(
  request: NextRequest,
  token: string
): Promise<NextResponse> {
  const origin = requestOrigin(request);
  const loginUrl = new URL('/login?error=invite', origin);
  const formUrl = (error: string) => accountInviteErrorUrl(origin, token, error);

  if (!isInviteToken(token)) {
    return NextResponse.redirect(loginUrl);
  }

  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');
  const submittedName = String(form.get('name') ?? '').trim();

  if (password.length < 8 || password !== confirmPassword) {
    return NextResponse.redirect(formUrl('password'));
  }

  const invite = await prisma.userInvite.findUnique({
    where: { token },
    select: { id: true, name: true, email: true, consumedAt: true },
  });

  if (!invite || invite.consumedAt) {
    return NextResponse.redirect(loginUrl);
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user) {
    return NextResponse.redirect(formUrl('session'));
  }

  let name: string;
  try {
    name = inviteName(submittedName || invite.name);
  } catch {
    return NextResponse.redirect(formUrl('name'));
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.redirect(formUrl('exists'));
  }

  const claimed = await prisma.userInvite.updateMany({
    where: { id: invite.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  if (claimed.count !== 1) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const signUp = await auth.api.signUpEmail({
      body: {
        email: invite.email,
        password,
        name,
      },
      asResponse: true,
    });

    if (!signUp.ok) {
      console.error('Account invite sign-up failed', signUp.status, await signUp.text());
      await prisma.userInvite.update({
        where: { id: invite.id },
        data: { consumedAt: null },
      });
      return NextResponse.redirect(formUrl('signup'));
    }

    const redirect = NextResponse.redirect(new URL('/', origin));
    copyCookies(signUp, redirect);
    return redirect;
  } catch (error) {
    console.error('Account invite sign-up failed', error);
    await prisma.userInvite.update({
      where: { id: invite.id },
      data: { consumedAt: null },
    });
    return NextResponse.redirect(formUrl('signup'));
  }
}
