import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settingsStore';
import type { CreateProjectInput, FileNode, JobResult, ProjectInfo, RepetitionReport, SnapshotInfo } from '$lib/types';
import type { CodexItem, MentionReport } from '$lib/domain/codex';
import { scanDynamicLinks } from '$lib/domain/codex';
import type { PlotGrid } from '$lib/domain/plot';
import { MOCK_CODEX, MOCK_QA_REPORT, MOCK_REVISION_PLAN, MOCK_CANDIDATE } from '$lib/mock/data';
import { MOCK_PLOT_GRID } from '$lib/domain/plot';

const sampleMd = `---
episode: ep001
status: draft
pov: protagonist
location: guild-office
characters:
  - protagonist
  - eira
---

# EP001 원고

에이라는 말없이 자료를 넘겼다. 그 시선은 서류 아래쪽에서 멈췄다.

주인공은 고개를 끄덕였다. 하지만 그 침묵은 오래 가지 않았다. 시선이 다시 표의 끝으로 향했다.

“숫자만 보면 통과예요.”

에이라의 시선은 각주 위에서 다시 멈췄다. 주인공은 또 고개를 끄덕였다.

“하지만 이 부상 이력은 그냥 넘기면 안 됩니다.”

> 이 원고는 브라우저 mock mode 샘플입니다. 시선·침묵·고개 같은 반응 묘사가 의도적으로 반복되어 있습니다.
`;

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

async function getInvoke(): Promise<InvokeFn | null> {
  if (typeof window === 'undefined') return null;
  // Settings gate: when mockMode is on, always use the client-side mocks even
  // inside a real Tauri runtime (useful for demos and offline testing).
  if (get(settingsStore).mockMode) return null;
  const hasTauri = (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  if (!hasTauri) return null;
  const api = await import('@tauri-apps/api/core');
  return api.invoke as InvokeFn;
}

function mockTree(): FileNode[] {
  return [
    { name: 'story', path: 'story', kind: 'directory', children: [
      { name: 'chapters', path: 'story/chapters', kind: 'directory', children: [
        { name: 'ep001', path: 'story/chapters/ep001', kind: 'directory', children: [
          { name: 'index.md', path: 'story/chapters/ep001/index.md', kind: 'file' },
          { name: 'manuscript.md', path: 'story/chapters/ep001/manuscript.md', kind: 'file' }
        ]}
      ]}
    ]},
    { name: 'canon', path: 'canon', kind: 'directory', children: [
      { name: 'setting-bible.md', path: 'canon/setting-bible.md', kind: 'file' }
    ]},
    { name: 'plot', path: 'plot', kind: 'directory', children: [
      { name: 'open-threads.md', path: 'plot/open-threads.md', kind: 'file' }
    ]},
    { name: 'notes', path: 'notes', kind: 'directory', children: [
      { name: 'inbox.md', path: 'notes/inbox.md', kind: 'file' }
    ]}
  ];
}

function titleFromPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === 'sample-project') return '샘플 작품';
  return trimmed.split(/[\\/]/).filter(Boolean).pop() ?? '새 작품';
}

function mockProjectPath(input: CreateProjectInput): string {
  const base = input.basePath.trim().replace(/[\\/]$/, '') || '~/Documents/Bindery Projects';
  const title = input.title.trim() || '새 작품';
  return `${base}/${title.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()}`;
}

export async function openProject(path: string): Promise<ProjectInfo> {
  const invoke = await getInvoke();
  if (invoke) return invoke<ProjectInfo>('open_project', { path });
  return { rootPath: path || 'sample-project', title: titleFromPath(path), hasNovelctlConfig: true, hasGeminiConfig: path === 'sample-project' };
}

export async function createProject(input: CreateProjectInput): Promise<ProjectInfo> {
  const invoke = await getInvoke();
  if (invoke) return invoke<ProjectInfo>('create_project', input);
  const rootPath = mockProjectPath(input);
  return { rootPath, title: input.title.trim() || '새 작품', hasNovelctlConfig: true, hasGeminiConfig: false };
}

export async function listTree(path: string): Promise<FileNode[]> {
  const invoke = await getInvoke();
  if (invoke) return invoke<FileNode[]>('list_tree', { path });
  return mockTree();
}

export async function readFile(projectPath: string, relativePath: string): Promise<string> {
  const path = relativePath;
  const invoke = await getInvoke();
  if (invoke) {
    const result = await invoke<{ path: string; content: string }>('read_file', { projectPath, relativePath });
    return result.content;
  }
  if (path.endsWith('index.md')) return '# EP001 작업 메모\n\n- 원고: manuscript.md\n- 컨텍스트: 대기\n- QA: 대기\n';
  if (path.endsWith('setting-bible.md')) return '# 설정집\n\n- 확정 설정의 기준 문서입니다.\n';
  if (path.endsWith('open-threads.md')) return '# 열린 떡밥\n\n- 의료 리스크 노출.\n';
  return sampleMd;
}

export async function writeFile(projectPath: string, relativePath: string, content: string): Promise<void> {
  const path = relativePath;
  const invoke = await getInvoke();
  if (invoke) return invoke<void>('write_file', { projectPath, relativePath, content });
  console.info('[mock write]', projectPath, path, content.length);
}

export async function runNovelctl(projectPath: string, args: string[]): Promise<JobResult> {
  const invoke = await getInvoke();
  const novelctlPath = get(settingsStore).novelctlPath || 'novelctl';
  if (invoke) return invoke<JobResult>('run_novelctl', { projectPath, args, novelctlPath });
  return {
    ok: true,
    command: ['novelctl', ...args],
    stdout: `mock novelctl ${args.join(' ')} 완료\noutput: story/chapters/ep001/${args[0] || 'status'}.md`,
    stderr: '',
    exitCode: 0,
    outputFiles: [`story/chapters/ep001/${args[0] || 'status'}.md`],
    mode: 'browser-mock'
  };
}

export async function analyzeRepetition(projectPath: string, relativePath: string): Promise<RepetitionReport> {
  const path = relativePath;
  const invoke = await getInvoke();
  if (invoke) return invoke<RepetitionReport>('analyze_repetition', { projectPath, relativePath });
  return {
    path,
    terms: [
      { term: '시선', count: 9, positions: [42, 220, 418], judgment: 'overused' },
      { term: '침묵', count: 5, positions: [81, 322], judgment: 'watch' },
      { term: '고개', count: 4, positions: [110], judgment: 'watch' },
      { term: '에이라', count: 7, positions: [1, 80, 140], judgment: 'ok' }
    ]
  };
}

export async function createSnapshot(projectPath: string, targetPath: string, label?: string, content?: string): Promise<SnapshotInfo> {
  const invoke = await getInvoke();
  if (invoke) return invoke<SnapshotInfo>('create_snapshot', { projectPath, targetPath, label, content });
  return {
    id: `mock-${Date.now()}`,
    label,
    createdAt: new Date().toISOString(),
    targetPath,
    snapshotPath: `.snapshots/mock/${targetPath}`,
    sha256: 'mock'
  };
}

export async function listSnapshots(projectPath: string): Promise<SnapshotInfo[]> {
  const invoke = await getInvoke();
  if (invoke) return invoke<SnapshotInfo[]>('list_snapshots', { projectPath });
  return [];
}

export async function testAgentCli(command: string, provider: string, outputMode: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const invoke = await getInvoke();
  if (invoke) return invoke('test_agent_cli', { command, provider, outputMode });
  return { ok: true, stdout: `mock: ${command} --version (${provider}/${outputMode})`, stderr: '' };
}

export async function testGeminiCli(command: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return testAgentCli(command, 'gemini', 'stdout');
}

export type AgentTextResult = { ok: boolean; text: string; mode: string };

/** 범용 에이전트 실행 — 문체 스튜디오 등 자유 프롬프트 단계에서 사용.
 *  브라우저/데모 모드에서는 ok:false를 돌려주고 호출부가 오프라인 생성기로 대체한다. */
export async function runAgentText(projectPath: string, prompt: string, label: string): Promise<AgentTextResult> {
  const invoke = await getInvoke();
  if (!invoke) return { ok: false, text: '', mode: 'browser-mock' };
  const settings = get(settingsStore);
  return invoke<AgentTextResult>('run_agent_text', {
    projectPath,
    prompt,
    agentCliPath: settings.agentCliPath || null,
    agentProvider: settings.agentProvider || 'codex',
    agentOutputMode: settings.agentOutputMode || 'stdout',
    label
  });
}

// ---------------------------------------------------------------------------
// Stage 3 additions — QA, candidates, codex, plot grid.
// Tauri command signatures are kept as the single source of truth; the mock
// branch lets browser mode exercise the same UI without a backend.
// ---------------------------------------------------------------------------

export async function runQA(projectPath: string, episode: string): Promise<{ report: string }> {
  const invoke = await getInvoke();
  if (invoke) return invoke<{ report: string }>('run_qa', { projectPath, episode });
  await delay(280);
  return { report: MOCK_QA_REPORT };
}

export async function generateRevisionPlan(projectPath: string, episode: string): Promise<{ plan: string }> {
  const invoke = await getInvoke();
  if (invoke) return invoke<{ plan: string }>('generate_revision_plan', { projectPath, episode });
  await delay(220);
  return { plan: MOCK_REVISION_PLAN };
}

export type Candidate = { id: string; label: string; content: string; source: string; createdAt: string };

export async function generateCandidate(
  projectPath: string,
  episode: string,
  kind: 'draft' | 'revise' | 'continue' | 'rewrite',
  base: string,
  guidance?: string
): Promise<Candidate[]> {
  const invoke = await getInvoke();
  const settings = get(settingsStore);
  const agentCliPath = settings.agentCliPath || settings.geminiCliPath || 'agy';
  const agentProvider = settings.agentProvider || 'antigravity';
  const agentOutputMode = settings.agentOutputMode || (agentProvider === 'antigravity' ? 'file' : 'stdout');
  if (invoke) return invoke<Candidate[]>('generate_candidate', { projectPath, episode, kind, base, agentCliPath, agentProvider, agentOutputMode, guidance: guidance || null });
  await delay(420);
  const now = new Date().toISOString();
  const kindLabel = { draft: '초안', revise: '수정', continue: '이어쓰기', rewrite: '다시쓰기' }[kind];
  // Two variants so the Apply UI can show A/B, per the EP012 example flow.
  return [
    { id: `cand-a-${Date.now()}`, label: '후보 A', content: MOCK_CANDIDATE, source: `${kindLabel} 후보 A`, createdAt: now },
    {
      id: `cand-b-${Date.now()}`,
      label: '후보 B',
      content: MOCK_CANDIDATE.replace('책상 위로 밀어 넣었다', '조용히 책상 위에 올려두었다').replace('두 달치 비어 있어요', '석 달치 통째로 비어 있어요'),
      source: `${kindLabel} 후보 B`,
      createdAt: now
    }
  ];
}

export async function listCodex(projectPath: string): Promise<CodexItem[]> {
  const invoke = await getInvoke();
  if (invoke) return invoke<CodexItem[]>('list_codex', { projectPath });
  await delay(120);
  return MOCK_CODEX;
}

export async function scanCodexLinks(projectPath: string, path: string, content: string): Promise<MentionReport> {
  const invoke = await getInvoke();
  if (invoke) return invoke<MentionReport>('scan_codex_links', { projectPath, path, content });
  await delay(160);
  // In mock mode we run the real scanner client-side against provided content.
  return scanDynamicLinks(path, content, MOCK_CODEX, 0.4);
}

export async function getPlotGrid(projectPath: string): Promise<PlotGrid> {
  const invoke = await getInvoke();
  if (invoke) return invoke<PlotGrid>('get_plot_grid', { projectPath });
  await delay(140);
  return MOCK_PLOT_GRID;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
