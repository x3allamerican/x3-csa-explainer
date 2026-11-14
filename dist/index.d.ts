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
export declare const BASIC_NAMES: Record<Basic, string>;
/** Intervention thresholds (percentiles) in the current SMS. */
export declare const THRESHOLDS: Record<Basic | 'unsafeDriving' | 'crash' | 'drugsAlcohol', Record<CarrierType, number>>;
/** Minimum relevant inspections before a percentile is assigned (and at least one with a violation). */
export declare const MIN_INSPECTIONS: Record<Basic, number>;
export declare const SOURCE = "FMCSA Safety Measurement System (SMS) Methodology, version 3.21 (June 2026), csa.fmcsa.dot.gov/Documents/SMSMethodology.pdf";
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
export declare function timeWeight(inspectionDate: string, asOf: string): 0 | 1 | 2 | 3;
/** Severity and OOS weight of one inspection for one BASIC: sum of (severity + 2 if out of service), capped at 30. */
export declare function inspectionWeight(i: Inspection, basic: Basic): number;
export interface BasicMeasure {
    basic: Basic;
    name: string;
    measure: number;
    relevantInspections: number;
    inspectionsWithViolations: number;
    enoughData: boolean;
    /** Inspections ranked by how much of the measure they cause. */
    drivers: Array<{
        id?: string;
        date: string;
        weight: number;
        timeWeight: number;
        share: number;
        dropsOffOrSteps: string;
    }>;
    threshold: number;
    note: string;
}
/** BASIC measure = sum(time weight x inspection weight) / sum(time weight of relevant inspections). */
export declare function basicMeasure(inspections: Inspection[], basic: Basic, asOf: string, carrierType?: CarrierType): BasicMeasure;
/** How the measure falls over the next months with no new inspections (or with clean ones added). */
export declare function projection(inspections: Inspection[], basic: Basic, from: string, opts?: {
    months?: number;
    cleanInspectionsPerMonth?: number;
}): {
    date: string;
    measure: number;
}[];
/** All four inspection-based BASICs at once. */
export declare function explain(inspections: Inspection[], asOf: string, carrierType?: CarrierType): BasicMeasure[];
