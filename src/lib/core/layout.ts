// 프로젝트 파일 레이아웃 — Markdown-native 진실 구조의 단일 정의.
// 어떤 코드도 경로 문자열을 직접 만들지 않고 여기를 통해 만든다.

export const LAYOUT = {
  projectMeta: 'project.yaml',
  ideas: {
    inbox: 'ideas/inbox',
    seeds: 'ideas/seeds',
    selected: 'ideas/selected',
    discarded: 'ideas/discarded'
  },
  canon: {
    bible: 'canon/setting-bible.md',
    summaries: 'canon/summaries'
  },
  characters: 'characters',
  relationships: 'relationships',
  world: {
    root: 'world',
    locations: 'world/locations',
    institutions: 'world/institutions',
    systems: 'world/systems',
    rules: 'world/rules.md',
    terms: 'world/terms.md'
  },
  plot: {
    seriesOutline: 'plot/series-outline.md',
    board: 'plot/plot-board.json',
    openThreads: 'plot/open-threads.md'
  },
  style: {
    guide: 'style/style-guide.md',
    presets: 'style/presets',
    presetIndex: 'style/presets/index.json',
    history: 'style/history.json'
  },
  status: {
    resume: 'status/resume-state.md',
    story: 'status/story-state.md'
  },
  story: {
    chapters: 'story/chapters'
  },
  exports: 'exports',
  bindery: {
    root: '.bindery',
    artifacts: '.bindery/artifacts',
    runs: '.bindery/runs',
    proposals: '.bindery/proposals',
    candidates: '.bindery/candidates',
    snapshots: '.bindery/snapshots',
    exchange: '.bindery/exchange',
    trace: '.bindery/trace',
    settings: '.bindery/settings.json'
  },
  promptsCopy: 'prompts'
} as const;

export type IdeaStatus = keyof typeof LAYOUT.ideas; // inbox | seeds | selected | discarded

export function ideaDir(status: IdeaStatus): string {
  return LAYOUT.ideas[status];
}

export function episodeId(n: number): string {
  return `ep${String(n).padStart(3, '0')}`;
}

export function episodeDir(ep: string): string {
  return `${LAYOUT.story.chapters}/${ep}`;
}

export function episodePaths(ep: string) {
  const dir = episodeDir(ep);
  return {
    dir,
    brief: `${dir}/brief.md`,
    scenePlan: `${dir}/scene-plan.md`,
    manuscript: `${dir}/manuscript.md`,
    index: `${dir}/index.md`
  };
}

export function summaryPath(ep: string): string {
  return `${LAYOUT.canon.summaries}/${ep}.md`;
}

export function artifactPath(scope: string, name: string): string {
  return `${LAYOUT.bindery.artifacts}/${scope}/${name}`;
}

export function candidatePath(ep: string, name: string): string {
  return `${LAYOUT.bindery.candidates}/${ep}/${name}`;
}

export function proposalPath(id: string): string {
  return `${LAYOUT.bindery.proposals}/${id}.json`;
}

export function proposalIndexPath(): string {
  return `${LAYOUT.bindery.proposals}/index.json`;
}

export function runPath(runId: string): string {
  return `${LAYOUT.bindery.runs}/${runId}.json`;
}

export function snapshotPath(ep: string | null, name: string): string {
  return `${LAYOUT.bindery.snapshots}/${ep ?? 'project'}/${name}`;
}

export function exchangeDir(id: string): string {
  return `${LAYOUT.bindery.exchange}/${id}`;
}
