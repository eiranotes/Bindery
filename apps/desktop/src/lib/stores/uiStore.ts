import { writable } from 'svelte/store';

export type CenterView = 'write' | 'materials' | 'style' | 'ai' | 'export' | 'help';

export const mainViews: Array<{ id: CenterView; label: string; hint: string }> = [
  { id: 'write', label: '집필', hint: '원고 작성' },
  { id: 'materials', label: '자료', hint: '설정집·플롯' },
  { id: 'style', label: '문체', hint: '문체 분석·재현' },
  { id: 'ai', label: 'AI 작업', hint: '연결→바이블→실행→검토' },
  { id: 'export', label: '내보내기', hint: '스냅샷·기록' }
];

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
