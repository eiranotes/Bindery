# 08. Schemas and Contracts

The `schemas/` directory contains starter JSON Schemas. The important design rules are:

- Every state-changing AI output is schema validated.
- Markdown prose candidates can be wrapped in JSON envelopes.
- `additionalProperties: false` is used where strictness is needed.
- Every issue/proposal must contain evidence or target path.

## Core contracts

| Schema | Used by |
|---|---|
| `IdeaSeed.v1.schema.json` | idea discovery |
| `WorldExpansionProposal.v1.schema.json` | world expansion |
| `ScenePlan.v1.schema.json` | scene planning |
| `DraftCandidateEnvelope.v1.schema.json` | draft/continue/rewrite |
| `QAReportEnvelope.v1.schema.json` | prose/fiction/governance QA |
| `CanonDeltaProposal.v1.schema.json` | canon sync |
| `WebExchangeManifest.v1.schema.json` | web-AI export/import |

## Validation flow

```text
raw output
-> parse
-> schema validation
-> repair loop if allowed
-> typed object
-> artifact/proposal
-> human review
-> apply
```

Repair loop is allowed only for format errors, not for canon conflicts. Canon conflicts require human review.
