import { writable } from 'svelte/store';

export type BuildStep = 'brief' | 'foundations' | 'spine' | 'chapters' | 'beats' | 'prose' | 'read' | 'publish';
export type CenterView = 'write' | 'pipeline' | 'materials' | 'review' | 'publish' | 'help' | 'diff' | BuildStep;
export type RightTab = 'agent' | 'settings';

export const buildSteps: Array<{ id: BuildStep; label: string; hint: string }> = [
  { id: 'brief', label: '기획', hint: '약속' },
  { id: 'foundations', label: '설정', hint: '규칙' },
  { id: 'spine', label: '줄거리', hint: '축' },
  { id: 'chapters', label: '회차', hint: '구조' },
  { id: 'beats', label: '비트', hint: '장면' },
  { id: 'prose', label: '원고', hint: '작성' },
  { id: 'read', label: '검토', hint: '교정' },
  { id: 'publish', label: '내보내기', hint: '출력' }
];

export const mainViews: Array<{ id: CenterView; label: string; hint: string }> = [
  { id: 'write', label: '작성', hint: '원고' },
  { id: 'pipeline', label: 'AI 작업', hint: '후보·검토' },
  { id: 'materials', label: '자료', hint: '설정·플롯' },
  { id: 'review', label: '검토', hint: 'QA' },
  { id: 'publish', label: '내보내기', hint: '스냅샷' },
  { id: 'help', label: '도움말', hint: '흐름' }
];

export const uiStore = writable<{
  centerView: CenterView;
  binderTab: 'book' | 'files' | 'bible';
  rightTab: RightTab;
}>({ centerView: 'write', binderTab: 'files', rightTab: 'agent' });
