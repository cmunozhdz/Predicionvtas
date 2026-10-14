export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchSheet } from '@/lib/sheets';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Get sheet URL from DB config or env
    const config = await prisma.appConfig.findFirst();
    const sheetUrl = config?.sheetUrl || process.env.GOOGLE_SHEET_URL || '';
    if (!sheetUrl || sheetUrl === 'https://docs.google.com/spreadsheets/d/PLACEHOLDER') {
      return NextResponse.json({ error: 'No se ha configurado la URL del Google Sheet. Ve a Configuración para agregarla.' }, { status: 400 });
    }

    const startTime = Date.now();
    const accessToken = (session as any)?.accessToken ?? undefined;
    const result = await fetchSheet(sheetUrl, accessToken);

    if ((result.errors?.length ?? 0) > 0) {
      await prisma.syncLog.create({
        data: { status: 'error', message: result.errors?.join('; ') ?? '', rowCount: 0, duration: Date.now() - startTime },
      });
      return NextResponse.json({ error: result.errors?.join('; ') ?? 'Error desconocido', headers: result.headers }, { status: 422 });
    }

    // Save cache
    const existing = await prisma.sheetCache.findFirst();
    const cacheData = {
      data: JSON.stringify(result.rows),
      rowCount: result.totalRows,
      centers: result.centers?.length ?? 0,
      skus: result.skus?.length ?? 0,
      syncedAt: new Date(),
    };

    if (existing) {
      await prisma.sheetCache.update({ where: { id: existing.id }, data: cacheData });
    } else {
      await prisma.sheetCache.create({ data: cacheData });
    }

    await prisma.syncLog.create({
      data: {
        status: 'success',
        message: `${result.totalRows} filas, ${result.centers?.length ?? 0} centros, ${result.skus?.length ?? 0} SKUs`,
        rowCount: result.totalRows,
        duration: Date.now() - startTime,
      },
    });

    return NextResponse.json({
      success: true,
      totalRows: result.totalRows,
      centers: result.centers,
      skus: result.skus,
      headers: result.headers,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: err?.message ?? 'Error al sincronizar' }, { status: 500 });
  }
}
