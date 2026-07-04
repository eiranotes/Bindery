import { writable } from 'svelte/store';

export type CenterView = 'pipeline' | 'write' | 'materials' | 'style' | 'export' | 'help';

// AI 파이프라인이 제품의 중심 흐름이므로 최상위 첫 탭이다.
// 문체·내보내기 같은 보조 도구만 「작업실」로 접는다.
export const primaryViews: Array<{ id: CenterView; label: string; hint: string }> = [
  { id: 'pipeline', label: '파이프라인', hint: '아웃라인→회차 실행→검토→픽스' },
  { id: 'write', label: '집필', hint: '원고 작성·수작업 수정' },
  { id: 'materials', label: '자료', hint: '설정집·플롯' }
];

export const studioViews: Array<{ id: CenterView; label: string; hint: string }> = [
  { id: 'style', label: '문체 재현', hint: '문체 분석·재현' },
  { id: 'export', label: '내보내기', hint: '스냅샷·기록·합본' }
];

const studioViewIds: CenterView[] = ['style', 'export'];
export function isStudioView(view: CenterView): boolean {
  return studioViewIds.includes(view);
}

/** 파이프라인 워크벤치 중앙 뷰어 탭 */
export type PipelineTab = 'artifact' | 'prompt' | 'context' | 'outline' | 'review';

export const uiStore = writable<{
  centerView: CenterView;
  binderTab: 'episodes' | 'files' | 'bible';
  sidebarCollapsed: boolean;
  prefsOpen: boolean;
  prefsSection: string | null;
  searchOpen: boolean;
  pipelineTab: PipelineTab;
}>({
  centerView: 'pipeline',
  binderTab: 'episodes',
  sidebarCollapsed: false,
  prefsOpen: false,
  prefsSection: null,
  searchOpen: false,
  pipelineTab: 'artifact'
});

export function gotoView(view: CenterView) {
  uiStore.update((s) => ({ ...s, centerView: view }));
}

export function gotoPipeline(tab?: PipelineTab) {
  uiStore.update((s) => ({ ...s, centerView: 'pipeline', pipelineTab: tab ?? s.pipelineTab }));
}

export function toggleSidebar() {
  uiStore.update((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
}
