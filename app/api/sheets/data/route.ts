export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const search = searchParams.get('search') ?? '';

    const cache = await prisma.sheetCache.findFirst();
    if (!cache) {
      return NextResponse.json({ rows: [], totalRows: 0, centers: [], skus: [], syncedAt: null });
    }

    let rows: any[] = [];
    try {
      rows = JSON.parse(cache.data ?? '[]');
    } catch {
      rows = [];
    }

    // Filter
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r: any) =>
        (r?.sku ?? '').toLowerCase().includes(s) ||
        (r?.center ?? '').toLowerCase().includes(s) ||
        (r?.description ?? '').toLowerCase().includes(s)
      );
    }

    const totalRows = rows?.length ?? 0;
    const centers = [...new Set((rows ?? []).map((r: any) => r?.center ?? ''))].sort();
    const skus = [...new Set((rows ?? []).map((r: any) => r?.sku ?? ''))].sort();

    // Paginate
    const start = (page - 1) * limit;
    const paginatedRows = rows.slice(start, start + limit);

    return NextResponse.json({
      rows: paginatedRows,
      totalRows,
      centers,
      skus,
      syncedAt: cache.syncedAt?.toISOString() ?? null,
      page,
      totalPages: Math.ceil(totalRows / limit),
    });
  } catch (err: any) {
    console.error('Data fetch error:', err);
    return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
  }
}
