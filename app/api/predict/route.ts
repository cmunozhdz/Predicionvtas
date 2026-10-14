export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { buildTimeSeries, type SheetRow } from '@/lib/sheets';
import { runForecasts } from '@/lib/predictions';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { center, sku, models, horizon = 3, maWindow = 12 } = body ?? {};

    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos un modelo de predicción' }, { status: 400 });
    }

    const cache = await prisma.sheetCache.findFirst();
    if (!cache) {
      return NextResponse.json({ error: 'No hay datos cargados. Sincroniza primero el Google Sheet.' }, { status: 400 });
    }

    let rows: SheetRow[] = [];
    try {
      rows = JSON.parse(cache.data ?? '[]');
    } catch {
      rows = [];
    }

    const timeSeries = buildTimeSeries(rows, center || undefined, sku || undefined);
    if (timeSeries.length < 3) {
      return NextResponse.json({ error: 'No hay suficientes datos para la combinación seleccionada (mínimo 3 puntos).' }, { status: 400 });
    }

    const values = timeSeries.map((p: any) => p?.value ?? 0);
    const lastPoint = timeSeries[timeSeries.length - 1];
    const lastYear = lastPoint?.year ?? 2025;
    const lastMonth = lastPoint?.month ?? 11;

    const forecasts = runForecasts({
      values,
      lastYear,
      lastMonth,
      models,
      horizon,
      maWindow,
    });

    return NextResponse.json({
      timeSeries: timeSeries.map((p: any) => ({ label: p?.label ?? '', value: p?.value ?? 0 })),
      forecasts,
      center: center || 'Todos',
      sku: sku || 'Todos',
    });
  } catch (err: any) {
    console.error('Predict error:', err);
    return NextResponse.json({ error: err?.message ?? 'Error al calcular predicciones' }, { status: 500 });
  }
}
