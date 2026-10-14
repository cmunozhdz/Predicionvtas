'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Save,
  TestTube,
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  Mail,
  Clock,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';

export function ConfigClient() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setSheetUrl(data?.sheetUrl ?? '');
          setAdminEmail(data?.adminEmail ?? '');
          setRefreshInterval(data?.refreshInterval ?? 24);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl, adminEmail, refreshInterval }),
      });
      if (res.ok) {
        setMessage('✅ Configuración guardada correctamente');
      } else {
        const data = await res.json();
        setMessage(`❌ ${data?.error ?? 'Error al guardar'}`);
      }
    } catch {
      setMessage('❌ Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, errors: ['Error de conexión'] });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <FadeIn>
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground mt-1">Administra la conexión al Google Sheet y preferencias</p>
        </div>
      </FadeIn>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Google Sheet
          </CardTitle>
          <CardDescription>
            Pega la URL completa de tu hoja de cálculo de Google Sheets. Asegúrate de que esté compartida con &quot;Cualquiera con el enlace&quot; o con los miembros del equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sheetUrl">URL del Google Sheet</Label>
            <Input
              id="sheetUrl"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSheetUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Formato esperado: Año, SKU, Centro, Descripción, Ene, Feb, Mar, Abr, May, Jun, Jul, Ago, Sep, Oct, Nov, Dic
            </p>
          </div>

          <Button onClick={handleTest} loading={testing} variant="outline" className="gap-2">
            <TestTube className="w-4 h-4" />
            Probar Conexión
          </Button>

          {testResult && (
            <div className={`p-4 rounded-lg ${
              testResult.success ? 'bg-emerald-500/10' : 'bg-destructive/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.success
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  : <XCircle className="w-5 h-5 text-destructive" />
                }
                <span className="font-medium text-sm">
                  {testResult.success ? 'Conexión exitosa' : 'Error de conexión'}
                </span>
              </div>
              {testResult.success && (
                <div className="space-y-1 text-sm">
                  <p>Filas de datos: <Badge variant="secondary">{testResult.totalRows ?? 0}</Badge></p>
                  <p>Centros: <Badge variant="secondary">{testResult.centers?.length ?? 0}</Badge></p>
                  <p>SKUs: <Badge variant="secondary">{testResult.skus?.length ?? 0}</Badge></p>
                  <p>Encabezados: <span className="text-muted-foreground">{(testResult.headers ?? []).join(', ')}</span></p>
                </div>
              )}
              {testResult.errors && (testResult.errors?.length ?? 0) > 0 && (
                <ul className="text-sm text-destructive space-y-1 mt-1">
                  {(testResult.errors ?? []).map((e: string, i: number) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Preferencias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="adminEmail">Email del administrador</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="admin@empresa.com"
              value={adminEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="refreshInterval">Intervalo de refresco automático (horas)</Label>
            <Input
              id="refreshInterval"
              type="number"
              min={1}
              max={168}
              value={refreshInterval}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefreshInterval(parseInt(e.target.value, 10) || 24)}
            />
            <p className="text-xs text-muted-foreground mt-1">El sistema re-leerá el Sheet automáticamente cada N horas</p>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-700' : 'bg-destructive/10 text-destructive'
        }`}>
          {message}
        </div>
      )}

      <Button onClick={handleSave} loading={saving} className="gap-2">
        <Save className="w-4 h-4" />
        Guardar Configuración
      </Button>
    </div>
  );
}
