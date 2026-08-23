import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { clampPagination } from '@/lib/api-pagination';

export const dynamic = 'force-dynamic';

// Directory of notable readers: pseudonymous identities only (reader_no,
// taste fingerprint, shelf size, activity). Never returns usernames or names.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = clampPagination(searchParams, { defaultLimit: 24 });
    const sortParam = searchParams.get('sort');
    const sort = sortParam === 'shelf_size' ? 'shelf_size' : 'active';
    const offset = (page - 1) * limit;

    const { data, error } = await supabase.rpc('get_reader_directory', {
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Reader directory error:', error);
      return NextResponse.json({ error: 'Failed to fetch readers' }, { status: 500 });
    }

    type Row = {
      reader_no: number;
      bookmark_count: number;
      taste_fingerprint: Array<{ topic: string; percentage: number }> | null;
      last_active: string | null;
      total_count: number;
    };

    const rows = (data ?? []) as Row[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: rows.map(({ total_count: _t, ...reader }) => reader),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      sort,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
