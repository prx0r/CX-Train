import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase';

export async function getCurrentUser() {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return null;

  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
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
