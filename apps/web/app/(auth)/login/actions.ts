'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const code = error.code ?? error.message;
    if (code.includes('invalid_credentials') || code.includes('Invalid login'))
      return { error: 'E-mailadres of wachtwoord is onjuist.' };
    if (code.includes('user_not_found') || code.includes('User not found'))
      return { error: 'Er bestaat geen account met dit e-mailadres.' };
    if (code.includes('email_not_confirmed'))
      return { error: 'E-mailadres is nog niet bevestigd. Controleer je inbox.' };
    if (code.includes('too_many_requests') || code.includes('rate'))
      return { error: 'Te veel pogingen. Wacht even en probeer opnieuw.' };
    if (code.includes('network') || code.includes('fetch'))
      return { error: 'Geen verbinding. Controleer je internet.' };
    return { error: 'Inloggen mislukt: ' + error.message };
  }

  redirect('/dashboard');
}
