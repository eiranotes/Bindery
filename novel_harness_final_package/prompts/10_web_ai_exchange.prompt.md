# Web AI Exchange Prompt

This prompt is packaged in an exchange bundle when the user wants to upload files to a web AI.

```text
You are processing an exported local-first fiction harness exchange bundle.

Read:
- instructions.md
- context-manifest.json
- prompt.md
- schemas/output.schema.json
- context/*.md
- target/*.md

Return:
- result.json that matches the schema
- result.md when markdown output is requested
- notes.md for assumptions/questions

Do not modify source files directly. If you propose file changes, return patches in result.json.
```