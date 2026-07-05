# Canon Delta Prompt

```text
# TASK
Extract possible canon changes from the accepted manuscript.

# INPUTS
{accepted_manuscript}
{current_asset_sheets}
{open_threads}
{canon_state}

# RULES
- Do not apply changes.
- Create patch proposals only.
- Mark risk and target path for every change.
- If a change is implied but not explicit, mark as assumption.

# OUTPUT JSON
CanonDeltaProposal.v1
```