'use client';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

interface ForecastChartInnerProps {
  timeSeries: { label: string; value: number }[];
  forecasts: {
    model: string;
    predictions: { label: string; value: number; lower: number; upper: number }[];
  }[];
  modelColors: Record<string, string>;
}

export function ForecastChartInner({ timeSeries, forecasts, modelColors }: ForecastChartInnerProps) {
  const chartData = useMemo(() => {
    const historicalData: any[] = (timeSeries ?? []).map((p: any) => ({
      label: p?.label ?? '',
      actual: p?.value ?? 0,
    }));

    const forecastLabels = (forecasts?.[0]?.predictions ?? []).map((p: any) => p?.label ?? '');
    const forecastData = forecastLabels.map((label: string, i: number) => {
      const point: any = { label, isForecast: true };
      for (const f of (forecasts ?? [])) {
        const pred = f.predictions?.[i];
        const modelKey = (f.model ?? '').replace(/[^a-zA-Z0-9]/g, '_');
        point[modelKey] = pred?.value ?? 0;
        point[`${modelKey}_band`] = [pred?.lower ?? 0, pred?.upper ?? 0];
      }
      return point;
    });

    // Connect last historical to first forecast
    const lastHistorical = historicalData[historicalData.length - 1];
    if (lastHistorical && forecastData.length > 0) {
      for (const f of (forecasts ?? [])) {
        const modelKey = (f.model ?? '').replace(/[^a-zA-Z0-9]/g, '_');
        lastHistorical[modelKey] = lastHistorical.actual;
      }
    }

    return [...historicalData, ...forecastData];
  }, [timeSeries, forecasts]);

  const displayData = useMemo(() => {
    const forecastCount = forecasts?.[0]?.predictions?.length ?? 3;
    const histCount = chartData.length - forecastCount;
    const showFrom = Math.max(0, histCount - 24);
    return chartData.slice(showFrom);
  }, [chartData, forecasts]);

  const dividerLabel = useMemo(() => {
    const idx = displayData.findIndex((d: any) => d?.isForecast) - 1;
    return idx >= 0 ? displayData[idx]?.label : null;
  }, [displayData]);

  if (!displayData?.length) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos para graficar</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={displayData} margin={{ top: 10, right: 10, bottom: 50, left: 10 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          height={60}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          tick={{ fontSize: 10 }}
          label={{ value: 'Unidades', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />

        {dividerLabel && (
          <ReferenceLine
            x={dividerLabel}
            stroke="#aaa"
            strokeDasharray="4 4"
            label={{ value: 'Predicción →', position: 'top', fontSize: 10, fill: '#999' }}
          />
        )}

        {/* Confidence bands */}
        {(forecasts ?? []).map((f: any) => {
          const modelKey = (f.model ?? '').replace(/[^a-zA-Z0-9]/g, '_');
          const color = modelColors?.[f.model] ?? '#888';
          return (
            <Area
              key={`band_${modelKey}`}
              dataKey={`${modelKey}_band`}
              fill={color}
              fillOpacity={0.1}
              stroke="none"
              name={`IC ${f.model}`}
              legendType="none"
              connectNulls={false}
            />
          );
        })}

        {/* Actual line */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#1a6cb5"
          strokeWidth={2.5}
          dot={false}
          name="Ventas reales"
          connectNulls={false}
        />

        {/* Model prediction lines */}
        {(forecasts ?? []).map((f: any) => {
          const modelKey = (f.model ?? '').replace(/[^a-zA-Z0-9]/g, '_');
          const color = modelColors?.[f.model] ?? '#888';
          return (
            <Line
              key={modelKey}
              type="monotone"
              dataKey={modelKey}
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: color }}
              name={f.model}
              connectNulls={false}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
