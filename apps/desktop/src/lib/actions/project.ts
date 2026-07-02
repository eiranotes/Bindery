import { get } from 'svelte/store';
import { createProject, listTree, openProject, readFile } from '$lib/api/commands';
import { candidateStore } from '$lib/stores/candidateStore';
import { editorStore } from '$lib/stores/editorStore';
import { fileTreeStore } from '$lib/stores/fileTreeStore';
import { projectStore } from '$lib/stores/projectStore';
import { uiStore } from '$lib/stores/uiStore';
import { computeStats } from '$lib/editor';
import { loadCodexAction, loadPlotAction } from '$lib/actions/pipeline';
import type { CreateProjectInput, FileNode, ProjectInfo } from '$lib/types';

function firstWritable(nodes: FileNode[]): string | null {
  for (const node of nodes) {
    if (node.kind === 'file' && node.path.endsWith('manuscript.md')) return node.path;
    if (node.children) {
      const child = firstWritable(node.children);
      if (child) return child;
    }
  }
  for (const node of nodes) {
    if (node.kind === 'file' && node.path.endsWith('.md')) return node.path;
    if (node.children) {
      const child = firstWritable(node.children);
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
      wordCount: computeStats(content).words
    });
  } else {
    editorStore.set({ path: null, content: '', savedContent: '', dirty: false, mode: 'source', wordCount: 0 });
  }

  candidateStore.set({ candidates: [], activeId: null, generating: false, appliedHunks: new Set(), sessionSnapshotId: null });
  uiStore.update((s) => ({ ...s, centerView: 'write', binderTab: 'episodes' }));
  await Promise.all([loadCodexAction(), loadPlotAction()]);
  return project;
}

export async function createProjectIntoWorkspace(input: CreateProjectInput): Promise<ProjectInfo> {
  const project = await createProject(input);
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
    wordCount: computeStats(content).words
  });
  if (view === 'write') uiStore.update((s) => ({ ...s, centerView: 'write' }));
}
