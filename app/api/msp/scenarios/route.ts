import { NextRequest, NextResponse } from 'next/server';
import { getScenariosForRole } from '@/lib/msp';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = (searchParams.get('role') || 't1') as 't1' | 't2' | 'manager';
  const scenarios = await getScenariosForRole(role);
  return NextResponse.json({ scenarios, total: scenarios.length });
}
