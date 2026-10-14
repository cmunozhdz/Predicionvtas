// Google Sheets live reader - server-side only

const MONTH_MAP: Record<string, number> = {
  enero: 0, ene: 0, jan: 0, january: 0,
  febrero: 1, feb: 1, february: 1,
  marzo: 2, mar: 2, march: 2,
  abril: 3, abr: 3, apr: 3, april: 3,
  mayo: 4, may: 4,
  junio: 5, jun: 5, june: 5,
  julio: 6, jul: 6, july: 6,
  agosto: 7, ago: 7, aug: 7, august: 7,
  septiembre: 8, sep: 8, sept: 8, september: 8,
  octubre: 9, oct: 9, october: 9,
  noviembre: 10, nov: 10, november: 10,
  diciembre: 11, dic: 11, dec: 11, december: 11,
};

const YEAR_ALIASES = ['año', 'ano', 'year', 'anio'];
const SKU_ALIASES = ['sku', 'código', 'codigo', 'code', 'clave'];
const CENTER_ALIASES = ['centro', 'centro logístico', 'centro logistico', 'almacén', 'almacen', 'warehouse', 'center', 'cedis', 'centro logistico'];
const DESC_ALIASES = ['descripción', 'descripcion', 'description', 'desc', 'nombre', 'producto', 'desc. material', 'material'];

function normalise(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function detectColumn(headers: string[], aliases: string[]): number {
  for (let i = 0; i < (headers?.length ?? 0); i++) {
    const h = normalise(headers?.[i] ?? '');
    if (aliases.some((a: string) => h === a || h.includes(a))) return i;
  }
  return -1;
}

function detectMonthColumns(headers: string[]): { index: number; month: number }[] {
  const result: { index: number; month: number }[] = [];
  for (let i = 0; i < (headers?.length ?? 0); i++) {
    const h = normalise(headers?.[i] ?? '');
    const m = MONTH_MAP[h];
    if (m !== undefined) result.push({ index: i, month: m });
  }
  return result;
}

export function extractSheetId(url: string): string | null {
  const match = (url ?? '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export interface SheetRow {
  year: number;
  sku: string;
  center: string;
  description: string;
  months: number[]; // 12 values
}

export interface ParseResult {
  rows: SheetRow[];
  centers: string[];
  skus: string[];
  totalRows: number;
  headers: string[];
  errors: string[];
}

// ---------- CSV fallback for public sheets (no API key needed) ----------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { current.push(cell); cell = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        current.push(cell); cell = ''; rows.push(current); current = [];
        if (ch === '\r') i++;
      } else { cell += ch; }
    }
  }
  if (cell || current.length) { current.push(cell); rows.push(current); }
  return rows;
}

async function fetchViaCSVExport(sheetId: string): Promise<string[][]> {
  // Public CSV export — works for any Sheet shared as "Anyone with the link"
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(csvUrl, { cache: 'no-store', redirect: 'follow' });
  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error('Sin acceso al Sheet. Asegúrate de que esté compartido con "Cualquiera con el enlace" (lector).');
    }
    throw new Error(`Error al exportar el Sheet como CSV (${res.status})`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/csv') && !contentType.includes('text/plain') && !contentType.includes('application/csv')) {
    // Google may return an HTML sign-in page
    throw new Error('No se pudo acceder al Sheet. Verifica que esté compartido como "Cualquiera con el enlace" (lector) y que la URL sea correcta.');
  }
  const text = await res.text();
  return parseCSV(text);
}

async function fetchViaAPI(sheetId: string, accessToken?: string): Promise<string[][]> {
  let metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
  const hdrs: Record<string, string> = {};
  if (accessToken) {
    hdrs['Authorization'] = `Bearer ${accessToken}`;
  } else if (process.env.GOOGLE_API_KEY) {
    metaUrl += `&key=${process.env.GOOGLE_API_KEY}`;
  }

  const metaRes = await fetch(metaUrl, { headers: hdrs, cache: 'no-store' });
  if (!metaRes.ok) {
    const errBody = await metaRes.text().catch(() => '');
    if (metaRes.status === 403 || metaRes.status === 401) {
      throw new Error('Sin acceso al Sheet vía API. Asegúrate de que esté compartido con "Cualquiera con el enlace" o inicia sesión con Google.');
    }
    throw new Error(`Error al acceder al Sheet (${metaRes.status}): ${errBody}`);
  }

  const meta = await metaRes.json();
  const sheetName = meta?.sheets?.[0]?.properties?.title ?? 'Sheet1';

  let dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?majorDimension=ROWS`;
  if (!accessToken && process.env.GOOGLE_API_KEY) {
    dataUrl += `&key=${process.env.GOOGLE_API_KEY}`;
  }

  const dataRes = await fetch(dataUrl, { headers: hdrs, cache: 'no-store' });
  if (!dataRes.ok) {
    throw new Error(`Error al leer datos del Sheet (${dataRes.status})`);
  }

  const dataBody = await dataRes.json();
  return dataBody?.values ?? [];
}

export async function fetchSheet(sheetUrl: string, accessToken?: string): Promise<ParseResult> {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) throw new Error('URL del Google Sheet inválida. Asegúrate de pegar la URL completa del Sheet.');

  // Strategy: use Sheets API v4 if we have credentials, otherwise fall back to public CSV export
  let values: string[][];
  const hasApiCredentials = !!(accessToken || process.env.GOOGLE_API_KEY);
  if (hasApiCredentials) {
    try {
      values = await fetchViaAPI(sheetId, accessToken);
    } catch {
      // Fallback to CSV export if API fails
      values = await fetchViaCSVExport(sheetId);
    }
  } else {
    values = await fetchViaCSVExport(sheetId);
  }
  if (values.length < 2) {
    throw new Error('El Sheet está vacío o no tiene suficientes filas (se necesita al menos encabezado + 1 fila de datos).');
  }

  const headerRow = values[0] ?? [];
  const yearCol = detectColumn(headerRow, YEAR_ALIASES);
  const skuCol = detectColumn(headerRow, SKU_ALIASES);
  const centerCol = detectColumn(headerRow, CENTER_ALIASES);
  const descCol = detectColumn(headerRow, DESC_ALIASES);
  const monthCols = detectMonthColumns(headerRow);

  const errors: string[] = [];
  if (yearCol === -1) errors.push('No se encontró la columna de Año');
  if (skuCol === -1) errors.push('No se encontró la columna de SKU');
  if (centerCol === -1) errors.push('No se encontró la columna de Centro');
  if (monthCols.length === 0) errors.push('No se encontraron columnas de meses');

  if (errors.length > 0) {
    return { rows: [], centers: [], skus: [], totalRows: 0, headers: headerRow, errors };
  }

  // Sort month columns by month number
  monthCols.sort((a: any, b: any) => a.month - b.month);

  const rows: SheetRow[] = [];
  const centersSet = new Set<string>();
  const skusSet = new Set<string>();

  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const yearVal = parseInt(row[yearCol] ?? '', 10);
    if (isNaN(yearVal)) continue;
    const sku = (row[skuCol] ?? '').toString().trim();
    const center = (row[centerCol] ?? '').toString().trim();
    const desc = descCol >= 0 ? (row[descCol] ?? '').toString().trim() : '';
    if (!sku || !center) continue;

    const monthValues: number[] = new Array(12).fill(0);
    for (const mc of monthCols) {
      const val = parseFloat((row[mc.index] ?? '0').toString().trim().replace(/,/g, ''));
      monthValues[mc.month] = isNaN(val) ? 0 : val;
    }

    rows.push({ year: yearVal, sku, center, description: desc, months: monthValues });
    centersSet.add(center);
    skusSet.add(sku);
  }

  return {
    rows,
    centers: Array.from(centersSet).sort(),
    skus: Array.from(skusSet).sort(),
    totalRows: rows.length,
    headers: headerRow,
    errors: rows.length === 0 ? ['No se pudieron parsear filas válidas del Sheet.'] : [],
  };
}

export interface TimeSeriesPoint {
  year: number;
  month: number;
  value: number;
  label: string;
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function buildTimeSeries(rows: SheetRow[], center?: string, sku?: string): TimeSeriesPoint[] {
  let filtered = rows ?? [];
  if (center) filtered = filtered.filter((r: SheetRow) => r.center === center);
  if (sku) filtered = filtered.filter((r: SheetRow) => r.sku === sku);

  // Group by year-month and sum
  const map = new Map<string, { year: number; month: number; value: number }>();
  for (const row of filtered) {
    for (let m = 0; m < 12; m++) {
      const key = `${row.year}-${m}`;
      const existing = map.get(key);
      if (existing) {
        existing.value += row.months[m] ?? 0;
      } else {
        map.set(key, { year: row.year, month: m, value: row.months[m] ?? 0 });
      }
    }
  }

  const points = Array.from(map.values())
    .sort((a: any, b: any) => a.year - b.year || a.month - b.month)
    .map((p: any) => ({ ...p, label: `${MONTH_LABELS[p.month]} ${p.year}` }));

  return points;
}
