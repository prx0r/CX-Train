import { createServerClient } from '@/lib/supabase';

export async function validateGptActionKey(apiKey: string | null) {
  if (!apiKey) return false;
  const supabase = createServerClient();
  const { data } = await supabase.from('bots').select('id').eq('id', 'call_sim').eq('api_key', apiKey).single();
  return Boolean(data);
}

export function sameCandidateName(expected: string, supplied: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
  return normalize(expected) === normalize(supplied);
}
