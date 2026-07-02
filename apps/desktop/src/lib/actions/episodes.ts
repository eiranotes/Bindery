// 회차 액션 — 파일 트리에서 회차를 도출하고, 새 회차 생성/열기를 담당한다.
import { get } from 'svelte/store';
import { writeFile, listTree } from '$lib/api/commands';
import { projectStore } from '$lib/stores/projectStore';
import { fileTreeStore } from '$lib/stores/fileTreeStore';
import { episodeStore } from '$lib/stores/episodeStore';
import { toasts } from '$lib/stores/toastStore';
import { openFileInEditor } from './project';
import type { FileNode } from '$lib/types';

export type EpisodeEntry = {
  id: string; // ep001
  manuscriptPath: string;
  files: number;
};

export function listEpisodes(nodes: FileNode[]): EpisodeEntry[] {
  const out: EpisodeEntry[] = [];
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.kind === 'directory' && /^ep\d+$/.test(n.name) && n.path.includes('chapters')) {
        const manuscript = n.children?.find((c) => c.name === 'manuscript.md');
        out.push({
          id: n.name,
          manuscriptPath: manuscript?.path ?? `${n.path}/manuscript.md`,
          files: n.children?.length ?? 0
        });
      }
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function episodeTemplate(id: string): string {
  return `---\nepisode: ${id}\nstatus: draft\npov: \nlocation: \ncharacters: []\n---\n\n# ${id.toUpperCase()} 원고\n\n`;
}

function indexTemplate(id: string): string {
  return `# ${id.toUpperCase()} 작업 메모\n\n- 원고: manuscript.md\n- 컨텍스트: 대기\n- QA: 대기\n`;
}

export async function openEpisode(entry: EpisodeEntry): Promise<void> {
  episodeStore.set({ currentEpisode: entry.id });
  await openFileInEditor(entry.manuscriptPath);
}

export async function createEpisode(): Promise<void> {
  const root = get(projectStore).current?.rootPath || 'sample-project';
  const episodes = listEpisodes(get(fileTreeStore).nodes);
  const nextNum = episodes.reduce((max, e) => Math.max(max, parseInt(e.id.slice(2), 10) || 0), 0) + 1;
  const id = `ep${String(nextNum).padStart(3, '0')}`;
  const dir = `story/chapters/${id}`;
  try {
    await writeFile(root, `${dir}/manuscript.md`, episodeTemplate(id));
    await writeFile(root, `${dir}/index.md`, indexTemplate(id));
    const nodes = await listTree(root);
    fileTreeStore.update((s) => ({ ...s, nodes }));
    episodeStore.set({ currentEpisode: id });
    await openFileInEditor(`${dir}/manuscript.md`);
    toasts.push(`새 회차 생성됨: ${id}`, 'ok');
  } catch (e) {
    toasts.push(`회차 생성 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
  }
}
