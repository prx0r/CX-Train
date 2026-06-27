import { NextResponse } from 'next/server';
import { listPacks } from '@/lib/mvp/sim/packRegistry';
import { ENABLED_TRAINING_DRILL_PACKS } from '@/lib/mvp/assignment-types';

export async function GET() {
  const allPacks = listPacks();
  const enabledPacks = allPacks.filter(p => ENABLED_TRAINING_DRILL_PACKS.includes(p.id));
  return NextResponse.json({ packs: enabledPacks });
}
