import { NextRequest, NextResponse } from 'next/server';
 

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      { error: 'Taxonomy apply-change is admin-only. Use the admin endpoint.' },
      { status: 403 }
    );
  } catch (err) {
    console.error('Taxonomy apply error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
