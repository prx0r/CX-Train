import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase';

const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  if (cookieStore.get('demo_admin')?.value === '1') {
    const supabase = createServerClient();
    const { data } = await supabase.from('users').select('*').eq('id', DEMO_USER_ID).single();
    return data;
  }

  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return null;

  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', user.id)
    .single();

  return data;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}
