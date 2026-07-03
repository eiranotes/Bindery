import { writable } from 'svelte/store';

export type PendingAICommandContext = {
  command: string;
  selectedText?: string;
  cursorContext?: string;
  cursorOffset?: number;
  createdAt: string;
};

export const aiCommandContextStore = writable<PendingAICommandContext | null>(null);
