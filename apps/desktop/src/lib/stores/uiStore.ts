import { writable } from 'svelte/store';

export type CenterView = 'write' | 'materials' | 'ai' | 'export' | 'help';

export const mainViews: Array<{ id: CenterView; label: string; hint: string }> = [
  { id: 'write', label: '집필', hint: '원고 작성' },
  { id: 'materials', label: '자료', hint: '설정집·플롯' },
  { id: 'ai', label: 'AI 작업', hint: '연결→바이블→실행→검토' },
  { id: 'export', label: '내보내기', hint: '스냅샷·기록' }
];

export const uiStore = writable<{
  centerView: CenterView;
  binderTab: 'files' | 'bible';
  prefsOpen: boolean;
}>({ centerView: 'write', binderTab: 'files', prefsOpen: false });

export function gotoView(view: CenterView) {
  uiStore.update((s) => ({ ...s, centerView: view }));
}
