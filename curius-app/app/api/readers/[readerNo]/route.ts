import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// A single reader's public profile: catalogue number, taste fingerprint,
// shelf size, activity dates. Pseudonymous by design -- no name fields exist
// in the RPC's return shape.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ readerNo: string }> }
) {
  try {
    const { readerNo } = await params;
    const parsed = parseInt(readerNo, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json({ error: 'Invalid reader number' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('get_reader_profile', {
      p_reader_no: parsed,
    });

    if (error) {
      console.error('Reader profile error:', error);
      return NextResponse.json({ error: 'Failed to fetch reader' }, { status: 500 });
    }

    const profile = Array.isArray(data) ? data[0] : data;
    if (!profile) {
      return NextResponse.json({ error: 'No reader with that number' }, { status: 404 });
    }

    return NextResponse.json({ data: profile }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
