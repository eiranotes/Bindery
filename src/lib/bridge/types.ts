// Bridge — 프런트엔드가 로컬 파일/에이전트에 접근하는 유일한 인터페이스.
// dev(비테 미들웨어) / memory(테스트·데모) / (로드맵) tauri 어댑터가 이 계약을 구현한다.
export type FileNode = {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: FileNode[];
};

export type AgentSettings = {
  command: string;
  argsTemplate: string[];
  outputMode: 'stdout' | 'file';
  model?: string;
  timeoutMs?: number;
};

export type AgentResult = {
  ok: boolean;
  text: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  /** cli | timeout | spawn-error | memory-mock | unavailable */
  mode: string;
  /** 실행 프롬프트 원문이 저장된 프로젝트 상대 경로 (.bindery/trace/…) */
  promptFile?: string;
};

export type AgentStreamEvent =
  | { type: 'status'; text: string; promptFile?: string }
  | { type: 'stdout' | 'stderr'; text: string }
  | { type: 'done'; result: AgentResult };

export interface Bridge {
  readonly kind: 'dev' | 'memory' | 'tauri';
  readFile(root: string, path: string): Promise<string>;
  writeFile(root: string, path: string, content: string): Promise<void>;
  moveFile(root: string, from: string, to: string): Promise<void>;
  deleteFile(root: string, path: string): Promise<void>;
  exists(root: string, path: string): Promise<boolean>;
  listTree(root: string): Promise<FileNode[]>;
  /** 프로젝트 루트 폴더 생성. 반환값은 절대경로 루트. */
  scaffold(base: string, name: string): Promise<string>;
  runAgent(root: string, prompt: string, label: string, settings: AgentSettings): Promise<AgentResult>;
  runAgentStream?(
    root: string,
    prompt: string,
    label: string,
    settings: AgentSettings,
    onEvent: (event: AgentStreamEvent) => void
  ): Promise<AgentResult>;
  cancelAgent?(root: string, label: string): Promise<{ ok: boolean; cancelled: boolean }>;
  /** 패키지 앱의 네이티브 폴더 선택기. dev/memory 브리지에서는 생략 가능. */
  pickFolder?(prompt: string): Promise<{ path: string; cancelled: boolean }>;
  env(): Promise<{ home: string; cwd: string }>;
}
