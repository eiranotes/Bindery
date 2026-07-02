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
  uiStore.update((s) => ({ ...s, centerView: 'write', binderTab: 'files' }));
  await Promise.all([loadCodexAction(), loadPlotAction()]);
  return project;
}

export async function createProjectIntoWorkspace(input: CreateProjectInput): Promise<ProjectInfo> {
  const project = await createProject(input);
  return openProjectIntoWorkspace(project.rootPath);
}
