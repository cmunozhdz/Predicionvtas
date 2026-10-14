'use client';
import dynamic from 'next/dynamic';

interface ForecastChartProps {
  timeSeries: { label: string; value: number }[];
  forecasts: {
    model: string;
    predictions: { label: string; value: number; lower: number; upper: number }[];
  }[];
  modelColors: Record<string, string>;
}

const ForecastChartInner = dynamic<ForecastChartProps>(
  () => import('./forecast-chart-inner').then((mod: any) => mod.ForecastChartInner),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Cargando gráfico...</div> }
);

export function ForecastChart(props: ForecastChartProps) {
  return <ForecastChartInner {...props} />;
}
