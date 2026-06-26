import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';
import { DEFAULT_TICKET_TAXONOMY } from '@/lib/mvp/taxonomy/defaultTicketTaxonomy';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT type, sub_type, item, escalation_guidance, keywords FROM taxonomy_items ORDER BY type, sub_type, item').all() as any[];

  const typeMap: Record<string, Set<string>> = {};
  const subTypeItems: Record<string, Set<string>> = {};
  const escalationBySubType: Record<string, string[]> = {};

  for (const r of rows) {
    if (!typeMap[r.type]) typeMap[r.type] = new Set();
    typeMap[r.type].add(r.sub_type);

    const key = `${r.type}|${r.sub_type}`;
    if (!subTypeItems[key]) subTypeItems[key] = new Set();
    if (r.item) subTypeItems[key].add(r.item);

    if (r.escalation_guidance) {
      if (!escalationBySubType[r.sub_type]) escalationBySubType[r.sub_type] = [];
      if (!escalationBySubType[r.sub_type].includes(r.escalation_guidance)) {
        escalationBySubType[r.sub_type].push(r.escalation_guidance);
      }
    }
  }

  const typeOptions = Object.keys(typeMap).map(t => ({
    id: t.toLowerCase().replace(/\s+/g, '_'),
    label: t,
    description: getTypeDescription(t),
    scoringTags: [`ticket.type.${t.toLowerCase().replace(/\s+/g, '_')}`],
  }));

  const categoryTree = Object.entries(typeMap).map(([typeName, subTypes]) => ({
    id: typeName.toLowerCase().replace(/\s+/g, '_'),
    label: typeName,
    subcategories: Array.from(subTypes).map(st => {
      const key = `${typeName}|${st}`;
      const items = subTypeItems[key];
      return {
        id: st.toLowerCase().replace(/[\s/]+/g, '_'),
        label: st,
        escalationGuidance: escalationBySubType[st] || undefined,
        ...(items && items.size > 0 ? {
          items: Array.from(items).map(item => ({
            id: item.toLowerCase().replace(/[\s/]+/g, '_'),
            label: item,
            scoringTags: [`ticket.item.${item.toLowerCase().replace(/[\s/]+/g, '_')}`],
          })),
        } : {}),
      };
    }),
  }));

  return NextResponse.json({
    typeOptions,
    categoryTree,
    impactOptions: DEFAULT_TICKET_TAXONOMY.impactOptions,
    urgencyOptions: DEFAULT_TICKET_TAXONOMY.urgencyOptions,
    priorityOptions: DEFAULT_TICKET_TAXONOMY.priorityOptions,
    totalTaxonomyItems: rows.length,
  });
}

function getTypeDescription(type: string): string {
  const descs: Record<string, string> = {
    Incident: 'Service interruption or quality reduction requiring restoration',
    Request: 'Standard request for service, access, or information',
  };
  return descs[type] || type;
}
