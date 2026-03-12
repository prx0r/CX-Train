import { NextRequest, NextResponse } from 'next/server';
import { searchTaxonomy, validateApiKey } from '@/lib/taxonomy-db';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const ok = await validateApiKey(apiKey);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(20, Number(limitParam))) : 5;

    const results = await searchTaxonomy(query, limit);

    return NextResponse.json({
      query,
      results,
    });
  } catch (err) {
    console.error('Taxonomy search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
