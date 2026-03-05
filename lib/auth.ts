import { auth } from '@clerk/nextjs/server';
import { createServerClient } from './supabase';

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', userId)
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
