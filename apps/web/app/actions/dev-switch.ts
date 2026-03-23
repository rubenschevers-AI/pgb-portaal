'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Dev-only: switches the active session to a test account.
 *
 * Strategy A: repair user via admin API → signInWithPassword server-side
 * Strategy B: generate magic link OTP → verifyOtp server-side
 */
export async function devSwitchAction(email: string): Promise<{ ok: true } | { error: string }> {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Niet beschikbaar in productie' };
  }

  const admin = createAdminClient();

  // Step 1: find user by email via admin API to confirm GoTrue can now load them
  const { data: userData, error: findError } = await admin.auth.admin.listUsers();
  const user = userData?.users?.find(u => u.email === email);

  if (findError || !user) {
    return { error: `Gebruiker niet gevonden: ${findError?.message ?? email}` };
  }

  // Step 2: ensure user is confirmed and has a known password
  await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    password: 'Test1234!',
  });

  // Step 3: sign in server-side (sets auth cookies via @supabase/ssr)
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: 'Test1234!',
  });

  if (!signInError) {
    return { ok: true };
  }

  // Step 4 (fallback): use magic link OTP if password sign-in still fails
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData?.properties) {
    return { error: `signInWithPassword: ${signInError.message} | generateLink: ${linkError?.message ?? 'geen data'}` };
  }

  const otp = linkData.properties.email_otp;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
    body: JSON.stringify({ email, token: otp, type: 'email' }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.text();
    return { error: `signInWithPassword: ${signInError.message} | verifyOtp: ${body}` };
  }

  const session = await verifyRes.json();
  if (!session.access_token) {
    return { error: 'Geen access token na OTP verify' };
  }

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return { ok: true };
}
