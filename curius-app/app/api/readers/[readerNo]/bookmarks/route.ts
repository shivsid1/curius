import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { clampPagination } from '@/lib/api-pagination';

export const dynamic = 'force-dynamic';

// A reader's shelf: their catalogued bookmarks, newest first, with an
// optional topic filter. Bookmark data only -- nothing identifying.
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

    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = clampPagination(searchParams, { defaultLimit: 20 });
    const topic = searchParams.get('topic');
    const offset = (page - 1) * limit;

    const { data, error } = await supabase.rpc('get_reader_shelf', {
      p_reader_no: parsed,
      p_topic: topic || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Reader shelf error:', error);
      return NextResponse.json({ error: 'Failed to fetch shelf' }, { status: 500 });
    }

    type Row = {
      id: number;
      link: string;
      title: string | null;
      domain: string;
      saves_count: number;
      saved_at: string | null;
      topic: string | null;
      total_count: number;
    };

    const rows = (data ?? []) as Row[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: rows.map(({ total_count: _t, ...bookmark }) => bookmark),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      filters: { topic },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
