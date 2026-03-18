# Example Architecture Audit Report

This example uses a realistic medium sample project with two bounded contexts (`good` and `bad`) and mixed architecture quality.

## Project Snapshot

- Project: `tmp-node-hexa-docs`
- Contexts analyzed: 2
- Architecture style target: Hexagonal DDD
- Quality gate: `minScore=80`

## Score Summary

- Score: **60/100**
- Result: **Quality gate failed**
- Estimated technical debt: **1.5 days**

## Violations Detected

1. `NXH012` (DDD, ERROR)
   - Message: Context `bad` has no domain port
2. `NXH010` (STRUCTURE, ERROR)
   - Message: Context `bad` is missing `application` directory
3. `NXH001` (DEPENDENCY, ERROR)
   - Message: Domain must not depend on infrastructure

## Recommendations

- Create domain ports to invert dependencies between application and infrastructure layers.
- Create the standard hexagonal folders: domain, application, and infrastructure.
- Enforce inward dependency flow: infrastructure -> application -> domain through ports and interfaces.

## CI Output Example

```text
::error::NXH012 Context 'bad' has no domain port
::error::NXH010 Context 'bad' is missing 'application' directory
::error::NXH001 Domain must not depend on infrastructure
::error::Architecture score 60 below threshold 80
ERROR: NXH012 Context 'bad' has no domain port
ERROR: NXH010 Context 'bad' is missing 'application' directory
ERROR: NXH001 Domain must not depend on infrastructure
ERROR: Architecture score 60 below threshold 80
```

## JSON Output Example

```json
{
  "schemaVersion": "1.0",
  "toolVersion": "0.4.0",
  "score": 60,
  "maxScore": 100,
  "estimatedTechnicalDebtDays": 1.5,
  "qualityGateStatus": "FAIL",
  "failureReasons": [
    "LOW_SCORE",
    "DDD_VIOLATIONS",
    "DEPENDENCY_VIOLATIONS",
    "HEXAGONAL_VIOLATIONS"
  ],
  "violations": [
    {
      "ruleId": "NXH012",
      "category": "DDD",
      "code": "missing-port",
      "severity": "ERROR",
      "message": "Context 'bad' has no domain port"
    },
    {
      "ruleId": "NXH010",
      "category": "STRUCTURE",
      "code": "missing-layer-directory",
      "severity": "ERROR",
      "message": "Context 'bad' is missing 'application' directory"
    },
    {
      "ruleId": "NXH001",
      "category": "DEPENDENCY",
      "code": "dependency-direction",
      "severity": "ERROR",
      "message": "Domain must not depend on infrastructure"
    }
  ]
}
```

## Why This Matters

In one command, Node-Hexa surfaces architecture drift, quantifies impact (score + debt), and returns outputs usable by both developers (readable report) and CI platforms (machine-friendly formats).
