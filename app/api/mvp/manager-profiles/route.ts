import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables, seedDefaults } from '@/lib/mvp/db';
import { makeId } from '@/lib/mvp/query';

export async function GET() {
  try {
    initTables();
    seedDefaults();
    const db = getDb();
    const profiles = db.prepare('SELECT * FROM manager_profiles ORDER BY created_at DESC').all();
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error('[MVP] Get manager profiles error:', err);
    return NextResponse.json({ error: 'Failed to load manager profiles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    initTables();
    seedDefaults();
    const body = await request.json();
    const displayName = body.display_name || 'Unnamed Manager';
    const companyName = body.company_name || null;
    const role = body.role || null;

    const id = makeId();
    const db = getDb();
    db.prepare('INSERT INTO manager_profiles (id, display_name, company_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))').run(
      id, displayName, companyName, role
    );
    const profile = db.prepare('SELECT * FROM manager_profiles WHERE id = ?').get(id);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    console.error('[MVP] Create manager profile error:', err);
    return NextResponse.json({ error: 'Failed to create manager profile' }, { status: 500 });
  }
}
