import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeWeight, inspectionWeight, basicMeasure, projection, explain, THRESHOLDS, type Inspection } from '../src/index.ts';

const AS_OF = '2026-11-14';
const I: Inspection[] = [
  { id: 'A', date: '2026-09-01', level: 1, violations: [{ basic: 'hos', code: '395.8(e)', severity: 7 }, { basic: 'vehicle', code: '393.47', severity: 4, outOfService: true }] },
  { id: 'B', date: '2026-03-10', level: 3, violations: [{ basic: 'hos', code: '395.3(a)(2)', severity: 7, outOfService: true }] },
  { id: 'C', date: '2025-08-20', level: 1, violations: [] },
  { id: 'D', date: '2025-02-01', level: 2, violations: [{ basic: 'driverFitness', code: '391.41(a)', severity: 4 }] },
  { id: 'E', date: '2024-06-01', level: 1, violations: [{ basic: 'hos', severity: 10 }] }, // older than 24 months
];

test('time weights: 3, 2, 1, then 0 after 24 months', () => {
  assert.equal(timeWeight('2026-09-01', AS_OF), 3);
  assert.equal(timeWeight('2026-03-10', AS_OF), 2);
  assert.equal(timeWeight('2025-08-20', AS_OF), 1);
  assert.equal(timeWeight('2024-06-01', AS_OF), 0);
});

test('inspection weight adds 2 for out of service and caps at 30', () => {
  assert.equal(inspectionWeight(I[1], 'hos'), 9);
  const many: Inspection = { date: AS_OF, violations: Array.from({ length: 5 }, () => ({ basic: 'hos' as const, severity: 7 })) };
  assert.equal(inspectionWeight(many, 'hos'), 30);
});

test('HOS measure: weighted violations over weighted relevant inspections', () => {
  const m = basicMeasure(I, 'hos', AS_OF);
  // relevant (levels 1-3, within 24 months): A(3), B(2), C(1), D(1) -> den 7; num = 3*7 + 2*9 = 39 -> 5.57
  assert.equal(m.measure, 5.57);
  assert.equal(m.relevantInspections, 4);
  assert.equal(m.enoughData, true);
  assert.equal(m.drivers[0].id, 'A'); // 3 x 7 = 21 beats 2 x 9 = 18
  assert.equal(m.threshold, 65);
});

test('vehicle maintenance ignores driver-only level 3 inspections and needs 5 inspections', () => {
  const m = basicMeasure(I, 'vehicle', AS_OF);
  assert.equal(m.relevantInspections, 3);
  assert.equal(m.enoughData, false);
  assert.equal(m.measure, Math.round((3 * 6) / (3 + 1 + 1) * 100) / 100);
});

test('projection: the measure falls as inspections age, faster with clean inspections', () => {
  const p = projection(I, 'hos', AS_OF, { months: 24 });
  assert.equal(p.at(-1)!.measure, 0);
  const withClean = projection(I, 'hos', AS_OF, { months: 6, cleanInspectionsPerMonth: 2 });
  const noClean = projection(I, 'hos', AS_OF, { months: 6 });
  assert.ok(withClean.at(-1)!.measure < noClean.at(-1)!.measure);
});

test('explain covers four BASICs; thresholds by carrier type', () => {
  assert.deepEqual(explain(I, AS_OF).map((b) => b.basic), ['hos', 'vehicle', 'driverFitness', 'hazmat']);
  assert.equal(THRESHOLDS.hos.passenger, 50);
  assert.equal(basicMeasure(I, 'vehicle', AS_OF, 'hazmat').threshold, 75);
});
