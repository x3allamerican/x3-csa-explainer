/**
 * X3 CSA Explainer: how FMCSA's Safety Measurement System (SMS) turns roadside inspections into a BASIC measure,
 * and how that measure will fall as inspections age. Implements the inspection-based BASICs of the current SMS
 * methodology (FMCSA SMS Methodology, version 3.21, June 2026): HOS Compliance, Vehicle Maintenance, Driver
 * Fitness and Hazardous Materials Compliance.
 *
 * Percentiles compare a carrier with its peers and need FMCSA's national data, so they are not computed here.
 * Use the measure to see what drives it, which inspections matter most and when they stop counting.
 */

export type Basic = 'hos' | 'vehicle' | 'driverFitness' | 'hazmat';
export type CarrierType = 'general' | 'passenger' | 'hazmat';

export const BASIC_NAMES: Record<Basic, string> = { hos: 'HOS Compliance', vehicle: 'Vehicle Maintenance', driverFitness: 'Driver Fitness', hazmat: 'Hazardous Materials Compliance' };

/** Intervention thresholds (percentiles) in the current SMS. */
export const THRESHOLDS: Record<Basic | 'unsafeDriving' | 'crash' | 'drugsAlcohol', Record<CarrierType, number>> = {
  unsafeDriving: { general: 65, passenger: 50, hazmat: 60 },
  crash: { general: 65, passenger: 50, hazmat: 60 },
  hos: { general: 65, passenger: 50, hazmat: 60 },
  vehicle: { general: 80, passenger: 65, hazmat: 75 },
  drugsAlcohol: { general: 80, passenger: 65, hazmat: 75 },
  driverFitness: { general: 80, passenger: 65, hazmat: 75 },
  hazmat: { general: 80, passenger: 80, hazmat: 80 },
};

/** Minimum relevant inspections before a percentile is assigned (and at least one with a violation). */
export const MIN_INSPECTIONS: Record<Basic, number> = { hos: 3, vehicle: 5, driverFitness: 5, hazmat: 5 };

export const SOURCE = 'FMCSA Safety Measurement System (SMS) Methodology, version 3.21 (June 2026), csa.fmcsa.dot.gov/Documents/SMSMethodology.pdf';

export interface Violation {
  basic: Basic;
  /** Code as written on the inspection report, e.g. 395.8(e). */
  code?: string;
  description?: string;
  /** Severity weight 1-10, as shown for this violation on your SMS carrier page. */
  severity: number;
  outOfService?: boolean;
}

export interface Inspection {
  id?: string;
  date: string;
  /** Inspection level (1-6). Driver-only (level 3) inspections do not count as relevant for Vehicle Maintenance. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Whether the inspection counts as relevant for each BASIC. Defaults from the level: driver BASICs for levels 1-3, Vehicle Maintenance for 1, 2, 5 and 6. */
  relevant?: Partial<Record<Basic, boolean>>;
  hazmatPlacarded?: boolean;
  violations: Violation[];
}

/** 3 within 6 months, 2 within 12, 1 within 24, 0 after that. */
export function timeWeight(inspectionDate: string, asOf: string): 0 | 1 | 2 | 3 {
  const months = monthsBetween(inspectionDate, asOf);
  if (months < 0) return 0;
  return months <= 6 ? 3 : months <= 12 ? 2 : months <= 24 ? 1 : 0;
}

function monthsBetween(a: string, b: string): number {
  const d1 = new Date(`${a.slice(0, 10)}T00:00:00Z`);
  const d2 = new Date(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) throw new Error(`Bad date: ${a} or ${b}`);
  let m = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
  if (d2.getUTCDate() < d1.getUTCDate()) m -= 1; // a month counts once its day has been reached
  return m + (d2.getUTCDate() === d1.getUTCDate() ? 0 : 0.5);
}

function isRelevant(i: Inspection, basic: Basic): boolean {
  if (i.relevant?.[basic] !== undefined) return Boolean(i.relevant[basic]);
  const lvl = i.level ?? 1;
  if (basic === 'vehicle') return [1, 2, 5, 6].includes(lvl);
  if (basic === 'hazmat') return Boolean(i.hazmatPlacarded) && [1, 2, 3, 4, 5, 6].includes(lvl);
  return [1, 2, 3, 6].includes(lvl);
}

/** Severity and OOS weight of one inspection for one BASIC: sum of (severity + 2 if out of service), capped at 30. */
export function inspectionWeight(i: Inspection, basic: Basic): number {
  const sum = i.violations.filter((v) => v.basic === basic).reduce((s, v) => s + v.severity + (v.outOfService ? 2 : 0), 0);
  return Math.min(30, sum);
}

export interface BasicMeasure {
  basic: Basic;
  name: string;
  measure: number;
  relevantInspections: number;
  inspectionsWithViolations: number;
  enoughData: boolean;
  /** Inspections ranked by how much of the measure they cause. */
  drivers: Array<{ id?: string; date: string; weight: number; timeWeight: number; share: number; dropsOffOrSteps: string }>;
  threshold: number;
  note: string;
}

/** BASIC measure = sum(time weight x inspection weight) / sum(time weight of relevant inspections). */
export function basicMeasure(inspections: Inspection[], basic: Basic, asOf: string, carrierType: CarrierType = 'general'): BasicMeasure {
  let num = 0;
  let den = 0;
  const rows: BasicMeasure['drivers'] = [];
  let relevant = 0;
  let withViol = 0;
  for (const i of inspections) {
    if (!isRelevant(i, basic)) continue;
    const tw = timeWeight(i.date, asOf);
    if (!tw) continue;
    relevant++;
    const w = inspectionWeight(i, basic);
    if (w > 0) withViol++;
    num += tw * w;
    den += tw;
    if (w > 0) rows.push({ id: i.id, date: i.date, weight: w, timeWeight: tw, share: tw * w, dropsOffOrSteps: nextStep(i.date) });
  }
  const measure = den ? Math.round((num / den) * 100) / 100 : 0;
  rows.forEach((r) => (r.share = num ? Math.round((r.share / num) * 1000) / 10 : 0));
  rows.sort((a, b) => b.share - a.share);
  const enough = relevant >= MIN_INSPECTIONS[basic] && withViol > 0;
  return {
    basic, name: BASIC_NAMES[basic], measure, relevantInspections: relevant, inspectionsWithViolations: withViol, enoughData: enough, drivers: rows,
    threshold: THRESHOLDS[basic][carrierType],
    note: enough ? 'FMCSA ranks this measure against carriers with a similar number of inspections to get a percentile.' : `Fewer than ${MIN_INSPECTIONS[basic]} relevant inspections or none with a violation: no percentile is assigned.`,
  };
}

function addMonths(d: string, n: number) {
  const x = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 10);
}
function nextStep(date: string) {
  return `weight 3 until ${addMonths(date, 6)}, 2 until ${addMonths(date, 12)}, 1 until ${addMonths(date, 24)}, then drops off`;
}

/** How the measure falls over the next months with no new inspections (or with clean ones added). */
export function projection(inspections: Inspection[], basic: Basic, from: string, opts: { months?: number; cleanInspectionsPerMonth?: number } = {}) {
  const out: Array<{ date: string; measure: number }> = [];
  const extra: Inspection[] = [];
  for (let m = 0; m <= (opts.months ?? 24); m++) {
    const d = addMonths(from, m);
    if (m > 0) for (let k = 0; k < (opts.cleanInspectionsPerMonth ?? 0); k++) extra.push({ date: d, level: 1, violations: [] });
    out.push({ date: d, measure: basicMeasure([...inspections, ...extra], basic, d).measure });
  }
  return out;
}

/** All four inspection-based BASICs at once. */
export function explain(inspections: Inspection[], asOf: string, carrierType: CarrierType = 'general') {
  return (Object.keys(BASIC_NAMES) as Basic[]).map((b) => basicMeasure(inspections, b, asOf, carrierType));
}
