import { NextResponse } from 'next/server';
import { listPacks } from '@/lib/mvp/sim/packRegistry';
import { listHiringPacks } from '@/lib/mvp/sim/hiringPacks';
import { ENABLED_TRAINING_DRILL_PACKS } from '@/lib/mvp/assignment-types';

export async function GET() {
  const allPacks = listPacks();
  const enabledPacks = allPacks.filter(p => ENABLED_TRAINING_DRILL_PACKS.includes(p.id));
  const hiringPacks = listHiringPacks().map(hp => ({
    id: hp.id,
    title: hp.title,
    description: hp.description,
    difficulty: hp.difficulty,
    customer: hp.customer,
  }));
  return NextResponse.json({ packs: enabledPacks, hiringPacks });
}
