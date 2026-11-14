/**
 * X3 CSA Explainer: how FMCSA's Safety Measurement System (SMS) turns roadside inspections into a BASIC measure,
 * and how that measure will fall as inspections age. Implements the inspection-based BASICs of the current SMS
 * methodology (FMCSA SMS Methodology, version 3.21, June 2026): HOS Compliance, Vehicle Maintenance, Driver
 * Fitness and Hazardous Materials Compliance.
 *
 * Percentiles compare a carrier with its peers and need FMCSA's national data, so they are not computed here.
 * Use the measure to see what drives it, which inspections matter most and when they stop counting.
 */
export const BASIC_NAMES = { hos: 'HOS Compliance', vehicle: 'Vehicle Maintenance', driverFitness: 'Driver Fitness', hazmat: 'Hazardous Materials Compliance' };
/** Intervention thresholds (percentiles) in the current SMS. */
export const THRESHOLDS = {
    unsafeDriving: { general: 65, passenger: 50, hazmat: 60 },
    crash: { general: 65, passenger: 50, hazmat: 60 },
    hos: { general: 65, passenger: 50, hazmat: 60 },
    vehicle: { general: 80, passenger: 65, hazmat: 75 },
    drugsAlcohol: { general: 80, passenger: 65, hazmat: 75 },
    driverFitness: { general: 80, passenger: 65, hazmat: 75 },
    hazmat: { general: 80, passenger: 80, hazmat: 80 },
};
/** Minimum relevant inspections before a percentile is assigned (and at least one with a violation). */
export const MIN_INSPECTIONS = { hos: 3, vehicle: 5, driverFitness: 5, hazmat: 5 };
export const SOURCE = 'FMCSA Safety Measurement System (SMS) Methodology, version 3.21 (June 2026), csa.fmcsa.dot.gov/Documents/SMSMethodology.pdf';
/** 3 within 6 months, 2 within 12, 1 within 24, 0 after that. */
export function timeWeight(inspectionDate, asOf) {
    const months = monthsBetween(inspectionDate, asOf);
    if (months < 0)
        return 0;
    return months <= 6 ? 3 : months <= 12 ? 2 : months <= 24 ? 1 : 0;
}
function monthsBetween(a, b) {
    const d1 = new Date(`${a.slice(0, 10)}T00:00:00Z`);
    const d2 = new Date(`${b.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()))
        throw new Error(`Bad date: ${a} or ${b}`);
    let m = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
    if (d2.getUTCDate() < d1.getUTCDate())
        m -= 1; // a month counts once its day has been reached
    return m + (d2.getUTCDate() === d1.getUTCDate() ? 0 : 0.5);
}
function isRelevant(i, basic) {
    if (i.relevant?.[basic] !== undefined)
        return Boolean(i.relevant[basic]);
    const lvl = i.level ?? 1;
    if (basic === 'vehicle')
        return [1, 2, 5, 6].includes(lvl);
    if (basic === 'hazmat')
        return Boolean(i.hazmatPlacarded) && [1, 2, 3, 4, 5, 6].includes(lvl);
    return [1, 2, 3, 6].includes(lvl);
}
/** Severity and OOS weight of one inspection for one BASIC: sum of (severity + 2 if out of service), capped at 30. */
export function inspectionWeight(i, basic) {
    const sum = i.violations.filter((v) => v.basic === basic).reduce((s, v) => s + v.severity + (v.outOfService ? 2 : 0), 0);
    return Math.min(30, sum);
}
/** BASIC measure = sum(time weight x inspection weight) / sum(time weight of relevant inspections). */
export function basicMeasure(inspections, basic, asOf, carrierType = 'general') {
    let num = 0;
    let den = 0;
    const rows = [];
    let relevant = 0;
    let withViol = 0;
    for (const i of inspections) {
        if (!isRelevant(i, basic))
            continue;
        const tw = timeWeight(i.date, asOf);
        if (!tw)
            continue;
        relevant++;
        const w = inspectionWeight(i, basic);
        if (w > 0)
            withViol++;
        num += tw * w;
        den += tw;
        if (w > 0)
            rows.push({ id: i.id, date: i.date, weight: w, timeWeight: tw, share: tw * w, dropsOffOrSteps: nextStep(i.date) });
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
function addMonths(d, n) {
    const x = new Date(`${d.slice(0, 10)}T00:00:00Z`);
    x.setUTCMonth(x.getUTCMonth() + n);
    return x.toISOString().slice(0, 10);
}
function nextStep(date) {
    return `weight 3 until ${addMonths(date, 6)}, 2 until ${addMonths(date, 12)}, 1 until ${addMonths(date, 24)}, then drops off`;
}
/** How the measure falls over the next months with no new inspections (or with clean ones added). */
export function projection(inspections, basic, from, opts = {}) {
    const out = [];
    const extra = [];
    for (let m = 0; m <= (opts.months ?? 24); m++) {
        const d = addMonths(from, m);
        if (m > 0)
            for (let k = 0; k < (opts.cleanInspectionsPerMonth ?? 0); k++)
                extra.push({ date: d, level: 1, violations: [] });
        out.push({ date: d, measure: basicMeasure([...inspections, ...extra], basic, d).measure });
    }
    return out;
}
/** All four inspection-based BASICs at once. */
export function explain(inspections, asOf, carrierType = 'general') {
    return Object.keys(BASIC_NAMES).map((b) => basicMeasure(inspections, b, asOf, carrierType));
}
