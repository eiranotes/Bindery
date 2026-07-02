export type ProjectConfig = { title: string; language: string; engine: { mock: boolean; geminiCliPath: string } };
export type EpisodeMetadata = { episode: string; status: string; pov?: string; tags?: string[] };
export type QAIssue = { id: string; gate: string; severity: 'info'|'warn'|'fail'; message: string; file?: string; line?: number };
