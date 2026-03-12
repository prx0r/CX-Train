import { createServerClient } from '@/lib/supabase';

export type TaxonomyItem = {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  description: string;
  triage_questions?: string[];
  triage_steps?: string[];
  resolution_steps?: string[];
  escalation_policy?: string;
  severity_guidance?: string;
  impact_guidance?: string;
  first_call_resolution?: boolean;
  owner?: string;
  examples?: string[];
  last_reviewed?: string;
  updated_at?: string;
};

export type TaxonomyChange = {
  id: string;
  change_type: 'add' | 'update' | 'delete';
  proposed_by: string;
  reason: string;
  item?: TaxonomyItem;
  target_id?: string;
  status?: string;
  created_at?: string;
  applied_at?: string | null;
};

export async function validateApiKey(apiKey: string, botId?: string): Promise<boolean> {
  const supabase = createServerClient();
  const query = supabase.from('bots').select('id').eq('api_key', apiKey);
  const { data, error } = botId ? await query.eq('id', botId).single() : await query.limit(1).single();
  return Boolean(data && !error);
}

export async function searchTaxonomy(query: string, limit = 5): Promise<TaxonomyItem[]> {
  const supabase = createServerClient();
  const q = query.trim();
  if (!q) return [];

  const { data } = await supabase
    .from('taxonomy_items')
    .select('*')
    .textSearch('search_tsv', q, { type: 'websearch', config: 'simple' })
    .limit(limit);

  return (data as TaxonomyItem[]) ?? [];
}

export async function getTaxonomyItem(id: string): Promise<TaxonomyItem | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('taxonomy_items').select('*').eq('id', id).single();
  return (data as TaxonomyItem) ?? null;
}

export async function proposeChange(change: Omit<TaxonomyChange, 'id'>): Promise<TaxonomyChange> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('taxonomy_changes')
    .insert({
      change_type: change.change_type,
      proposed_by: change.proposed_by,
      reason: change.reason,
      item: change.item ?? null,
      target_id: change.target_id ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create proposal');
  }
  return data as TaxonomyChange;
}

export async function applyChange(proposalId: string): Promise<{ item_count: number }>{
  const supabase = createServerClient();
  const { data: proposal } = await supabase
    .from('taxonomy_changes')
    .select('*')
    .eq('id', proposalId)
    .single();

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  const change = proposal as TaxonomyChange;
  if (change.status && change.status !== 'proposed') {
    throw new Error('Proposal already processed');
  }

  if (change.change_type === 'add') {
    if (!change.item) throw new Error('Proposal item missing');
    const { data: existing } = await supabase
      .from('taxonomy_items')
      .select('id')
      .eq('id', change.item.id)
      .single();
    if (existing) throw new Error('Item already exists');
    await supabase.from('taxonomy_items').insert(change.item);
  }

  if (change.change_type === 'update') {
    const targetId = change.target_id || change.item?.id;
    if (!targetId || !change.item) throw new Error('Update requires target_id and item');
    await supabase.from('taxonomy_items').update(change.item).eq('id', targetId);
  }

  if (change.change_type === 'delete') {
    if (!change.target_id) throw new Error('Delete requires target_id');
    await supabase.from('taxonomy_items').delete().eq('id', change.target_id);
  }

  await supabase
    .from('taxonomy_changes')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', proposalId);

  const { data: countData } = await supabase.from('taxonomy_items').select('id');
  return { item_count: (countData ?? []).length };
}
