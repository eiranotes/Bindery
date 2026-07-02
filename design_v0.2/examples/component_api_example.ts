// Example frontend API wrapper
import { invoke } from '@tauri-apps/api/core';

export type JobHandle = { jobId: string };

export async function runEpisodeQA(project: string, episode: string, qaTypes: string[]): Promise<JobHandle> {
  return await invoke<JobHandle>('run_episode_qa', { project, episode, qaTypes });
}

export async function readFile(project: string, path: string): Promise<{ content: string; sha256: string }> {
  return await invoke('read_file', { project, path });
}
