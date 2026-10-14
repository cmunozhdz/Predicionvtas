'use client';
import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  TrendingUp,
  TrendingDown,
  Target,
  Warehouse,
  RefreshCw,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { FadeIn, SlideIn } from '@/components/ui/animate';
import { SafeDate } from '@/components/safe-format';

interface KPIs {
  totalLastYear: number;
  variation: number;
  forecast3m: number;
  activeSKUs: number;
  centers: number;
  syncedAt: string | null;
  lastYear?: number;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <span ref={ref}>{display?.toLocaleString('es-MX')}{suffix}</span>;
}

export function DashboardHome() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const fetchKpis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kpis');
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
        setError('');
      }
    } catch {
      setError('Error al cargar KPIs');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sheets/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Error al sincronizar');
      } else {
        setError('');
        await fetchKpis();
      }
    } catch {
      setError('Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  const hasData = kpis && (kpis.totalLastYear > 0 || kpis.activeSKUs > 0);

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">Panel General</h1>
            <p className="text-muted-foreground mt-1">Resumen de ventas e indicadores clave</p>
          </div>
          <div className="flex items-center gap-3">
            {kpis?.syncedAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Última sync: <SafeDate date={kpis.syncedAt} options={{ dateStyle: 'short', timeStyle: 'short' }} /></span>
              </div>
            )}
            <Button onClick={handleSync} loading={syncing} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualizar datos
            </Button>
          </div>
        </div>
      </FadeIn>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Error</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!hasData && !loading && (
        <SlideIn from="bottom">
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Warehouse className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin datos cargados</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Configura la URL de tu Google Sheet en la sección de Configuración, luego presiona &quot;Actualizar datos&quot; para sincronizar.
              </p>
              <Button onClick={handleSync} loading={syncing} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Sincronizar ahora
              </Button>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {loading && !kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i: number) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SlideIn from="bottom" delay={0}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Total {kpis?.lastYear ?? ''}</p>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl lg:text-3xl font-bold font-mono mt-2">
                    <AnimatedNumber value={kpis?.totalLastYear ?? 0} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">unidades de inventario</p>
                </CardContent>
              </Card>
            </SlideIn>

            <SlideIn from="bottom" delay={0.05}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Variación Anual</p>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      (kpis?.variation ?? 0) >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'
                    }`}>
                      {(kpis?.variation ?? 0) >= 0
                        ? <TrendingUp className="w-5 h-5 text-emerald-600" />
                        : <TrendingDown className="w-5 h-5 text-destructive" />
                      }
                    </div>
                  </div>
                  <p className={`text-2xl lg:text-3xl font-bold font-mono mt-2 ${
                    (kpis?.variation ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'
                  }`}>
                    {(kpis?.variation ?? 0) >= 0 ? '+' : ''}
                    <AnimatedNumber value={Math.round(Math.abs(kpis?.variation ?? 0) * 100) / 100} suffix="%" />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">vs año anterior</p>
                </CardContent>
              </Card>
            </SlideIn>

            <SlideIn from="bottom" delay={0.1}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Pronóstico 3 meses</p>
                    <div className="w-9 h-9 rounded-lg bg-secondary/20 flex items-center justify-center">
                      <Target className="w-5 h-5 text-secondary" />
                    </div>
                  </div>
                  <p className="text-2xl lg:text-3xl font-bold font-mono mt-2">
                    <AnimatedNumber value={kpis?.forecast3m ?? 0} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">unidades estimadas (ensamble)</p>
                </CardContent>
              </Card>
            </SlideIn>

            <SlideIn from="bottom" delay={0.15}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">SKUs · Centros</p>
                    <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-accent-foreground" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3 mt-2">
                    <p className="text-2xl lg:text-3xl font-bold font-mono">
                      <AnimatedNumber value={kpis?.activeSKUs ?? 0} />
                    </p>
                    <Badge variant="secondary" className="font-mono">
                      {kpis?.centers ?? 0} centros
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">productos activos</p>
                </CardContent>
              </Card>
            </SlideIn>
          </div>
        </>
      )}
    </div>
  );
}
