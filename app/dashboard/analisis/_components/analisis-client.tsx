'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Download,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import { ForecastChart } from './forecast-chart';

const MODELS = [
  { id: 'media_movil', label: 'Media Móvil' },
  { id: 'holt', label: 'Holt (Doble Exp.)' },
  { id: 'holt_winters', label: 'Holt-Winters' },
  { id: 'regresion', label: 'Regresión Lineal' },
  { id: 'ensamble', label: 'Ensamble' },
];

const MODEL_COLORS: Record<string, string> = {
  'Media Móvil': '#60B5FF',
  'Holt (Doble Exponencial)': '#FF9149',
  'Holt-Winters (Estacional)': '#FF90BB',
  'Regresión Lineal': '#80D8C3',
  'Ensamble': '#A19AD3',
};

interface Forecast {
  model: string;
  predictions: { label: string; value: number; lower: number; upper: number }[];
  metrics: { mape: number; rmse: number; mae: number };
}

export function AnalisisClient() {
  const [centers, setCenters] = useState<string[]>([]);
  const [skus, setSkus] = useState<string[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['media_movil', 'holt_winters', 'ensamble']);
  const [timeSeries, setTimeSeries] = useState<{ label: string; value: number }[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetch('/api/sheets/data?limit=1');
        if (res.ok) {
          const data = await res.json();
          setCenters(data?.centers ?? []);
          setSkus(data?.skus ?? []);
        }
      } catch { /* ignore */ }
      setLoadingData(false);
    };
    loadFilters();
  }, []);

  const runPrediction = useCallback(async () => {
    if (selectedModels.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center: selectedCenter || undefined,
          sku: selectedSku || undefined,
          models: selectedModels,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Error al predecir');
        return;
      }
      setTimeSeries(data?.timeSeries ?? []);
      setForecasts(data?.forecasts ?? []);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [selectedCenter, selectedSku, selectedModels]);

  const toggleModel = (id: string) => {
    setSelectedModels((prev: string[]) =>
      prev.includes(id) ? prev.filter((m: string) => m !== id) : [...prev, id]
    );
  };

  const bestModel = forecasts.length > 0
    ? forecasts.reduce((best: Forecast, f: Forecast) => ((f.metrics?.mape ?? 999) < (best.metrics?.mape ?? 999) ? f : best))
    : null;

  const exportCsv = () => {
    if (forecasts.length === 0) return;
    const header = 'Modelo,Mes,Predicción,Límite Inferior,Límite Superior,MAPE,RMSE,MAE\n';
    const rows = forecasts.flatMap((f: Forecast) =>
      (f.predictions ?? []).map((p: any) =>
        `${f.model},${p.label},${p.value},${p.lower},${p.upper},${f.metrics?.mape ?? ''},${f.metrics?.rmse ?? ''},${f.metrics?.mae ?? ''}`
      )
    );
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predicciones_${selectedCenter || 'todos'}_${selectedSku || 'todos'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">Análisis y Predicción</h1>
            <p className="text-muted-foreground mt-1">Compara modelos y visualiza pronósticos</p>
          </div>
          {forecasts.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </FadeIn>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros y Modelos</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Centro Logístico</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={selectedCenter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCenter(e.target.value)}
              >
                <option value="">Todos los centros</option>
                {(centers ?? []).map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={selectedSku}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSku(e.target.value)}
              >
                <option value="">Todos los SKUs</option>
                {(skus ?? []).map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Modelos</label>
              <div className="flex flex-wrap gap-1.5">
                {MODELS.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => toggleModel(m.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                      selectedModels.includes(m.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={runPrediction} loading={loading} className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Calcular Predicción
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-3">Calculando predicciones...</p>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {!loading && forecasts.length > 0 && (
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico y Predicción</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] lg:h-[480px]">
                <ForecastChart
                  timeSeries={timeSeries}
                  forecasts={forecasts}
                  modelColors={MODEL_COLORS}
                />
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Metrics comparison table */}
      {!loading && forecasts.length > 0 && (
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparación de Modelos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">Modelo</th>
                      <th className="text-right py-3 px-3 font-medium text-muted-foreground">MAPE (%)</th>
                      <th className="text-right py-3 px-3 font-medium text-muted-foreground">RMSE</th>
                      <th className="text-right py-3 px-3 font-medium text-muted-foreground">MAE</th>
                      {(forecasts?.[0]?.predictions ?? []).map((p: any, i: number) => (
                        <th key={i} className="text-right py-3 px-3 font-medium text-muted-foreground">{p?.label ?? ''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(forecasts ?? []).map((f: Forecast) => {
                      const isBest = bestModel?.model === f.model;
                      return (
                        <tr key={f.model} className={`border-b last:border-0 ${isBest ? 'bg-primary/5' : ''}`}>
                          <td className="py-3 px-3 font-medium">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: MODEL_COLORS[f.model] ?? '#888' }}
                              />
                              {f.model}
                              {isBest && (
                                <Badge variant="default" className="text-xs gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Mejor
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono">{f.metrics?.mape?.toFixed(2) ?? '-'}</td>
                          <td className="py-3 px-3 text-right font-mono">{f.metrics?.rmse?.toFixed(2) ?? '-'}</td>
                          <td className="py-3 px-3 text-right font-mono">{f.metrics?.mae?.toFixed(2) ?? '-'}</td>
                          {(f.predictions ?? []).map((p: any, i: number) => (
                            <td key={i} className="py-3 px-3 text-right font-mono">
                              <div>{p?.value?.toLocaleString('es-MX') ?? '-'}</div>
                              <div className="text-xs text-muted-foreground">
                                [{p?.lower?.toLocaleString('es-MX') ?? '-'} - {p?.upper?.toLocaleString('es-MX') ?? '-'}]
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                * MAPE, RMSE y MAE calculados con backtesting sobre los últimos 12 meses de datos históricos. El modelo con menor MAPE se resalta como mejor.
              </p>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
