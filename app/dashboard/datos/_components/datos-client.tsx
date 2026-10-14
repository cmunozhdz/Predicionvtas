'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import { SafeDate } from '@/components/safe-format';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function DatosClient() {
  const [rows, setRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const fetchData = useCallback(async (p: number, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25', search: s });
      const res = await fetch(`/api/sheets/data?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data?.rows ?? []);
        setTotalRows(data?.totalRows ?? 0);
        setTotalPages(data?.totalPages ?? 1);
        setSyncedAt(data?.syncedAt ?? null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(page, search);
  }, [page, fetchData]);

  const handleSearch = () => {
    setPage(1);
    fetchData(1, search);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/sheets/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`✅ Sincronizado: ${data?.totalRows ?? 0} filas, ${data?.centers?.length ?? 0} centros, ${data?.skus?.length ?? 0} SKUs`);
        fetchData(page, search);
      } else {
        setSyncMsg(`❌ ${data?.error ?? 'Error'}`);
      }
    } catch {
      setSyncMsg('❌ Error de conexión');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">Datos del Sheet</h1>
            <p className="text-muted-foreground mt-1">Visualiza y sincroniza los datos de tu Google Sheet</p>
          </div>
          <div className="flex items-center gap-3">
            {syncedAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <SafeDate date={syncedAt} options={{ dateStyle: 'short', timeStyle: 'short' }} />
              </div>
            )}
            <Button onClick={handleSync} loading={syncing} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualizar ahora
            </Button>
          </div>
        </div>
      </FadeIn>

      {syncMsg && (
        <div className={`p-3 rounded-lg text-sm ${
          syncMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-700' : 'bg-destructive/10 text-destructive'
        }`}>
          {syncMsg}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">{totalRows} filas</CardTitle>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar SKU, centro..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSearch()}
                className="w-48"
              />
              <Button variant="outline" size="sm" onClick={handleSearch}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Año</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">SKU</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Centro</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Descripción</th>
                  {MONTH_LABELS.map((m: string) => (
                    <th key={m} className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={16} className="text-center py-8 text-muted-foreground">Cargando...</td></tr>
                ) : (rows ?? []).length === 0 ? (
                  <tr><td colSpan={16} className="text-center py-8 text-muted-foreground">Sin datos. Sincroniza tu Google Sheet.</td></tr>
                ) : (
                  (rows ?? []).map((row: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 px-2 font-mono text-xs">{row?.year ?? ''}</td>
                      <td className="py-2 px-2 font-medium text-xs">{row?.sku ?? ''}</td>
                      <td className="py-2 px-2 text-xs">{row?.center ?? ''}</td>
                      <td className="py-2 px-2 text-xs max-w-[150px] truncate">{row?.description ?? ''}</td>
                      {(row?.months ?? new Array(12).fill(0)).map((v: number, i: number) => (
                        <td key={i} className="py-2 px-2 text-right font-mono text-xs">
                          {(v ?? 0).toLocaleString('es-MX')}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
