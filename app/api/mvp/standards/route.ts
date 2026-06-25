import { NextRequest, NextResponse } from 'next/server';
import { initTables, seedDefaults, getDefaultStandardsId } from '@/lib/mvp/db';
import { getManagerStandards, upsertManagerStandards } from '@/lib/mvp/query';

export async function GET() {
  try {
    initTables();
    seedDefaults();
    const standards = getManagerStandards();
    return NextResponse.json({ standards: standards || null });
  } catch (err) {
    console.error('[MVP] Get standards error:', err);
    return NextResponse.json({ error: 'Failed to load standards' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    initTables();
    seedDefaults();
    const body = await request.json();

    if (body.required_ticket_fields !== undefined && !Array.isArray(body.required_ticket_fields)) {
      return NextResponse.json({ error: 'required_ticket_fields must be an array' }, { status: 400 });
    }
    if (body.tone_preferences !== undefined && (typeof body.tone_preferences !== 'object' || body.tone_preferences === null || Array.isArray(body.tone_preferences))) {
      return NextResponse.json({ error: 'tone_preferences must be an object' }, { status: 400 });
    }

    upsertManagerStandards({
      id: getDefaultStandardsId(),
      org_id: 'org-default',
      manager_id: 'manager-default',
      required_ticket_fields_json: JSON.stringify(body.required_ticket_fields || []),
      call_requirements: body.call_requirements || null,
      escalation_requirements: body.escalation_requirements || null,
      tone_preferences_json: body.tone_preferences ? JSON.stringify(body.tone_preferences) : null,
      good_ticket_example: body.good_ticket_example || null,
      bad_ticket_example: body.bad_ticket_example || null,
      good_customer_update_example: body.good_customer_update_example || null,
      good_internal_note_example: body.good_internal_note_example || null,
      good_escalation_note_example: body.good_escalation_note_example || null,
    });

    const standards = getManagerStandards();
    return NextResponse.json({ standards, saved: true });
  } catch (err) {
    console.error('[MVP] Save standards error:', err);
    return NextResponse.json({ error: 'Failed to save standards' }, { status: 500 });
  }
}
