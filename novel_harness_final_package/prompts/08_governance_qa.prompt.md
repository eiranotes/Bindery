# Governance QA Prompt

```text
# TASK
Check canon, license, story-envelope, and branch safety.

# HARD CONTEXT
{authority_order}
{canon_state}
{story_license}
{story_envelope}
{branch_index}
{approved_assets}

# CHECKS
- new named entities
- unauthorized world expansion
- blocked reveal
- POV knowledge violation
- canon contradiction
- branch contamination
- unapproved proposal leakage

# OUTPUT JSON
QAReportEnvelope.v1 with qa_type="governance"
```