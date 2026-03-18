# 5-Minute Demo Script

This script is designed for a live product presentation.

## Minute 0-1: Generate Demo Project

```bash
node-hexa demo
```

Presenter notes:

- Explain that the generated project contains both compliant and intentionally non-compliant architecture patterns.
- Mention that this lets teams see value immediately.

## Minute 1-2: Run First Audit (Baseline)

```bash
node-hexa audit node-hexa-demo
```

Presenter notes:

- Highlight score, technical debt, and rule IDs.
- Show at least one DDD and one dependency-direction violation.

## Minute 2-4: Fix Example

`node-hexa fix example` (presentation step)

Presenter notes:

- This is a guided remediation step for the demo narrative.
- Apply three concrete improvements in editor:
  1. Add missing domain port.
  2. Add missing use case in application layer.
  3. Remove direct domain -> infrastructure import.

## Minute 4-5: Run Audit Again

```bash
node-hexa audit node-hexa-demo
```

Presenter notes:

- Compare before/after score.
- Emphasize reduced technical debt and improved architecture confidence.
- Close with CI integration: `node-hexa audit . --fail-under 80`.

## Demo Outcome

- Stakeholders understand architecture risk in under 5 minutes.
- Teams see measurable improvement path, not just static warnings.
- Product value is clear: governance + ROI + CI readiness.
