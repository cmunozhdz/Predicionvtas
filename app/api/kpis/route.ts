export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { buildTimeSeries, type SheetRow } from '@/lib/sheets';
import { runForecasts } from '@/lib/predictions';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const cache = await prisma.sheetCache.findFirst();
    if (!cache) {
      return NextResponse.json({
        totalLastYear: 0,
        variation: 0,
        forecast3m: 0,
        activeSKUs: 0,
        centers: 0,
        syncedAt: null,
      });
    }

    let rows: SheetRow[] = [];
    try {
      rows = JSON.parse(cache.data ?? '[]');
    } catch {
      rows = [];
    }

    // Find years
    const years = [...new Set(rows.map((r: any) => r?.year ?? 0))].sort();
    const lastYear = years[years.length - 1] ?? 0;
    const prevYear = years.length >= 2 ? years[years.length - 2] : null;

    // Total last year
    const lastYearRows = rows.filter((r: any) => r?.year === lastYear);
    const totalLastYear = lastYearRows.reduce((sum: number, r: any) => {
      const monthSum = (r?.months ?? []).reduce((s: number, v: number) => s + (v ?? 0), 0);
      return sum + monthSum;
    }, 0);

    // Total prev year
    let variation = 0;
    if (prevYear) {
      const prevRows = rows.filter((r: any) => r?.year === prevYear);
      const totalPrev = prevRows.reduce((sum: number, r: any) => {
        const monthSum = (r?.months ?? []).reduce((s: number, v: number) => s + (v ?? 0), 0);
        return sum + monthSum;
      }, 0);
      if (totalPrev > 0) {
        variation = ((totalLastYear - totalPrev) / totalPrev) * 100;
      }
    }

    // Quick forecast (ensemble) for 3 months
    const ts = buildTimeSeries(rows);
    let forecast3m = 0;
    if (ts.length >= 3) {
      const values = ts.map((p: any) => p?.value ?? 0);
      const lastPoint = ts[ts.length - 1];
      const forecasts = runForecasts({
        values,
        lastYear: lastPoint?.year ?? lastYear,
        lastMonth: lastPoint?.month ?? 11,
        models: ['media_movil', 'holt', 'holt_winters', 'regresion', 'ensamble'],
        horizon: 3,
      });
      const ensembleForecast = forecasts.find((f: any) => f?.model === 'Ensamble');
      if (ensembleForecast) {
        forecast3m = (ensembleForecast.predictions ?? []).reduce((s: number, p: any) => s + (p?.value ?? 0), 0);
      }
    }

    const centersSet = new Set(rows.map((r: any) => r?.center ?? ''));
    const skusSet = new Set(rows.map((r: any) => r?.sku ?? ''));

    return NextResponse.json({
      totalLastYear: Math.round(totalLastYear),
      variation: Math.round(variation * 100) / 100,
      forecast3m: Math.round(forecast3m),
      activeSKUs: skusSet.size,
      centers: centersSet.size,
      syncedAt: cache.syncedAt?.toISOString() ?? null,
      lastYear,
    });
  } catch (err: any) {
    console.error('KPIs error:', err);
    return NextResponse.json({ error: 'Error al calcular KPIs' }, { status: 500 });
  }
}
