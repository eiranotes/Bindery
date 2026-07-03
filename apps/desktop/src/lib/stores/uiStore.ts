import { writable } from 'svelte/store';

export type CenterView = 'write' | 'materials' | 'style' | 'ai' | 'export' | 'help';

// 상단은 글쓰는 사람이 늘 오가는 두 면만 둔다. 문체·AI·내보내기 같은 도구는
// 하나의 「작업실」로 접어 상단 탭 혼잡과 3단 분산을 줄인다.
export const primaryViews: Array<{ id: CenterView; label: string; hint: string }> = [
  { id: 'write', label: '집필', hint: '원고 작성' },
  { id: 'materials', label: '자료', hint: '설정집·플롯' }
];

export const studioViews: Array<{ id: CenterView; label: string; hint: string }> = [
  { id: 'style', label: '문체 재현', hint: '문체 분석·재현' },
  { id: 'ai', label: 'AI 파이프라인', hint: '연결→바이블→실행→검토' },
  { id: 'export', label: '내보내기', hint: '스냅샷·기록·합본' }
];

const studioViewIds: CenterView[] = ['style', 'ai', 'export'];
export function isStudioView(view: CenterView): boolean {
  return studioViewIds.includes(view);
}

export const uiStore = writable<{
  centerView: CenterView;
  binderTab: 'episodes' | 'files' | 'bible';
  sidebarCollapsed: boolean;
  prefsOpen: boolean;
  searchOpen: boolean;
}>({ centerView: 'write', binderTab: 'episodes', sidebarCollapsed: false, prefsOpen: false, searchOpen: false });

export function gotoView(view: CenterView) {
  uiStore.update((s) => ({ ...s, centerView: view }));
}

export function toggleSidebar() {
  uiStore.update((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
}
