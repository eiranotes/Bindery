export type FileKind = 'file' | 'directory';

export type FileNode = {
  name: string;
  path: string;
  kind: FileKind;
  children?: FileNode[];
};

export type ProjectInfo = {
  rootPath: string;
  title: string;
  hasNovelctlConfig: boolean;
  hasGeminiConfig: boolean;
};

export type CreateProjectInput = {
  basePath: string;
  title: string;
  author?: string;
  template?: 'serial' | 'blank';
};

export type JobResult = {
  ok: boolean;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  outputFiles?: string[];
  mode?: string;
};

export type JobRecord = JobResult & {
  id: string;
  createdAt: string;
  label: string;
  status: 'queued' | 'running' | 'ok' | 'failed';
};

export type SnapshotInfo = {
  id: string;
  label?: string;
  createdAt: string;
  targetPath: string;
  snapshotPath: string;
  sha256?: string;
};

export type RepetitionReport = {
  path: string;
  terms: Array<{
    term: string;
    count: number;
    positions: number[];
    judgment: 'ok' | 'watch' | 'overused';
  }>;
};

export type EditorMode = 'source' | 'split' | 'preview' | 'review' | 'diff';
