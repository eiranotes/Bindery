# Sources and research notes

This package uses the following public references as design inputs.

## Pensiv / 펜시브

- Pensiv documentation index and UI model: https://docs.pensiv.so/
- Pensiv overall structure: https://docs.pensiv.so/en/guide/basic-ui-and-navigation/structure
- Pensiv file types: https://docs.pensiv.so/en/guide/file-types
- Pensiv changelog: https://pensiv.so/ko/changelog
- Pensiv writing tool comparison: https://pensiv.so/ko/blog/writing-program-comparison
- Pensiv Scrivener alternative article: https://pensiv.so/ko/blog/scrivener-alternative

Extracted UI principles:

- Left sidebar is a structure map, not just navigation.
- Top tabs hold current working context.
- Center panel is the active focus surface.
- Panels can split, lock, move, and grow.
- File types are roles of thought: document, sheet, plotboard, canvas, note.
- Recent Pensiv updates emphasize writing statistics, PDF export, version history across item types, keyboard tree navigation, canvas interactions, templates, and a writing agent beta.

## Scrivener

- Scrivener overview: https://www.literatureandlatte.com/scrivener/overview

Extracted principles:

- Long manuscripts should be broken into sections/scenes.
- Research should be visible beside the manuscript.
- Corkboard/outliner operations should affect manuscript order.
- Snapshot/compare is central for major rewrites.
- Metadata, labels, status, writing targets, and compilation/export matter in long-form writing.

## Long-running AI workflow references

- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- LangGraph interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts

Extracted runtime principles:

- Long-running stateful workflows need durable execution, persistence, checkpointing, human-in-the-loop, and memory separation.
- Short-term thread/checkpoint state and long-term store/memory should be separate.
- Human approval and review points should be explicit interrupts with JSON-serializable payloads.
- Resume uses the same thread/run pointer.

## OpenAI references for optional API/web integration

- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- File search: https://developers.openai.com/api/docs/guides/tools-file-search
- ChatGPT file upload FAQ: https://help.openai.com/en/articles/8555545-file-uploads-with-gpts-and-advanced-data-analysis-in-chatgpt

Extracted AI integration principles:

- Structured output should prefer schema-constrained outputs over loose JSON mode.
- File search can be used as an optional hosted retrieval path when using API integration.
- ChatGPT file upload limits imply that a web-AI roundtrip bundle should be compact, stage-scoped, and validated on import.

## Bindery repository review basis

Repository: eiranotes/Bindery

Reviewed areas:

- AI flow documentation: docs/AI_WRITING_PIPELINE_FLOW_20260703.md
- Task backlog: docs/TASKS.md
- AIStudio and Mission Control UI components
- Pipeline action layer and prompt/guidance code
- Run/artifact stores
- Candidate diff/apply implementation
- Tauri project seed and native command bridge

Extracted observations:

- Valuable: local-first files, candidate-first diff/apply, snapshot before apply, run/artifact logs, prompt preview, style system.
- Missing for a ground-up longform harness: idea discovery, world expansion, bible generation, dedicated plot/episode/scene planning before draft, canon authority, Story License, Story Envelope, Canon Delta approval, branch/lineage, web-AI exchange, prompt audit, provider-neutral adapter contracts, and a clear static-vs-AI separation.
