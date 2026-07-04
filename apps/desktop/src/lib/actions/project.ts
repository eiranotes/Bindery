import { get } from 'svelte/store';
import { createProject, listTree, openProject, readFile, runAgentText, writeFile } from '$lib/api/commands';
import { candidateStore } from '$lib/stores/candidateStore';
import { editorStore } from '$lib/stores/editorStore';
import { fileTreeStore } from '$lib/stores/fileTreeStore';
import { projectStore } from '$lib/stores/projectStore';
import { uiStore } from '$lib/stores/uiStore';
import { computeStats } from '$lib/editor';
import { hydrateArtifactsFromProject } from '$lib/stores/artifactStore';
import { hydrateRunsFromProject } from '$lib/stores/runStore';
import { hydrateOutlineFromProject } from '$lib/stores/outlineStore';
import { hydrateEpisodeProgress } from '$lib/stores/episodeProgressStore';
import { emptyCandidateState } from '$lib/stores/candidateStore';
import { loadCodexAction, loadPlotAction } from '$lib/actions/pipeline';
import { buildSourceIntake, buildSourceIntakeFiles, parseAgentSourceIntake, sourceIntakeAgentPrompt } from '$lib/domain/sourceIntake';
import type { CreateProjectInput, FileNode, ProjectInfo } from '$lib/types';

export type CreateSourceIntakeProjectInput = CreateProjectInput & {
  sourceText: string;
  sourceFileName?: string;
  useAgentRefinement?: boolean;
};

function firstWritable(nodes: FileNode[]): string | null {
  const manuscript = findFirstFile(nodes, (path) => path.endsWith('manuscript.md'));
  if (manuscript) return manuscript;
  return findFirstFile(nodes, (path) => path.endsWith('.md'));
}

function findFirstFile(nodes: FileNode[], matches: (path: string) => boolean): string | null {
  for (const node of nodes) {
    if (node.kind === 'file' && matches(node.path)) return node.path;
    if (node.children) {
      const child = findFirstFile(node.children, matches);
      if (child) return child;
    }
  }
  return null;
}

export async function openProjectIntoWorkspace(path: string): Promise<ProjectInfo> {
  const project = await openProject(path);
  projectStore.update((s) => ({
    current: project,
    recent: [project.rootPath, ...s.recent.filter((p) => p !== project.rootPath)].slice(0, 12)
  }));

  const nodes = await listTree(project.rootPath);
  const selectedPath = firstWritable(nodes);
  fileTreeStore.set({ nodes, selectedPath });

  if (selectedPath) {
    const content = await readFile(project.rootPath, selectedPath);
    editorStore.set({
      path: selectedPath,
      content,
      savedContent: content,
      dirty: false,
      mode: 'source',
      wordCount: computeStats(content).charsNoSpace
    });
  } else {
    editorStore.set({ path: null, content: '', savedContent: '', dirty: false, mode: 'source', wordCount: 0 });
  }

  candidateStore.set(emptyCandidateState());
  // AI 파이프라인이 기본 작업면이다. 집필은 상단 탭으로 언제든 전환한다.
  uiStore.update((s) => ({ ...s, centerView: 'pipeline', binderTab: 'episodes' }));
  await Promise.all([
    loadCodexAction(),
    loadPlotAction(),
    hydrateArtifactsFromProject(project.rootPath),
    hydrateRunsFromProject(project.rootPath),
    hydrateOutlineFromProject(project.rootPath),
    hydrateEpisodeProgress(project.rootPath)
  ]);
  return project;
}

export async function createProjectIntoWorkspace(input: CreateProjectInput): Promise<ProjectInfo> {
  const project = await createProject(input);
  return openProjectIntoWorkspace(project.rootPath);
}

export async function createProjectFromSourceIntake(input: CreateSourceIntakeProjectInput): Promise<ProjectInfo> {
  const project = await createProject({
    basePath: input.basePath,
    title: input.title,
    author: input.author,
    template: input.template ?? 'serial'
  });
  const local = buildSourceIntake({
    title: input.title,
    sourceText: input.sourceText,
    sourceFileName: input.sourceFileName
  });
  let refined = local;
  const sourceRaw = buildSourceIntakeFiles(local, input.sourceText).find((file) => file.path === 'notes/source-raw.md');
  if (sourceRaw) await writeFile(project.rootPath, sourceRaw.path, sourceRaw.content);

  if (input.useAgentRefinement) {
    const agent = await runAgentText(project.rootPath, sourceIntakeAgentPrompt('notes/source-raw.md', local), `source-intake-${Date.now()}`);
    if (agent.ok && agent.text.trim()) {
      refined = parseAgentSourceIntake(agent.text, local) ?? local;
    }
  }
  const files = buildSourceIntakeFiles(refined, input.sourceText);
  await Promise.all(files.map((file) => writeFile(project.rootPath, file.path, file.content)));
  return openProjectIntoWorkspace(project.rootPath);
}

/** 파일을 에디터로 열고 집필 화면으로 이동한다. 바이블 확인 등 다른 화면에서 재사용. */
export async function openFileInEditor(relativePath: string, view: 'write' | 'stay' = 'write'): Promise<void> {
  const root = get(projectStore).current?.rootPath || 'sample-project';
  const content = await readFile(root, relativePath);
  fileTreeStore.update((s) => ({ ...s, selectedPath: relativePath }));
  editorStore.set({
    path: relativePath,
    content,
    savedContent: content,
    dirty: false,
    mode: 'source',
    wordCount: computeStats(content).charsNoSpace
  });
  if (view === 'write') uiStore.update((s) => ({ ...s, centerView: 'write' }));
}
