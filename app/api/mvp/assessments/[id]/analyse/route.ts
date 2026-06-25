import { NextRequest, NextResponse } from 'next/server';
import { initTables, seedDefaults } from '@/lib/mvp/db';
import { runBaseCallumAnalysis } from '@/lib/mvp/analysis/runBaseCallumAnalysis';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initTables();
    seedDefaults();

    const result = await runBaseCallumAnalysis(params.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[MVP] Analyse error:', err);
    return NextResponse.json({ error: 'Failed to analyse assessment', details: String(err) }, { status: 500 });
  }
}
