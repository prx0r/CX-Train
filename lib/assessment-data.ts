import { createServerClient } from '@/lib/supabase';

export async function requireManagerTenant(user: { id: string; name: string; tenant_id?: string | null }) {
  const supabase = createServerClient();
  if (user.tenant_id) return user.tenant_id;

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: `${user.name}'s MSP` })
    .select('id')
    .single();
  if (tenantError || !tenant) throw new Error('Unable to provision manager tenant');

  const { error: userError } = await supabase
    .from('users')
    .update({ tenant_id: tenant.id })
    .eq('id', user.id);
  if (userError) throw new Error('Unable to assign manager tenant');
  return tenant.id as string;
}

export async function getInviteContext(token: string) {
  const supabase = createServerClient();
  const { data: invite } = await supabase
    .from('assessment_invites')
    .select(`
      id, token, expires_at, used_at,
      assessment_packs!inner (
        id, tenant_id, title, mode, difficulty, scenario_count, status, final_recommendation,
        candidates!inner (id, name, email)
      )
    `)
    .eq('token', token)
    .single();

  if (!invite) return { error: 'invalid' as const };
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'expired' as const };
  }
  const pack = Array.isArray(invite.assessment_packs)
    ? invite.assessment_packs[0]
    : invite.assessment_packs;
  if (!pack) return { error: 'invalid' as const };
  return { invite, pack };
}

export function publicScenario(scenario: Record<string, unknown>) {
  const { hidden_facts: _hiddenFacts, required_checkpoints: _required, ideal_ticket: _ideal, common_mistakes: _mistakes, ...safe } = scenario;
  return safe;
}
