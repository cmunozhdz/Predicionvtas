// Forecast models - server-side TypeScript-only implementation

export interface ForecastResult {
  model: string;
  predictions: { label: string; value: number; lower: number; upper: number }[];
  metrics: { mape: number; rmse: number; mae: number };
  fittedValues?: number[];
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getNextMonthLabels(lastYear: number, lastMonth: number, horizon: number): string[] {
  const labels: string[] = [];
  let y = lastYear;
  let m = lastMonth;
  for (let i = 0; i < horizon; i++) {
    m++;
    if (m > 11) { m = 0; y++; }
    labels.push(`${MONTH_LABELS[m]} ${y}`);
  }
  return labels;
}

// --- Helper stats ---
function mean(arr: number[]): number {
  if (!arr?.length) return 0;
  return arr.reduce((s: number, v: number) => s + v, 0) / arr.length;
}

function stdResiduals(actual: number[], predicted: number[]): number {
  const n = Math.min(actual?.length ?? 0, predicted?.length ?? 0);
  if (n < 2) return 0;
  const residuals = [];
  for (let i = 0; i < n; i++) {
    residuals.push((actual?.[i] ?? 0) - (predicted?.[i] ?? 0));
  }
  const m = mean(residuals);
  const variance = residuals.reduce((s: number, r: number) => s + (r - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

function computeMetrics(actual: number[], predicted: number[]): { mape: number; rmse: number; mae: number } {
  const n = Math.min(actual?.length ?? 0, predicted?.length ?? 0);
  if (n === 0) return { mape: 0, rmse: 0, mae: 0 };
  let sumApe = 0, sumSe = 0, sumAe = 0, validCount = 0;
  for (let i = 0; i < n; i++) {
    const a = actual?.[i] ?? 0;
    const p = predicted?.[i] ?? 0;
    const err = Math.abs(a - p);
    sumAe += err;
    sumSe += err ** 2;
    if (Math.abs(a) > 0.001) { sumApe += err / Math.abs(a); validCount++; }
  }
  return {
    mape: validCount > 0 ? (sumApe / validCount) * 100 : 0,
    rmse: Math.sqrt(sumSe / n),
    mae: sumAe / n,
  };
}

// --- 1. Moving Average ---
function movingAverage(data: number[], window: number, horizon: number): { preds: number[]; fitted: number[] } {
  const fitted: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window) {
      fitted.push(mean(data.slice(0, i + 1)));
    } else {
      fitted.push(mean(data.slice(i - window, i)));
    }
  }
  const lastWindow = data.slice(-window);
  const avg = mean(lastWindow);
  const preds = new Array(horizon).fill(avg);
  return { preds, fitted };
}

// --- 2. Holt's Double Exponential ---
function holtDouble(data: number[], horizon: number, alpha = 0.3, beta = 0.1): { preds: number[]; fitted: number[] } {
  if (data.length < 2) return { preds: new Array(horizon).fill(data?.[0] ?? 0), fitted: [...(data ?? [])] };
  let level = data[0] ?? 0;
  let trend = (data[1] ?? 0) - (data[0] ?? 0);
  const fitted: number[] = [level];

  for (let i = 1; i < data.length; i++) {
    const prevLevel = level;
    level = alpha * (data[i] ?? 0) + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(level + trend);
  }

  const preds: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    preds.push(Math.max(0, level + h * trend));
  }
  return { preds, fitted };
}

// --- 3. Holt-Winters Additive (season=12) ---
function holtWinters(data: number[], horizon: number, seasonLen = 12, alpha = 0.3, beta = 0.05, gamma = 0.3): { preds: number[]; fitted: number[] } {
  const n = data?.length ?? 0;
  if (n < seasonLen * 2) {
    // Fallback to Holt if not enough data
    return holtDouble(data, horizon);
  }

  // Initialize seasonal from first season
  const firstSeasonMean = mean(data.slice(0, seasonLen));
  const seasonal: number[] = new Array(n + horizon).fill(0);
  for (let i = 0; i < seasonLen; i++) {
    seasonal[i] = (data?.[i] ?? 0) - firstSeasonMean;
  }

  let level = firstSeasonMean;
  let trend = 0;
  // Compute initial trend from first two seasons
  for (let i = 0; i < seasonLen; i++) {
    trend += ((data?.[seasonLen + i] ?? 0) - (data?.[i] ?? 0)) / seasonLen;
  }
  trend /= seasonLen;

  const fitted: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < seasonLen) {
      fitted.push(level + trend + seasonal[i]);
      continue;
    }
    const obs = data[i] ?? 0;
    const prevLevel = level;
    level = alpha * (obs - seasonal[i - seasonLen]) + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i] = gamma * (obs - level) + (1 - gamma) * seasonal[i - seasonLen];
    fitted.push(level + trend + seasonal[i]);
  }

  const preds: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const sIdx = n - seasonLen + ((h - 1) % seasonLen);
    preds.push(Math.max(0, level + h * trend + (seasonal[sIdx] ?? 0)));
  }
  return { preds, fitted };
}

// --- 4. Linear Regression with monthly dummies ---
function linearRegression(data: number[], horizon: number): { preds: number[]; fitted: number[] } {
  const n = data?.length ?? 0;
  if (n < 3) return { preds: new Array(horizon).fill(data?.[0] ?? 0), fitted: [...(data ?? [])] };

  // Build X matrix: [1, t, d1, d2, ..., d11] (11 month dummies)
  const cols = 13; // intercept + t + 11 dummies
  const X: number[][] = [];
  const Y: number[] = [];

  for (let t = 0; t < n; t++) {
    const row = new Array(cols).fill(0);
    row[0] = 1; // intercept
    row[1] = t; // trend
    const monthIdx = t % 12;
    if (monthIdx > 0) row[1 + monthIdx] = 1; // month dummy (month 0 is reference)
    X.push(row);
    Y.push(data[t] ?? 0);
  }

  // Solve using normal equations: beta = (X'X)^-1 X'Y
  // Simple implementation for small matrices
  const XtX = matMul(transpose(X), X);
  const XtY = matVecMul(transpose(X), Y);
  const beta = solveLinear(XtX, XtY);

  const fitted = X.map((row: number[]) => Math.max(0, dotProduct(row, beta)));

  const preds: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const t = n + h;
    const row = new Array(cols).fill(0);
    row[0] = 1;
    row[1] = t;
    const monthIdx = t % 12;
    if (monthIdx > 0) row[1 + monthIdx] = 1;
    preds.push(Math.max(0, dotProduct(row, beta)));
  }

  return { preds, fitted };
}

// Matrix helpers
function transpose(m: number[][]): number[][] {
  const rows = m?.length ?? 0;
  const cols = m?.[0]?.length ?? 0;
  const result: number[][] = [];
  for (let j = 0; j < cols; j++) {
    const row: number[] = [];
    for (let i = 0; i < rows; i++) row.push(m?.[i]?.[j] ?? 0);
    result.push(row);
  }
  return result;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a?.length ?? 0;
  const cols = b?.[0]?.length ?? 0;
  const inner = b?.length ?? 0;
  const result: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) sum += (a?.[i]?.[k] ?? 0) * (b?.[k]?.[j] ?? 0);
      row.push(sum);
    }
    result.push(row);
  }
  return result;
}

function matVecMul(m: number[][], v: number[]): number[] {
  return (m ?? []).map((row: number[]) => dotProduct(row, v));
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < (a?.length ?? 0); i++) sum += (a?.[i] ?? 0) * (b?.[i] ?? 0);
  return sum;
}

function solveLinear(A: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting
  const n = A?.length ?? 0;
  const aug: number[][] = A.map((row: number[], i: number) => [...(row ?? []), b?.[i] ?? 0]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug?.[row]?.[col] ?? 0) > Math.abs(aug?.[maxRow]?.[col] ?? 0)) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug?.[col]?.[col] ?? 0;
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = col; j <= n; j++) {
      if (aug[col]) aug[col][j] = (aug[col][j] ?? 0) / pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug?.[row]?.[col] ?? 0;
      for (let j = col; j <= n; j++) {
        if (aug[row]) aug[row][j] = (aug[row][j] ?? 0) - factor * (aug?.[col]?.[j] ?? 0);
      }
    }
  }

  return aug.map((row: number[]) => row?.[n] ?? 0);
}

// --- 5. Ensemble (average of all) ---
function ensemble(results: ForecastResult[], horizon: number): ForecastResult {
  const preds: { label: string; value: number; lower: number; upper: number }[] = [];
  for (let h = 0; h < horizon; h++) {
    const vals = results.map((r: ForecastResult) => r.predictions?.[h]?.value ?? 0);
    const lows = results.map((r: ForecastResult) => r.predictions?.[h]?.lower ?? 0);
    const highs = results.map((r: ForecastResult) => r.predictions?.[h]?.upper ?? 0);
    preds.push({
      label: results?.[0]?.predictions?.[h]?.label ?? '',
      value: mean(vals),
      lower: mean(lows),
      upper: mean(highs),
    });
  }
  const metrics = {
    mape: mean(results.map((r: ForecastResult) => r.metrics?.mape ?? 0)),
    rmse: mean(results.map((r: ForecastResult) => r.metrics?.rmse ?? 0)),
    mae: mean(results.map((r: ForecastResult) => r.metrics?.mae ?? 0)),
  };
  return { model: 'Ensamble', predictions: preds, metrics };
}

// --- Main forecast function ---
export interface ForecastInput {
  values: number[];
  lastYear: number;
  lastMonth: number;
  models: string[];
  horizon?: number;
  maWindow?: number;
}

export function runForecasts(input: ForecastInput): ForecastResult[] {
  const { values, lastYear, lastMonth, models, horizon = 3, maWindow = 12 } = input ?? {};
  const data = values ?? [];
  const n = data.length;
  if (n < 3) return [];

  const labels = getNextMonthLabels(lastYear, lastMonth, horizon);

  // Backtest: use last 12 months as holdout (or fewer if not enough)
  const holdoutSize = Math.min(12, Math.floor(n * 0.3));
  const trainData = data.slice(0, n - holdoutSize);
  const testData = data.slice(n - holdoutSize);

  const results: ForecastResult[] = [];

  const modelFns: Record<string, () => ForecastResult> = {
    'media_movil': () => {
      const full = movingAverage(data, maWindow, horizon);
      const bt = movingAverage(trainData, maWindow, holdoutSize);
      const metrics = computeMetrics(testData, bt.preds);
      const sigma = stdResiduals(data, full.fitted);
      return {
        model: 'Media Móvil',
        predictions: labels.map((l: string, i: number) => ({
          label: l,
          value: Math.round((full.preds?.[i] ?? 0) * 100) / 100,
          lower: Math.round(Math.max(0, (full.preds?.[i] ?? 0) - 1.96 * sigma) * 100) / 100,
          upper: Math.round(((full.preds?.[i] ?? 0) + 1.96 * sigma) * 100) / 100,
        })),
        metrics: { mape: Math.round((metrics.mape ?? 0) * 100) / 100, rmse: Math.round((metrics.rmse ?? 0) * 100) / 100, mae: Math.round((metrics.mae ?? 0) * 100) / 100 },
      };
    },
    'holt': () => {
      const full = holtDouble(data, horizon);
      const bt = holtDouble(trainData, holdoutSize);
      const metrics = computeMetrics(testData, bt.preds);
      const sigma = stdResiduals(data, full.fitted);
      return {
        model: 'Holt (Doble Exponencial)',
        predictions: labels.map((l: string, i: number) => ({
          label: l,
          value: Math.round((full.preds?.[i] ?? 0) * 100) / 100,
          lower: Math.round(Math.max(0, (full.preds?.[i] ?? 0) - 1.96 * sigma) * 100) / 100,
          upper: Math.round(((full.preds?.[i] ?? 0) + 1.96 * sigma) * 100) / 100,
        })),
        metrics: { mape: Math.round((metrics.mape ?? 0) * 100) / 100, rmse: Math.round((metrics.rmse ?? 0) * 100) / 100, mae: Math.round((metrics.mae ?? 0) * 100) / 100 },
      };
    },
    'holt_winters': () => {
      const full = holtWinters(data, horizon);
      const bt = holtWinters(trainData, holdoutSize);
      const metrics = computeMetrics(testData, bt.preds);
      const sigma = stdResiduals(data, full.fitted);
      return {
        model: 'Holt-Winters (Estacional)',
        predictions: labels.map((l: string, i: number) => ({
          label: l,
          value: Math.round((full.preds?.[i] ?? 0) * 100) / 100,
          lower: Math.round(Math.max(0, (full.preds?.[i] ?? 0) - 1.96 * sigma) * 100) / 100,
          upper: Math.round(((full.preds?.[i] ?? 0) + 1.96 * sigma) * 100) / 100,
        })),
        metrics: { mape: Math.round((metrics.mape ?? 0) * 100) / 100, rmse: Math.round((metrics.rmse ?? 0) * 100) / 100, mae: Math.round((metrics.mae ?? 0) * 100) / 100 },
      };
    },
    'regresion': () => {
      const full = linearRegression(data, horizon);
      const bt = linearRegression(trainData, holdoutSize);
      const metrics = computeMetrics(testData, bt.preds);
      const sigma = stdResiduals(data, full.fitted);
      return {
        model: 'Regresión Lineal',
        predictions: labels.map((l: string, i: number) => ({
          label: l,
          value: Math.round((full.preds?.[i] ?? 0) * 100) / 100,
          lower: Math.round(Math.max(0, (full.preds?.[i] ?? 0) - 1.96 * sigma) * 100) / 100,
          upper: Math.round(((full.preds?.[i] ?? 0) + 1.96 * sigma) * 100) / 100,
        })),
        metrics: { mape: Math.round((metrics.mape ?? 0) * 100) / 100, rmse: Math.round((metrics.rmse ?? 0) * 100) / 100, mae: Math.round((metrics.mae ?? 0) * 100) / 100 },
      };
    },
  };

  const selectedModels = (models ?? []).filter((m: string) => m !== 'ensamble');
  for (const m of selectedModels) {
    const fn = modelFns[m];
    if (fn) {
      try {
        results.push(fn());
      } catch (err: any) {
        console.error(`Error in model ${m}:`, err);
      }
    }
  }

  // Add ensemble if requested and there are at least 2 base models
  if ((models ?? []).includes('ensamble') && results.length >= 2) {
    results.push(ensemble(results, horizon));
  } else if ((models ?? []).includes('ensamble') && results.length < 2) {
    // If ensemble requested but < 2 models, run all base and add ensemble
    const allKeys = Object.keys(modelFns);
    const baseResults: ForecastResult[] = [];
    for (const k of allKeys) {
      try { baseResults.push(modelFns[k]()); } catch (e: any) { /* skip */ }
    }
    if (baseResults.length >= 2) results.push(ensemble(baseResults, horizon));
  }

  return results;
}
