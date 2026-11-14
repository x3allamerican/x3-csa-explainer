# X3 CSA Explainer

**See how FMCSA's Safety Measurement System turns your roadside inspections into a BASIC measure, which inspections drive it, and when they stop counting.** HOS Compliance, Vehicle Maintenance, Driver Fitness and Hazardous Materials Compliance under the current SMS methodology.

**[Try the CSA explainer →](https://x3allamerican.github.io/x3-csa-explainer/)**

Built and maintained by **[X3 Fleet Safety](https://x3fleetsafety.com)**.

## Install

```sh
npm install github:x3allamerican/x3-csa-explainer
```

## Use

```ts
import { basicMeasure, explain, projection, timeWeight } from '@x3/csa-explainer';

const inspections = [
  { id: 'A', date: '2026-09-01', level: 1, violations: [{ basic: 'hos', code: '395.8(e)', severity: 7 }, { basic: 'vehicle', severity: 4, outOfService: true }] },
  { id: 'B', date: '2026-03-10', level: 3, violations: [{ basic: 'hos', severity: 7, outOfService: true }] },
  // ...
];

const hos = basicMeasure(inspections, 'hos', '2026-11-14');
hos.measure;   // sum(time weight x inspection weight) / sum(time weight of relevant inspections)
hos.drivers;   // inspections ranked by their share of the measure, with when each steps down and drops off
hos.enoughData; hos.threshold;

projection(inspections, 'hos', '2026-11-14', { months: 24, cleanInspectionsPerMonth: 2 }); // how it falls over time
```

## The method

| Rule | Value |
|---|---|
| Time weight | 3 within 6 months, 2 within 12, 1 within 24, then the inspection stops counting |
| Inspection weight | Sum of violation severity weights (1-10), +2 for each out-of-service violation, capped at 30 per BASIC |
| Measure | Time- and severity-weighted violations / time-weighted relevant inspections |
| Relevant inspections | Driver BASICs: levels 1, 2, 3, 6. Vehicle Maintenance: levels 1, 2, 5, 6. HM: placarded loads |
| Minimum data | HOS 3 relevant inspections; others 5; and at least one with a violation |
| Intervention thresholds | HOS 65 / 50 / 60 (general / passenger / HM); Vehicle Maintenance and Driver Fitness 80 / 65 / 75; HM 80 |

Source: FMCSA SMS Methodology, version 3.21 (June 2026). Severity weights come from your carrier's SMS page or the methodology appendix.

## Limits

Percentiles compare you with peer carriers using FMCSA's national data, so they are not computed here; the measure is what you control. Unsafe Driving, Crash Indicator and Controlled Substances/Alcohol use power units and miles and are not included yet. FMCSA has approved a revised SMS (compliance categories, severity weights of 1 or 2) that was not live when this was written; it will be added when FMCSA publishes the final methodology. Not legal advice.

## Develop

```sh
npm install
npm test
npm run build
```

## License

MIT. Free for any use, including commercial.

---

**[X3 Fleet Safety](https://x3fleetsafety.com)** watches your CSA BASICs, driver files and hours of service in one place.
