import { NextRequest, NextResponse } from 'next/server';
import { getTaxonomyItem, validateApiKey } from '@/lib/taxonomy-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const ok = await validateApiKey(apiKey);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { id } = await params;
    const item = await getTaxonomyItem(id);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    console.error('Taxonomy item error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
