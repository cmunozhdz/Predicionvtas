export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchSheet } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await request.json();
    const { sheetUrl } = body ?? {};
    if (!sheetUrl) {
      return NextResponse.json({ error: 'Proporciona una URL de Google Sheet' }, { status: 400 });
    }

    const accessToken = (session as any)?.accessToken ?? undefined;
    const result = await fetchSheet(sheetUrl, accessToken);

    return NextResponse.json({
      success: (result.errors?.length ?? 0) === 0,
      totalRows: result.totalRows,
      headers: result.headers,
      centers: result.centers,
      skus: result.skus,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error('Test connection error:', err);
    return NextResponse.json({ error: err?.message ?? 'Error de conexión' }, { status: 500 });
  }
}
