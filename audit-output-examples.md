# Node Hexa Audit Output Examples

This file contains generated-style examples for enterprise integration and CI usage.

## Console Output

```text
Node Hexa Architecture Report

Architecture score: 82/100
Estimated technical debt: 2.3 days

DDD compliance: WARNING
Hexagonal boundaries: ERROR
Dependency violations: ERROR

Detected problems:

- [NXH001][ERROR][DEPENDENCY] Domain depends on infrastructure (src/contexts/iam/domain/entities/user.entity.ts)
- [NXH004][WARNING][DDD] Missing port interface (src/contexts/iam/application/use-cases/create-user.usecase.ts)
- [NXH006][INFO][STRUCTURE] Use case should end with 'UseCase': CreateUser

Recommendations:

- Create domain ports to invert dependencies between application and infrastructure layers.
- Keep each layer isolated and enforce inward dependency flow.
```

## JSON Output

```json
{
  "schemaVersion": "1.0",
  "toolVersion": "0.1.0",
  "score": 82,
  "maxScore": 100,
  "estimatedTechnicalDebtDays": 2.3,
  "qualityGateStatus": "FAIL",
  "failureReasons": ["LOW_SCORE", "DDD_VIOLATIONS"],
  "violations": [
    {
      "ruleId": "NXH001",
      "category": "DEPENDENCY",
      "code": "dependency-direction",
      "severity": "ERROR",
      "message": "Domain depends on infrastructure",
      "filePath": "src/contexts/iam/domain/entities/user.entity.ts"
    },
    {
      "ruleId": "NXH004",
      "category": "DDD",
      "code": "missing-port",
      "severity": "WARNING",
      "message": "Missing port interface"
    },
    {
      "ruleId": "NXH006",
      "category": "STRUCTURE",
      "code": "usecase-name",
      "severity": "INFO",
      "message": "Use case should end with 'UseCase': CreateUser"
    }
  ],
  "ruleIds": ["NXH001", "NXH004", "NXH006"],
  "severities": ["ERROR", "WARNING", "INFO"],
  "categories": ["DEPENDENCY", "DDD", "STRUCTURE"],
  "recommendations": [
    "Create domain ports to invert dependencies between application and infrastructure layers.",
    "Keep each layer isolated and enforce inward dependency flow."
  ]
}
```

## CI Output

```text
::error::NXH001 Domain depends on infrastructure
::warning::NXH004 Missing port interface
::notice::NXH006 Use case should end with 'UseCase': CreateUser
::error::Architecture score 72 below threshold 80
ERROR: NXH001 Domain depends on infrastructure
WARNING: NXH004 Missing port interface
INFO: NXH006 Use case should end with 'UseCase': CreateUser
ERROR: Architecture score 72 below threshold 80
```

## SARIF Output

```json
{
  "version": "2.1.0",
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "node-hexa",
          "version": "0.1.0",
          "rules": [
            {
              "id": "NXH001",
              "name": "DEPENDENCY",
              "shortDescription": {
                "text": "Domain depends on infrastructure"
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "NXH001",
          "level": "error",
          "message": {
            "text": "Domain depends on infrastructure"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "src/contexts/iam/domain/entities/user.entity.ts"
                },
                "region": {
                  "startLine": 1
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Baseline Output

```json
{
  "score": 68,
  "violations": [
    {
      "ruleId": "NXH001",
      "category": "DEPENDENCY",
      "severity": "ERROR",
      "message": "Domain depends on infrastructure"
    }
  ],
  "ruleIds": ["NXH001"],
  "timestamp": "2026-03-18T10:15:00.000Z"
}
```

## Comparison Output

```text
Baseline Comparison

New violations: 1
Resolved violations: 3
Unchanged: 5

Previous score: 68
Current score: 82
Improvement: +14
```

## HTML Output

```text
Generated file: node-hexa-report.html
Contains:
- Global architecture score
- Estimated technical debt in days
- DDD / Hexagonal / Dependency status
- Violations with RULE_ID, SEVERITY, CATEGORY
- Rule explanations
- Improvement recommendations
```

## Badge Output

```text
Generated file: node-hexa-score.svg
Visual content:
- Node Hexa Architecture Score
- 82/100
```
