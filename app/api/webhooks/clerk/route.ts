import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const body = await request.text();

  const wh = new Webhook(webhookSecret);
  let event: { type: string; data: Record<string, unknown> };

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: Record<string, unknown> };
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServerClient();

  if (event.type === 'user.created') {
    const { id, first_name, last_name, email_addresses } = event.data as {
      id: string;
      first_name?: string;
      last_name?: string;
      email_addresses?: { email_address: string }[];
    };
    const name = [first_name, last_name].filter(Boolean).join(' ') || 'Unknown';
    const email = email_addresses?.[0]?.email_address || `${id}@clerk.user`;

    const { error } = await supabase.from('users').insert({
      clerk_id: id,
      name,
      email,
      role: 'trainee',
    });

    if (error) {
      console.error('Failed to create user:', error);
      return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
    }
  } else if (event.type === 'user.updated') {
    const { id, first_name, last_name, email_addresses } = event.data as {
      id: string;
      first_name?: string;
      last_name?: string;
      email_addresses?: { email_address: string }[];
    };
    const name = [first_name, last_name].filter(Boolean).join(' ') || 'Unknown';
    const email = email_addresses?.[0]?.email_address || '';

    await supabase.from('users').update({ name, email }).eq('clerk_id', id);
  }

  return NextResponse.json({ received: true });
}
