export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const cache = await prisma.sheetCache.findFirst();
    const lastSync = await prisma.syncLog.findFirst({ orderBy: { createdAt: 'desc' } });
    const config = await prisma.appConfig.findFirst();

    return NextResponse.json({
      hasData: !!cache,
      rowCount: cache?.rowCount ?? 0,
      centers: cache?.centers ?? 0,
      skus: cache?.skus ?? 0,
      syncedAt: cache?.syncedAt?.toISOString() ?? null,
      lastSyncStatus: lastSync?.status ?? null,
      lastSyncMessage: lastSync?.message ?? null,
      sheetConfigured: !!(config?.sheetUrl && config.sheetUrl !== 'https://docs.google.com/spreadsheets/d/PLACEHOLDER'),
    });
  } catch (err: any) {
    console.error('Status error:', err);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
